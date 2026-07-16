"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { CalendarRange } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input, Field } from "@/components/ui/form-field";
import { toast } from "@/components/ui/toast";
import { apiFetch } from "@/lib/http";

const dayCount = (a: string, b: string) =>
  a && b ? Math.max(0, Math.round((+new Date(b) - +new Date(a)) / 86400000)) : null;

/**
 * Declare the project timeline (RL proposed + Mako promised date ranges). This
 * lives in the Scope Understanding tab — the timeline is set as part of scoping,
 * not during day-to-day project management. Milestone dates are allocated within it.
 */
export function ProjectTimelineForm({
  projectId,
  initial,
  canEdit,
}: {
  projectId: string;
  initial: { rlStart: string; rlEnd: string; makoStart: string; makoEnd: string };
  canEdit: boolean;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [rlStart, setRlStart] = useState(initial.rlStart);
  const [rlEnd, setRlEnd] = useState(initial.rlEnd);
  const [makoStart, setMakoStart] = useState(initial.makoStart);
  const [makoEnd, setMakoEnd] = useState(initial.makoEnd);

  const rlDays = dayCount(rlStart, rlEnd);
  const makoDays = dayCount(makoStart, makoEnd);
  const dirty =
    rlStart !== initial.rlStart || rlEnd !== initial.rlEnd ||
    makoStart !== initial.makoStart || makoEnd !== initial.makoEnd;

  async function save() {
    setBusy(true);
    try {
      await apiFetch(`/api/projects/${projectId}`, {
        method: "PATCH",
        body: JSON.stringify({
          action: "edit",
          rlStartDate: rlStart || null,
          rlCommittedDeadline: rlEnd || null,
          makoStartDate: makoStart || null,
          makoInternalDeadline: makoEnd || null,
        }),
      });
      toast.success("Timeline saved");
      router.refresh();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to save timeline");
    } finally {
      setBusy(false);
    }
  }

  const readOnly = !canEdit;

  return (
    <div className="space-y-3">
      <div className="grid gap-3 sm:grid-cols-2">
        {/* RL timeline */}
        <div className="rounded-lg border border-line bg-surface-2/40 p-3">
          <div className="mb-2 flex items-center justify-between">
            <p className="text-xs font-semibold uppercase tracking-wide text-muted">RL Proposed</p>
            {rlDays !== null && <span className="tabular text-2xs font-medium text-brand-ink">{rlDays} days</span>}
          </div>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Start">
              <Input type="date" value={rlStart} max={rlEnd || undefined} disabled={readOnly} onChange={(e) => setRlStart(e.target.value)} />
            </Field>
            <Field label="End (committed)">
              <Input type="date" value={rlEnd} min={rlStart || undefined} disabled={readOnly} onChange={(e) => setRlEnd(e.target.value)} />
            </Field>
          </div>
        </div>

        {/* Mako timeline */}
        <div className="rounded-lg border border-line bg-surface-2/40 p-3">
          <div className="mb-2 flex items-center justify-between">
            <p className="text-xs font-semibold uppercase tracking-wide text-muted">Mako Promised</p>
            {makoDays !== null && <span className="tabular text-2xs font-medium text-brand-ink">{makoDays} days</span>}
          </div>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Start">
              <Input type="date" value={makoStart} max={makoEnd || undefined} disabled={readOnly} onChange={(e) => setMakoStart(e.target.value)} />
            </Field>
            <Field label="End (promised)">
              <Input type="date" value={makoEnd} min={makoStart || undefined} disabled={readOnly} onChange={(e) => setMakoEnd(e.target.value)} />
            </Field>
          </div>
        </div>
      </div>

      {canEdit && (
        <div className="flex items-center justify-between">
          <p className="flex items-center gap-1.5 text-2xs text-muted">
            <CalendarRange className="h-3.5 w-3.5" /> Milestone dates are allocated within the Mako timeline.
          </p>
          <Button size="sm" onClick={save} disabled={busy || !dirty}>
            {busy ? "Saving…" : "Save timeline"}
          </Button>
        </div>
      )}
    </div>
  );
}
