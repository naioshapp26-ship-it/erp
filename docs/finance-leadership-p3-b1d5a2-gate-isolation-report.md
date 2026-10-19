# تقرير B1.d.5a.2 — تصميم بوابة سلامة التحصيل + عزل الاختبارات + مراجعة UNIQUE

**النتيجة:** PASS — 9 / 0
**النطاق:** تحليل وتصميم فقط. لا تعديل بيانات/سكربتات/خدمات/مسارات · لا إصلاح تاريخي · لا migrations · لا أعلام · لا B1.d.5b · لا دمج/Staging/Production.

## الحكم
بوابة التحصيل يجب أن تتحقق من قيد إصدار **نشط** عبر الرابط المباشر **أو** `reference_type/reference_id`، مع فحوصات الكيان/الحالة/العكس/المبلغ/التفرد — **بدون تجاوز عام**. نقاط التطبيق غير القابلة للتجاوز: `postPaymentReceipt` + فرع HTTP القديم. UNIQUE جاهز تقنيًا وغير منفّذ. عزل `public` تصميم فقط.

## 1) مصفوفة قبول / رفض / مراجعة بشرية
| حالة قيد إصدار الفاتورة | القرار | الرمز |
|---|---|---|
| قيد إصدار وحيد مرحّل، غير معكوس، كيان متوافق، مبلغ 1130 ≈ total | **ALLOW** | `INVOICE_ISSUE_JE_OK` |
| journal_entry_id فارغ لكن يوجد مرجع INVOICE وحيد ACTIVE يستوفي الشروط | **ALLOW** | `INVOICE_ISSUE_JE_OK` — يُسمح بالتحصيل؛ إصلاح الربط المباشر قرار بيانات منفصل — ليس شرطًا للرفض |
| لا قيد إصدار ACTIVE (رابط أو مرجع) | **REJECT** | `INVOICE_ISSUE_JE_REQUIRED` — يشمل: INV-FIN-* · C2 · C3 · أي تاريخي غير مرحّل |
| قيد الإصدار معكوس (JOURNAL_REVERSAL مرحّل على entry_id) | **REJECT** | `INVOICE_ISSUE_JE_REVERSED` |
| أكثر من قيد ACTIVE لنفس الفاتورة | **HUMAN_REVIEW** | `INVOICE_ISSUE_JE_AMBIGUOUS` |
| اختلاف كيان القيد عن الفاتورة | **REJECT** | `INVOICE_ISSUE_JE_ENTITY_MISMATCH` |
| اختلاف مبلغ 1130 عن total_amount | **HUMAN_REVIEW** | `INVOICE_ISSUE_JE_AMOUNT_MISMATCH` |
| journal_entry_id يشير لقيد غير ACTIVE بينما يوجد مرجع آخر ACTIVE (أو العكس متعارض) | **HUMAN_REVIEW** | `INVOICE_ISSUE_JE_LINK_CONFLICT` |
| فاتورة DRAFT/CANCELLED/VOID | **REJECT** | `INVOICE_NOT_COLLECTABLE` |
| تحصيلات سابقة موجودة على فاتورة بدون قيد إصدار (C3) | **REJECT for NEW collection** | `INVOICE_ISSUE_JE_REQUIRED` — لا عكس تلقائي للقديم؛ التحصيل الجديد ممنوع حتى إصلاح منفصل |

