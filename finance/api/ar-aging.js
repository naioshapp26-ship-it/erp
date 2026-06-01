/**
 * 🧮 AR Aging API
 * Page 24 of Accounting System
 */

const { getRequestEntityContext, buildEntityScopeCondition } = require('../../entity-context');

const db = require('../../db');
const pool = db.pool;

const STATUS_MAP = {
    'مصدرة': 'ISSUED',
    'مدفوعة جزئياً': 'PARTIAL',
    'مدفوعة جزئيا': 'PARTIAL',
    'مدفوعة جزئياً ': 'PARTIAL',
    'مدفوعة جزئيا ': 'PARTIAL',
    'متأخرة': 'OVERDUE',
    'متاخر': 'OVERDUE',
    'متأخر': 'OVERDUE',
    'متاخره': 'OVERDUE',
    'متأخرة ': 'OVERDUE',
    'مسودة': 'DRAFT',
    'ملغاة': 'CANCELLED',
    'مدفوعة': 'PAID',
    'مدفوعه': 'PAID'
};

const AGING_MAP = {
    'غير مستحقة': 'CURRENT',
    '1-30 يوم': '1-30_DAYS',
    '31-60 يوم': '31-60_DAYS',
    '61-90 يوم': '61-90_DAYS',
    'أكثر من 90 يوم': 'OVER_90_DAYS'
};

const PAYMENT_STATUS_MAP = {
    'غير مدفوعة': 'UNPAID',
    'غير مدفوعه': 'UNPAID',
    'غير مدفوع': 'UNPAID',
    'غير': 'UNPAID',
    'مدفوعة جزئياً': 'PARTIAL',
    'مدفوعة جزئيا': 'PARTIAL',
    'مدفوعة': 'PAID'
};

const ALLOWED_STATUS = new Set(['ISSUED', 'PARTIAL', 'OVERDUE', 'DRAFT', 'CANCELLED', 'PAID']);
const ALLOWED_PAYMENT_STATUS = new Set(['UNPAID', 'PARTIAL', 'PAID']);

function normalizeStatus(value) {
    if (!value) return value;
    const trimmed = String(value).trim();
    return STATUS_MAP[trimmed] || trimmed;
}

function normalizeAging(value) {
    if (!value) return value;
    const trimmed = String(value).trim();
    return AGING_MAP[trimmed] || trimmed;
}

function normalizePaymentStatus(value) {
    if (!value) return value;
    const trimmed = String(value).trim();
    return PAYMENT_STATUS_MAP[trimmed] || trimmed;
}

function buildInvoiceNumber() {
    const stamp = new Date().toISOString().slice(0, 10).replace(/-/g, '');
    const rand = Math.floor(1000 + Math.random() * 9000);
    return `AR-${stamp}-${rand}`;
}

function derivePaymentStatus(totalAmount, paidAmount, provided) {
    if (provided) return normalizePaymentStatus(provided);
    if (paidAmount >= totalAmount) return 'PAID';
    if (paidAmount > 0) return 'PARTIAL';
    return 'UNPAID';
}

function deriveInvoiceStatus(totalAmount, paidAmount, dueDate, provided) {
    if (provided) return normalizeStatus(provided);
    if (paidAmount >= totalAmount) return 'PAID';
    if (paidAmount > 0) return 'PARTIAL';
    if (dueDate && new Date(dueDate) < new Date()) return 'OVERDUE';
    return 'ISSUED';
}

