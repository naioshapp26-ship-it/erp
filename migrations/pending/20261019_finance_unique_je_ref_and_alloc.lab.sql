-- =============================================================================
-- Isolated LAB only — applies UNIQUE to schema finance_unique_lab (NOT public)
-- Safe to re-run in local/dev test databases. Never targets operational public.
-- =============================================================================

CREATE SCHEMA IF NOT EXISTS finance_unique_lab;

CREATE TABLE IF NOT EXISTS finance_unique_lab.finance_journal_entries (
  LIKE public.finance_journal_entries INCLUDING DEFAULTS INCLUDING CONSTRAINTS INCLUDING INDEXES
);

CREATE TABLE IF NOT EXISTS finance_unique_lab.finance_payment_allocations (
  LIKE public.finance_payment_allocations INCLUDING DEFAULTS INCLUDING CONSTRAINTS INCLUDING INDEXES
);

CREATE UNIQUE INDEX IF NOT EXISTS uq_finance_je_posted_ref
  ON finance_unique_lab.finance_journal_entries (reference_type, reference_id)
  WHERE is_posted IS TRUE
    AND reference_type IS NOT NULL
    AND reference_id IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS uq_finance_payment_alloc_pair
  ON finance_unique_lab.finance_payment_allocations (payment_id, invoice_id);
