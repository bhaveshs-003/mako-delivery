"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Pencil } from "lucide-react";
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

export function EditMilestoneForm({
  milestoneId,
  resources,
  initial,
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
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [name, setName] = useState(initial.name);
  const [description, setDescription] = useState(initial.description);
  const [ownerId, setOwnerId] = useState(initial.ownerId);
  const [days, setDays] = useState(initial.allocatedDays);
  const [dueDate, setDueDate] = useState(initial.dueDate);

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
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit Milestone</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
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
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
            <Button onClick={save} disabled={!name.trim() || busy}>
              {busy ? "Saving…" : "Save"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
