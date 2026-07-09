"use client";

import Link from "next/link";
import { Bell } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { apiFetch } from "@/lib/http";

export function NotificationBell() {
  const { data } = useQuery({
    queryKey: ["notif-count"],
    queryFn: () => apiFetch<{ unread: number }>("/api/notifications"),
    refetchInterval: 60_000,
  });
  const unread = data?.unread ?? 0;

  return (
    <Link
      href="/notifications"
      className="relative flex h-9 w-9 items-center justify-center rounded-md text-slate hover:bg-bg hover:text-navy"
      aria-label="Notifications"
    >
      <Bell className="h-5 w-5" />
      {unread > 0 && (
        <span className="absolute -right-0.5 -top-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-danger px-1 text-[10px] font-semibold text-white">
          {unread > 9 ? "9+" : unread}
        </span>
      )}
    </Link>
  );
}
