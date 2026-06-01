const { Pool } = require('pg');

const pool = new Pool({
    host: 'crossover.proxy.rlwy.net',
    port: 44255,
    database: 'railway',
    user: 'postgres',
    password: 'PddzJpAQYezqknsntSzmCUlQYuYJldcT',
    ssl: { rejectUnauthorized: false }
});

async function seedBalanceSheet() {
    const entityId = 'HQ001';

    const existingSheet = await pool.query(
        'SELECT sheet_id FROM finance_balance_sheet WHERE entity_id = $1 ORDER BY sheet_date DESC LIMIT 1',
        [entityId]
    );

    let sheetId;
    if (existingSheet.rows.length > 0) {
        sheetId = existingSheet.rows[0].sheet_id;
        console.log('ℹ️ تم العثور على ميزانية موجودة لـ', entityId, 'برقم', sheetId);
    } else {
        const today = new Date();
        const sheetDate = today.toISOString().slice(0, 10);
        const fiscalYear = today.getFullYear();

        const sheetResult = await pool.query(
            `
            INSERT INTO finance_balance_sheet
                (entity_id, sheet_date, period_type, fiscal_year, notes, created_at, updated_at, created_by)
            VALUES
                ($1, $2, $3, $4, $5, NOW(), NOW(), $6)
            RETURNING sheet_id
            `,
            [entityId, sheetDate, 'yearly', fiscalYear, 'ميزانية افتتاحية تجريبية', 'seed-script']
        );

        sheetId = sheetResult.rows[0].sheet_id;
        console.log('✅ تم إنشاء ميزانية جديدة برقم', sheetId);
    }

    const assets = [
        { category: 'current', type: 'cash', name: 'النقد بالصندوق', amount: 250000, description: 'نقد متاح' },
        { category: 'current', type: 'receivables', name: 'ذمم مدينة', amount: 80000, description: 'مستحقات العملاء' },
        { category: 'current', type: 'inventory', name: 'مخزون', amount: 50000, description: 'مخزون بضائع' },
        { category: 'non_current', type: 'equipment', name: 'معدات تشغيل', amount: 120000, description: 'معدات وأجهزة' },
        { category: 'non_current', type: 'building', name: 'مباني', amount: 200000, description: 'مقرات وأصول ثابتة' }
    ];

    let assetsInserted = 0;
    for (const asset of assets) {
        const exists = await pool.query(
            'SELECT 1 FROM finance_assets WHERE entity_id = $1 AND asset_type = $2 AND asset_name = $3 LIMIT 1',
            [entityId, asset.type, asset.name]
        );
        if (exists.rows.length === 0) {
            await pool.query(
                `
                INSERT INTO finance_assets
                    (sheet_id, entity_id, asset_category, asset_type, asset_name, amount, description, created_at, updated_at)
                VALUES
                    ($1, $2, $3, $4, $5, $6, $7, NOW(), NOW())
                `,
                [sheetId, entityId, asset.category, asset.type, asset.name, asset.amount, asset.description]
            );
            assetsInserted += 1;
        }
    }

    if (assetsInserted > 0) {
        console.log('✅ تم إضافة الأصول الناقصة:', assetsInserted);
    } else {
        console.log('ℹ️ الأصول مكتملة بالفعل');
    }

    const liabilities = [
        { category: 'current', type: 'payables', name: 'ذمم دائنة', amount: 90000, description: 'التزامات قصيرة الأجل' },
        { category: 'current', type: 'tax', name: 'ضرائب مستحقة', amount: 20000, description: 'التزامات ضريبية' },
        { category: 'non_current', type: 'loan', name: 'قروض طويلة الأجل', amount: 150000, description: 'تمويل طويل الأجل' }
    ];

    let liabilitiesInserted = 0;
    for (const liability of liabilities) {
        const exists = await pool.query(
            'SELECT 1 FROM finance_liabilities WHERE entity_id = $1 AND liability_type = $2 AND liability_name = $3 LIMIT 1',
            [entityId, liability.type, liability.name]
        );
        if (exists.rows.length === 0) {
            await pool.query(
                `
                INSERT INTO finance_liabilities
                    (sheet_id, entity_id, liability_category, liability_type, liability_name, amount, description, created_at, updated_at)
                VALUES
                    ($1, $2, $3, $4, $5, $6, $7, NOW(), NOW())
                `,
                [sheetId, entityId, liability.category, liability.type, liability.name, liability.amount, liability.description]
            );
            liabilitiesInserted += 1;
        }
    }

    if (liabilitiesInserted > 0) {
        console.log('✅ تم إضافة الالتزامات الناقصة:', liabilitiesInserted);
    } else {
        console.log('ℹ️ الالتزامات مكتملة بالفعل');
    }

    const equity = [
        { type: 'capital', name: 'رأس المال', amount: 300000, description: 'استثمار الملاك' },
        { type: 'retained', name: 'أرباح محتجزة', amount: 120000, description: 'أرباح سنوات سابقة' },
        { type: 'profit', name: 'أرباح العام', amount: 20000, description: 'صافي الربح' }
    ];

    let equityInserted = 0;
    for (const item of equity) {
        const exists = await pool.query(
            'SELECT 1 FROM finance_equity WHERE entity_id = $1 AND equity_type = $2 AND equity_name = $3 LIMIT 1',
            [entityId, item.type, item.name]
        );
        if (exists.rows.length === 0) {
            await pool.query(
                `
                INSERT INTO finance_equity
                    (sheet_id, entity_id, equity_type, equity_name, amount, description, created_at, updated_at)
                VALUES
                    ($1, $2, $3, $4, $5, $6, NOW(), NOW())
                `,
                [sheetId, entityId, item.type, item.name, item.amount, item.description]
            );
            equityInserted += 1;
        }
    }

    if (equityInserted > 0) {
        console.log('✅ تم إضافة حقوق الملكية الناقصة:', equityInserted);
    } else {
        console.log('ℹ️ حقوق الملكية مكتملة بالفعل');
    }

    console.log('✅ تم تجهيز بيانات الميزانية لـ', entityId);
}

seedBalanceSheet()
    .catch((error) => {
        console.error('❌ فشل إضافة البيانات:', error);
        process.exitCode = 1;
    })
    .finally(async () => {
        await pool.end();
    });
