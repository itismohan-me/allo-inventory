import { prisma } from "@/lib/prisma";
import { releaseExpiredReservations } from "@/lib/expiry";
import { CreateReservationSchema, RESERVATION_TTL_MINUTES } from "@/lib/schemas";
import { redis, IDEMPOTENCY_TTL } from "@/lib/redis";
import { NextRequest } from "next/server";

export async function POST(request: NextRequest) {
  const idempotencyKey = request.headers.get("Idempotency-Key");

  // Idempotency: return cached response if key was already used
  if (idempotencyKey) {
    const cached = await redis.get<{ status: number; body: unknown }>(
      `idem:${idempotencyKey}`
    );
    if (cached) {
      return Response.json(cached.body, { status: cached.status });
    }
  }

  const body = await request.json();
  const parsed = CreateReservationSchema.safeParse(body);
  if (!parsed.success) {
    return Response.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const { productId, warehouseId, quantity } = parsed.data;

  // Lazy cleanup: release expired reservations for this stock before reserving
  await releaseExpiredReservations({ productId, warehouseId });

  let reservation;
  try {
    reservation = await prisma.$transaction(async (tx) => {
      // SELECT FOR UPDATE acquires a row-level lock — only one transaction can
      // proceed at a time for this product+warehouse combination.
      const stocks = await tx.$queryRaw<
        { id: string; total: number; reserved: number }[]
      >`
        SELECT id, total, reserved
        FROM "Stock"
        WHERE "productId" = ${productId}
          AND "warehouseId" = ${warehouseId}
        FOR UPDATE
      `;

      if (stocks.length === 0) {
        throw new StockNotFoundError();
      }

      const stock = stocks[0];
      const available = stock.total - stock.reserved;

      if (available < quantity) {
        throw new InsufficientStockError(available);
      }

      await tx.$executeRaw`
        UPDATE "Stock"
        SET reserved = reserved + ${quantity}
        WHERE id = ${stock.id}
      `;

      const expiresAt = new Date(
        Date.now() + RESERVATION_TTL_MINUTES * 60 * 1000
      );

      return tx.reservation.create({
        data: {
          productId,
          warehouseId,
          quantity,
          expiresAt,
          idempotencyKey: idempotencyKey ?? undefined,
        },
        include: {
          product: { select: { name: true, sku: true, price: true } },
          warehouse: { select: { name: true, location: true } },
        },
      });
    });
  } catch (err) {
    if (err instanceof InsufficientStockError) {
      const responseBody = {
        error: "Not enough stock available",
        available: err.available,
      };
      if (idempotencyKey) {
        await redis.setex(`idem:${idempotencyKey}`, IDEMPOTENCY_TTL, {
          status: 409,
          body: responseBody,
        });
      }
      return Response.json(responseBody, { status: 409 });
    }
    if (err instanceof StockNotFoundError) {
      return Response.json(
        { error: "Product/warehouse combination not found" },
        { status: 404 }
      );
    }
    throw err;
  }

  const responseBody = {
    id: reservation.id,
    productId: reservation.productId,
    warehouseId: reservation.warehouseId,
    quantity: reservation.quantity,
    status: reservation.status,
    expiresAt: reservation.expiresAt,
    product: reservation.product,
    warehouse: reservation.warehouse,
  };

  if (idempotencyKey) {
    await redis.setex(`idem:${idempotencyKey}`, IDEMPOTENCY_TTL, {
      status: 201,
      body: responseBody,
    });
  }

  return Response.json(responseBody, { status: 201 });
}

export async function GET() {
  const reservations = await prisma.reservation.findMany({
    include: {
      product: { select: { name: true, sku: true } },
      warehouse: { select: { name: true } },
    },
    orderBy: { createdAt: "desc" },
  });
  return Response.json(reservations);
}

class InsufficientStockError extends Error {
  constructor(public available: number) {
    super("Insufficient stock");
  }
}

class StockNotFoundError extends Error {
  constructor() {
    super("Stock not found");
  }
}
