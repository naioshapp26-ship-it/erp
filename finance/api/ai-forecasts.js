/**
 * 🤖 AI Forecasts API
 * Page 8 of Accounting System
 */

const { getRequestEntityContext, buildEntityScopeCondition } = require('../../entity-context');

const db = require('../../db');
const pool = db.pool;

async function ensureAiForecastsColumns() {
    await pool.query(`
        ALTER TABLE finance_ai_forecasts
            ADD COLUMN IF NOT EXISTS street_name VARCHAR(200),
            ADD COLUMN IF NOT EXISTS postal_code VARCHAR(20),
            ADD COLUMN IF NOT EXISTS building_number VARCHAR(20),
            ADD COLUMN IF NOT EXISTS city VARCHAR(100),
            ADD COLUMN IF NOT EXISTS district VARCHAR(100),
            ADD COLUMN IF NOT EXISTS national_address_number VARCHAR(50),
            ADD COLUMN IF NOT EXISTS short_address VARCHAR(200);
    `);
}

function normalizeInsights(input) {
    if (input === null || input === undefined) return null;
    if (typeof input === 'object') return input;
    const text = String(input).trim();
    if (!text) return null;
    try {
        return JSON.parse(text);
    } catch (error) {
        return { notes: text };
    }
}

async function getForecasts(req, res) {
    const { entity_id } = req.query;

    if (!entity_id) {
        return res.status(400).json({
            success: false,
            error: 'entity_id is required'
        });
    }

    try {
        await ensureAiForecastsColumns();
        console.log(`🤖 Fetching AI forecasts for entity ${entity_id}...`);

        const query = `
            SELECT 
                forecast_id,
                entity_id,
                forecast_period,
                forecast_type,
                forecast_amount,
                confidence_level,
                ai_model,
                ai_insights,
                street_name,
                postal_code,
                building_number,
                city,
                district,
                national_address_number,
                short_address,
                created_at
            FROM finance_ai_forecasts
            WHERE ${buildEntityScopeCondition(getRequestEntityContext(req), 'entity_id', 1)}
            ORDER BY created_at DESC, forecast_id DESC
        `;

        const result = await pool.query(query, [entity_id]);
        const forecasts = result.rows;

        const sumForecast = forecasts.reduce((sum, f) => sum + parseFloat(f.forecast_amount || 0), 0);
        const maxForecast = forecasts.reduce((max, f) => Math.max(max, parseFloat(f.forecast_amount || 0)), 0);
        const avgConfidence = forecasts.length
            ? forecasts.reduce((sum, f) => sum + (parseFloat(f.confidence_level || 0) * 100), 0) / forecasts.length
            : 0;

        const models = Array.from(new Set(forecasts.map(f => f.ai_model).filter(Boolean)));

        res.json({
            success: true,
            forecasts,
            summary: {
                total_forecasts: forecasts.length,
                sum_forecast: sumForecast,
                max_forecast: maxForecast,
                avg_confidence: avgConfidence,
                models
            }
        });
    } catch (error) {
        console.error('❌ Error fetching AI forecasts:', error);
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
}

async function createForecast(req, res) {
    const {
        entity_id,
        forecast_period,
        forecast_type,
        forecast_amount,
        confidence_level,
        ai_model,
        ai_insights,
        street_name,
        postal_code,
        building_number,
        city,
        district,
        national_address_number,
        short_address
    } = req.body || {};

    if (!entity_id || !forecast_period || forecast_amount === undefined) {
        return res.status(400).json({
            success: false,
            error: 'Missing required fields: entity_id, forecast_period, forecast_amount'
        });
    }

    try {
        await ensureAiForecastsColumns();
        const normalizedInsights = normalizeInsights(ai_insights);
        const result = await pool.query(
            `INSERT INTO finance_ai_forecasts
             (entity_id, forecast_period, forecast_type, forecast_amount, confidence_level, ai_model, ai_insights,
              street_name, postal_code, building_number, city, district, national_address_number, short_address, created_at)
             VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,NOW())
             RETURNING *`,
            [
                entity_id,
                forecast_period,
                forecast_type || 'revenue',
                forecast_amount,
                confidence_level ?? null,
                ai_model || null,
                normalizedInsights ? JSON.stringify(normalizedInsights) : null,
                street_name || null,
                postal_code || null,
                building_number || null,
                city || null,
                district || null,
                national_address_number || null,
                short_address || null
            ]
        );

        res.json({ success: true, forecast: result.rows[0] });
    } catch (error) {
        console.error('❌ Error creating forecast:', error);
        res.status(500).json({ success: false, error: error.message });
    }
}

async function updateForecast(req, res) {
    const { forecast_id } = req.params;
    const {
        entity_id,
        forecast_period,
        forecast_type,
        forecast_amount,
        confidence_level,
        ai_model,
        ai_insights,
        street_name,
        postal_code,
        building_number,
        city,
        district,
        national_address_number,
        short_address
    } = req.body || {};

    if (!forecast_id || !entity_id || !forecast_period || forecast_amount === undefined) {
        return res.status(400).json({
            success: false,
            error: 'Missing required fields: forecast_id, entity_id, forecast_period, forecast_amount'
        });
    }

    try {
        await ensureAiForecastsColumns();
        const existing = await pool.query('SELECT forecast_id, entity_id FROM finance_ai_forecasts WHERE forecast_id = $1', [forecast_id]);
        if (!existing.rows.length) {
            return res.status(404).json({ success: false, error: 'Forecast not found' });
        }
        if (existing.rows[0].entity_id && existing.rows[0].entity_id !== entity_id) {
            return res.status(403).json({ success: false, error: 'لا يمكن تعديل تنبؤ كيان آخر' });
        }

        const normalizedInsights = normalizeInsights(ai_insights);
        const result = await pool.query(
            `UPDATE finance_ai_forecasts
             SET forecast_period = $1,
                 forecast_type = $2,
                 forecast_amount = $3,
                 confidence_level = $4,
                 ai_model = $5,
                 ai_insights = $6,
                 street_name = $7,
                 postal_code = $8,
                 building_number = $9,
                 city = $10,
                 district = $11,
                 national_address_number = $12,
                 short_address = $13
             WHERE forecast_id = $14
             RETURNING *`,
            [
                forecast_period,
                forecast_type || 'revenue',
                forecast_amount,
                confidence_level ?? null,
                ai_model || null,
                normalizedInsights ? JSON.stringify(normalizedInsights) : null,
                street_name || null,
                postal_code || null,
                building_number || null,
                city || null,
                district || null,
                national_address_number || null,
                short_address || null,
                forecast_id
            ]
        );

        res.json({ success: true, forecast: result.rows[0] });
    } catch (error) {
        console.error('❌ Error updating forecast:', error);
        res.status(500).json({ success: false, error: error.message });
    }
}

async function deleteForecast(req, res) {
    const { forecast_id } = req.params;
    const { entity_id } = req.query;

    if (!forecast_id || !entity_id) {
        return res.status(400).json({ success: false, error: 'forecast_id and entity_id are required' });
    }

    try {
        const existing = await pool.query('SELECT forecast_id, entity_id FROM finance_ai_forecasts WHERE forecast_id = $1', [forecast_id]);
        if (!existing.rows.length) {
            return res.status(404).json({ success: false, error: 'Forecast not found' });
        }
        if (existing.rows[0].entity_id && existing.rows[0].entity_id !== entity_id) {
            return res.status(403).json({ success: false, error: 'لا يمكن حذف تنبؤ كيان آخر' });
        }

        await pool.query('DELETE FROM finance_ai_forecasts WHERE forecast_id = $1', [forecast_id]);
        res.json({ success: true, message: 'تم حذف التنبؤ' });
    } catch (error) {
        console.error('❌ Error deleting forecast:', error);
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
    getForecasts,
    createForecast,
    updateForecast,
    deleteForecast,
    testConnection
};
