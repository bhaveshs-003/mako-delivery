"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogTrigger, DialogClose } from "@/components/ui/dialog";
import { Input, Field } from "@/components/ui/form-field";
import { toast } from "@/components/ui/toast";
import { apiFetch } from "@/lib/http";

export function LogMeetingForm({
  projectId,
  attendeeOptions,
}: {
  projectId: string;
  attendeeOptions: { id: string; name: string }[];
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [title, setTitle] = useState("");
  const [meetingDate, setMeetingDate] = useState("");
  const [link, setLink] = useState("");
  const [attendees, setAttendees] = useState<string[]>([]);

  async function submit() {
    setBusy(true);
    try {
      await apiFetch("/api/meetings", {
        method: "POST",
        body: JSON.stringify({ projectId, title, meetingDate, meetingLink: link, attendeeIds: attendees }),
      });
      toast.success("Meeting logged");
      setOpen(false);
      setTitle("");
      setMeetingDate("");
      setLink("");
      setAttendees([]);
      router.refresh();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to log meeting");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm"><Plus className="h-4 w-4" /> Log Meeting</Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader><DialogTitle>Log Meeting</DialogTitle></DialogHeader>
        <div className="space-y-4">
          <Field label="Title" required><Input value={title} onChange={(e) => setTitle(e.target.value)} /></Field>
          <Field label="Date & Time" required><Input type="datetime-local" value={meetingDate} onChange={(e) => setMeetingDate(e.target.value)} /></Field>
          <Field label="Meeting Link"><Input value={link} onChange={(e) => setLink(e.target.value)} placeholder="https://…" /></Field>
          <Field label="Attendees">
            <div className="flex flex-wrap gap-1.5">
              {attendeeOptions.map((u) => {
                const on = attendees.includes(u.id);
                return (
                  <button key={u.id} type="button" onClick={() => setAttendees((a) => on ? a.filter((x) => x !== u.id) : [...a, u.id])}
                    className={`rounded-full border px-2.5 py-1 text-xs ${on ? "border-steel bg-steel text-white" : "border-border bg-surface text-slate hover:border-border-strong"}`}>
                    {u.name}
                  </button>
                );
              })}
            </div>
          </Field>
        </div>
        <DialogFooter>
          <DialogClose asChild><Button variant="outline">Cancel</Button></DialogClose>
          <Button onClick={submit} disabled={!title.trim() || !meetingDate || busy}>{busy ? "Saving…" : "Create"}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
