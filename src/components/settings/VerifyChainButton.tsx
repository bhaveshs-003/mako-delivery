"use client";

import { useState } from "react";
import { ShieldCheck, ShieldAlert, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";

type Result = {
  ok: boolean;
  rowsChecked: number;
  breaks: { sequenceNumber: string; reason: string }[];
};

export function VerifyChainButton() {
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<Result | null>(null);

  async function verify() {
    setLoading(true);
    setResult(null);
    try {
      const res = await fetch("/api/audit-log/verify", { method: "POST" });
      setResult(await res.json());
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex flex-wrap items-center gap-3">
      <Button onClick={verify} disabled={loading} variant="secondary" size="sm">
        {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
        Verify Full Chain
      </Button>
      {result && (
        <span
          className={`inline-flex items-center gap-1.5 text-sm font-medium ${
            result.ok ? "text-success" : "text-danger"
          }`}
        >
          {result.ok ? (
            <ShieldCheck className="h-4 w-4" />
          ) : (
            <ShieldAlert className="h-4 w-4" />
          )}
          {result.ok
            ? `Chain intact · ${result.rowsChecked} rows verified`
            : `${result.breaks.length} break(s) detected across ${result.rowsChecked} rows`}
        </span>
      )}
    </div>
  );
}
