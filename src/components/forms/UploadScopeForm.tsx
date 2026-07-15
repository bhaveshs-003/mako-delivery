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
import { DayStepper } from "@/components/ui/day-stepper";
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
}: {
  projectId: string;
  kind?: "scope" | "change_request";
  resubmit?: boolean;
}) {
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [file, setFile] = useState<File | null>(null);
  const [title, setTitle] = useState("");
  const [note, setNote] = useState("");
  const [impact, setImpact] = useState("");

  const isCR = kind === "change_request";

  async function submit() {
    if (!file) return;
    setBusy(true);
    try {
      const form = new FormData();
      form.append("file", file);
      form.append("kind", kind);
      if (isCR && title.trim()) form.append("title", title.trim());
      if (isCR && impact.trim()) form.append("timelineImpactDays", impact.trim());
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
      setImpact("");
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
                <Field label="Timeline impact" hint="Business days added to the deadline on approval">
                  <DayStepper value={impact} onChange={setImpact} />
                </Field>
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
