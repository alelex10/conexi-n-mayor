# common — shared AI harness

Purpose: provider-agnostic helpers for all AI activity-search providers (Groq, Gemini, Lovable, future).

What will live here:
- `harness.ts` — JSON fence stripping, global confidence computation, and eventually shared Zod schemas + prompt builders (currently still owned by `groq-actividades.ts`; see TODOs inside).
- `client.ts` — Groq OpenAI-compatible client factory (`GROQ_API_KEY` read inside the function, Workers-safe) so `groq-v2` and the future canonical `groq/` provider share one construction site.
