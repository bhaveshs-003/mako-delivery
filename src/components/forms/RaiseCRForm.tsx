"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogTrigger, DialogClose } from "@/components/ui/dialog";
import { Input, Textarea, Field } from "@/components/ui/form-field";
import { toast } from "@/components/ui/toast";
import { apiFetch } from "@/lib/http";

export function RaiseCRForm({ projectId }: { projectId: string }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [scopeDelta, setScopeDelta] = useState("");
  const [days, setDays] = useState(0);
  const [effort, setEffort] = useState("");

  async function submit() {
    setBusy(true);
    try {
      await apiFetch("/api/change-requests", {
        method: "POST",
        body: JSON.stringify({ projectId, scopeDelta, timelineImpactDays: Number(days), effortImpactDescription: effort }),
      });
      toast.success("Change request raised");
      setOpen(false);
      setScopeDelta("");
      setDays(0);
      setEffort("");
      router.refresh();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to raise CR");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm"><Plus className="h-4 w-4" /> Raise CR</Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader><DialogTitle>Raise Change Request</DialogTitle></DialogHeader>
        <div className="space-y-4">
          <Field label="Scope Delta" required>
            <Textarea value={scopeDelta} onChange={(e) => setScopeDelta(e.target.value)} rows={3} placeholder="What changed vs. the original scope?" />
          </Field>
          <div className="grid grid-cols-2 gap-4">
            <Field label="Timeline Impact (days)">
              <Input type="number" min={0} value={days} onChange={(e) => setDays(Number(e.target.value))} />
            </Field>
          </div>
          <Field label="Effort Impact">
            <Textarea value={effort} onChange={(e) => setEffort(e.target.value)} rows={2} />
          </Field>
        </div>
        <DialogFooter>
          <DialogClose asChild><Button variant="outline">Cancel</Button></DialogClose>
          <Button onClick={submit} disabled={!scopeDelta.trim() || busy}>{busy ? "Saving…" : "Raise"}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
