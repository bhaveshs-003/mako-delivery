"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Pencil, Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Input, Textarea, Select, Field } from "@/components/ui/form-field";
import { toast } from "@/components/ui/toast";
import { apiFetch } from "@/lib/http";

type Person = { id: string; name: string };
type SubtaskDraft = { title: string; assignedToId: string; start: string; end: string };

const dayCount = (a: string, b: string) =>
  a && b ? Math.max(0, Math.round((+new Date(b) - +new Date(a)) / 86400000)) : null;

export function EditMilestoneForm({
  milestoneId,
  resources,
  initial,
  initialSubtasks,
  poolTotal = 0,
  poolUsedByOthers = 0,
  timelineStart,
  timelineEnd,
}: {
  milestoneId: string;
  resources: Person[];
  initial: { name: string; description: string; ownerId: string; start: string; end: string };
  initialSubtasks: SubtaskDraft[];
  poolTotal?: number;
  poolUsedByOthers?: number;
  timelineStart?: string | null;
  timelineEnd?: string | null;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [name, setName] = useState(initial.name);
  const [description, setDescription] = useState(initial.description);
  const [ownerId, setOwnerId] = useState(initial.ownerId);
  const [start, setStart] = useState(initial.start);
  const [end, setEnd] = useState(initial.end);
  const [subtasks, setSubtasks] = useState<SubtaskDraft[]>(initialSubtasks);

  const milestoneDays = dayCount(start, end) ?? 0;
  const remaining = Math.max(0, poolTotal - poolUsedByOthers);
  const overPool = poolTotal > 0 && milestoneDays > remaining;
  const rangeOk = !!start && !!end && new Date(end) >= new Date(start);
  const subtasksOk = subtasks.every(
    (s) => s.title.trim() && (!s.start || !s.end || new Date(s.end) >= new Date(s.start))
  );
  const valid = name.trim() && rangeOk && !overPool && subtasksOk;

  function updateSub(i: number, patch: Partial<SubtaskDraft>) {
    setSubtasks((rows) => rows.map((r, j) => (j === i ? { ...r, ...patch } : r)));
  }

  async function save() {
    setBusy(true);
    try {
      await apiFetch(`/api/milestones/${milestoneId}`, {
        method: "PATCH",
        body: JSON.stringify({
          action: "edit",
          name,
          description,
          ownerId: ownerId || null,
          startDate: start || null,
          dueDate: end || null,
          subtasks: subtasks
            .filter((s) => s.title.trim())
            .map((s) => ({
              title: s.title,
              assignedToId: s.assignedToId || null,
              startDate: s.start || null,
              dueDate: s.end || null,
            })),
        }),
      });
      toast.success("Milestone updated");
      setOpen(false);
      router.refresh();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to update");
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <Button size="sm" variant="ghost" onClick={() => setOpen(true)} title="Edit milestone">
        <Pencil className="h-3.5 w-3.5" />
      </Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent size="lg">
          <DialogHeader>
            <DialogTitle>Edit Milestone</DialogTitle>
          </DialogHeader>
          <div className="max-h-[68vh] space-y-4 overflow-y-auto pr-1">
            <Field label="Name" required>
              <Input value={name} onChange={(e) => setName(e.target.value)} />
            </Field>
            <Field label="Description">
              <Textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={2} />
            </Field>
            <Field label="Assign to (resource)">
              <Select value={ownerId} onChange={(e) => setOwnerId(e.target.value)}>
                <option value="">— Unassigned —</option>
                {resources.map((r) => (
                  <option key={r.id} value={r.id}>{r.name}</option>
                ))}
              </Select>
            </Field>
            <div className="grid grid-cols-2 gap-4">
              <Field label="Start date" required>
                <Input type="date" value={start} min={timelineStart ?? undefined} max={end || timelineEnd || undefined} onChange={(e) => setStart(e.target.value)} />
              </Field>
              <Field
                label="End date"
                required
                hint={`${milestoneDays} day${milestoneDays === 1 ? "" : "s"}`}
                error={overPool ? `Only ${remaining} timeline day(s) remain` : undefined}
              >
                <Input type="date" value={end} min={start || timelineStart || undefined} max={timelineEnd ?? undefined} onChange={(e) => setEnd(e.target.value)} className={overPool ? "border-danger" : ""} />
              </Field>
            </div>

            <div className="rounded-lg border border-line bg-surface-2/40 p-3">
              <p className="text-xs font-semibold uppercase tracking-wide text-muted">Subtasks</p>
              <div className="mt-2 space-y-2">
                {subtasks.map((s, i) => (
                  <div key={i} className="flex flex-wrap items-center gap-2">
                    <Input className="min-w-[140px] flex-1" placeholder="Subtask title" value={s.title} onChange={(e) => updateSub(i, { title: e.target.value })} />
                    <Select className="w-32" value={s.assignedToId} onChange={(e) => updateSub(i, { assignedToId: e.target.value })}>
                      <option value="">Unassigned</option>
                      {resources.map((r) => (
                        <option key={r.id} value={r.id}>{r.name}</option>
                      ))}
                    </Select>
                    <Input type="date" className="w-36" value={s.start} min={start || undefined} max={s.end || end || undefined} onChange={(e) => updateSub(i, { start: e.target.value })} />
                    <Input type="date" className="w-36" value={s.end} min={s.start || start || undefined} max={end || undefined} onChange={(e) => updateSub(i, { end: e.target.value })} />
                    <button type="button" onClick={() => setSubtasks((rows) => rows.filter((_, j) => j !== i))} className="text-muted hover:text-danger" title="Remove">
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                ))}
                {subtasks.length === 0 && <p className="text-2xs text-muted">No subtasks.</p>}
              </div>
              <button type="button" onClick={() => setSubtasks((rows) => [...rows, { title: "", assignedToId: "", start: "", end: "" }])} className="mt-2 inline-flex items-center gap-1 text-xs font-medium text-brand hover:underline">
                <Plus className="h-3.5 w-3.5" /> Add subtask
              </button>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
            <Button onClick={save} disabled={!valid || busy}>
              {busy ? "Saving…" : "Save"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
