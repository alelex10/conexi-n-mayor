import { createFileRoute, Link, useRouter } from "@tanstack/react-router";
import { useState } from "react";
import {
  ArrowLeft,
  Database,
  RefreshCw,
  AlertTriangle,
  Calendar,
  MapPin,
  ClipboardList,
  Sparkles,
  Braces,
} from "lucide-react";

import { listarActividades } from "@/lib/actividades.functions";
import {
  listarExtraccionesPendientes,
  listarSugerencias,
  verificarConfigSupabase,
} from "@/lib/admin.functions";
import { formatearDistancia, formatearFecha, type Actividad } from "@/data/actividades";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Separator } from "@/components/ui/separator";

export const Route = createFileRoute("/db")({
  head: () => ({
    meta: [
      { title: "Datos en la base — Ciudad Viva Mayor" },
      {
        name: "description",
        content: "Inspecciona los datos guardados en Supabase: actividades, sugerencias y extracciones pendientes.",
      },
      { property: "og:title", content: "Datos en la base — Ciudad Viva Mayor" },
    ],
  }),
  loader: async () => {
    try {
      const [actividades, sugerencias, extracciones, config] = await Promise.all([
        listarActividades({ data: {} }).catch(() => [] as Actividad[]),
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (listarSugerencias() as Promise<any[]>).catch(() => []),
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (listarExtraccionesPendientes() as Promise<any[]>).catch(() => []),
        verificarConfigSupabase().catch(() => ({ configured: false, missing: [] as string[] })),
      ]);
      return {
        actividades: actividades as Actividad[],
        sugerencias: sugerencias as unknown[],
        extracciones: extracciones as unknown[],
        supabaseConfigured: config.configured,
        missingEnv: config.missing,
      };
    } catch (e) {
      console.error("[db loader] failed", e);
      return {
        actividades: [] as Actividad[],
        sugerencias: [] as unknown[],
        extracciones: [] as unknown[],
        supabaseConfigured: false,
        missingEnv: [] as string[],
      };
    }
  },
  component: DbView,
});

// ---------- helpers ----------

function EstadoBadge({ estado }: { estado?: string | null | undefined }) {
  const v = (estado ?? "publicada").toLowerCase();
  if (v === "publicada") {
    return <Badge className="bg-green-600 text-white hover:bg-green-600 border-transparent">publicada</Badge>;
  }
  if (v === "borrador") {
    return <Badge className="bg-amber-500 text-white hover:bg-amber-500 border-transparent">borrador</Badge>;
  }
  if (v === "archivada") {
    return <Badge variant="secondary">archivada</Badge>;
  }
  return <Badge variant="outline">{v}</Badge>;
}

function TipoSugerenciaBadge({ tipo }: { tipo: string }) {
  const t = tipo.toLowerCase();
  if (t === "error") return <Badge variant="destructive">error</Badge>;
  if (t === "actividad") return <Badge className="bg-[#1E6CB4] text-white hover:bg-[#1E6CB4]">actividad</Badge>;
  return <Badge variant="secondary">sugerencia</Badge>;
}

