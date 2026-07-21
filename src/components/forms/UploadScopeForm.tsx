"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Upload, GitPullRequestArrow } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Input, Textarea, Field } from "@/components/ui/form-field";
import { toast } from "@/components/ui/toast";

/**
 * Upload a document for RL approval — either the initial scope understanding or
 * a change request (raised after scope approval). Both hit the same endpoint and
 * follow the same approve/reject flow.
 */
export function UploadScopeForm({
  projectId,
  kind = "scope",
  resubmit = false,
  includeWeekendsDefault = false,
}: {
  projectId: string;
  kind?: "scope" | "change_request";
  resubmit?: boolean;
  includeWeekendsDefault?: boolean;
}) {
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [file, setFile] = useState<File | null>(null);
  const [title, setTitle] = useState("");
  const [note, setNote] = useState("");
  // Optional proposed timeline for a change request (applied on RL approval).
  const [rlStart, setRlStart] = useState("");
  const [rlEnd, setRlEnd] = useState("");
  const [makoStart, setMakoStart] = useState("");
  const [makoEnd, setMakoEnd] = useState("");
  const [includeWeekends, setIncludeWeekends] = useState(includeWeekendsDefault);

  const isCR = kind === "change_request";

  async function submit() {
    if (!file) return;
    setBusy(true);
    try {
      const form = new FormData();
      form.append("file", file);
      form.append("kind", kind);
      if (isCR && title.trim()) form.append("title", title.trim());
      if (isCR && rlStart) form.append("proposedRlStartDate", rlStart);
      if (isCR && rlEnd) form.append("proposedRlCommittedDeadline", rlEnd);
      if (isCR && makoStart) form.append("proposedMakoStartDate", makoStart);
      if (isCR && makoEnd) form.append("proposedMakoInternalDeadline", makoEnd);
      if (isCR) form.append("proposedIncludeWeekends", String(includeWeekends));
      if (note.trim()) form.append("note", note.trim());
      const res = await fetch(`/api/projects/${projectId}/scope`, { method: "POST", body: form });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error ?? "Upload failed");
      }
      toast.success(isCR ? "Change request submitted to RL" : "Scope submitted to RL for approval");
      setOpen(false);
      setFile(null);
      setTitle("");
      setNote("");
      setRlStart("");
      setRlEnd("");
      setMakoStart("");
      setMakoEnd("");
      router.refresh();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Upload failed");
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <Button size="sm" variant={isCR ? "outline" : undefined} onClick={() => setOpen(true)}>
        {isCR ? <GitPullRequestArrow className="h-4 w-4" /> : <Upload className="h-4 w-4" />}
        {isCR ? "Raise change request" : resubmit ? "Re-upload scope" : "Upload scope"}
      </Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{isCR ? "Raise a Change Request" : "Scope Understanding"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            {isCR && (
              <>
                <Field label="Title" hint="Short label for this change request">
                  <Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="e.g. Added reporting module" />
                </Field>
                <div className="rounded-lg border border-line bg-surface-2/40 p-3">
                  <p className="mb-2 text-2xs font-semibold uppercase tracking-wide text-muted">
                    Proposed timeline <span className="font-normal normal-case text-muted">· optional, applied on approval</span>
                  </p>
                  <div className="grid grid-cols-2 gap-3">
                    <Field label="RL start">
                      <Input type="date" value={rlStart} max={rlEnd || undefined} onChange={(e) => setRlStart(e.target.value)} />
                    </Field>
                    <Field label="RL end">
                      <Input type="date" value={rlEnd} min={rlStart || undefined} onChange={(e) => setRlEnd(e.target.value)} />
                    </Field>
                    <Field label="Mako start">
                      <Input type="date" value={makoStart} max={makoEnd || undefined} onChange={(e) => setMakoStart(e.target.value)} />
                    </Field>
                    <Field label="Mako end">
                      <Input type="date" value={makoEnd} min={makoStart || undefined} onChange={(e) => setMakoEnd(e.target.value)} />
                    </Field>
                  </div>
                  <label className="mt-2 flex items-center gap-2 text-xs text-ink-2">
                    <input type="checkbox" checked={includeWeekends} onChange={(e) => setIncludeWeekends(e.target.checked)} className="h-3.5 w-3.5 rounded border-line" />
                    Include weekends (Sat &amp; Sun) as working days
                  </label>
                </div>
              </>
            )}
            <Field label="Document" required hint="PDF / DOCX / XLSX · max 25MB">
              <input
                ref={inputRef}
                type="file"
                onChange={(e) => setFile(e.target.files?.[0] ?? null)}
                accept=".pdf,.docx,.xlsx,.csv,.png,.jpg,.jpeg,.txt,.zip"
                className="block w-full text-sm text-ink-2 file:mr-3 file:rounded-md file:border-0 file:bg-surface-2 file:px-3 file:py-1.5 file:text-sm file:font-medium file:text-ink hover:file:bg-line"
              />
            </Field>
            <Field label="Note to RL POC" hint="Optional context for the reviewer">
              <Textarea value={note} onChange={(e) => setNote(e.target.value)} rows={3} />
            </Field>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
            <Button disabled={!file || busy} onClick={submit}>
              {busy ? "Submitting…" : "Submit for approval"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
