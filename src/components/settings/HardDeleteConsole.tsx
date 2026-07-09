"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input, Select, Textarea, Field } from "@/components/ui/form-field";
import { toast } from "@/components/ui/toast";
import { apiFetch } from "@/lib/http";

export function HardDeleteConsole() {
  const router = useRouter();
  const [entityType, setEntityType] = useState("comment");
  const [entityId, setEntityId] = useState("");
  const [confirmName, setConfirmName] = useState("");
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);

  const valid = entityId.trim() && confirmName.trim() && reason.trim();

  async function submit() {
    if (!confirm("This permanently deletes the record. A tombstone will be written first. Continue?")) return;
    setBusy(true);
    try {
      await apiFetch("/api/admin/hard-delete", {
        method: "POST",
        body: JSON.stringify({ entityType, entityId, confirmName, reason }),
      });
      toast.success("Record deleted; tombstone recorded");
      setEntityId("");
      setConfirmName("");
      setReason("");
      router.refresh();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Delete failed");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex items-start gap-2 rounded-md border-l-4 border-danger bg-red-50 px-4 py-3 text-sm text-danger">
        <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
        <p>
          This console permanently and irreversibly deletes records. A tombstone
          entry recording who deleted what, when, and why is written to the
          tamper-evident audit log <strong>before</strong> deletion.
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Entity Type" required>
          <Select value={entityType} onChange={(e) => setEntityType(e.target.value)}>
            <option value="comment">Comment</option>
            <option value="ticket">Ticket</option>
            <option value="project">Project</option>
          </Select>
        </Field>
        <Field label="Record ID (UUID)" required>
          <Input value={entityId} onChange={(e) => setEntityId(e.target.value)} placeholder="00000000-0000-…" />
        </Field>
      </div>
      <Field label="Confirmation" required hint="Type the record's exact title/content to confirm">
        <Input value={confirmName} onChange={(e) => setConfirmName(e.target.value)} />
      </Field>
      <Field label="Reason" required>
        <Textarea value={reason} onChange={(e) => setReason(e.target.value)} rows={2} />
      </Field>
      <Button variant="danger" disabled={!valid || busy} onClick={submit}>
        {busy ? "Deleting…" : "Permanently Delete"}
      </Button>
    </div>
  );
}
