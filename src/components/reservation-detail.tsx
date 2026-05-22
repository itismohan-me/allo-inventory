"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

type ReservationStatus = "PENDING" | "CONFIRMED" | "RELEASED";

type Reservation = {
  id: string;
  status: ReservationStatus;
  quantity: number;
  expiresAt: string;
  createdAt: string;
  product: {
    name: string;
    sku: string;
    price: number;
    imageUrl: string | null;
  };
  warehouse: {
    name: string;
    location: string;
  };
};

const STATUS_LABELS: Record<ReservationStatus, string> = {
  PENDING: "Reserved",
  CONFIRMED: "Confirmed",
  RELEASED: "Released",
};

const STATUS_COLORS: Record<
  ReservationStatus,
  "default" | "secondary" | "destructive" | "outline"
> = {
  PENDING: "default",
  CONFIRMED: "secondary",
  RELEASED: "outline",
};

function useCountdown(expiresAt: string, status: ReservationStatus) {
  const [secondsLeft, setSecondsLeft] = useState(0);

  useEffect(() => {
    if (status !== "PENDING") return;

    function tick() {
      const diff = Math.max(
        0,
        Math.floor((new Date(expiresAt).getTime() - Date.now()) / 1000)
      );
      setSecondsLeft(diff);
    }

    tick();
    const interval = setInterval(tick, 1000);
    return () => clearInterval(interval);
  }, [expiresAt, status]);

  const mins = Math.floor(secondsLeft / 60);
  const secs = secondsLeft % 60;
  return { secondsLeft, formatted: `${mins}:${secs.toString().padStart(2, "0")}` };
}

