import { createClient } from "@supabase/supabase-js";
import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

// Environment variables
const TELEGRAM_BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;
const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

// Constants
const MSG_PREFIX = "[V1.5-CONTROL]";
const OWNER_ID_CHECK = "8343591065";

// Initialize Supabase Admin Client
const supabase = createClient(SUPABASE_URL!, SUPABASE_SERVICE_ROLE_KEY!, {
  auth: {
    persistSession: false,
    autoRefreshToken: false,
  },
});

// Types
type BotState =
  | "IDLE"
  | "AWAITING_NAME"
  | "AWAITING_PRICE"
  | "AWAITING_CATEGORY"
  | "SELECTING_PRODUCT_EDIT"
  | "SELECTING_PRODUCT_DISABLE"
  | "SELECTING_PRODUCT_DELETE";

interface TelegramUser {
  id: number;
  is_bot: boolean;
  first_name: string;
}

interface TelegramChat {
  id: number;
  type: string;
}

interface TelegramMessage {
  message_id: number;
  from: TelegramUser;
  chat: TelegramChat;
  date: number;
  text?: string;
  photo?: {
    file_id: string;
    file_unique_id: string;
    width: number;
    height: number;
    file_size: number;
  }[];
}

interface TelegramCallbackQuery {
  id: string;
  from: TelegramUser;
  message?: TelegramMessage;
  data: string;
}

interface TelegramUpdate {
  update_id: number;
  message?: TelegramMessage;
  callback_query?: TelegramCallbackQuery;
}

