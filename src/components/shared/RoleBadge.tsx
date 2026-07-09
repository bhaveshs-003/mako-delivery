import type { UserRole } from "@prisma/client";
import { cn } from "@/lib/utils";
import { ROLE_LABELS } from "@/lib/constants";

const ROLE_STYLES: Record<UserRole, string> = {
  super_admin: "bg-navy/10 text-navy border-navy/20",
  admin: "bg-steel/10 text-steel border-steel/20",
  sub_admin: "bg-blue-50 text-blue-700 border-blue-200",
  rl_user: "bg-[#7C3AED]/10 text-[#7C3AED] border-[#7C3AED]/30",
  resource: "bg-gray-100 text-gray-600 border-gray-200",
};

export function RoleBadge({ role, className }: { role: UserRole; className?: string }) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full border px-2 py-0.5 text-xs font-medium",
        ROLE_STYLES[role],
        className
      )}
    >
      {ROLE_LABELS[role]}
    </span>
  );
}
