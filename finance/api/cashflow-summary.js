/**
 * 💧 Cashflow Summary API
 * Page 9 of Accounting System
 */

const { getRequestEntityContext, buildEntityScopeCondition } = require('../../entity-context');

const db = require('../../db');
const pool = db.pool;

function getPeriodStartDate(year, period) {
    const monthMap = {
        1: '01-01',
        2: '04-01',
        3: '07-01',
        4: '10-01'
    };
    const monthDay = monthMap[period] || '01-01';
    return `${year}-${monthDay}`;
}

async function upsertSummaryRows({
    entity_id,
    entity_type,
    flow_type,
    fiscal_year,
    fiscal_period,
    cash_in,
    cash_out
}) {
    await pool.query(
        `DELETE FROM finance_cashflow
         WHERE entity_id = $1
           AND flow_type = $2
           AND fiscal_year = $3
           AND fiscal_period = $4
           AND flow_category = 'SUMMARY'`,
        [entity_id, flow_type, fiscal_year, fiscal_period]
    );

    const transactionDate = getPeriodStartDate(fiscal_year, fiscal_period);
    const cashInValue = parseFloat(cash_in || 0);
    const cashOutValue = parseFloat(cash_out || 0);
    const rowsToInsert = [];

    if (cashInValue !== 0 || (cashInValue === 0 && cashOutValue === 0)) {
        rowsToInsert.push({ direction: 'IN', amount: cashInValue, label: 'ملخص التدفق - داخل' });
    }
    if (cashOutValue !== 0) {
        rowsToInsert.push({ direction: 'OUT', amount: cashOutValue, label: 'ملخص التدفق - خارج' });
    }

    const values = [];
    const params = [];
    let i = 1;
    rowsToInsert.forEach(row => {
        params.push(`($${i++},$${i++},$${i++},$${i++},$${i++},$${i++},$${i++},$${i++},$${i++},$${i++})`);
        values.push(
            transactionDate,
            fiscal_year,
            fiscal_period,
            flow_type,
            'SUMMARY',
            row.amount,
            row.direction,
            row.label,
            entity_type || 'HQ',
            entity_id
        );
    });

    await pool.query(
        `INSERT INTO finance_cashflow
         (transaction_date, fiscal_year, fiscal_period, flow_type, flow_category, amount, flow_direction, description, entity_type, entity_id)
         VALUES ${params.join(',')}`,
        values
    );

    const summaryRow = await pool.query(
        `SELECT flow_type, fiscal_year, fiscal_period, cash_in, cash_out, net_cashflow, entity_id
         FROM finance_cashflow_summary
         WHERE entity_id = $1 AND flow_type = $2 AND fiscal_year = $3 AND fiscal_period = $4`,
        [entity_id, flow_type, fiscal_year, fiscal_period]
    );

    return summaryRow.rows[0];
}

