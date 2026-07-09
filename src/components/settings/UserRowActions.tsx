"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { toast } from "@/components/ui/toast";
import { apiFetch } from "@/lib/http";

export function UserRowActions({
  userId,
  isActive,
}: {
  userId: string;
  isActive: boolean;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);

  async function toggle() {
    setBusy(true);
    try {
      await apiFetch(`/api/users/${userId}`, {
        method: "PATCH",
        body: JSON.stringify({ action: isActive ? "deactivate" : "reactivate" }),
      });
      toast.success(isActive ? "User deactivated" : "User reactivated");
      router.refresh();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Action failed");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Button
      size="sm"
      variant={isActive ? "outline" : "secondary"}
      onClick={toggle}
      disabled={busy}
    >
      {isActive ? "Deactivate" : "Reactivate"}
    </Button>
  );
}
