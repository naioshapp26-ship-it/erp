/**
 * 📈 Income Statement API
 * Page 4 of Accounting System
 * Uses finance_account_balances to calculate revenue/expenses
 */

const { getRequestEntityContext, buildEntityScopeCondition } = require('../../entity-context');

const db = require('../../db');
const pool = db.pool;

async function ensureIncomeStatementItemsTable() {
    await pool.query(`
        CREATE TABLE IF NOT EXISTS finance_income_statement_items (
            item_id SERIAL PRIMARY KEY,
            entity_id VARCHAR(50) NOT NULL,
            item_type VARCHAR(20) NOT NULL CHECK (item_type IN ('REVENUE', 'EXPENSE')),
            account_code VARCHAR(50) NOT NULL,
            account_name_ar VARCHAR(255) NOT NULL,
            amount NUMERIC NOT NULL DEFAULT 0,
            notes TEXT,
            street_name VARCHAR(200),
            postal_code VARCHAR(20),
            building_number VARCHAR(20),
            city VARCHAR(100),
            district VARCHAR(100),
            national_address_number VARCHAR(50),
            short_address VARCHAR(200),
            created_at TIMESTAMP DEFAULT NOW(),
            updated_at TIMESTAMP DEFAULT NOW()
        );
    `);

    await pool.query(`
        ALTER TABLE finance_income_statement_items
            ADD COLUMN IF NOT EXISTS street_name VARCHAR(200),
            ADD COLUMN IF NOT EXISTS postal_code VARCHAR(20),
            ADD COLUMN IF NOT EXISTS building_number VARCHAR(20),
            ADD COLUMN IF NOT EXISTS city VARCHAR(100),
            ADD COLUMN IF NOT EXISTS district VARCHAR(100),
            ADD COLUMN IF NOT EXISTS national_address_number VARCHAR(50),
            ADD COLUMN IF NOT EXISTS short_address VARCHAR(200);
    `);
}

/**
 * Get income statement (revenues, expenses, totals)
 */
