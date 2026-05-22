import { prisma } from "./prisma";

interface Filter {
  productId?: string;
  warehouseId?: string;
}

/**
 * Finds PENDING reservations past their expiresAt, decrements the reserved
 * count for each, and marks them RELEASED. Accepts an optional filter to
 * scope the cleanup to a single product+warehouse (used by the reserve
 * endpoint so expired holds don't block new reservations).
 */
export async function releaseExpiredReservations(filter: Filter = {}) {
  const expired = await prisma.reservation.findMany({
    where: {
      status: "PENDING",
      expiresAt: { lt: new Date() },
      ...(filter.productId ? { productId: filter.productId } : {}),
      ...(filter.warehouseId ? { warehouseId: filter.warehouseId } : {}),
    },
  });

  if (expired.length === 0) return;

  await prisma.$transaction(async (tx) => {
    for (const r of expired) {
      await tx.$executeRaw`
        UPDATE "Stock"
        SET reserved = GREATEST(0, reserved - ${r.quantity})
        WHERE "productId"   = ${r.productId}
          AND "warehouseId" = ${r.warehouseId}
      `;
    }
    await tx.reservation.updateMany({
      where: { id: { in: expired.map((r) => r.id) } },
      data: { status: "RELEASED" },
    });
  });
}