async function getARAging(req, res) {
    const { entity_id, status, aging_category, from_date, to_date, invoice_number, customer_name, customer_code } = req.query;

    if (!entity_id) {
        return res.status(400).json({
            success: false,
            error: 'معرّف الكيان مطلوب'
        });
    }

    try {
        console.log(`🧮 Fetching AR aging for entity ${entity_id}...`);

        const conditions = [buildEntityScopeCondition(getRequestEntityContext(req), 'entity_id', 1)];
        const values = [entity_id];
        let index = 2;

        if (status) {
            const normalizedStatus = normalizeStatus(status);
            conditions.push(`LOWER(status) = LOWER($${index})`);
            values.push(normalizedStatus);
            index++;
        }
        if (invoice_number) {
            conditions.push(`invoice_number ILIKE $${index}`);
            values.push(`%${invoice_number}%`);
            index++;
        }
        if (customer_name) {
            conditions.push(`(customer_name_ar ILIKE $${index} OR customer_name_en ILIKE $${index})`);
            values.push(`%${customer_name}%`);
            index++;
        }
        if (customer_code) {
            conditions.push(`customer_code ILIKE $${index}`);
            values.push(`%${customer_code}%`);
            index++;
        }
        if (aging_category) {
            const normalizedAging = normalizeAging(aging_category);
            conditions.push(`LOWER(aging_category) = LOWER($${index})`);
            values.push(normalizedAging);
            index++;
        }
        if (from_date) {
            conditions.push(`invoice_date >= $${index}`);
            values.push(from_date);
            index++;
        }
        if (to_date) {
            conditions.push(`invoice_date <= $${index}`);
            values.push(to_date);
            index++;
        }

        const query = `
            WITH aging AS (
                SELECT
                    i.invoice_id,
                    i.invoice_number,
                    i.invoice_date,
                    i.due_date,
                    c.customer_id,
                    c.customer_code,
                    c.customer_name_ar,
                    c.customer_name_en,
                    c.customer_type,
                    i.total_amount,
                    i.paid_amount,
                    i.remaining_amount,
                    i.status,
                    i.payment_status,
                    CURRENT_DATE - i.due_date AS days_overdue,
                    CASE 
                        WHEN CURRENT_DATE <= i.due_date THEN 'CURRENT'
                        WHEN CURRENT_DATE - i.due_date BETWEEN 1 AND 30 THEN '1-30_DAYS'
                        WHEN CURRENT_DATE - i.due_date BETWEEN 31 AND 60 THEN '31-60_DAYS'
                        WHEN CURRENT_DATE - i.due_date BETWEEN 61 AND 90 THEN '61-90_DAYS'
                        ELSE 'OVER_90_DAYS'
                    END AS aging_category,
                    i.entity_type,
                    i.entity_id,
                    i.branch_id,
                    i.incubator_id
                FROM finance_invoices i
                JOIN finance_customers c ON i.customer_id = c.customer_id
                WHERE i.remaining_amount > 0
                  AND i.status IN ('ISSUED', 'PARTIAL', 'OVERDUE')
            )
            SELECT *
            FROM aging
            WHERE ${conditions.join(' AND ')}
            ORDER BY days_overdue DESC NULLS LAST, invoice_date DESC
        `;

        const result = await pool.query(query, values);
        const rows = result.rows;

        const summary = rows.reduce((acc, r) => {
            acc.total_invoices += 1;
            acc.total_amount += parseFloat(r.total_amount || 0);
            acc.total_paid += parseFloat(r.paid_amount || 0);
            acc.total_remaining += parseFloat(r.remaining_amount || 0);
            const bucket = (r.aging_category || 'غير محدد').toLowerCase();
            acc.by_bucket[bucket] = (acc.by_bucket[bucket] || 0) + parseFloat(r.remaining_amount || 0);
            const statusKey = (r.status || 'غير محدد').toLowerCase();
            acc.by_status[statusKey] = (acc.by_status[statusKey] || 0) + 1;
            return acc;
        }, {
            total_invoices: 0,
            total_amount: 0,
            total_paid: 0,
            total_remaining: 0,
            by_bucket: {},
            by_status: {}
        });

        summary.entity_id = entity_id;
        summary.generated_at = new Date().toISOString();

        res.json({
            success: true,
            rows,
            summary
        });
    } catch (error) {
        console.error('❌ Error fetching AR aging:', error);
        res.status(500).json({
            success: false,
            error: 'تعذر تحميل تقرير أعمار الذمم المدينة'
        });
    }
}

