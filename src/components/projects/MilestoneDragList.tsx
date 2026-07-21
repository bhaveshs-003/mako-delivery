"use client";

import { useState, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { GripVertical } from "lucide-react";
import { toast } from "@/components/ui/toast";
import { apiFetch } from "@/lib/http";

/**
 * Renders the milestone cards and, when enabled, lets the PM reorder them by
 * dragging. On drop the full order is persisted and the server view refreshes.
 */
export function MilestoneDragList({
  projectId,
  items,
  enabled,
}: {
  projectId: string;
  items: { id: string; node: ReactNode }[];
  enabled: boolean;
}) {
  const router = useRouter();
  const [order, setOrder] = useState<string[]>(items.map((i) => i.id));
  const [dragId, setDragId] = useState<string | null>(null);
  const [overId, setOverId] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const nodeById = new Map(items.map((i) => [i.id, i.node]));

  async function persist(next: string[]) {
    setBusy(true);
    try {
      await apiFetch(`/api/projects/${projectId}/milestone-order`, {
        method: "POST",
        body: JSON.stringify({ orderedIds: next }),
      });
      router.refresh();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to reorder");
      setOrder(items.map((i) => i.id));
    } finally {
      setBusy(false);
    }
  }

  function drop(targetId: string) {
    setOverId(null);
    if (!dragId || dragId === targetId) return;
    const next = [...order];
    next.splice(next.indexOf(targetId), 0, ...next.splice(next.indexOf(dragId), 1));
    setOrder(next);
    persist(next);
  }

  return (
    <ol className="space-y-2">
      {order.map((id) => (
        <li
          key={id}
          draggable={enabled && !busy}
          onDragStart={() => setDragId(id)}
          onDragOver={(e) => {
            if (!enabled) return;
            e.preventDefault();
            setOverId(id);
          }}
          onDrop={() => drop(id)}
          onDragEnd={() => {
            setDragId(null);
            setOverId(null);
          }}
          className={`flex items-stretch gap-1.5 rounded-lg transition-all ${
            dragId === id ? "opacity-40" : ""
          } ${overId === id && dragId !== id ? "ring-2 ring-brand/40" : ""}`}
        >
          {enabled && (
            <span
              className="flex w-5 shrink-0 cursor-grab items-center justify-center text-muted hover:text-ink active:cursor-grabbing"
              title="Drag to reorder"
            >
              <GripVertical className="h-4 w-4" />
            </span>
          )}
          <div className="min-w-0 flex-1">{nodeById.get(id)}</div>
        </li>
      ))}
    </ol>
  );
}
