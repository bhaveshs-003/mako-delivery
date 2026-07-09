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
import { Textarea, Field, Select } from "@/components/ui/form-field";
import { toast } from "@/components/ui/toast";
import { apiFetch } from "@/lib/http";

const OPTIONS = [
  { value: "not_started", label: "Not Started" },
  { value: "in_progress", label: "In Progress" },
  { value: "blocked", label: "Blocked" },
  { value: "done", label: "Done" },
];

export function SubtaskStatusControl({
  subtaskId,
  status,
}: {
  subtaskId: string;
  status: string;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [blockOpen, setBlockOpen] = useState(false);
  const [reason, setReason] = useState("");

  async function patch(newStatus: string, blockedReason?: string) {
    setBusy(true);
    try {
      await apiFetch(`/api/subtasks/${subtaskId}`, {
        method: "PATCH",
        body: JSON.stringify({ status: newStatus, blockedReason }),
      });
      toast.success("Task updated");
      setBlockOpen(false);
      setReason("");
      router.refresh();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Update failed");
    } finally {
      setBusy(false);
    }
  }

  function onChange(next: string) {
    if (next === "blocked") setBlockOpen(true); // mandatory reason (spec §3.3.2)
    else patch(next);
  }

  return (
    <>
      <Select
        className="h-7 w-32 text-xs"
        value={status}
        disabled={busy}
        onChange={(e) => onChange(e.target.value)}
      >
        {OPTIONS.map((o) => (
          <option key={o.value} value={o.value}>{o.label}</option>
        ))}
      </Select>

      <Dialog open={blockOpen} onOpenChange={setBlockOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Block this task</DialogTitle>
          </DialogHeader>
          <Field label="Reason" required hint="Required — this feeds delay attribution.">
            <Textarea value={reason} onChange={(e) => setReason(e.target.value)} rows={3} />
          </Field>
          <DialogFooter>
            <Button variant="outline" onClick={() => setBlockOpen(false)}>Cancel</Button>
            <Button variant="danger" disabled={!reason.trim() || busy} onClick={() => patch("blocked", reason)}>
              Mark Blocked
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
