"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Send, CheckCircle2, Clock } from "lucide-react";
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
 * Whole-plan approval footer. The PM submits the ENTIRE milestone plan to the RL
 * POC in one action; once approved the plan locks and further milestones come
 * only via Change Request. Shown below the milestone list.
 */
export function MilestonePlanSubmit({
  projectId,
  status,
  milestoneCount,
  decisionComment,
  approvalDays,
  canManage,
  canDecide = false,
}: {
  projectId: string;
  status: "draft" | "pending_approval" | "approved" | "rejected";
  milestoneCount: number;
  decisionComment: string | null;
  approvalDays: number | null;
  canManage: boolean;
  canDecide?: boolean;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [comment, setComment] = useState("");
  const [busy, setBusy] = useState(false);
  const [decision, setDecision] = useState<"approve" | "reject" | null>(null);

  async function submit() {
    setBusy(true);
    try {
      await apiFetch(`/api/projects/${projectId}/milestone-plan`, {
        method: "PATCH",
        body: JSON.stringify({ action: "submit", decisionComment: comment || undefined }),
      });
      toast.success("Milestone plan submitted to RL");
      setOpen(false);
      setComment("");
      router.refresh();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to submit");
    } finally {
      setBusy(false);
    }
  }

  async function decide() {
    if (!decision) return;
    setBusy(true);
    try {
      await apiFetch(`/api/projects/${projectId}/milestone-plan`, {
        method: "PATCH",
        body: JSON.stringify({ action: decision, decisionComment: comment || undefined }),
      });
      toast.success(decision === "approve" ? "Plan approved" : "Plan rejected");
      setDecision(null);
      setComment("");
      router.refresh();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to decide");
    } finally {
      setBusy(false);
    }
  }

  if (status === "approved") {
    return (
      <div className="flex flex-wrap items-center gap-2 rounded-lg border border-success/30 bg-success/5 px-4 py-3 text-sm text-success">
        <CheckCircle2 className="h-4 w-4" />
        <span className="font-medium">Milestone plan approved by RL.</span>
        {approvalDays != null && <span className="text-ink-2">Took {approvalDays} day(s) to approve.</span>}
        <span className="text-ink-2">Further changes must be raised as a Change Request.</span>
      </div>
    );
  }

  if (status === "pending_approval") {
    return (
      <>
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-warning/30 bg-warning/5 px-4 py-3 text-sm text-warning">
          <span className="flex items-center gap-2">
            <Clock className="h-4 w-4" />
            <span className="font-medium">
              {canDecide
                ? `Milestone plan submitted (${milestoneCount}) — review and decide.`
                : "Milestone plan submitted — awaiting RL POC approval."}
            </span>
          </span>
          {canDecide && (
            <span className="flex gap-2">
              <Button size="sm" onClick={() => setDecision("approve")}>
                <CheckCircle2 className="h-4 w-4" /> Approve plan
              </Button>
              <Button size="sm" variant="outline" onClick={() => setDecision("reject")}>
                Reject
              </Button>
            </span>
          )}
        </div>

        <Dialog open={decision !== null} onOpenChange={(o) => !o && setDecision(null)}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>{decision === "approve" ? "Approve milestone plan" : "Reject milestone plan"}</DialogTitle>
            </DialogHeader>
            <Field
              label={decision === "approve" ? "Comment (optional)" : "Reason"}
              required={decision === "reject"}
              hint={decision === "approve" ? "Approving locks the plan and starts execution." : "The PM will revise the milestones and resubmit."}
            >
              <Textarea value={comment} onChange={(e) => setComment(e.target.value)} rows={3} />
            </Field>
            <DialogFooter>
              <Button variant="outline" onClick={() => setDecision(null)}>Cancel</Button>
              <Button disabled={busy || (decision === "reject" && !comment.trim())} onClick={decide}>
                {busy ? "Saving…" : decision === "approve" ? "Approve" : "Reject"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </>
    );
  }

  if (!canManage) return null;

  return (
    <div className="rounded-lg border border-line bg-surface-2/40 px-4 py-3">
      {status === "rejected" && decisionComment && (
        <p className="mb-2 text-sm">
          <span className="font-medium text-danger">RL rejected the plan:</span>{" "}
          <span className="text-ink-2">{decisionComment}</span>
        </p>
      )}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-ink-2">
          {status === "rejected"
            ? "Revise the milestones and resubmit the whole plan for approval."
            : "When the plan is ready, submit all milestones to the RL POC for approval."}
        </p>
        <Button size="sm" disabled={milestoneCount === 0} onClick={() => setOpen(true)}>
          <Send className="h-4 w-4" />
          {status === "rejected" ? "Resubmit plan" : "Submit plan for approval"}
        </Button>
      </div>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Submit milestone plan to RL</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <p className="text-sm text-ink-2">
              You are submitting <span className="font-semibold text-ink">{milestoneCount} milestone(s)</span> as the
              full plan. Once RL approves, the plan locks and new milestones can only be added via a Change Request.
            </p>
            <Field label="Message to RL POC" hint="Optional context for the reviewer">
              <Textarea value={comment} onChange={(e) => setComment(e.target.value)} rows={3} />
            </Field>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
            <Button disabled={busy} onClick={submit}>{busy ? "Submitting…" : "Submit for approval"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
