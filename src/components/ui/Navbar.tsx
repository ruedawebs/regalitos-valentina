"use client";

import { useCatalog } from "@/hooks/useCatalog";
import Link from "next/link";

export default function Navbar() {
  const { config, loading } = useCatalog();

  return (
    <nav className="w-full bg-[hsl(var(--secondary))] border-b border-[hsl(var(--primary)/0.2)]">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between h-16 items-center">
          <div className="flex-shrink-0 flex items-center">
            <Link
              href="/"
              className="font-bold text-2xl text-[hsl(var(--primary))] tracking-wide"
            >
              {loading ? (
                <span className="animate-pulse bg-gray-200 h-8 w-32 block rounded"></span>
              ) : (
                config?.store_name || "Regalitos Valentina"
              )}
            </Link>
          </div>
          <div className="hidden sm:ml-6 sm:flex sm:space-x-8">
            {/* Navigation Links Placeholder */}
            <Link
              href="/"
              className="border-transparent text-[hsl(var(--foreground))] hover:border-[hsl(var(--primary))] hover:text-[hsl(var(--primary))] inline-flex items-center px-1 pt-1 border-b-2 text-sm font-medium"
            >
              Inicio
            </Link>
            <Link
              href="/catalogo"
              className="border-transparent text-[hsl(var(--foreground))] hover:border-[hsl(var(--primary))] hover:text-[hsl(var(--primary))] inline-flex items-center px-1 pt-1 border-b-2 text-sm font-medium"
            >
              Catálogo
            </Link>
          </div>
        </div>
      </div>
    </nav>
  );
}
