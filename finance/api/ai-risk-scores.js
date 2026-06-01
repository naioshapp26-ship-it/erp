/**
 * 🛡️ AI Risk Scores API
 * Page 13 of Accounting System
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

async function getRiskScores(req, res) {
    const { entity_id, from_date, to_date, risk_level, customer_id } = req.query;
    const entityId = resolveScopedEntityId(req, entity_id);

    if (!entityId) {
        return res.status(400).json({
            success: false,
            error: 'entity_id is required'
        });
    }

    try {
        console.log(`🛡️ Fetching AI risk scores for entity ${entityId}...`);

        const conditions = [buildEntityScopeCondition(getRequestEntityContext(req), 'entity_id', 1)];
        const values = [entityId];
        let paramIndex = 2;

        if (from_date) {
            conditions.push(`assessment_date >= $${paramIndex}`);
            values.push(from_date);
            paramIndex++;
        }

        if (to_date) {
            conditions.push(`assessment_date <= $${paramIndex}`);
            values.push(to_date);
            paramIndex++;
        }

        if (risk_level) {
            conditions.push(`LOWER(risk_level) = LOWER($${paramIndex})`);
            values.push(risk_level);
            paramIndex++;
        }

        if (customer_id) {
            conditions.push(`customer_id = $${paramIndex}`);
            values.push(customer_id);
            paramIndex++;
        }

        const query = `
            SELECT
                risk_id,
                customer_id,
                assessment_date,
                risk_score,
                risk_level,
                risk_factors,
                calculation_details,
                recommendations,
                suggested_actions,
                entity_type,
                entity_id,
                model_version,
                created_at
            FROM finance_ai_risk_scores
            WHERE ${conditions.join(' AND ')}
            ORDER BY assessment_date DESC, risk_id DESC
        `;

        const result = await pool.query(query, values);
        const rows = result.rows;

        const summary = rows.reduce((acc, r) => {
            const score = parseFloat(r.risk_score || 0);
            acc.total_scores += 1;
            acc.total_score_value += score;
            acc.max_score = Math.max(acc.max_score, score);
            acc.min_score = Math.min(acc.min_score, score);
            acc.levels[(r.risk_level || 'Unknown').toUpperCase()] =
                (acc.levels[(r.risk_level || 'Unknown').toUpperCase()] || 0) + 1;
            acc.customers.add(r.customer_id);
            acc.latest_assessment = acc.latest_assessment
                ? (new Date(r.assessment_date) > new Date(acc.latest_assessment) ? r.assessment_date : acc.latest_assessment)
                : r.assessment_date;
            return acc;
        }, {
            total_scores: 0,
            total_score_value: 0,
            max_score: 0,
            min_score: rows.length ? Number.MAX_SAFE_INTEGER : 0,
            levels: {},
            customers: new Set(),
            latest_assessment: null
        });

        summary.avg_score = summary.total_scores ? (summary.total_score_value / summary.total_scores) : 0;
        summary.min_score = summary.total_scores ? summary.min_score : 0;
        summary.unique_customers = summary.customers.size;
        summary.customers = undefined;
        summary.latest_assessment = summary.latest_assessment;

        res.json({
            success: true,
            rows,
            summary
        });
    } catch (error) {
        console.error('❌ Error fetching AI risk scores:', error);
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
}

async function createRiskScore(req, res) {
    const entityId = resolveScopedEntityId(req, req.body.entity_id);
    const entityType = req.body.entity_type || req.headers['x-entity-type'] || 'HQ';
    const {
        customer_id,
        assessment_date,
        risk_score,
        risk_level,
        risk_factors,
        calculation_details,
        recommendations,
        suggested_actions,
        model_version
    } = req.body;

    if (!entityId) {
        return res.status(400).json({ success: false, error: 'entity_id is required' });
    }

    if (!customer_id || !assessment_date || risk_score === undefined || !risk_level) {
        return res.status(400).json({ success: false, error: 'customer_id, assessment_date, risk_score, risk_level are required' });
    }

    if (Number.isNaN(Number(risk_score))) {
        return res.status(400).json({ success: false, error: 'risk_score must be numeric' });
    }

    try {
        const insertQuery = `
            INSERT INTO finance_ai_risk_scores (
                customer_id,
                assessment_date,
                risk_score,
                risk_level,
                risk_factors,
                calculation_details,
                recommendations,
                suggested_actions,
                entity_type,
                entity_id,
                model_version,
                created_at
            ) VALUES ($1,$2,$3,$4,$5::jsonb,$6::jsonb,$7,$8::jsonb,$9,$10,$11,NOW())
            RETURNING *
        `;

        const values = [
            Number(customer_id),
            assessment_date,
            Number(risk_score),
            String(risk_level).toUpperCase(),
            JSON.stringify(risk_factors || {}),
            JSON.stringify(calculation_details || {}),
            recommendations || null,
            JSON.stringify(suggested_actions || []),
            entityType,
            entityId,
            model_version || 'v1.0.0'
        ];

        const result = await pool.query(insertQuery, values);
        res.json({ success: true, row: result.rows[0] });
    } catch (error) {
        console.error('❌ Error creating AI risk score:', error);
        res.status(500).json({ success: false, error: error.message });
    }
}

async function updateRiskScore(req, res) {
    const entityId = resolveScopedEntityId(req, req.body.entity_id);
    const entityType = req.body.entity_type || req.headers['x-entity-type'] || 'HQ';
    const riskId = req.params.risk_id;
    const {
        customer_id,
        assessment_date,
        risk_score,
        risk_level,
        risk_factors,
        calculation_details,
        recommendations,
        suggested_actions,
        model_version
    } = req.body;

    if (!entityId) {
        return res.status(400).json({ success: false, error: 'entity_id is required' });
    }

    if (!riskId) {
        return res.status(400).json({ success: false, error: 'risk_id is required' });
    }

    if (!customer_id || !assessment_date || risk_score === undefined || !risk_level) {
        return res.status(400).json({ success: false, error: 'customer_id, assessment_date, risk_score, risk_level are required' });
    }

    if (Number.isNaN(Number(risk_score))) {
        return res.status(400).json({ success: false, error: 'risk_score must be numeric' });
    }

    try {
        const updateQuery = `
            UPDATE finance_ai_risk_scores
            SET
                customer_id = $1,
                assessment_date = $2,
                risk_score = $3,
                risk_level = $4,
                risk_factors = $5::jsonb,
                calculation_details = $6::jsonb,
                recommendations = $7,
                suggested_actions = $8::jsonb,
                entity_type = $9,
                entity_id = $10,
                model_version = $11
            WHERE risk_id = $12 AND entity_id = $13
            RETURNING *
        `;

        const values = [
            Number(customer_id),
            assessment_date,
            Number(risk_score),
            String(risk_level).toUpperCase(),
            JSON.stringify(risk_factors || {}),
            JSON.stringify(calculation_details || {}),
            recommendations || null,
            JSON.stringify(suggested_actions || []),
            entityType,
            entityId,
            model_version || 'v1.0.0',
            Number(riskId),
            entityId
        ];

        const result = await pool.query(updateQuery, values);
        if (!result.rowCount) {
            return res.status(404).json({ success: false, error: 'Risk score not found for this entity' });
        }

        res.json({ success: true, row: result.rows[0] });
    } catch (error) {
        console.error('❌ Error updating AI risk score:', error);
        res.status(500).json({ success: false, error: error.message });
    }
}

async function deleteRiskScore(req, res) {
    const entityId = resolveScopedEntityId(req, req.query.entity_id);
    const riskId = req.params.risk_id;

    if (!entityId) {
        return res.status(400).json({ success: false, error: 'entity_id is required' });
    }

    try {
        const result = await pool.query(
            'DELETE FROM finance_ai_risk_scores WHERE risk_id = $1 AND entity_id = $2',
            [Number(riskId), entityId]
        );

        if (!result.rowCount) {
            return res.status(404).json({ success: false, error: 'Risk score not found for this entity' });
        }

        res.json({ success: true });
    } catch (error) {
        console.error('❌ Error deleting AI risk score:', error);
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
    getRiskScores,
    createRiskScore,
    updateRiskScore,
    deleteRiskScore,
    testConnection
};
