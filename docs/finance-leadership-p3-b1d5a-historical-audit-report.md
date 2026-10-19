# تقرير B1.d.5a — تدقيق البيانات التاريخية (قراءة فقط)

**النتيجة:** PASS — 12 / 0
**النطاق:** فحص وتحليل فقط. لا تعديل بيانات · لا ترحيل/عكس · لا migrations · لا تغيير HTTP · لا تفعيل أعلام · لا B1.d.5b · لا دمج/Staging/Production.

## الحكم
التدقيق مكتمل. **لا يُنفَّذ B1.d.5b** حتى موافقة صريحة. الأعلام تبقى false. توجد قرارات مطلوبة قبل أي معالجة بيانات أو تفعيل.

## 1) الجرد
```
{
  "invoices": {
    "total": 48,
    "missing_je": 29,
    "has_je": 19
  },
  "payments": {
    "total": 15,
    "missing_je": 0,
    "has_je": 15
  }
}
```

## 2) تصنيف الفواتير بلا `journal_entry_id`
| التصنيف | العدد | الخطورة | المعنى |
|---|---:|---|---|
| `C1_SEED_SYNTHETIC_PAID` | 1 | high | بذرة bootstrap بمبلغ مدفوع اصطناعي |
| `C1_SEED_NO_GL` | 1 | high | بذرة bootstrap بلا قيد |
| `C2_TEST_ARTIFACT_UNPOSTED` | 15 | low | أثر اختبار غير مرحّل |
| `C3_PAYMENT_JE_WITHOUT_INVOICE_JE` | 12 | high | قيد دفعة دون قيد فاتورة |

