/**
 * 📊 Balance Sheet API
 * Page 3 of Accounting System
 * Handles all balance sheet operations (Assets, Liabilities, Equity)
 */


// Database connection
const db = require('../../db');
const pool = db.pool;

async function ensureBalanceSheet(entityId) {
    const existing = await pool.query(
        `SELECT sheet_id FROM finance_balance_sheet WHERE entity_id = $1 ORDER BY sheet_date DESC LIMIT 1`,
        [entityId]
    );
    if (existing.rows.length > 0) {
        return existing.rows[0].sheet_id;
    }

    const today = new Date();
    const sheetDate = today.toISOString().slice(0, 10);
    const fiscalYear = today.getFullYear();

    const insert = await pool.query(
        `
        INSERT INTO finance_balance_sheet
            (entity_id, sheet_date, period_type, fiscal_year, notes, created_at, updated_at, created_by)
        VALUES
            ($1, $2, $3, $4, $5, NOW(), NOW(), $6)
        RETURNING sheet_id
        `,
        [entityId, sheetDate, 'yearly', fiscalYear, 'Auto-created', 'system']
    );
    return insert.rows[0].sheet_id;
}

function normalizeCategory(value, allowed, fallback) {
    if (!value) return fallback;
    if (value === 'fixed' || value === 'long-term') return 'non_current';
    return allowed.includes(value) ? value : fallback;
}

/**
 * Get balance sheet header info
 */
