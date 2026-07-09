"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogTrigger, DialogClose } from "@/components/ui/dialog";
import { Textarea, Select, Field } from "@/components/ui/form-field";
import { toast } from "@/components/ui/toast";
import { apiFetch } from "@/lib/http";

export function SubmitMomForm({ meetingId, isLate }: { meetingId: string; isLate: boolean }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [content, setContent] = useState("");
  const [lateCategory, setLateCategory] = useState("genuine_miss");
  const [lateComment, setLateComment] = useState("");

  const valid = content.trim() && (!isLate || lateComment.trim());

  async function submit() {
    setBusy(true);
    try {
      await apiFetch(`/api/meetings/${meetingId}`, {
        method: "PATCH",
        body: JSON.stringify({
          content,
          ...(isLate ? { lateReasonCategory: lateCategory, lateReasonComment: lateComment } : {}),
        }),
      });
      toast.success("MoM submitted");
      setOpen(false);
      router.refresh();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to submit MoM");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm" variant={isLate ? "danger" : "secondary"}>
          Submit MoM{isLate ? " (Late)" : ""}
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader><DialogTitle>Submit Minutes of Meeting</DialogTitle></DialogHeader>
        <div className="space-y-4">
          <Field label="MoM Content" required>
            <Textarea value={content} onChange={(e) => setContent(e.target.value)} rows={5} placeholder="Key decisions, action items, owners…" />
          </Field>
          {isLate && (
            <div className="space-y-4 rounded-md border-l-4 border-danger bg-red-50 p-3">
              <p className="text-sm font-medium text-danger">Past the 24-hour deadline — a reason is required.</p>
              <Field label="Late reason" required>
                <Select value={lateCategory} onChange={(e) => setLateCategory(e.target.value)}>
                  <option value="genuine_miss">Genuine miss (Mako)</option>
                  <option value="rl_delay_compressed_timeline">RL dependency compressed the timeline</option>
                  <option value="other">Other</option>
                </Select>
              </Field>
              <Field label="Comment" required>
                <Textarea value={lateComment} onChange={(e) => setLateComment(e.target.value)} rows={2} />
              </Field>
            </div>
          )}
        </div>
        <DialogFooter>
          <DialogClose asChild><Button variant="outline">Cancel</Button></DialogClose>
          <Button onClick={submit} disabled={!valid || busy}>{busy ? "Submitting…" : "Submit"}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
