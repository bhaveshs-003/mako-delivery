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
import { Select, Textarea, Field } from "@/components/ui/form-field";
import { toast } from "@/components/ui/toast";
import { apiFetch } from "@/lib/http";

export function RequestApprovalForm({
  projectId,
  milestones,
}: {
  projectId: string;
  milestones: { id: string; name: string }[];
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [milestoneId, setMilestoneId] = useState(milestones[0]?.id ?? "");
  const [comment, setComment] = useState("");

  async function submit() {
    setBusy(true);
    try {
      await apiFetch("/api/approvals", {
        method: "POST",
        body: JSON.stringify({ projectId, milestoneId, requestComment: comment }),
      });
      toast.success("Approval requested");
      setOpen(false);
      setComment("");
      router.refresh();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to request approval");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm">
          <Plus className="h-4 w-4" /> Request Approval
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Request Approval</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <Field label="Milestone" required>
            <Select value={milestoneId} onChange={(e) => setMilestoneId(e.target.value)}>
              {milestones.map((m) => (
                <option key={m.id} value={m.id}>{m.name}</option>
              ))}
            </Select>
          </Field>
          <Field label="Request Comment" required>
            <Textarea value={comment} onChange={(e) => setComment(e.target.value)} rows={3} placeholder="What are you asking RL to review and confirm?" />
          </Field>
        </div>
        <DialogFooter>
          <DialogClose asChild>
            <Button variant="outline">Cancel</Button>
          </DialogClose>
          <Button onClick={submit} disabled={!milestoneId || !comment.trim() || busy}>
            {busy ? "Requesting…" : "Request"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