async function createARAgingInvoice(req, res) {
    try {
        const {
            invoice_number,
            invoice_date,
            due_date,
            customer_id,
            total_amount,
            paid_amount = 0,
            status,
            payment_status,
            entity_type = 'HQ',
            entity_id = 'HQ001',
            branch_id = null,
            incubator_id = null,
            notes = null,
            created_by = 'لوحة التحكم'
        } = req.body || {};

        if (!customer_id || !invoice_date || !due_date || total_amount == null) {
            return res.status(400).json({
                success: false,
                error: 'رقم العميل وتاريخ الفاتورة وتاريخ الاستحقاق وإجمالي المبلغ مطلوبة'
            });
        }

        const parsedTotal = parseFloat(total_amount || 0);
        const parsedPaid = parseFloat(paid_amount || 0);

        if (!Number.isFinite(parsedTotal) || parsedTotal <= 0) {
            return res.status(400).json({
                success: false,
                error: 'إجمالي المبلغ يجب أن يكون أكبر من صفر'
            });
        }

        if (!Number.isFinite(parsedPaid) || parsedPaid < 0) {
            return res.status(400).json({
                success: false,
                error: 'قيمة المدفوع غير صحيحة'
            });
        }

        if (parsedPaid >= parsedTotal) {
            return res.status(400).json({
                success: false,
                error: 'قيمة المدفوع يجب أن تكون أقل من الإجمالي ليظهر في جدول أعمار الذمم'
            });
        }

        const customerResult = await pool.query(
            'SELECT customer_name_ar FROM finance_customers WHERE customer_id = $1',
            [customer_id]
        );

        if (customerResult.rows.length === 0) {
            return res.status(404).json({ success: false, error: 'العميل غير موجود' });
        }

        const remaining_amount = Math.max(parsedTotal - parsedPaid, 0);

        let resolvedStatus = normalizeStatus(status);
        if (!ALLOWED_STATUS.has(resolvedStatus)) {
            resolvedStatus = deriveInvoiceStatus(parsedTotal, parsedPaid, due_date, null);
        }
        if (remaining_amount > 0 && ['PAID', 'CANCELLED'].includes(resolvedStatus)) {
            resolvedStatus = deriveInvoiceStatus(parsedTotal, parsedPaid, due_date, null);
        }
        let resolvedPaymentStatus = normalizePaymentStatus(payment_status);
        if (!ALLOWED_PAYMENT_STATUS.has(resolvedPaymentStatus)) {
            resolvedPaymentStatus = derivePaymentStatus(parsedTotal, parsedPaid, null);
        }

        const insertQuery = `
            INSERT INTO finance_invoices (
                invoice_number,
                invoice_date,
                due_date,
                customer_id,
                customer_name,
                subtotal,
                tax_amount,
                discount_amount,
                total_amount,
                paid_amount,
                remaining_amount,
                status,
                payment_status,
                street_name,
                postal_code,
                building_number,
                city,
                district,
                national_address_number,
                short_address,
                entity_type,
                entity_id,
                branch_id,
                incubator_id,
                notes,
                created_by
            ) VALUES (
                $1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20,$21,$22,$23,$24,$25,$26
            )
            RETURNING *;
        `;

        const result = await pool.query(insertQuery, [
            invoice_number || buildInvoiceNumber(),
            invoice_date,
            due_date,
            customer_id,
            customerResult.rows[0].customer_name_ar,
            parsedTotal,
            0,
            0,
            parsedTotal,
            parsedPaid,
            remaining_amount,
            resolvedStatus,
            resolvedPaymentStatus,
            street_name,
            postal_code,
            building_number,
            city,
            district,
            national_address_number,
            short_address,
            entity_type,
            entity_id,
            branch_id,
            incubator_id,
            notes,
            created_by
        ]);

        res.status(201).json({ success: true, invoice: result.rows[0] });
    } catch (error) {
        console.error('❌ Error creating AR aging invoice:', error);
        res.status(500).json({ success: false, error: 'تعذر إضافة الفاتورة' });
    }
}

