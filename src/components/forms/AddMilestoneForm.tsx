"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Plus } from "lucide-react";
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
import { Input, Field } from "@/components/ui/form-field";
import { toast } from "@/components/ui/toast";
import { apiFetch } from "@/lib/http";

export function AddMilestoneForm({ projectId }: { projectId: string }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [name, setName] = useState("");
  const [stage, setStage] = useState("");
  const [dueDate, setDueDate] = useState("");

  async function submit() {
    setBusy(true);
    try {
      await apiFetch("/api/milestones", {
        method: "POST",
        body: JSON.stringify({
          projectId,
          name,
          parentStage: stage || undefined,
          dueDate: dueDate || null,
        }),
      });
      toast.success("Milestone added");
      setOpen(false);
      setName("");
      setStage("");
      setDueDate("");
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
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Add Milestone</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <Field label="Name" required>
            <Input value={name} onChange={(e) => setName(e.target.value)} />
          </Field>
          <Field label="Stage" hint="Groups the milestone under a lifecycle stage">
            <Input value={stage} onChange={(e) => setStage(e.target.value)} placeholder="e.g. Sample Migration" />
          </Field>
          <Field label="Due Date">
            <Input type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)} />
          </Field>
        </div>
        <DialogFooter>
          <DialogClose asChild>
            <Button variant="outline">Cancel</Button>
          </DialogClose>
          <Button onClick={submit} disabled={!name.trim() || busy}>
            {busy ? "Adding…" : "Add"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
