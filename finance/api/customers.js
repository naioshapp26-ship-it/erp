/**
 * 👥 Customers API
 * Page 7 of Accounting System
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

function normalizeRiskFactors(input) {
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

function normalizeBoolean(value) {
    if (typeof value === 'boolean') return value;
    if (typeof value === 'string') return value === 'true' || value === '1';
    if (typeof value === 'number') return value === 1;
    return !!value;
}

function readText(value, fallback = '') {
    if (value === undefined || value === null) return fallback;
    return typeof value === 'string' ? value.trim() : String(value).trim();
}

function validateRequiredCustomerFields(fields) {
    const missing = [];
    const requiredKeys = [
        'customer_name_ar',
        'tax_number',
        'mobile',
        'mobile_secondary',
        'email',
        'email_secondary',
        'company_name',
        'website',
        'street_name',
        'city',
        'district',
        'building_number',
        'postal_code',
        'country'
    ];

    requiredKeys.forEach((key) => {
        if (!fields[key]) missing.push(key);
    });

    if (!fields.shipping_copy_billing) {
        ['shipping_street_name', 'shipping_city', 'shipping_region', 'shipping_postal_code'].forEach((key) => {
            if (!fields[key]) missing.push(key);
        });
    }

    return missing;
}

async function generateNextNumber(prefix) {
    const result = await pool.query(
        `SELECT customer_code FROM finance_customers WHERE customer_code LIKE $1 ORDER BY customer_code DESC LIMIT 1`,
        [`${prefix}%`]
    );
    if (!result.rows.length) {
        return `${prefix}0001`;
    }
    const lastNumber = result.rows[0].customer_code || '';
    const numPart = parseInt(lastNumber.replace(prefix, ''), 10) || 0;
    const nextNum = numPart + 1;
    return `${prefix}${nextNum.toString().padStart(4, '0')}`;
}

/**
 * Get all customers
 */
