"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/form-field";
import { UserAvatar } from "@/components/shared/UserAvatar";
import { toast } from "@/components/ui/toast";
import { apiFetch } from "@/lib/http";

export type CommentNode = {
  id: string;
  content: string;
  authorId: string;
  authorName: string;
  createdAt: string;
  isEdited: boolean;
  versionCount: number;
  parentCommentId: string | null;
};

export function CommentsSection({
  projectId,
  comments,
  userId,
}: {
  projectId: string;
  comments: CommentNode[];
  userId: string;
}) {
  const router = useRouter();
  const [draft, setDraft] = useState("");
  const [busy, setBusy] = useState(false);

  const roots = comments.filter((c) => !c.parentCommentId);
  const childrenOf = (id: string) => comments.filter((c) => c.parentCommentId === id);

  async function post(content: string, parentCommentId?: string) {
    setBusy(true);
    try {
      await apiFetch("/api/comments", {
        method: "POST",
        body: JSON.stringify({ projectId, content, parentCommentId: parentCommentId ?? null }),
      });
      toast.success("Comment posted");
      setDraft("");
      router.refresh();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to post");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-4">
      <div className="rounded-lg border border-border bg-surface p-4 shadow-card">
        <Textarea value={draft} onChange={(e) => setDraft(e.target.value)} rows={3} placeholder="Add a comment…" />
        <div className="mt-2 flex justify-end">
          <Button size="sm" disabled={!draft.trim() || busy} onClick={() => post(draft)}>
            Post Comment
          </Button>
        </div>
      </div>

      <div className="space-y-3">
        <p className="text-sm font-medium text-slate">Comments ({comments.length})</p>
        {roots.length === 0 && <p className="text-sm text-slate">No comments yet.</p>}
        {roots.map((c) => (
          <CommentItem key={c.id} node={c} userId={userId} onReply={post} childrenOf={childrenOf} depth={0} />
        ))}
      </div>
    </div>
  );
}

function CommentItem({
  node,
  userId,
  onReply,
  childrenOf,
  depth,
}: {
  node: CommentNode;
  userId: string;
  onReply: (content: string, parentId?: string) => Promise<void>;
  childrenOf: (id: string) => CommentNode[];
  depth: number;
}) {
  const router = useRouter();
  const [replying, setReplying] = useState(false);
  const [editing, setEditing] = useState(false);
  const [text, setText] = useState("");
  const [editText, setEditText] = useState(node.content);
  const [busy, setBusy] = useState(false);

  async function saveEdit() {
    setBusy(true);
    try {
      await apiFetch(`/api/comments/${node.id}`, { method: "PATCH", body: JSON.stringify({ content: editText }) });
      toast.success("Comment updated");
      setEditing(false);
      router.refresh();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to edit");
    } finally {
      setBusy(false);
    }
  }

  const children = childrenOf(node.id);

  return (
    <div className={depth > 0 ? "ml-6 border-l border-border pl-4" : ""}>
      <div className="rounded-lg border border-border bg-surface p-3 shadow-card">
        <div className="flex items-center gap-2">
          <UserAvatar name={node.authorName} size="sm" />
          <span className="text-sm font-medium text-navy">{node.authorName}</span>
          <span className="text-xs text-slate">{new Date(node.createdAt).toLocaleString()}</span>
          {node.isEdited && <span className="text-xs italic text-slate">(edited · {node.versionCount} rev)</span>}
        </div>
        {editing ? (
          <div className="mt-2 space-y-2">
            <Textarea value={editText} onChange={(e) => setEditText(e.target.value)} rows={2} />
            <div className="flex gap-2">
              <Button size="sm" disabled={busy} onClick={saveEdit}>Save</Button>
              <Button size="sm" variant="outline" onClick={() => setEditing(false)}>Cancel</Button>
            </div>
          </div>
        ) : (
          <p className="mt-1.5 whitespace-pre-wrap text-sm text-navy">{node.content}</p>
        )}
        <div className="mt-2 flex gap-3 text-xs">
          {depth < 2 && (
            <button className="text-slate hover:text-navy" onClick={() => setReplying((v) => !v)}>Reply</button>
          )}
          {node.authorId === userId && !editing && (
            <button className="text-slate hover:text-navy" onClick={() => setEditing(true)}>Edit</button>
          )}
        </div>
        {replying && (
          <div className="mt-2 space-y-2">
            <Textarea value={text} onChange={(e) => setText(e.target.value)} rows={2} placeholder={`Reply to ${node.authorName}…`} />
            <div className="flex gap-2">
              <Button size="sm" disabled={!text.trim() || busy} onClick={async () => { setBusy(true); await onReply(text, node.id); setBusy(false); setReplying(false); setText(""); }}>Reply</Button>
              <Button size="sm" variant="outline" onClick={() => setReplying(false)}>Cancel</Button>
            </div>
          </div>
        )}
      </div>
      {children.length > 0 && (
        <div className="mt-2 space-y-2">
          {children.map((c) => (
            <CommentItem key={c.id} node={c} userId={userId} onReply={onReply} childrenOf={childrenOf} depth={depth + 1} />
          ))}
        </div>
      )}
    </div>
  );
}
