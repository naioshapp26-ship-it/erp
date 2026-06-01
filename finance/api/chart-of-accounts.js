/**
 * 📘 Chart of Accounts API
 * Page 5 of Accounting System
 */

const { getRequestEntityContext, buildEntityScopeCondition } = require('../../entity-context');

const db = require('../../db');
const pool = db.pool;

/**
 * Get all accounts with balances
 */
async function getChartOfAccounts(req, res) {
    const { entity_id } = req.query;

    if (!entity_id) {
        return res.status(400).json({
            success: false,
            error: 'entity_id is required'
        });
    }

    try {
        console.log(`📘 Fetching chart of accounts for entity ${entity_id}...`);

        const query = `
            SELECT 
                a.account_id,
                a.account_code,
                a.account_name_ar,
                a.account_name_en,
                a.account_type,
                a.parent_account_id,
                a.level,
                a.is_active,
                a.is_header,
                a.normal_balance,
                a.description,
                a.notes,
                COALESCE(b.total_debit, 0) AS total_debit,
                COALESCE(b.total_credit, 0) AS total_credit,
                COALESCE(b.balance, 0) AS balance
            FROM finance_accounts a
            LEFT JOIN finance_account_balances b
                ON a.account_id = b.account_id
                AND ${buildEntityScopeCondition(getRequestEntityContext(req), 'b.entity_id', 1)}
            WHERE ${buildEntityScopeCondition(getRequestEntityContext(req), 'a.entity_id', 1)}
            ORDER BY a.account_code
        `;

        const result = await pool.query(query, [entity_id]);

        const accounts = result.rows;

        const summary = {
            total_accounts: accounts.length,
            asset_accounts: accounts.filter(a => a.account_type === 'ASSET').length,
            liability_accounts: accounts.filter(a => a.account_type === 'LIABILITY').length,
            equity_accounts: accounts.filter(a => a.account_type === 'EQUITY').length,
            revenue_accounts: accounts.filter(a => a.account_type === 'REVENUE').length,
            expense_accounts: accounts.filter(a => a.account_type === 'EXPENSE').length
        };

        console.log(`✅ Found ${accounts.length} accounts`);

        res.json({
            success: true,
            accounts,
            summary
        });
    } catch (error) {
        console.error('❌ Error fetching chart of accounts:', error);
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
}

/**
 * Get single account
 */
async function getAccount(req, res) {
    const { account_id } = req.params;
    const { entity_id } = req.query;

    if (!entity_id) {
        return res.status(400).json({
            success: false,
            error: 'entity_id is required'
        });
    }

    try {
        const query = `
            SELECT 
                a.account_id,
                a.account_code,
                a.account_name_ar,
                a.account_name_en,
                a.account_type,
                a.parent_account_id,
                a.level,
                a.is_active,
                a.is_header,
                a.normal_balance,
                a.description,
                a.notes,
                a.entity_id,
                COALESCE(b.total_debit, 0) AS total_debit,
                COALESCE(b.total_credit, 0) AS total_credit,
                COALESCE(b.balance, 0) AS balance
            FROM finance_accounts a
            LEFT JOIN finance_account_balances b
                ON a.account_id = b.account_id
                AND ${buildEntityScopeCondition(getRequestEntityContext(req), 'b.entity_id', 2)}
            WHERE a.account_id = $1
            LIMIT 1
        `;

        const result = await pool.query(query, [account_id, entity_id]);

        if (result.rows.length === 0) {
            return res.status(404).json({
                success: false,
                error: 'Account not found'
            });
        }

        res.json({
            success: true,
            account: result.rows[0]
        });
    } catch (error) {
        console.error('❌ Error fetching account:', error);
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
}

/**
 * Create new account
 */
async function createAccount(req, res) {
    const {
        entity_id,
        account_code,
        account_name_ar,
        account_name_en,
        account_type,
        parent_account_id,
        level,
        is_active,
        is_header,
        normal_balance,
        description,
        notes
    } = req.body;

    if (!entity_id || !account_code || !account_name_ar || !account_type) {
        return res.status(400).json({
            success: false,
            error: 'Missing required fields: entity_id, account_code, account_name_ar, account_type'
        });
    }

    const normal = normal_balance || (['ASSET', 'EXPENSE'].includes(String(account_type).toUpperCase()) ? 'DEBIT' : 'CREDIT');

    try {
        const existingCode = await pool.query(
            'SELECT account_id FROM finance_accounts WHERE account_code = $1 LIMIT 1',
            [account_code]
        );

        if (existingCode.rows.length) {
            return res.status(409).json({
                success: false,
                error: 'رمز الحساب مستخدم بالفعل'
            });
        }

        const query = `
            INSERT INTO finance_accounts (
                account_code,
                account_name_ar,
                account_name_en,
                account_type,
                parent_account_id,
                level,
                is_active,
                is_header,
                normal_balance,
                entity_id,
                description,
                notes,
                created_by,
                created_at,
                updated_at
            ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,NOW(),NOW())
            RETURNING *
        `;

        const values = [
            account_code,
            account_name_ar,
            account_name_en || null,
            account_type,
            parent_account_id || null,
            level || 1,
            typeof is_active === 'boolean' ? is_active : true,
            typeof is_header === 'boolean' ? is_header : false,
            normal,
            entity_id,
            description || null,
            notes || null,
            'SYSTEM'
        ];

        const result = await pool.query(query, values);

        res.json({
            success: true,
            account: result.rows[0],
            message: 'تم إنشاء الحساب بنجاح'
        });
    } catch (error) {
        console.error('❌ Error creating account:', error);
        if (error.code === '23505') {
            return res.status(409).json({
                success: false,
                error: 'رمز الحساب مستخدم بالفعل'
            });
        }
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
}

/**
 * Update account
 */
async function updateAccount(req, res) {
    const { account_id } = req.params;
    const {
        entity_id,
        account_code,
        account_name_ar,
        account_name_en,
        account_type,
        is_active,
        is_header,
        normal_balance,
        description,
        notes
    } = req.body;

    if (!entity_id || !account_code || !account_name_ar || !account_type) {
        return res.status(400).json({
            success: false,
            error: 'Missing required fields: entity_id, account_code, account_name_ar, account_type'
        });
    }

    try {
        const existing = await pool.query(
            'SELECT account_id, entity_id FROM finance_accounts WHERE account_id = $1',
            [account_id]
        );

        if (!existing.rows.length) {
            return res.status(404).json({
                success: false,
                error: 'Account not found'
            });
        }

        const isGlobal = !existing.rows[0].entity_id;
        if (!isGlobal && existing.rows[0].entity_id !== entity_id) {
            return res.status(403).json({
                success: false,
                error: 'لا يمكن تعديل حسابات كيان آخر'
            });
        }

        const codeCheck = await pool.query(
            'SELECT account_id FROM finance_accounts WHERE account_code = $1 AND account_id <> $2 LIMIT 1',
            [account_code, account_id]
        );

        if (codeCheck.rows.length) {
            return res.status(409).json({
                success: false,
                error: 'رمز الحساب مستخدم بالفعل'
            });
        }

        const normal = normal_balance || (['ASSET', 'EXPENSE'].includes(String(account_type).toUpperCase()) ? 'DEBIT' : 'CREDIT');

        const query = isGlobal ? `
            UPDATE finance_accounts
            SET account_code = $1,
                account_name_ar = $2,
                account_name_en = $3,
                account_type = $4,
                is_active = $5,
                is_header = $6,
                normal_balance = $7,
                description = $8,
                notes = $9,
                updated_by = $10,
                updated_at = NOW()
            WHERE account_id = $11
            RETURNING *
        ` : `
            UPDATE finance_accounts
            SET account_code = $1,
                account_name_ar = $2,
                account_name_en = $3,
                account_type = $4,
                is_active = $5,
                is_header = $6,
                normal_balance = $7,
                description = $8,
                notes = $9,
                updated_by = $10,
                updated_at = NOW()
            WHERE account_id = $11 AND entity_id = $12
            RETURNING *
        `;

        const values = isGlobal
            ? [
                account_code,
                account_name_ar,
                account_name_en || null,
                account_type,
                typeof is_active === 'boolean' ? is_active : true,
                typeof is_header === 'boolean' ? is_header : false,
                normal,
                description || null,
                notes || null,
                'SYSTEM',
                account_id
            ]
            : [
                account_code,
                account_name_ar,
                account_name_en || null,
                account_type,
                typeof is_active === 'boolean' ? is_active : true,
                typeof is_header === 'boolean' ? is_header : false,
                normal,
                description || null,
                notes || null,
                'SYSTEM',
                account_id,
                entity_id
            ];

        const result = await pool.query(query, values);

        res.json({
            success: true,
            account: result.rows[0],
            message: 'تم تحديث الحساب بنجاح'
        });
    } catch (error) {
        console.error('❌ Error updating account:', error);
        if (error.code === '23505') {
            return res.status(409).json({
                success: false,
                error: 'رمز الحساب مستخدم بالفعل'
            });
        }
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
}

/**
 * Delete account
 */
async function deleteAccount(req, res) {
    const { account_id } = req.params;
    const { entity_id } = req.query;

    if (!entity_id) {
        return res.status(400).json({
            success: false,
            error: 'entity_id is required'
        });
    }

    try {
        const existing = await pool.query(
            'SELECT account_id, entity_id FROM finance_accounts WHERE account_id = $1',
            [account_id]
        );

        if (!existing.rows.length) {
            return res.status(404).json({
                success: false,
                error: 'Account not found'
            });
        }

        const isGlobal = !existing.rows[0].entity_id;
        if (!isGlobal && existing.rows[0].entity_id !== entity_id) {
            return res.status(403).json({
                success: false,
                error: 'لا يمكن حذف حسابات كيان آخر'
            });
        }

        const usage = await pool.query(
            'SELECT COUNT(*)::int AS count FROM finance_journal_lines WHERE account_id = $1',
            [account_id]
        );

        if (usage.rows[0].count > 0) {
            await pool.query(
                'UPDATE finance_accounts SET is_active = false, updated_by = $1, updated_at = NOW() WHERE account_id = $2',
                ['SYSTEM', account_id]
            );
            return res.json({
                success: true,
                message: 'تم إلغاء تفعيل الحساب لأنه مرتبط بقيود محاسبية'
            });
        }

        if (isGlobal) {
            await pool.query('DELETE FROM finance_accounts WHERE account_id = $1', [account_id]);
        } else {
            await pool.query('DELETE FROM finance_accounts WHERE account_id = $1 AND entity_id = $2', [account_id, entity_id]);
        }

        res.json({
            success: true,
            message: 'تم حذف الحساب بنجاح'
        });
    } catch (error) {
        console.error('❌ Error deleting account:', error);
        res.status(500).json({
            success: false,
            error: error.message
        });
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
    getChartOfAccounts,
    getAccount,
    createAccount,
    updateAccount,
    deleteAccount,
    testConnection
};
