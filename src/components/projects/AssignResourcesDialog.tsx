"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Users, Check } from "lucide-react";
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
import { Input, Field } from "@/components/ui/form-field";
import { toast } from "@/components/ui/toast";
import { apiFetch } from "@/lib/http";
import { ROLE_LABELS } from "@/lib/constants";
import type { UserRole } from "@prisma/client";

type Person = { id: string; name: string; role: UserRole; designation: string | null };

/** "Software Engineer" (designation) or the RBAC role label as a fallback. */
function subtitleFor(p: Person): string {
  return p.designation?.trim() || ROLE_LABELS[p.role] || "";
}

/**
 * Add/remove project members at any time (spec §5.3 "Assign Resources").
 * Preselects current assignments; saving sends the full set to the assign action.
 */
export function AssignResourcesDialog({
  projectId,
  currentResourceIds,
  currentConsultantIds,
}: {
  projectId: string;
  currentResourceIds: string[];
  currentConsultantIds: string[];
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [resources, setResources] = useState<Person[]>([]);
  const [rlUsers, setRlUsers] = useState<Person[]>([]);
  const [resIds, setResIds] = useState<string[]>(currentResourceIds);
  const [rlIds, setRlIds] = useState<string[]>(currentConsultantIds);
  const [resQuery, setResQuery] = useState("");
  const [rlQuery, setRlQuery] = useState("");

  useEffect(() => {
    if (!open) return;
    setResIds(currentResourceIds);
    setRlIds(currentConsultantIds);
    Promise.all([
      apiFetch<Person[]>("/api/users?role=resource"),
      apiFetch<Person[]>("/api/users?role=rl_user"),
    ])
      .then(([r, rl]) => {
        setResources(r);
        setRlUsers(rl);
      })
      .catch(() => toast.error("Failed to load users"));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  function toggle(list: string[], set: (v: string[]) => void, id: string) {
    set(list.includes(id) ? list.filter((x) => x !== id) : [...list, id]);
  }

  async function save() {
    setBusy(true);
    try {
      await apiFetch(`/api/projects/${projectId}`, {
        method: "PATCH",
        body: JSON.stringify({ action: "assign", resourceIds: resIds, rlConsultantIds: rlIds }),
      });
      toast.success("Project team updated");
      setOpen(false);
      router.refresh();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to update team");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm" variant="outline">
          <Users className="h-4 w-4" /> Assign
        </Button>
      </DialogTrigger>
      <DialogContent size="lg">
        <DialogHeader>
          <DialogTitle>Assign Team</DialogTitle>
        </DialogHeader>
        <div className="max-h-[60vh] space-y-4 overflow-y-auto pr-1">
          <Field label="Mako Resources" hint="Add or remove resources at any time">
            <Input
              placeholder="Search by name or role…"
              value={resQuery}
              onChange={(e) => setResQuery(e.target.value)}
              className="mb-2"
            />
            <Picker
              people={filterPeople(resources, resQuery)}
              selected={resIds}
              onToggle={(id) => toggle(resIds, setResIds, id)}
            />
          </Field>
          <Field label="RL Consultants (POC)">
            <Input
              placeholder="Search by name or role…"
              value={rlQuery}
              onChange={(e) => setRlQuery(e.target.value)}
              className="mb-2"
            />
            <Picker
              people={filterPeople(rlUsers, rlQuery)}
              selected={rlIds}
              onToggle={(id) => toggle(rlIds, setRlIds, id)}
            />
          </Field>
        </div>
        <DialogFooter>
          <DialogClose asChild>
            <Button variant="outline">Cancel</Button>
          </DialogClose>
          <Button onClick={save} disabled={busy}>
            {busy ? "Saving…" : "Save Team"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function filterPeople(people: Person[], query: string): Person[] {
  const q = query.trim().toLowerCase();
  if (!q) return people;
  return people.filter(
    (p) => p.name.toLowerCase().includes(q) || subtitleFor(p).toLowerCase().includes(q)
  );
}

function Picker({
  people,
  selected,
  onToggle,
}: {
  people: Person[];
  selected: string[];
  onToggle: (id: string) => void;
}) {
  if (people.length === 0) return <p className="text-xs text-muted">No matching users.</p>;
  return (
    <div className="flex flex-col gap-1.5">
      {people.map((p) => {
        const on = selected.includes(p.id);
        return (
          <button
            key={p.id}
            type="button"
            onClick={() => onToggle(p.id)}
            className={`flex items-center justify-between rounded-lg border px-3 py-2 text-left text-sm transition-colors ${
              on
                ? "border-brand bg-brand/5"
                : "border-line bg-surface hover:border-line-strong"
            }`}
          >
            <span className="flex items-center gap-2">
              <span
                className={`flex h-4 w-4 items-center justify-center rounded-[4px] border ${
                  on ? "border-brand bg-brand text-white" : "border-line-strong"
                }`}
              >
                {on && <Check className="h-3 w-3" />}
              </span>
              <span className="font-medium text-ink">{p.name}</span>
              <span className="text-2xs text-muted">— {subtitleFor(p)}</span>
            </span>
          </button>
        );
      })}
    </div>
  );
}
