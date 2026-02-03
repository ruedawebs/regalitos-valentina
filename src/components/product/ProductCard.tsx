"use client";

import { Product } from "@/hooks/useCatalog";
import { motion } from "framer-motion";
import { ShoppingBag, Plus } from "lucide-react";
import { useCart } from "@/context/CartContext";

interface ProductCardProps {
  product: Product;
}

export default function ProductCard({ product }: ProductCardProps) {
  const { addToCart } = useCart();

  return (
    <motion.div
      whileHover={{ y: -5 }}
      className="group relative bg-white rounded-2xl shadow-sm hover:shadow-xl transition-all duration-300 overflow-hidden flex flex-col h-full border border-gray-100"
    >
      {/* Image Container - Aspect Ratio 4:5 */}
      <div className="relative aspect-[4/5] w-full overflow-hidden bg-[hsl(var(--secondary))]">
        <img
          src={product.image_url || "/placeholder.png"}
          alt={product.name}
          className="h-full w-full object-cover transition-transform duration-700 group-hover:scale-110"
        />

        {/* Floating Category Badge (Simulated) */}
        <div className="absolute top-3 left-3 bg-white/90 backdrop-blur-md text-[hsl(var(--foreground))] px-3 py-1 rounded-full text-xs font-bold shadow-sm border border-white/50 z-10">
          Regalo Perfecto 🎁
        </div>
      </div>

      {/* Content */}
      <div className="p-4 flex flex-col flex-grow relative">
        <div className="flex-grow">
          <h3 className="text-lg font-black text-[hsl(var(--foreground))] mb-1 line-clamp-2 tracking-tight font-[family-name:var(--font-main)]">
            {product.name}
          </h3>
          <p className="text-xs text-gray-400 font-medium tracking-wide uppercase mb-2">
            Collection 2026
          </p>
        </div>

        <div className="mt-4 flex items-end justify-between">
          <div className="flex flex-col">
            <span className="text-xs text-gray-400 font-medium line-through decoration-red-400">
              ${(product.price * 1.2).toFixed(2)}
            </span>
            <span className="text-xl font-black text-[hsl(var(--primary))]">
              ${product.price.toFixed(2)}
            </span>
          </div>

          {/* Action Button */}
          <motion.button
            whileTap={{ scale: 0.9 }}
            onClick={(e) => {
              e.preventDefault();
              addToCart(product);
            }}
            className="bg-[hsl(var(--accent))] hover:bg-[hsl(var(--accent))/0.9] text-white p-3 rounded-xl shadow-lg shadow-[hsl(var(--accent))/0.3] transition-colors flex items-center justify-center group/btn"
          >
            <ShoppingBag className="w-5 h-5 group-hover/btn:hidden" />
            <Plus className="w-5 h-5 hidden group-hover/btn:block" />
          </motion.button>
        </div>
      </div>
    </motion.div>
  );
}