### خوارزمية الحل (تصميم)
```
{
  "name": "assertInvoiceIssueReadyForCollection",
  "principle": "Do not trust journal_entry_id alone. Resolve active issue JE via direct link ∪ reference_type=INVOICE/reference_id, then validate posted/unreversed/entity/amount/uniqueness.",
  "resolution_algorithm": [
    "BEGIN / caller txn already open",
    "SELECT invoice FOR UPDATE",
    "pg_advisory_xact_lock(invoice_ns, invoice_id) — same family as postInvoiceIssue (11011)",
    "Load candidates: (A) entry pointed by invoice.journal_entry_id if set; (B) all JE where reference_type=INVOICE AND reference_id=invoice_id",
    "Lock candidate entry rows FOR UPDATE",
    "Filter ACTIVE ISSUE: is_posted=true AND status=POSTED AND entry_type≠REVERSAL AND reference_type≠JOURNAL_REVERSAL AND NOT EXISTS posted JOURNAL_REVERSAL referencing entry_id",
    "If journal_entry_id set but that entry fails ACTIVE filter while another ACTIVE ref exists → HUMAN_REVIEW (link/ref conflict)",
    "Apply accept/reject matrix",
    "On ALLOW continue allocation remaining checks; on REJECT/HUMAN abort payment posting txn"
  ],
  "amount_rule": "roundMoney(|Σ debit 1130 on issue JE − invoice.total_amount|) ≤ 0.05; do not use credit 1130; do not use payment JE",
  "entity_rule": "COALESCE(invoice.entity_id,'') must equal COALESCE(je.entity_id,''); both empty allowed only if both empty (current data has some empty pairs)",
  "multi_invoice_payment": "Evaluate gate independently for EVERY allocated invoice_id; first failure fails entire payment txn (no partial collection JE)",
  "no_blanket_bypass": "No allowlist for INV-FIN-*, B1D*, or unpaid historical. Repair data or leave uncollectable until repaired under separate approval.",
  "suggested_error_shape": {
    "status": "422 or 409",
    "codes": [
      "INVOICE_ISSUE_JE_REQUIRED",
      "INVOICE_ISSUE_JE_REVERSED",
      "INVOICE_ISSUE_JE_ENTITY_MISMATCH",
      "INVOICE_ISSUE_JE_AMBIGUOUS",
      "INVOICE_ISSUE_JE_AMOUNT_MISMATCH",
      "INVOICE_ISSUE_JE_LINK_CONFLICT",
      "INVOICE_NOT_COLLECTABLE"
    ]
  }
}
```

## 2) نقاط التطبيق التي لا يمكن تجاوزها
### AP1 — `finance/services/finance-posting-service.js → postPaymentReceipt`
- مطلوب: **true** · خطر التجاوز: CRITICAL
- لماذا: Single choke for service path and any future callers; already FOR UPDATE invoices inside txn
- موضع مقترح: After loading each allocated invoice FOR UPDATE and entity checks; before OVER_ALLOCATION updates / JE insert

### AP2 — `finance/api/finance-routes.js → POST /payments legacy else-branch`
- مطلوب: **true** · خطر التجاوز: CRITICAL — current production-default path
- لماذا: Default flags false → live HTTP uses legacy inline JE; must call same helper, not duplicate logic
- موضع مقترح: Inside allocation loop before paid_amount update / before PAYMENT JE insert

### AP3 — `finance/api/finance-routes.js → POST /payments service branch`
- مطلوب: **true** · خطر التجاوز: HIGH if AP1 missing
- لماذا: Calls postPaymentReceipt — covered if AP1 done; still verify no pre-balance mutations before service
- موضع مقترح: Rely on AP1; do not add a weaker early check that can be skipped

### AP4 — `finance/api/payments.js → createPayment (server.js registers AFTER financeRoutes)`
- مطلوب: **true** · خطر التجاوز: MEDIUM now / CRITICAL if mount order changes
- لماذا: Currently shadowed for POST by finance-routes mount order, and createPayment inserts payment WITHOUT JE/alloc. Defense-in-depth: if un-shadowed or reused, must not become a silent collection path
- موضع مقترح: Either keep non-posting (document) or refuse allocations/JE creation unless AP1 helper used
- ملاحظة رصد: financeRoutes mounted before paymentsAPI POST — finance-routes handles live POST today

### AP5 — `Multi-invoice allocations on one payment`
- مطلوب: **true** · خطر التجاوز: HIGH — partial AR hole
- لماذا: One bad invoice must fail whole txn
- موضع مقترح: AP1/AP2 per invoice_id before any JE lines written

### AP6 — `Direct SQL / scripts / future helpers calling postPaymentReceipt`
- مطلوب: **true** · خطر التجاوز: HIGH
- لماذا: Centralizing in AP1 covers trustedTestActor and production callers
- موضع مقترح: AP1 only — do not add HTTP-only gate

