-- =============================================================================
-- Finance test isolation role — requires CREATEROLE / superuser once
-- Creates finance_test_writer: full access to b1a_test, SELECT on public,
-- NO INSERT/UPDATE/DELETE on core public finance posting tables.
-- App role (vendowor_erp_user) unchanged.
-- =============================================================================

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'finance_test_writer') THEN
    CREATE ROLE finance_test_writer LOGIN PASSWORD 'finance_test_local_only';
  END IF;
END$$;

-- Run manually if needed: GRANT CONNECT ON DATABASE <db_name> TO finance_test_writer;
GRANT CONNECT ON DATABASE vendowor_erp TO finance_test_writer;

GRANT USAGE ON SCHEMA b1a_test TO finance_test_writer;
GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA b1a_test TO finance_test_writer;
GRANT ALL PRIVILEGES ON ALL SEQUENCES IN SCHEMA b1a_test TO finance_test_writer;
ALTER DEFAULT PRIVILEGES IN SCHEMA b1a_test GRANT ALL ON TABLES TO finance_test_writer;
ALTER DEFAULT PRIVILEGES IN SCHEMA b1a_test GRANT ALL ON SEQUENCES TO finance_test_writer;

GRANT USAGE ON SCHEMA public TO finance_test_writer;
GRANT SELECT ON ALL TABLES IN SCHEMA public TO finance_test_writer;

REVOKE INSERT, UPDATE, DELETE, TRUNCATE ON
  public.finance_invoices,
  public.finance_invoice_lines,
  public.finance_payments,
  public.finance_payment_allocations,
  public.finance_journal_entries,
  public.finance_journal_lines
FROM finance_test_writer;

-- Optional lab schema for UNIQUE dry-run
GRANT USAGE, CREATE ON SCHEMA finance_unique_lab TO finance_test_writer;
GRANT ALL ON ALL TABLES IN SCHEMA finance_unique_lab TO finance_test_writer;
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA finance_unique_lab TO finance_test_writer;
-- Lab tables created via LIKE may use public sequences
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO finance_test_writer;
