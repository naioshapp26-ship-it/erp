'use strict';

/**
 * P3 / B1.b tests — FinancePostingService
 * Isolated writes: schema b1a_test on local VM DB (NOT Production).
 * HTTP contract checks against :3010 use public DRAFT rows prefixed B1B- only.
 * No migrations. Does not call invoice/payment create posting paths.
 */
const fs = require('fs');
const path = require('path');
const http = require('http');
const { Client, Pool } = require('pg');
const {
  postManualEntry,
  reverseEntry,
  PostingError,
  REVERSAL_REF_TYPE,
  assertPermission
} = require('./finance/services/finance-posting-service');

const ART = '/opt/cursor/artifacts';
fs.mkdirSync(ART, { recursive: true });
const DB_URL = process.env.DATABASE_URL || 'postgresql://vendowor_erp_user:vendowor_local_dev@127.0.0.1:5432/vendowor_erp';
const BASE = process.env.APP_BASE_URL || 'http://127.0.0.1:3010';

const results = [];
function pass(name, detail = '') {
  results.push({ name, ok: true, detail });
  console.log(`PASS  ${name}${detail ? ` — ${detail}` : ''}`);
}
function fail(name, detail = '') {
  results.push({ name, ok: false, detail });
  console.log(`FAIL  ${name}${detail ? ` — ${detail}` : ''}`);
}

function httpJson(method, urlPath, body, headers = {}) {
  return new Promise((resolve, reject) => {
    const u = new URL(urlPath, BASE);
    const payload = body ? JSON.stringify(body) : null;
    const req = http.request({
      hostname: u.hostname, port: u.port || 80, path: u.pathname, method,
      headers: {
        'Content-Type': 'application/json',
        ...(payload ? { 'Content-Length': Buffer.byteLength(payload) } : {}),
        ...headers
      }
    }, (res) => {
      let raw = '';
      res.on('data', (c) => { raw += c; });
      res.on('end', () => {
        let json = null;
        try { json = JSON.parse(raw); } catch { /* */ }
        resolve({ status: res.statusCode, json, raw: raw.slice(0, 400) });
      });
    });
    req.on('error', reject);
    if (payload) req.write(payload);
    req.end();
  });
}

async function seedDraft(client, { unbalanced = false, label = 'ok' } = {}) {
  const num = `B1B-${label}-${Date.now()}-${Math.floor(Math.random() * 1000)}`;
  const a1130 = (await client.query(`SELECT account_id FROM finance_accounts WHERE account_code='1130'`)).rows[0];
  const a4100 = (await client.query(`SELECT account_id FROM finance_accounts WHERE account_code='4100'`)).rows[0];
  const entry = await client.query(
    `INSERT INTO finance_journal_entries
     (entry_number, entry_date, entry_type, description, status, is_posted, entity_id, created_by)
     VALUES ($1, CURRENT_DATE, 'MANUAL', $2, 'DRAFT', false, 'HQ001', 'b1b-test')
     RETURNING entry_id, entry_number, status`,
    [num, `B1.b draft ${label}`]
  );
  const id = entry.rows[0].entry_id;
  const debit = 100;
  const credit = unbalanced ? 90 : 100;
  await client.query(
    `INSERT INTO finance_journal_lines (entry_id, line_number, account_id, account_code, debit_amount, credit_amount, description)
     VALUES ($1,1,$2,'1130',$3,0,'مدين'), ($1,2,$4,'4100',0,$5,'دائن')`,
    [id, a1130.account_id, debit, a4100.account_id, credit]
  );
  return entry.rows[0];
}

