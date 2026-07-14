"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Send } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Textarea, Field } from "@/components/ui/form-field";
import { toast } from "@/components/ui/toast";
import { apiFetch } from "@/lib/http";

/**
 * Submit a milestone to the RL POC for approval (spec §2.7). Creates an
 * approval request; the milestone flips to "pending" until the RL user decides.
 * Shown for a not-yet-submitted or previously-rejected milestone.
 */
export function SubmitMilestoneApproval({
  projectId,
  milestoneId,
  resubmit = false,
}: {
  projectId: string;
  milestoneId: string;
  resubmit?: boolean;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [comment, setComment] = useState("");
  const [busy, setBusy] = useState(false);

  async function submit() {
    setBusy(true);
    try {
      await apiFetch("/api/approvals", {
        method: "POST",
        body: JSON.stringify({ projectId, milestoneId, requestComment: comment }),
      });
      toast.success("Submitted to RL for approval");
      setOpen(false);
      setComment("");
      router.refresh();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to submit");
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <Button size="sm" variant="outline" onClick={() => setOpen(true)}>
        <Send className="h-3.5 w-3.5" /> {resubmit ? "Resubmit" : "Submit for approval"}
      </Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Submit milestone to RL for approval</DialogTitle>
          </DialogHeader>
          <Field label="Message to RL POC" required hint="What are you asking RL to review and confirm?">
            <Textarea value={comment} onChange={(e) => setComment(e.target.value)} rows={3} />
          </Field>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
            <Button disabled={!comment.trim() || busy} onClick={submit}>
              {busy ? "Submitting…" : "Submit"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
