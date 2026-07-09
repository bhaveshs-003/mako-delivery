"use client";

import { useRouter, useSearchParams, usePathname } from "next/navigation";
import { Select, Input } from "@/components/ui/form-field";
import { useCallback } from "react";

// Filter bar for the projects list (spec §5.2). State lives in URL params so it
// is bookmarkable and survives navigation (spec §6.2 rule 4).
export function ProjectsFilters() {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();

  const setParam = useCallback(
    (key: string, value: string) => {
      const next = new URLSearchParams(params.toString());
      if (value) next.set(key, value);
      else next.delete(key);
      router.replace(`${pathname}?${next.toString()}`);
    },
    [params, pathname, router]
  );

  return (
    <div className="flex flex-wrap items-center gap-2">
      <Select
        className="w-auto"
        value={params.get("type") ?? ""}
        onChange={(e) => setParam("type", e.target.value)}
      >
        <option value="">All types</option>
        <option value="migration">Migration</option>
        <option value="integration">Integration</option>
        <option value="custom_app">Custom App</option>
      </Select>
      <Select
        className="w-auto"
        value={params.get("status") ?? ""}
        onChange={(e) => setParam("status", e.target.value)}
      >
        <option value="">All statuses</option>
        <option value="not_started">Not Started</option>
        <option value="in_progress">In Progress</option>
        <option value="paused">Paused</option>
        <option value="completed">Completed</option>
        <option value="delivered">Delivered</option>
      </Select>
      <Input
        className="w-48"
        placeholder="Search title…"
        defaultValue={params.get("q") ?? ""}
        onChange={(e) => setParam("q", e.target.value)}
      />
      <label className="ml-1 flex items-center gap-1.5 text-sm text-slate">
        <input
          type="checkbox"
          checked={params.get("archived") === "1"}
          onChange={(e) => setParam("archived", e.target.checked ? "1" : "")}
        />
        Show archived
      </label>
    </div>
  );
}
