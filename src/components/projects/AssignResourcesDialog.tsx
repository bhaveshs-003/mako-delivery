"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Users } from "lucide-react";
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
import { Field } from "@/components/ui/form-field";
import { toast } from "@/components/ui/toast";
import { apiFetch } from "@/lib/http";

type Person = { id: string; name: string; role: string };

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
            <Picker
              people={resources}
              selected={resIds}
              onToggle={(id) => toggle(resIds, setResIds, id)}
            />
          </Field>
          <Field label="RL Consultants (POC)">
            <Picker
              people={rlUsers}
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

function Picker({
  people,
  selected,
  onToggle,
}: {
  people: Person[];
  selected: string[];
  onToggle: (id: string) => void;
}) {
  if (people.length === 0) return <p className="text-xs text-muted">No users available.</p>;
  return (
    <div className="flex flex-wrap gap-1.5">
      {people.map((p) => {
        const on = selected.includes(p.id);
        return (
          <button
            key={p.id}
            type="button"
            onClick={() => onToggle(p.id)}
            className={`rounded-full border px-2.5 py-1 text-xs transition-colors ${
              on
                ? "border-brand bg-brand text-white"
                : "border-line bg-surface text-ink-2 hover:border-line-strong"
            }`}
          >
            {p.name}
          </button>
        );
      })}
    </div>
  );
}
