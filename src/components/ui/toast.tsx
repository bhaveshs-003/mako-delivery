"use client";

import { create } from "zustand";
import { useEffect } from "react";
import { CheckCircle2, XCircle, AlertTriangle, Info, X } from "lucide-react";
import { cn } from "@/lib/utils";

type ToastKind = "success" | "error" | "warning" | "info";
type Toast = { id: number; kind: ToastKind; message: string };

type ToastStore = {
  toasts: Toast[];
  push: (kind: ToastKind, message: string) => void;
  dismiss: (id: number) => void;
};

let counter = 0;

const useToastStore = create<ToastStore>((set) => ({
  toasts: [],
  push: (kind, message) =>
    set((s) => ({ toasts: [...s.toasts, { id: ++counter, kind, message }] })),
  dismiss: (id) => set((s) => ({ toasts: s.toasts.filter((t) => t.id !== id) })),
}));

/** Imperative API usable outside React (e.g. in mutation handlers). */
export const toast = {
  success: (m: string) => useToastStore.getState().push("success", m),
  error: (m: string) => useToastStore.getState().push("error", m),
  warning: (m: string) => useToastStore.getState().push("warning", m),
  info: (m: string) => useToastStore.getState().push("info", m),
};

const CONFIG: Record<ToastKind, { icon: typeof Info; border: string; text: string }> = {
  success: { icon: CheckCircle2, border: "border-l-success", text: "text-success" },
  error: { icon: XCircle, border: "border-l-danger", text: "text-danger" },
  warning: { icon: AlertTriangle, border: "border-l-warning", text: "text-warning" },
  info: { icon: Info, border: "border-l-info", text: "text-info" },
};

function ToastItem({ t }: { t: Toast }) {
  const dismiss = useToastStore((s) => s.dismiss);
  useEffect(() => {
    const timer = setTimeout(() => dismiss(t.id), 5000);
    return () => clearTimeout(timer);
  }, [t.id, dismiss]);

  const { icon: Icon, border, text } = CONFIG[t.kind];
  return (
    <div
      className={cn(
        "flex items-start gap-2.5 rounded-md border border-l-4 border-border bg-surface px-4 py-3 shadow-md",
        border
      )}
    >
      <Icon className={cn("mt-0.5 h-4 w-4 shrink-0", text)} />
      <p className="flex-1 text-sm text-navy">{t.message}</p>
      <button onClick={() => dismiss(t.id)} className="text-slate hover:text-navy">
        <X className="h-4 w-4" />
      </button>
    </div>
  );
}

export function Toaster() {
  const toasts = useToastStore((s) => s.toasts);
  return (
    <div className="pointer-events-none fixed right-4 top-4 z-50 flex w-80 flex-col gap-2">
      {toasts.map((t) => (
        <div key={t.id} className="pointer-events-auto">
          <ToastItem t={t} />
        </div>
      ))}
    </div>
  );
}
