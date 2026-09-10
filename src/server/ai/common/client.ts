import { GoogleGenAI } from "@google/genai";
import OpenAI from "openai";

/**
 * Common AI client factories (Workers-safe).
 *
 * Reads API keys inside the functions so Cloudflare/Nitro bundled code
 * does not capture the env at import time. Mirrors the pattern in
 * src/server/ai/groq/search.ts#getGroqClient and
 * src/server/ai/gemini/search.ts#getGeminiClient.
 */

export const GROQ_BASE_URL = "https://api.groq.com/openai/v1";
export const GROQ_TIMEOUT_MS = 30_000;
export const GROQ_MAX_RETRIES = 2;

export const OPENROUTER_BASE_URL = "https://openrouter.ai/api/v1";
export const OPENROUTER_TIMEOUT_MS = 30_000;
export const OPENROUTER_MAX_RETRIES = 2;

export const NVIDIA_BASE_URL = "https://integrate.api.nvidia.com/v1";
export const NVIDIA_TIMEOUT_MS = 30_000;
export const NVIDIA_MAX_RETRIES = 2;

export function getGeminiClient(): GoogleGenAI {
  const apiKey = process.env["GEMINI_API_KEY"];
  if (!apiKey) {
    throw new Error(
      "[gemini] Missing GEMINI_API_KEY. Set it in your server env (Cloudflare / Nitro / .env). " +
        "Get a free key at https://aistudio.google.com/apikey — no credit card required.",
    );
  }
  return new GoogleGenAI({ apiKey });
}

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
    timeout: GROQ_TIMEOUT_MS,
    maxRetries: GROQ_MAX_RETRIES,
  });
}

export function getOpenRouterClient(): OpenAI {
  const apiKey = process.env["OPENROUTER_API_KEY"];
  if (!apiKey) {
    throw new Error(
      "[openrouter] Missing OPENROUTER_API_KEY. Set it in your server env (Cloudflare / Nitro / .env). " +
        "Get a free key at https://openrouter.ai/keys — no credit card required.",
    );
  }
  return new OpenAI({
    apiKey,
    baseURL: OPENROUTER_BASE_URL,
    timeout: OPENROUTER_TIMEOUT_MS,
    maxRetries: OPENROUTER_MAX_RETRIES,
  });
}

export function getNvidiaClient(): OpenAI {
  // Accept both NVIDIA_API_KEY and NVAPI_KEY (NVIDIA docs use either).
  const apiKey = process.env["NVIDIA_API_KEY"] ?? process.env["NVAPI_KEY"];
  if (!apiKey) {
    throw new Error(
      "[nvidia] Missing NVIDIA_API_KEY (or NVAPI_KEY). Set it in your server env (Cloudflare / Nitro / .env). " +
        "Get a key at https://build.nvidia.com/explore/discover — free tier available.",
    );
  }
  return new OpenAI({
    apiKey,
    baseURL: NVIDIA_BASE_URL,
    timeout: NVIDIA_TIMEOUT_MS,
    maxRetries: NVIDIA_MAX_RETRIES,
  });
}
