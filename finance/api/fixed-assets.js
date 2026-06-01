/**
 * 🏗️ Fixed Assets API
 * Page 14 of Accounting System
 */

const { getRequestEntityContext, buildEntityScopeCondition } = require('../../entity-context');

const db = require('../../db');
const pool = db.pool;

function resolveScopedEntityId(req, explicitEntityId = null) {
    const context = getRequestEntityContext(req);
    if (context.type !== 'HQ') {
        return context.id;
    }
    return explicitEntityId || req.headers['x-entity-id'] || context.id;
}

async function getFixedAssets(req, res) {
    const { entity_id, status, asset_category, asset_type, from_date, to_date } = req.query;
    const entityId = resolveScopedEntityId(req, entity_id);

    if (!entityId) {
        return res.status(400).json({
            success: false,
            error: 'entity_id is required'
        });
    }

    try {
        console.log(`🏗️ Fetching fixed assets for entity ${entityId}...`);

        const assetConditions = [buildEntityScopeCondition(getRequestEntityContext(req), 'entity_id', 1)];
        const assetValues = [entityId];
        let assetIndex = 2;

        if (status) {
            assetConditions.push(`LOWER(status) = LOWER($${assetIndex})`);
            assetValues.push(status);
            assetIndex++;
        }
        if (asset_category) {
            assetConditions.push(`LOWER(asset_category) = LOWER($${assetIndex})`);
            assetValues.push(asset_category);
            assetIndex++;
        }
        if (asset_type) {
            assetConditions.push(`LOWER(asset_type) = LOWER($${assetIndex})`);
            assetValues.push(asset_type);
            assetIndex++;
        }
        if (from_date) {
            assetConditions.push(`purchase_date >= $${assetIndex}`);
            assetValues.push(from_date);
            assetIndex++;
        }
        if (to_date) {
            assetConditions.push(`purchase_date <= $${assetIndex}`);
            assetValues.push(to_date);
            assetIndex++;
        }

        const assetsQuery = `
            SELECT
                asset_id,
                asset_code,
                asset_name_ar,
                asset_name_en,
                asset_category,
                asset_type,
                purchase_date,
                purchase_cost,
                salvage_value,
                depreciable_value,
                depreciation_method,
                useful_life_years,
                useful_life_months,
                accumulated_depreciation,
                net_book_value,
                status,
                disposal_date,
                disposal_value,
                location,
                custodian_employee_id,
                entity_type,
                entity_id,
                branch_id,
                incubator_id,
                office_id,
                asset_account_id,
                depreciation_account_id,
                accumulated_depreciation_account_id,
                serial_number,
                warranty_expiry_date,
                maintenance_schedule,
                notes,
                created_at,
                updated_at,
                created_by
            FROM finance_fixed_assets
            WHERE ${assetConditions.join(' AND ')}
            ORDER BY purchase_date DESC, asset_id DESC
        `;

        const assetsResult = await pool.query(assetsQuery, assetValues);
        const assets = assetsResult.rows;

        const depreciationConditions = [buildEntityScopeCondition(getRequestEntityContext(req), 'a.entity_id', 1)];
        const depreciationValues = [entityId];
        let depIndex = 2;

        if (from_date) {
            depreciationConditions.push(`d.depreciation_date >= $${depIndex}`);
            depreciationValues.push(from_date);
            depIndex++;
        }
        if (to_date) {
            depreciationConditions.push(`d.depreciation_date <= $${depIndex}`);
            depreciationValues.push(to_date);
            depIndex++;
        }

        const depreciationQuery = `
            SELECT
                d.depreciation_id,
                d.asset_id,
                a.asset_code,
                a.asset_name_ar,
                a.asset_name_en,
                d.depreciation_date,
                d.fiscal_year,
                d.fiscal_period,
                d.depreciation_amount,
                d.accumulated_depreciation,
                d.net_book_value,
                d.journal_entry_id,
                d.notes,
                d.created_at
            FROM finance_asset_depreciation d
            LEFT JOIN finance_fixed_assets a ON a.asset_id = d.asset_id
            WHERE ${depreciationConditions.join(' AND ')}
            ORDER BY d.depreciation_date DESC, d.depreciation_id DESC
        `;

        const depreciationResult = await pool.query(depreciationQuery, depreciationValues);
        const depreciation = depreciationResult.rows;

        const summary = assets.reduce((acc, a) => {
            acc.total_assets += 1;
            acc.total_cost += parseFloat(a.purchase_cost || 0);
            acc.total_accumulated += parseFloat(a.accumulated_depreciation || 0);
            acc.total_net += parseFloat(a.net_book_value || 0);
            const category = (a.asset_category || 'غير محدد').toLowerCase();
            acc.by_category[category] = (acc.by_category[category] || 0) + parseFloat(a.purchase_cost || 0);
            return acc;
        }, {
            total_assets: 0,
            total_cost: 0,
            total_accumulated: 0,
            total_net: 0,
            by_category: {}
        });

        const depreciationSummary = depreciation.reduce((acc, d) => {
            acc.total_depreciations += 1;
            acc.total_amount += parseFloat(d.depreciation_amount || 0);
            acc.latest_date = acc.latest_date && d.depreciation_date
                ? (new Date(acc.latest_date) > new Date(d.depreciation_date) ? acc.latest_date : d.depreciation_date)
                : d.depreciation_date || acc.latest_date;
            const year = d.fiscal_year || (d.depreciation_date ? new Date(d.depreciation_date).getFullYear() : 'غير محدد');
            acc.by_year[year] = (acc.by_year[year] || 0) + parseFloat(d.depreciation_amount || 0);
            return acc;
        }, {
            total_depreciations: 0,
            total_amount: 0,
            latest_date: null,
            by_year: {}
        });

        res.json({
            success: true,
            assets,
            depreciation,
            summary: {
                ...summary,
                depreciation: depreciationSummary
            }
        });
    } catch (error) {
        console.error('❌ Error fetching fixed assets:', error);
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
}

function validateAssetPayload(payload) {
    const required = ['asset_code', 'asset_name_ar', 'asset_category', 'asset_type', 'purchase_date', 'purchase_cost', 'depreciation_method', 'useful_life_years'];
    for (const key of required) {
        if (payload[key] === undefined || payload[key] === null || payload[key] === '') {
            throw new Error(`حقل ${key} مطلوب`);
        }
    }

    if (Number.isNaN(Number(payload.purchase_cost))) {
        throw new Error('قيمة الشراء يجب أن تكون رقمية');
    }
    if (payload.salvage_value !== undefined && payload.salvage_value !== null && payload.salvage_value !== '' && Number.isNaN(Number(payload.salvage_value))) {
        throw new Error('قيمة الخردة يجب أن تكون رقمية');
    }
    if (payload.accumulated_depreciation !== undefined && payload.accumulated_depreciation !== null && payload.accumulated_depreciation !== '' && Number.isNaN(Number(payload.accumulated_depreciation))) {
        throw new Error('الإهلاك التراكمي يجب أن يكون رقمياً');
    }
    if (payload.net_book_value !== undefined && payload.net_book_value !== null && payload.net_book_value !== '' && Number.isNaN(Number(payload.net_book_value))) {
        throw new Error('القيمة الدفترية يجب أن تكون رقمية');
    }
    if (payload.useful_life_years !== undefined && Number.isNaN(Number(payload.useful_life_years))) {
        throw new Error('العمر الإنتاجي (سنوات) يجب أن يكون رقمياً');
    }
    if (payload.useful_life_months !== undefined && payload.useful_life_months !== null && payload.useful_life_months !== '' && Number.isNaN(Number(payload.useful_life_months))) {
        throw new Error('العمر الإنتاجي (أشهر) يجب أن يكون رقمياً');
    }
}

function validateDepreciationPayload(payload) {
    const required = ['asset_id', 'depreciation_date', 'depreciation_amount'];
    for (const key of required) {
        if (payload[key] === undefined || payload[key] === null || payload[key] === '') {
            throw new Error(`حقل ${key} مطلوب`);
        }
    }

    if (Number.isNaN(Number(payload.asset_id))) {
        throw new Error('معرف الأصل يجب أن يكون رقمياً');
    }
    if (Number.isNaN(Number(payload.depreciation_amount))) {
        throw new Error('قيمة الإهلاك يجب أن تكون رقمية');
    }
    if (payload.accumulated_depreciation !== undefined && payload.accumulated_depreciation !== null && payload.accumulated_depreciation !== '' && Number.isNaN(Number(payload.accumulated_depreciation))) {
        throw new Error('الإهلاك المتراكم يجب أن يكون رقمياً');
    }
    if (payload.net_book_value !== undefined && payload.net_book_value !== null && payload.net_book_value !== '' && Number.isNaN(Number(payload.net_book_value))) {
        throw new Error('القيمة الدفترية يجب أن تكون رقمية');
    }
    if (payload.fiscal_year !== undefined && payload.fiscal_year !== null && payload.fiscal_year !== '' && Number.isNaN(Number(payload.fiscal_year))) {
        throw new Error('السنة المالية يجب أن تكون رقمية');
    }
    if (payload.fiscal_period !== undefined && payload.fiscal_period !== null && payload.fiscal_period !== '' && Number.isNaN(Number(payload.fiscal_period))) {
        throw new Error('الفترة المالية يجب أن تكون رقمية');
    }
    if (payload.journal_entry_id !== undefined && payload.journal_entry_id !== null && payload.journal_entry_id !== '' && Number.isNaN(Number(payload.journal_entry_id))) {
        throw new Error('رقم القيد يجب أن يكون رقمياً');
    }
}

async function createDepreciation(req, res) {
    try {
        validateDepreciationPayload(req.body);

        const {
            asset_id,
            depreciation_date,
            fiscal_year,
            fiscal_period,
            depreciation_amount,
            accumulated_depreciation,
            net_book_value,
            journal_entry_id,
            notes
        } = req.body;

        const insertQuery = `
            INSERT INTO finance_asset_depreciation (
                asset_id,
                depreciation_date,
                fiscal_year,
                fiscal_period,
                depreciation_amount,
                accumulated_depreciation,
                net_book_value,
                journal_entry_id,
                notes,
                created_at
            ) VALUES (
                $1,$2,$3,$4,$5,$6,$7,$8,$9,NOW()
            ) RETURNING *
        `;

        const normalizedJournalEntryId = journal_entry_id !== undefined && journal_entry_id !== null && journal_entry_id !== ''
            ? Number(journal_entry_id)
            : null;

        const values = [
            Number(asset_id),
            depreciation_date,
            fiscal_year !== undefined && fiscal_year !== null && fiscal_year !== '' ? Number(fiscal_year) : null,
            fiscal_period !== undefined && fiscal_period !== null && fiscal_period !== '' ? Number(fiscal_period) : null,
            Number(depreciation_amount),
            accumulated_depreciation !== undefined && accumulated_depreciation !== null && accumulated_depreciation !== '' ? Number(accumulated_depreciation) : null,
            net_book_value !== undefined && net_book_value !== null && net_book_value !== '' ? Number(net_book_value) : null,
            normalizedJournalEntryId && normalizedJournalEntryId > 0 ? normalizedJournalEntryId : null,
            notes || null
        ];

        const result = await pool.query(insertQuery, values);
        res.json({ success: true, depreciation: result.rows[0] });
    } catch (error) {
        console.error('❌ Error creating depreciation:', error);
        res.status(500).json({ success: false, error: error.message });
    }
}

async function updateDepreciation(req, res) {
    const depreciationId = req.params.depreciation_id;
    if (!depreciationId) {
        return res.status(400).json({ success: false, error: 'depreciation_id is required' });
    }

    try {
        validateDepreciationPayload(req.body);

        const {
            asset_id,
            depreciation_date,
            fiscal_year,
            fiscal_period,
            depreciation_amount,
            accumulated_depreciation,
            net_book_value,
            journal_entry_id,
            notes
        } = req.body;

        const updateQuery = `
            UPDATE finance_asset_depreciation SET
                asset_id = $1,
                depreciation_date = $2,
                fiscal_year = $3,
                fiscal_period = $4,
                depreciation_amount = $5,
                accumulated_depreciation = $6,
                net_book_value = $7,
                journal_entry_id = $8,
                notes = $9
            WHERE depreciation_id = $10
            RETURNING *
        `;

        const normalizedJournalEntryId = journal_entry_id !== undefined && journal_entry_id !== null && journal_entry_id !== ''
            ? Number(journal_entry_id)
            : null;

        const values = [
            Number(asset_id),
            depreciation_date,
            fiscal_year !== undefined && fiscal_year !== null && fiscal_year !== '' ? Number(fiscal_year) : null,
            fiscal_period !== undefined && fiscal_period !== null && fiscal_period !== '' ? Number(fiscal_period) : null,
            Number(depreciation_amount),
            accumulated_depreciation !== undefined && accumulated_depreciation !== null && accumulated_depreciation !== '' ? Number(accumulated_depreciation) : null,
            net_book_value !== undefined && net_book_value !== null && net_book_value !== '' ? Number(net_book_value) : null,
            normalizedJournalEntryId && normalizedJournalEntryId > 0 ? normalizedJournalEntryId : null,
            notes || null,
            Number(depreciationId)
        ];

        const result = await pool.query(updateQuery, values);
        if (!result.rowCount) {
            return res.status(404).json({ success: false, error: 'لم يتم العثور على بند الإهلاك' });
        }

        res.json({ success: true, depreciation: result.rows[0] });
    } catch (error) {
        console.error('❌ Error updating depreciation:', error);
        res.status(500).json({ success: false, error: error.message });
    }
}

async function deleteDepreciation(req, res) {
    const depreciationId = req.params.depreciation_id;
    if (!depreciationId) {
        return res.status(400).json({ success: false, error: 'depreciation_id is required' });
    }

    try {
        const result = await pool.query(
            'DELETE FROM finance_asset_depreciation WHERE depreciation_id = $1',
            [Number(depreciationId)]
        );

        if (!result.rowCount) {
            return res.status(404).json({ success: false, error: 'لم يتم العثور على بند الإهلاك' });
        }

        res.json({ success: true });
    } catch (error) {
        console.error('❌ Error deleting depreciation:', error);
        res.status(500).json({ success: false, error: error.message });
    }
}

async function createFixedAsset(req, res) {
    const entityId = resolveScopedEntityId(req, req.body.entity_id);
    const entityType = req.body.entity_type || req.headers['x-entity-type'] || 'HQ';

    if (!entityId) {
        return res.status(400).json({ success: false, error: 'entity_id is required' });
    }

    try {
        validateAssetPayload(req.body);

        const {
            asset_code,
            asset_name_ar,
            asset_name_en,
            asset_category,
            asset_type,
            purchase_date,
            purchase_cost,
            salvage_value,
            depreciable_value,
            depreciation_method,
            useful_life_years,
            useful_life_months,
            accumulated_depreciation,
            net_book_value,
            status,
            disposal_date,
            disposal_value,
            location,
            custodian_employee_id,
            street_name,
            postal_code,
            building_number,
            city,
            district,
            national_address_number,
            short_address,
            entity_type,
            branch_id,
            incubator_id,
            office_id,
            asset_account_id,
            depreciation_account_id,
            accumulated_depreciation_account_id,
            serial_number,
            warranty_expiry_date,
            maintenance_schedule,
            notes,
            created_by
        } = req.body;

        const depreciableValue = depreciable_value !== undefined && depreciable_value !== null
            ? Number(depreciable_value)
            : Number(purchase_cost) - Number(salvage_value || 0);
        const netBookValue = net_book_value !== undefined && net_book_value !== null
            ? Number(net_book_value)
            : Number(purchase_cost) - Number(accumulated_depreciation || 0);

        const insertQuery = `
            INSERT INTO finance_fixed_assets (
                asset_code,
                asset_name_ar,
                asset_name_en,
                asset_category,
                asset_type,
                purchase_date,
                purchase_cost,
                salvage_value,
                depreciable_value,
                depreciation_method,
                useful_life_years,
                useful_life_months,
                accumulated_depreciation,
                net_book_value,
                status,
                disposal_date,
                disposal_value,
                location,
                custodian_employee_id,
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
                office_id,
                asset_account_id,
                depreciation_account_id,
                accumulated_depreciation_account_id,
                serial_number,
                warranty_expiry_date,
                maintenance_schedule,
                notes,
                created_at,
                updated_at,
                created_by
            ) VALUES (
                $1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20,$21,$22,$23,$24,$25,$26,$27,$28,$29,$30,$31,$32,$33,$34,$35,$36,$37,NOW(),NOW(),$38
            ) RETURNING *
        `;

        const values = [
            asset_code,
            asset_name_ar,
            asset_name_en || null,
            asset_category,
            asset_type,
            purchase_date,
            Number(purchase_cost),
            salvage_value !== undefined && salvage_value !== null && salvage_value !== '' ? Number(salvage_value) : 0,
            depreciableValue,
            depreciation_method,
            Number(useful_life_years),
            useful_life_months !== undefined && useful_life_months !== null && useful_life_months !== '' ? Number(useful_life_months) : null,
            accumulated_depreciation !== undefined && accumulated_depreciation !== null && accumulated_depreciation !== '' ? Number(accumulated_depreciation) : 0,
            netBookValue,
            status || 'active',
            disposal_date || null,
            disposal_value !== undefined && disposal_value !== null && disposal_value !== '' ? Number(disposal_value) : null,
            location || null,
            custodian_employee_id !== undefined && custodian_employee_id !== null && custodian_employee_id !== '' ? Number(custodian_employee_id) : null,
            street_name || null,
            postal_code || null,
            building_number || null,
            city || null,
            district || null,
            national_address_number || null,
            short_address || null,
            entity_type || entityType,
            entityId,
            branch_id || null,
            incubator_id || null,
            office_id || null,
            asset_account_id !== undefined && asset_account_id !== null && asset_account_id !== '' ? Number(asset_account_id) : null,
            depreciation_account_id !== undefined && depreciation_account_id !== null && depreciation_account_id !== '' ? Number(depreciation_account_id) : null,
            accumulated_depreciation_account_id !== undefined && accumulated_depreciation_account_id !== null && accumulated_depreciation_account_id !== '' ? Number(accumulated_depreciation_account_id) : null,
            serial_number || null,
            warranty_expiry_date || null,
            maintenance_schedule || null,
            notes || null,
            created_by || 'system'
        ];

        const result = await pool.query(insertQuery, values);
        res.json({ success: true, asset: result.rows[0] });
    } catch (error) {
        console.error('❌ Error creating fixed asset:', error);
        res.status(500).json({ success: false, error: error.message });
    }
}

async function updateFixedAsset(req, res) {
    const entityId = resolveScopedEntityId(req, req.body.entity_id);
    const entityType = req.body.entity_type || req.headers['x-entity-type'] || 'HQ';
    const assetId = req.params.asset_id;

    if (!entityId) {
        return res.status(400).json({ success: false, error: 'entity_id is required' });
    }
    if (!assetId) {
        return res.status(400).json({ success: false, error: 'asset_id is required' });
    }

    try {
        validateAssetPayload(req.body);

        const {
            asset_code,
            asset_name_ar,
            asset_name_en,
            asset_category,
            asset_type,
            purchase_date,
            purchase_cost,
            salvage_value,
            depreciable_value,
            depreciation_method,
            useful_life_years,
            useful_life_months,
            accumulated_depreciation,
            net_book_value,
            status,
            disposal_date,
            disposal_value,
            location,
            custodian_employee_id,
            street_name,
            postal_code,
            building_number,
            city,
            district,
            national_address_number,
            short_address,
            branch_id,
            incubator_id,
            office_id,
            asset_account_id,
            depreciation_account_id,
            accumulated_depreciation_account_id,
            entity_type,
            serial_number,
            warranty_expiry_date,
            maintenance_schedule,
            notes
        } = req.body;

        const depreciableValue = depreciable_value !== undefined && depreciable_value !== null
            ? Number(depreciable_value)
            : Number(purchase_cost) - Number(salvage_value || 0);
        const netBookValue = net_book_value !== undefined && net_book_value !== null
            ? Number(net_book_value)
            : Number(purchase_cost) - Number(accumulated_depreciation || 0);

        const updateQuery = `
            UPDATE finance_fixed_assets SET
                asset_code = $1,
                asset_name_ar = $2,
                asset_name_en = $3,
                asset_category = $4,
                asset_type = $5,
                purchase_date = $6,
                purchase_cost = $7,
                salvage_value = $8,
                depreciable_value = $9,
                depreciation_method = $10,
                useful_life_years = $11,
                useful_life_months = $12,
                accumulated_depreciation = $13,
                net_book_value = $14,
                status = $15,
                disposal_date = $16,
                disposal_value = $17,
                location = $18,
                custodian_employee_id = $19,
                street_name = $20,
                postal_code = $21,
                building_number = $22,
                city = $23,
                district = $24,
                national_address_number = $25,
                short_address = $26,
                entity_type = $27,
                entity_id = $28,
                branch_id = $29,
                incubator_id = $30,
                office_id = $31,
                asset_account_id = $32,
                depreciation_account_id = $33,
                accumulated_depreciation_account_id = $34,
                serial_number = $35,
                warranty_expiry_date = $36,
                maintenance_schedule = $37,
                notes = $38,
                updated_at = NOW()
            WHERE asset_id = $39 AND entity_id = $40
            RETURNING *
        `;

        const values = [
            asset_code,
            asset_name_ar,
            asset_name_en || null,
            asset_category,
            asset_type,
            purchase_date,
            Number(purchase_cost),
            salvage_value !== undefined && salvage_value !== null && salvage_value !== '' ? Number(salvage_value) : 0,
            depreciableValue,
            depreciation_method,
            Number(useful_life_years),
            useful_life_months !== undefined && useful_life_months !== null && useful_life_months !== '' ? Number(useful_life_months) : null,
            accumulated_depreciation !== undefined && accumulated_depreciation !== null && accumulated_depreciation !== '' ? Number(accumulated_depreciation) : 0,
            netBookValue,
            status || 'active',
            disposal_date || null,
            disposal_value !== undefined && disposal_value !== null && disposal_value !== '' ? Number(disposal_value) : null,
            location || null,
            custodian_employee_id !== undefined && custodian_employee_id !== null && custodian_employee_id !== '' ? Number(custodian_employee_id) : null,
            street_name || null,
            postal_code || null,
            building_number || null,
            city || null,
            district || null,
            national_address_number || null,
            short_address || null,
            entity_type || entityType,
            entityId,
            branch_id || null,
            incubator_id || null,
            office_id || null,
            asset_account_id !== undefined && asset_account_id !== null && asset_account_id !== '' ? Number(asset_account_id) : null,
            depreciation_account_id !== undefined && depreciation_account_id !== null && depreciation_account_id !== '' ? Number(depreciation_account_id) : null,
            accumulated_depreciation_account_id !== undefined && accumulated_depreciation_account_id !== null && accumulated_depreciation_account_id !== '' ? Number(accumulated_depreciation_account_id) : null,
            serial_number || null,
            warranty_expiry_date || null,
            maintenance_schedule || null,
            notes || null,
            Number(assetId),
            entityId
        ];

        const result = await pool.query(updateQuery, values);
        if (!result.rowCount) {
            return res.status(404).json({ success: false, error: 'لم يتم العثور على الأصل لهذا الكيان' });
        }

        res.json({ success: true, asset: result.rows[0] });
    } catch (error) {
        console.error('❌ Error updating fixed asset:', error);
        res.status(500).json({ success: false, error: error.message });
    }
}

async function deleteFixedAsset(req, res) {
    const entityId = resolveScopedEntityId(req, req.query.entity_id);
    const assetId = req.params.asset_id;

    if (!entityId) {
        return res.status(400).json({ success: false, error: 'entity_id is required' });
    }
    if (!assetId) {
        return res.status(400).json({ success: false, error: 'asset_id is required' });
    }

    try {
        await pool.query('BEGIN');
        await pool.query(
            'DELETE FROM finance_asset_depreciation WHERE asset_id = $1',
            [Number(assetId)]
        );

        const result = await pool.query(
            'DELETE FROM finance_fixed_assets WHERE asset_id = $1 AND entity_id = $2',
            [Number(assetId), entityId]
        );

        if (!result.rowCount) {
            await pool.query('ROLLBACK');
            return res.status(404).json({ success: false, error: 'لم يتم العثور على الأصل لهذا الكيان' });
        }

        await pool.query('COMMIT');
        res.json({ success: true });
    } catch (error) {
        try { await pool.query('ROLLBACK'); } catch (rollbackError) { console.error('❌ Rollback error:', rollbackError); }
        console.error('❌ Error deleting fixed asset:', error);
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
    getFixedAssets,
    createFixedAsset,
    updateFixedAsset,
    deleteFixedAsset,
    createDepreciation,
    updateDepreciation,
    deleteDepreciation,
    testConnection
};
