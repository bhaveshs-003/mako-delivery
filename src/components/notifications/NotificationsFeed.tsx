"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/shared/EmptyState";
import { toast } from "@/components/ui/toast";
import { apiFetch } from "@/lib/http";
import { Bell } from "lucide-react";

export type NotifItem = {
  id: string;
  type: string;
  title: string;
  body: string | null;
  isRead: boolean;
  createdAt: string;
  deepLinkPath: string | null;
};

export function NotificationsFeed({ initial }: { initial: NotifItem[] }) {
  const router = useRouter();
  const [items, setItems] = useState(initial);
  const [filter, setFilter] = useState<"all" | "unread">("all");

  async function markAllRead() {
    try {
      await apiFetch("/api/notifications", { method: "PATCH", body: JSON.stringify({ action: "read_all" }) });
      setItems((prev) => prev.map((i) => ({ ...i, isRead: true })));
      router.refresh();
    } catch {
      toast.error("Failed to mark read");
    }
  }

  async function open(item: NotifItem) {
    if (!item.isRead) {
      await apiFetch("/api/notifications", { method: "PATCH", body: JSON.stringify({ action: "read", id: item.id }) }).catch(() => {});
      setItems((prev) => prev.map((i) => (i.id === item.id ? { ...i, isRead: true } : i)));
    }
  }

  const shown = filter === "unread" ? items.filter((i) => !i.isRead) : items;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex gap-1 rounded-md border border-border bg-surface p-0.5">
          {(["all", "unread"] as const).map((f) => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={`rounded px-3 py-1 text-sm capitalize ${filter === f ? "bg-steel text-white" : "text-slate hover:text-navy"}`}
            >
              {f}
            </button>
          ))}
        </div>
        <Button size="sm" variant="outline" onClick={markAllRead}>Mark all as read</Button>
      </div>

      {shown.length === 0 ? (
        <EmptyState icon={Bell} title="Nothing here" subtitle="You're all caught up." />
      ) : (
        <div className="divide-y divide-border overflow-hidden rounded-lg border border-border bg-surface shadow-card">
          {shown.map((n) => {
            const inner = (
              <div className={`flex items-start gap-3 px-4 py-3 ${!n.isRead ? "bg-blue-50/40" : ""}`}>
                <span className={`mt-1.5 h-2 w-2 shrink-0 rounded-full ${n.isRead ? "bg-transparent" : "bg-info"}`} />
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium text-navy">{n.title}</p>
                  {n.body && <p className="mt-0.5 text-sm text-slate">{n.body}</p>}
                  <p className="mt-1 text-xs text-slate">{new Date(n.createdAt).toLocaleString()}</p>
                </div>
              </div>
            );
            return n.deepLinkPath ? (
              <Link key={n.id} href={n.deepLinkPath} onClick={() => open(n)} className="block hover:bg-bg">
                {inner}
              </Link>
            ) : (
              <button key={n.id} onClick={() => open(n)} className="block w-full text-left hover:bg-bg">
                {inner}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