function formatDateTime(iso: string | null | undefined): string {
  if (!iso) return "—";
  try {
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return iso;
    return d.toLocaleString("es-CL", {
      day: "2-digit",
      month: "short",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return iso;
  }
}

function truncate(text: string | null | undefined, max = 80): string {
  if (!text) return "—";
  if (text.length <= max) return text;
  return text.slice(0, max) + "…";
}

function EmptyState({ label }: { label: string }) {
  return (
    <div className="rounded-2xl border-2 border-dashed border-border bg-muted/20 p-8 text-center">
      <Database className="mx-auto size-10 text-muted-foreground" aria-hidden />
      <p className="mt-3 text-xl font-bold text-foreground">{label}</p>
      <p className="mt-2 text-lg leading-snug text-muted-foreground">
        Aún no hay datos — ejecutá el SQL y agregá actividades.
      </p>
      <p className="mt-2 text-base text-muted-foreground">
        Corré <code className="rounded bg-muted px-2 py-1 text-sm">supabase/schema.sql</code> y{" "}
        <code className="rounded bg-muted px-2 py-1 text-sm">supabase/migrations/extracciones_pendientes.sql</code>{" "}
        en Supabase → SQL Editor.
      </p>
    </div>
  );
}

// ---------- component ----------

function DbView() {
  const { actividades, sugerencias, extracciones, supabaseConfigured, missingEnv } =
    Route.useLoaderData();
  const router = useRouter();
  const [refreshing, setRefreshing] = useState(false);

  const handleRefresh = async () => {
    setRefreshing(true);
    try {
      await router.invalidate();
    } finally {
      setRefreshing(false);
    }
  };

  // Normalize sugerencias for display (handles both creado_en / created_at and revisado / estado)
  const sugerenciasNorm = (sugerencias as Array<Record<string, unknown>>).map((r) => {
    const creado = (r["creado_en"] as string) ?? (r["created_at"] as string) ?? (r["creadoEn"] as string) ?? "";
    const estadoRaw = (r["estado"] as string) ?? null;
    const revisado = r["revisado"] as boolean | null | undefined;
    const estado =
      estadoRaw ??
      (revisado === true ? "revisado" : revisado === false ? "pendiente" : "pendiente");
    return {
      id: String(r["id"] ?? ""),
      tipo: String(r["tipo"] ?? "sugerencia"),
      nombre: (r["nombre"] as string) ?? null,
      contacto: (r["contacto"] as string) ?? null,
      mensaje: String(r["mensaje"] ?? ""),
      estado,
      created_at: creado,
    };
  });

  const extraccionesNorm = (extracciones as Array<Record<string, unknown>>).map((r) => ({
    id: String(r["id"] ?? ""),
    confidence: Number(r["confidence"] ?? 0),
    provider: String(r["provider"] ?? "—"),
    status: String(r["status"] ?? "—"),
    raw_json: r["raw_json"],
    created_at: String(r["created_at"] ?? r["creado_en"] ?? ""),
    warnings: (r["warnings"] as string[] | null) ?? null,
    image_url: (r["image_url"] as string | null) ?? null,
  }));

  return (
    <div className="flex min-h-dvh flex-col bg-background">
      {/* Header azul Ciudad Viva Mayor */}
      <header className="sticky top-0 z-10 flex items-center justify-between bg-[#1E6CB4] px-4 py-3 shadow-sm">
        <div className="flex items-center gap-3">
          <div className="flex size-11 shrink-0 items-center justify-center rounded-full bg-white shadow-sm">
            <Database className="size-6 text-[#1E6CB4]" aria-hidden />
          </div>
          <span className="text-xl font-extrabold leading-none tracking-tight text-white">Ciudad Viva Mayor</span>
        </div>
        <Link
          to="/"
          className="inline-flex min-h-14 items-center gap-2 rounded-xl px-3 py-2 text-base font-bold text-white transition-colors hover:bg-white/10 focus-visible:outline-4 focus-visible:outline-offset-2 focus-visible:outline-white"
        >
          <ArrowLeft className="size-5" aria-hidden />
          Inicio
        </Link>
      </header>

      <main className="mx-auto flex w-full max-w-6xl flex-1 flex-col px-4 pb-10">
        {/* Título + refresh */}
        <div className="flex flex-col gap-4 py-6 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-3xl font-extrabold leading-tight text-[#5D4037] sm:text-4xl">
              Datos en la base
            </h1>
            <p className="mt-2 text-lg leading-snug text-muted-foreground">
              Vista de inspección — datos reales de Supabase (solo lectura).
            </p>
          </div>
          <Button
            type="button"
            onClick={handleRefresh}
            disabled={refreshing}
            aria-live="polite"
            className="min-h-14 rounded-xl bg-[#1E6CB4] px-6 text-lg font-bold text-white hover:bg-[#164F8A] focus-visible:outline-4 focus-visible:outline-offset-2 focus-visible:outline-[#1E6CB4]"
          >
            <RefreshCw className={`size-5 ${refreshing ? "animate-spin" : ""}`} aria-hidden />
            {refreshing ? "Actualizando…" : "Actualizar"}
          </Button>
        </div>

        {/* Contadores */}
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          <Card className="border-2">
            <CardHeader className="pb-2">
              <CardTitle className="flex items-center gap-2 text-xl">
                <Calendar className="size-5 text-[#1E6CB4]" aria-hidden />
                Actividades
              </CardTitle>
              <CardDescription className="text-base">Tabla public.actividades</CardDescription>
            </CardHeader>
            <CardContent>
              <p className="text-4xl font-extrabold text-foreground" aria-label={`${actividades.length} actividades`}>
                {actividades.length}
              </p>
              <p className="text-base text-muted-foreground">filas</p>
            </CardContent>
          </Card>
          <Card className="border-2">
            <CardHeader className="pb-2">
              <CardTitle className="flex items-center gap-2 text-xl">
                <ClipboardList className="size-5 text-[#F57C00]" aria-hidden />
                Sugerencias
              </CardTitle>
              <CardDescription className="text-base">Tabla public.sugerencias</CardDescription>
            </CardHeader>
            <CardContent>
              <p className="text-4xl font-extrabold text-foreground" aria-label={`${sugerencias.length} sugerencias`}>
                {sugerencias.length}
              </p>
              <p className="text-base text-muted-foreground">filas</p>
            </CardContent>
          </Card>
          <Card className="border-2">
            <CardHeader className="pb-2">
              <CardTitle className="flex items-center gap-2 text-xl">
                <Sparkles className="size-5 text-[#1B7A3D]" aria-hidden />
                Extracciones
              </CardTitle>
              <CardDescription className="text-base">Tabla public.extracciones_pendientes</CardDescription>
            </CardHeader>
            <CardContent>
              <p className="text-4xl font-extrabold text-foreground" aria-label={`${extracciones.length} extracciones`}>
                {extracciones.length}
              </p>
              <p className="text-base text-muted-foreground">filas (HITL queue)</p>
            </CardContent>
          </Card>
        </div>

        {/* Warning Supabase no configurado */}
        {!supabaseConfigured && (
          <Card className="mt-6 border-amber-400 bg-amber-50 shadow-sm">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-xl text-amber-900">
                <AlertTriangle className="size-6 text-amber-600" aria-hidden />
                Supabase no configurado
              </CardTitle>
              <CardDescription className="text-base text-amber-800">
                Faltan variables de entorno en el servidor. La vista está mostrando datos mock o vacíos.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-3 text-lg leading-snug text-amber-900">
              <p>
                {missingEnv.length > 0 ? (
                  <>
                    Faltan: <code className="rounded bg-amber-100 px-2 py-0.5 font-mono text-base">{missingEnv.join(", ")}</code>
                  </>
                ) : (
                  <>Faltan variables <code className="rounded bg-amber-100 px-2 py-0.5">SB_URL / SB_PUBLISHABLE_KEY / SB_SECRET_KEY</code></>
                )}
              </p>
              <Separator className="bg-amber-200" />
              <ol className="list-inside list-decimal space-y-2 text-lg">
                <li>
                  Copiá <code className="rounded bg-white px-2 py-1 font-mono text-base">.env.example</code> a{" "}
                  <code className="rounded bg-white px-2 py-1 font-mono text-base">.env</code> y completá con tus credenciales de
                  Supabase Dashboard → Project Settings → API.
                </li>
                <li>
                  Nunca uses prefijo <code className="rounded bg-white px-1">VITE_</code> — este proyecto usa{" "}
                  <code className="rounded bg-white px-1">SB_*</code> solo en servidor (server functions).
                </li>
                <li>
                  Ejecutá en Supabase → SQL Editor:
                  <ul className="mt-2 list-disc space-y-1 pl-6 text-base">
                    <li>
                      <code className="rounded bg-white px-2 py-1 font-mono text-sm">supabase/schema.sql</code> (tablas actividades +
                      sugerencias + seed)
                    </li>
                    <li>
                      <code className="rounded bg-white px-2 py-1 font-mono text-sm">
                        supabase/migrations/extracciones_pendientes.sql
                      </code>{" "}
                      (cola HITL para el extractor Groq)
                    </li>
                  </ul>
                </li>
                <li>
                  Reiniciá el dev server: <code className="rounded bg-white px-2 py-1 font-mono text-sm">bun run dev</code>
                </li>
              </ol>
              <p className="text-base text-amber-800">
                Mientras tanto, las actividades usan datos mock locales y las otras tablas aparecen vacías.
              </p>
            </CardContent>
          </Card>
        )}

        {/* Tabs */}
        <Tabs defaultValue="actividades" className="mt-6">
          <TabsList className="h-auto w-full justify-start gap-1 overflow-x-auto bg-muted p-1.5">
            <TabsTrigger
              value="actividades"
              className="min-h-11 rounded-lg px-4 text-lg font-bold data-[state=active]:bg-white data-[state=active]:text-[#1E6CB4] data-[state=active]:shadow-sm focus-visible:outline-4 focus-visible:outline-offset-2 focus-visible:outline-ring"
            >
              Actividades
              <span className="ml-2 rounded-full bg-muted px-2.5 py-0.5 text-sm font-bold">{actividades.length}</span>
            </TabsTrigger>
            <TabsTrigger
              value="sugerencias"
              className="min-h-11 rounded-lg px-4 text-lg font-bold data-[state=active]:bg-white data-[state=active]:text-[#1E6CB4] data-[state=active]:shadow-sm focus-visible:outline-4 focus-visible:outline-offset-2 focus-visible:outline-ring"
            >
              Sugerencias
              <span className="ml-2 rounded-full bg-muted px-2.5 py-0.5 text-sm font-bold">{sugerencias.length}</span>
            </TabsTrigger>
            <TabsTrigger
              value="extracciones"
              className="min-h-11 rounded-lg px-4 text-lg font-bold data-[state=active]:bg-white data-[state=active]:text-[#1E6CB4] data-[state=active]:shadow-sm focus-visible:outline-4 focus-visible:outline-offset-2 focus-visible:outline-ring"
            >
              Extracciones
              <span className="ml-2 rounded-full bg-muted px-2.5 py-0.5 text-sm font-bold">{extracciones.length}</span>
            </TabsTrigger>
          </TabsList>

          {/* Actividades */}
          <TabsContent value="actividades" className="mt-4 focus-visible:outline-none">
            <Card className="border-2">
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-2xl">
                  <MapPin className="size-6 text-[#1E6CB4]" aria-hidden />
                  Actividades
                </CardTitle>
                <CardDescription className="text-lg">
                  {actividades.length} {actividades.length === 1 ? "fila" : "filas"} — incluye id, nombre, categoría, fecha, lugar,
                  gratuito, estado y distancia.
                </CardDescription>
              </CardHeader>
              <CardContent>
                {actividades.length === 0 ? (
                  <EmptyState label="No hay actividades" />
                ) : (
                  <div className="rounded-xl border">
                    <Table>
                      <TableHeader>
                        <TableRow className="bg-muted/50">
                          <TableHead className="min-w-32 text-base font-bold">ID</TableHead>
                          <TableHead className="min-w-48 text-base font-bold">Nombre</TableHead>
                          <TableHead className="text-base font-bold">Categoría</TableHead>
                          <TableHead className="text-base font-bold">Fecha</TableHead>
                          <TableHead className="text-base font-bold">Lugar</TableHead>
                          <TableHead className="text-base font-bold">Gratuito</TableHead>
                          <TableHead className="text-base font-bold">Estado</TableHead>
                          <TableHead className="text-base font-bold">Distancia</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {actividades.map((a) => (
                          <TableRow key={a.id} className="text-[15px]">
                            <TableCell className="font-mono text-sm font-medium">{a.id}</TableCell>
                            <TableCell className="max-w-64 font-bold leading-tight text-foreground">
                              <Link
                                to="/actividad/$id"
                                params={{ id: a.id }}
                                className="underline-offset-4 hover:underline focus-visible:outline-4 focus-visible:outline-offset-2 focus-visible:outline-primary"
                              >
                                {a.nombre}
                              </Link>
                              <span className="mt-1 block max-w-64 truncate text-sm font-normal text-muted-foreground">
                                {truncate(a.descripcion, 60)}
                              </span>
                            </TableCell>
                            <TableCell>
                              <Badge variant="secondary" className="text-sm">
                                {a.categoria}
                              </Badge>
                            </TableCell>
                            <TableCell className="whitespace-nowrap text-base">
                              {formatearFecha(a.fecha)}{" "}
                              <span className="text-muted-foreground">· {a.hora.slice(0, 5)}</span>
                            </TableCell>
                            <TableCell className="max-w-40 truncate text-base">{a.lugar}</TableCell>
                            <TableCell>
                              {a.gratuito ? (
                                <Badge className="bg-[#1B7A3D] text-white hover:bg-[#1B7A3D] border-transparent text-sm">Gratuito</Badge>
                              ) : (
                                <Badge variant="outline" className="text-sm">
                                  {a.precio ?? "De pago"}
                                </Badge>
                              )}
                            </TableCell>
                            <TableCell>
                              <EstadoBadge estado={a.estado} />
                            </TableCell>
                            <TableCell className="whitespace-nowrap text-base">{formatearDistancia(a.distanciaMetros)}</TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                )}
                {/* Cards fallback for mobile */}
                {actividades.length > 0 && (
                  <ul className="mt-4 grid gap-3 sm:hidden" aria-label="Actividades en formato tarjetas">
                    {actividades.map((a) => (
                      <li key={`card-${a.id}`}>
                        <Card className="border">
                          <CardContent className="p-4">
                            <div className="flex flex-wrap items-center gap-2">
                              <EstadoBadge estado={a.estado} />
                              <Badge variant="secondary">{a.categoria}</Badge>
                              {a.gratuito ? (
                                <Badge className="bg-[#1B7A3D] text-white">Gratuito</Badge>
                              ) : (
                                <Badge variant="outline">{a.precio}</Badge>
                              )}
                            </div>
                            <p className="mt-2 text-lg font-extrabold leading-tight text-foreground">{a.nombre}</p>
                            <p className="text-base text-muted-foreground">
                              {formatearFecha(a.fecha)} · {a.hora.slice(0, 5)} — {a.lugar}
                            </p>
                            <p className="text-base text-muted-foreground">A {formatearDistancia(a.distanciaMetros)}</p>
                          </CardContent>
                        </Card>
                      </li>
                    ))}
                  </ul>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* Sugerencias */}
          <TabsContent value="sugerencias" className="mt-4 focus-visible:outline-none">
            <Card className="border-2">
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-2xl">
                  <ClipboardList className="size-6 text-[#F57C00]" aria-hidden />
                  Sugerencias
                </CardTitle>
                <CardDescription className="text-lg">
                  {sugerenciasNorm.length} {sugerenciasNorm.length === 1 ? "fila" : "filas"} — tipo, nombre, mensaje, contacto, fecha y
                  estado.
                </CardDescription>
              </CardHeader>
              <CardContent>
                {sugerenciasNorm.length === 0 ? (
                  <EmptyState label="No hay sugerencias" />
                ) : (
                  <div className="rounded-xl border">
                    <Table>
                      <TableHeader>
                        <TableRow className="bg-muted/50">
                          <TableHead className="text-base font-bold">Tipo</TableHead>
                          <TableHead className="text-base font-bold">Nombre</TableHead>
                          <TableHead className="min-w-64 text-base font-bold">Mensaje</TableHead>
                          <TableHead className="text-base font-bold">Contacto</TableHead>
                          <TableHead className="text-base font-bold">Fecha</TableHead>
                          <TableHead className="text-base font-bold">Estado</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {sugerenciasNorm.map((s) => (
                          <TableRow key={s.id} className="text-[15px]">
                            <TableCell>
                              <TipoSugerenciaBadge tipo={s.tipo} />
                            </TableCell>
                            <TableCell className="whitespace-nowrap text-base font-medium">{s.nombre ?? "—"}</TableCell>
                            <TableCell className="max-w-80" title={s.mensaje}>
                              <span className="line-clamp-2 text-base leading-snug">{truncate(s.mensaje, 120)}</span>
                              <span className="font-mono text-xs text-muted-foreground">{s.id.slice(0, 8)}…</span>
                            </TableCell>
                            <TableCell className="whitespace-nowrap text-base">{s.contacto ?? "—"}</TableCell>
                            <TableCell className="whitespace-nowrap text-base">{formatDateTime(s.created_at)}</TableCell>
                            <TableCell>
                              {s.estado === "revisado" || s.estado === "aprobada" ? (
                                <Badge className="bg-green-600 text-white border-transparent">revisado</Badge>
                              ) : s.estado === "rechazada" ? (
                                <Badge variant="destructive">rechazada</Badge>
                              ) : (
                                <Badge className="bg-amber-500 text-white border-transparent">pendiente</Badge>
                              )}
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* Extracciones */}
          <TabsContent value="extracciones" className="mt-4 focus-visible:outline-none">
            <Card className="border-2">
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-2xl">
                  <Braces className="size-6 text-[#1B7A3D]" aria-hidden />
                  Extracciones pendientes
                </CardTitle>
                <CardDescription className="text-lg">
                  {extraccionesNorm.length} {extraccionesNorm.length === 1 ? "fila" : "filas"} — cola HITL del extractor Groq.
                  Confidence &lt; 0.85 requiere revisión humana.
                </CardDescription>
              </CardHeader>
              <CardContent>
                {extraccionesNorm.length === 0 ? (
                  <EmptyState label="No hay extracciones pendientes" />
                ) : (
                  <div className="rounded-xl border">
                    <Table>
                      <TableHeader>
                        <TableRow className="bg-muted/50">
                          <TableHead className="text-base font-bold">Confidence</TableHead>
                          <TableHead className="text-base font-bold">Provider</TableHead>
                          <TableHead className="text-base font-bold">Status</TableHead>
                          <TableHead className="min-w-64 text-base font-bold">raw_json preview</TableHead>
                          <TableHead className="text-base font-bold">Fecha</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {extraccionesNorm.map((e) => {
                          const conf = e.confidence;
                          const confColor =
                            conf >= 0.85
                              ? "bg-green-600 text-white border-transparent"
                              : conf >= 0.6
                                ? "bg-amber-500 text-white border-transparent"
                                : "bg-destructive text-destructive-foreground";
                          const preview = e.raw_json ? JSON.stringify(e.raw_json) : "—";
                          return (
                            <TableRow key={e.id} className="text-[15px]">
                              <TableCell>
                                <Badge className={`${confColor} font-mono text-sm`}>{conf.toFixed(2)}</Badge>
                                {e.warnings && e.warnings.length > 0 && (
                                  <span className="ml-2 text-amber-600" title={e.warnings.join("; ")}>
                                    <AlertTriangle className="inline size-4" aria-hidden />
                                  </span>
                                )}
                              </TableCell>
                              <TableCell>
                                <Badge variant="outline" className="font-mono text-sm">
                                  {e.provider}
                                </Badge>
                              </TableCell>
                              <TableCell>
                                {e.status === "pendiente" ? (
                                  <Badge className="bg-amber-500 text-white border-transparent">pendiente</Badge>
                                ) : e.status === "aprobada" ? (
                                  <Badge className="bg-green-600 text-white border-transparent">aprobada</Badge>
                                ) : e.status === "rechazada" ? (
                                  <Badge variant="destructive">rechazada</Badge>
                                ) : (
                                  <Badge variant="secondary">{e.status}</Badge>
                                )}
                              </TableCell>
                              <TableCell className="max-w-96" title={preview}>
                                <code className="block max-h-20 overflow-auto whitespace-pre-wrap break-all rounded bg-muted p-2 font-mono text-xs leading-snug">
                                  {truncate(preview, 220)}
                                </code>
                                {e.image_url && (
                                  <a
                                    href={e.image_url}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="mt-1 inline-block text-sm font-bold text-[#1E6CB4] underline-offset-4 hover:underline focus-visible:outline-4 focus-visible:outline-offset-2 focus-visible:outline-[#1E6CB4]"
                                  >
                                    Ver imagen
                                  </a>
                                )}
                              </TableCell>
                              <TableCell className="whitespace-nowrap text-base">{formatDateTime(e.created_at)}</TableCell>
                            </TableRow>
                          );
                        })}
                      </TableBody>
                    </Table>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>

        <Separator className="mt-8" />

        <div className="mt-6 flex flex-wrap items-center justify-between gap-3">
          <p className="text-base text-muted-foreground">
            Datos leídos vía server functions (getAdminClient / getPublicClient) — SB_SECRET_KEY nunca sale del servidor.
          </p>
          <Link
            to="/"
            className="inline-flex min-h-14 items-center justify-center gap-2 rounded-xl border-2 border-border bg-card px-6 text-lg font-bold text-card-foreground hover:bg-accent focus-visible:outline-4 focus-visible:outline-offset-2 focus-visible:outline-ring"
          >
            <ArrowLeft className="size-5" aria-hidden />
            Volver al inicio
          </Link>
        </div>
      </main>

      {/* Footer */}
      <footer className="mt-auto bg-[#263238] px-4 py-4">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-3 text-sm text-white/80">
          <span>Ciudad Viva Mayor — vista /db · solo lectura</span>
          <span className="font-mono text-xs">Supabase: public.actividades · public.sugerencias · public.extracciones_pendientes</span>
        </div>
      </footer>
    </div>
  );
}
