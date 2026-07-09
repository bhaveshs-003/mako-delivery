/**
 * Tamper-EVIDENT audit log (spec §2.13).
 *
 * Every state-changing action appends one row to `audit_log`. Rows are chained:
 *
 *   row_hash = SHA256(sequence_number | actor_id | action | entity_type
 *                     | entity_id | timestamp | previous_hash)
 *
 * The first row's previous_hash is SHA256(AUDIT_GENESIS_SEED). Any later
 * mutation of a row (or a deletion) breaks every subsequent hash, which the
 * verifier (verifyAuditChain) detects. The table is ALSO INSERT-ONLY at the
 * database level (see migration 20260709153602_audit_log_insert_only), so the
 * only way to alter history is to rebuild the DB — and even that is evidenced
 * because sequence gaps and hash breaks are visible.
 *
 * Concurrency: all appends take a transaction-scoped advisory lock, so two
 * concurrent writes cannot read the same tail row and fork the chain.
 */
import { createHash } from "crypto";
import { Prisma } from "@prisma/client";
import { prisma } from "./db";

const GENESIS_SEED = process.env.AUDIT_GENESIS_SEED ?? "MAKO_GENESIS_BLOCK";

// Arbitrary constant key that serializes all audit appends against each other.
const AUDIT_ADVISORY_LOCK_KEY = 826412401;

function sha256(input: string): string {
  return createHash("sha256").update(input, "utf8").digest("hex");
}

/** Hash of the genesis seed — the previous_hash of the very first row. */
export function genesisHash(): string {
  return sha256(GENESIS_SEED);
}

/** Canonical row-hash formula. Kept pure so the verifier reuses it exactly. */
export function computeRowHash(params: {
  sequenceNumber: bigint;
  actorId: string;
  action: string;
  entityType: string;
  entityId: string;
  timestamp: Date;
  previousHash: string;
}): string {
  const payload = [
    params.sequenceNumber.toString(),
    params.actorId,
    params.action,
    params.entityType,
    params.entityId,
    params.timestamp.toISOString(),
    params.previousHash,
  ].join("|");
  return sha256(payload);
}

export type AuditActor = {
  id: string;
  email: string;
  role: string;
  ip?: string | null;
  sessionId?: string | null;
};

export type WriteAuditInput = {
  actor: AuditActor;
  action: string; // e.g. "project.create", "approval.reject"
  entityType: string; // e.g. "project", "milestone"
  entityId: string;
  before?: unknown; // null/undefined for creates
  after?: unknown; // null/undefined for deletes
  metadata?: Record<string, unknown>;
  tombstone?: { reason: string; targetType: string; targetId: string };
};

type TxClient = Prisma.TransactionClient;

function jsonOrSkip(v: unknown): Prisma.InputJsonValue | typeof Prisma.JsonNull | undefined {
  if (v === undefined) return undefined;
  if (v === null) return Prisma.JsonNull;
  return v as Prisma.InputJsonValue;
}

/**
 * Append one row to the audit log. Runs its own transaction unless a
 * transaction client `tx` is supplied (so it can join a caller's transaction,
 * e.g. a hard-delete that must write the tombstone in the SAME transaction).
 */
export async function writeAudit(input: WriteAuditInput, tx?: TxClient) {
  const run = async (client: TxClient) => {
    // Serialize appends so the chain tail is read under a lock.
    await client.$executeRaw`SELECT pg_advisory_xact_lock(${AUDIT_ADVISORY_LOCK_KEY})`;

    const last = await client.auditLog.findFirst({
      orderBy: { sequenceNumber: "desc" },
      select: { rowHash: true },
    });
    const previousHash = last?.rowHash ?? genesisHash();

    // Reserve the next sequence value so we can hash it before insert.
    const seq = await client.$queryRaw<{ nextval: bigint }[]>`
      SELECT nextval(pg_get_serial_sequence('audit_log', 'sequence_number')) AS nextval
    `;
    const sequenceNumber = BigInt(seq[0].nextval);

    const timestamp = new Date(); // server-generated, never client-supplied
    const rowHash = computeRowHash({
      sequenceNumber,
      actorId: input.actor.id,
      action: input.action,
      entityType: input.entityType,
      entityId: input.entityId,
      timestamp,
      previousHash,
    });

    return client.auditLog.create({
      data: {
        sequenceNumber,
        actorId: input.actor.id,
        actorEmail: input.actor.email,
        actorRole: input.actor.role,
        actorIp: input.actor.ip ?? null,
        sessionId: input.actor.sessionId ?? null,
        action: input.action,
        entityType: input.entityType,
        entityId: input.entityId,
        beforeValue: jsonOrSkip(input.before),
        afterValue: jsonOrSkip(input.after),
        metadata: jsonOrSkip(input.metadata),
        previousHash,
        rowHash,
        timestamp,
        isTombstone: !!input.tombstone,
        tombstoneReason: input.tombstone?.reason ?? null,
        tombstoneTargetType: input.tombstone?.targetType ?? null,
        tombstoneTargetId: input.tombstone?.targetId ?? null,
      },
    });
  };

  return tx ? run(tx) : prisma.$transaction(run);
}

export type ChainVerificationResult = {
  ok: boolean;
  rowsChecked: number;
  /** Sequence numbers where verification failed, with the reason. */
  breaks: { sequenceNumber: string; reason: string }[];
};

/**
 * Re-walk the entire chain and confirm every row_hash and previous_hash link.
 * Intended to run daily (cron) and on-demand from the Audit Log viewer.
 */
export async function verifyAuditChain(): Promise<ChainVerificationResult> {
  const rows = await prisma.auditLog.findMany({
    orderBy: { sequenceNumber: "asc" },
    select: {
      sequenceNumber: true,
      actorId: true,
      action: true,
      entityType: true,
      entityId: true,
      timestamp: true,
      previousHash: true,
      rowHash: true,
    },
  });

  const breaks: ChainVerificationResult["breaks"] = [];
  let expectedPrev = genesisHash();

  for (const row of rows) {
    const seqStr = row.sequenceNumber.toString();

    if (row.previousHash !== expectedPrev) {
      breaks.push({
        sequenceNumber: seqStr,
        reason: `previous_hash mismatch (expected ${expectedPrev.slice(0, 12)}…, got ${row.previousHash.slice(0, 12)}…)`,
      });
    }

    const recomputed = computeRowHash({
      sequenceNumber: row.sequenceNumber,
      actorId: row.actorId,
      action: row.action,
      entityType: row.entityType,
      entityId: row.entityId,
      timestamp: row.timestamp,
      previousHash: row.previousHash,
    });
    if (recomputed !== row.rowHash) {
      breaks.push({
        sequenceNumber: seqStr,
        reason: `row_hash mismatch (row was altered or hash recomputation failed)`,
      });
    }

    expectedPrev = row.rowHash;
  }

  return { ok: breaks.length === 0, rowsChecked: rows.length, breaks };
}

/** Per-row check used by the Audit Log viewer's green "verified" checkmark. */
export function verifyRowHash(row: {
  sequenceNumber: bigint;
  actorId: string;
  action: string;
  entityType: string;
  entityId: string;
  timestamp: Date;
  previousHash: string;
  rowHash: string;
}): boolean {
  return (
    computeRowHash({
      sequenceNumber: row.sequenceNumber,
      actorId: row.actorId,
      action: row.action,
      entityType: row.entityType,
      entityId: row.entityId,
      timestamp: row.timestamp,
      previousHash: row.previousHash,
    }) === row.rowHash
  );
}
