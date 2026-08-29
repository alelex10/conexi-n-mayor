import { createServerFn } from "@tanstack/react-start";

/**
 * Admin server functions — SERVER ONLY.
 * All reads use getAdminClient (service_role, bypass RLS) and read env INSIDE handler.
 * Fallback to empty array when Supabase env is not configured or table is missing.
 */

function isMissingEnvError(e: unknown): boolean {
  return e instanceof Error && e.message.includes("Missing required server secret");
}

function isMissingTableError(e: unknown): boolean {
  if (!(e instanceof Error)) return false;
  const msg = e.message;
  return (
    msg.includes("does not exist") ||
    msg.includes("relation") ||
    msg.includes("42P01") ||
    msg.includes("Could not find the table")
  );
}

/** Lista sugerencias (admin). Ordenadas por fecha descendente. */
export const listarSugerencias = createServerFn({ method: "GET" }).handler(
  async (): Promise<
    Array<{
      id: string;
      tipo: string;
      nombre: string | null;
      contacto: string | null;
      mensaje: string;
      estado: string | null;
      revisado: boolean | null;
      creado_en: string | null;
      created_at: string | null;
    }>
  > => {
    try {
      const { getAdminClient } = await import("./supabase.server");
      const { data, error } = await getAdminClient()
        .from("sugerencias")
        .select("*")
        .order("creado_en" as never, { ascending: false })
        .limit(100);
      if (error) throw new Error(error.message);

      // Sort in JS as fallback: handles both creado_en / created_at naming
      const rows = (data ?? []) as unknown as Array<Record<string, unknown>>;
      rows.sort((a, b) => {
        const da = (a["creado_en"] as string) ?? (a["created_at"] as string) ?? "";
        const db = (b["creado_en"] as string) ?? (b["created_at"] as string) ?? "";
        return db.localeCompare(da);
      });
      return rows as never;
    } catch (e) {
      if (isMissingEnvError(e) || isMissingTableError(e)) {
        console.warn(
          "[admin.functions] listarSugerencias — Supabase not configured or table missing, returning empty.",
          e instanceof Error ? e.message : String(e),
        );
        return [];
      }
      // For sugerencias, if creado_en column doesn't exist, retry without ordering
      if (e instanceof Error && e.message.includes("creado_en")) {
        try {
          const { getAdminClient } = await import("./supabase.server");
          const { data, error } = await getAdminClient().from("sugerencias").select("*").limit(100);
          if (error) throw new Error(error.message);
          return (data ?? []) as never;
        } catch (e2) {
          if (isMissingEnvError(e2) || isMissingTableError(e2)) return [];
          throw e2;
        }
      }
      throw e;
    }
  },
);

/** Lista extracciones_pendientes (admin, HITL queue). */
export const listarExtraccionesPendientes = createServerFn({ method: "GET" }).handler(
  async (): Promise<
    Array<{
      id: string;
      created_at: string;
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      raw_json: Record<string, any> | null;
      confidence: number;
      provider: string;
      status: string;
      image_url: string | null;
      warnings: string[] | null;
    }>
  > => {
    try {
      const { getAdminClient } = await import("./supabase.server");
      const { data, error } = await getAdminClient()
        .from("extracciones_pendientes")
        .select("*")
        .order("created_at" as never, { ascending: false })
        .limit(100);
      if (error) throw new Error(error.message);
      return (data ?? []) as never;
    } catch (e) {
      if (isMissingEnvError(e) || isMissingTableError(e)) {
        console.warn(
          "[admin.functions] listarExtraccionesPendientes — Supabase not configured or table missing, returning empty.",
          e instanceof Error ? e.message : String(e),
        );
        return [];
      }
      throw e;
    }
  },
);

/** Verifica si Supabase está configurado (env presente). */
export const verificarConfigSupabase = createServerFn({ method: "GET" }).handler(
  async (): Promise<{ configured: boolean; missing: string[] }> => {
    try {
      const { getAdminClient } = await import("./supabase.server");
      // This will throw if SB_* env is missing
      getAdminClient();
      return { configured: true, missing: [] };
    } catch (e) {
      if (isMissingEnvError(e)) {
        const missing: string[] = [];
        if (!process.env["SB_URL"]) missing.push("SB_URL");
        if (!process.env["SB_PUBLISHABLE_KEY"]) missing.push("SB_PUBLISHABLE_KEY");
        if (!process.env["SB_SECRET_KEY"]) missing.push("SB_SECRET_KEY");
        return { configured: false, missing: missing.length ? missing : ["SB_*"] };
      }
      return { configured: false, missing: [] };
    }
  },
);
