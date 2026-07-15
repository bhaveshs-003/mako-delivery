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
import { DayStepper } from "@/components/ui/day-stepper";
import { toast } from "@/components/ui/toast";
import { apiFetch } from "@/lib/http";
import { cn } from "@/lib/utils";
import { MILESTONE_TYPE_LABELS } from "@/lib/constants";

type Person = { id: string; name: string };
type SubtaskDraft = { title: string; assignedToId: string; days: string };
type MilestoneType = "main_scope" | "change_request" | "delta_scope";

export function AddMilestoneForm({
  projectId,
  resources,
  totalDays,
  usedDays,
  planApproved,
  changeRequests = [],
}: {
  projectId: string;
  resources: Person[];
  totalDays: number;
  usedDays: number;
  /** After plan approval, only change-request / delta-scope milestones may be added. */
  planApproved: boolean;
  changeRequests?: { id: string; label: string }[];
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);

  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [stage, setStage] = useState("");
  const [type, setType] = useState<MilestoneType>(planApproved ? "change_request" : "main_scope");
  const [changeRequestId, setChangeRequestId] = useState("");
  const [ownerId, setOwnerId] = useState("");
  const [days, setDays] = useState("");
  const [subtasks, setSubtasks] = useState<SubtaskDraft[]>([]);

  const remainingBefore = Math.max(0, totalDays - usedDays);
  const milestoneDays = Number(days) || 0;
  const subUsed = subtasks.reduce((s, t) => s + (Number(t.days) || 0), 0);

  const overProject = milestoneDays > remainingBefore;
  const overMilestone = subUsed > milestoneDays;
  const valid = name.trim() && !overProject && !overMilestone && subtasks.every((s) => s.title.trim());

  function reset() {
    setName(""); setDescription(""); setStage(""); setOwnerId(""); setDays("");
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
          parentStage: stage || undefined,
          type,
          changeRequestId: type !== "main_scope" && changeRequestId ? changeRequestId : null,
          ownerId: ownerId || null,
          allocatedDays: days === "" ? null : Number(days),
          subtasks: subtasks
            .filter((s) => s.title.trim())
            .map((s) => ({
              title: s.title,
              assignedToId: s.assignedToId || null,
              allocatedDays: s.days === "" ? null : Number(s.days),
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
            {type !== "main_scope" && changeRequests.length > 0 ? (
              <Field label="Link change request" hint="Optional">
                <Select value={changeRequestId} onChange={(e) => setChangeRequestId(e.target.value)}>
                  <option value="">— None —</option>
                  {changeRequests.map((c) => (
                    <option key={c.id} value={c.id}>{c.label}</option>
                  ))}
                </Select>
              </Field>
            ) : (
              <Field label="Stage" hint="Groups it under a lifecycle stage">
                <Input value={stage} onChange={(e) => setStage(e.target.value)} placeholder="Optional" />
              </Field>
            )}
          </div>

          <div className="grid grid-cols-2 gap-4">
            <Field label="Assign to (resource)">
              <Select value={ownerId} onChange={(e) => setOwnerId(e.target.value)}>
                <option value="">— Unassigned —</option>
                {resources.map((r) => (
                  <option key={r.id} value={r.id}>{r.name}</option>
                ))}
              </Select>
            </Field>
            <Field
              label="Allocated Days"
              hint="Due date is derived from the days allocated"
            >
              <DayStepper
                value={days}
                onChange={setDays}
                poolTotal={totalDays}
                poolUsedByOthers={usedDays}
                over={overProject}
              />
            </Field>
          </div>

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
                  <Input
                    className="flex-1"
                    placeholder="Subtask title"
                    value={s.title}
                    onChange={(e) => updateSub(i, { title: e.target.value })}
                  />
                  <Select
                    className="w-36"
                    value={s.assignedToId}
                    onChange={(e) => updateSub(i, { assignedToId: e.target.value })}
                  >
                    <option value="">Unassigned</option>
                    {resources.map((r) => (
                      <option key={r.id} value={r.id}>{r.name}</option>
                    ))}
                  </Select>
                  <DayStepper compact value={s.days} onChange={(v) => updateSub(i, { days: v })} />
                  <button
                    type="button"
                    onClick={() => setSubtasks((rows) => rows.filter((_, j) => j !== i))}
                    className="text-muted hover:text-danger"
                    title="Remove"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              ))}
              {subtasks.length === 0 && (
                <p className="text-2xs text-muted">No subtasks. Add tasks and split the milestone days across them.</p>
              )}
            </div>

            <button
              type="button"
              onClick={() => setSubtasks((rows) => [...rows, { title: "", assignedToId: "", days: "" }])}
              className="mt-2 inline-flex items-center gap-1 text-xs font-medium text-brand hover:underline"
            >
              <Plus className="h-3.5 w-3.5" /> Add subtask
            </button>

            {overMilestone && (
              <p className="mt-2 flex items-center gap-1 text-2xs text-danger">
                <X className="h-3 w-3" /> Subtasks exceed the milestone allocation.
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