// Helpers
async function sendMessage(chatId: number, text: string, reply_markup?: any) {
  if (!TELEGRAM_BOT_TOKEN) return;
  const fullText = `${MSG_PREFIX} ${text}`;

  await fetch(`https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ chat_id: chatId, text: fullText, reply_markup }),
  });
}

async function answerCallbackQuery(callbackQueryId: string, text?: string) {
  if (!TELEGRAM_BOT_TOKEN) return;
  await fetch(
    `https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/answerCallbackQuery`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ callback_query_id: callbackQueryId, text }),
    },
  );
}

async function getFileUrl(fileId: string): Promise<string | null> {
  if (!TELEGRAM_BOT_TOKEN) return null;
  const res = await fetch(
    `https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/getFile?file_id=${fileId}`,
  );
  const data = await res.json();
  if (!data.ok) return null;
  return `https://api.telegram.org/file/bot${TELEGRAM_BOT_TOKEN}/${data.result.file_path}`;
}

async function uploadImageToSupabase(
  fileUrl: string,
  fileName: string,
): Promise<string | null> {
  try {
    const res = await fetch(fileUrl);
    const blob = await res.blob();
    const arrayBuffer = await blob.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    const { data, error } = await supabase.storage
      .from("catalog-images")
      .upload(fileName, buffer, {
        contentType: "image/jpeg",
        upsert: true,
      });

    if (error) {
      console.error("Supabase upload error:", error);
      return null;
    }

    const { data: publicUrlData } = supabase.storage
      .from("catalog-images")
      .getPublicUrl(fileName);

    return publicUrlData.publicUrl;
  } catch (e) {
    console.error("Image upload failed:", e);
    return null;
  }
}

async function sendMainMenu(chatId: number) {
  const keyboard = {
    inline_keyboard: [
      [{ text: "➕ Crear Producto", callback_data: "cmd_create" }],
      [{ text: "📝 Editar Producto", callback_data: "cmd_edit" }],
      [{ text: "🚫 Desactivar", callback_data: "cmd_disable" }],
      [{ text: "🗑️ Eliminar", callback_data: "cmd_delete" }],
    ],
  };
  await sendMessage(
    chatId,
    "¡Hola Dueño! ¿Qué acción deseas realizar hoy?",
    keyboard,
  );
}

async function listProductsAsButtons(
  chatId: number,
  action: "edit" | "disable" | "delete",
) {
  try {
    await sendMessage(chatId, "Buscando productos en la base de datos...");

    const { data: products, error } = await supabase
      .from("products")
      .select("id, name")
      .order("id", { ascending: false })
      .limit(10);

    if (error) {
      console.error("DB Error listing products:", error);
      await sendMessage(
        chatId,
        `⚠️ [V1.5-ERROR] No puedo acceder a la tabla products. Verifica los logs. ${error.message}`,
      );
      return;
    }

    if (!products || products.length === 0) {
      await sendMessage(chatId, "No se encontraron productos.");
      return;
    }

    const keyboard = {
      inline_keyboard: products.map((p) => [
        { text: p.name, callback_data: `act_${action}_${p.id}` },
      ]),
    };

    const actionTextMap = {
      edit: "editar",
      disable: "desactivar",
      delete: "eliminar",
    };
    await sendMessage(
      chatId,
      `Selecciona el producto a ${actionTextMap[action]}:`,
      keyboard,
    );
  } catch (e: any) {
    console.error("Exception listing products:", e);
    await sendMessage(
      chatId,
      `⚠️ [V1.5-ERROR] Excepción listando productos: ${e.message}`,
    );
  }
}

// Main Webhook Handler
export async function POST(req: Request) {
  try {
    const update: TelegramUpdate = await req.json();
    // Debug Logging V1.5
    const fromId = update.message?.from.id || update.callback_query?.from.id;
    console.log("📥 [V1.5] Mensaje Recibido de ID: " + fromId);

    const message = update.message || update.callback_query?.message;
    const fromUser = update.message?.from || update.callback_query?.from;

    if (!message || !fromUser) {
      return NextResponse.json({ ok: true });
    }

    const chatId = message.chat.id;
    const userId = fromUser.id;

    // 1. Verify Owner (Double check: Env/DB and User Request)
    console.log("🔍 Consultando tg_owner_id en DB...");

    let config = null;
    try {
      const { data, error } = await supabase
        .from("config")
        .select("tg_owner_id, current_state, draft_product")
        .eq("id", 1)
        .single();

      if (error) {
        console.error("Config fetch error:", error);
        // Fallback response for 42703 or other DB errors
        await sendMessage(
          chatId,
          `⚠️ [V1.5-ERROR] No puedo acceder a la tabla config. Verifica los logs de Vercel. ${error.message}`,
        );
        return NextResponse.json({ ok: true });
      }
      config = data;
    } catch (e: any) {
      console.error("Config fetch exception:", e);
      await sendMessage(
        chatId,
        `⚠️ [V1.5-ERROR] Excepción crítica accediendo a DB. ${e.message}`,
      );
      return NextResponse.json({ ok: true });
    }

    if (!config) {
      // Should be caught above, but safety check
      return NextResponse.json({ ok: true });
    }

    const isDbOwner = String(config.tg_owner_id) === String(userId);
    const isHardcodedOwner = String(userId) === OWNER_ID_CHECK;

    if (!isDbOwner && !isHardcodedOwner) {
      console.warn("Unauthorized access attempt:", userId);
      await sendMessage(chatId, `⚠️ Acceso denegado. Tu ID es ${userId}.`);
      return NextResponse.json({ ok: true });
    }

    let currentState: BotState = (config.current_state as BotState) || "IDLE";
    let draft = config.draft_product || {};

    // --- HANDLE CALLBACK QUERIES ---
    if (update.callback_query) {
      const data = update.callback_query.data;
      await answerCallbackQuery(update.callback_query.id);

      if (data === "cmd_create") {
        await sendMessage(
          chatId,
          "Iniciando creación. 📸 Por favor, envía la foto del regalito.",
        );
        draft = {};
        currentState = "IDLE";
      } else if (data === "cmd_disable") {
        await listProductsAsButtons(chatId, "disable");
        currentState = "SELECTING_PRODUCT_DISABLE";
      } else if (data === "cmd_delete") {
        await listProductsAsButtons(chatId, "delete");
        currentState = "SELECTING_PRODUCT_DELETE";
      } else if (data === "cmd_edit") {
        await listProductsAsButtons(chatId, "edit");
        currentState = "SELECTING_PRODUCT_EDIT";
      } else if (data.startsWith("act_disable_")) {
        const productId = data.split("_")[2];
        const { data: prod } = await supabase
          .from("products")
          .select("name")
          .eq("id", productId)
          .single();
        await supabase
          .from("products")
          .update({ in_stock: false })
          .eq("id", productId);
        await sendMessage(
          chatId,
          `✅ Producto ${prod?.name || productId} desactivado.`,
        );
        currentState = "IDLE";
      } else if (data.startsWith("act_delete_")) {
        const productId = data.split("_")[2];
        const { data: prod } = await supabase
          .from("products")
          .select("name")
          .eq("id", productId)
          .single();
        await supabase.from("products").delete().eq("id", productId);
        await sendMessage(
          chatId,
          `🗑️ Producto ${prod?.name || productId} eliminado.`,
        );
        currentState = "IDLE";
      } else if (data.startsWith("act_edit_")) {
        await sendMessage(
          chatId,
          "🛠️ Función de edición específica en desarrollo.",
        );
        currentState = "IDLE";
      }

      await supabase
        .from("config")
        .update({ current_state: currentState, draft_product: draft })
        .eq("id", 1);
      return NextResponse.json({ ok: true });
    }

    // --- HANDLE TEXT COMMANDS ---
    if (update.message?.text === "/start") {
      try {
        await supabase
          .from("config")
          .update({ current_state: "IDLE", draft_product: {} })
          .eq("id", 1);
        await sendMainMenu(chatId);
      } catch (e: any) {
        await sendMessage(
          chatId,
          `⚠️ [V1.5-ERROR] Error al reiniciar estado. ${e.message}`,
        );
      }
      return NextResponse.json({ ok: true });
    }

    if (update.message?.text === "/status") {
      const { count, error: countError } = await supabase
        .from("products")
        .select("*", { count: "exact", head: true });
      const productCount = countError ? "Error" : count;
      await sendMessage(
        chatId,
        `✅ Estado Operativo. Productos: ${productCount}.`,
      );
      return NextResponse.json({ ok: true });
    }

    // --- FSM LOGIC ---
    if (!update.message) return NextResponse.json({ ok: true });

    switch (currentState) {
      case "IDLE":
        if (update.message.photo) {
          const photo = update.message.photo[update.message.photo.length - 1];
          const fileUrl = await getFileUrl(photo.file_id);
          if (fileUrl) {
            const fileName = `${Date.now()}.jpg`;
            const publicUrl = await uploadImageToSupabase(fileUrl, fileName);
            if (publicUrl) {
              draft = { ...draft, image_url: publicUrl };
              currentState = "AWAITING_NAME";
              await sendMessage(
                chatId,
                "📸 ¡Foto recibida! Ahora dime, ¿cuál es el nombre de este regalo?",
              );
            } else {
              await sendMessage(chatId, "Error subiendo imagen.");
            }
          }
        } else if (update.message.text && update.message.text !== "/start") {
          await sendMessage(
            chatId,
            "Envía una foto para crear un producto o usa el menú /start.",
          );
        }
        break;

      case "AWAITING_NAME":
        if (update.message.text) {
          draft = { ...draft, name: update.message.text };
          currentState = "AWAITING_PRICE";
          await sendMessage(
            chatId,
            `Nombre: ${update.message.text}. Ahora, ¿cuál es el precio?`,
          );
        }
        break;

      case "AWAITING_PRICE":
        if (update.message.text) {
          const price = parseFloat(update.message.text);
          if (!isNaN(price)) {
            draft = { ...draft, price: price };
            currentState = "AWAITING_CATEGORY";
            await sendMessage(
              chatId,
              `Precio: ${price}. ¿Cuál es la categoría?`,
            );
          } else {
            await sendMessage(chatId, "Por favor envía un número.");
          }
        }
        break;

      case "AWAITING_CATEGORY":
        if (update.message.text) {
          const category = update.message.text;
          const newProduct = {
            name: draft.name,
            price: draft.price,
            image_url: draft.image_url,
            category: category,
            in_stock: true,
          };
          const { error: insertError } = await supabase
            .from("products")
            .insert(newProduct);
          if (insertError) {
            await sendMessage(chatId, `Error DB: ${insertError.message}`);
          } else {
            await sendMessage(chatId, "✅ Producto guardado con éxito");
          }
          currentState = "IDLE";
          draft = {};
        }
        break;

      case "SELECTING_PRODUCT_DISABLE":
      case "SELECTING_PRODUCT_DELETE":
      case "SELECTING_PRODUCT_EDIT":
        await sendMessage(
          chatId,
          "Por favor selecciona una opción del menú de arriba.",
        );
        break;

      default:
        currentState = "IDLE";
        break;
    }

    await supabase
      .from("config")
      .update({ current_state: currentState, draft_product: draft })
      .eq("id", 1);

    return NextResponse.json({ ok: true });
  } catch (error: any) {
    console.error("❌ Error en Webhook:", error); // Keep error log specific for Vercel
    try {
      const payload = (await req.clone().json()) as TelegramUpdate;
      const chatId =
        payload.message?.chat.id || payload.callback_query?.message?.chat.id;
      if (chatId) {
        await sendMessage(
          chatId,
          `⚠️ [V1.5-ERROR] Excepción general: ${error.message || error}`,
        );
      }
    } catch (e) {}
    return NextResponse.json({ ok: true });
  }
}
