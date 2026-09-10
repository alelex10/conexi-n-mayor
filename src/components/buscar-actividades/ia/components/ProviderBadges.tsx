import { Badge } from "@/components/ui/badge";
import type { Proveedor, ProviderKeyStatus } from "../types";

type BadgeDescriptor = {
  key: string;
  text: string;
  variant?: "default" | "secondary" | "outline";
  className?: string;
};

const MISSING_KEY_CLASS = "border-amber-300 bg-amber-50 text-amber-800";
const OK_KEY_CLASS = "bg-green-600 text-white border-transparent";

function getProviderBadges(proveedor: Proveedor, status: ProviderKeyStatus): BadgeDescriptor[] {
  const badges: BadgeDescriptor[] = [];
  if (proveedor === "groq") {
    badges.push({
      key: "source",
      text: status.source === "groq" ? "vía Groq API" : "lista local",
      variant: status.source === "groq" ? "default" : "secondary",
      className: "text-xs",
    });
  }
  const keyStateByProvider: Record<Proveedor, boolean | null> = {
    groq: status.hasGroqKey,
    lovable: status.hasLovableKey,
    gemini: status.hasGeminiKey,
    openrouter: status.hasOpenRouterKey,
    nvidia: status.hasNvidiaKey,
  };
  const missingLabelByProvider: Record<Proveedor, string> = {
    groq: "Sin GROQ_API_KEY — lista estática",
    lovable: "Sin LOVABLE_API_KEY — lista estática",
    gemini: "Sin GEMINI_API_KEY — lista estática",
    openrouter: "Sin OPENROUTER_API_KEY — lista estática",
    nvidia: "Sin NVIDIA_API_KEY — lista estática",
  };
  const okLabelByProvider: Record<Proveedor, string> = {
    groq: "GROQ_API_KEY OK",
    lovable: "LOVABLE_API_KEY OK",
    gemini: "GEMINI_API_KEY OK",
    openrouter: "OPENROUTER_API_KEY OK",
    nvidia: "NVIDIA_API_KEY OK",
  };
  const hasKey = keyStateByProvider[proveedor];
  if (hasKey === false) {
    badges.push({
      key: "missing-key",
      text: missingLabelByProvider[proveedor],
      variant: "outline",
      className: MISSING_KEY_CLASS,
    });
  }
  if (hasKey === true) {
    badges.push({
      key: "ok-key",
      text: okLabelByProvider[proveedor],
      className: OK_KEY_CLASS,
    });
  }
  return badges;
}

export function ProviderBadges({
  proveedor,
  status,
}: {
  proveedor: Proveedor;
  status: ProviderKeyStatus;
}) {
  return (
    <>
      {getProviderBadges(proveedor, status).map((b) => (
        <Badge key={b.key} variant={b.variant} className={b.className}>
          {b.text}
        </Badge>
      ))}
    </>
  );
}
