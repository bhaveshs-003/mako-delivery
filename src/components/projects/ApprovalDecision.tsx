"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Check, X } from "lucide-react";
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

export function ApprovalDecision({ approvalId }: { approvalId: string }) {
  const router = useRouter();
  const [mode, setMode] = useState<"approve" | "reject" | null>(null);
  const [comment, setComment] = useState("");
  const [busy, setBusy] = useState(false);

  async function submit() {
    if (!mode) return;
    setBusy(true);
    try {
      await apiFetch(`/api/approvals/${approvalId}`, {
        method: "PATCH",
        body: JSON.stringify({ action: mode, decisionComment: comment }),
      });
      toast.success(mode === "approve" ? "Approved" : "Rejected");
      setMode(null);
      setComment("");
      router.refresh();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Action failed");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="mt-3 flex gap-2 border-t border-border pt-3">
      <Button size="sm" variant="secondary" onClick={() => setMode("approve")}>
        <Check className="h-4 w-4" /> Approve
      </Button>
      <Button size="sm" variant="danger" onClick={() => setMode("reject")}>
        <X className="h-4 w-4" /> Reject
      </Button>

      <Dialog open={mode !== null} onOpenChange={(o) => !o && setMode(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{mode === "approve" ? "Approve request" : "Reject request"}</DialogTitle>
          </DialogHeader>
          <Field label={mode === "approve" ? "Comment" : "Reason"} required>
            <Textarea value={comment} onChange={(e) => setComment(e.target.value)} rows={3} />
          </Field>
          <DialogFooter>
            <Button variant="outline" onClick={() => setMode(null)}>Cancel</Button>
            <Button
              variant={mode === "approve" ? "secondary" : "danger"}
              disabled={!comment.trim() || busy}
              onClick={submit}
            >
              {busy ? "Saving…" : mode === "approve" ? "Approve" : "Reject"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
