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
import { cn } from "@/lib/utils";

type Person = { id: string; name: string };
type SubtaskDraft = { title: string; assignedToId: string; days: string };

export function EditMilestoneForm({
  milestoneId,
  resources,
  initial,
  initialSubtasks,
}: {
  milestoneId: string;
  resources: Person[];
  initial: {
    name: string;
    description: string;
    ownerId: string;
    allocatedDays: string;
    dueDate: string;
  };
  initialSubtasks: SubtaskDraft[];
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [name, setName] = useState(initial.name);
  const [description, setDescription] = useState(initial.description);
  const [ownerId, setOwnerId] = useState(initial.ownerId);
  const [days, setDays] = useState(initial.allocatedDays);
  const [dueDate, setDueDate] = useState(initial.dueDate);
  const [subtasks, setSubtasks] = useState<SubtaskDraft[]>(initialSubtasks);

  const milestoneDays = Number(days) || 0;
  const subUsed = subtasks.reduce((s, t) => s + (Number(t.days) || 0), 0);
  const overMilestone = milestoneDays > 0 && subUsed > milestoneDays;
  const valid = name.trim() && !overMilestone && subtasks.every((s) => s.title.trim());

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
          allocatedDays: days === "" ? null : Number(days),
          dueDate: dueDate || null,
          subtasks: subtasks
            .filter((s) => s.title.trim())
            .map((s) => ({
              title: s.title,
              assignedToId: s.assignedToId || null,
              allocatedDays: s.days === "" ? null : Number(s.days),
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
            <div className="grid grid-cols-2 gap-4">
              <Field label="Assign to (resource)">
                <Select value={ownerId} onChange={(e) => setOwnerId(e.target.value)}>
                  <option value="">— Unassigned —</option>
                  {resources.map((r) => (
                    <option key={r.id} value={r.id}>{r.name}</option>
                  ))}
                </Select>
              </Field>
              <Field label="Allocated Days">
                <Input type="number" min={0} value={days} onChange={(e) => setDays(e.target.value)} />
              </Field>
            </div>
            <Field label="Due Date">
              <Input type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)} />
            </Field>

            {/* Subtasks */}
            <div className="rounded-lg border border-line bg-surface-2/40 p-3">
              <div className="flex items-center justify-between">
                <p className="text-xs font-semibold uppercase tracking-wide text-muted">Subtasks</p>
                {milestoneDays > 0 && (
                  <span className={cn("text-2xs font-medium", overMilestone ? "text-danger" : "text-muted")}>
                    {subUsed} / {milestoneDays} milestone days
                  </span>
                )}
              </div>
              <div className="mt-2 space-y-2">
                {subtasks.map((s, i) => (
                  <div key={i} className="flex items-center gap-2">
                    <Input className="flex-1" placeholder="Subtask title" value={s.title} onChange={(e) => updateSub(i, { title: e.target.value })} />
                    <Select className="w-36" value={s.assignedToId} onChange={(e) => updateSub(i, { assignedToId: e.target.value })}>
                      <option value="">Unassigned</option>
                      {resources.map((r) => (
                        <option key={r.id} value={r.id}>{r.name}</option>
                      ))}
                    </Select>
                    <Input type="number" min={0} className="w-16" placeholder="days" value={s.days} onChange={(e) => updateSub(i, { days: e.target.value })} />
                    <button type="button" onClick={() => setSubtasks((rows) => rows.filter((_, j) => j !== i))} className="text-muted hover:text-danger" title="Remove">
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                ))}
                {subtasks.length === 0 && (
                  <p className="text-2xs text-muted">No subtasks.</p>
                )}
              </div>
              <button type="button" onClick={() => setSubtasks((rows) => [...rows, { title: "", assignedToId: "", days: "" }])} className="mt-2 inline-flex items-center gap-1 text-xs font-medium text-brand hover:underline">
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
