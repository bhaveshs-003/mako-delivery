"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { differenceInBusinessDays } from "date-fns";
import type { UserRole } from "@prisma/client";
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
import { Input, Textarea, Select, Field } from "@/components/ui/form-field";
import { toast } from "@/components/ui/toast";

const TODAY = new Date().toISOString().slice(0, 10);

export function MarkReceivedButton({
  dependencyId,
  dateRequested,
  slaThresholdDays,
  requestedFromParty,
  role,
  canManage,
}: {
  dependencyId: string;
  dateRequested: string;
  slaThresholdDays: number;
  requestedFromParty: string;
  role: UserRole;
  canManage: boolean;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [dateReceived, setDateReceived] = useState(TODAY);
  const [rootCauseCategory, setRootCauseCategory] = useState("rl");
  const [rootCauseComment, setRootCauseComment] = useState("");
  const [comment, setComment] = useState("");
  const [file, setFile] = useState<File | null>(null);

  // RL fulfils rl-requested deps; the Mako side marks everything else received.
  const isRlFulfil = role === "rl_user" && requestedFromParty === "rl";
  const visible = isRlFulfil || canManage;
  if (!visible) return <span className="text-slate">—</span>;

  const burn = Math.max(
    0,
    differenceInBusinessDays(new Date(dateReceived), new Date(dateRequested))
  );
  const breached = burn > slaThresholdDays;
  const rootCauseValid = !breached || rootCauseComment.trim().length > 0;

  async function submit() {
    setBusy(true);
    try {
      const fd = new FormData();
      fd.append("action", isRlFulfil ? "fulfill" : "receive");
      fd.append("dateReceived", dateReceived);
      if (comment.trim()) fd.append("comment", comment.trim());
      if (file) fd.append("file", file);
      if (breached) {
        fd.append("rootCauseCategory", rootCauseCategory);
        fd.append("rootCauseComment", rootCauseComment);
      }
      const res = await fetch(`/api/dependencies/${dependencyId}/fulfil`, { method: "POST", body: fd });
      if (!res.ok) throw new Error((await res.json().catch(() => ({})))?.error ?? "Action failed");
      toast.success(isRlFulfil ? "Dependency sent" : "Dependency received");
      setOpen(false);
      router.refresh();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Action failed");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm" variant="outline">
          {isRlFulfil ? "Mark Sent" : "Mark Received"}
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{isRlFulfil ? "Mark Sent" : "Mark Received"}</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <Field label="Date Received" required>
            <Input type="date" max={TODAY} value={dateReceived} onChange={(e) => setDateReceived(e.target.value)} />
          </Field>

          <Field label={isRlFulfil ? "Document" : "Document (optional)"} hint=".xlsx / .docx / .pdf / .txt · max 25MB">
            <input
              type="file"
              accept=".xlsx,.docx,.pdf,.txt"
              onChange={(e) => setFile(e.target.files?.[0] ?? null)}
              className="block w-full text-sm text-ink-2 file:mr-3 file:rounded-md file:border-0 file:bg-surface-2 file:px-3 file:py-1.5 file:text-sm file:font-medium file:text-ink hover:file:bg-line"
            />
          </Field>

          <Field label="Comment" hint={isRlFulfil ? "Add a note for the Mako team before sending" : "Optional note"}>
            <Textarea value={comment} onChange={(e) => setComment(e.target.value)} rows={2} />
          </Field>

          <div className="flex items-center justify-between rounded-md border border-border bg-bg px-3 py-2 text-sm">
            <span className="text-slate">Burn (business days)</span>
            <span className={breached ? "font-semibold text-danger" : "font-medium text-success"}>
              {burn}d {breached ? `· BREACHED (SLA ${slaThresholdDays}d)` : `· within SLA`}
            </span>
          </div>

          {breached && (
            <div className="space-y-4 rounded-md border-l-4 border-danger bg-red-50 p-3">
              <p className="text-sm font-medium text-danger">
                SLA breached — root cause is required.
              </p>
              <Field label="Root Cause Category" required>
                <Select value={rootCauseCategory} onChange={(e) => setRootCauseCategory(e.target.value)}>
                  <option value="mako">Mako</option>
                  <option value="rl">Rocketlane</option>
                  <option value="client_via_rl">Client-via-RL</option>
                  <option value="product_bug">Product Bug</option>
                </Select>
              </Field>
              <Field label="Root Cause Comment" required>
                <Textarea value={rootCauseComment} onChange={(e) => setRootCauseComment(e.target.value)} rows={2} />
              </Field>
            </div>
          )}
        </div>
        <DialogFooter>
          <DialogClose asChild>
            <Button variant="outline">Cancel</Button>
          </DialogClose>
          <Button onClick={submit} disabled={!rootCauseValid || busy}>
            {busy ? "Saving…" : "Confirm"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