## 3) التوافق مع البيانات التاريخية
```
{
  "principle": "No general bypass. Gate applies to NEW collections only; does not rewrite history.",
  "cohorts": [
    {
      "cohort": "فواتير ب قيد إصدار صحيح وjournal_entry_id مملوء",
      "gate": "ALLOW if validations pass",
      "live": {
        "ALLOW": 19,
        "REJECT": 0,
        "HUMAN_REVIEW": 0,
        "n": 19
      }
    },
    {
      "cohort": "قيد إصدار عبر reference فقط وjournal_entry_id فارغ",
      "gate": "ALLOW if sole ACTIVE ref OK (current DB: 0 such rows)",
      "live_null_link_one_ref": 0,
      "note": "Optional later repair to backfill journal_entry_id — separate approval"
    },
    {
      "cohort": "بذور INV-FIN-*",
      "gate": "REJECT INVOICE_ISSUE_JE_REQUIRED on new collection",
      "policy": "D1 keep seeds; they remain display-only / uncollectable under gate"
    },
    {
      "cohort": "اختبارات C2 غير مرحّلة",
      "gate": "REJECT — prevents new C3",
      "policy": "D2 leave in public; isolation plan stops growth"
    },
    {
      "cohort": "اختبارات C3 (تحصيل سابق بلا قيد إصدار)",
      "gate": "REJECT further collection; existing PAYMENT JEs untouched",
      "policy": "No auto-reverse; repair list R3 remains separate"
    },
    {
      "cohort": "تاريخي غير مرحّل غير اختباري",
      "gate": "REJECT until proper issue posting under separate approval",
      "policy": "No silent collect"
    },
    {
      "cohort": "فواتير لديها تحصيلات سابقة وقيد إصدار سليم",
      "gate": "ALLOW additional collection if remaining>0 and issue JE still ACTIVE",
      "note": "Gate does not block legitimate partial→remainder flows"
    }
  ],
  "simulation_by_bucket": {
    "SEED_INV_FIN": {
      "ALLOW": 0,
      "REJECT": 2,
      "HUMAN_REVIEW": 0,
      "n": 2
    },
    "HEALTHY_POSTED_ISSUE": {
      "ALLOW": 19,
      "REJECT": 0,
      "HUMAN_REVIEW": 0,
      "n": 19
    },
    "TEST_C2_UNPOSTED": {
      "ALLOW": 0,
      "REJECT": 15,
      "HUMAN_REVIEW": 0,
      "n": 15
    },
    "TEST_C3_OR_COLLECTED": {
      "ALLOW": 0,
      "REJECT": 12,
      "HUMAN_REVIEW": 0,
      "n": 12
    }
  }
}
```

### محاكاة حية على القاعدة الحالية (بدون تثبيت البوابة)
```
{
  "invoice_total": 48,
  "decisions": {
    "ALLOW": 19,
    "REJECT": 29,
    "HUMAN_REVIEW": 0
  },
  "byBucket": {
    "SEED_INV_FIN": {
      "ALLOW": 0,
      "REJECT": 2,
      "HUMAN_REVIEW": 0,
      "n": 2
    },
    "HEALTHY_POSTED_ISSUE": {
      "ALLOW": 19,
      "REJECT": 0,
      "HUMAN_REVIEW": 0,
      "n": 19
    },
    "TEST_C2_UNPOSTED": {
      "ALLOW": 0,
      "REJECT": 15,
      "HUMAN_REVIEW": 0,
      "n": 15
    },
    "TEST_C3_OR_COLLECTED": {
      "ALLOW": 0,
      "REJECT": 12,
      "HUMAN_REVIEW": 0,
      "n": 12
    }
  },
  "byCode": {
    "INVOICE_ISSUE_JE_REQUIRED": 29,
    "INVOICE_ISSUE_JE_OK": 19
  },
  "samples": {
    "ALLOW": [
      {
        "invoice_id": 5,
        "invoice_number": "INV-0003",
        "bucket": "HEALTHY_POSTED_ISSUE",
        "code": "INVOICE_ISSUE_JE_OK",
        "journal_entry_id": 22,
        "active_issue_je_count": "1"
      },
      {
        "invoice_id": 8,
        "invoice_number": "INV-0004",
        "bucket": "HEALTHY_POSTED_ISSUE",
        "code": "INVOICE_ISSUE_JE_OK",
        "journal_entry_id": 23,
        "active_issue_je_count": "1"
      },
      {
        "invoice_id": 9,
        "invoice_number": "INV-0005",
        "bucket": "HEALTHY_POSTED_ISSUE",
        "code": "INVOICE_ISSUE_JE_OK",
        "journal_entry_id": 24,
        "active_issue_je_count": "1"
      },
      {
        "invoice_id": 10,
        "invoice_number": "INV-0006",
        "bucket": "HEALTHY_POSTED_ISSUE",
        "code": "INVOICE_ISSUE_JE_OK",
        "journal_entry_id": 25,
        "active_issue_je_count": "1"
      },
      {
        "invoice_id": 11,
        "invoice_number": "INV-0007",
        "bucket": "HEALTHY_POSTED_ISSUE",
        "code": "INVOICE_ISSUE_JE_OK",
        "journal_entry_id": 26,
        "active_issue_je_count": "1"
      }
    ],
    "REJECT": [
      {
        "invoice_id": 1,
        "invoice_number": "INV-FIN-001",
        "bucket": "SEED_INV_FIN",
        "code": "INVOICE_ISSUE_JE_REQUIRED",
        "journal_entry_id": null,
        "active_issue_je_count": "0"
      },
      {
        "invoice_id": 2,
        "invoice_number": "INV-FIN-002",
        "bucket": "SEED_INV_FIN",
        "code": "INVOICE_ISSUE_JE_REQUIRED",
        "journal_entry_id": null,
        "active_issue_je_count": "0"
      },
      {
        "invoice_id": 28,
        "invoice_number": "B1D3D-cash-1792439418385-3023",
        "bucket": "TEST_C2_UNPOSTED",
        "code": "INVOICE_ISSUE_JE_REQUIRED",
        "journal_entry_id": null,
        "active_issue_je_count": "0"
      },
      {
        "invoice_id": 29,
        "invoice_number": "B1D3D-bank-1792439418397-7802",
        "bucket": "TEST_C2_UNPOSTED",
        "code": "INVOICE_ISSUE_JE_REQUIRED",
        "journal_entry_id": null,
        "active_issue_je_count": "0"
      },
      {
        "invoice_id": 30,
        "invoice_number": "B1D3D-m1-1792439418403-6343",
        "bucket": "TEST_C2_UNPOSTED",
        "code": "INVOICE_ISSUE_JE_REQUIRED",
        "journal_entry_id": null,
        "active_issue_je_count": "0"
      }
    ],
    "HUMAN_REVIEW": []
  },
  "note": "Simulation only — gate not installed; existing posted payments untouched"
}
```

