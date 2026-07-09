"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Select, Textarea, Field } from "@/components/ui/form-field";
import { toast } from "@/components/ui/toast";
import { apiFetch } from "@/lib/http";

export function TicketActions({
  ticketId,
  status,
  canRespond,
  canEscalate,
  canClose,
}: {
  ticketId: string;
  status: string;
  canRespond: boolean;
  canEscalate: boolean;
  canClose: boolean;
}) {
  const router = useRouter();
  const [respondOpen, setRespondOpen] = useState(false);
  const [respStatus, setRespStatus] = useState("in_review");
  const [comment, setComment] = useState("");
  const [busy, setBusy] = useState(false);

  async function call(body: Record<string, unknown>, msg: string) {
    setBusy(true);
    try {
      await apiFetch(`/api/tickets/${ticketId}`, { method: "PATCH", body: JSON.stringify(body) });
      toast.success(msg);
      setRespondOpen(false);
      setComment("");
      router.refresh();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Action failed");
    } finally {
      setBusy(false);
    }
  }

  const isClosed = status === "closed";

  return (
    <div className="flex flex-wrap gap-2">
      {canRespond && !isClosed && (
        <Button size="sm" variant="outline" onClick={() => setRespondOpen(true)}>Respond</Button>
      )}
      {canEscalate && !isClosed && (
        <Button size="sm" variant="outline" onClick={() => call({ action: "escalate" }, "Ticket escalated")} disabled={busy}>
          Escalate
        </Button>
      )}
      {canClose && !isClosed && (
        <Button size="sm" variant="secondary" onClick={() => call({ action: "close" }, "Ticket closed")} disabled={busy}>
          Close
        </Button>
      )}

      <Dialog open={respondOpen} onOpenChange={setRespondOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Respond to ticket</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <Field label="Status" required>
              <Select value={respStatus} onChange={(e) => setRespStatus(e.target.value)}>
                <option value="in_review">In Review</option>
                <option value="resolved">Resolved</option>
                <option value="workaround_applied">Workaround Applied</option>
              </Select>
            </Field>
            <Field label="Comment" required>
              <Textarea value={comment} onChange={(e) => setComment(e.target.value)} rows={3} />
            </Field>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setRespondOpen(false)}>Cancel</Button>
            <Button disabled={!comment.trim() || busy} onClick={() => call({ action: "respond", status: respStatus, comment }, "Response submitted")}>
              Submit
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
