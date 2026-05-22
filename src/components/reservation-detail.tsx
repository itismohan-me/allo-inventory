"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";

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
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <div className="h-80 w-full max-w-md rounded-2xl bg-slate-200 animate-pulse mx-6" />
      </div>
    );
  }

  if (!reservation) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <p className="text-slate-400 text-sm">Reservation not found.</p>
      </div>
    );
  }

  const isPending = reservation.status === "PENDING";
  const isUrgent = secondsLeft <= 60;

  return (
    <div className="min-h-screen bg-slate-50">
      {/* Nav */}
      <nav className="bg-white border-b border-slate-200 sticky top-0 z-10">
        <div className="max-w-6xl mx-auto px-6 h-14 flex items-center gap-4">
          <button
            onClick={() => router.push("/")}
            className="flex items-center gap-1.5 text-sm text-slate-500 hover:text-slate-800 transition-colors"
          >
            <span>←</span>
            <span>Products</span>
          </button>
          <span className="text-slate-300">/</span>
          <span className="text-sm font-medium text-slate-700">Checkout</span>
        </div>
      </nav>

      <div className="max-w-lg mx-auto px-6 py-10 space-y-4">

        {error && (
          <div className="flex items-start gap-3 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
            <span className="shrink-0 mt-0.5">⚠️</span>
            <span>{error}</span>
          </div>
        )}

        {/* Status banner */}
        {reservation.status === "CONFIRMED" && (
          <div className="rounded-2xl bg-emerald-500 text-white px-6 py-5 text-center shadow-sm">
            <div className="text-3xl mb-1">✓</div>
            <p className="font-semibold text-lg">Order Confirmed!</p>
            <p className="text-emerald-100 text-sm mt-0.5">
              Your purchase has been placed successfully.
            </p>
          </div>
        )}

        {reservation.status === "RELEASED" && !error && (
          <div className="rounded-2xl bg-slate-200 text-slate-600 px-6 py-5 text-center">
            <div className="text-3xl mb-1">↩</div>
            <p className="font-semibold">Reservation Released</p>
            <p className="text-slate-500 text-sm mt-0.5">
              Units have been returned to available stock.
            </p>
          </div>
        )}

        {/* Timer */}
        {isPending && (
          <div
            className={`rounded-2xl px-6 py-5 text-center border ${
              isUrgent
                ? "bg-red-50 border-red-200"
                : "bg-amber-50 border-amber-200"
            }`}
          >
            <p className={`text-xs font-medium uppercase tracking-widest mb-2 ${isUrgent ? "text-red-400" : "text-amber-500"}`}>
              Reservation expires in
            </p>
            <p
              className={`text-5xl font-mono font-bold tabular-nums tracking-tight ${
                isUrgent ? "text-red-600" : "text-amber-700"
              }`}
            >
              {formatted}
            </p>
            <p className={`text-xs mt-2 ${isUrgent ? "text-red-400" : "text-amber-500"}`}>
              {isUrgent
                ? "Hurry — units will be released soon!"
                : "Complete your purchase before time runs out"}
            </p>
          </div>
        )}

        {/* Order summary card */}
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
          {/* Product header */}
          <div className="bg-gradient-to-br from-slate-50 to-emerald-50 px-6 py-5 flex items-center gap-4 border-b border-slate-100">
            <div className="w-12 h-12 rounded-xl bg-white shadow-sm border border-slate-100 flex items-center justify-center text-2xl shrink-0">
              💊
            </div>
            <div className="flex-1 min-w-0">
              <p className="font-semibold text-slate-800 leading-snug">
                {reservation.product.name}
              </p>
              <p className="text-[10px] font-mono text-slate-400 mt-0.5 uppercase tracking-wider">
                {reservation.product.sku}
              </p>
            </div>
            <StatusBadge status={reservation.status} />
          </div>

          {/* Details */}
          <div className="px-6 py-5 space-y-3 text-sm">
            <Row label="Warehouse">
              <span className="font-medium text-slate-800">{reservation.warehouse.name}</span>
              <span className="text-slate-400 text-xs ml-1">({reservation.warehouse.location})</span>
            </Row>
            <Row label="Quantity">
              <span className="font-medium text-slate-800">{reservation.quantity}</span>
            </Row>
            <div className="border-t border-slate-100 pt-3 mt-1">
              <Row label="Total">
                <span className="text-lg font-bold text-slate-900">
                  ₹{(reservation.product.price * reservation.quantity).toLocaleString("en-IN")}
                </span>
              </Row>
            </div>
            <Row label="Ref">
              <span className="font-mono text-xs text-slate-400">{reservation.id}</span>
            </Row>
          </div>

          {/* Actions */}
          {isPending && (
            <div className="px-6 pb-6 flex gap-3">
              <button
                onClick={confirm}
                disabled={actionLoading}
                className="flex-1 rounded-xl py-3 bg-emerald-500 hover:bg-emerald-600 active:scale-95 text-white text-sm font-semibold transition-all shadow-sm disabled:opacity-60 disabled:cursor-wait"
              >
                {actionLoading ? "Processing…" : "Confirm purchase"}
              </button>
              <button
                onClick={cancel}
                disabled={actionLoading}
                className="flex-1 rounded-xl py-3 border border-slate-200 hover:bg-slate-50 text-slate-600 text-sm font-medium transition-all disabled:opacity-60 disabled:cursor-wait"
              >
                Cancel
              </button>
            </div>
          )}

          {reservation.status !== "PENDING" && (
            <div className="px-6 pb-6">
              <button
                onClick={() => router.push("/")}
                className="w-full rounded-xl py-3 border border-slate-200 hover:bg-slate-50 text-slate-600 text-sm font-medium transition-all"
              >
                ← Back to products
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function StatusBadge({ status }: { status: ReservationStatus }) {
  const styles: Record<ReservationStatus, string> = {
    PENDING: "bg-amber-100 text-amber-700 border-amber-200",
    CONFIRMED: "bg-emerald-100 text-emerald-700 border-emerald-200",
    RELEASED: "bg-slate-100 text-slate-500 border-slate-200",
  };
  return (
    <span className={`text-xs font-medium border rounded-full px-2.5 py-1 shrink-0 ${styles[status]}`}>
      {STATUS_LABELS[status]}
    </span>
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
    <div className="flex items-center justify-between gap-4">
      <span className="text-slate-500 shrink-0">{label}</span>
      <span className="text-right">{children}</span>
    </div>
  );
}