async function getBalanceSheet(req, res) {
    const { entity_id } = req.query;

    if (!entity_id) {
        return res.status(400).json({
            success: false,
            error: 'entity_id is required'
        });
    }

    try {
        console.log(`📊 Fetching balance sheet for entity ${entity_id}...`);

        const query = `
            SELECT *
            FROM finance_balance_sheet
            WHERE entity_id = $1
            ORDER BY sheet_date DESC
            LIMIT 1
        `;

        const result = await pool.query(query, [entity_id]);

        if (result.rows.length === 0) {
            return res.status(404).json({
                success: false,
                error: 'Balance sheet not found'
            });
        }

        console.log(`✅ Found balance sheet for ${result.rows[0].period_type} period`);

        res.json({
            success: true,
            sheet: result.rows[0]
        });

    } catch (error) {
        console.error('❌ Error fetching balance sheet:', error);
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
}

/**
 * Get all assets
 */
async function getAssets(req, res) {
    const { entity_id } = req.query;

    if (!entity_id) {
        return res.status(400).json({
            success: false,
            error: 'entity_id is required'
        });
    }

    try {
        console.log(`🏢 Fetching assets for entity ${entity_id}...`);

        const query = `
            SELECT *
            FROM finance_assets
            WHERE entity_id = $1
            ORDER BY 
                CASE asset_category
                    WHEN 'current' THEN 1
                    WHEN 'fixed' THEN 2
                    ELSE 3
                END,
                asset_id
        `;

        const result = await pool.query(query, [entity_id]);

        console.log(`✅ Found ${result.rows.length} assets`);

        // Calculate totals
        const currentAssets = result.rows.filter(a => a.asset_category === 'current');
        const fixedAssets = result.rows.filter(a => a.asset_category === 'fixed');

        const currentTotal = currentAssets.reduce((sum, a) => sum + parseFloat(a.amount || 0), 0);
        const fixedTotal = fixedAssets.reduce((sum, a) => sum + parseFloat(a.amount || 0), 0);
        const total = currentTotal + fixedTotal;

        res.json({
            success: true,
            assets: result.rows,
            summary: {
                current_assets: currentAssets.length,
                current_total: currentTotal,
                fixed_assets: fixedAssets.length,
                fixed_total: fixedTotal,
                total_assets: result.rows.length,
                total_amount: total
            },
            message: `تم تحميل ${result.rows.length} أصل`
        });

    } catch (error) {
        console.error('❌ Error fetching assets:', error);
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
}

/**
 * Get all liabilities
 */
async function getLiabilities(req, res) {
    const { entity_id } = req.query;

    if (!entity_id) {
        return res.status(400).json({
            success: false,
            error: 'entity_id is required'
        });
    }

    try {
        console.log(`⚠️ Fetching liabilities for entity ${entity_id}...`);

        const query = `
            SELECT *
            FROM finance_liabilities
            WHERE entity_id = $1
            ORDER BY 
                CASE liability_category
                    WHEN 'current' THEN 1
                    WHEN 'long-term' THEN 2
                    ELSE 3
                END,
                liability_id
        `;

        const result = await pool.query(query, [entity_id]);

        console.log(`✅ Found ${result.rows.length} liabilities`);

        // Calculate totals
        const currentLiabilities = result.rows.filter(l => l.liability_category === 'current');
        const longTermLiabilities = result.rows.filter(l => l.liability_category === 'long-term');

        const currentTotal = currentLiabilities.reduce((sum, l) => sum + parseFloat(l.amount || 0), 0);
        const longTermTotal = longTermLiabilities.reduce((sum, l) => sum + parseFloat(l.amount || 0), 0);
        const total = currentTotal + longTermTotal;

        res.json({
            success: true,
            liabilities: result.rows,
            summary: {
                current_liabilities: currentLiabilities.length,
                current_total: currentTotal,
                long_term_liabilities: longTermLiabilities.length,
                long_term_total: longTermTotal,
                total_liabilities: result.rows.length,
                total_amount: total
            },
            message: `تم تحميل ${result.rows.length} التزام`
        });

    } catch (error) {
        console.error('❌ Error fetching liabilities:', error);
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
}

/**
 * Get all equity items
 */
async function getEquity(req, res) {
    const { entity_id } = req.query;

    if (!entity_id) {
        return res.status(400).json({
            success: false,
            error: 'entity_id is required'
        });
    }

    try {
        console.log(`💰 Fetching equity for entity ${entity_id}...`);

        const query = `
            SELECT *
            FROM finance_equity
            WHERE entity_id = $1
            ORDER BY equity_id
        `;

        const result = await pool.query(query, [entity_id]);

        console.log(`✅ Found ${result.rows.length} equity items`);

        // Calculate total
        const total = result.rows.reduce((sum, e) => sum + parseFloat(e.amount || 0), 0);

        res.json({
            success: true,
            equity: result.rows,
            summary: {
                total_items: result.rows.length,
                total_amount: total
            },
            message: `تم تحميل ${result.rows.length} بند حقوق ملكية`
        });

    } catch (error) {
        console.error('❌ Error fetching equity:', error);
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
}

/**
 * Get complete balance sheet (all components)
 */
async function getCompleteBalanceSheet(req, res) {
    const { entity_id } = req.query;

    if (!entity_id) {
        return res.status(400).json({
            success: false,
            error: 'entity_id is required'
        });
    }

    try {
        console.log(`📊 Fetching complete balance sheet for entity ${entity_id}...`);

        // Get sheet info
        const sheetQuery = `
            SELECT * FROM finance_balance_sheet
            WHERE entity_id = $1
            ORDER BY sheet_date DESC
            LIMIT 1
        `;
        const sheetResult = await pool.query(sheetQuery, [entity_id]);

        if (sheetResult.rows.length === 0) {
            return res.status(404).json({
                success: false,
                error: 'Balance sheet not found'
            });
        }

        const sheet = sheetResult.rows[0];

        // Get assets
        const assetsQuery = `SELECT * FROM finance_assets WHERE entity_id = $1 ORDER BY asset_category, asset_id`;
        const assetsResult = await pool.query(assetsQuery, [entity_id]);

        // Get liabilities
        const liabilitiesQuery = `SELECT * FROM finance_liabilities WHERE entity_id = $1 ORDER BY liability_category, liability_id`;
        const liabilitiesResult = await pool.query(liabilitiesQuery, [entity_id]);

        // Get equity
        const equityQuery = `SELECT * FROM finance_equity WHERE entity_id = $1 ORDER BY equity_id`;
        const equityResult = await pool.query(equityQuery, [entity_id]);

        // Calculate totals
        const totalAssets = assetsResult.rows.reduce((sum, a) => sum + parseFloat(a.amount || 0), 0);
        const totalLiabilities = liabilitiesResult.rows.reduce((sum, l) => sum + parseFloat(l.amount || 0), 0);
        const totalEquity = equityResult.rows.reduce((sum, e) => sum + parseFloat(e.amount || 0), 0);

        // Check if balanced
        const isBalanced = Math.abs(totalAssets - (totalLiabilities + totalEquity)) < 0.01;

        console.log(`✅ Complete balance sheet loaded`);
        console.log(`   Assets: ${totalAssets.toFixed(2)}`);
        console.log(`   Liabilities: ${totalLiabilities.toFixed(2)}`);
        console.log(`   Equity: ${totalEquity.toFixed(2)}`);
        console.log(`   Balanced: ${isBalanced ? 'Yes' : 'No'}`);

        res.json({
            success: true,
            sheet: sheet,
            assets: assetsResult.rows,
            liabilities: liabilitiesResult.rows,
            equity: equityResult.rows,
            totals: {
                total_assets: totalAssets,
                total_liabilities: totalLiabilities,
                total_equity: totalEquity,
                is_balanced: isBalanced,
                difference: totalAssets - (totalLiabilities + totalEquity)
            }
        });

    } catch (error) {
        console.error('❌ Error fetching complete balance sheet:', error);
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
}

/**
 * Create asset
 */
async function createAsset(req, res) {
    const { entity_id, asset_category, asset_type, asset_name, amount, description } = req.body || {};

    if (!entity_id || !asset_type || !asset_name) {
        return res.status(400).json({ success: false, error: 'entity_id, asset_type, asset_name are required' });
    }

    try {
        const sheetId = await ensureBalanceSheet(entity_id);
        const category = normalizeCategory(asset_category, ['current', 'non_current'], 'current');
        const result = await pool.query(
            `
            INSERT INTO finance_assets
                (sheet_id, entity_id, asset_category, asset_type, asset_name, amount, description, created_at, updated_at)
            VALUES
                ($1, $2, $3, $4, $5, $6, $7, NOW(), NOW())
            RETURNING *
            `,
            [sheetId, entity_id, category, asset_type, asset_name, amount || 0, description || null]
        );
        res.json({ success: true, asset: result.rows[0] });
    } catch (error) {
        console.error('❌ Error creating asset:', error);
        res.status(500).json({ success: false, error: error.message });
    }
}

/**
 * Update asset
 */
async function updateAsset(req, res) {
    const { asset_id } = req.params;
    const { entity_id, asset_category, asset_type, asset_name, amount, description } = req.body || {};

    if (!asset_id || !entity_id || !asset_type || !asset_name) {
        return res.status(400).json({ success: false, error: 'asset_id, entity_id, asset_type, asset_name are required' });
    }

    try {
        const category = normalizeCategory(asset_category, ['current', 'non_current'], 'current');
        const result = await pool.query(
            `
            UPDATE finance_assets
            SET asset_category = $1,
                asset_type = $2,
                asset_name = $3,
                amount = $4,
                description = $5,
                updated_at = NOW()
            WHERE asset_id = $6 AND entity_id = $7
            RETURNING *
            `,
            [category, asset_type, asset_name, amount || 0, description || null, asset_id, entity_id]
        );

        if (result.rows.length === 0) {
            return res.status(404).json({ success: false, error: 'Asset not found' });
        }

        res.json({ success: true, asset: result.rows[0] });
    } catch (error) {
        console.error('❌ Error updating asset:', error);
        res.status(500).json({ success: false, error: error.message });
    }
}

/**
 * Delete asset
 */
async function deleteAsset(req, res) {
    const { asset_id } = req.params;
    const { entity_id } = req.query;

    if (!asset_id || !entity_id) {
        return res.status(400).json({ success: false, error: 'asset_id and entity_id are required' });
    }

    try {
        const result = await pool.query(
            `DELETE FROM finance_assets WHERE asset_id = $1 AND entity_id = $2 RETURNING asset_id`,
            [asset_id, entity_id]
        );

        if (result.rows.length === 0) {
            return res.status(404).json({ success: false, error: 'Asset not found' });
        }

        res.json({ success: true, asset_id: result.rows[0].asset_id });
    } catch (error) {
        console.error('❌ Error deleting asset:', error);
        res.status(500).json({ success: false, error: error.message });
    }
}

/**
 * Create liability
 */
async function createLiability(req, res) {
    const { entity_id, liability_category, liability_type, liability_name, amount, description } = req.body || {};

    if (!entity_id || !liability_type || !liability_name) {
        return res.status(400).json({ success: false, error: 'entity_id, liability_type, liability_name are required' });
    }

    try {
        const sheetId = await ensureBalanceSheet(entity_id);
        const category = normalizeCategory(liability_category, ['current', 'non_current'], 'current');
        const result = await pool.query(
            `
            INSERT INTO finance_liabilities
                (sheet_id, entity_id, liability_category, liability_type, liability_name, amount, description, created_at, updated_at)
            VALUES
                ($1, $2, $3, $4, $5, $6, $7, NOW(), NOW())
            RETURNING *
            `,
            [sheetId, entity_id, category, liability_type, liability_name, amount || 0, description || null]
        );
        res.json({ success: true, liability: result.rows[0] });
    } catch (error) {
        console.error('❌ Error creating liability:', error);
        res.status(500).json({ success: false, error: error.message });
    }
}

/**
 * Update liability
 */
async function updateLiability(req, res) {
    const { liability_id } = req.params;
    const { entity_id, liability_category, liability_type, liability_name, amount, description } = req.body || {};

    if (!liability_id || !entity_id || !liability_type || !liability_name) {
        return res.status(400).json({ success: false, error: 'liability_id, entity_id, liability_type, liability_name are required' });
    }

    try {
        const category = normalizeCategory(liability_category, ['current', 'non_current'], 'current');
        const result = await pool.query(
            `
            UPDATE finance_liabilities
            SET liability_category = $1,
                liability_type = $2,
                liability_name = $3,
                amount = $4,
                description = $5,
                updated_at = NOW()
            WHERE liability_id = $6 AND entity_id = $7
            RETURNING *
            `,
            [category, liability_type, liability_name, amount || 0, description || null, liability_id, entity_id]
        );

        if (result.rows.length === 0) {
            return res.status(404).json({ success: false, error: 'Liability not found' });
        }

        res.json({ success: true, liability: result.rows[0] });
    } catch (error) {
        console.error('❌ Error updating liability:', error);
        res.status(500).json({ success: false, error: error.message });
    }
}

/**
 * Delete liability
 */
async function deleteLiability(req, res) {
    const { liability_id } = req.params;
    const { entity_id } = req.query;

    if (!liability_id || !entity_id) {
        return res.status(400).json({ success: false, error: 'liability_id and entity_id are required' });
    }

    try {
        const result = await pool.query(
            `DELETE FROM finance_liabilities WHERE liability_id = $1 AND entity_id = $2 RETURNING liability_id`,
            [liability_id, entity_id]
        );

        if (result.rows.length === 0) {
            return res.status(404).json({ success: false, error: 'Liability not found' });
        }

        res.json({ success: true, liability_id: result.rows[0].liability_id });
    } catch (error) {
        console.error('❌ Error deleting liability:', error);
        res.status(500).json({ success: false, error: error.message });
    }
}

/**
 * Create equity item
 */
async function createEquity(req, res) {
    const { entity_id, equity_type, equity_name, amount, description } = req.body || {};

    if (!entity_id || !equity_type || !equity_name) {
        return res.status(400).json({ success: false, error: 'entity_id, equity_type, equity_name are required' });
    }

    try {
        const sheetId = await ensureBalanceSheet(entity_id);
        const result = await pool.query(
            `
            INSERT INTO finance_equity
                (sheet_id, entity_id, equity_type, equity_name, amount, description, created_at, updated_at)
            VALUES
                ($1, $2, $3, $4, $5, $6, NOW(), NOW())
            RETURNING *
            `,
            [sheetId, entity_id, equity_type, equity_name, amount || 0, description || null]
        );
        res.json({ success: true, equity: result.rows[0] });
    } catch (error) {
        console.error('❌ Error creating equity:', error);
        res.status(500).json({ success: false, error: error.message });
    }
}

/**
 * Update equity item
 */
async function updateEquity(req, res) {
    const { equity_id } = req.params;
    const { entity_id, equity_type, equity_name, amount, description } = req.body || {};

    if (!equity_id || !entity_id || !equity_type || !equity_name) {
        return res.status(400).json({ success: false, error: 'equity_id, entity_id, equity_type, equity_name are required' });
    }

    try {
        const result = await pool.query(
            `
            UPDATE finance_equity
            SET equity_type = $1,
                equity_name = $2,
                amount = $3,
                description = $4,
                updated_at = NOW()
            WHERE equity_id = $5 AND entity_id = $6
            RETURNING *
            `,
            [equity_type, equity_name, amount || 0, description || null, equity_id, entity_id]
        );

        if (result.rows.length === 0) {
            return res.status(404).json({ success: false, error: 'Equity item not found' });
        }

        res.json({ success: true, equity: result.rows[0] });
    } catch (error) {
        console.error('❌ Error updating equity:', error);
        res.status(500).json({ success: false, error: error.message });
    }
}

/**
 * Delete equity item
 */
async function deleteEquity(req, res) {
    const { equity_id } = req.params;
    const { entity_id } = req.query;

    if (!equity_id || !entity_id) {
        return res.status(400).json({ success: false, error: 'equity_id and entity_id are required' });
    }

    try {
        const result = await pool.query(
            `DELETE FROM finance_equity WHERE equity_id = $1 AND entity_id = $2 RETURNING equity_id`,
            [equity_id, entity_id]
        );

        if (result.rows.length === 0) {
            return res.status(404).json({ success: false, error: 'Equity item not found' });
        }

        res.json({ success: true, equity_id: result.rows[0].equity_id });
    } catch (error) {
        console.error('❌ Error deleting equity:', error);
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
    getBalanceSheet,
    getAssets,
    getLiabilities,
    getEquity,
    getCompleteBalanceSheet,
    createAsset,
    updateAsset,
    deleteAsset,
    createLiability,
    updateLiability,
    deleteLiability,
    createEquity,
    updateEquity,
    deleteEquity,
    testConnection
};
