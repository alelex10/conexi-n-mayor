import OpenAI from "openai";
import { z } from "zod";

/**
 * Schema for the structured JSON extracted from an afiche (poster) image.
 * All fields map to the HITL pipeline: low confidence (<0.85) goes to human review.
 */
export const AficheExtractSchema = z.object({
  titulo: z.string().min(1).describe("Title of the activity as seen on the poster"),
  descripcion: z.string().optional().describe("Short description / body text"),
  fecha: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, "fecha must be ISO YYYY-MM-DD")
    .nullable()
    .describe("Event date in ISO YYYY-MM-DD, or null if not found"),
  hora: z.string().nullable().describe("Event time as seen (e.g. 15:00), or null"),
  lugar: z.string().nullable().describe("Venue name, or null"),
  direccion: z.string().nullable().describe("Street address, or null"),
  categoria: z.enum(["taller", "paseo", "charla", "deporte", "cultura", "otro"]).describe("Activity category"),
  confidence: z.number().min(0).max(1).describe("Overall extraction confidence 0..1"),
  fields: z.record(z.string(), z.number().min(0).max(1)).optional().describe("Per-field confidence map"),
  warnings: z.array(z.string()).optional().describe("Warnings / uncertainties"),
  precio_texto: z.string().optional().describe("Price as text if present"),
  es_gratuito: z.boolean().optional().describe("Whether the activity is free"),
});

export type AficheExtracted = z.infer<typeof AficheExtractSchema>;

export type ExtractAficheInput = {
  /** Raw base64 without data: prefix */
  imageBase64: string;
  mimeType?: "image/jpeg" | "image/png";
};

const DEFAULT_MODEL = "meta-llama/llama-4-scout-17b-16e-instruct";
const GROQ_BASE_URL = "https://api.groq.com/openai/v1";

/**
 * Creates a Groq-compatible OpenAI client.
 * Reads env INSIDE the function (Workers-safe): never at module top-level.
 */
export function getGroqClient(): OpenAI {
  const apiKey = process.env["GROQ_API_KEY"];
  if (!apiKey) {
    throw new Error(
      "[groq] Missing GROQ_API_KEY. Set it in your server env (Cloudflare / Nitro / .env). " +
        "Get a free key at https://console.groq.com/keys — no credit card required.",
    );
  }
  return new OpenAI({
    apiKey,
    baseURL: GROQ_BASE_URL,
    timeout: 30_000,
    maxRetries: 2,
  });
}

function resolveModel(): string {
  // Support both naming conventions:
  // - AI_EXTRACTOR_MODEL (primary, as per task spec)
  // - GROQ_MODEL_OVERRIDE / AI_EXTRACTOR_MODEL_OVERRIDE (alternates)
  return (
    process.env["AI_EXTRACTOR_MODEL"] ??
    process.env["GROQ_MODEL_OVERRIDE"] ??
    process.env["AI_EXTRACTOR_MODEL_OVERRIDE"] ??
    DEFAULT_MODEL
  );
}

function buildSystemPrompt(): string {
  // Must contain the word "JSON" for Groq response_format: json_object
  return [
    "You are a precise vision extractor for community activity posters (afiches).",
    "Extract structured JSON from the poster image.",
    "Return ONLY valid JSON (no markdown, no fences) matching this schema:",
    "{",
    '  "titulo": string (required),',
    '  "descripcion": string | optional,',
    '  "fecha": "YYYY-MM-DD" | null,',
    '  "hora": string | null (e.g. "15:00"),',
    '  "lugar": string | null,',
    '  "direccion": string | null,',
    '  "categoria": "taller" | "paseo" | "charla" | "deporte" | "cultura" | "otro",',
    '  "confidence": number 0..1 (overall certainty),',
    '  "fields": { [fieldName]: number 0..1 } | optional (per-field confidence),',
    '  "warnings": string[] | optional,',
    '  "precio_texto": string | optional,',
    '  "es_gratuito": boolean | optional',
    "}",
    "Rules:",
    "- Use null when a field is not visible / not present on the poster.",
    "- categoria must be one of the enum values; use 'otro' if unsure.",
    "- confidence: be calibrated; <0.85 means uncertain and will go to HITL review.",
    "- fecha must be ISO YYYY-MM-DD or null; infer year as current if missing.",
    "- Always return valid JSON. The word JSON is required here for json_object mode.",
  ].join("\n");
}

function stripJsonFences(raw: string): string {
  const trimmed = raw.trim();
  // Handle ```json ... ``` or ``` ... ``` wrappers that some models still emit
  if (trimmed.startsWith("```")) {
    const withoutOpen = trimmed.replace(/^```(?:json)?\s*/i, "");
    const withoutClose = withoutOpen.replace(/\s*```\s*$/, "");
    return withoutClose.trim();
  }
  return trimmed;
}

