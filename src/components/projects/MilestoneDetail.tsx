"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { ChevronDown, ChevronRight, FileText, Upload, MessageSquare } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Select, Textarea } from "@/components/ui/form-field";
import { UserAvatar } from "@/components/shared/UserAvatar";
import { toast } from "@/components/ui/toast";
import { apiFetch } from "@/lib/http";

type Person = { id: string; name: string };
type Comment = { id: string; authorId: string; authorName: string; content: string; createdAt: string; isEdited: boolean };
type Doc = { id: string; filename: string; url: string; uploadedByName: string };

export function MilestoneDetail({
  milestoneId,
  ownerId,
  canManage,
  resources,
  comments,
  documents,
}: {
  milestoneId: string;
  ownerId: string | null;
  canManage: boolean;
  resources: Person[];
  comments: Comment[];
  documents: Doc[];
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [draft, setDraft] = useState("");
  const [tags, setTags] = useState<string[]>([]);

  async function assignOwner(next: string) {
    setBusy(true);
    try {
      await apiFetch(`/api/milestones/${milestoneId}`, {
        method: "PATCH",
        body: JSON.stringify({ action: "assign_owner", ownerId: next || null }),
      });
      toast.success(next ? "Owner assigned" : "Owner cleared");
      router.refresh();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed");
    } finally {
      setBusy(false);
    }
  }

  async function postComment() {
    setBusy(true);
    try {
      await apiFetch("/api/comments", {
        method: "POST",
        body: JSON.stringify({ milestoneId, content: draft, mentionUserIds: tags }),
      });
      toast.success(tags.length ? "Comment posted & tagged" : "Comment posted");
      setDraft("");
      setTags([]);
      router.refresh();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to post");
    } finally {
      setBusy(false);
    }
  }

  async function upload(file: File) {
    setBusy(true);
    try {
      const form = new FormData();
      form.append("file", file);
      form.append("milestoneId", milestoneId);
      const res = await fetch("/api/attachments", { method: "POST", body: form });
      if (!res.ok) throw new Error((await res.json().catch(() => ({}))).error ?? "Upload failed");
      toast.success("File attached");
      router.refresh();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Upload failed");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="mt-2">
      <button onClick={() => setOpen((v) => !v)} className="flex items-center gap-1 text-xs font-medium text-slate hover:text-navy">
        {open ? <ChevronDown className="h-3.5 w-3.5" /> : <ChevronRight className="h-3.5 w-3.5" />}
        Details · {comments.length} comment{comments.length === 1 ? "" : "s"} · {documents.length} file{documents.length === 1 ? "" : "s"}
      </button>

      {open && (
        <div className="mt-2 space-y-4 rounded-md border border-border bg-bg/50 p-3">
          {/* Owner */}
          <div>
            <p className="mb-1 text-xs font-medium uppercase tracking-wide text-slate">Assigned Resource</p>
            {canManage ? (
              <Select className="h-8 w-56 text-sm" value={ownerId ?? ""} disabled={busy} onChange={(e) => assignOwner(e.target.value)}>
                <option value="">— Unassigned —</option>
                {resources.map((r) => (
                  <option key={r.id} value={r.id}>{r.name}</option>
                ))}
              </Select>
            ) : (
              <span className="text-sm text-navy">
                {resources.find((r) => r.id === ownerId)?.name ?? "Unassigned"}
              </span>
            )}
          </div>

          {/* Comments */}
          <div>
            <p className="mb-1 flex items-center gap-1 text-xs font-medium uppercase tracking-wide text-slate">
              <MessageSquare className="h-3.5 w-3.5" /> Comments
            </p>
            <div className="space-y-2">
              {comments.map((c) => (
                <div key={c.id} className="rounded-md border border-border bg-surface p-2">
                  <div className="flex items-center gap-2">
                    <UserAvatar name={c.authorName} size="sm" />
                    <span className="text-xs font-medium text-navy">{c.authorName}</span>
                    <span className="text-xs text-slate">{new Date(c.createdAt).toLocaleString()}</span>
                    {c.isEdited && <span className="text-xs italic text-slate">(edited)</span>}
                  </div>
                  <p className="mt-1 whitespace-pre-wrap text-sm text-navy">{c.content}</p>
                </div>
              ))}
              {comments.length === 0 && <p className="text-xs text-slate">No comments yet.</p>}
            </div>

            <div className="mt-2 space-y-2 rounded-md border border-border bg-surface p-2">
              <Textarea value={draft} onChange={(e) => setDraft(e.target.value)} rows={2} placeholder="Add a comment…" />
              {resources.length > 0 && (
                <div>
                  <p className="mb-1 text-xs text-slate">Tag resources:</p>
                  <div className="flex flex-wrap gap-1.5">
                    {resources.map((r) => {
                      const on = tags.includes(r.id);
                      return (
                        <button key={r.id} type="button"
                          onClick={() => setTags((t) => on ? t.filter((x) => x !== r.id) : [...t, r.id])}
                          className={`rounded-full border px-2 py-0.5 text-xs ${on ? "border-steel bg-steel text-white" : "border-border bg-surface text-slate hover:border-border-strong"}`}>
                          @{r.name}
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}
              <div className="flex justify-end">
                <Button size="sm" disabled={!draft.trim() || busy} onClick={postComment}>Post</Button>
              </div>
            </div>
          </div>

          {/* Documents */}
          <div>
            <div className="mb-1 flex items-center justify-between">
              <p className="flex items-center gap-1 text-xs font-medium uppercase tracking-wide text-slate">
                <FileText className="h-3.5 w-3.5" /> Documents
              </p>
              <label className="inline-flex cursor-pointer items-center gap-1 rounded border border-border-strong bg-surface px-2 py-1 text-xs text-navy hover:bg-bg">
                <Upload className="h-3.5 w-3.5" /> {busy ? "…" : "Attach"}
                <input type="file" className="hidden" disabled={busy}
                  accept=".pdf,.docx,.xlsx,.csv,.png,.jpg,.jpeg,.txt,.zip"
                  onChange={(e) => e.target.files?.[0] && upload(e.target.files[0])} />
              </label>
            </div>
            <div className="space-y-1">
              {documents.map((d) => (
                <a key={d.id} href={d.url} target="_blank" rel="noreferrer"
                  className="flex items-center gap-2 rounded-md border border-border bg-surface px-2 py-1.5 text-sm text-navy hover:bg-bg">
                  <FileText className="h-4 w-4 text-slate" />
                  <span className="truncate">{d.filename}</span>
                  <span className="ml-auto text-xs text-slate">{d.uploadedByName}</span>
                </a>
              ))}
              {documents.length === 0 && <p className="text-xs text-slate">No documents attached.</p>}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
