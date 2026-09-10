import { createFileRoute } from "@tanstack/react-router";

import { AppShell } from "@/components/AppShell";
import { BuscarActividadesIA } from "@/components/buscar-actividades-ia";
import { CompararHeader } from "@/components/comparar/CompararHeader";
import { ChileCulturaTab } from "@/components/buscar-actividades/api/ChileCulturaTab";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

// Lab page (direct URL, no header nav link — same pattern as /groq):
// side-by-side comparison of the two search implementations.
// Tab 1 mounts <BuscarActividadesIA/> as-is; Tab 2 lists ChileCultura
// results isolated. Both tabs fully independent.
export const Route = createFileRoute("/comparar")({
  head: () => ({
    meta: [
      { title: "Comparar — Groq (IA) vs ChileCultura (API)" },
      {
        name: "description",
        content:
          "Página Lab para comparar calidad y funcionamiento: búsqueda Groq por ubicación vs API ChileCultura — Ciudad Viva Mayor.",
      },
    ],
  }),
  component: CompararPage,
});

function CompararPage() {
  return (
    <AppShell>
      <CompararHeader />
      <Tabs defaultValue="groq" className="w-full">
        <TabsList className="grid w-full grid-cols-2" aria-label="Fuente de búsqueda a comparar">
          <TabsTrigger value="groq">IA</TabsTrigger>
          <TabsTrigger value="chilecultura">ChileCultura (API)</TabsTrigger>
        </TabsList>
        <TabsContent value="groq">
          <BuscarActividadesIA />
        </TabsContent>
        <TabsContent value="chilecultura">
          <ChileCulturaTab />
        </TabsContent>
      </Tabs>
    </AppShell>
  );
}
