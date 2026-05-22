"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

type StockEntry = {
  warehouseId: string;
  warehouseName: string;
  warehouseLocation: string;
  total: number;
  reserved: number;
  available: number;
};

type Product = {
  id: string;
  name: string;
  sku: string;
  description: string | null;
  price: number;
  stocks: StockEntry[];
};

const PRODUCT_ICONS: Record<string, string> = {
  "TESTO-60": "💪",
  "OMEGA3-90": "🐟",
  "VITD3K2-120": "☀️",
};

function StockPill({ available }: { available: number }) {
  if (available === 0)
    return (
      <span className="inline-flex items-center gap-1 text-xs font-medium text-red-600 bg-red-50 border border-red-100 rounded-full px-2 py-0.5">
        <span className="w-1.5 h-1.5 rounded-full bg-red-400 inline-block" />
        Out of stock
      </span>
    );
  if (available <= 5)
    return (
      <span className="inline-flex items-center gap-1 text-xs font-medium text-amber-700 bg-amber-50 border border-amber-100 rounded-full px-2 py-0.5">
        <span className="w-1.5 h-1.5 rounded-full bg-amber-400 inline-block" />
        {available} left
      </span>
    );
  return (
    <span className="inline-flex items-center gap-1 text-xs font-medium text-emerald-700 bg-emerald-50 border border-emerald-100 rounded-full px-2 py-0.5">
      <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 inline-block" />
      {available} in stock
    </span>
  );
}

export function ProductList() {
  const router = useRouter();
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [reserving, setReserving] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/products")
      .then((r) => r.json())
      .then(setProducts)
      .catch(() => setError("Failed to load products"))
      .finally(() => setLoading(false));
  }, []);

  async function reserve(product: Product, stock: StockEntry) {
    const key = `${product.id}:${stock.warehouseId}`;
    setReserving(key);
    setError(null);

    try {
      const res = await fetch("/api/reservations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          productId: product.id,
          warehouseId: stock.warehouseId,
          quantity: 1,
        }),
      });

      const data = await res.json();

      if (res.status === 409) {
        setError(
          `Not enough stock available (${data.available ?? 0} left). Someone else may have just reserved the last unit.`
        );
        return;
      }

      if (!res.ok) {
        setError(data.error ?? "Reservation failed");
        return;
      }

      router.push(`/reservations/${data.id}`);
    } catch {
      setError("Network error — please try again");
    } finally {
      setReserving(null);
    }
  }

  if (loading) {
    return (
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
        {[1, 2, 3].map((i) => (
          <div key={i} className="h-72 rounded-2xl bg-slate-200 animate-pulse" />
        ))}
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {error && (
        <div className="flex items-start gap-3 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          <span className="mt-0.5 shrink-0">⚠️</span>
          <span>{error}</span>
        </div>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
        {products.map((product) => {
          const icon = PRODUCT_ICONS[product.sku] ?? "💊";
          const anyAvailable = product.stocks.some((s) => s.available > 0);

          return (
            <div
              key={product.id}
              className="bg-white rounded-2xl border border-slate-200 shadow-sm hover:shadow-md transition-shadow flex flex-col overflow-hidden"
            >
              {/* Product image area */}
              <div className="bg-gradient-to-br from-slate-50 to-emerald-50 px-6 pt-6 pb-4 flex items-center gap-4">
                <div className="w-14 h-14 rounded-xl bg-white shadow-sm border border-slate-100 flex items-center justify-center text-3xl">
                  {icon}
                </div>
                <div className="flex-1 min-w-0">
                  <span className="text-[10px] font-mono text-slate-400 uppercase tracking-wider">
                    {product.sku}
                  </span>
                  <h3 className="text-sm font-semibold text-slate-800 leading-snug mt-0.5">
                    {product.name}
                  </h3>
                </div>
              </div>

              {/* Body */}
              <div className="px-6 pb-5 flex flex-col flex-1 gap-4">
                {product.description && (
                  <p className="text-xs text-slate-500 leading-relaxed">
                    {product.description}
                  </p>
                )}

                <div className="flex items-baseline gap-1">
                  <span className="text-2xl font-bold text-slate-900">
                    ₹{product.price.toLocaleString("en-IN")}
                  </span>
                  <span className="text-xs text-slate-400">/ unit</span>
                </div>

                {/* Stock per warehouse */}
                <div className="space-y-2 border-t border-slate-100 pt-3">
                  {product.stocks.map((s) => (
                    <div key={s.warehouseId} className="flex items-center justify-between gap-2">
                      <div className="min-w-0">
                        <p className="text-xs font-medium text-slate-700 truncate">
                          {s.warehouseName}
                        </p>
                        <p className="text-[10px] text-slate-400">{s.warehouseLocation}</p>
                      </div>
                      <StockPill available={s.available} />
                    </div>
                  ))}
                </div>

                {/* Reserve buttons */}
                <div className="flex flex-col gap-2 mt-auto pt-1">
                  {product.stocks.map((s) => {
                    const key = `${product.id}:${s.warehouseId}`;
                    const isReserving = reserving === key;
                    const disabled = s.available === 0 || !!reserving;

                    return (
                      <button
                        key={s.warehouseId}
                        disabled={disabled}
                        onClick={() => reserve(product, s)}
                        className={`w-full rounded-xl py-2.5 text-sm font-medium transition-all ${
                          s.available === 0
                            ? "bg-slate-100 text-slate-400 cursor-not-allowed"
                            : isReserving
                            ? "bg-emerald-400 text-white cursor-wait"
                            : disabled
                            ? "bg-emerald-100 text-emerald-400 cursor-not-allowed"
                            : "bg-emerald-500 hover:bg-emerald-600 active:scale-95 text-white shadow-sm"
                        }`}
                      >
                        {isReserving
                          ? "Reserving…"
                          : s.available === 0
                          ? `Unavailable · ${s.warehouseName}`
                          : `Reserve · ${s.warehouseName}`}
                      </button>
                    );
                  })}
                </div>

                {!anyAvailable && (
                  <p className="text-center text-xs text-slate-400 -mt-1">
                    Notify me when back in stock
                  </p>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
