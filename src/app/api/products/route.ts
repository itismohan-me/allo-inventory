import { prisma } from "@/lib/prisma";
import { releaseExpiredReservations } from "@/lib/expiry";

export async function GET() {
  await releaseExpiredReservations();

  const products = await prisma.product.findMany({
    include: {
      stocks: {
        include: { warehouse: true },
      },
    },
    orderBy: { name: "asc" },
  });

  const result = products.map((p) => ({
    id: p.id,
    name: p.name,
    sku: p.sku,
    description: p.description,
    price: p.price,
    imageUrl: p.imageUrl,
    stocks: p.stocks.map((s) => ({
      warehouseId: s.warehouseId,
      warehouseName: s.warehouse.name,
      warehouseLocation: s.warehouse.location,
      total: s.total,
      reserved: s.reserved,
      available: s.total - s.reserved,
    })),
  }));

  return Response.json(result);
}
