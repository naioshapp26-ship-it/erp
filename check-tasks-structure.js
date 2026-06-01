require('dotenv').config();
const db = require('./db');
if (!process.env.DATABASE_URL) {
    console.error('❌ DATABASE_URL is not set. Aborting to avoid exposing credentials.');
    process.exit(1);
}

const pool = db.pool;
async function checkTasksStructure() {
    try {
        // Check if tasks table exists and get its structure
        const result = await pool.query(`
            SELECT column_name, data_type, character_maximum_length
            FROM information_schema.columns
            WHERE table_name = 'tasks'
            ORDER BY ordinal_position;
        `);
        
        console.log('\n=== Tasks Table Structure ===');
        if (result.rows.length === 0) {
            console.log('Table "tasks" does not exist!');
        } else {
            result.rows.forEach(col => {
                console.log(`${col.column_name}: ${col.data_type}${col.character_maximum_length ? `(${col.character_maximum_length})` : ''}`);
            });
        }
        
        // Check if assignee column exists
        const assigneeCheck = result.rows.find(col => col.column_name === 'assignee');
        console.log('\n=== Assignee Column ===');
        console.log(assigneeCheck ? '✓ Assignee column EXISTS' : '✗ Assignee column DOES NOT EXIST');
        
    } catch (err) {
        console.error('Error:', err.message);
    } finally {
        await pool.end();
    }
}

checkTasksStructure();