async function getCustomers(req, res) {
    const entity_id = resolveScopedEntityId(req, req.query.entity_id);

    try {
        console.log(`👥 Fetching customers for entity ${entity_id}...`);

        const query = `
            SELECT 
                customer_id,
                customer_code,
                customer_name_ar,
                customer_name_en,
                customer_type,
                company_name,
                website,
                email,
                email_secondary,
                phone,
                mobile,
                mobile_secondary,
                address,
                city,
                country,
                street_name,
                postal_code,
                building_number,
                district,
                national_address_number,
                short_address,
                shipping_copy_billing,
                shipping_street_name,
                shipping_city,
                shipping_region,
                shipping_postal_code,
                tax_number,
                commercial_registration,
                credit_limit,
                credit_period_days,
                payment_terms,
                risk_score,
                risk_level,
                risk_factors,
                entity_id,
                is_active,
                is_blocked,
                blocked_reason,
                created_at
            FROM finance_customers
            WHERE ${buildEntityScopeCondition(getRequestEntityContext(req), 'entity_id', 1)}
            ORDER BY customer_id DESC
        `;

        const result = await pool.query(query, [entity_id]);
        const customers = result.rows;

        const summary = {
            total_customers: customers.length,
            active_customers: customers.filter(c => c.is_active && !c.is_blocked).length,
            blocked_customers: customers.filter(c => c.is_blocked).length,
            total_credit_limit: customers.reduce((sum, c) => sum + parseFloat(c.credit_limit || 0), 0)
        };

        console.log(`✅ Found ${customers.length} customers`);

        res.json({
            success: true,
            customers,
            summary
        });
    } catch (error) {
        console.error('❌ Error fetching customers:', error);
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
}

/**
 * Create customer
 */
async function createCustomer(req, res) {
    const {
        entity_id,
        customer_code,
        customer_name_ar,
        customer_name_en,
        customer_type,
        company_name,
        website,
        email,
        email_secondary,
        phone,
        mobile,
        mobile_secondary,
        address,
        city,
        country,
        street_name,
        postal_code,
        building_number,
        district,
        national_address_number,
        short_address,
        shipping_copy_billing,
        shipping_street_name,
        shipping_city,
        shipping_region,
        shipping_postal_code,
        tax_number,
        commercial_registration,
        credit_limit,
        credit_period_days,
        payment_terms,
        risk_score,
        risk_level,
        risk_factors,
        is_active,
        is_blocked,
        blocked_reason
    } = req.body || {};

    const resolvedEntityId = resolveScopedEntityId(req, entity_id);

    if (!resolvedEntityId) {
        return res.status(400).json({
            success: false,
            error: 'Missing required fields: entity_id'
        });
    }

    const normalized = {
        customer_name_ar: readText(customer_name_ar),
        customer_name_en: readText(customer_name_en) || null,
        customer_type: readText(customer_type) || 'COMPANY',
        company_name: readText(company_name),
        website: readText(website),
        email: readText(email),
        email_secondary: readText(email_secondary),
        phone: readText(phone) || null,
        mobile: readText(mobile),
        mobile_secondary: readText(mobile_secondary),
        address: readText(address) || null,
        city: readText(city),
        country: readText(country),
        street_name: readText(street_name),
        postal_code: readText(postal_code),
        building_number: readText(building_number),
        district: readText(district),
        national_address_number: readText(national_address_number) || null,
        short_address: readText(short_address) || null,
        shipping_copy_billing: normalizeBoolean(shipping_copy_billing),
        shipping_street_name: readText(shipping_street_name),
        shipping_city: readText(shipping_city),
        shipping_region: readText(shipping_region),
        shipping_postal_code: readText(shipping_postal_code),
        tax_number: readText(tax_number),
        commercial_registration: readText(commercial_registration) || null,
        credit_limit,
        credit_period_days,
        payment_terms: readText(payment_terms) || null,
        risk_score,
        risk_level: readText(risk_level) || null,
        risk_factors,
        is_active,
        is_blocked,
        blocked_reason: readText(blocked_reason) || null
    };

    if (normalized.shipping_copy_billing) {
        normalized.shipping_street_name = normalized.street_name;
        normalized.shipping_city = normalized.city;
        normalized.shipping_region = normalized.district;
        normalized.shipping_postal_code = normalized.postal_code;
    }

    const missingFields = validateRequiredCustomerFields(normalized);
    if (missingFields.length) {
        return res.status(400).json({
            success: false,
            error: `Missing required fields: ${missingFields.join(', ')}`
        });
    }

    const normalizedRiskFactors = normalizeRiskFactors(risk_factors);

    const insertOnce = async (code) => {
        return pool.query(
            `INSERT INTO finance_customers
             (customer_code, customer_name_ar, customer_name_en, customer_type, company_name, website, email, email_secondary,
              phone, mobile, mobile_secondary, address, city, country, tax_number, commercial_registration, credit_limit,
              credit_period_days, payment_terms, risk_score, risk_level, risk_factors, entity_id, is_active, is_blocked,
              blocked_reason, created_at, updated_at, created_by, street_name, postal_code, building_number, district,
              national_address_number, short_address, shipping_copy_billing, shipping_street_name, shipping_city,
              shipping_region, shipping_postal_code)
             VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20,$21,$22,$23,$24,$25,$26,NOW(),NOW(),$27,$28,$29,$30,$31,$32,$33,$34,$35,$36,$37)
             RETURNING *`,
            [
                code,
                normalized.customer_name_ar,
                normalized.customer_name_en,
                normalized.customer_type,
                normalized.company_name,
                normalized.website,
                normalized.email,
                normalized.email_secondary,
                normalized.phone,
                normalized.mobile,
                normalized.mobile_secondary,
                normalized.address,
                normalized.city,
                normalized.country,
                normalized.tax_number,
                normalized.commercial_registration,
                normalized.credit_limit ?? null,
                normalized.credit_period_days ?? null,
                normalized.payment_terms,
                normalized.risk_score ?? null,
                normalized.risk_level,
                normalizedRiskFactors ? JSON.stringify(normalizedRiskFactors) : null,
                resolvedEntityId,
                normalized.is_active !== false,
                !!normalized.is_blocked,
                normalized.blocked_reason,
                'SYSTEM',
                normalized.street_name,
                normalized.postal_code,
                normalized.building_number,
                normalized.district,
                normalized.national_address_number,
                normalized.short_address,
                normalized.shipping_copy_billing,
                normalized.shipping_street_name,
                normalized.shipping_city,
                normalized.shipping_region,
                normalized.shipping_postal_code
            ]
        );
    };

    try {
        let result;
        let lastError;

        const candidates = [];
        if (customer_code && customer_code.trim().length) {
            candidates.push(customer_code.trim());
        }
        candidates.push(await generateNextNumber('CUST'));
        candidates.push(`CUST-${Date.now()}-${Math.floor(Math.random() * 10000)}`);

        for (const code of candidates) {
            try {
                result = await insertOnce(code);
                break;
            } catch (err) {
                lastError = err;
                if (err.code === '23505') continue;
                throw err;
            }
        }

        if (!result) {
            throw lastError;
        }

        res.json({ success: true, customer: result.rows[0] });
    } catch (error) {
        console.error('❌ Error creating customer:', error);
        res.status(500).json({ success: false, error: error.message });
    }
}

/**
 * Update customer
 */
async function updateCustomer(req, res) {
    const { customer_id } = req.params;
    const {
        entity_id,
        customer_code,
        customer_name_ar,
        customer_name_en,
        customer_type,
        company_name,
        website,
        email,
        email_secondary,
        phone,
        mobile,
        mobile_secondary,
        address,
        city,
        country,
        street_name,
        postal_code,
        building_number,
        district,
        national_address_number,
        short_address,
        shipping_copy_billing,
        shipping_street_name,
        shipping_city,
        shipping_region,
        shipping_postal_code,
        tax_number,
        commercial_registration,
        credit_limit,
        credit_period_days,
        payment_terms,
        risk_score,
        risk_level,
        risk_factors,
        is_active,
        is_blocked,
        blocked_reason
    } = req.body || {};

    const resolvedEntityId = resolveScopedEntityId(req, entity_id || req.query.entity_id);

    if (!customer_id || !resolvedEntityId) {
        return res.status(400).json({
            success: false,
            error: 'Missing required fields: customer_id, entity_id'
        });
    }

    try {
        const existing = await pool.query('SELECT customer_id, entity_id, customer_code FROM finance_customers WHERE customer_id = $1', [customer_id]);
        if (!existing.rows.length) {
            return res.status(404).json({ success: false, error: 'Customer not found' });
        }
        if (existing.rows[0].entity_id && existing.rows[0].entity_id !== resolvedEntityId) {
            return res.status(403).json({ success: false, error: 'لا يمكن تعديل عميل كيان آخر' });
        }

        const normalizedRiskFactors = normalizeRiskFactors(risk_factors);
        const existingRow = existing.rows[0];
        const normalized = {
            customer_name_ar: readText(customer_name_ar, existingRow.customer_name_ar),
            customer_name_en: readText(customer_name_en, existingRow.customer_name_en || '') || null,
            customer_type: readText(customer_type, existingRow.customer_type || 'COMPANY') || 'COMPANY',
            company_name: readText(company_name, existingRow.company_name || ''),
            website: readText(website, existingRow.website || ''),
            email: readText(email, existingRow.email || ''),
            email_secondary: readText(email_secondary, existingRow.email_secondary || ''),
            phone: readText(phone, existingRow.phone || '') || null,
            mobile: readText(mobile, existingRow.mobile || ''),
            mobile_secondary: readText(mobile_secondary, existingRow.mobile_secondary || ''),
            address: readText(address, existingRow.address || '') || null,
            city: readText(city, existingRow.city || ''),
            country: readText(country, existingRow.country || ''),
            street_name: readText(street_name, existingRow.street_name || ''),
            postal_code: readText(postal_code, existingRow.postal_code || ''),
            building_number: readText(building_number, existingRow.building_number || ''),
            district: readText(district, existingRow.district || ''),
            national_address_number: readText(national_address_number, existingRow.national_address_number || '') || null,
            short_address: readText(short_address, existingRow.short_address || '') || null,
            shipping_copy_billing: shipping_copy_billing === undefined ? normalizeBoolean(existingRow.shipping_copy_billing) : normalizeBoolean(shipping_copy_billing),
            shipping_street_name: readText(shipping_street_name, existingRow.shipping_street_name || ''),
            shipping_city: readText(shipping_city, existingRow.shipping_city || ''),
            shipping_region: readText(shipping_region, existingRow.shipping_region || ''),
            shipping_postal_code: readText(shipping_postal_code, existingRow.shipping_postal_code || ''),
            tax_number: readText(tax_number, existingRow.tax_number || ''),
            commercial_registration: readText(commercial_registration, existingRow.commercial_registration || '') || null,
            credit_limit: credit_limit ?? existingRow.credit_limit,
            credit_period_days: credit_period_days ?? existingRow.credit_period_days,
            payment_terms: readText(payment_terms, existingRow.payment_terms || '') || null,
            risk_score: risk_score ?? existingRow.risk_score,
            risk_level: readText(risk_level, existingRow.risk_level || '') || null,
            is_active: is_active === undefined ? existingRow.is_active : is_active,
            is_blocked: is_blocked === undefined ? existingRow.is_blocked : is_blocked,
            blocked_reason: readText(blocked_reason, existingRow.blocked_reason || '') || null
        };

        if (normalized.shipping_copy_billing) {
            normalized.shipping_street_name = normalized.street_name;
            normalized.shipping_city = normalized.city;
            normalized.shipping_region = normalized.district;
            normalized.shipping_postal_code = normalized.postal_code;
        }

        const missingFields = validateRequiredCustomerFields(normalized);
        if (missingFields.length) {
            return res.status(400).json({
                success: false,
                error: `Missing required fields: ${missingFields.join(', ')}`
            });
        }
        const effectiveCode = customer_code && customer_code.trim().length
            ? customer_code.trim()
            : existing.rows[0].customer_code;

        if (!effectiveCode) {
            return res.status(400).json({ success: false, error: 'customer_code مفقود' });
        }
        const result = await pool.query(
            `UPDATE finance_customers
             SET customer_code = $1,
                 customer_name_ar = $2,
                 customer_name_en = $3,
                 customer_type = $4,
                 company_name = $5,
                 website = $6,
                 email = $7,
                 email_secondary = $8,
                 phone = $9,
                 mobile = $10,
                 mobile_secondary = $11,
                 address = $12,
                 city = $13,
                 country = $14,
                 tax_number = $15,
                 commercial_registration = $16,
                 credit_limit = $17,
                 credit_period_days = $18,
                 payment_terms = $19,
                 risk_score = $20,
                 risk_level = $21,
                 risk_factors = $22,
                 is_active = $23,
                 is_blocked = $24,
                 blocked_reason = $25,
                 street_name = $26,
                 postal_code = $27,
                 building_number = $28,
                 district = $29,
                 national_address_number = $30,
                 short_address = $31,
                 shipping_copy_billing = $32,
                 shipping_street_name = $33,
                 shipping_city = $34,
                 shipping_region = $35,
                 shipping_postal_code = $36,
                 updated_at = NOW()
             WHERE customer_id = $37
             RETURNING *`,
            [
                effectiveCode,
                normalized.customer_name_ar,
                normalized.customer_name_en,
                normalized.customer_type,
                normalized.company_name,
                normalized.website,
                normalized.email,
                normalized.email_secondary,
                normalized.phone,
                normalized.mobile,
                normalized.mobile_secondary,
                normalized.address,
                normalized.city,
                normalized.country,
                normalized.tax_number,
                normalized.commercial_registration,
                normalized.credit_limit ?? null,
                normalized.credit_period_days ?? null,
                normalized.payment_terms,
                normalized.risk_score ?? null,
                normalized.risk_level,
                normalizedRiskFactors ? JSON.stringify(normalizedRiskFactors) : null,
                normalized.is_active !== false,
                !!normalized.is_blocked,
                normalized.blocked_reason,
                normalized.street_name,
                normalized.postal_code,
                normalized.building_number,
                normalized.district,
                normalized.national_address_number,
                normalized.short_address,
                normalized.shipping_copy_billing,
                normalized.shipping_street_name,
                normalized.shipping_city,
                normalized.shipping_region,
                normalized.shipping_postal_code,
                customer_id
            ]
        );

        res.json({ success: true, customer: result.rows[0] });
    } catch (error) {
        console.error('❌ Error updating customer:', error);
        res.status(500).json({ success: false, error: error.message });
    }
}

/**
 * Delete customer (soft delete)
 */
async function deleteCustomer(req, res) {
    const { customer_id } = req.params;
    const entity_id = resolveScopedEntityId(req, req.query.entity_id);

    if (!customer_id || !entity_id) {
        return res.status(400).json({ success: false, error: 'customer_id and entity_id are required' });
    }

    try {
        const existing = await pool.query(
            'SELECT customer_id, entity_id FROM finance_customers WHERE customer_id = $1 AND entity_id = $2',
            [customer_id, entity_id]
        );
        if (!existing.rows.length) {
            return res.status(404).json({ success: false, error: 'Customer not found' });
        }

        try {
            const deleted = await pool.query(
                'DELETE FROM finance_customers WHERE customer_id = $1 AND entity_id = $2 RETURNING customer_id',
                [customer_id, entity_id]
            );
            if (!deleted.rows.length) {
                return res.status(404).json({ success: false, error: 'Customer not found' });
            }
            return res.json({ success: true, message: 'تم حذف العميل' });
        } catch (deleteError) {
            await pool.query(
                `UPDATE finance_customers
                 SET is_active = false,
                     updated_at = NOW()
                 WHERE customer_id = $1 AND entity_id = $2`,
                [customer_id, entity_id]
            );
            return res.json({ success: true, message: 'تم تعطيل العميل لوجود ارتباطات' });
        }
    } catch (error) {
        console.error('❌ Error deleting customer:', error);
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
    getCustomers,
    createCustomer,
    updateCustomer,
    deleteCustomer,
    testConnection
};
