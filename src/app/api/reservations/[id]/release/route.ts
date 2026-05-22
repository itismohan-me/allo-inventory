import { prisma } from "@/lib/prisma";
import { NextRequest } from "next/server";

export async function POST(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  const reservation = await prisma.$transaction(async (tx) => {
    const existing = await tx.reservation.findUnique({ where: { id } });

    if (!existing) {
      return null;
    }

    if (existing.status !== "PENDING") {
      return existing;
    }

    await tx.$executeRaw`
      UPDATE "Stock"
      SET reserved = reserved - ${existing.quantity}
      WHERE "productId"   = ${existing.productId}
        AND "warehouseId" = ${existing.warehouseId}
    `;

    return tx.reservation.update({
      where: { id },
      data: { status: "RELEASED" },
      include: {
        product: { select: { name: true, sku: true } },
        warehouse: { select: { name: true } },
      },
    });
  });

  if (!reservation) {
    return Response.json({ error: "Reservation not found" }, { status: 404 });
  }

  return Response.json(reservation);
}