export function ReservationDetail({ id }: { id: string }) {
  const router = useRouter();
  const [reservation, setReservation] = useState<Reservation | null>(null);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const expiredNotified = useRef(false);

  const { secondsLeft, formatted } = useCountdown(
    reservation?.expiresAt ?? new Date().toISOString(),
    reservation?.status ?? "RELEASED"
  );

  useEffect(() => {
    fetch(`/api/reservations/${id}`)
      .then((r) => r.json())
      .then(setReservation)
      .catch(() => setError("Failed to load reservation"))
      .finally(() => setLoading(false));
  }, [id]);

  // Auto-mark expired in UI when countdown hits 0
  useEffect(() => {
    if (
      reservation?.status === "PENDING" &&
      secondsLeft === 0 &&
      !expiredNotified.current
    ) {
      expiredNotified.current = true;
      setReservation((prev) =>
        prev ? { ...prev, status: "RELEASED" } : prev
      );
      setError("Your reservation has expired. The units have been released.");
    }
  }, [secondsLeft, reservation?.status]);

  async function confirm() {
    setActionLoading(true);
    setError(null);
    const res = await fetch(`/api/reservations/${id}/confirm`, {
      method: "POST",
    });
    const data = await res.json();

    if (res.status === 410) {
      setError("Reservation expired — units have been released.");
      setReservation((prev) =>
        prev ? { ...prev, status: "RELEASED" } : prev
      );
    } else if (!res.ok) {
      setError(data.error ?? "Something went wrong");
    } else {
      setReservation(data);
    }
    setActionLoading(false);
  }

  async function cancel() {
    setActionLoading(true);
    setError(null);
    const res = await fetch(`/api/reservations/${id}/release`, {
      method: "POST",
    });
    const data = await res.json();

    if (!res.ok) {
      setError(data.error ?? "Something went wrong");
    } else {
      setReservation(data);
    }
    setActionLoading(false);
  }

  if (loading) {
    return (
      <main className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="h-64 w-full max-w-md rounded-lg bg-gray-200 animate-pulse" />
      </main>
    );
  }

  if (!reservation) {
    return (
      <main className="min-h-screen bg-gray-50 flex items-center justify-center">
        <p className="text-gray-500">Reservation not found.</p>
      </main>
    );
  }

  const isPending = reservation.status === "PENDING";

  return (
    <main className="min-h-screen bg-gray-50">
      <header className="bg-white border-b px-6 py-4 mb-8">
        <button
          onClick={() => router.push("/")}
          className="text-sm text-gray-500 hover:text-gray-800 transition-colors"
        >
          ← Back to products
        </button>
        <h1 className="text-2xl font-bold text-gray-900 mt-1">
          Checkout
        </h1>
      </header>

      <div className="max-w-md mx-auto px-6">
        {error && (
          <div className="mb-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
            {error}
          </div>
        )}

        <Card>
          <CardHeader>
            <div className="flex items-start justify-between gap-2">
              <CardTitle className="text-base leading-snug">
                {reservation.product.name}
              </CardTitle>
              <Badge variant={STATUS_COLORS[reservation.status]}>
                {STATUS_LABELS[reservation.status]}
              </Badge>
            </div>
            <p className="text-xs text-gray-400 font-mono mt-1">
              {reservation.product.sku}
            </p>
          </CardHeader>

          <CardContent className="space-y-4">
            <div className="rounded-lg bg-gray-50 px-4 py-3 space-y-2 text-sm">
              <Row label="Warehouse">
                {reservation.warehouse.name}
                <span className="text-gray-400 ml-1">
                  ({reservation.warehouse.location})
                </span>
              </Row>
              <Row label="Quantity">{reservation.quantity}</Row>
              <Row label="Price">
                ₹{(reservation.product.price * reservation.quantity).toLocaleString("en-IN")}
              </Row>
              <Row label="Reservation ID">
                <span className="font-mono text-xs">{reservation.id}</span>
              </Row>
            </div>

            {isPending && (
              <div
                className={`rounded-lg px-4 py-3 text-center ${
                  secondsLeft <= 60
                    ? "bg-red-50 border border-red-200"
                    : "bg-amber-50 border border-amber-200"
                }`}
              >
                <p className="text-xs text-gray-500 mb-1">
                  Reserved units expire in
                </p>
                <p
                  className={`text-3xl font-mono font-bold tabular-nums ${
                    secondsLeft <= 60 ? "text-red-600" : "text-amber-700"
                  }`}
                >
                  {formatted}
                </p>
                <p className="text-xs text-gray-400 mt-1">
                  Complete your purchase before time runs out
                </p>
              </div>
            )}

            {reservation.status === "CONFIRMED" && (
              <div className="rounded-lg bg-green-50 border border-green-200 px-4 py-3 text-center">
                <p className="text-green-700 font-semibold text-sm">
                  Purchase confirmed!
                </p>
                <p className="text-green-600 text-xs mt-0.5">
                  Your order has been placed successfully.
                </p>
              </div>
            )}

            {reservation.status === "RELEASED" && (
              <div className="rounded-lg bg-gray-100 border px-4 py-3 text-center">
                <p className="text-gray-600 text-sm font-medium">
                  Reservation released
                </p>
                <p className="text-gray-400 text-xs mt-0.5">
                  Units have been returned to stock.
                </p>
              </div>
            )}
          </CardContent>

          {isPending && (
            <CardFooter className="flex gap-3">
              <Button
                className="flex-1"
                onClick={confirm}
                disabled={actionLoading}
              >
                {actionLoading ? "Processing…" : "Confirm purchase"}
              </Button>
              <Button
                variant="outline"
                className="flex-1"
                onClick={cancel}
                disabled={actionLoading}
              >
                Cancel
              </Button>
            </CardFooter>
          )}

          {reservation.status !== "PENDING" && (
            <CardFooter>
              <Button
                variant="outline"
                className="w-full"
                onClick={() => router.push("/")}
              >
                Back to products
              </Button>
            </CardFooter>
          )}
        </Card>
      </div>
    </main>
  );
}

function Row({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex items-start justify-between gap-4">
      <span className="text-gray-500 shrink-0">{label}</span>
      <span className="text-gray-900 text-right">{children}</span>
    </div>
  );
}
