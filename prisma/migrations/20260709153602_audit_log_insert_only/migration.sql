-- ============================================================================
-- AUDIT LOG: INSERT-ONLY ENFORCEMENT (spec §2.13 constraint #1)
-- ----------------------------------------------------------------------------
-- The audit_log table must be append-only. No UPDATE or DELETE may ever
-- succeed, for any role, including the application's own DB user. This trigger
-- raises an exception on any UPDATE/DELETE attempt, making tampering impossible
-- through ordinary SQL paths. Combined with the row-level SHA-256 hash chain
-- (written by the application), this yields a tamper-EVIDENT ledger.
-- ============================================================================

CREATE OR REPLACE FUNCTION mako_audit_log_block_mutation()
RETURNS TRIGGER AS $$
BEGIN
  RAISE EXCEPTION 'audit_log is INSERT-ONLY: % is not permitted on this table', TG_OP
    USING ERRCODE = 'insufficient_privilege';
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_audit_log_no_update ON "audit_log";
CREATE TRIGGER trg_audit_log_no_update
  BEFORE UPDATE ON "audit_log"
  FOR EACH ROW EXECUTE FUNCTION mako_audit_log_block_mutation();

DROP TRIGGER IF EXISTS trg_audit_log_no_delete ON "audit_log";
CREATE TRIGGER trg_audit_log_no_delete
  BEFORE DELETE ON "audit_log"
  FOR EACH ROW EXECUTE FUNCTION mako_audit_log_block_mutation();