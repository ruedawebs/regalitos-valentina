import { CartItem } from "@/context/CartContext";

export const generateWhatsAppUrl = (
  cart: CartItem[],
  phoneNumber: string = "",
  total: number,
): string => {
  if (!phoneNumber) return "#";

  // Clean phone number (remove non-digits)
  const cleanPhone = phoneNumber.replace(/\D/g, "");

  let message = "¡Hola! 👋 Me interesan estos regalitos de Valentina:\n\n";

  cart.forEach((item) => {
    message += `🎁 *${item.name}*\n`;
    message += `   Qty: ${item.quantity} x $${item.price.toFixed(2)}\n`;
  });

  message += `\n💰 *Total: $${total.toFixed(2)}*`;
  message += `\n\n¿Me pueden confirmar disponibilidad? Gracias! ✨`;

  return `https://wa.me/${cleanPhone}?text=${encodeURIComponent(message)}`;
};
