"use client";

import { useEffect, useState } from "react";
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

type PickUser = { id: string; name: string; email: string; role: string };

export function CreateProjectForm() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [leads, setLeads] = useState<PickUser[]>([]);
  const [rlUsers, setRlUsers] = useState<PickUser[]>([]);
  const [resources, setResources] = useState<PickUser[]>([]);

  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [type, setType] = useState("migration");
  const [rlStart, setRlStart] = useState("");
  const [rlEnd, setRlEnd] = useState("");
  const [makoStart, setMakoStart] = useState("");
  const [makoEnd, setMakoEnd] = useState("");
  const [leadId, setLeadId] = useState("");
  const [rlIds, setRlIds] = useState<string[]>([]);
  const [resIds, setResIds] = useState<string[]>([]);
  useEffect(() => {
    if (!open) return;
    Promise.all([
      apiFetch<PickUser[]>("/api/users?role=sub_admin"),
      apiFetch<PickUser[]>("/api/users?role=rl_user"),
      apiFetch<PickUser[]>("/api/users?role=resource"),
    ])
      .then(([l, r, res]) => {
        setLeads(l);
        setRlUsers(r);
        setResources(res);
      })
      .catch(() => toast.error("Failed to load assignable users"));
  }, [open]);

  const valid = title.trim();
  const dayCount = (a: string, b: string) =>
    a && b ? Math.max(0, Math.round((+new Date(b) - +new Date(a)) / 86400000)) : null;
  const rlDays = dayCount(rlStart, rlEnd);
  const makoDays = dayCount(makoStart, makoEnd);

  async function submit() {
    setLoading(true);
    try {
      await apiFetch("/api/projects", {
        method: "POST",
        body: JSON.stringify({
          title,
          description,
          type,
          rlStartDate: rlStart || null,
          rlCommittedDeadline: rlEnd || null,
          makoStartDate: makoStart || null,
          makoInternalDeadline: makoEnd || null,
          projectLeadId: leadId || null,
          rlConsultantIds: rlIds,
          resourceIds: resIds,
        }),
      });
      toast.success("Project created");
      setOpen(false);
      resetForm();
      router.refresh();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to create project");
    } finally {
      setLoading(false);
    }
  }

  function resetForm() {
    setTitle("");
    setDescription("");
    setType("migration");
    setRlStart("");
    setRlEnd("");
    setMakoStart("");
    setMakoEnd("");
    setLeadId("");
    setRlIds([]);
    setResIds([]);
  }

  function toggleMulti(list: string[], setList: (v: string[]) => void, id: string) {
    setList(list.includes(id) ? list.filter((x) => x !== id) : [...list, id]);
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button>
          <Plus className="h-4 w-4" /> New Project
        </Button>
      </DialogTrigger>
      <DialogContent size="lg">
        <DialogHeader>
          <DialogTitle>Create Project</DialogTitle>
        </DialogHeader>

        <div className="max-h-[65vh] space-y-4 overflow-y-auto pr-1">
          <Field label="Title" required>
            <Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Alpha Corp Data Migration" />
          </Field>

          <div className="grid grid-cols-2 gap-4">
            <Field label="Type" required>
              <Select value={type} onChange={(e) => setType(e.target.value)}>
                <option value="migration">Migration</option>
                <option value="integration">Integration</option>
                <option value="custom_app">Custom App</option>
              </Select>
            </Field>
            <Field label="Project Lead (Sub-admin)">
              <Select value={leadId} onChange={(e) => setLeadId(e.target.value)}>
                <option value="">— Unassigned —</option>
                {leads.map((u) => (
                  <option key={u.id} value={u.id}>{u.name}</option>
                ))}
              </Select>
            </Field>
          </div>

          {/* RL timeline */}
          <div className="rounded-lg border border-line bg-surface-2/40 p-3">
            <div className="mb-2 flex items-center justify-between">
              <p className="text-xs font-semibold uppercase tracking-wide text-muted">RL Timeline</p>
              {rlDays !== null && (
                <span className="tabular text-2xs font-medium text-brand-ink">
                  {rlDays} day{rlDays === 1 ? "" : "s"} proposed
                </span>
              )}
            </div>
            <div className="grid grid-cols-2 gap-4">
              <Field label="Start date" hint="Optional">
                <Input type="date" value={rlStart} max={rlEnd || undefined} onChange={(e) => setRlStart(e.target.value)} />
              </Field>
              <Field label="End date (committed)">
                <Input type="date" value={rlEnd} min={rlStart || undefined} onChange={(e) => setRlEnd(e.target.value)} />
              </Field>
            </div>
          </div>

          {/* Mako timeline */}
          <div className="rounded-lg border border-line bg-surface-2/40 p-3">
            <div className="mb-2 flex items-center justify-between">
              <p className="text-xs font-semibold uppercase tracking-wide text-muted">Mako Timeline</p>
              {makoDays !== null && (
                <span className="tabular text-2xs font-medium text-brand-ink">
                  {makoDays} day{makoDays === 1 ? "" : "s"} promised
                </span>
              )}
            </div>
            <div className="grid grid-cols-2 gap-4">
              <Field label="Start date" hint="Optional">
                <Input type="date" value={makoStart} max={makoEnd || undefined} onChange={(e) => setMakoStart(e.target.value)} />
              </Field>
              <Field label="End date (promised)">
                <Input type="date" value={makoEnd} min={makoStart || undefined} onChange={(e) => setMakoEnd(e.target.value)} />
              </Field>
            </div>
          </div>

          <Field label="Description">
            <Textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={2} />
          </Field>

          <Field label="RL Consultants (POC)">
            <MultiPicker users={rlUsers} selected={rlIds} onToggle={(id) => toggleMulti(rlIds, setRlIds, id)} />
          </Field>
          <Field label="Mako Resources">
            <MultiPicker users={resources} selected={resIds} onToggle={(id) => toggleMulti(resIds, setResIds, id)} />
          </Field>

          <p className="rounded-md border border-line bg-surface-2/50 px-3 py-2 text-xs text-muted">
            No milestones are pre-loaded. After creating the project, add
            milestones on the Lifecycle tab and submit each to the RL POC for approval.
          </p>
        </div>

        <DialogFooter>
          <DialogClose asChild>
            <Button variant="outline">Cancel</Button>
          </DialogClose>
          <Button onClick={submit} disabled={!valid || loading}>
            {loading ? "Creating…" : "Create Project"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function MultiPicker({
  users,
  selected,
  onToggle,
}: {
  users: PickUser[];
  selected: string[];
  onToggle: (id: string) => void;
}) {
  if (users.length === 0)
    return <p className="text-xs text-slate">No users available.</p>;
  return (
    <div className="flex flex-wrap gap-1.5">
      {users.map((u) => {
        const on = selected.includes(u.id);
        return (
          <button
            key={u.id}
            type="button"
            onClick={() => onToggle(u.id)}
            className={`rounded-full border px-2.5 py-1 text-xs transition-colors ${
              on
                ? "border-steel bg-steel text-white"
                : "border-border bg-surface text-slate hover:border-border-strong"
            }`}
          >
            {u.name}
          </button>
        );
      })}
    </div>
  );
}
