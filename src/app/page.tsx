import { ProductList } from "@/components/product-list";

export const dynamic = "force-dynamic";

export default function Home() {
  return (
    <main className="min-h-screen bg-gray-50">
      <header className="bg-white border-b px-6 py-4 mb-8">
        <h1 className="text-2xl font-bold text-gray-900">Allo Health Store</h1>
        <p className="text-sm text-gray-500 mt-0.5">
          Browse products and reserve your order
        </p>
      </header>
      <div className="max-w-5xl mx-auto px-6">
        <ProductList />
      </div>
    </main>
  );
}
