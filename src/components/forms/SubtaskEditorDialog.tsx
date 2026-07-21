"use client";

import { useEffect, useState, type ReactNode } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input, Textarea, Select, Field } from "@/components/ui/form-field";

export type SubtaskDraft = { title: string; description: string; assignedToId: string; start: string; end: string };

const blank: SubtaskDraft = { title: "", description: "", assignedToId: "", start: "", end: "" };

/**
 * Side-drawer editor for a single subtask — a roomier form than the inline row,
 * with title, description, assignee and a date range. Used for both add & edit.
 */
export function SubtaskEditorDialog({
  resources,
  milestoneStart,
  milestoneEnd,
  initial,
  onSave,
  trigger,
  heading = "Subtask",
}: {
  resources: { id: string; name: string }[];
  milestoneStart?: string;
  milestoneEnd?: string;
  initial?: SubtaskDraft;
  onSave: (draft: SubtaskDraft) => void;
  trigger: ReactNode;
  heading?: string;
}) {
  const [open, setOpen] = useState(false);
  const [d, setD] = useState<SubtaskDraft>(initial ?? blank);

  useEffect(() => {
    if (open) setD(initial ?? blank);
  }, [open]); // eslint-disable-line react-hooks/exhaustive-deps

  const rangeOk = !d.start || !d.end || new Date(d.end) >= new Date(d.start);
  const valid = d.title.trim().length > 0 && rangeOk;
  const set = (patch: Partial<SubtaskDraft>) => setD((p) => ({ ...p, ...patch }));

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>{trigger}</DialogTrigger>
      <DialogContent side>
        <DialogHeader>
          <DialogTitle>{heading}</DialogTitle>
        </DialogHeader>
        <div className="flex-1 space-y-4">
          <Field label="Title" required>
            <Input value={d.title} onChange={(e) => set({ title: e.target.value })} placeholder="e.g. Configure staging environment" />
          </Field>
          <Field label="Description">
            <Textarea rows={4} value={d.description} onChange={(e) => set({ description: e.target.value })} placeholder="What does this task involve?" />
          </Field>
          <Field label="Assigned resource">
            <Select value={d.assignedToId} onChange={(e) => set({ assignedToId: e.target.value })}>
              <option value="">— Unassigned —</option>
              {resources.map((r) => (
                <option key={r.id} value={r.id}>{r.name}</option>
              ))}
            </Select>
          </Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Start">
              <Input type="date" value={d.start} min={milestoneStart} max={d.end || milestoneEnd} onChange={(e) => set({ start: e.target.value })} />
            </Field>
            <Field label="End" error={!rangeOk ? "End before start" : undefined}>
              <Input type="date" value={d.end} min={d.start || milestoneStart} max={milestoneEnd} onChange={(e) => set({ end: e.target.value })} />
            </Field>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
          <Button
            disabled={!valid}
            onClick={() => {
              onSave(d);
              setOpen(false);
            }}
          >
            Save subtask
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
