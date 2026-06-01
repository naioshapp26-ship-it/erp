/**
 * Initialize Comprehensive Audit Log System
 * نظام سجل المراجعات الشامل
 */

const { Pool } = require('pg');

// Database Connection
const pool = new Pool({
    connectionString: 'postgresql://postgres:PddzJpAQYezqknsntSzmCUlQYuYJldcT@crossover.proxy.rlwy.net:44255/railway'
});

async function initializeAuditLog() {
    const client = await pool.connect();
    
    try {
        console.log('🔄 جاري تهيئة نظام سجل المراجعات الشامل...\n');

        // 1. Create audit_log table
        console.log('📝 1️⃣ إنشاء جدول audit_log الرئيسي...');
        await client.query(`
            CREATE TABLE IF NOT EXISTS audit_log (
                id BIGSERIAL PRIMARY KEY,
                user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
                user_name VARCHAR(255) NOT NULL,
                user_role VARCHAR(50),
                entity_id VARCHAR(20) REFERENCES entities(id) ON DELETE SET NULL,
                action_timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                action_date DATE DEFAULT CURRENT_DATE,
                entity_type VARCHAR(50) NOT NULL,
                entity_reference_id VARCHAR(100),
                entity_reference_name VARCHAR(255),
                action_type VARCHAR(50) NOT NULL,
                field_changed VARCHAR(255),
                old_value TEXT,
                new_value TEXT,
                reason TEXT,
                reason_category VARCHAR(50),
                requires_approval BOOLEAN DEFAULT false,
                approval_status VARCHAR(20),
                approved_by_user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
                approved_by_name VARCHAR(255),
                approval_timestamp TIMESTAMP,
                approval_reason TEXT,
                financial_impact BOOLEAN DEFAULT false,
                amount_affected DECIMAL(12, 2),
                currency VARCHAR(3) DEFAULT 'SAR',
                ip_address VARCHAR(50),
                session_id VARCHAR(100),
                source_system VARCHAR(50),
                description TEXT,
                related_audit_ids BIGINT[],
                error_message TEXT,
                success BOOLEAN DEFAULT true,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        `);
        console.log('✅ تم إنشاء جدول audit_log\n');

        // 2. Create indexes
        console.log('📝 2️⃣ إنشاء الفهارس (Indexes)...');
        const indexes = [
            'idx_audit_user_id',
            'idx_audit_entity_id',
            'idx_audit_entity_reference',
            'idx_audit_timestamp',
            'idx_audit_action_type',
            'idx_audit_entity_type',
            'idx_audit_approval_status',
            'idx_audit_financial'
        ];

        for (const indexName of indexes) {
            try {
                if (indexName === 'idx_audit_user_id') {
                    await client.query(`CREATE INDEX IF NOT EXISTS ${indexName} ON audit_log(user_id)`);
                } else if (indexName === 'idx_audit_entity_id') {
                    await client.query(`CREATE INDEX IF NOT EXISTS ${indexName} ON audit_log(entity_id)`);
                } else if (indexName === 'idx_audit_entity_reference') {
                    await client.query(`CREATE INDEX IF NOT EXISTS ${indexName} ON audit_log(entity_type, entity_reference_id)`);
                } else if (indexName === 'idx_audit_timestamp') {
                    await client.query(`CREATE INDEX IF NOT EXISTS ${indexName} ON audit_log(action_timestamp DESC)`);
                } else if (indexName === 'idx_audit_action_type') {
                    await client.query(`CREATE INDEX IF NOT EXISTS ${indexName} ON audit_log(action_type)`);
                } else if (indexName === 'idx_audit_entity_type') {
                    await client.query(`CREATE INDEX IF NOT EXISTS ${indexName} ON audit_log(entity_type)`);
                } else if (indexName === 'idx_audit_approval_status') {
                    await client.query(`CREATE INDEX IF NOT EXISTS ${indexName} ON audit_log(approval_status)`);
                } else if (indexName === 'idx_audit_financial') {
                    await client.query(`CREATE INDEX IF NOT EXISTS ${indexName} ON audit_log(financial_impact)`);
                }
            } catch (err) {
                if (!err.message.includes('already exists')) {
                    console.warn(`⚠️ خطأ في إنشاء فهرس ${indexName}:`, err.message);
                }
            }
        }
        console.log('✅ تم إنشاء الفهارس\n');

        // 3. Create audit_log_changes table
        console.log('📝 3️⃣ إنشاء جدول audit_log_changes (تفاصيل التغييرات)...');
        await client.query(`
            CREATE TABLE IF NOT EXISTS audit_log_changes (
                id BIGSERIAL PRIMARY KEY,
                audit_log_id BIGINT NOT NULL REFERENCES audit_log(id) ON DELETE CASCADE,
                field_name VARCHAR(255) NOT NULL,
                old_value TEXT,
                new_value TEXT,
                data_type VARCHAR(50),
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        `);
        await client.query(`CREATE INDEX IF NOT EXISTS idx_audit_changes_log_id ON audit_log_changes(audit_log_id)`);
        console.log('✅ تم إنشاء جدول audit_log_changes\n');

        // 4. Create audit_approvals table
        console.log('📝 4️⃣ إنشاء جدول audit_approvals (سلسلة الموافقات)...');
        await client.query(`
            CREATE TABLE IF NOT EXISTS audit_approvals (
                id BIGSERIAL PRIMARY KEY,
                audit_log_id BIGINT NOT NULL REFERENCES audit_log(id) ON DELETE CASCADE,
                approval_level INTEGER,
                approver_user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
                approver_name VARCHAR(255) NOT NULL,
                approver_role VARCHAR(50),
                approval_status VARCHAR(20),
                approval_timestamp TIMESTAMP,
                approval_reason TEXT,
                approval_comment TEXT,
                required BOOLEAN DEFAULT true,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        `);
        await client.query(`CREATE INDEX IF NOT EXISTS idx_audit_approvals_log_id ON audit_approvals(audit_log_id)`);
        await client.query(`CREATE INDEX IF NOT EXISTS idx_audit_approvals_status ON audit_approvals(approval_status)`);
        console.log('✅ تم إنشاء جدول audit_approvals\n');

        // 5. Create audit_notifications table
        console.log('📝 5️⃣ إنشاء جدول audit_notifications (التنبيهات)...');
        await client.query(`
            CREATE TABLE IF NOT EXISTS audit_notifications (
                id BIGSERIAL PRIMARY KEY,
                audit_log_id BIGINT NOT NULL REFERENCES audit_log(id) ON DELETE CASCADE,
                recipient_user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
                recipient_name VARCHAR(255),
                recipient_role VARCHAR(50),
                notification_type VARCHAR(50),
                notification_message TEXT,
                is_sent BOOLEAN DEFAULT false,
                sent_at TIMESTAMP,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        `);
        console.log('✅ تم إنشاء جدول audit_notifications\n');

        // 6. Create audit_statistics table
        console.log('📝 6️⃣ إنشاء جدول audit_statistics (الإحصائيات)...');
        await client.query(`
            CREATE TABLE IF NOT EXISTS audit_statistics (
                id SERIAL PRIMARY KEY,
                date_recorded DATE,
                entity_type VARCHAR(50),
                action_type VARCHAR(50),
                total_count INTEGER DEFAULT 0,
                success_count INTEGER DEFAULT 0,
                failure_count INTEGER DEFAULT 0,
                total_amount_affected DECIMAL(15, 2) DEFAULT 0,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        `);
        console.log('✅ تم إنشاء جدول audit_statistics\n');

        // 7. Create VIEWs
        console.log('📝 7️⃣ إنشاء الـ Views (الجداول الافتراضية)...');
        
        await client.query(`
            CREATE OR REPLACE VIEW audit_log_summary AS
            SELECT 
                id, user_name, user_role, action_timestamp,
                entity_type, entity_reference_id, entity_reference_name,
                action_type, field_changed, old_value, new_value,
                reason, reason_category,
                approval_status, approved_by_name, amount_affected,
                description, success
            FROM audit_log
            ORDER BY action_timestamp DESC
        `);

        await client.query(`
            CREATE OR REPLACE VIEW audit_log_financial AS
            SELECT 
                id, user_name, action_timestamp,
                entity_type, entity_reference_id, action_type,
                amount_affected, currency, reason,
                approval_status, approved_by_name
            FROM audit_log
            WHERE financial_impact = true AND amount_affected IS NOT NULL
            ORDER BY action_timestamp DESC
        `);

        await client.query(`
            CREATE OR REPLACE VIEW audit_log_approvals_chain AS
            SELECT 
                al.id AS audit_id,
                al.user_name,
                al.action_type,
                al.entity_reference_name,
                al.approval_status,
                aa.approval_level,
                aa.approver_name,
                aa.approver_role,
                aa.approval_status AS step_status,
                aa.approval_reason,
                aa.approval_comment,
                aa.approval_timestamp
            FROM audit_log al
            LEFT JOIN audit_approvals aa ON al.id = aa.audit_log_id
            ORDER BY al.action_timestamp DESC, aa.approval_level ASC
        `);

        console.log('✅ تم إنشاء Views\n');

        // 8. Add sample audit data
        console.log('📝 8️⃣ إضافة بيانات اختبارية...');
        
        const sampleOperations = [
            {
                user_name: 'م. أحمد العلي',
                user_role: 'مسؤول النظام',
                entity_type: 'INVOICE',
                entity_reference_id: 'INV-2026-001',
                entity_reference_name: 'فاتورة #1',
                action_type: 'CREATE',
                reason: 'إصدار فاتورة جديدة',
                reason_category: 'BUSINESS',
                approval_status: 'COMPLETED',
                financial_impact: true,
                amount_affected: 10000.00,
                description: 'تم إصدار فاتورة جديدة بقيمة 10000 ر.س'
            },
            {
                user_name: 'سارة محمد',
                user_role: 'مسؤول مالي',
                entity_type: 'PAYMENT',
                entity_reference_id: 'TRX-001',
                entity_reference_name: 'دفعة رقم 1',
                action_type: 'PAYMENT',
                field_changed: 'amount_paid',
                old_value: '0.00',
                new_value: '5000.00',
                reason: 'تسجيل دفعة جزئية من العميل',
                reason_category: 'BUSINESS',
                approval_status: 'COMPLETED',
                financial_impact: true,
                amount_affected: 5000.00,
                description: 'تسجيل دفعة جزئية'
            },
            {
                user_name: 'مدير المبيعات',
                user_role: 'مسؤول',
                entity_type: 'INVOICE',
                entity_reference_id: 'INV-2026-002',
                entity_reference_name: 'فاتورة #2',
                action_type: 'APPLY_DISCOUNT',
                field_changed: 'discount_percent',
                old_value: '0',
                new_value: '10',
                reason: 'خصم لعميل مهم - طلب مدير المبيعات',
                reason_category: 'CUSTOMER_REQUEST',
                requires_approval: true,
                approval_status: 'APPROVED',
                financial_impact: true,
                amount_affected: -500.00,
                description: 'تطبيق خصم 10% للعميل'
            }
        ];

        for (const op of sampleOperations) {
            const result = await client.query(
                `INSERT INTO audit_log (
                    user_name, user_role, entity_type,
                    entity_reference_id, entity_reference_name,
                    action_type, field_changed, old_value, new_value,
                    reason, reason_category,
                    requires_approval, approval_status,
                    financial_impact, amount_affected,
                    source_system, description, success
                ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18)
                RETURNING id`,
                [
                    op.user_name, op.user_role, op.entity_type,
                    op.entity_reference_id, op.entity_reference_name,
                    op.action_type, op.field_changed || null, op.old_value || null, op.new_value || null,
                    op.reason, op.reason_category,
                    op.requires_approval || false, op.approval_status,
                    op.financial_impact, op.amount_affected || null,
                    'WEB', op.description, true
                ]
            );
            console.log(`  ✓ تسجيل: ${op.entity_reference_name}`);
        }
        console.log('✅ تم إضافة البيانات الاختبارية\n');

        // Verify all components
        console.log('\n═══════════════════════════════════════════════════\n');
        console.log('🔍 التحقق من المكونات:\n');

        const tables = ['audit_log', 'audit_log_changes', 'audit_approvals', 'audit_notifications', 'audit_statistics'];
        for (const table of tables) {
            const result = await client.query(
                `SELECT COUNT(*) FROM information_schema.tables WHERE table_name = $1`,
                [table]
            );
            const exists = result.rows[0].count > 0;
            console.log(`  ${exists ? '✅' : '❌'} جدول ${table}: ${exists ? 'موجود' : 'غير موجود'}`);
        }

        const logCount = await client.query('SELECT COUNT(*) as count FROM audit_log');
        console.log(`\n📊 عدد السجلات في audit_log: ${logCount.rows[0].count}`);

        const logEntries = await client.query(
            'SELECT id, user_name, action_type, entity_reference_name, approval_status FROM audit_log ORDER BY id DESC LIMIT 5'
        );
        console.log('\n📝 آخر 5 عمليات مسجلة:');
        logEntries.rows.forEach((row, idx) => {
            console.log(`  ${idx + 1}. ${row.user_name} - ${row.action_type} (${row.entity_reference_name}) [${row.approval_status}]`);
        });

        console.log('\n═══════════════════════════════════════════════════\n');
        console.log('🎉 تم تهيئة نظام سجل المراجعات بنجاح!\n');

    } catch (error) {
        console.error('❌ خطأ في تهيئة نظام سجل المراجعات:', error.message);
        throw error;
    } finally {
        client.release();
    }
}

// Run initialization
initializeAuditLog()
    .then(() => {
        console.log('✅ اكتملت عملية التهيئة بنجاح');
        process.exit(0);
    })
    .catch((error) => {
        console.error('❌ فشلت عملية التهيئة:', error);
        process.exit(1);
    })
    .finally(() => {
        pool.end();
    });
