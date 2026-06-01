/**
 * 📊 Cashflow Comprehensive Report API
 * Page 12 of Accounting System
 */

const { getRequestEntityContext, buildEntityScopeCondition } = require('../../entity-context');

const db = require('../../db');
const pool = db.pool;

async function getCashflowComprehensive(req, res) {
    const { entity_id, from_date, to_date, fiscal_year } = req.query;

    if (!entity_id) {
        return res.status(400).json({
            success: false,
            error: 'entity_id is required'
        });
    }

    try {
        console.log(`📊 Fetching cashflow comprehensive report for entity ${entity_id}...`);

        let query = `
            SELECT 
                flow_type,
                flow_category,
                flow_direction,
                SUM(amount) as total_amount,
                COUNT(*) as transaction_count
            FROM finance_cashflow
            WHERE ${buildEntityScopeCondition(getRequestEntityContext(req), 'entity_id', 1)}
        `;
        const params = [entity_id];

        if (from_date) {
            params.push(from_date);
            query += ` AND transaction_date >= $${params.length}`;
        }

        if (to_date) {
            params.push(to_date);
            query += ` AND transaction_date <= $${params.length}`;
        }

        if (fiscal_year) {
            params.push(fiscal_year);
            query += ` AND fiscal_year = $${params.length}`;
        }

        query += `
            GROUP BY flow_type, flow_category, flow_direction
            ORDER BY flow_type, flow_category, flow_direction
        `;

        const result = await pool.query(query, params);
        const rows = result.rows;

        const calcNetFlow = (flows) => {
            const inflow = flows
                .filter(f => f.flow_direction === 'IN')
                .reduce((sum, f) => sum + parseFloat(f.total_amount || 0), 0);
            const outflow = flows
                .filter(f => f.flow_direction === 'OUT')
                .reduce((sum, f) => sum + parseFloat(f.total_amount || 0), 0);
            return { inflow, outflow, net: inflow - outflow };
        };

        const operating = rows.filter(r => r.flow_type === 'OPERATING');
        const investing = rows.filter(r => r.flow_type === 'INVESTING');
        const financing = rows.filter(r => r.flow_type === 'FINANCING');

        const operatingNet = calcNetFlow(operating);
        const investingNet = calcNetFlow(investing);
        const financingNet = calcNetFlow(financing);

        const totalNetCashflow = operatingNet.net + investingNet.net + financingNet.net;
        const totalIn = operatingNet.inflow + investingNet.inflow + financingNet.inflow;
        const totalOut = operatingNet.outflow + investingNet.outflow + financingNet.outflow;

        res.json({
            success: true,
            rows,
            summary: {
                operating: operatingNet,
                investing: investingNet,
                financing: financingNet,
                total_in: totalIn,
                total_out: totalOut,
                total_net: totalNetCashflow,
                total_rows: rows.length
            }
        });
    } catch (error) {
        console.error('❌ Error fetching cashflow comprehensive report:', error);
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
    getCashflowComprehensive,
    testConnection
};
