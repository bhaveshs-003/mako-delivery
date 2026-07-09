import { cn } from "@/lib/utils";

function initials(name: string): string {
  return name
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase())
    .join("");
}

export function UserAvatar({
  name,
  deactivated = false,
  size = "md",
  className,
}: {
  name: string;
  deactivated?: boolean;
  size?: "sm" | "md" | "lg";
  className?: string;
}) {
  const sizes = {
    sm: "h-6 w-6 text-[10px]",
    md: "h-8 w-8 text-xs",
    lg: "h-10 w-10 text-sm",
  };
  return (
    <span
      title={deactivated ? `${name} (Deactivated)` : name}
      className={cn(
        "inline-flex shrink-0 items-center justify-center rounded-full font-semibold",
        deactivated
          ? "bg-gray-200 text-gray-400 ring-1 ring-gray-300"
          : "bg-steel/15 text-steel",
        sizes[size],
        className
      )}
    >
      {initials(name)}
    </span>
  );
}
