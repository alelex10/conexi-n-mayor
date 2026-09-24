/**
 * Búsqueda web REAL vía Firecrawl (connector gateway). Devuelve páginas reales
 * con su contenido para que la IA solo extraiga actividades de fuentes verificables.
 */
export type FuenteWeb = { url: string; titulo: string; contenido: string };

const GATEWAY = "https://connector-gateway.lovable.dev/firecrawl/v2";

export async function buscarFuentesWeb(query: string, limit = 6): Promise<FuenteWeb[]> {
  const lovableKey = process.env["LOVABLE_API_KEY"];
  const fcKey = process.env["FIRECRAWL_API_KEY"];
  if (!lovableKey || !fcKey) throw new Error("[web-search] Falta la conexión de búsqueda web (Firecrawl).");

  const res = await fetch(`${GATEWAY}/search`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${lovableKey}`,
      "X-Connection-Api-Key": fcKey,
    },
    body: JSON.stringify({
      query,
      limit,
      lang: "es",
      country: "cl",
      scrapeOptions: { formats: ["markdown"], onlyMainContent: true },
    }),
  });
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`[web-search] Búsqueda web falló [${res.status}]: ${body.slice(0, 300)}`);
  }
  const json = (await res.json()) as {
    data?: { web?: Array<Record<string, unknown>> } | Array<Record<string, unknown>>;
  };
  const items = Array.isArray(json.data) ? json.data : (json.data?.web ?? []);
  return items
    .map((it) => {
      const meta = (it["metadata"] ?? {}) as Record<string, unknown>;
      const url = String(it["url"] ?? meta["sourceURL"] ?? "");
      const titulo = String(it["title"] ?? meta["title"] ?? "");
      const contenido = String(it["markdown"] ?? it["description"] ?? "").slice(0, 2500);
      return { url, titulo, contenido };
    })
    .filter((f) => f.url.startsWith("http") && f.contenido.length > 0);
}
