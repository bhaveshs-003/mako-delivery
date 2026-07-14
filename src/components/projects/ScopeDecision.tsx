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

/** RL POC approve/reject a specific pending scope / change-request document. */
export function ScopeDecision({
  projectId,
  scopeDocumentId,
}: {
  projectId: string;
  scopeDocumentId: string;
}) {
  const router = useRouter();
  const [action, setAction] = useState<"approve" | "reject" | null>(null);
  const [comment, setComment] = useState("");
  const [busy, setBusy] = useState(false);

  async function decide() {
    if (!action) return;
    setBusy(true);
    try {
      await apiFetch(`/api/projects/${projectId}/scope`, {
        method: "PATCH",
        body: JSON.stringify({ scopeDocumentId, action, decisionComment: comment || undefined }),
      });
      toast.success(action === "approve" ? "Scope approved" : "Scope rejected");
      setAction(null);
      setComment("");
      router.refresh();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to decide");
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <div className="flex gap-2">
        <Button size="sm" onClick={() => setAction("approve")}>
          <Check className="h-4 w-4" /> Approve
        </Button>
        <Button size="sm" variant="outline" onClick={() => setAction("reject")}>
          <X className="h-4 w-4" /> Reject
        </Button>
      </div>
      <Dialog open={action !== null} onOpenChange={(o) => !o && setAction(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{action === "approve" ? "Approve scope" : "Reject scope"}</DialogTitle>
          </DialogHeader>
          <Field
            label={action === "approve" ? "Comment (optional)" : "Reason"}
            required={action === "reject"}
            hint={action === "approve" ? "Approving unlocks the milestone plan and lets the project start." : "The PM will need to upload a revised scope document."}
          >
            <Textarea value={comment} onChange={(e) => setComment(e.target.value)} rows={3} />
          </Field>
          <DialogFooter>
            <Button variant="outline" onClick={() => setAction(null)}>Cancel</Button>
            <Button disabled={busy || (action === "reject" && !comment.trim())} onClick={decide}>
              {busy ? "Saving…" : action === "approve" ? "Approve" : "Reject"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
