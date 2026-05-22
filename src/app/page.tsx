import { ProductList } from "@/components/product-list";

export const dynamic = "force-dynamic";

export default function Home() {
  return (
    <div className="min-h-screen bg-slate-50">
      {/* Nav */}
      <nav className="bg-white border-b border-slate-200 sticky top-0 z-10">
        <div className="max-w-6xl mx-auto px-6 h-14 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-lg bg-emerald-500 flex items-center justify-center">
              <span className="text-white font-bold text-sm">A</span>
            </div>
            <span className="font-semibold text-slate-800 text-sm tracking-tight">
              Allo Health
            </span>
          </div>
          <span className="text-xs text-slate-400 hidden sm:block">
            Inventory · Reservation Demo
          </span>
        </div>
      </nav>

      {/* Hero */}
      <div className="bg-gradient-to-br from-emerald-600 to-teal-700 text-white">
        <div className="max-w-6xl mx-auto px-6 py-12">
          <p className="text-emerald-200 text-xs font-medium uppercase tracking-widest mb-2">
            Multi-warehouse store
          </p>
          <h1 className="text-3xl font-bold mb-2">Health Supplements</h1>
          <p className="text-emerald-100 text-sm max-w-md">
            Reserve your order in seconds. Units are held for 10 minutes while you complete checkout.
          </p>
        </div>
      </div>

      {/* Products */}
      <div className="max-w-6xl mx-auto px-6 py-10">
        <ProductList />
      </div>
    </div>
  );
}
