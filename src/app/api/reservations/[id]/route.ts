import { prisma } from "@/lib/prisma";
import { NextRequest } from "next/server";

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  const reservation = await prisma.reservation.findUnique({
    where: { id },
    include: {
      product: { select: { name: true, sku: true, price: true, imageUrl: true } },
      warehouse: { select: { name: true, location: true } },
    },
  });

  if (!reservation) {
    return Response.json({ error: "Reservation not found" }, { status: 404 });
  }

  return Response.json(reservation);
}
