import { createClient, type SupabaseClient } from "@supabase/supabase-js";

/**
 * Clientes de Supabase para uso EXCLUSIVO en servidor (server functions).
 * Las claves viven en secretos del proyecto: SB_URL, SB_PUBLISHABLE_KEY, SB_SECRET_KEY.
 */

// Las claves nuevas de Supabase (sb_publishable_ / sb_secret_) no son JWT:
// hay que enviarlas en el header `apikey` y quitar el `Authorization: Bearer`.
function keyFetch(key: string): typeof fetch {
  return (input, init) => {
    const headers = new Headers(init?.headers);
    if (key.startsWith("sb_") && headers.get("Authorization") === `Bearer ${key}`) {
      headers.delete("Authorization");
    }
    headers.set("apikey", key);
    return fetch(input as RequestInfo, { ...init, headers });
  };
}

function buildClient(key: string): SupabaseClient {
  const url = process.env["SB_URL"];
  if (!url || !key) {
    throw new Error("Faltan las variables SB_URL / claves de Supabase en el servidor.");
  }
  return createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
    global: { fetch: keyFetch(key) },
  });
}

/** Cliente público (respeta RLS). Úsalo para lecturas públicas. */
export function getPublicClient() {
  return buildClient(process.env["SB_PUBLISHABLE_KEY"] ?? "");
}

/** Cliente con clave secreta (omite RLS). Solo para operaciones privilegiadas. */
export function getAdminClient() {
  return buildClient(process.env["SB_SECRET_KEY"] ?? "");
}
