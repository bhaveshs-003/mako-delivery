"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Input } from "@/components/ui/form-field";
import { Button } from "@/components/ui/button";
import { toast } from "@/components/ui/toast";
import { apiFetch } from "@/lib/http";

type Row = {
  dependencyType: string;
  thresholdDays: number;
  approvalSlaDays: number;
};

export function SlaEditor({ initial }: { initial: Row[] }) {
  const router = useRouter();
  const [rows, setRows] = useState<Row[]>(initial);
  const [savingType, setSavingType] = useState<string | null>(null);

  function update(type: string, field: "thresholdDays" | "approvalSlaDays", value: number) {
    setRows((r) => r.map((row) => (row.dependencyType === type ? { ...row, [field]: value } : row)));
  }

  async function save(row: Row) {
    setSavingType(row.dependencyType);
    try {
      await apiFetch("/api/settings/sla", {
        method: "PUT",
        body: JSON.stringify(row),
      });
      toast.success(`SLA for ${row.dependencyType.replace(/_/g, " ")} saved`);
      router.refresh();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to save");
    } finally {
      setSavingType(null);
    }
  }

  return (
    <table className="w-full text-sm">
      <thead>
        <tr className="border-b border-border bg-bg text-left text-xs uppercase tracking-wide text-slate">
          <th className="px-4 py-3 font-medium">Dependency Type</th>
          <th className="px-4 py-3 font-medium">Threshold (days)</th>
          <th className="px-4 py-3 font-medium">Approval SLA (days)</th>
          <th className="px-4 py-3 font-medium text-right">Save</th>
        </tr>
      </thead>
      <tbody>
        {rows.map((row) => (
          <tr key={row.dependencyType} className="border-b border-border last:border-0">
            <td className="px-4 py-3 capitalize text-navy">
              {row.dependencyType.replace(/_/g, " ")}
            </td>
            <td className="px-4 py-3">
              <Input
                type="number"
                min={0}
                className="w-24"
                value={row.thresholdDays}
                onChange={(e) => update(row.dependencyType, "thresholdDays", Number(e.target.value))}
              />
            </td>
            <td className="px-4 py-3">
              <Input
                type="number"
                min={0}
                className="w-24"
                value={row.approvalSlaDays}
                onChange={(e) => update(row.dependencyType, "approvalSlaDays", Number(e.target.value))}
              />
            </td>
            <td className="px-4 py-3 text-right">
              <Button size="sm" variant="outline" onClick={() => save(row)} disabled={savingType === row.dependencyType}>
                {savingType === row.dependencyType ? "Saving…" : "Save"}
              </Button>
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}