async function updateARAgingInvoice(req, res) {
    const { id } = req.params;
    try {
        const {
            invoice_date,
            due_date,
            total_amount,
            paid_amount,
            status,
            payment_status,
            notes,
            street_name,
            postal_code,
            building_number,
            city,
            district,
            national_address_number,
            short_address
        } = req.body || {};

        const existingResult = await pool.query(
            'SELECT * FROM finance_invoices WHERE invoice_id = $1',
            [id]
        );

        if (existingResult.rows.length === 0) {
            return res.status(404).json({ success: false, error: 'الفاتورة غير موجودة' });
        }

        const existing = existingResult.rows[0];
        const nextTotal = total_amount != null ? parseFloat(total_amount) : parseFloat(existing.total_amount || 0);
        const nextPaid = paid_amount != null ? Math.min(parseFloat(paid_amount || 0), nextTotal) : parseFloat(existing.paid_amount || 0);
        const nextRemaining = Math.max(nextTotal - nextPaid, 0);
        const nextDueDate = due_date || existing.due_date;

        let resolvedStatus = normalizeStatus(status);
        if (!ALLOWED_STATUS.has(resolvedStatus)) {
            resolvedStatus = deriveInvoiceStatus(nextTotal, nextPaid, nextDueDate, null);
        }
        if (nextRemaining > 0 && ['PAID', 'CANCELLED'].includes(resolvedStatus)) {
            resolvedStatus = deriveInvoiceStatus(nextTotal, nextPaid, nextDueDate, null);
        }
        let resolvedPaymentStatus = normalizePaymentStatus(payment_status);
        if (!ALLOWED_PAYMENT_STATUS.has(resolvedPaymentStatus)) {
            resolvedPaymentStatus = derivePaymentStatus(nextTotal, nextPaid, null);
        }

        const result = await pool.query(
            `UPDATE finance_invoices
             SET invoice_date = COALESCE($1, invoice_date),
                 due_date = COALESCE($2, due_date),
                 total_amount = COALESCE($3, total_amount),
                 paid_amount = COALESCE($4, paid_amount),
                 remaining_amount = $5,
                 status = $6,
                 payment_status = $7,
                 notes = COALESCE($8, notes),
                 street_name = COALESCE($9, street_name),
                 postal_code = COALESCE($10, postal_code),
                 building_number = COALESCE($11, building_number),
                 city = COALESCE($12, city),
                 district = COALESCE($13, district),
                 national_address_number = COALESCE($14, national_address_number),
                 short_address = COALESCE($15, short_address),
                 updated_at = NOW()
             WHERE invoice_id = $16
             RETURNING *`,
            [
                invoice_date || null,
                due_date || null,
                total_amount ?? null,
                paid_amount ?? null,
                nextRemaining,
                resolvedStatus,
                resolvedPaymentStatus,
                notes || null,
                street_name || null,
                postal_code || null,
                building_number || null,
                city || null,
                district || null,
                national_address_number || null,
                short_address || null,
                id
            ]
        );

        res.json({ success: true, invoice: result.rows[0] });
    } catch (error) {
        console.error('❌ Error updating AR aging invoice:', error);
        res.status(500).json({ success: false, error: 'تعذر تحديث الفاتورة' });
    }
}

async function deleteARAgingInvoice(req, res) {
    const { id } = req.params;
    try {
        const allocations = await pool.query(
            'SELECT COUNT(*)::int AS count FROM finance_payment_allocations WHERE invoice_id = $1',
            [id]
        );
        if (allocations.rows[0]?.count > 0) {
            return res.status(409).json({
                success: false,
                error: 'لا يمكن حذف الفاتورة لأنها مرتبطة بتوزيعات مدفوعات.'
            });
        }

        const plans = await pool.query(
            'SELECT COUNT(*)::int AS count FROM finance_payment_plans WHERE invoice_id = $1',
            [id]
        );
        if (plans.rows[0]?.count > 0) {
            return res.status(409).json({
                success: false,
                error: 'لا يمكن حذف الفاتورة لأنها مرتبطة بخطط سداد.'
            });
        }

        await pool.query('DELETE FROM finance_invoice_lines WHERE invoice_id = $1', [id]);
        const result = await pool.query('DELETE FROM finance_invoices WHERE invoice_id = $1 RETURNING *', [id]);

        if (result.rows.length === 0) {
            return res.status(404).json({ success: false, error: 'الفاتورة غير موجودة' });
        }

        res.json({ success: true, invoice: result.rows[0] });
    } catch (error) {
        console.error('❌ Error deleting AR aging invoice:', error);
        res.status(500).json({ success: false, error: 'تعذر حذف الفاتورة' });
    }
}

async function testConnection(req, res) {
    try {
        const result = await pool.query('SELECT NOW()');
        res.json({
            success: true,
            message: 'Database connected successfully',
            timestamp: result.rows[0].now
        });
    } catch (error) {
        console.error('❌ Database connection error:', error);
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
}

module.exports = {
    getARAging,
    testConnection,
    createARAgingInvoice,
    updateARAgingInvoice,
    deleteARAgingInvoice
};
