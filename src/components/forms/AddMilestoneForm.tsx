"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Plus, Trash2, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogTrigger,
  DialogClose,
} from "@/components/ui/dialog";
import { Input, Textarea, Select, Field } from "@/components/ui/form-field";
import { toast } from "@/components/ui/toast";
import { apiFetch } from "@/lib/http";
import { MILESTONE_TYPE_LABELS } from "@/lib/constants";

type Person = { id: string; name: string };
type SubtaskDraft = { title: string; assignedToId: string; start: string; end: string };
type MilestoneType = "main_scope" | "change_request" | "delta_scope";

const dayCount = (a: string, b: string) =>
  a && b ? Math.max(0, Math.round((+new Date(b) - +new Date(a)) / 86400000)) : null;

export function AddMilestoneForm({
  projectId,
  resources,
  totalDays,
  usedDays,
  planApproved,
  changeRequests = [],
  timelineStart,
  timelineEnd,
}: {
  projectId: string;
  resources: Person[];
  totalDays: number;
  usedDays: number;
  planApproved: boolean;
  changeRequests?: { id: string; label: string }[];
  timelineStart?: string | null;
  timelineEnd?: string | null;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);

  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [type, setType] = useState<MilestoneType>(planApproved ? "change_request" : "main_scope");
  const [changeRequestId, setChangeRequestId] = useState("");
  const [ownerId, setOwnerId] = useState("");
  const [start, setStart] = useState("");
  const [end, setEnd] = useState("");
  const [subtasks, setSubtasks] = useState<SubtaskDraft[]>([]);

  const remainingBefore = Math.max(0, totalDays - usedDays);
  const milestoneDays = dayCount(start, end);
  const overProject = milestoneDays != null && milestoneDays > remainingBefore;
  const rangeOk = !!start && !!end && new Date(end) >= new Date(start);
  const subtasksOk = subtasks.every(
    (s) => s.title.trim() && (!s.start || !s.end || new Date(s.end) >= new Date(s.start))
  );
  const valid = name.trim() && rangeOk && !overProject && subtasksOk;

  function reset() {
    setName(""); setDescription(""); setOwnerId(""); setStart(""); setEnd("");
    setType(planApproved ? "change_request" : "main_scope"); setChangeRequestId("");
    setSubtasks([]);
  }

  function updateSub(i: number, patch: Partial<SubtaskDraft>) {
    setSubtasks((rows) => rows.map((r, j) => (j === i ? { ...r, ...patch } : r)));
  }

  async function submit() {
    setBusy(true);
    try {
      await apiFetch("/api/milestones", {
        method: "POST",
        body: JSON.stringify({
          projectId,
          name,
          description: description || undefined,
          type,
          changeRequestId: type !== "main_scope" && changeRequestId ? changeRequestId : null,
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
      toast.success("Milestone added");
      setOpen(false);
      reset();
      router.refresh();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to add milestone");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm" variant="outline">
          <Plus className="h-4 w-4" /> Add Milestone
        </Button>
      </DialogTrigger>
      <DialogContent size="lg">
        <DialogHeader>
          <DialogTitle>Add Milestone</DialogTitle>
        </DialogHeader>

        <div className="max-h-[68vh] space-y-4 overflow-y-auto pr-1">
          <Field label="Name" required>
            <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Sample Migration" />
          </Field>

          <Field label="Description">
            <Textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={2} placeholder="What does this milestone cover?" />
          </Field>

          <div className="grid grid-cols-2 gap-4">
            <Field label="Milestone type">
              <Select value={type} onChange={(e) => setType(e.target.value as MilestoneType)}>
                <option value="main_scope" disabled={planApproved}>{MILESTONE_TYPE_LABELS.main_scope}</option>
                <option value="change_request" disabled={!planApproved}>{MILESTONE_TYPE_LABELS.change_request}</option>
                <option value="delta_scope" disabled={!planApproved}>{MILESTONE_TYPE_LABELS.delta_scope}</option>
              </Select>
            </Field>
            <Field label="Assign to (resource)">
              <Select value={ownerId} onChange={(e) => setOwnerId(e.target.value)}>
                <option value="">— Unassigned —</option>
                {resources.map((r) => (
                  <option key={r.id} value={r.id}>{r.name}</option>
                ))}
              </Select>
            </Field>
          </div>

          {type !== "main_scope" && changeRequests.length > 0 && (
            <Field label="Link change request" hint="Optional">
              <Select value={changeRequestId} onChange={(e) => setChangeRequestId(e.target.value)}>
                <option value="">— None —</option>
                {changeRequests.map((c) => (
                  <option key={c.id} value={c.id}>{c.label}</option>
                ))}
              </Select>
            </Field>
          )}

          {/* Date range = allocation */}
          <div className="grid grid-cols-2 gap-4">
            <Field label="Start date" required>
              <Input
                type="date"
                value={start}
                min={timelineStart ?? undefined}
                max={end || timelineEnd || undefined}
                onChange={(e) => setStart(e.target.value)}
              />
            </Field>
            <Field
              label="End date"
              required
              hint={milestoneDays != null ? `${milestoneDays} day${milestoneDays === 1 ? "" : "s"} · ${remainingBefore} of ${totalDays} left` : undefined}
              error={overProject ? `Only ${remainingBefore} timeline day(s) remain` : undefined}
            >
              <Input
                type="date"
                value={end}
                min={start || timelineStart || undefined}
                max={timelineEnd ?? undefined}
                onChange={(e) => setEnd(e.target.value)}
                className={overProject ? "border-danger" : ""}
              />
            </Field>
          </div>

          {/* Subtasks */}
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
              {subtasks.length === 0 && (
                <p className="text-2xs text-muted">No subtasks. Add tasks and set each one’s date range within the milestone.</p>
              )}
            </div>
            <button
              type="button"
              onClick={() => setSubtasks((rows) => [...rows, { title: "", assignedToId: "", start: "", end: "" }])}
              className="mt-2 inline-flex items-center gap-1 text-xs font-medium text-brand hover:underline"
            >
              <Plus className="h-3.5 w-3.5" /> Add subtask
            </button>
            {!subtasksOk && (
              <p className="mt-2 flex items-center gap-1 text-2xs text-danger">
                <X className="h-3 w-3" /> Each subtask needs a title and a valid date range.
              </p>
            )}
          </div>
        </div>

        <DialogFooter>
          <DialogClose asChild>
            <Button variant="outline">Cancel</Button>
          </DialogClose>
          <Button onClick={submit} disabled={!valid || busy}>
            {busy ? "Adding…" : "Add Milestone"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
