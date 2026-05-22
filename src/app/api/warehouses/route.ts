import { prisma } from "@/lib/prisma";

export async function GET() {
  const warehouses = await prisma.warehouse.findMany({
    orderBy: { name: "asc" },
  });
  return Response.json(warehouses);
}
