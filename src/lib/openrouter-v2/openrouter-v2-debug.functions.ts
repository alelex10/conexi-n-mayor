import { createServerFn } from "@tanstack/react-start";

// Client-importable RPC layer. Never static-import server code from client:
// dynamic import() keeps @/server/** out of the client bundle.
export const buscarOpenRouterCrudoFn = createServerFn({ method: "POST" })
  .validator((data: unknown) => {
    const mensaje = (data as { mensaje?: unknown } | null)?.mensaje;
    if (typeof mensaje !== "string" || mensaje.trim().length < 1 || mensaje.trim().length > 2000) {
      throw new Error("[openrouter-v2] mensaje must be 1..2000 characters.");
    }
    return { mensaje: mensaje.trim() };
  })
  .handler(async ({ data }) => {
    const { buscarOpenRouterCrudo } = await import("@/server/ai/openrouter-v2/search");
    return await buscarOpenRouterCrudo(data.mensaje);
  });
