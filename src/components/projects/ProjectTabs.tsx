"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { cn } from "@/lib/utils";

type Tab = { key: string; label: string };

/**
 * Project tab bar that highlights a tab when it has a new item or status change
 * the user hasn't viewed yet. "Seen" state is tracked per user in localStorage
 * (keyed by project + tab); a tab dots when its latest activity timestamp is
 * newer than the last time the user opened it, or when it needs a decision.
 */
export function ProjectTabs({
  projectId,
  tabs,
  activeTab,
  activity,
  attention,
}: {
  projectId: string;
  tabs: Tab[];
  activeTab: string;
  activity: Record<string, number>;
  attention: Record<string, boolean>;
}) {
  const storageKey = `mako:tabseen:${projectId}`;
  const [seen, setSeen] = useState<Record<string, number>>({});

  useEffect(() => {
    let map: Record<string, number> = {};
    try {
      map = JSON.parse(localStorage.getItem(storageKey) || "{}");
    } catch {
      map = {};
    }
    // Opening a tab marks it seen up to its latest activity.
    map[activeTab] = Math.max(map[activeTab] ?? 0, activity[activeTab] ?? Date.now());
    localStorage.setItem(storageKey, JSON.stringify(map));
    setSeen(map);
  }, [projectId, activeTab]); // eslint-disable-line react-hooks/exhaustive-deps

  const hasDot = (key: string) =>
    !!attention[key] || (!!activity[key] && activity[key] > (seen[key] ?? 0));

  return (
    <div className="sticky top-0 z-20 -mx-6 border-b border-line bg-canvas/85 px-6 backdrop-blur">
      <nav className="scroll-slim flex gap-5 overflow-x-auto">
        {tabs.map((tab) => {
          const active = activeTab === tab.key;
          return (
            <Link
              key={tab.key}
              href={`/projects/${projectId}?tab=${tab.key}`}
              className={cn(
                "-mb-px inline-flex items-center gap-1.5 whitespace-nowrap border-b-2 px-0.5 py-2.5 text-sm transition-colors",
                active
                  ? "border-brand font-medium text-ink"
                  : "border-transparent text-muted hover:text-ink"
              )}
            >
              {tab.label}
              {hasDot(tab.key) && !active && (
                <span className="h-1.5 w-1.5 rounded-full bg-warning" title="New activity" />
              )}
            </Link>
          );
        })}
      </nav>
    </div>
  );
}
