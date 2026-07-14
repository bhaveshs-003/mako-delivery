"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { ChevronUp, ChevronDown } from "lucide-react";
import { toast } from "@/components/ui/toast";
import { apiFetch } from "@/lib/http";

/** Up/down controls that swap a milestone's order with its neighbour. */
export function MilestoneReorder({
  milestoneId,
  isFirst,
  isLast,
}: {
  milestoneId: string;
  isFirst: boolean;
  isLast: boolean;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);

  async function move(direction: "up" | "down") {
    setBusy(true);
    try {
      await apiFetch(`/api/milestones/${milestoneId}`, {
        method: "PATCH",
        body: JSON.stringify({ action: "reorder", direction }),
      });
      router.refresh();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to reorder");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex flex-col">
      <button
        type="button"
        disabled={busy || isFirst}
        onClick={() => move("up")}
        className="text-muted transition-colors hover:text-ink disabled:opacity-30"
        title="Move up"
      >
        <ChevronUp className="h-3.5 w-3.5" />
      </button>
      <button
        type="button"
        disabled={busy || isLast}
        onClick={() => move("down")}
        className="text-muted transition-colors hover:text-ink disabled:opacity-30"
        title="Move down"
      >
        <ChevronDown className="h-3.5 w-3.5" />
      </button>
    </div>
  );
}