### التفصيل
- **INV-FIN-001** (id=1) · PARTIAL/PARTIAL · total=57500 paid=20000 · alloc=0 · class=`C1_SEED_SYNTHETIC_PAID` · orphan_ref=false
- **INV-FIN-002** (id=2) · ISSUED/UNPAID · total=36800 paid=0 · alloc=0 · class=`C1_SEED_NO_GL` · orphan_ref=false
- **B1D3D-cash-1792439418385-3023** (id=28) · ISSUED/UNPAID · total=120 paid=0 · alloc=0 · class=`C2_TEST_ARTIFACT_UNPOSTED` · orphan_ref=false
- **B1D3D-bank-1792439418397-7802** (id=29) · ISSUED/UNPAID · total=200 paid=0 · alloc=0 · class=`C2_TEST_ARTIFACT_UNPOSTED` · orphan_ref=false
- **B1D3D-m1-1792439418403-6343** (id=30) · ISSUED/UNPAID · total=30 paid=0 · alloc=0 · class=`C2_TEST_ARTIFACT_UNPOSTED` · orphan_ref=false
- **B1D3D-m2-1792439418404-5638** (id=31) · ISSUED/UNPAID · total=70 paid=0 · alloc=0 · class=`C2_TEST_ARTIFACT_UNPOSTED` · orphan_ref=false
- **B1D3D-over-1792439418409-5877** (id=32) · ISSUED/UNPAID · total=10 paid=0 · alloc=0 · class=`C2_TEST_ARTIFACT_UNPOSTED` · orphan_ref=false
- **B1D3D-xe-1792439418413-1920** (id=33) · ISSUED/UNPAID · total=40 paid=0 · alloc=0 · class=`C2_TEST_ARTIFACT_UNPOSTED` · orphan_ref=false
- **B1D3D-spoof-1792439418417-2342** (id=34) · ISSUED/UNPAID · total=22 paid=0 · alloc=0 · class=`C2_TEST_ARTIFACT_UNPOSTED` · orphan_ref=false
- **B1D3D-dup-1792439418424-9937** (id=35) · ISSUED/UNPAID · total=18 paid=0 · alloc=0 · class=`C2_TEST_ARTIFACT_UNPOSTED` · orphan_ref=false
- **B1D3D-conc-1792439418430-9996** (id=36) · ISSUED/UNPAID · total=50 paid=0 · alloc=0 · class=`C2_TEST_ARTIFACT_UNPOSTED` · orphan_ref=false
- **B1D3D-idem-1792439418440-997** (id=37) · ISSUED/UNPAID · total=80 paid=0 · alloc=0 · class=`C2_TEST_ARTIFACT_UNPOSTED` · orphan_ref=false
- **B1D3D-cash-1792439446254-5014** (id=39) · PAID/PAID · total=120 paid=120 · alloc=120 · class=`C3_PAYMENT_JE_WITHOUT_INVOICE_JE` · orphan_ref=false
- **B1D3D-bank-1792439446274-6981** (id=40) · PARTIAL/PARTIAL · total=200 paid=55.25 · alloc=55.25 · class=`C3_PAYMENT_JE_WITHOUT_INVOICE_JE` · orphan_ref=false
- **B1D3D-m1-1792439446283-7238** (id=41) · PAID/PAID · total=30 paid=30 · alloc=30 · class=`C3_PAYMENT_JE_WITHOUT_INVOICE_JE` · orphan_ref=false
- **B1D3D-m2-1792439446284-5428** (id=42) · PAID/PAID · total=70 paid=70 · alloc=70 · class=`C3_PAYMENT_JE_WITHOUT_INVOICE_JE` · orphan_ref=false
- **B1D3D-over-1792439446294-3961** (id=43) · ISSUED/UNPAID · total=10 paid=0 · alloc=0 · class=`C2_TEST_ARTIFACT_UNPOSTED` · orphan_ref=false
- **B1D3D-xe-1792439446298-1230** (id=44) · ISSUED/UNPAID · total=40 paid=0 · alloc=0 · class=`C2_TEST_ARTIFACT_UNPOSTED` · orphan_ref=false
- **B1D3D-spoof-1792439446302-6694** (id=45) · PAID/PAID · total=22 paid=22 · alloc=22 · class=`C3_PAYMENT_JE_WITHOUT_INVOICE_JE` · orphan_ref=false
- **B1D3D-dup-1792439446312-4177** (id=46) · PAID/PAID · total=18 paid=18 · alloc=18 · class=`C3_PAYMENT_JE_WITHOUT_INVOICE_JE` · orphan_ref=false
- **B1D3D-conc-1792439446323-7822** (id=47) · PAID/PAID · total=50 paid=50 · alloc=50 · class=`C3_PAYMENT_JE_WITHOUT_INVOICE_JE` · orphan_ref=false
- **B1D3D-idem-1792439446333-2357** (id=48) · PAID/PAID · total=80 paid=80 · alloc=80 · class=`C3_PAYMENT_JE_WITHOUT_INVOICE_JE` · orphan_ref=false
- **B1D3E-HTTP-INV-1792440711495** (id=51) · PAID/PAID · total=20 paid=20 · alloc=20 · class=`C3_PAYMENT_JE_WITHOUT_INVOICE_JE` · orphan_ref=false
- **B1D4-MX-1792441175257** (id=53) · ISSUED/UNPAID · total=16 paid=0 · alloc=0 · class=`C2_TEST_ARTIFACT_UNPOSTED` · orphan_ref=false
- **B1D3E-HTTP-INV-1792441190123** (id=56) · PAID/PAID · total=20 paid=20 · alloc=20 · class=`C3_PAYMENT_JE_WITHOUT_INVOICE_JE` · orphan_ref=false
- **B1D4-MX-1792441509960** (id=57) · ISSUED/UNPAID · total=16 paid=0 · alloc=0 · class=`C2_TEST_ARTIFACT_UNPOSTED` · orphan_ref=false
- **B1D3E-HTTP-INV-1792441559231** (id=60) · PAID/PAID · total=20 paid=20 · alloc=20 · class=`C3_PAYMENT_JE_WITHOUT_INVOICE_JE` · orphan_ref=false
- **B1D4-MX-1792441649842** (id=61) · ISSUED/UNPAID · total=16 paid=0 · alloc=0 · class=`C2_TEST_ARTIFACT_UNPOSTED` · orphan_ref=false
- **B1D3E-HTTP-INV-1792441681810** (id=64) · PAID/PAID · total=20 paid=20 · alloc=20 · class=`C3_PAYMENT_JE_WITHOUT_INVOICE_JE` · orphan_ref=false

