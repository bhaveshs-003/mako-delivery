"use client";

import { Printer } from "lucide-react";
import { Button } from "@/components/ui/button";

// Browser print → "Save as PDF" is the pragmatic export (no heavy PDF lib).
export function PrintButton({ label = "Print / Save PDF" }: { label?: string }) {
  return (
    <Button variant="outline" size="sm" onClick={() => window.print()} className="print:hidden">
      <Printer className="h-4 w-4" /> {label}
    </Button>
  );
}
