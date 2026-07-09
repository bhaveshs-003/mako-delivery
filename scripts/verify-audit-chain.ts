/**
 * CLI: re-walk the audit-log hash chain and report integrity.
 * Intended to run daily via cron (spec §2.13 constraint #4) and on demand.
 *
 *   npx tsx scripts/verify-audit-chain.ts
 */
import { verifyAuditChain } from "../src/lib/audit";
import { prisma } from "../src/lib/db";

async function main() {
  const result = await verifyAuditChain();
  if (result.ok) {
    console.log(`✅ Audit chain INTACT — ${result.rowsChecked} rows verified.`);
  } else {
    console.error(
      `❌ Audit chain BROKEN — ${result.breaks.length} break(s) across ${result.rowsChecked} rows:`
    );
    for (const b of result.breaks) {
      console.error(`   seq ${b.sequenceNumber}: ${b.reason}`);
    }
  }
  await prisma.$disconnect();
  process.exit(result.ok ? 0 : 1);
}

main();
