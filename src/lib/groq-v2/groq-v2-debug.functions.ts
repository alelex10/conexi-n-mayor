import { createServerFn } from "@tanstack/react-start";

// Client-importable RPC layer. Never static-import server code from client:
// dynamic import() keeps @/server/** out of the client bundle.
export const buscarGroqCrudoFn = createServerFn({ method: "POST" })
  .validator((data: unknown) => {
    const mensaje = (data as { mensaje?: unknown } | null)?.mensaje;
    if (typeof mensaje !== "string" || mensaje.trim().length < 1 || mensaje.trim().length > 2000) {
      throw new Error("[groq-v2] mensaje must be 1..2000 characters.");
    }
    return { mensaje: mensaje.trim() };
  })
  .handler(
  async ({ data }) => {
    const { buscarGroqCrudo } = await import("@/server/ai/groq-v2/search");
    return await buscarGroqCrudo(data.mensaje);
  },
);
