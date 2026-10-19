-- =============================================================================
-- PENDING APPROVAL — DO NOT APPLY TO Staging/Production/ops without explicit OK
-- B1.d.5b UNIQUE: posted JE reference uniqueness + payment allocation pair
-- =============================================================================
-- Prerequisites (read-only scan must return 0 before apply):
--   SELECT reference_type, reference_id, COUNT(*)
--   FROM public.finance_journal_entries
--   WHERE is_posted IS TRUE AND reference_type IS NOT NULL AND reference_id IS NOT NULL
--   GROUP BY 1,2 HAVING COUNT(*) > 1;
--
--   SELECT payment_id, invoice_id, COUNT(*)
--   FROM public.finance_payment_allocations
--   GROUP BY 1,2 HAVING COUNT(*) > 1;
--
-- Production apply (outside transaction; CONCURRENTLY cannot run in a txn):
--   CREATE UNIQUE INDEX CONCURRENTLY IF NOT EXISTS uq_finance_je_posted_ref ...
--   CREATE UNIQUE INDEX CONCURRENTLY IF NOT EXISTS uq_finance_payment_alloc_pair ...
--
-- Lab / isolated-schema dry-run (non-CONCURRENTLY OK):
--   See migrations/pending/20261019_finance_unique_je_ref_and_alloc.lab.sql
-- =============================================================================

-- NOTE: Keep this file as the canonical ops-facing definition.
-- Actual CREATE statements for ops use CONCURRENTLY (below). Do not wrap in BEGIN.

CREATE UNIQUE INDEX CONCURRENTLY IF NOT EXISTS uq_finance_je_posted_ref
  ON public.finance_journal_entries (reference_type, reference_id)
  WHERE is_posted IS TRUE
    AND reference_type IS NOT NULL
    AND reference_id IS NOT NULL;

CREATE UNIQUE INDEX CONCURRENTLY IF NOT EXISTS uq_finance_payment_alloc_pair
  ON public.finance_payment_allocations (payment_id, invoice_id);

-- Rollback (after approval only):
--   DROP INDEX CONCURRENTLY IF EXISTS public.uq_finance_je_posted_ref;
--   DROP INDEX CONCURRENTLY IF EXISTS public.uq_finance_payment_alloc_pair;
