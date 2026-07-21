"use client";

import * as React from "react";
import * as DialogPrimitive from "@radix-ui/react-dialog";
import { X } from "lucide-react";
import { cn } from "@/lib/utils";

export const Dialog = DialogPrimitive.Root;
export const DialogTrigger = DialogPrimitive.Trigger;
export const DialogClose = DialogPrimitive.Close;

const SIZES = { sm: "max-w-sm", md: "max-w-md", lg: "max-w-2xl" };

export function DialogContent({
  className,
  children,
  size = "md",
  side = false,
  ...props
}: React.ComponentPropsWithoutRef<typeof DialogPrimitive.Content> & {
  size?: keyof typeof SIZES;
  // Render as a right-anchored side drawer instead of a centred modal.
  side?: boolean;
}) {
  return (
    <DialogPrimitive.Portal>
      <DialogPrimitive.Overlay className="fixed inset-0 z-40 bg-black/40 data-[state=open]:animate-in data-[state=open]:fade-in" />
      <DialogPrimitive.Content
        className={cn(
          side
            ? "fixed right-0 top-0 z-50 flex h-full w-[calc(100%-2rem)] max-w-md flex-col overflow-y-auto border-l border-border bg-surface p-6 shadow-lg focus:outline-none data-[state=open]:animate-in data-[state=open]:slide-in-from-right"
            : "fixed left-1/2 top-1/2 z-50 w-[calc(100%-2rem)] -translate-x-1/2 -translate-y-1/2 rounded-lg border border-border bg-surface p-6 shadow-lg focus:outline-none",
          !side && SIZES[size],
          className
        )}
        {...props}
      >
        {children}
        <DialogPrimitive.Close className="absolute right-4 top-4 rounded text-slate hover:text-navy focus:outline-none">
          <X className="h-4 w-4" />
        </DialogPrimitive.Close>
      </DialogPrimitive.Content>
    </DialogPrimitive.Portal>
  );
}

export function DialogHeader({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return <div className={cn("mb-4 space-y-1", className)} {...props} />;
}

export function DialogTitle({
  className,
  ...props
}: React.ComponentPropsWithoutRef<typeof DialogPrimitive.Title>) {
  return (
    <DialogPrimitive.Title
      className={cn("text-lg font-semibold text-navy", className)}
      {...props}
    />
  );
}

export function DialogDescription({
  className,
  ...props
}: React.ComponentPropsWithoutRef<typeof DialogPrimitive.Description>) {
  return (
    <DialogPrimitive.Description
      className={cn("text-sm text-slate", className)}
      {...props}
    />
  );
}

export function DialogFooter({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn("mt-6 flex justify-end gap-2", className)}
      {...props}
    />
  );
}
