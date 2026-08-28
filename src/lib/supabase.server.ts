import { createClient, type SupabaseClient } from "@supabase/supabase-js";

/**
 * Supabase clients — SERVER ONLY.
 * Never import this file from client components. Secrets must stay on the server.
 * Expected env (server-only, never VITE_): SB_URL, SB_PUBLISHABLE_KEY, SB_SECRET_KEY
 * New Supabase keys use prefixes sb_publishable_ / sb_secret_ (non-JWT).
 */

// New Supabase keys (sb_publishable_ / sb_secret_) are not JWTs:
// send them via `apikey` header and strip the default `Authorization: Bearer`.
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

function requireEnv(name: "SB_URL" | "SB_PUBLISHABLE_KEY" | "SB_SECRET_KEY"): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(
      `[supabase.server] Missing required server secret "${name}". ` +
        `Set it in your runtime env (Cloudflare / Nitro / .env server-only). ` +
        `Never use VITE_ / SUPABASE_ prefixes — this project uses SB_* on purpose. ` +
        `If you are building locally without Supabase, the app will fall back to empty data.`,
    );
  }
  return value;
}

function buildClient(key: string): SupabaseClient {
  const url = requireEnv("SB_URL");
  if (!key) throw new Error("[supabase.server] Supabase key is empty.");
  return createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
    global: { fetch: keyFetch(key) },
  });
}

/** Public client (respects RLS). Use for public reads like actividades. */
export function getPublicClient(): SupabaseClient {
  return buildClient(requireEnv("SB_PUBLISHABLE_KEY"));
}

/** Privileged client (bypasses RLS via service_role). Only for server writes like sugerencias. */
export function getAdminClient(): SupabaseClient {
  return buildClient(requireEnv("SB_SECRET_KEY"));
}