async function getIncomeStatement(req, res) {
    const { entity_id } = req.query;

    if (!entity_id) {
        return res.status(400).json({
            success: false,
            error: 'entity_id is required'
        });
    }

    try {
        await ensureIncomeStatementItemsTable();
        console.log(`📈 Fetching income statement for entity ${entity_id}...`);

        const query = `
            SELECT account_id, account_code, account_name_ar, account_type,
                   total_debit, total_credit, balance, entity_id
            FROM finance_account_balances
            WHERE ${buildEntityScopeCondition(getRequestEntityContext(req), 'entity_id', 1)}
              AND account_type IN ('REVENUE', 'EXPENSE')
            ORDER BY account_code
        `;

        const result = await pool.query(query, [entity_id]);

        const manualItemsResult = await pool.query(
            `
            SELECT item_id, entity_id, item_type, account_code, account_name_ar, amount, notes,
                   street_name, postal_code, building_number, city, district, national_address_number, short_address,
                   created_at, updated_at
            FROM finance_income_statement_items
            WHERE entity_id = $1
            ORDER BY item_id DESC
            `,
            [entity_id]
        );

        const manualOverrideMap = new Map();
        manualItemsResult.rows.forEach(item => {
            const key = `${item.item_type}::${item.account_code}`;
            const existing = manualOverrideMap.get(key);
            if (!existing || item.item_id > existing.item_id) {
                manualOverrideMap.set(key, item);
            }
        });

        const overrideItems = Array.from(manualOverrideMap.values());

        const manualRevenue = overrideItems
            .filter(item => item.item_type === 'REVENUE')
            .map(item => ({
                account_id: null,
                account_code: item.account_code,
                account_name_ar: item.account_name_ar,
                account_type: 'REVENUE',
                total_debit: 0,
                total_credit: item.amount,
                balance: item.amount,
                entity_id: item.entity_id,
                source: 'manual',
                item_id: item.item_id,
                notes: item.notes
            }));

        const manualExpenses = overrideItems
            .filter(item => item.item_type === 'EXPENSE')
            .map(item => ({
                account_id: null,
                account_code: item.account_code,
                account_name_ar: item.account_name_ar,
                account_type: 'EXPENSE',
                total_debit: item.amount,
                total_credit: 0,
                balance: item.amount,
                entity_id: item.entity_id,
                source: 'manual',
                item_id: item.item_id,
                notes: item.notes
            }));

        const systemRevenue = result.rows
            .filter(a => a.account_type === 'REVENUE')
            .filter(a => !manualOverrideMap.has(`REVENUE::${a.account_code}`))
            .map(a => ({
                ...a,
                source: 'system'
            }));

        const systemExpenses = result.rows
            .filter(a => a.account_type === 'EXPENSE')
            .filter(a => !manualOverrideMap.has(`EXPENSE::${a.account_code}`))
            .map(a => ({
                ...a,
                source: 'system'
            }));

        const allRevenue = [...systemRevenue, ...manualRevenue];
        const allExpenses = [...systemExpenses, ...manualExpenses];

        const totalRevenue = allRevenue.reduce((sum, a) => sum + parseFloat(a.balance || 0), 0);
        const totalExpenses = allExpenses.reduce((sum, a) => sum + parseFloat(a.balance || 0), 0);
        const netIncome = totalRevenue - totalExpenses;
        const profitMargin = totalRevenue > 0 ? (netIncome / totalRevenue) * 100 : 0;

        res.json({
            success: true,
            revenue_accounts: allRevenue,
            expense_accounts: allExpenses,
            manual_items: manualItemsResult.rows,
            totals: {
                total_revenue: totalRevenue,
                total_expenses: totalExpenses,
                net_income: netIncome,
                profit_margin: profitMargin
            },
            counts: {
                revenue_accounts: allRevenue.length,
                expense_accounts: allExpenses.length,
                total_accounts: allRevenue.length + allExpenses.length
            }
        });

    } catch (error) {
        console.error('❌ Error fetching income statement:', error);
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
}

/**
 * Create manual income statement item
 */
async function createIncomeItem(req, res) {
    const {
        entity_id,
        item_type,
        account_code,
        account_name_ar,
        amount,
        notes,
        street_name,
        postal_code,
        building_number,
        city,
        district,
        national_address_number,
        short_address
    } = req.body || {};

    if (!entity_id || !item_type || !account_code || !account_name_ar) {
        return res.status(400).json({ success: false, error: 'entity_id, item_type, account_code, account_name_ar are required' });
    }

    try {
        await ensureIncomeStatementItemsTable();
        const result = await pool.query(
            `
            INSERT INTO finance_income_statement_items
                (entity_id, item_type, account_code, account_name_ar, amount, notes,
                 street_name, postal_code, building_number, city, district, national_address_number, short_address,
                 created_at, updated_at)
            VALUES
                ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, NOW(), NOW())
            RETURNING *
            `,
            [
                entity_id,
                item_type,
                account_code,
                account_name_ar,
                amount || 0,
                notes || null,
                street_name || null,
                postal_code || null,
                building_number || null,
                city || null,
                district || null,
                national_address_number || null,
                short_address || null
            ]
        );
        res.json({ success: true, item: result.rows[0] });
    } catch (error) {
        console.error('❌ Error creating income statement item:', error);
        res.status(500).json({ success: false, error: error.message });
    }
}

/**
 * Update manual income statement item
 */
async function updateIncomeItem(req, res) {
    const { item_id } = req.params;
    const {
        entity_id,
        item_type,
        account_code,
        account_name_ar,
        amount,
        notes,
        street_name,
        postal_code,
        building_number,
        city,
        district,
        national_address_number,
        short_address
    } = req.body || {};

    if (!item_id || !entity_id || !item_type || !account_code || !account_name_ar) {
        return res.status(400).json({ success: false, error: 'item_id, entity_id, item_type, account_code, account_name_ar are required' });
    }

    try {
        await ensureIncomeStatementItemsTable();
        const result = await pool.query(
            `
            UPDATE finance_income_statement_items
            SET item_type = $1,
                account_code = $2,
                account_name_ar = $3,
                amount = $4,
                notes = $5,
                street_name = $6,
                postal_code = $7,
                building_number = $8,
                city = $9,
                district = $10,
                national_address_number = $11,
                short_address = $12,
                updated_at = NOW()
            WHERE item_id = $13 AND entity_id = $14
            RETURNING *
            `,
            [
                item_type,
                account_code,
                account_name_ar,
                amount || 0,
                notes || null,
                street_name || null,
                postal_code || null,
                building_number || null,
                city || null,
                district || null,
                national_address_number || null,
                short_address || null,
                item_id,
                entity_id
            ]
        );

        if (result.rows.length === 0) {
            return res.status(404).json({ success: false, error: 'Item not found' });
        }

        res.json({ success: true, item: result.rows[0] });
    } catch (error) {
        console.error('❌ Error updating income statement item:', error);
        res.status(500).json({ success: false, error: error.message });
    }
}

/**
 * Delete manual income statement item
 */
async function deleteIncomeItem(req, res) {
    const { item_id } = req.params;
    const { entity_id } = req.query;

    if (!item_id || !entity_id) {
        return res.status(400).json({ success: false, error: 'item_id and entity_id are required' });
    }

    try {
        await ensureIncomeStatementItemsTable();
        const result = await pool.query(
            `DELETE FROM finance_income_statement_items WHERE item_id = $1 AND entity_id = $2 RETURNING item_id`,
            [item_id, entity_id]
        );

        if (result.rows.length === 0) {
            return res.status(404).json({ success: false, error: 'Item not found' });
        }

        res.json({ success: true, item_id: result.rows[0].item_id });
    } catch (error) {
        console.error('❌ Error deleting income statement item:', error);
        res.status(500).json({ success: false, error: error.message });
    }
}

/**
 * Test database connection
 */
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
    getIncomeStatement,
    createIncomeItem,
    updateIncomeItem,
    deleteIncomeItem,
    testConnection
};