## 3) تحقيق `INV-FIN-001`
```
{
  "invoice_id": 1,
  "invoice_number": "INV-FIN-001",
  "status": "PARTIAL",
  "payment_status": "PARTIAL",
  "total_amount": 57500,
  "paid_amount": 20000,
  "remaining_amount": 37500,
  "journal_entry_id": null,
  "invoice_line_count": 0,
  "allocations": [],
  "je_mentions": [],
  "gl_lines_matching_amounts": [],
  "root_cause": "finance-bootstrap.js inserts INV-FIN-001 with paid_amount=20000 / remaining=37500 without payment rows, allocations, invoice lines, or journal entries (demo seed only).",
  "drift": {
    "paid_vs_alloc_all": 20000,
    "paid_vs_alloc_posted": 20000,
    "explanation": "paid_amount is synthetic; no finance_payment_allocations rows exist"
  }
}
```

## 4) التكرارات والتوازن
- تكرار مراجع قيود الفواتير: **0**
- تكرار مراجع قيود الدفعات: **0**
- تكرار التخصيصات: **0**
- قيود فاتورة/دفعة غير متوازنة: **0**
- تخصيصات عبر كيانات: **0**
- مدفوعات مرحّلة بلا تخصيص: **0**
- مدفوعات ADVANCE: **0**
- اختلاف remaining عن total-paid: **0**

### فجوة AR (GL 1130 مقابل الفواتير)
```
{
  "gl_1130_net": 893.37,
  "gl_1130_by_reference_type": [
    {
      "reference_type": "INVOICE",
      "debits": 1466.62,
      "credits": 0,
      "net": 1466.62
    },
    {
      "reference_type": "JOURNAL_REVERSAL",
      "debits": 0,
      "credits": 580,
      "net": -580
    },
    {
      "reference_type": "PAYMENT",
      "debits": 0,
      "credits": 573.25,
      "net": -573.25
    },
    {
      "reference_type": null,
      "debits": 580,
      "credits": 0,
      "net": 580
    }
  ],
  "invoice_open_balances": {
    "remaining_with_je": 1418.62,
    "remaining_no_je": 75182.75,
    "remaining_all": 76601.37,
    "total_no_je": 95708,
    "paid_no_je": 20525.25
  },
  "note": "GL 1130 reflects only posted JEs. Seed INV-FIN-* and other no-JE invoices are not in GL; payment JEs that credit 1130 against no-JE invoices create an AR hole (Cr without matching Dr)."
}
```

### فواتير drift / ثقب قيد الدفعة
```
{
  "balance_drift_invoices": [
    {
      "invoice_id": 1,
      "invoice_number": "INV-FIN-001",
      "paid": 20000,
      "alloc_all": 0,
      "alloc_posted": 0
    }
  ],
  "payment_je_without_invoice_je": [
    {
      "invoice_id": 39,
      "invoice_number": "B1D3D-cash-1792439446254-5014",
      "total_amount": 120,
      "paid_amount": 120,
      "alloc_sum": 120,
      "payment_ids": [
        6
      ],
      "payment_jes": [
        42
      ]
    },
    {
      "invoice_id": 40,
      "invoice_number": "B1D3D-bank-1792439446274-6981",
      "total_amount": 200,
      "paid_amount": 55.25,
      "alloc_sum": 55.25,
      "payment_ids": [
        7
      ],
      "payment_jes": [
        43
      ]
    },
    {
      "invoice_id": 41,
      "invoice_number": "B1D3D-m1-1792439446283-7238",
      "total_amount": 30,
      "paid_amount": 30,
      "alloc_sum": 30,
      "payment_ids": [
        8
      ],
      "payment_jes": [
        44
      ]
    },
    {
      "invoice_id": 42,
      "invoice_number": "B1D3D-m2-1792439446284-5428",
      "total_amount": 70,
      "paid_amount": 70,
      "alloc_sum": 70,
      "payment_ids": [
        8
      ],
      "payment_jes": [
        44
      ]
    },
    {
      "invoice_id": 45,
      "invoice_number": "B1D3D-spoof-1792439446302-6694",
      "total_amount": 22,
      "paid_amount": 22,
      "alloc_sum": 22,
      "payment_ids": [
        9
      ],
      "payment_jes": [
        45
      ]
    },
    {
      "invoice_id": 46,
      "invoice_number": "B1D3D-dup-1792439446312-4177",
      "total_amount": 18,
      "paid_amount": 18,
      "alloc_sum": 18,
      "payment_ids": [
        10
      ],
      "payment_jes": [
        46
      ]
    },
    {
      "invoice_id": 47,
      "invoice_number": "B1D3D-conc-1792439446323-7822",
      "total_amount": 50,
      "paid_amount": 50,
      "alloc_sum": 50,
      "payment_ids": [
        11
      ],
      "payment_jes": [
        47
      ]
    },
    {
      "invoice_id": 48,
      "invoice_number": "B1D3D-idem-1792439446333-2357",
      "total_amount": 80,
      "paid_amount": 80,
      "alloc_sum": 80,
      "payment_ids": [
        12,
        13
      ],
      "payment_jes": [
        48,
        49
      ]
    },
    {
      "invoice_id": 51,
      "invoice_number": "B1D3E-HTTP-INV-1792440711495",
      "total_amount": 20,
      "paid_amount": 20,
      "alloc_sum": 20,
      "payment_ids": [
        17
      ],
      "payment_jes": [
        51
      ]
    },
    {
      "invoice_id": 56,
      "invoice_number": "B1D3E-HTTP-INV-1792441190123",
      "total_amount": 20,
      "paid_amount": 20,
      "alloc_sum": 20,
      "payment_ids": [
        24
      ],
      "payment_jes": [
        62
      ]
    },
    {
      "invoice_id": 60,
      "invoice_number": "B1D3E-HTTP-INV-1792441559231",
      "total_amount": 20,
      "paid_amount": 20,
      "alloc_sum": 20,
      "payment_ids": [
        30
      ],
      "payment_jes": [
        72
      ]
    },
    {
      "invoice_id": 64,
      "invoice_number": "B1D3E-HTTP-INV-1792441681810",
      "total_amount": 20,
      "paid_amount": 20,
      "alloc_sum": 20,
      "payment_ids": [
        36
      ],
      "payment_jes": [
        84
      ]
    }
  ]
}
```