## 4) تصميم عزل الاختبارات عن `public`
```
{
  "status": "DESIGN_ONLY_NOT_EXECUTED",
  "target": "Finance P3 harnesses must not write public.finance_*",
  "layers": [
    {
      "id": "L1-SCHEMA",
      "title": "Schema/DB isolation",
      "detail": "Prefer dedicated DB (e.g. naiosh_erp_finance_test) OR continue b1a_test schema with search_path=b1a_test only for writers. HTTP wire tests need either schema-aware app config or separate DB URL."
    },
    {
      "id": "L2-ROLE",
      "title": "DB role permissions",
      "detail": "Test role: GRANT ALL ON SCHEMA b1a_test; REVOKE INSERT/UPDATE/DELETE ON public.finance_invoices, finance_payments, finance_payment_allocations, finance_journal_entries, finance_journal_lines FROM test_role. App role unchanged for runtime."
    },
    {
      "id": "L3-CI-GREP",
      "title": "CI reject dangerous SQL in tests",
      "detail": "Fail if test-finance-p3*.js matches /INSERT INTO public\\.finance_/ or /UPDATE public\\.finance_/ without allowlist file header FINANCE_PUBLIC_WRITE_ALLOW=1 (discouraged)."
    },
    {
      "id": "L4-ASSERT",
      "title": "assertPublicUntouched",
      "detail": "Snapshot counts+max(id) on public finance tables before/after suite; fail on growth. Detection aid only — not a substitute for L1/L2."
    },
    {
      "id": "L5-SUITE-REVIEW",
      "title": "Known public writers to remediate under later approval",
      "files": [
        "test-finance-p3-b1d3d-payment-wire.js (seedPublicInvoice)",
        "test-finance-p3-b1d3e-payment-entity.js (INSERT public invoices/payments)",
        "test-finance-p3-b1d4-readiness.js (matrix INSERT public)",
        "test-finance-p3-b1d2-readiness.js (INSERT public)"
      ],
      "note": "B1.d.5a.2 does not edit these scripts"
    }
  ],
  "verification_that_tests_are_isolated": [
    "Test process env DATABASE_URL points to test DB/schema only",
    "SELECT current_schema() / show search_path asserted == b1a_test at suite start",
    "Attempted INSERT INTO public.finance_invoices must fail with permission denied when L2 enabled",
    "assertPublicUntouched delta == 0",
    "CI grep clean"
  ]
}
```