function isRetryableError(error: unknown): boolean {
  if (error instanceof OpenAI.APIError) {
    // 429 rate limit and 5xx are retryable
    if (error.status === 429) return true;
    if (error.status !== undefined && error.status >= 500) return true;
  }
  if (error instanceof Error) {
    const msg = error.message.toLowerCase();
    if (msg.includes("timeout") || msg.includes("timed out") || msg.includes("etimedout")) return true;
    if (msg.includes("429") || msg.includes("rate limit")) return true;
  }
  return false;
}

function toFriendlyError(error: unknown): Error {
  if (error instanceof OpenAI.APIError) {
    if (error.status === 429) {
      return new Error(
        `[groq] Rate limit exceeded (429). Groq free tier is 30 RPM / 1K RPD. ` +
          `Wait a moment and retry. Details: ${error.message}`,
      );
    }
    if (error.status === 401) {
      return new Error(`[groq] Unauthorized (401). Check GROQ_API_KEY is valid. Details: ${error.message}`);
    }
    if (
      error instanceof OpenAI.APIConnectionTimeoutError ||
      error.message.toLowerCase().includes("timeout")
    ) {
      return new Error(`[groq] Request timed out after 30s. The image may be too large or Groq is busy. Try again.`);
    }
  }
  if (error instanceof Error) {
    const lower = error.message.toLowerCase();
    if (lower.includes("timeout") || lower.includes("timed out")) {
      return new Error(`[groq] Request timed out after 30s. Try again with a smaller image. Cause: ${error.message}`);
    }
    if (lower.includes("429") || lower.includes("rate limit")) {
      return new Error(`[groq] Rate limit (429) — wait and retry. Cause: ${error.message}`);
    }
  }
  if (error instanceof Error) return error;
  return new Error(`[groq] Unknown error: ${String(error)}`);
}

/**
 * Extract structured data from a poster image via Groq vision.
 * Pure function — no TanStack imports, safe to call from any server handler.
 */
export async function extractAficheFromImage(input: ExtractAficheInput): Promise<AficheExtracted> {
  const { imageBase64, mimeType = "image/jpeg" } = input;

  if (!imageBase64 || imageBase64.length < 100) {
    throw new Error("[extractAficheFromImage] imageBase64 too short — provide a valid base64-encoded JPG/PNG.");
  }
  if (mimeType !== "image/jpeg" && mimeType !== "image/png") {
    throw new Error(`[extractAficheFromImage] Unsupported mimeType "${mimeType}". Use image/jpeg or image/png.`);
  }

  const client = getGroqClient();
  const model = resolveModel();

  let rawContent: string | null | undefined;
  try {
    const completion = await client.chat.completions.create({
      model,
      temperature: 0,
      response_format: { type: "json_object" },
      messages: [
        { role: "system", content: buildSystemPrompt() },
        {
          role: "user",
          content: [
            {
              type: "text",
              text: "Extraé en JSON según schema. Devolvé JSON. Analizá el afiche y devolvé el JSON estructurado.",
            },
            {
              type: "image_url",
              image_url: { url: `data:${mimeType};base64,${imageBase64}` },
            },
          ],
        },
      ],
    });

    rawContent = completion.choices[0]?.message?.content;
    if (!rawContent) {
      throw new Error("[groq] Empty response content from model.");
    }

    const cleaned = stripJsonFences(rawContent);
    let parsed: unknown;
    try {
      parsed = JSON.parse(cleaned);
    } catch (parseErr) {
      throw new Error(`[groq] Failed to parse JSON from model. Raw: ${cleaned.slice(0, 800)} — ${(parseErr as Error).message}`);
    }

    const validated = AficheExtractSchema.parse(parsed);
    return validated;
  } catch (error) {
    throw toFriendlyError(error);
  }
}

/**
 * Simple fallback wrapper. Attempts Groq extraction; on retryable failure logs a warning.
 * xAI / other provider fallback is intentionally NOT implemented — left as TODO.
 */
export async function extractWithFallback(input: ExtractAficheInput): Promise<AficheExtracted> {
  try {
    return await extractAficheFromImage(input);
  } catch (error) {
    if (isRetryableError(error)) {
      console.warn("[extractWithFallback] Groq retryable error — would fallback if secondary provider configured.", error);
      // TODO: implement secondary provider (e.g. xAI grok-2-vision) here when configured.
      // Example: if (process.env.XAI_API_KEY) return await extractWithXAI(input);
    }
    throw error;
  }
}
