"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { CalendarOff, Plus, Trash2 } from "lucide-react";
import { Input } from "@/components/ui/form-field";
import { Button } from "@/components/ui/button";
import { toast } from "@/components/ui/toast";
import { apiFetch } from "@/lib/http";
import { formatDate } from "@/lib/utils";

/**
 * Manage organisation holidays. Any date here is excluded from working-day
 * counts across all projects' timelines. Org-wide but surfaced in the timeline
 * section since it directly adjusts the days of work.
 */
export function HolidayManager({
  projectId,
  holidays,
  canManage,
}: {
  projectId: string;
  holidays: { id: string; date: string; label: string }[];
  canManage: boolean;
}) {
  const router = useRouter();
  const [date, setDate] = useState("");
  const [label, setLabel] = useState("");
  const [busy, setBusy] = useState(false);

  async function add() {
    if (!date) return;
    setBusy(true);
    try {
      await apiFetch("/api/holidays", {
        method: "POST",
        body: JSON.stringify({ projectId, date, label: label.trim() || "Holiday" }),
      });
      toast.success("Holiday added");
      setDate("");
      setLabel("");
      router.refresh();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to add holiday");
    } finally {
      setBusy(false);
    }
  }

  async function remove(id: string) {
    setBusy(true);
    try {
      await apiFetch(`/api/holidays?id=${id}`, { method: "DELETE" });
      router.refresh();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to remove holiday");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="rounded-lg border border-line bg-surface-2/40 p-3">
      <p className="mb-2 flex items-center gap-1.5 text-2xs font-semibold uppercase tracking-wide text-muted">
        <CalendarOff className="h-3.5 w-3.5" /> Organisation holidays
      </p>

      {holidays.length === 0 ? (
        <p className="text-2xs text-muted">No holidays marked. Days of work exclude weekends only.</p>
      ) : (
        <ul className="space-y-1">
          {holidays.map((h) => (
            <li key={h.id} className="flex items-center justify-between gap-2 rounded-md bg-surface px-2 py-1 text-xs">
              <span className="text-ink-2">
                <span className="tabular font-medium text-ink">{formatDate(new Date(h.date))}</span>
                <span className="ml-2 text-muted">{h.label}</span>
              </span>
              {canManage && (
                <button type="button" onClick={() => remove(h.id)} disabled={busy} className="text-muted hover:text-danger" title="Remove">
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              )}
            </li>
          ))}
        </ul>
      )}

      {canManage && (
        <div className="mt-2 flex flex-wrap items-center gap-2">
          <Input type="date" className="w-40" value={date} onChange={(e) => setDate(e.target.value)} />
          <Input className="min-w-[120px] flex-1" placeholder="Label (e.g. Diwali)" value={label} onChange={(e) => setLabel(e.target.value)} />
          <Button size="sm" variant="outline" onClick={add} disabled={!date || busy}>
            <Plus className="h-3.5 w-3.5" /> Add
          </Button>
        </div>
      )}
    </div>
  );
}
