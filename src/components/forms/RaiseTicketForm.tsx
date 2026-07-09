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

export function RaiseTicketForm({
  availableProjects,
  rlUsers,
  defaultProjectId,
}: {
  availableProjects: { id: string; title: string }[];
  rlUsers: { id: string; name: string }[];
  defaultProjectId?: string;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [type, setType] = useState("product_bug");
  const [priority, setPriority] = useState("medium");
  const [projectIds, setProjectIds] = useState<string[]>(defaultProjectId ? [defaultProjectId] : []);
  const [assignedToId, setAssignedToId] = useState("");

  const valid = title.trim() && description.trim() && projectIds.length > 0;

  function toggleProject(id: string) {
    setProjectIds((p) => (p.includes(id) ? p.filter((x) => x !== id) : [...p, id]));
  }

  async function submit() {
    setBusy(true);
    try {
      await apiFetch("/api/tickets", {
        method: "POST",
        body: JSON.stringify({ title, description, type, priority, projectIds, assignedToId: assignedToId || null }),
      });
      toast.success("Ticket raised");
      setOpen(false);
      setTitle("");
      setDescription("");
      setProjectIds(defaultProjectId ? [defaultProjectId] : []);
      router.refresh();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to raise ticket");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm">
          <Plus className="h-4 w-4" /> Raise Ticket
        </Button>
      </DialogTrigger>
      <DialogContent size="lg">
        <DialogHeader>
          <DialogTitle>Raise Ticket</DialogTitle>
        </DialogHeader>
        <div className="max-h-[65vh] space-y-4 overflow-y-auto pr-1">
          <Field label="Title" required>
            <Input value={title} onChange={(e) => setTitle(e.target.value)} />
          </Field>
          <div className="grid grid-cols-2 gap-4">
            <Field label="Type" required>
              <Select value={type} onChange={(e) => setType(e.target.value)}>
                <option value="product_bug">Product Bug</option>
                <option value="api_change">API Change</option>
                <option value="escalation">Escalation</option>
                <option value="clarification">Clarification</option>
                <option value="dependency">Dependency</option>
                <option value="requisites">Requisites</option>
              </Select>
            </Field>
            <Field label="Priority" required>
              <Select value={priority} onChange={(e) => setPriority(e.target.value)}>
                <option value="low">Low</option>
                <option value="medium">Medium</option>
                <option value="high">High</option>
                <option value="critical">Critical</option>
              </Select>
            </Field>
          </div>
          <Field label="Description" required>
            <Textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={3} />
          </Field>
          <Field label="Affected Projects" required hint="A ticket must link to at least one project">
            <div className="flex flex-wrap gap-1.5">
              {availableProjects.map((p) => {
                const on = projectIds.includes(p.id);
                return (
                  <button
                    key={p.id}
                    type="button"
                    onClick={() => toggleProject(p.id)}
                    className={`rounded-full border px-2.5 py-1 text-xs ${on ? "border-steel bg-steel text-white" : "border-border bg-surface text-slate hover:border-border-strong"}`}
                  >
                    {p.title}
                  </button>
                );
              })}
            </div>
          </Field>
          <Field label="Assign to (RL user)">
            <Select value={assignedToId} onChange={(e) => setAssignedToId(e.target.value)}>
              <option value="">— Unassigned —</option>
              {rlUsers.map((u) => (
                <option key={u.id} value={u.id}>{u.name}</option>
              ))}
            </Select>
          </Field>
        </div>
        <DialogFooter>
          <DialogClose asChild>
            <Button variant="outline">Cancel</Button>
          </DialogClose>
          <Button onClick={submit} disabled={!valid || busy}>
            {busy ? "Raising…" : "Raise Ticket"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