## 5) القرارات المطلوبة (بدون تنفيذ)
### D1 — بذور INV-FIN-001 / INV-FIN-002
- **الاكتشاف:** مُدرجة عبر finance-bootstrap.js بدون أسطر فاتورة أو قيود أو دفعات. INV-FIN-001 يحمل paid_amount=20000 اصطناعيًا → drift مقابل التخصيصات.
- **الخيارات:**
  - A) الإبقاء كبيانات عرض UI فقط مع وسم/عزل من تقارير GL (لا ترحيل رجعي)
  - B) حملة بيانات لاحقة: إنشاء قيد فاتورة + مستند تحصيل/تخصيص متوازن (يحتاج موافقة B1.d.5x منفصلة)
  - C) أرشفة/إلغاء محاسبي للبذور واستبدالها بمستندات صحيحة لاحقًا
- **التوصية:** A للبيئات غير الإنتاجية الآن؛ أي تصحيح رصيد يحتاج موافقة منفصلة وليس جزءًا من 5a/5b UNIQUE.
- **يعيق UNIQUE 5b؟** لا · **يعيق تفعيل الأعلام؟** نعم

### D2 — آثار اختبار B1D3D/B1D3E/B1D4 في public
- **الاكتشاف:** 15 فاتورة اختبار غير مرحّلة + 12 بفجوة قيد دفعة دون قيد فاتورة.
- **الخيارات:**
  - A) تنظيف بيئة التطوير: حذف آثار الاختبار من public بعد موافقة (حملة منفصلة)
  - B) الإبقاء مع قائمة استثناء في تقارير الجاهزية
  - C) عزل كل اختبارات المستقبل في schema b1a_test فقط (تحصين إجرائي)
- **التوصية:** C فورًا إجرائيًا؛ A اختيارية لتنظيف public قبل أي Staging حقيقي.
- **يعيق UNIQUE 5b؟** لا · **يعيق تفعيل الأعلام؟** لا

### D3 — فجوة محاسبية: قيد دفعة (Cr 1130) دون قيد فاتورة (Dr 1130)
- **الاكتشاف:** 12 فاتورة / مجموع تخصيصات مرحّلة ≈ 525.25 — كلها آثار اختبار على المسار الذي يحدّث الأرصدة ويرحّل الدفعة دون إصدار قيد فاتورة مسبق.
- **الخيارات:**
  - A) لا عكس جماعي — معالجة فردية لاحقًا إن لزم (عكس دفعة ثم إعادة دورة كاملة)
  - B) ترحيل رجعي لقيود الفواتير الناقصة ثم الإبقاء على قيود الدفعات (يحتاج موافقة صريحة + سيناريو توازن)
  - C) اعتبارها غير إنتاجية وتركها إن بقيت بيئة محلية فقط
