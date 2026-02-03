"use client";

import { useCart } from "@/context/CartContext";
import { useCatalog } from "@/hooks/useCatalog";
import { generateWhatsAppUrl } from "@/lib/whatsapp";
import { motion, AnimatePresence } from "framer-motion";
import { ShoppingBag, X, MessageCircle, Trash2 } from "lucide-react";

export default function CartDrawer() {
  const { cart, removeFromCart, getCartTotal, isDrawerOpen, toggleDrawer } =
    useCart();
  const { config } = useCatalog();

  const total = getCartTotal();
  const waLink = generateWhatsAppUrl(cart, config?.whatsapp_number, total);

  return (
    <>
      {/* Floating Button */}
      <motion.button
        initial={{ scale: 0 }}
        animate={{ scale: 1 }}
        className="fixed bottom-6 right-6 z-40 bg-[hsl(var(--primary))] text-white p-4 rounded-full shadow-2xl hover:scale-110 transition-transform"
        onClick={toggleDrawer}
      >
        <ShoppingBag className="w-6 h-6" />
        {cart.length > 0 && (
          <span className="absolute -top-1 -right-1 bg-[hsl(var(--accent))] text-white text-xs font-bold w-6 h-6 flex items-center justify-center rounded-full border-2 border-white">
            {cart.reduce((acc, item) => acc + item.quantity, 0)}
          </span>
        )}
      </motion.button>

      {/* Drawer Overlay */}
      <AnimatePresence>
        {isDrawerOpen && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={toggleDrawer}
              className="fixed inset-0 z-50 bg-black/20 backdrop-blur-sm"
            />
            {/* Drawer Content */}
            <motion.div
              initial={{ x: "100%" }}
              animate={{ x: 0 }}
              exit={{ x: "100%" }}
              transition={{ type: "spring", damping: 25, stiffness: 200 }}
              className="fixed top-0 right-0 z-50 h-full w-full max-w-md bg-white shadow-2xl flex flex-col"
            >
              {/* Header */}
              <div className="p-4 border-b flex justify-between items-center bg-[hsl(var(--secondary))]">
                <h2 className="text-xl font-bold text-[hsl(var(--foreground))] font-[family-name:var(--font-main)]">
                  Tu Carrito 🛍️
                </h2>
                <button
                  onClick={toggleDrawer}
                  className="p-2 hover:bg-black/5 rounded-full transition-colors"
                >
                  <X className="w-6 h-6 text-gray-500" />
                </button>
              </div>

              {/* Items List */}
              <div className="flex-1 overflow-y-auto p-4 space-y-4">
                {cart.length === 0 ? (
                  <div className="h-full flex flex-col items-center justify-center text-gray-400 space-y-4">
                    <ShoppingBag className="w-16 h-16 opacity-20" />
                    <p>Tu carrito está vacío</p>
                    <button
                      onClick={toggleDrawer}
                      className="text-[hsl(var(--primary))] font-medium hover:underline"
                    >
                      Seguir comprando
                    </button>
                  </div>
                ) : (
                  cart.map((item) => (
                    <div
                      key={item.id}
                      className="flex gap-4 p-3 bg-gray-50 rounded-xl border border-gray-100"
                    >
                      <div className="w-20 h-20 bg-white rounded-lg overflow-hidden flex-shrink-0 border border-gray-200">
                        <img
                          src={item.image_url || "/placeholder.png"}
                          alt={item.name}
                          className="w-full h-full object-cover"
                        />
                      </div>
                      <div className="flex-1 flex flex-col justify-center">
                        <h3 className="font-bold text-gray-800 line-clamp-1">
                          {item.name}
                        </h3>
                        <p className="text-sm text-gray-500">
                          Qty: {item.quantity} x ${item.price.toFixed(2)}
                        </p>
                        <div className="flex justify-between items-center mt-2">
                          <span className="font-bold text-[hsl(var(--primary))]">
                            ${(item.price * item.quantity).toFixed(2)}
                          </span>
                          <button
                            onClick={() => removeFromCart(item.id)}
                            className="text-red-400 hover:text-red-600 p-1"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </div>
                    </div>
                  ))
                )}
              </div>

              {/* Footer Actions */}
              {cart.length > 0 && (
                <div className="p-6 border-t bg-gray-50 space-y-4">
                  <div className="flex justify-between items-center text-lg font-bold">
                    <span>Total:</span>
                    <span>${total.toFixed(2)}</span>
                  </div>

                  <a
                    href={waLink}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="w-full flex items-center justify-center gap-2 bg-green-600 hover:bg-green-700 text-white py-3.5 rounded-xl font-bold transition-all shadow-lg hover:shadow-green-600/30"
                  >
                    <MessageCircle className="w-5 h-5" />
                    Confirmar por WhatsApp
                  </a>
                </div>
              )}
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </>
  );
}
