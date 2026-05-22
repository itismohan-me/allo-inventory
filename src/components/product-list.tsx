"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

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

export function ProductList() {
  const router = useRouter();
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [reserving, setReserving] = useState<string | null>(null); // "productId:warehouseId"
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
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
        {[1, 2, 3].map((i) => (
          <div key={i} className="h-64 rounded-lg bg-gray-200 animate-pulse" />
        ))}
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {error && (
        <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
        </div>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
        {products.map((product) => (
          <Card key={product.id} className="flex flex-col">
            <CardHeader>
              <div className="flex items-start justify-between gap-2">
                <CardTitle className="text-base leading-snug">
                  {product.name}
                </CardTitle>
                <Badge variant="outline" className="shrink-0 text-xs font-mono">
                  {product.sku}
                </Badge>
              </div>
              {product.description && (
                <CardDescription className="text-xs mt-1">
                  {product.description}
                </CardDescription>
              )}
            </CardHeader>

            <CardContent className="flex-1 space-y-2">
              <p className="text-xl font-bold">₹{product.price.toLocaleString("en-IN")}</p>
              <div className="space-y-1">
                {product.stocks.map((s) => (
                  <div
                    key={s.warehouseId}
                    className="flex items-center justify-between text-xs text-gray-600"
                  >
                    <span>
                      {s.warehouseName}
                      <span className="text-gray-400 ml-1">
                        ({s.warehouseLocation})
                      </span>
                    </span>
                    <span
                      className={
                        s.available === 0
                          ? "text-red-500 font-medium"
                          : s.available <= 5
                          ? "text-amber-600 font-medium"
                          : "text-green-600 font-medium"
                      }
                    >
                      {s.available === 0 ? "Out of stock" : `${s.available} left`}
                    </span>
                  </div>
                ))}
              </div>
            </CardContent>

            <CardFooter className="flex flex-col gap-2">
              {product.stocks.map((s) => (
                <Button
                  key={s.warehouseId}
                  className="w-full"
                  disabled={
                    s.available === 0 ||
                    reserving === `${product.id}:${s.warehouseId}`
                  }
                  onClick={() => reserve(product, s)}
                >
                  {reserving === `${product.id}:${s.warehouseId}`
                    ? "Reserving…"
                    : s.available === 0
                    ? "Out of stock"
                    : `Reserve from ${s.warehouseName}`}
                </Button>
              ))}
            </CardFooter>
          </Card>
        ))}
      </div>
    </div>
  );
}
