import { createClient } from "@supabase/supabase-js";
import { NextResponse } from "next/server";
import { GoogleGenerativeAI } from "@google/generative-ai";

export const dynamic = "force-dynamic";

// Environment variables
const TELEGRAM_BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;
const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const GEMINI_API_KEY = process.env.GEMINI_API_KEY;

// Constants
const MSG_PREFIX = "[V1.5-CONTROL]";
const OWNER_ID_CHECK = "8343591065";
const BUILD_TAG = "BUILD_2026_GEMINI_VISION";

// Initialize Supabase
const supabase = createClient(SUPABASE_URL!, SUPABASE_SERVICE_ROLE_KEY!, {
  auth: {
    persistSession: false,
    autoRefreshToken: false,
  },
});

// Initialize Gemini (Standard Stable)
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY!);

// Types
type BotState =
  | "IDLE"
  | "AWAITING_APPROVAL"
  | "AWAITING_MANUAL_EDIT" // NEW
  | "AWAITING_NAME"
  | "AWAITING_PRICE"
  | "SELECTING_CATEGORY" // NEW
  | "AWAITING_NEW_CATEGORY_NAME" // NEW
  | "AWAITING_FINAL_CONFIRMATION" // NEW
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
async function logError(error: any, payload: any) {
  console.error(`[${BUILD_TAG}] >>> ERROR DETECTED:`, error);
  try {
    console.log(`[${BUILD_TAG}] >>> DB: INSERT antigravity_logs`);
    await supabase.from("antigravity_logs").insert({
      error: JSON.stringify(error, Object.getOwnPropertyNames(error)),
      payload: payload,
    });
  } catch (e) {
    console.error("Failed to write to antigravity_logs", e);
  }
}

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

async function getFileBuffer(url: string): Promise<Buffer | null> {
  try {
    const res = await fetch(url);
    const blob = await res.blob();
    const arrayBuffer = await blob.arrayBuffer();
    return Buffer.from(arrayBuffer);
  } catch (e) {
    console.error("Buffer fetch failed", e);
    return null;
  }
}

async function uploadImageToSupabase(
  buffer: Buffer,
  fileName: string,
): Promise<string | null> {
  try {
    console.log(`[${BUILD_TAG}] >>> DB: UPLOAD catalog-images`, fileName);
    const { data, error } = await supabase.storage
      .from("catalog-images")
      .upload(fileName, buffer, {
        contentType: "image/jpeg",
        upsert: true,
      });

    if (error) {
      console.error("Supabase upload error:", error);
      if (
        (error as any).statusCode === "404" ||
        error.message?.includes("Bucket not found") ||
        error.message?.includes("The resource was not found")
      ) {
        throw new Error("BUCKET_NOT_FOUND");
      }
      return null;
    }

    const { data: publicUrlData } = supabase.storage
      .from("catalog-images")
      .getPublicUrl(fileName);

    return publicUrlData.publicUrl;
  } catch (e: any) {
    if (e.message === "BUCKET_NOT_FOUND") throw e;
    console.error("Image upload failed:", e);
    return null;
  }
}

