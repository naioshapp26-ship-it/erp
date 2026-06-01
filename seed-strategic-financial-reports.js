const { Pool } = require('pg');

const DEFAULT_DB = 'postgresql://postgres:PddzJpAQYezqknsntSzmCUlQYuYJldcT@crossover.proxy.rlwy.net:44255/railway';
const connectionString = process.env.DATABASE_URL || DEFAULT_DB;

const pool = new Pool({
  connectionString,
  ssl: { rejectUnauthorized: false }
});

const ENTITY_ID = process.env.ENTITY_ID || 'HQ001';
const ENTITY_TYPE = process.env.ENTITY_TYPE || 'HQ';

const formatDate = (date) => new Date(date).toISOString().slice(0, 10);

async function seed() {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    const customersCount = await client.query(
      'SELECT COUNT(*)::int as count FROM finance_customers WHERE entity_id = $1',
      [ENTITY_ID]
    );

    if (customersCount.rows[0].count === 0) {
      const customers = [
        { code: 'عميل-001', name: 'شركة السمو للاستثمار', type: 'COMPANY', city: 'الرياض', risk: 'LOW' },
        { code: 'عميل-002', name: 'مؤسسة الريادة المالية', type: 'COMPANY', city: 'جدة', risk: 'MEDIUM' },
        { code: 'عميل-003', name: 'مجموعة آفاق الابتكار', type: 'COMPANY', city: 'الدمام', risk: 'HIGH' },
        { code: 'عميل-004', name: 'مركز النخبة الاستشاري', type: 'COMPANY', city: 'مكة', risk: 'LOW' },
        { code: 'عميل-005', name: 'شركة جسور النمو', type: 'COMPANY', city: 'المدينة', risk: 'MEDIUM' }
      ];

      for (const c of customers) {
        await client.query(
          `INSERT INTO finance_customers
           (customer_code, customer_name_ar, customer_type, city, risk_level, entity_id, is_active, is_blocked, created_at, updated_at, created_by)
           VALUES ($1,$2,$3,$4,$5,$6,true,false,NOW(),NOW(),'SYSTEM')`,
          [c.code, c.name, c.type, c.city, c.risk, ENTITY_ID]
        );
      }
    }

    const customers = await client.query(
      'SELECT customer_id, customer_name_ar FROM finance_customers WHERE entity_id = $1 ORDER BY customer_id',
      [ENTITY_ID]
    );

    const invoicesCount = await client.query(
      'SELECT COUNT(*)::int as count FROM finance_invoices WHERE entity_id = $1',
      [ENTITY_ID]
    );

    if (invoicesCount.rows[0].count === 0 && customers.rows.length) {
      const now = new Date();
      const invoiceData = [
        {
          number: 'فات-2026-001',
          invoiceDate: formatDate(now),
          dueDate: formatDate(new Date(now.getTime() + 10 * 86400000)),
          customer: customers.rows[0],
          total: 12000,
          paid: 6000,
          status: 'PARTIAL',
          paymentStatus: 'PARTIAL',
          branch: 'فرع-الرياض',
          programId: 101,
          notes: 'دفعة أولى ضمن خطة التحصيل.'
        },
        {
          number: 'فات-2026-002',
          invoiceDate: formatDate(new Date(now.getTime() - 7 * 86400000)),
          dueDate: formatDate(new Date(now.getTime() + 7 * 86400000)),
          customer: customers.rows[1],
          total: 8500,
          paid: 8500,
          status: 'PAID',
          paymentStatus: 'PAID',
          branch: 'فرع-جدة',
          programId: 102,
          notes: 'سداد مكتمل.'
        },
        {
          number: 'فات-2026-003',
          invoiceDate: formatDate(new Date(now.getTime() - 40 * 86400000)),
          dueDate: formatDate(new Date(now.getTime() - 5 * 86400000)),
          customer: customers.rows[2],
          total: 15000,
          paid: 0,
          status: 'OVERDUE',
          paymentStatus: 'UNPAID',
          branch: 'فرع-الدمام',
          programId: 103,
          notes: 'فاتورة متأخرة تستلزم متابعة.'
        },
        {
          number: 'فات-2026-004',
          invoiceDate: formatDate(new Date(now.getTime() - 15 * 86400000)),
          dueDate: formatDate(new Date(now.getTime() + 15 * 86400000)),
          customer: customers.rows[3],
          total: 9800,
          paid: 0,
          status: 'ISSUED',
          paymentStatus: 'UNPAID',
          branch: 'فرع-مكة',
          programId: 104,
          notes: 'فاتورة جديدة قيد المتابعة.'
        }
      ];

      for (const inv of invoiceData) {
        const remaining = inv.total - inv.paid;
        const invoiceResult = await client.query(
          `INSERT INTO finance_invoices
           (invoice_number, invoice_date, due_date, customer_id, customer_name, subtotal, tax_amount, discount_amount,
            total_amount, paid_amount, remaining_amount, status, payment_status, allow_partial_payment, allow_installments,
            program_id, entity_type, entity_id, branch_id, notes, created_at, updated_at, created_by)
           VALUES ($1,$2,$3,$4,$5,$6,0,0,$7,$8,$9,$10,$11,true,false,$12,$13,$14,$15,$16,NOW(),NOW(),'SYSTEM')
           RETURNING invoice_id`,
          [
            inv.number,
            inv.invoiceDate,
            inv.dueDate,
            inv.customer.customer_id,
            inv.customer.customer_name_ar,
            inv.total,
            inv.total,
            inv.paid,
            remaining,
            inv.status,
            inv.paymentStatus,
            inv.programId,
            ENTITY_TYPE,
            ENTITY_ID,
            inv.branch,
            inv.notes
          ]
        );

        await client.query(
          `INSERT INTO finance_invoice_lines
           (invoice_id, line_number, item_code, item_name, description, quantity, unit_price, discount_percentage,
            discount_amount, tax_percentage, tax_amount, line_total, revenue_account_id)
           VALUES ($1,1,$2,$3,$4,1,$5,0,0,15,0,$6,NULL)`,
          [
            invoiceResult.rows[0].invoice_id,
            `خدمة-${inv.programId}`,
            `خدمة البرنامج ${inv.programId}`,
            'تفاصيل الخدمة الأساسية',
            inv.total,
            inv.total
          ]
        );
      }
    }

    const paymentsCount = await client.query(
      'SELECT COUNT(*)::int as count FROM finance_payments WHERE entity_id = $1',
      [ENTITY_ID]
    );

    if (paymentsCount.rows[0].count === 0 && customers.rows.length) {
      await client.query(
        `INSERT INTO finance_payments
         (payment_number, payment_date, customer_id, customer_name, payment_amount, payment_method, payment_type, status,
          entity_type, entity_id, branch_id, notes, created_at, updated_at, created_by)
         VALUES
         ('دف-2026-001',$1,$2,$3,6000,'BANK_TRANSFER','PARTIAL','APPROVED',$4,$5,'فرع-الرياض','دفعة جزئية',NOW(),NOW(),'SYSTEM'),
         ('دف-2026-002',$1,$6,$7,8500,'CASH','FULL','APPROVED',$4,$5,'فرع-جدة','دفعة كاملة',NOW(),NOW(),'SYSTEM')`,
        [
          formatDate(new Date()),
          customers.rows[0].customer_id,
          customers.rows[0].customer_name_ar,
          ENTITY_TYPE,
          ENTITY_ID,
          customers.rows[1].customer_id,
          customers.rows[1].customer_name_ar
        ]
      );
    }

    const riskCount = await client.query(
      'SELECT COUNT(*)::int as count FROM finance_ai_risk_scores WHERE entity_id = $1',
      [ENTITY_ID]
    );

    if (riskCount.rows[0].count === 0 && customers.rows.length) {
      const today = formatDate(new Date());
      for (let i = 0; i < Math.min(customers.rows.length, 5); i++) {
        const level = i === 2 ? 'HIGH' : i === 3 ? 'LOW' : 'MEDIUM';
        const score = i === 2 ? 82 : i === 3 ? 35 : 60 + i * 3;
        await client.query(
          `INSERT INTO finance_ai_risk_scores
           (customer_id, assessment_date, risk_score, risk_level, risk_factors, calculation_details,
            recommendations, suggested_actions, entity_type, entity_id, model_version, created_at)
           VALUES ($1,$2,$3,$4,$5::jsonb,$6::jsonb,$7,$8::jsonb,$9,$10,'v1.0.0',NOW())`,
          [
            customers.rows[i].customer_id,
            today,
            score,
            level,
            JSON.stringify({ overdue_invoices: i + 1, payment_delay_days: 5 + i * 2 }),
            JSON.stringify({ model: 'strategic', confidence: 0.84 }),
            'رفع متابعة التحصيل وتحديث الضمانات.',
            JSON.stringify(['متابعة أسبوعية', 'تحديث خطط السداد']),
            ENTITY_TYPE,
            ENTITY_ID
          ]
        );
      }
    }

    const forecastCount = await client.query(
      'SELECT COUNT(*)::int as count FROM finance_ai_forecasts WHERE entity_id = $1',
      [ENTITY_ID]
    );

    if (forecastCount.rows[0].count === 0) {
      await client.query(
        `INSERT INTO finance_ai_forecasts
         (entity_id, forecast_period, forecast_type, forecast_amount, confidence_level, ai_model, ai_insights, created_at)
         VALUES
         ($1,'الربع الأول 2026','تدفق نقدي',48000,0.82,'Nayosh-FinAI', '{"notes":"توقع مستقر مع نمو متوسط"}', NOW()),
         ($1,'الربع الثاني 2026','تدفق نقدي',52000,0.79,'Nayosh-FinAI', '{"notes":"زيادة ملحوظة في التحصيل"}', NOW()),
         ($1,'الربع الثالث 2026','تدفق نقدي',61000,0.76,'Nayosh-FinAI', '{"notes":"توسع في البرامج عالية الإيراد"}', NOW())`,
        [ENTITY_ID]
      );
    }

    const cashflowCount = await client.query(
      `SELECT
         (SELECT COUNT(*) FROM finance_cashflow_operating WHERE entity_id = $1) as operating,
         (SELECT COUNT(*) FROM finance_cashflow_investing WHERE entity_id = $1) as investing,
         (SELECT COUNT(*) FROM finance_cashflow_financing WHERE entity_id = $1) as financing`,
      [ENTITY_ID]
    );

    const counts = cashflowCount.rows[0];
    if (Number(counts.operating) === 0) {
      await client.query(
        `INSERT INTO finance_cashflow_operating
         (entity_id, flow_type, amount, description, flow_date, created_by)
         VALUES
         ($1,'customer_collection',25000,'تحصيلات برامج رئيسية',$2,'SYSTEM'),
         ($1,'salary_payment',-9000,'رواتب تشغيلية',$2,'SYSTEM')`,
        [ENTITY_ID, formatDate(new Date())]
      );
    }

    if (Number(counts.investing) === 0) {
      await client.query(
        `INSERT INTO finance_cashflow_investing
         (entity_id, flow_type, amount, description, flow_date, created_by)
         VALUES
         ($1,'asset_purchase',-12000,'شراء أصول تقنية',$2,'SYSTEM'),
         ($1,'asset_sale',6000,'بيع أصل قديم',$2,'SYSTEM')`,
        [ENTITY_ID, formatDate(new Date())]
      );
    }

    if (Number(counts.financing) === 0) {
      await client.query(
        `INSERT INTO finance_cashflow_financing
         (entity_id, flow_type, amount, description, flow_date, created_by)
         VALUES
         ($1,'loan_received',20000,'تمويل تشغيلي',$2,'SYSTEM'),
         ($1,'loan_payment',-4000,'سداد تمويل',$2,'SYSTEM')`,
        [ENTITY_ID, formatDate(new Date())]
      );
    }

    await client.query('COMMIT');
    console.log('✅ تم تجهيز بيانات صفحة التقارير الاستراتيجية بنجاح');
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('❌ خطأ أثناء تجهيز البيانات:', error.message);
    process.exitCode = 1;
  } finally {
    client.release();
  }
}

seed().then(() => pool.end());
