/**
 * 📘 Account Balances API
 * Page 20 of Accounting System
 */

const { getRequestEntityContext, buildEntityScopeCondition } = require('../../entity-context');

const db = require('../../db');
const pool = db.pool;

async function getAccountBalances(req, res) {
    const { entity_id, account_type } = req.query;

    if (!entity_id) {
        return res.status(400).json({
            success: false,
            error: 'entity_id is required'
        });
    }

    try {
        console.log(`📘 Fetching account balances for entity ${entity_id}...`);

        const conditions = [buildEntityScopeCondition(getRequestEntityContext(req), 'entity_id', 1)];
        const values = [entity_id];
        let index = 2;

        if (account_type) {
            conditions.push(`LOWER(account_type) = LOWER($${index})`);
            values.push(account_type);
            index++;
        }

        const query = `
            SELECT
                account_id,
                account_code,
                account_name_ar,
                account_type,
                entity_type,
                entity_id,
                total_debit,
                total_credit,
                balance
            FROM finance_account_balances
            WHERE ${conditions.join(' AND ')}
            ORDER BY account_code ASC
        `;

        const result = await pool.query(query, values);
        const rows = result.rows;

        const summary = rows.reduce((acc, r) => {
            acc.total_accounts += 1;
            acc.total_debit += parseFloat(r.total_debit || 0);
            acc.total_credit += parseFloat(r.total_credit || 0);
            acc.total_balance += parseFloat(r.balance || 0);
            const type = (r.account_type || 'غير محدد').toLowerCase();
            acc.by_type[type] = (acc.by_type[type] || 0) + parseFloat(r.balance || 0);
            return acc;
        }, {
            total_accounts: 0,
            total_debit: 0,
            total_credit: 0,
            total_balance: 0,
            by_type: {}
        });

        res.json({
            success: true,
            rows,
            summary
        });
    } catch (error) {
        console.error('❌ Error fetching account balances:', error);
        res.status(500).json({
            success: false,
            error: error.message
        });
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
    getAccountBalances,
    testConnection
};
