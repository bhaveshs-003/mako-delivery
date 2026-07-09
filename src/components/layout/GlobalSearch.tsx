"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Search, FolderKanban, Ticket } from "lucide-react";
import { apiFetch } from "@/lib/http";

type Results = {
  projects: { id: string; title: string; type: string }[];
  tickets: { id: string; title: string; status: string }[];
};

export function GlobalSearch() {
  const router = useRouter();
  const [q, setQ] = useState("");
  const [results, setResults] = useState<Results | null>(null);
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (q.trim().length < 2) {
      setResults(null);
      return;
    }
    const t = setTimeout(() => {
      apiFetch<Results>(`/api/search?q=${encodeURIComponent(q)}`)
        .then((r) => { setResults(r); setOpen(true); })
        .catch(() => {});
    }, 250);
    return () => clearTimeout(t);
  }, [q]);

  useEffect(() => {
    function onClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, []);

  function go(path: string) {
    setOpen(false);
    setQ("");
    router.push(path);
  }

  const hasResults = results && (results.projects.length > 0 || results.tickets.length > 0);

  return (
    <div ref={ref} className="relative hidden md:block">
      <Search className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate" />
      <input
        type="search"
        value={q}
        onChange={(e) => setQ(e.target.value)}
        onFocus={() => results && setOpen(true)}
        placeholder="Search projects, tickets…"
        className="h-9 w-64 rounded-md border border-border bg-bg pl-8 pr-3 text-sm text-navy placeholder:text-slate focus:border-border-strong focus:outline-none"
      />
      {open && results && (
        <div className="absolute right-0 top-11 z-50 w-80 overflow-hidden rounded-md border border-border bg-surface shadow-lg">
          {!hasResults ? (
            <p className="px-4 py-3 text-sm text-slate">No results.</p>
          ) : (
            <>
              {results.projects.length > 0 && (
                <div>
                  <p className="border-b border-border bg-bg px-3 py-1.5 text-xs font-medium uppercase text-slate">Projects</p>
                  {results.projects.map((p) => (
                    <button key={p.id} onClick={() => go(`/projects/${p.id}`)} className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm hover:bg-bg">
                      <FolderKanban className="h-4 w-4 text-slate" />
                      <span className="truncate text-navy">{p.title}</span>
                    </button>
                  ))}
                </div>
              )}
              {results.tickets.length > 0 && (
                <div>
                  <p className="border-b border-border bg-bg px-3 py-1.5 text-xs font-medium uppercase text-slate">Tickets</p>
                  {results.tickets.map((t) => (
                    <button key={t.id} onClick={() => go(`/tickets`)} className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm hover:bg-bg">
                      <Ticket className="h-4 w-4 text-slate" />
                      <span className="truncate text-navy">{t.title}</span>
                    </button>
                  ))}
                </div>
              )}
            </>
          )}
        </div>
      )}
    </div>
  );
}
