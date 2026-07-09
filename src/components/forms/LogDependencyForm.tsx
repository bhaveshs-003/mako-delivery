"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Plus } from "lucide-react";
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
import { apiFetch } from "@/lib/http";

const TODAY = new Date().toISOString().slice(0, 10);

export function LogDependencyForm({
  projectId,
  slaDefaults,
  milestones,
}: {
  projectId: string;
  slaDefaults: Record<string, number>;
  milestones: { id: string; name: string }[];
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);

  const [type, setType] = useState("credential");
  const [description, setDescription] = useState("");
  const [from, setFrom] = useState("rl");
  const [dateRequested, setDateRequested] = useState(TODAY);
  const [sla, setSla] = useState(slaDefaults["credential"] ?? 5);
  const [milestoneId, setMilestoneId] = useState("");

  function onTypeChange(t: string) {
    setType(t);
    setSla(slaDefaults[t] ?? 5); // auto-fill from org SLA config (spec §5.3.3)
  }

  const valid = description.trim() && dateRequested && sla >= 0;

  async function submit() {
    setBusy(true);
    try {
      await apiFetch("/api/dependencies", {
        method: "POST",
        body: JSON.stringify({
          projectId,
          milestoneId: milestoneId || null,
          type,
          description,
          requestedFromParty: from,
          dateRequested,
          slaThresholdDays: Number(sla),
        }),
      });
      toast.success("Dependency logged");
      setOpen(false);
      setDescription("");
      setMilestoneId("");
      router.refresh();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to log dependency");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm">
          <Plus className="h-4 w-4" /> Log Dependency
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Log Dependency</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <Field label="Type" required>
              <Select value={type} onChange={(e) => onTypeChange(e.target.value)}>
                <option value="credential">Credential</option>
                <option value="source_sheet">Source Sheet</option>
                <option value="approval">Approval</option>
                <option value="clarification">Clarification</option>
                <option value="confirmation">Confirmation</option>
                <option value="other">Other</option>
              </Select>
            </Field>
            <Field label="Requested From" required>
              <Select value={from} onChange={(e) => setFrom(e.target.value)}>
                <option value="mako">Mako</option>
                <option value="rl">Rocketlane</option>
                <option value="client_via_rl">Client-via-RL</option>
              </Select>
            </Field>
          </div>
          <Field label="Description" required>
            <Textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={2} />
          </Field>
          <div className="grid grid-cols-2 gap-4">
            <Field label="Date Requested" required>
              <Input type="date" max={TODAY} value={dateRequested} onChange={(e) => setDateRequested(e.target.value)} />
            </Field>
            <Field label="SLA Threshold (days)" required hint="Auto-filled from org config">
              <Input type="number" min={0} value={sla} onChange={(e) => setSla(Number(e.target.value))} />
            </Field>
          </div>
          {milestones.length > 0 && (
            <Field label="Linked Milestone">
              <Select value={milestoneId} onChange={(e) => setMilestoneId(e.target.value)}>
                <option value="">— None —</option>
                {milestones.map((m) => (
                  <option key={m.id} value={m.id}>{m.name}</option>
                ))}
              </Select>
            </Field>
          )}
        </div>
        <DialogFooter>
          <DialogClose asChild>
            <Button variant="outline">Cancel</Button>
          </DialogClose>
          <Button onClick={submit} disabled={!valid || busy}>
            {busy ? "Saving…" : "Save"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
