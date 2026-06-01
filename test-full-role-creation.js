const { Pool } = require('pg');

const pool = new Pool({
    connectionString: 'postgresql://postgres:PddzJpAQYezqknsntSzmCUlQYuYJldcT@crossover.proxy.rlwy.net:44255/railway'
});

async function testFullRoleCreation() {
    try {
        console.log('🧪 اختبار كامل: إنشاء دور جديد\n');
        
        // السيناريو 1: دور بجميع البيانات
        console.log('1️⃣ إنشاء دور بجميع البيانات:');
        const role1 = {
            code: 'BRANCH_SUPERVISOR',
            title_ar: 'مشرف فرع',
            title_en: 'Branch Supervisor',
            description: 'مشرف يدير العمليات اليومية للفرع',
            level: 'OPERATIONAL',
            hierarchy_level: 20,
            min_approval_limit: 0,
            max_approval_limit: 25000
        };
        
        const result1 = await pool.query(`
            INSERT INTO roles (
                name, name_ar, job_title_ar, job_title_en, description,
                level, hierarchy_level, min_approval_limit, max_approval_limit,
                is_active
            ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, true)
            RETURNING id, name, job_title_ar, hierarchy_level
        `, [
            role1.code,
            role1.code,
            role1.title_ar,
            role1.title_en,
            role1.description,
            role1.level,
            role1.hierarchy_level,
            role1.min_approval_limit,
            role1.max_approval_limit
        ]);
        
        console.log(`   ✅ تم إنشاء: ${result1.rows[0].job_title_ar} (ID: ${result1.rows[0].id})`);
        
        // السيناريو 2: دور بدون title_en
        console.log('\n2️⃣ إنشاء دور بدون title_en:');
        const role2 = {
            code: 'SALES_COORDINATOR',
            title_ar: 'منسق مبيعات',
            hierarchy_level: 18
        };
        
        const result2 = await pool.query(`
            INSERT INTO roles (
                name, name_ar, job_title_ar, job_title_en, description,
                level, hierarchy_level, min_approval_limit, max_approval_limit,
                is_active
            ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, true)
            RETURNING id, name, job_title_ar, hierarchy_level
        `, [
            role2.code,
            role2.code,
            role2.title_ar,
            role2.title_ar,  // استخدام title_ar كبديل
            null,
            'OPERATIONAL',
            role2.hierarchy_level,
            0,
            null
        ]);
        
        console.log(`   ✅ تم إنشاء: ${result2.rows[0].job_title_ar} (ID: ${result2.rows[0].id})`);
        
        // التحقق من الأدوار المُنشأة
        console.log('\n📊 الأدوار المُنشأة:');
        const check = await pool.query(`
            SELECT id, name, name_ar, job_title_ar, hierarchy_level, is_active
            FROM roles
            WHERE name IN ($1, $2)
            ORDER BY hierarchy_level DESC
        `, [role1.code, role2.code]);
        
        check.rows.forEach(role => {
            console.log(`   - ${role.job_title_ar} | Level: ${role.hierarchy_level} | Active: ${role.is_active}`);
        });
        
        // حذف الأدوار التجريبية
        await pool.query(`DELETE FROM roles WHERE name IN ($1, $2)`, [role1.code, role2.code]);
        console.log('\n🗑️  تم حذف الأدوار التجريبية');
        
        console.log('\n✅ جميع الاختبارات نجحت!');
        
    } catch (error) {
        console.error('❌ خطأ:', error.message);
    } finally {
        await pool.end();
    }
}

testFullRoleCreation();