- **التوصية:** C محليًا الآن؛ قبل Staging اختر A أو B بموافقة منفصلة. لا تنفيذ في 5a.
- **يعيق UNIQUE 5b؟** لا · **يعيق تفعيل الأعلام؟** نعم

### D4 — UNIQUE migrations (تحضير B1.d.5b فقط)
- **الاكتشاف:** لا تكرار حالي على (reference_type,reference_id) المرحّل ولا على (payment_id,invoice_id). الحماية اليوم تطبيقية فقط.
- **الخيارات:**
  - A) المتابعة إلى B1.d.5b: partial UNIQUE على مراجع القيود المرحّلة + UNIQUE(payment_id,invoice_id) بعد نسخة احتياطية
  - B) تأجيل UNIQUE حتى اكتمال تنظيف البيانات/Staging
  - C) UNIQUE على التخصيصات فقط أولًا
- **التوصية:** A مقبول تقنيًا لأن البيانات الحالية بلا تكرار؛ يبقى يحتاج موافقة صريحة على 5b.
- **يعيق UNIQUE 5b؟** لا · **يعيق تفعيل الأعلام؟** لا

### D5 — ترتيب ما قبل تفعيل الأعلام
- **الاكتشاف:** الأعلام ما زالت false. تفعيلها مع بذور/فجوات تاريخية يخلط بيانات العرض مع مسار الخدمة.
- **الخيارات:**
  - إغلاق D1+D3 قبل أي Staging flags
  - تفعيل الفواتير أولًا على بيانات نظيفة فقط
  - تأجيل كل التفعيل حتى بعد UNIQUE + تنظيف
- **التوصية:** إغلاق قرارات D1 وD3 ثم 5b UNIQUE ثم 5c/5d ثم 6a/6b — كل خطوة بموافقة مستقلة.
- **يعيق UNIQUE 5b؟** لا · **يعيق تفعيل الأعلام؟** نعم

## 6) تجهيز B1.d.5b (مسودة — لا تنفيذ)
- **5b-1 نسخة احتياطية / نافذة صيانة:** pending-approval
- **5b-2 Migration: UNIQUE (payment_id, invoice_id) على finance_payment_allocations:** pending-approval — لا صفوف مكررة حاليًا — جاهز تقنيًا بعد الموافقة
- **5b-3 Migration: partial UNIQUE (reference_type, reference_id) WHERE is_posted AND reference_id IS NOT NULL:** pending-approval — لا تكرار حالي — جاهز تقنيًا بعد الموافقة
- **5b-4 اختبارات معزولة تثبت رفض التكرار على مستوى DB:** pending-approval
- **5b-OUT خارج 5b: أي ترحيل رجعي / تصحيح INV-FIN-001 / تنظيف آثار الاختبار:** requires-separate-approval

## 7) ضمانات هذه الشريحة
```
{
  "mutationsExecuted": false,
  "default_transaction_read_only": true,
  "flagsUntouched": true,
  "noMigrations": true,
  "noHttpChanges": true,
  "noRepostOrReverse": true
}
```

## 8) نتائج الفحص
- PASS inventory-loaded: inv_no_je=29/48
- PASS no-orphan-invoice-je-refs: 0 invoices missing link but having ref JE
- PASS inv-fin-001-root-cause: bootstrap synthetic paid=20000; alloc=0; no JE; no lines
- PASS no-duplicates
- PASS posted-invoice-payment-jes-balanced
- PASS no-cross-entity-allocations
- PASS no-unallocated-posted-payments
- PASS no-advance-typed-payments
- PASS remaining-equals-total-minus-paid
- PASS accounting-hole-documented: invoices=12 alloc_sum=525.25
- PASS ar-gl-gap-documented: gl1130=893.37 remaining_no_je=75182.75
- PASS readonly-session-enforced: 25006

**توقف:** بانتظار موافقة صريحة قبل B1.d.5b أو أي معالجة بيانات.
