/**
 * 🧾 Journal Lines API
 * Page 10 of Accounting System
 */

const { getRequestEntityContext, buildEntityScopeCondition } = require('../../entity-context');

const db = require('../../db');
const pool = db.pool;

async function getJournalLines(req, res) {
    const { entity_id } = req.query;

    if (!entity_id) {
        return res.status(400).json({
            success: false,
            error: 'entity_id is required'
        });
    }

    try {
        console.log(`🧾 Fetching journal lines for entity ${entity_id}...`);

        const query = `
            SELECT 
                jl.line_id,
                jl.entry_id,
                jl.line_number,
                jl.account_id,
                jl.account_code,
                jl.debit_amount,
                jl.credit_amount,
                jl.description AS line_description,
                jl.created_at,
                je.entry_number,
                je.entry_date,
                je.entry_type,
                je.status,
                a.account_name_ar,
                a.account_name_en
            FROM finance_journal_lines jl
            JOIN finance_journal_entries je ON jl.entry_id = je.entry_id
            LEFT JOIN finance_accounts a ON jl.account_id = a.account_id
            WHERE ${buildEntityScopeCondition(getRequestEntityContext(req), 'je.entity_id', 1)}
            ORDER BY je.entry_date DESC, je.entry_number DESC, jl.line_number
        `;

        const result = await pool.query(query, [entity_id]);
        const lines = result.rows;

        const summary = lines.reduce((acc, l) => {
            acc.total_lines += 1;
            acc.total_debit += parseFloat(l.debit_amount || 0);
            acc.total_credit += parseFloat(l.credit_amount || 0);
            return acc;
        }, { total_lines: 0, total_debit: 0, total_credit: 0 });
        summary.total_diff = summary.total_debit - summary.total_credit;

        res.json({
            success: true,
            lines,
            summary
        });
    } catch (error) {
        console.error('❌ Error fetching journal lines:', error);
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
}

async function createJournalLine(req, res) {
    const {
        entity_id,
        entry_id,
        account_code,
        debit_amount,
        credit_amount,
        description
    } = req.body || {};

    if (!entity_id || !entry_id || !account_code) {
        return res.status(400).json({
            success: false,
            error: 'Missing required fields: entity_id, entry_id, account_code'
        });
    }

    const debit = parseFloat(debit_amount || 0);
    const credit = parseFloat(credit_amount || 0);
    if (debit === 0 && credit === 0) {
        return res.status(400).json({
            success: false,
            error: 'Either debit_amount or credit_amount is required'
        });
    }

    try {
        const entryResult = await pool.query(
            'SELECT entry_id, entity_id FROM finance_journal_entries WHERE entry_id = $1',
            [entry_id]
        );
        if (!entryResult.rows.length) {
            return res.status(404).json({ success: false, error: 'Entry not found' });
        }
        if (entryResult.rows[0].entity_id && entryResult.rows[0].entity_id !== entity_id) {
            return res.status(403).json({ success: false, error: 'لا يمكن إضافة سطر لقيد كيان آخر' });
        }

        const accountResult = await pool.query(
            'SELECT account_id, account_code FROM finance_accounts WHERE account_code = $1',
            [account_code]
        );
        if (!accountResult.rows.length) {
            return res.status(404).json({ success: false, error: 'Account not found' });
        }

        const lineNumberResult = await pool.query(
            'SELECT COALESCE(MAX(line_number), 0) + 1 AS next_line FROM finance_journal_lines WHERE entry_id = $1',
            [entry_id]
        );
        const nextLine = lineNumberResult.rows[0].next_line || 1;

        const result = await pool.query(
            `INSERT INTO finance_journal_lines
             (entry_id, line_number, account_id, account_code, debit_amount, credit_amount, description, entity_type, entity_id, created_at)
             VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,NOW())
             RETURNING *`,
            [
                entry_id,
                nextLine,
                accountResult.rows[0].account_id,
                accountResult.rows[0].account_code,
                debit || null,
                credit || null,
                description || null,
                'HQ',
                entity_id
            ]
        );

        res.json({ success: true, line: result.rows[0] });
    } catch (error) {
        console.error('❌ Error creating journal line:', error);
        res.status(500).json({ success: false, error: error.message });
    }
}

async function updateJournalLine(req, res) {
    const { line_id } = req.params;
    const {
        entity_id,
        account_code,
        debit_amount,
        credit_amount,
        description
    } = req.body || {};

    if (!line_id || !entity_id || !account_code) {
        return res.status(400).json({
            success: false,
            error: 'Missing required fields: line_id, entity_id, account_code'
        });
    }

    const debit = parseFloat(debit_amount || 0);
    const credit = parseFloat(credit_amount || 0);
    if (debit === 0 && credit === 0) {
        return res.status(400).json({
            success: false,
            error: 'Either debit_amount or credit_amount is required'
        });
    }

    try {
        const existing = await pool.query(
            `SELECT jl.line_id, je.entity_id
             FROM finance_journal_lines jl
             JOIN finance_journal_entries je ON jl.entry_id = je.entry_id
             WHERE jl.line_id = $1`,
            [line_id]
        );
        if (!existing.rows.length) {
            return res.status(404).json({ success: false, error: 'Line not found' });
        }
        if (existing.rows[0].entity_id && existing.rows[0].entity_id !== entity_id) {
            return res.status(403).json({ success: false, error: 'لا يمكن تعديل سطر كيان آخر' });
        }

        const accountResult = await pool.query(
            'SELECT account_id, account_code FROM finance_accounts WHERE account_code = $1',
            [account_code]
        );
        if (!accountResult.rows.length) {
            return res.status(404).json({ success: false, error: 'Account not found' });
        }

        const result = await pool.query(
            `UPDATE finance_journal_lines
             SET account_id = $1,
                 account_code = $2,
                 debit_amount = $3,
                 credit_amount = $4,
                 description = $5
             WHERE line_id = $6
             RETURNING *`,
            [
                accountResult.rows[0].account_id,
                accountResult.rows[0].account_code,
                debit || null,
                credit || null,
                description || null,
                line_id
            ]
        );

        res.json({ success: true, line: result.rows[0] });
    } catch (error) {
        console.error('❌ Error updating journal line:', error);
        res.status(500).json({ success: false, error: error.message });
    }
}

async function deleteJournalLine(req, res) {
    const { line_id } = req.params;
    const { entity_id } = req.query;

    if (!line_id || !entity_id) {
        return res.status(400).json({ success: false, error: 'line_id and entity_id are required' });
    }

    try {
        const existing = await pool.query(
            `SELECT jl.line_id, je.entity_id
             FROM finance_journal_lines jl
             JOIN finance_journal_entries je ON jl.entry_id = je.entry_id
             WHERE jl.line_id = $1`,
            [line_id]
        );
        if (!existing.rows.length) {
            return res.status(404).json({ success: false, error: 'Line not found' });
        }
        if (existing.rows[0].entity_id && existing.rows[0].entity_id !== entity_id) {
            return res.status(403).json({ success: false, error: 'لا يمكن حذف سطر كيان آخر' });
        }

        await pool.query('DELETE FROM finance_journal_lines WHERE line_id = $1', [line_id]);
        res.json({ success: true, message: 'تم حذف السطر' });
    } catch (error) {
        console.error('❌ Error deleting journal line:', error);
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
    getJournalLines,
    createJournalLine,
    updateJournalLine,
    deleteJournalLine,
    testConnection
};