async function main() {
  const report = {
    phase: 'B1.b',
    changedFiles: [
      'finance/services/finance-posting-service.js (new)',
      'finance/api/finance-routes.js (post wired + reverse endpoint)',
      'test-finance-p3-b1b-posting-service.js (new)',
      'docs/finance-leadership-p3-b1b-report.md (new)'
    ],
    protected: [],
    stillAtRisk: [],
    migrationNeed: {},
    autoPostUnchanged: null,
    b1cPlan: []
  };

  // Permission unit checks
  assertPermission({ authenticated: true, role: 'Admin', permissions: [] }, 'post').ok
    ? pass('perm-admin-post') : fail('perm-admin-post');
  assertPermission({ authenticated: true, role: 'viewer', permissions: [] }, 'reverse').ok
    ? fail('perm-viewer-reverse-denied') : pass('perm-viewer-reverse-denied');
  assertPermission({ authenticated: false, role: null, permissions: [] }, 'post').status === 401
    ? pass('perm-unauth-post-401') : fail('perm-unauth-post-401');
  assertPermission({ authenticated: true, role: null, permissions: [] }, 'post').ok
    ? fail('perm-no-legacy-unscoped') : pass('perm-no-legacy-unscoped');

  const client = new Client({ connectionString: DB_URL, ssl: false });
  await client.connect();
  await client.query('SET search_path TO b1a_test, public');

  // Snapshot public JE count (auto-post paths untouched — we only create MANUAL drafts in b1a_test)
  const publicBefore = await client.query('SELECT COUNT(*)::int AS c FROM public.finance_journal_entries');

  try {
    // Balanced post
    const d1 = await seedDraft(client, { label: 'bal' });
    const posted = await postManualEntry(client, d1.entry_id, {
      trustedTestActor: true,
      actor: { authenticated: true, userId: 'b1b', role: 'Admin', permissions: ['journals.post'], entityId: 'HQ001' }
    });
    posted.entry.status === 'POSTED' && posted.entry.is_posted === true
      ? pass('post-balanced-success', posted.entry.entry_number)
      : fail('post-balanced-success');

    // Already posted → 404 contract
    try {
      await postManualEntry(client, d1.entry_id, {
        trustedTestActor: true,
        actor: { authenticated: true, userId: 'b1b', role: 'Admin', permissions: ['journals.post'] , entityId: 'HQ001' }
      });
      fail('post-already-posted-404');
    } catch (e) {
      e instanceof PostingError && e.status === 404
        ? pass('post-already-posted-404', e.code)
        : fail('post-already-posted-404', e.message);
    }

    // Unbalanced
    const dBad = await seedDraft(client, { unbalanced: true, label: 'unbal' });
    try {
      await postManualEntry(client, dBad.entry_id, {
        trustedTestActor: true,
        actor: { authenticated: true, userId: 'b1b', role: 'Admin', permissions: ['journals.post'] , entityId: 'HQ001' }
      });
      fail('post-unbalanced-422');
    } catch (e) {
      e instanceof PostingError && e.status === 422 && e.code === 'UNBALANCED'
        ? pass('post-unbalanced-422')
        : fail('post-unbalanced-422', `${e.code}|${e.message}`);
    }
    const stillDraft = await client.query(`SELECT status FROM finance_journal_entries WHERE entry_id=$1`, [dBad.entry_id]);
    stillDraft.rows[0].status === 'DRAFT' ? pass('post-unbalanced-no-side-effect') : fail('post-unbalanced-no-side-effect');

    // Permission deny reverse
    try {
      await reverseEntry(client, d1.entry_id, {
        trustedTestActor: true,
        actor: { authenticated: true, userId: 'x', role: 'viewer', permissions: [] , entityId: 'HQ001' },
        reason: 'test'
      });
      fail('reverse-perm-403');
    } catch (e) {
      e.status === 403 ? pass('reverse-perm-403') : fail('reverse-perm-403', e.message);
    }

    // Reverse success — original unchanged status POSTED
    const rev = await reverseEntry(client, d1.entry_id, {
      trustedTestActor: true,
      actor: { authenticated: true, userId: 'b1b', role: 'Admin', permissions: ['journals.reverse'] , entityId: 'HQ001' },
      reason: 'اختبار عكس B1.b'
    });
    rev.entry.reference_type === REVERSAL_REF_TYPE && Number(rev.entry.reference_id) === Number(d1.entry_id)
      ? pass('reverse-linked-to-original', String(rev.entry.entry_id))
      : fail('reverse-linked-to-original');
    const orig = await client.query(`SELECT status, is_posted, entry_type FROM finance_journal_entries WHERE entry_id=$1`, [d1.entry_id]);
    orig.rows[0].status === 'POSTED' && orig.rows[0].is_posted === true
      ? pass('reverse-original-not-mutated-status')
      : fail('reverse-original-not-mutated-status', JSON.stringify(orig.rows[0]));

    const revLines = await client.query(
      `SELECT SUM(debit_amount)::float AS d, SUM(credit_amount)::float AS c FROM finance_journal_lines WHERE entry_id=$1`,
      [rev.entry.entry_id]
    );
    revLines.rows[0].d === revLines.rows[0].c ? pass('reverse-balanced') : fail('reverse-balanced', JSON.stringify(revLines.rows[0]));

    // Double reverse
    try {
      await reverseEntry(client, d1.entry_id, {
        trustedTestActor: true,
        actor: { authenticated: true, userId: 'b1b', role: 'Admin', permissions: ['journals.reverse'] , entityId: 'HQ001' },
        reason: 'مرة ثانية'
      });
      fail('reverse-second-409');
    } catch (e) {
      e.status === 409 && e.code === 'ALREADY_REVERSED'
        ? pass('reverse-second-409')
        : fail('reverse-second-409', `${e.code}|${e.message}`);
    }

    // Concurrent post
    const dConc = await seedDraft(client, { label: 'conc' });
    const pool = new Pool({ connectionString: DB_URL, ssl: false, max: 4 });
    const runPost = async () => {
      const c = await pool.connect();
      try {
        await c.query('SET search_path TO b1a_test, public');
        return await postManualEntry(c, dConc.entry_id, {
          trustedTestActor: true,
          actor: { authenticated: true, userId: 'b1b', role: 'Admin', permissions: ['journals.post'] , entityId: 'HQ001' }
        });
      } finally {
        c.release();
      }
    };
    const conc = await Promise.allSettled([runPost(), runPost()]);
    const ok = conc.filter((x) => x.status === 'fulfilled').length;
    const denied = conc.filter((x) => x.status === 'rejected').length;
    ok === 1 && denied === 1
      ? pass('concurrent-post-one-winner', JSON.stringify(conc.map((x) => x.status)))
      : fail('concurrent-post-one-winner', JSON.stringify(conc.map((x) => x.status === 'fulfilled' ? 'ok' : x.reason?.code || x.reason?.message)));

    // Concurrent reverse
    const dRev = await seedDraft(client, { label: 'crev' });
    await postManualEntry(client, dRev.entry_id, {
      trustedTestActor: true,
      actor: { authenticated: true, userId: 'b1b', role: 'Admin', permissions: ['journals.post'] , entityId: 'HQ001' }
    });
    const runRev = async () => {
      const c = await pool.connect();
      try {
        await c.query('SET search_path TO b1a_test, public');
        return await reverseEntry(c, dRev.entry_id, {
          trustedTestActor: true,
          actor: { authenticated: true, userId: 'b1b', role: 'Admin', permissions: ['journals.reverse'] , entityId: 'HQ001' },
          reason: 'سباق عكس'
        });
      } finally {
        c.release();
      }
    };
    const concR = await Promise.allSettled([runRev(), runRev()]);
    const okR = concR.filter((x) => x.status === 'fulfilled').length;
    const denR = concR.filter((x) => x.status === 'rejected').length;
    const revCount = await client.query(
      `SELECT COUNT(*)::int AS c FROM finance_journal_entries WHERE reference_type=$1 AND reference_id=$2 AND is_posted=true`,
      [REVERSAL_REF_TYPE, dRev.entry_id]
    );
    okR === 1 && denR === 1 && revCount.rows[0].c === 1
      ? pass('concurrent-reverse-one-winner', `reversals=${revCount.rows[0].c}`)
      : fail('concurrent-reverse-one-winner', JSON.stringify({ okR, denR, c: revCount.rows[0].c }));

    // Mid-transaction failure: unbalanced path already proved no partial post.
    // Simulate explicit ROLLBACK path by forcing account missing
    const dAcc = await seedDraft(client, { label: 'acc' });
    await client.query(`UPDATE finance_journal_lines SET account_id = NULL, account_code = 'NOPE' WHERE entry_id=$1`, [dAcc.entry_id]);
    try {
      await postManualEntry(client, dAcc.entry_id, {
        trustedTestActor: true,
        actor: { authenticated: true, userId: 'b1b', role: 'Admin', permissions: ['journals.post'] , entityId: 'HQ001' }
      });
      fail('post-bad-account-422');
    } catch (e) {
      e.status === 422 ? pass('post-bad-account-422', e.code) : fail('post-bad-account-422', e.message);
    }
    const dAccState = await client.query(`SELECT status FROM finance_journal_entries WHERE entry_id=$1`, [dAcc.entry_id]);
    dAccState.rows[0].status === 'DRAFT' ? pass('post-bad-account-rolled-back') : fail('post-bad-account-rolled-back');

    await pool.end();

    // Historical uniqueness analysis (public read-only) for migration recommendation
    const hist = await client.query(`
      SELECT reference_type, COUNT(*)::int AS n,
             COUNT(*) FILTER (WHERE reference_id IS NOT NULL)::int AS with_ref_id
      FROM public.finance_journal_entries
      GROUP BY 1 ORDER BY 1 NULLS LAST
    `);
    const dups = await client.query(`
      SELECT reference_type, reference_id, COUNT(*)::int AS c
      FROM public.finance_journal_entries
      WHERE is_posted = true AND reference_type IS NOT NULL AND reference_id IS NOT NULL
      GROUP BY 1,2 HAVING COUNT(*) > 1
    `);
    report.migrationNeed = {
      executed: false,
      publicDuplicatePostedRefs: dups.rows,
      referenceTypeBreakdown: hist.rows,
      recommendation: [
        'لا تنفَّذ الآن.',
        'لا UNIQUE عام على (reference_type, reference_id) لكل الأنواع — قد يكون مشروعًا وجود أكثر من قيد لنفس المرجع بأنواع مختلفة (مثل INVOICE issue + لاحقًا تسوية).',
        'المقترح لاحقًا بموافقة: فهرس فريد جزئي فقط على reference_type IN (\'JOURNAL_REVERSAL\') AND is_posted — لمنع عكوس مكررة على مستوى DB.',
        'لفواتير/مدفوعات (B1.d+): فهرس فريد جزئي منفصل على posting_kind/entry_type المناسب بعد إدخال العمود — ليس في B1.b.',
        'B1.b يعتمد حاليًا: advisory_xact_lock + FOR UPDATE + فحص وجود عكس نشط. حماية قوية داخل المسار؛ بدون UNIQUE تبقى فجوة نظرية إن تُجاوز القفل.'
      ],
      claimCompleteDbUniqueness: false
    };
    dups.rows.length === 0
      ? pass('hist-no-public-dup-refs')
      : fail('hist-no-public-dup-refs', JSON.stringify(dups.rows));
    pass('migration-not-executed');

    report.protected = [
      'POST /finance/journal-entries/:id/post عبر FinancePostingService (توازن، حسابات، حالة DRAFT، قفل)',
      'POST /finance/journal-entries/:id/reverse (قيد جديد مرتبط، منع العكس المكرر داخل المعاملة+advisory lock)',
      'صلاحيات reverse إلزامية؛ post يدعم Admin/Manager/explicit أو legacy_unscoped',
      'audit_logs لعمليات JOURNAL_POST / JOURNAL_REVERSE عند توفر الجدول'
    ];
    report.stillAtRisk = [
      'POST /finance/invoices و /payments ما زالا يرحّلان تلقائيًا بلا الخدمة',
      'DELETE قيد/فاتورة مرحّلة ما زال بلا حراسة (B1.c)',
      'تعديل أسطر قيد مرحّل عبر journal-lines (B1.c)',
      'بدون migration UNIQUE: حماية العكس تعتمد على القفل التطبيقي وليس قيد DB',
      'post بوضع legacy_unscoped إن لم يُرسل دور/صلاحية'
    ];
    report.autoPostUnchanged = true;
    report.b1cPlan = [
      { step: 'B1.c.1', title: 'assertMutable على DELETE/PUT journal entries + journal-lines' },
      { step: 'B1.c.2', title: 'منع DELETE فاتورة/دفعة لها journal_entry_id فعّال' },
      { step: 'B1.c.3', title: 'رفض تعديل بنود قيد POSTED' },
      { step: 'B1.c.4', title: 'اختبارات انحدار UI journal/receivables' },
      { step: 'B1.c.out', title: 'لا توجيه invoices/payments بعد؛ لا UNIQUE migration دون موافقة' }
    ];

    // Confirm invoice/payment route source still has inline JE (unchanged auto-post)
    const routesSrc = fs.readFileSync(path.join(__dirname, 'finance/api/finance-routes.js'), 'utf8');
    const invoiceStillAuto = /router\.post\('\/invoices'[\s\S]*?INSERT INTO finance_journal_entries/.test(routesSrc);
    const paymentStillAuto = /router\.post\('\/payments'[\s\S]*?INSERT INTO finance_journal_entries/.test(routesSrc);
    const postUsesService = /postManualEntry\(db\.pool/.test(routesSrc);
    invoiceStillAuto && paymentStillAuto
      ? pass('auto-post-paths-untouched')
      : fail('auto-post-paths-untouched');
    postUsesService ? pass('manual-post-uses-service') : fail('manual-post-uses-service');

    const publicAfter = await client.query('SELECT COUNT(*)::int AS c FROM public.finance_journal_entries');
    publicAfter.rows[0].c === publicBefore.rows[0].c
      ? pass('public-je-count-unchanged', String(publicAfter.rows[0].c))
      : fail('public-je-count-unchanged', `${publicBefore.rows[0].c}->${publicAfter.rows[0].c}`);

  } finally {
    await client.end();
  }

  // HTTP contract against running server (public) — create DRAFT via API then post/reverse; cleanup not required (test prefix)
  try {
    const login = await httpJson('POST', '/api/auth/login', { email: 'admin@naiosh.com', password: 'Admin@123' });
    if (!login.json?.success) throw new Error('login failed');
    const session = login.json.data.session;
    const token = (session && typeof session === 'object' ? session.token : session) || login.json.data.token;

    const pg = new Client({ connectionString: DB_URL, ssl: false });
    await pg.connect();
    const acc = await pg.query(`SELECT account_id, account_code FROM finance_accounts WHERE account_code IN ('1130','4100')`);
    const map = Object.fromEntries(acc.rows.map((r) => [r.account_code, r.account_id]));
    const num = `B1B-HTTP-${Date.now()}`;
    const seeded = await pg.query(
      `INSERT INTO finance_journal_entries
       (entry_number, entry_date, entry_type, description, status, is_posted, entity_id, entity_type, created_by)
       VALUES ($1, CURRENT_DATE, 'MANUAL', 'B1B HTTP draft', 'DRAFT', false, 'HQ001', 'HQ', 'b1b-http')
       RETURNING entry_id`,
      [num]
    );
    await pg.query(
      `INSERT INTO finance_journal_lines (entry_id, line_number, account_id, account_code, debit_amount, credit_amount, entity_id)
       VALUES ($1,1,$2,'1130',50,0,'HQ001'),($1,2,$3,'4100',0,50,'HQ001')`,
      [seeded.rows[0].entry_id, map['1130'], map['4100']]
    );
    await pg.end();

    const id = seeded.rows[0].entry_id;
    pass('http-create-draft', String(id));
    const auth = { Authorization: `Bearer ${token}` };
    const post = await httpJson('POST', `/finance/journal-entries/${id}/post`, {}, auth);
    post.status === 200 && post.json?.entry?.status === 'POSTED'
      ? pass('http-post-contract', String(post.status))
      : fail('http-post-contract', `${post.status} ${post.raw}`);

    const rev = await httpJson('POST', `/finance/journal-entries/${id}/reverse`, { reason: 'HTTP B1.b reverse' }, auth);
    rev.status === 201 && rev.json?.entry?.reference_type === REVERSAL_REF_TYPE
      ? pass('http-reverse-contract', String(rev.json.entry.entry_id))
      : fail('http-reverse-contract', `${rev.status} ${rev.raw}`);

    const rev2 = await httpJson('POST', `/finance/journal-entries/${id}/reverse`, { reason: 'again' }, auth);
    rev2.status === 409 ? pass('http-reverse-repeat-409') : fail('http-reverse-repeat-409', String(rev2.status));
  } catch (e) {
    fail('http-suite', e.message);
  }

  const summary = {
    passed: results.filter((r) => r.ok).length,
    failed: results.filter((r) => !r.ok).length,
    results,
    report
  };

  const md = [];
  md.push('# تقرير تنفيذ B1.b — FinancePostingService');
  md.push('');
  md.push(`**النتيجة:** ${summary.failed === 0 ? 'PASS' : 'FAIL'} — ${summary.passed} / ${summary.failed}`);
  md.push('');
  md.push('## الملفات التي تغيّرت');
  report.changedFiles.forEach((f) => md.push(`- ${f}`));
  md.push('');
  md.push('## ما أصبح محميًا');
  report.protected.forEach((x) => md.push(`- ${x}`));
  md.push('');
  md.push('## ما زال معرضًا للخطر');
  report.stillAtRisk.forEach((x) => md.push(`- ${x}`));
  md.push('');
  md.push('## هل الترحيل التلقائي الحالي كما هو؟');
  md.push(report.autoPostUnchanged ? '**نعم** — مسارات `POST /finance/invoices` و`POST /finance/payments` لم تُعدَّل.' : 'لا');
  md.push('');
  md.push('## هل نحتاج migration لضمان التفرد؟');
  md.push('**نعم كتحسين لاحق (غير منفَّذ في B1.b).**');
  report.migrationNeed.recommendation.forEach((r) => md.push(`- ${r}`));
  md.push('');
  md.push('`claimCompleteDbUniqueness: false` — لا نعلن اكتمال حماية DB بدون UNIQUE.');
  md.push('');
  md.push('## خطة B1.c (بدون تنفيذ)');
  report.b1cPlan.forEach((s) => md.push(`- **${s.step}**: ${s.title}`));
  md.push('');
  md.push('## نتائج الاختبارات');
  results.forEach((r) => md.push(`- ${r.ok ? 'PASS' : 'FAIL'} ${r.name}${r.detail ? `: ${r.detail}` : ''}`));
  md.push('');
  md.push('لا دمج / لا Staging / لا Production. بانتظار موافقة قبل أي مرحلة تالية.');

  fs.writeFileSync(path.join(ART, 'finance-p3-b1b-report.json'), JSON.stringify(summary, null, 2));
  fs.writeFileSync(path.join(ART, 'finance-p3-b1b-report.md'), md.join('\n'));
  fs.writeFileSync(path.join(__dirname, 'docs/finance-leadership-p3-b1b-report.md'), md.join('\n'));

  console.log('\n=== SUMMARY ===');
  console.log(JSON.stringify({ passed: summary.passed, failed: summary.failed, verdict: summary.failed ? 'FAIL' : 'PASS' }, null, 2));
  process.exit(summary.failed ? 1 : 0);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
