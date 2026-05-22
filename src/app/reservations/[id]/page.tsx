import { ReservationDetail } from "@/components/reservation-detail";

export const dynamic = "force-dynamic";

export default async function ReservationPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  return <ReservationDetail id={id} />;
}