async function generateGeminiDescription(imageBuffer: Buffer): Promise<string> {
  if (!GEMINI_API_KEY)
    return "Descripción automática no disponible (Token faltante).";

  try {
    console.log(`[${BUILD_TAG}] >>> GEMINI Request Started (2.5 Flash 2026)`);

    // Use gemini-2.5-flash as requested by the user
    const model = genAI.getGenerativeModel({ model: "gemini-2.5-flash" });

    const prompt =
      "Describe este producto para una tienda de regalos. Sé breve, atractivo y enfocado en la venta. Máximo 2 frases.";
    const base64Data = imageBuffer.toString("base64");

    const result = await model.generateContent([
      prompt,
      {
        inlineData: {
          data: base64Data,
          mimeType: "image/jpeg",
        },
      },
    ]);

    const response = await result.response;
    const text = response.text();
    console.log(`[${BUILD_TAG}] >>> GEMINI SUCCESS: Descripción generada.`);
    return text;
  } catch (e: any) {
    console.error(`[${BUILD_TAG}] >>> GEMINI Error:`, e);
    throw new Error(`🐞 Error en vision: ${e.message}`);
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

    console.log(`[${BUILD_TAG}] >>> DB: SELECT products (list)`);
    const { data: products, error } = await supabase
      .from("products")
      .select("id, name")
      .order("id", { ascending: false })
      .limit(10);

    if (error) {
      throw error;
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
    await logError(e, { action, chatId });
    await sendMessage(chatId, `⚠️ [V1.5-ERROR] ${e.message}`);
  }
}

async function getCategoriesKeyboard() {
  console.log(`[${BUILD_TAG}] >>> DB: SELECT categories`);
  const { data: categories, error } = await supabase
    .from("categories")
    .select("id, name")
    .order("name", { ascending: true });

  if (error) {
    console.error("Error fetching categories", error);
    return null;
  }

  const buttons =
    categories?.map((c) => [
      { text: c.name, callback_data: `cat_select_${c.id}` },
    ]) || [];
  buttons.push([{ text: "➕ Nueva Categoría", callback_data: "cat_new" }]);

  return { inline_keyboard: buttons };
}

async function sendConfirmationSummary(chatId: number, draft: any) {
  const summary =
    `📋 **Resumen del Producto:**\n\n` +
    `🔹 **Nombre:** ${draft.name}\n` +
    `💰 **Precio:** ${draft.price}\n` +
    `📂 **Categoría:** ${draft.category_name || "N/A"}\n\n` +
    `¿Confirmas la creación?`;

  const keyboard = {
    inline_keyboard: [
      [{ text: "✅ Confirmar", callback_data: "final_confirm" }],
      [{ text: "❌ Cancelar", callback_data: "final_cancel" }],
    ],
  };
  await sendMessage(chatId, summary, keyboard);
}

// Main Webhook Handler
export async function POST(req: Request) {
  let update: TelegramUpdate | null = null;
  try {
    const body = await req.json();
    update = body;

    console.log(
      `[${BUILD_TAG}] >>> WEBHOOK RECEIVE:`,
      JSON.stringify(body, null, 2),
    );

    const message = update?.message || update?.callback_query?.message;
    const fromUser = update?.message?.from || update?.callback_query?.from;

    if (!message || !fromUser) {
      return NextResponse.json({ ok: true });
    }

    const chatId = message.chat.id;
    const userId = fromUser.id;

    // 1. Verify Owner
    let config = null;
    try {
      console.log(`[${BUILD_TAG}] >>> DB: SELECT config (owner check)`);
      const { data, error } = await supabase
        .from("config")
        .select("tg_owner_id, current_state, draft_product")
        .eq("id", 1)
        .single();

      if (error) throw error;
      config = data;

      console.log(`[${BUILD_TAG}] >>> CURRENT STATE: ${config.current_state}`);
    } catch (e: any) {
      await logError(e, { userId, stage: "config_fetch" });
      await sendMessage(
        chatId,
        `⚠️ [V1.5-ERROR] Error DB Config: ${e.message}`,
      );
      return NextResponse.json({ ok: true });
    }

    const isDbOwner = String(config.tg_owner_id) === String(userId);
    const isHardcodedOwner = String(userId) === OWNER_ID_CHECK;

    if (!isDbOwner && !isHardcodedOwner) {
      console.warn(`[${BUILD_TAG}] Unauthorized:`, userId);
      await sendMessage(chatId, `⚠️ Acceso denegado. ID: ${userId}.`);
      return NextResponse.json({ ok: true });
    }

    let currentState: BotState = (config.current_state as BotState) || "IDLE";
    let draft = config.draft_product || {};

    // --- HANDLE CALLBACK QUERIES ---
    if (update?.callback_query) {
      const data = update.callback_query.data;
      await answerCallbackQuery(update.callback_query.id);

      if (data === "cmd_create") {
        await sendMessage(
          chatId,
          "📸 Envía la foto del regalito para analizarla con IA.",
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
      } else if (data === "approve_desc") {
        currentState = "AWAITING_NAME";
        await sendMessage(
          chatId,
          "✅ Descripción aprobada. ¿Cuál es el nombre del producto?",
        );
      } else if (data === "edit_desc") {
        currentState = "AWAITING_MANUAL_EDIT";
        await sendMessage(
          chatId,
          "✍️ Envía la nueva descripción del producto:",
        );
      } else if (data === "retry_desc") {
        currentState = "IDLE";
        draft = {};
        await sendMessage(chatId, "🔄 Entendido. Envía otra foto.");
      } else if (data.startsWith("cat_select_")) {
        const catId = data.split("cat_select_")[1];
        // Fetch category name for summary
        const { data: cat } = await supabase
          .from("categories")
          .select("name")
          .eq("id", catId)
          .single();

        draft = {
          ...draft,
          category_id: catId,
          category_name: cat?.name || "Desconocida",
        };
        currentState = "AWAITING_FINAL_CONFIRMATION";
        await sendConfirmationSummary(chatId, draft);
      } else if (data === "cat_new") {
        currentState = "AWAITING_NEW_CATEGORY_NAME";
        await sendMessage(chatId, "Escribe el nombre de la nueva categoría:");
      } else if (data === "final_confirm") {
        const newProduct = {
          name: draft.name,
          price: draft.price,
          image_url: draft.image_url,
          category: draft.category_id, // UUID
          // category: draft.category_name, // Optional: if legacy text needed
          ai_description: draft.ai_description || null,
          approval_status: "approved",
          in_stock: true,
        };
        console.log(`[${BUILD_TAG}] >>> DB: INSERT products`, newProduct);
        const { error: insertError } = await supabase
          .from("products")
          .insert(newProduct);
        if (insertError) {
          await sendMessage(
            chatId,
            `❌ Error al guardar: ${insertError.message}`,
          );
        } else {
          await sendMessage(
            chatId,
            "✅ Producto guardado y publicado con éxito.",
          );
        }
        currentState = "IDLE";
        draft = {};
      } else if (data === "final_cancel") {
        currentState = "IDLE";
        draft = {};
        await sendMessage(chatId, "❌ Creación cancelada.");
      } else if (data.startsWith("act_disable_")) {
        const productId = data.split("_")[2];
        console.log(
          `[${BUILD_TAG}] >>> DB: UPDATE products (disable)`,
          productId,
        );
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
        console.log(`[${BUILD_TAG}] >>> DB: DELETE products`, productId);
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
      }

      console.log(`[${BUILD_TAG}] >>> DB: UPDATE config (state)`);
      await supabase
        .from("config")
        .update({ current_state: currentState, draft_product: draft })
        .eq("id", 1);
      return NextResponse.json({ ok: true });
    }

    // --- HANDLE TEXT COMMANDS ---
    if (update?.message?.text === "/start") {
      console.log(`[${BUILD_TAG}] >>> DB: UPDATE config (reset)`);
      await supabase
        .from("config")
        .update({ current_state: "IDLE", draft_product: {} })
        .eq("id", 1);
      await sendMainMenu(chatId);
      return NextResponse.json({ ok: true });
    }

    // --- FSM LOGIC ---
    if (!update?.message) return NextResponse.json({ ok: true });

    switch (currentState) {
      case "IDLE":
        if (update.message.photo) {
          await sendMessage(
            chatId,
            "✨ Analizando imagen con Gemini 2.5 Flash...",
          );
          const photo = update.message.photo[update.message.photo.length - 1];
          const fileUrl = await getFileUrl(photo.file_id);

          if (fileUrl) {
            const imageBuffer = await getFileBuffer(fileUrl);
            if (imageBuffer) {
              const fileName = `${Date.now()}.jpg`;
              // Upload
              let publicUrl: string | null = null;
              try {
                publicUrl = await uploadImageToSupabase(imageBuffer, fileName);
              } catch (e: any) {
                if (e.message === "BUCKET_NOT_FOUND") {
                  await sendMessage(
                    chatId,
                    "⚠️ Error: El bucket 'catalog-images' no existe en Supabase",
                  );
                  await supabase
                    .from("config")
                    .update({ current_state: "IDLE", draft_product: {} })
                    .eq("id", 1);
                  return NextResponse.json({ ok: true });
                }
              }

              if (publicUrl) {
                try {
                  const description =
                    await generateGeminiDescription(imageBuffer);

                  draft = {
                    ...draft,
                    image_url: publicUrl,
                    ai_description: description,
                  };
                  currentState = "AWAITING_APPROVAL";

                  const keyboard = {
                    inline_keyboard: [
                      [
                        {
                          text: "✅ Confirmar y Publicar",
                          callback_data: "approve_desc",
                        },
                      ],
                      [{ text: "✍️ Editar", callback_data: "edit_desc" }], // New Button
                      [
                        {
                          text: "🔄 Intentar de nuevo",
                          callback_data: "retry_desc",
                        },
                      ],
                    ],
                  };
                  await sendMessage(
                    chatId,
                    `🤖 **Descripción Sugerida:**\n"${description}"\n\n¿Es correcta esta descripción?`,
                    keyboard,
                  );
                } catch (geminiError: any) {
                  await logError(geminiError, { stage: "gemini_generation" });
                  await sendMessage(
                    chatId,
                    geminiError.message || "Error desconocido en visión.",
                  );
                }
              } else {
                await sendMessage(
                  chatId,
                  "Error subiendo imagen (Revise logs).",
                );
              }
            } else {
              await sendMessage(chatId, "Error descargando imagen.");
            }
          }
        } else if (update.message.text && update.message.text !== "/start") {
          await sendMessage(
            chatId,
            "Envía una foto para crear un producto o usa el menú /start.",
          );
        }
        break;

      case "AWAITING_APPROVAL":
        await sendMessage(chatId, "Por favor usa los botones para confirmar.");
        break;

      case "AWAITING_MANUAL_EDIT":
        if (update.message.text) {
          draft = { ...draft, ai_description: update.message.text }; // Update Desc
          currentState = "AWAITING_NAME";
          await sendMessage(
            chatId,
            "✅ Descripción actualizada. ¿Cuál es el nombre del producto?",
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
            currentState = "SELECTING_CATEGORY"; // Changed from AWAITING_CATEGORY

            const kb = await getCategoriesKeyboard();
            if (kb) {
              await sendMessage(
                chatId,
                `Precio: ${price}. Selecciona la Categoría:`,
                kb,
              );
            } else {
              await sendMessage(
                chatId,
                "Error cargando categorías. (Check logs)",
              );
            }
          } else {
            await sendMessage(chatId, "Por favor envía un número.");
          }
        }
        break;

      case "AWAITING_NEW_CATEGORY_NAME":
        if (update.message.text) {
          const newCatName = update.message.text;
          console.log(`[${BUILD_TAG}] >>> DB: INSERT categories`, newCatName);
          const { data: newCat, error } = await supabase
            .from("categories")
            .insert({ name: newCatName })
            .select()
            .single();

          if (error) {
            await sendMessage(
              chatId,
              `Cannot create category: ${error.message}`,
            );
            // Optional: retry or go back
          } else {
            draft = {
              ...draft,
              category_id: newCat.id,
              category_name: newCat.name,
            };
            currentState = "AWAITING_FINAL_CONFIRMATION";
            await sendConfirmationSummary(chatId, draft);
          }
        }
        break;

      case "SELECTING_CATEGORY":
      case "AWAITING_FINAL_CONFIRMATION":
        await sendMessage(chatId, "Por favor usa los botones del menú.");
        break;

      // Legacy/Unused logic fallback
      case "AWAITING_CATEGORY":
        currentState = "IDLE"; // No longer used
        break;

      default:
        await sendMessage(chatId, "Opción no válida.");
        break;
    }

    console.log(`[${BUILD_TAG}] >>> DB: UPDATE config (loop end)`, {
      currentState,
    });
    await supabase
      .from("config")
      .update({ current_state: currentState, draft_product: draft })
      .eq("id", 1);

    return NextResponse.json({ ok: true });
  } catch (error: any) {
    await logError(error, update);
    try {
      const chatId =
        update?.message?.chat.id || update?.callback_query?.message?.chat.id;
      if (chatId) {
        await sendMessage(
          chatId,
          `⚠️ [V1.5-ERROR] Logged: ${error.message || error}`,
        );
      }
    } catch (e) {}
    return NextResponse.json({ ok: true });
  }
}
