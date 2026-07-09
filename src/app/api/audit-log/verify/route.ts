import { NextResponse } from "next/server";
import { requireRole } from "@/lib/session";
import { verifyAuditChain } from "@/lib/audit";

// On-demand full-chain verification (spec §5.7 Audit Log viewer).
// Super Admin only — this is the tamper-evidence check for disputes.
export async function POST() {
  const guard = await requireRole(["super_admin"]);
  if ("response" in guard) return guard.response;

  const result = await verifyAuditChain();
  return NextResponse.json(result);
}