## 5) مراجعة جاهزية UNIQUE
```
{
  "status": "REVIEWED_NOT_APPLIED",
  "column_check": [
    {
      "table_name": "finance_journal_entries",
      "column_name": "is_posted",
      "data_type": "boolean",
      "is_nullable": "YES"
    },
    {
      "table_name": "finance_journal_entries",
      "column_name": "reference_id",
      "data_type": "integer",
      "is_nullable": "YES"
    },
    {
      "table_name": "finance_journal_entries",
      "column_name": "reference_type",
      "data_type": "character varying",
      "is_nullable": "YES"
    },
    {
      "table_name": "finance_payment_allocations",
      "column_name": "invoice_id",
      "data_type": "integer",
      "is_nullable": "NO"
    },
    {
      "table_name": "finance_payment_allocations",
      "column_name": "payment_id",
      "data_type": "integer",
      "is_nullable": "NO"
    }
  ],
  "proposed": {
    "je": "CREATE UNIQUE INDEX CONCURRENTLY IF NOT EXISTS uq_finance_je_posted_ref\n  ON public.finance_journal_entries (reference_type, reference_id)\n  WHERE is_posted IS TRUE\n    AND reference_type IS NOT NULL\n    AND reference_id IS NOT NULL;",
    "alloc": "CREATE UNIQUE INDEX CONCURRENTLY IF NOT EXISTS uq_finance_payment_alloc_pair\n  ON public.finance_payment_allocations (payment_id, invoice_id);"
  },
  "validation": {
    "columns_exist": true,
    "is_posted_nullable": true,
    "note_is_posted": "Predicate uses IS TRUE so NULL is_posted rows are excluded (safe with nullable column)",
    "null_refs_allowed": "Manual/untyped journals with NULL refs remain allowed outside partial index",
    "reversals": "JOURNAL_REVERSAL stores reference_id=original.entry_id — unique ⇒ at most one posted reverse per original entry (aligns with reverseEntry)",
    "legacy_paths": "Legacy inline INVOICE/PAYMENT inserts also set reference_type/id — protected equally",
    "concurrency": "App advisory locks + FOR UPDATE first; unique is last-line race defense",
    "gate_interaction": "UNIQUE does not replace collection gate; gate prevents Cr-without-Dr; unique prevents double JE/alloc"
  },
  "duplicate_scan_now": {
    "invoice": 0,
    "payment": 0,
    "reversal": 0,
    "alloc": 0,
    "posted_null_ref": 14
  },
  "readiness": "TECHNICALLY_READY_PENDING_EXPLICIT_5b_APPROVAL",
  "non_execution": "No SQL run to create indexes in this phase"
}
```

## 6) ترتيب تنفيذي لاحق (كل خطوة بموافقة مستقلة)
- **B1.d.5a.2:** This design report — موافقة: in-progress-delivery
- **B1.d.5a.3-gate-impl:** Implement assertInvoiceIssueReadyForCollection + wire AP1/AP2 only behind explicit approval (recommend default-deny in service always when approved; optional kill-switch flag default true for safety if required) — موافقة: explicit-separate · يعتمد على: 5a.2 acceptance
- **B1.d.5a.4-isolation:** Remediate b1d2/d3d/d3e/d4 public writers + CI grep + optional test DB role — موافقة: explicit-separate · يعتمد على: 5a.2 acceptance
- **B1.d.5b-unique:** Apply UNIQUE indexes only (backup + CONCURRENTLY + isolated verify) — موافقة: explicit-separate · يعتمد على: duplicate scan still 0; NOT bundled with gate/isolation/repairs
- **B1.d.5c-idempotency:** Idempotency-Key for collection (from readiness plan) — موافقة: explicit-separate
- **B1.d.5d-advance:** ADVANCE accounting policy — موافقة: explicit-separate
- **Repair R1–R5:** Historical/seed/C3 repairs or product invoice-JE-required already covered by gate impl — موافقة: explicit-separate-each
- **B1.d.6 flags:** Staging invoice/payment flags — موافقة: explicit-separate · يُحظر حتى: gate live + isolation + UNIQUE decision

## 7) نتائج الفحص
- PASS live-gate-simulation: {"ALLOW":19,"REJECT":29,"HUMAN_REVIEW":0}
- PASS accept-reject-matrix-documented: 10
- PASS application-points-sources-present
- PASS payments-js-create-still-present-shadowed
- PASS historical-compatibility-documented
- PASS isolation-design-documented
- PASS unique-technically-ready: {"invoice":0,"payment":0,"reversal":0,"alloc":0,"posted_null_ref":14}
- PASS phased-approvals-documented
- PASS readonly-enforced: 25006

**توقف:** بانتظار موافقة صريحة قبل تنفيذ البوابة أو العزل أو B1.d.5b.
