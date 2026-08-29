import type { ReactNode } from "react";
import { Link } from "@tanstack/react-router";
import { Home, Phone, Settings, Users } from "lucide-react";

export function AppHeader() {
  return (
    <header className="sticky top-0 z-10 flex items-center justify-between bg-[#1E6CB4] px-4 py-3 shadow-sm">
      <div className="flex items-center gap-3">
        <div className="flex size-11 shrink-0 items-center justify-center rounded-full bg-[#FFECB3] shadow-sm ring-2 ring-white/15">
          <Users className="size-6 text-[#5D4037]" aria-hidden />
        </div>
        <span className="text-xl font-extrabold leading-none tracking-tight text-white">
          Ciudad Viva Mayor
        </span>
      </div>

      <button
        type="button"
        aria-label="Ajustes"
        className="flex flex-col items-center gap-0.5 rounded-xl px-2 py-1 text-white transition-colors hover:bg-white/10 focus-visible:outline-4 focus-visible:outline-offset-2 focus-visible:outline-white"
      >
        <Settings className="size-7" aria-hidden />
        <span className="text-xs font-semibold leading-none">Ajustes</span>
      </button>
    </header>
  );
}

export function AppFooter() {
  return (
    <footer className="bg-[#263238] px-4 py-4">
      <div className="mx-auto flex max-w-2xl justify-center gap-3">
        <Link
          to="/"
          className="flex min-h-14 flex-1 items-center justify-center gap-2 rounded-xl bg-[#EF6C00] px-6 py-3 text-sm font-extrabold leading-tight text-white shadow-sm transition-colors hover:bg-[#E65100] active:bg-[#BF360C] focus-visible:outline-4 focus-visible:outline-offset-2 focus-visible:outline-white"
        >
          <Home className="size-5 shrink-0" aria-hidden />
          <span>VOLVER A INICIO</span>
        </Link>
        <button
          type="button"
          className="flex min-h-14 flex-1 items-center justify-center gap-2 rounded-xl bg-[#C62828] px-6 py-3 text-sm font-extrabold leading-tight text-white shadow-sm transition-colors hover:bg-[#B71C1C] active:bg-[#8E1A1A] focus-visible:outline-4 focus-visible:outline-offset-2 focus-visible:outline-white"
        >
          <Phone className="size-5 shrink-0" aria-hidden />
          <span>AYUDA DIRECTA</span>
        </button>
      </div>
    </footer>
  );
}

export function AppShell({ children }: { children: ReactNode }) {
  return (
    <div className="flex min-h-dvh flex-col bg-background">
      <AppHeader />
      <main className="mx-auto flex w-full max-w-2xl flex-1 flex-col px-4 pb-6">
        {children}
      </main>
      <AppFooter />
    </div>
  );
}
