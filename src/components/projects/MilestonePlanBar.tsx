"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Send, Check, X, Lock, Clock } from "lucide-react";
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

type PlanStatus = "draft" | "pending_approval" | "approved" | "rejected";
type MilestoneSummary = { name: string; allocatedDays: number | null; subtasks: number };

export function MilestonePlanBar({
  projectId,
  status,
  canManage,
  canDecide,
  decisionComment,
  milestones,
  totalDays,
  usedDays,
}: {
  projectId: string;
  status: PlanStatus;
  canManage: boolean;
  canDecide: boolean;
  decisionComment: string | null;
  milestones: MilestoneSummary[];
  totalDays: number;
  usedDays: number;
}) {
  const router = useRouter();
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [rejectOpen, setRejectOpen] = useState(false);
  const [rejectReason, setRejectReason] = useState("");
  const [busy, setBusy] = useState(false);

  async function call(body: Record<string, unknown>, msg: string) {
    setBusy(true);
    try {
      await apiFetch(`/api/projects/${projectId}/milestone-plan`, {
        method: "PATCH",
        body: JSON.stringify(body),
      });
      toast.success(msg);
      setConfirmOpen(false);
      setRejectOpen(false);
      setRejectReason("");
      router.refresh();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Action failed");
    } finally {
      setBusy(false);
    }
  }

  const config = {
    draft: { tone: "border-l-line-strong bg-surface-2/50 text-ink-2", icon: Clock, label: "Draft — not yet submitted" },
    pending_approval: { tone: "border-l-warning bg-warning/5 text-warning", icon: Clock, label: "Awaiting RL approval" },
    approved: { tone: "border-l-success bg-success/5 text-success", icon: Lock, label: "Approved by RL — plan locked" },
    rejected: { tone: "border-l-danger bg-danger/5 text-danger", icon: X, label: "Rejected by RL — edit and resubmit" },
  }[status];
  const Icon = config.icon;

  return (
    <div className={`flex flex-wrap items-center justify-between gap-3 rounded-lg border border-l-4 border-line px-4 py-2.5 ${config.tone}`}>
      <div className="min-w-0">
        <p className="flex items-center gap-1.5 text-sm font-medium">
          <Icon className="h-4 w-4 shrink-0" /> Milestone Plan · {config.label}
        </p>
        {status === "rejected" && decisionComment && (
          <p className="mt-0.5 text-xs">RL: {decisionComment}</p>
        )}
      </div>

      <div className="flex items-center gap-2">
        {canManage && (status === "draft" || status === "rejected") && (
          <Button size="sm" onClick={() => setConfirmOpen(true)} disabled={milestones.length === 0}>
            <Send className="h-3.5 w-3.5" /> Submit for approval
          </Button>
        )}
        {canDecide && status === "pending_approval" && (
          <>
            <Button size="sm" variant="secondary" onClick={() => call({ action: "approve" }, "Plan approved")} disabled={busy}>
              <Check className="h-3.5 w-3.5" /> Approve
            </Button>
            <Button size="sm" variant="danger" onClick={() => setRejectOpen(true)} disabled={busy}>
              <X className="h-3.5 w-3.5" /> Reject
            </Button>
          </>
        )}
      </div>

      {/* Confirmation modal before submitting */}
      <Dialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <DialogContent size="lg">
          <DialogHeader>
            <DialogTitle>Submit milestone plan for RL approval</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <p className="text-sm text-ink-2">
              Review the plan below. Once submitted it is locked until RL decides.
            </p>
            <div className="max-h-[45vh] overflow-y-auto rounded-lg border border-line">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-line bg-surface-2 text-left text-2xs uppercase tracking-wide text-muted">
                    <th className="px-3 py-2 font-medium">Milestone</th>
                    <th className="px-3 py-2 font-medium">Days</th>
                    <th className="px-3 py-2 font-medium">Subtasks</th>
                  </tr>
                </thead>
                <tbody>
                  {milestones.map((m, i) => (
                    <tr key={i} className="border-b border-line last:border-0">
                      <td className="px-3 py-2 text-ink">{m.name}</td>
                      <td className="tabular px-3 py-2 text-ink-2">{m.allocatedDays ?? "—"}</td>
                      <td className="tabular px-3 py-2 text-ink-2">{m.subtasks}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <p className="tabular text-xs text-muted">
              {milestones.length} milestones · {usedDays} of {totalDays} timeline days allocated
              {usedDays > totalDays && totalDays > 0 && (
                <span className="font-medium text-danger"> · over-allocated</span>
              )}
            </p>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setConfirmOpen(false)}>Cancel</Button>
            <Button onClick={() => call({ action: "submit" }, "Plan submitted to RL")} disabled={busy}>
              {busy ? "Submitting…" : "Confirm & Submit"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Reject reason modal (RL) */}
      <Dialog open={rejectOpen} onOpenChange={setRejectOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Reject milestone plan</DialogTitle>
          </DialogHeader>
          <Field label="Reason" required>
            <Textarea value={rejectReason} onChange={(e) => setRejectReason(e.target.value)} rows={3} />
          </Field>
          <DialogFooter>
            <Button variant="outline" onClick={() => setRejectOpen(false)}>Cancel</Button>
            <Button variant="danger" disabled={!rejectReason.trim() || busy} onClick={() => call({ action: "reject", decisionComment: rejectReason }, "Plan rejected")}>
              Reject
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
