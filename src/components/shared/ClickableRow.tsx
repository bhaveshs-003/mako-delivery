"use client";

import { useRouter } from "next/navigation";
import { cn } from "@/lib/utils";

/** A table row that navigates to `href` when clicked anywhere. */
export function ClickableRow({
  href,
  className,
  children,
}: {
  href: string;
  className?: string;
  children: React.ReactNode;
}) {
  const router = useRouter();
  return (
    <tr
      onClick={() => router.push(href)}
      className={cn("cursor-pointer", className)}
    >
      {children}
    </tr>
  );
}