async function getCashflowSummary(req, res) {
    const { entity_id } = req.query;

    if (!entity_id) {
        return res.status(400).json({
            success: false,
            error: 'entity_id is required'
        });
    }

    try {
        console.log(`💧 Fetching cashflow summary for entity ${entity_id}...`);

        const query = `
            SELECT
                flow_type,
                fiscal_year,
                fiscal_period,
                entity_id,
                SUM(CASE WHEN flow_direction = 'IN' THEN amount ELSE 0 END) AS cash_in,
                SUM(CASE WHEN flow_direction = 'OUT' THEN amount ELSE 0 END) AS cash_out,
                SUM(CASE WHEN flow_direction = 'IN' THEN amount ELSE -amount END) AS net_cashflow
            FROM finance_cashflow
            WHERE ${buildEntityScopeCondition(getRequestEntityContext(req), 'entity_id', 1)}
              AND flow_category = 'SUMMARY'
            GROUP BY flow_type, fiscal_year, fiscal_period, entity_id
            ORDER BY fiscal_year DESC, fiscal_period, flow_type
        `;

        const result = await pool.query(query, [entity_id]);
        const rows = result.rows;

        const summary = rows.reduce((acc, r) => {
            acc.total_in += parseFloat(r.cash_in || 0);
            acc.total_out += parseFloat(r.cash_out || 0);
            acc.total_net += parseFloat(r.net_cashflow || 0);
            acc.total_rows += 1;
            return acc;
        }, { total_in: 0, total_out: 0, total_net: 0, total_rows: 0 });

        res.json({
            success: true,
            rows,
            summary
        });
    } catch (error) {
        console.error('❌ Error fetching cashflow summary:', error);
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
}

async function createCashflowSummary(req, res) {
    const {
        entity_id,
        entity_type,
        flow_type,
        fiscal_year,
        fiscal_period,
        cash_in,
        cash_out,
        net_cashflow
    } = req.body || {};

    if (!entity_id || !flow_type || !fiscal_year || !fiscal_period) {
        return res.status(400).json({
            success: false,
            error: 'Missing required fields: entity_id, flow_type, fiscal_year, fiscal_period'
        });
    }

    try {
        const existing = await pool.query(
            `SELECT 1 FROM finance_cashflow
             WHERE entity_id = $1
               AND flow_type = $2
               AND fiscal_year = $3
               AND fiscal_period = $4
               AND flow_category = 'SUMMARY'
             LIMIT 1`,
            [entity_id, flow_type, fiscal_year, fiscal_period]
        );
        const summaryRow = await upsertSummaryRows({
            entity_id,
            entity_type,
            flow_type,
            fiscal_year,
            fiscal_period,
            cash_in,
            cash_out
        });

        res.json({
            success: true,
            row: summaryRow,
            upserted: existing.rows.length > 0
        });
    } catch (error) {
        console.error('❌ Error creating cashflow summary:', error);
        res.status(500).json({ success: false, error: error.message });
    }
}

async function updateCashflowSummary(req, res) {
    const {
        entity_id,
        flow_type,
        fiscal_year,
        fiscal_period,
        cash_in,
        cash_out,
        net_cashflow
    } = req.body || {};

    if (!entity_id || !flow_type || !fiscal_year || !fiscal_period) {
        return res.status(400).json({
            success: false,
            error: 'Missing required fields: entity_id, flow_type, fiscal_year, fiscal_period'
        });
    }

    try {
        const summaryRow = await upsertSummaryRows({
            entity_id,
            entity_type: 'HQ',
            flow_type,
            fiscal_year,
            fiscal_period,
            cash_in,
            cash_out
        });

        if (!summaryRow) {
            return res.status(404).json({ success: false, error: 'Summary row not found' });
        }

        res.json({ success: true, row: summaryRow });
    } catch (error) {
        console.error('❌ Error updating cashflow summary:', error);
        res.status(500).json({ success: false, error: error.message });
    }
}

async function deleteCashflowSummary(req, res) {
    const { entity_id, flow_type, fiscal_year, fiscal_period } = req.query;

    if (!entity_id || !flow_type || !fiscal_year || !fiscal_period) {
        return res.status(400).json({
            success: false,
            error: 'entity_id, flow_type, fiscal_year, fiscal_period are required'
        });
    }

    try {
                const result = await pool.query(
                        `DELETE FROM finance_cashflow
                         WHERE entity_id = $1
                             AND flow_type = $2
                             AND fiscal_year = $3
                             AND fiscal_period = $4
                             AND flow_category = 'SUMMARY'
                         RETURNING cashflow_id`,
                        [entity_id, flow_type, fiscal_year, fiscal_period]
                );

        if (!result.rows.length) {
            return res.status(404).json({ success: false, error: 'Summary row not found' });
        }

        res.json({ success: true, message: 'تم حذف السجل' });
    } catch (error) {
        console.error('❌ Error deleting cashflow summary:', error);
        res.status(500).json({ success: false, error: error.message });
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
    getCashflowSummary,
    createCashflowSummary,
    updateCashflowSummary,
    deleteCashflowSummary,
    testConnection
};
