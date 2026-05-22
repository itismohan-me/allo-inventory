import { prisma } from "@/lib/prisma";
import { redis, IDEMPOTENCY_TTL } from "@/lib/redis";
import { NextRequest } from "next/server";

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const idempotencyKey = request.headers.get("Idempotency-Key");

  if (idempotencyKey) {
    const cached = await redis.get<{ status: number; body: unknown }>(
      `idem:${idempotencyKey}`
    );
    if (cached) {
      return Response.json(cached.body, { status: cached.status });
    }
  }

  let responseBody: unknown;
  let status: number;

  try {
    const reservation = await prisma.$transaction(async (tx) => {
      const existing = await tx.reservation.findUnique({ where: { id } });

      if (!existing) {
        throw new NotFoundError();
      }

      if (existing.status === "CONFIRMED") {
        return existing;
      }

      if (existing.status === "RELEASED" || existing.expiresAt < new Date()) {
        throw new ExpiredError();
      }

      // Decrement stock permanently — reserved units become truly consumed
      await tx.$executeRaw`
        UPDATE "Stock"
        SET total    = total - ${existing.quantity},
            reserved = reserved - ${existing.quantity}
        WHERE "productId"   = ${existing.productId}
          AND "warehouseId" = ${existing.warehouseId}
      `;

      return tx.reservation.update({
        where: { id },
        data: { status: "CONFIRMED" },
        include: {
          product: { select: { name: true, sku: true, price: true } },
          warehouse: { select: { name: true } },
        },
      });
    });

    responseBody = reservation;
    status = 200;
  } catch (err) {
    if (err instanceof NotFoundError) {
      responseBody = { error: "Reservation not found" };
      status = 404;
    } else if (err instanceof ExpiredError) {
      responseBody = { error: "Reservation has expired" };
      status = 410;
    } else {
      throw err;
    }
  }

  if (idempotencyKey) {
    await redis.setex(`idem:${idempotencyKey}`, IDEMPOTENCY_TTL, {
      status,
      body: responseBody,
    });
  }

  return Response.json(responseBody, { status });
}

class NotFoundError extends Error {}
class ExpiredError extends Error {}
