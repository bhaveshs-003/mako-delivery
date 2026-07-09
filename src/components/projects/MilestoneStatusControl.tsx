"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Select } from "@/components/ui/form-field";
import { toast } from "@/components/ui/toast";
import { apiFetch } from "@/lib/http";

const OPTIONS = [
  { value: "yet_to_start", label: "Yet to Start" },
  { value: "ongoing", label: "Ongoing" },
  { value: "submitted", label: "Submitted" },
  { value: "revision_requested", label: "Revision Requested" },
  { value: "completed", label: "Completed" },
];

export function MilestoneStatusControl({
  milestoneId,
  status,
}: {
  milestoneId: string;
  status: string;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);

  async function onChange(next: string) {
    setBusy(true);
    try {
      await apiFetch(`/api/milestones/${milestoneId}`, {
        method: "PATCH",
        body: JSON.stringify({ action: "status", status: next }),
      });
      toast.success("Milestone updated");
      router.refresh();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Update failed");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Select
      className="h-7 w-40 text-xs"
      value={status}
      disabled={busy}
      onChange={(e) => onChange(e.target.value)}
    >
      {OPTIONS.map((o) => (
        <option key={o.value} value={o.value}>{o.label}</option>
      ))}
    </Select>
  );
}
