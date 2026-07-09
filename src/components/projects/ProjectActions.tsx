"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Play, Pause, PlayCircle, Archive, CheckCircle2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogClose,
} from "@/components/ui/dialog";
import { Select, Textarea, Field } from "@/components/ui/form-field";
import { toast } from "@/components/ui/toast";
import { apiFetch } from "@/lib/http";

export function ProjectActions({
  projectId,
  status,
  canManage,
  canArchive,
  isArchived,
}: {
  projectId: string;
  status: string;
  canManage: boolean;
  canArchive: boolean;
  isArchived: boolean;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [pauseOpen, setPauseOpen] = useState(false);
  const [reasonCategory, setReasonCategory] = useState("rl");
  const [reasonComment, setReasonComment] = useState("");

  async function act(body: Record<string, unknown>, successMsg: string) {
    setBusy(true);
    try {
      await apiFetch(`/api/projects/${projectId}`, {
        method: "PATCH",
        body: JSON.stringify(body),
      });
      toast.success(successMsg);
      setPauseOpen(false);
      router.refresh();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Action failed");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex flex-wrap items-center gap-2">
      {canManage && status === "not_started" && (
        <Button size="sm" onClick={() => act({ action: "start" }, "Project started")} disabled={busy}>
          <Play className="h-4 w-4" /> Start
        </Button>
      )}
      {canManage && status === "in_progress" && (
        <>
          <Button size="sm" variant="outline" onClick={() => setPauseOpen(true)} disabled={busy}>
            <Pause className="h-4 w-4" /> Pause
          </Button>
          <Button size="sm" variant="secondary" onClick={() => act({ action: "complete" }, "Project completed")} disabled={busy}>
            <CheckCircle2 className="h-4 w-4" /> Complete
          </Button>
        </>
      )}
      {canManage && status === "paused" && (
        <Button size="sm" onClick={() => act({ action: "resume" }, "Project resumed")} disabled={busy}>
          <PlayCircle className="h-4 w-4" /> Resume
        </Button>
      )}
      {canArchive &&
        (isArchived ? (
          <Button size="sm" variant="outline" onClick={() => act({ action: "unarchive" }, "Project unarchived")} disabled={busy}>
            <Archive className="h-4 w-4" /> Unarchive
          </Button>
        ) : (
          <Button size="sm" variant="outline" onClick={() => act({ action: "archive" }, "Project archived")} disabled={busy}>
            <Archive className="h-4 w-4" /> Archive
          </Button>
        ))}

      {/* Pause requires a mandatory category + comment (spec §3.3.4) */}
      <Dialog open={pauseOpen} onOpenChange={setPauseOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Pause Project</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <Field label="Reason Category" required>
              <Select value={reasonCategory} onChange={(e) => setReasonCategory(e.target.value)}>
                <option value="mako">Mako</option>
                <option value="rl">Rocketlane</option>
                <option value="client_via_rl">Client-via-RL</option>
                <option value="product_bug">Product Bug</option>
                <option value="other">Other</option>
              </Select>
            </Field>
            <Field label="Comment" required>
              <Textarea
                value={reasonComment}
                onChange={(e) => setReasonComment(e.target.value)}
                placeholder="Why is this project being paused?"
              />
            </Field>
          </div>
          <DialogFooter>
            <DialogClose asChild>
              <Button variant="outline">Cancel</Button>
            </DialogClose>
            <Button
              disabled={!reasonComment.trim() || busy}
              onClick={() => act({ action: "pause", reasonCategory, reasonComment }, "Project paused")}
            >
              Pause Project
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
