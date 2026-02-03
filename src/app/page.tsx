"use client";

import { useState, useMemo } from "react";
import { useCatalog } from "@/hooks/useCatalog";
import Navbar from "@/components/ui/Navbar";
import ProductGrid from "@/components/product/ProductGrid";
import { motion, AnimatePresence } from "framer-motion";

export default function Home() {
  const { config, categories, products, loading } = useCatalog();
  const [selectedCategory, setSelectedCategory] = useState<number | "all">(
    "all",
  );

  const filteredProducts = useMemo(() => {
    if (selectedCategory === "all") return products;
    return products.filter((p) => p.category_id === selectedCategory);
  }, [selectedCategory, products]);

  return (
    <div className="min-h-screen bg-[hsl(var(--background))]">
      <Navbar />

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Hero Section - Gradient & Premium Look */}
        <section className="relative mb-16 overflow-hidden rounded-3xl bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 text-white shadow-2xl">
          {/* Background Decoration */}
          <div className="absolute top-0 right-0 -mt-20 -mr-20 w-80 h-80 bg-[hsl(var(--primary))] rounded-full blur-[100px] opacity-20"></div>
          <div className="absolute bottom-0 left-0 -mb-20 -ml-20 w-80 h-80 bg-[hsl(var(--accent))] rounded-full blur-[100px] opacity-20"></div>

          <motion.div
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.7 }}
            className="relative z-10 py-16 px-6 sm:py-24 sm:px-12 text-center"
          >
            <span className="inline-block py-1 px-3 rounded-full bg-white/10 backdrop-blur-md border border-white/20 text-xs font-bold tracking-widest uppercase mb-6 text-blue-200">
              San Valentín 2026
            </span>
            <h1 className="text-5xl sm:text-7xl font-black mb-6 tracking-tight leading-none font-[family-name:var(--font-main)]">
              {config?.store_name || "Regalitos Valentina"}
            </h1>
            <p className="text-xl sm:text-2xl font-light text-slate-300 max-w-2xl mx-auto mb-10 leading-relaxed">
              Descubre detalles únicos que crean momentos inolvidables.{" "}
              <br className="hidden sm:block" />
              Regalos con alma y estilo.
            </p>

            <button className="bg-white text-slate-900 px-8 py-4 rounded-full font-bold hover:bg-gray-100 transition-colors shadow-lg hover:shadow-white/25 transform hover:-translate-y-1">
              Explorar Colección
            </button>
          </motion.div>
        </section>

        {/* Category Filters */}
        <section className="mb-12 overflow-x-auto pb-6 scrollbar-hide">
          <div className="flex justify-center flex-wrap gap-3 px-2">
            <FilterButton
              label="✨ Todos"
              isActive={selectedCategory === "all"}
              onClick={() => setSelectedCategory("all")}
            />
            {categories.map((category) => (
              <FilterButton
                key={category.id}
                label={category.name}
                isActive={selectedCategory === category.id}
                onClick={() => setSelectedCategory(category.id)}
              />
            ))}
          </div>
        </section>

        {/* Product Grid / Loading State */}
        <AnimatePresence mode="wait">
          {loading ? (
            <motion.div
              key="loader"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="grid grid-cols-2 lg:grid-cols-4 gap-6 lg:gap-10"
            >
              {Array.from({ length: 8 }).map((_, i) => (
                <div
                  key={i}
                  className="bg-white p-0 rounded-2xl border border-gray-100 flex flex-col h-[400px] overflow-hidden"
                >
                  <div className="bg-gray-200 w-full h-[70%] animate-pulse" />
                  <div className="p-4 space-y-3">
                    <div className="bg-gray-200 h-6 w-3/4 rounded animate-pulse" />
                    <div className="bg-gray-200 h-4 w-1/2 rounded animate-pulse" />
                  </div>
                </div>
              ))}
            </motion.div>
          ) : (
            <motion.div
              key="content"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="pb-24"
            >
              <ProductGrid products={filteredProducts} />
            </motion.div>
          )}
        </AnimatePresence>
      </main>
    </div>
  );
}

// Sub-component for Filter Buttons
function FilterButton({
  label,
  isActive,
  onClick,
}: {
  label: string;
  isActive: boolean;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className={`
        px-6 py-2.5 rounded-full text-sm font-bold transition-all duration-300 transform
        ${
          isActive
            ? "bg-[hsl(var(--primary))] text-white shadow-xl shadow-[hsl(var(--primary))/0.3] scale-105"
            : "bg-white text-gray-500 hover:bg-gray-50 hover:text-gray-900 border border-gray-100"
        }
      `}
    >
      {label}
    </button>
  );
}
