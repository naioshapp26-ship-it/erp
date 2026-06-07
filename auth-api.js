const express = require('express');
const bcrypt = require('bcryptjs');
const crypto = require('crypto');
const { rateLimit } = require('express-rate-limit');
require('dotenv').config();
const db = require('./db');

const router = express.Router();
const pool = db.pool;
const AUTH_API_BUILD = '2026-05-23-login-debug-v2';
const DEBUG_AUTH = process.env.DEBUG_AUTH === '1' || process.env.DEBUG_AUTH === 'true';

const logAuth = (scope, message, extra) => {
    const suffix = extra !== undefined ? ` ${JSON.stringify(extra)}` : '';
    console.error(`[auth-api:${scope}] ${message}${suffix}`);
};

const sendAuthJsonError = (res, status, payload) => {
    if (res.headersSent) return;
    res.status(status).json({
        success: false,
        apiBuild: AUTH_API_BUILD,
        ...payload
    });
};

router.use((req, res, next) => {
    res.setHeader('X-Auth-Api-Build', AUTH_API_BUILD);
    next();
});

const VALID_ACCOUNT_TYPES = ['BRANCH', 'OFFICE', 'INCUBATOR', 'PLATFORM'];
const ENTITY_ID_PREFIXES = {
    BRANCH: 'BR',
    OFFICE: 'OFF',
    INCUBATOR: 'INC',
    PLATFORM: 'PLT'
};
const ENTITY_ID_SUFFIX_LENGTH = 6;
const ENTITY_ID_SUFFIX_MAX = 10 ** ENTITY_ID_SUFFIX_LENGTH;
const MAX_ENTITY_ID_GENERATION_ATTEMPTS = 10;
const SESSION_TTL_MS = 24 * 60 * 60 * 1000;

const parseCookies = (cookieHeader = '') => {
    return String(cookieHeader || '').split(';').reduce((acc, part) => {
        const [key, ...rest] = part.trim().split('=');
        if (!key) return acc;
        acc[key] = decodeURIComponent(rest.join('=') || '');
        return acc;
    }, {});
};

const getRequestToken = (req) => {
    const authHeader = req.headers.authorization || '';
    if (authHeader.toLowerCase().startsWith('bearer ')) {
        return authHeader.slice(7).trim();
    }
    return parseCookies(req.headers.cookie || '').authToken || '';
};

const isSecureRequest = (req) => {
    return req.secure || String(req.headers['x-forwarded-proto'] || '').split(',')[0].trim() === 'https';
};

const setAuthCookie = (req, res, token, maxAge = SESSION_TTL_MS) => {
    res.cookie('authToken', token, {
        httpOnly: false,
        secure: isSecureRequest(req),
        sameSite: 'lax',
        path: '/',
        maxAge
    });
};

const clearAuthCookie = (res) => {
    res.clearCookie('authToken', { path: '/', sameSite: 'lax' });
};

const registerRateLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 10,
    standardHeaders: true,
    legacyHeaders: false,
    message: {
        success: false,
        message: 'تم تجاوز عدد محاولات إنشاء الحساب مؤقتاً، يرجى المحاولة لاحقاً'
    }
});

async function ensureRegistrationSchema(client) {
    await client.query(`
        CREATE TABLE IF NOT EXISTS user_credentials (
            id SERIAL PRIMARY KEY,
            user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
            username VARCHAR(100) UNIQUE NOT NULL,
            password_hash VARCHAR(255) NOT NULL,
            is_active BOOLEAN DEFAULT true,
            last_login TIMESTAMP,
            failed_attempts INTEGER DEFAULT 0,
            locked_until TIMESTAMP,
            created_at TIMESTAMP DEFAULT NOW(),
            updated_at TIMESTAMP DEFAULT NOW(),
            UNIQUE(user_id)
        );

        CREATE TABLE IF NOT EXISTS user_sessions (
            id SERIAL PRIMARY KEY,
            user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
            session_token VARCHAR(255) UNIQUE NOT NULL,
            ip_address VARCHAR(50),
            user_agent TEXT,
            expires_at TIMESTAMP NOT NULL,
            created_at TIMESTAMP DEFAULT NOW(),
            last_activity TIMESTAMP DEFAULT NOW()
        );

        CREATE INDEX IF NOT EXISTS idx_credentials_username ON user_credentials(username);
        CREATE INDEX IF NOT EXISTS idx_credentials_user_id ON user_credentials(user_id);
        CREATE INDEX IF NOT EXISTS idx_sessions_token ON user_sessions(session_token);
        CREATE INDEX IF NOT EXISTS idx_sessions_user_id ON user_sessions(user_id);
    `);

    try {
        await client.query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS job_title VARCHAR(255)`);
    } catch (error) {
        console.warn('⚠️  تعذر تعديل جدول users (قد يكون مستورداً من Railway):', error.message);
    }
}

async function comparePassword(password, passwordHash) {
    if (!passwordHash || typeof passwordHash !== 'string') {
        return false;
    }
    try {
        return await bcrypt.compare(password, passwordHash);
    } catch (error) {
        console.warn('⚠️  فشل التحقق من كلمة المرور (hash غير صالح):', error.message);
        return false;
    }
}

async function getRegistrationRoles(client) {
    const result = await client.query(`
        SELECT
            id,
            name AS code,
            COALESCE(NULLIF(job_title_ar, ''), NULLIF(name_ar, ''), name) AS title_ar,
            COALESCE(NULLIF(job_title_en, ''), name) AS title_en,
            hierarchy_level
        FROM roles
        WHERE COALESCE(is_active, true) = true
        ORDER BY COALESCE(hierarchy_level, 999), COALESCE(NULLIF(job_title_ar, ''), NULLIF(name_ar, ''), name)
    `);

    return result.rows;
}

function isValidEmail(email) {
    if (!email || email.length > 254) return false;
    const parts = String(email).split('@');
    if (parts.length !== 2) return false;

    const [localPart, domainPart] = parts;
    if (!localPart || !domainPart) return false;
    if (domainPart.startsWith('.') || domainPart.endsWith('.') || domainPart.includes('..')) return false;

    const domainSegments = domainPart.split('.');
    if (domainSegments.length < 2 || domainSegments.some(segment => !segment)) return false;

    return true;
}

async function createRegistrationEntity(client, tenantType, entityName) {
    const prefix = ENTITY_ID_PREFIXES[tenantType];

    if (!prefix) {
        throw new Error(`Unsupported tenant type for entity creation: ${tenantType}`);
    }

    for (let attempt = 0; attempt < MAX_ENTITY_ID_GENERATION_ATTEMPTS; attempt += 1) {
        const suffix = String(crypto.randomInt(0, ENTITY_ID_SUFFIX_MAX)).padStart(ENTITY_ID_SUFFIX_LENGTH, '0');
        const entityId = `${prefix}${suffix}`;
        const result = await client.query(`
            INSERT INTO entities (id, name, type, status, users_count, created_at, updated_at)
            VALUES ($1, $2, $3, 'Active', 1, NOW(), NOW())
            ON CONFLICT (id) DO NOTHING
            RETURNING id
        `, [entityId, entityName, tenantType]);

        if (result.rows.length > 0) {
            return result.rows[0].id;
        }
    }

    throw new Error('Failed to generate a unique entity identifier');
}

async function getAllowedOfficePages(client, tenantType, entityId, officeId) {
    let allowedOfficePages = [];

    if (tenantType && tenantType !== 'HQ') {
        try {
            if (tenantType === 'OFFICE') {
                const officeResult = await client.query(`
                    SELECT id, entity_id
                    FROM offices
                    WHERE entity_id = $1 OR id::text = $1 OR id = $2
                    LIMIT 1
                `, [entityId, officeId]);

                const resolvedOfficeId = officeResult.rows.length > 0 ? officeResult.rows[0].id : null;
                await client.query(`
                    CREATE TABLE IF NOT EXISTS office_page_access (
                        id SERIAL PRIMARY KEY,
                        office_id INTEGER REFERENCES offices(id) ON DELETE CASCADE,
                        office_entity_id VARCHAR(120),
                        page_key VARCHAR(120) NOT NULL,
                        created_at TIMESTAMP DEFAULT NOW()
                    )
                `);
                await client.query(`ALTER TABLE office_page_access ALTER COLUMN office_id DROP NOT NULL`);
                await client.query(`ALTER TABLE office_page_access ADD COLUMN IF NOT EXISTS office_entity_id VARCHAR(120)`);
                await client.query(`
                    CREATE UNIQUE INDEX IF NOT EXISTS office_page_access_office_page_key_idx
                    ON office_page_access (office_id, page_key)
                `);
                await client.query(`
                    CREATE UNIQUE INDEX IF NOT EXISTS office_page_access_entity_page_key_idx
                    ON office_page_access (office_entity_id, page_key)
                `);
                const pagesResult = await client.query(`
                    SELECT page_key
                    FROM office_page_access
                    WHERE ($1::INTEGER IS NOT NULL AND office_id = $1)
                       OR office_entity_id = $2
                    ORDER BY page_key
                `, [resolvedOfficeId, entityId]);
                allowedOfficePages = pagesResult.rows.map(row => row.page_key);
            }

            if (allowedOfficePages.length === 0) {
                await client.query(`
                    CREATE TABLE IF NOT EXISTS account_type_sidebar_config (
                        id SERIAL PRIMARY KEY,
                        account_type VARCHAR(50) NOT NULL,
                        page_key VARCHAR(120) NOT NULL,
                        created_at TIMESTAMP DEFAULT NOW(),
                        UNIQUE(account_type, page_key)
                    )
                `);
                const typePages = await client.query(
                    'SELECT page_key FROM account_type_sidebar_config WHERE account_type = $1 ORDER BY page_key',
                    [tenantType]
                );
                allowedOfficePages = typePages.rows.map(row => row.page_key);
            }
        } catch (error) {
            console.log('⚠️  لم يتم تحميل صلاحيات صفحات الحساب:', error.message);
        }
    }

    return allowedOfficePages;
}

async function buildAuthenticatedResponse(client, user, req) {
    const sessionToken = crypto.randomBytes(32).toString('hex');
    const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000);

    try {
        await client.query(`
            INSERT INTO user_sessions (user_id, session_token, ip_address, user_agent, expires_at)
            VALUES ($1, $2, $3, $4, $5)
        `, [
            user.id,
            sessionToken,
            req.ip || req.connection?.remoteAddress,
            req.headers['user-agent'],
            expiresAt
        ]);
    } catch (sessionError) {
        logAuth('session', sessionError.message);
        throw new Error(`تعذر إنشاء الجلسة: ${sessionError.message}`);
    }

    let rolesRows = [];
    try {
        const rolesResult = await client.query(`
            SELECT r.id, r.name, r.name_ar, r.job_title_ar, r.hierarchy_level
            FROM user_roles ur
            JOIN roles r ON ur.role_id = r.id
            WHERE ur.user_id = $1 AND ur.is_active = true
        `, [user.id]);
        rolesRows = rolesResult.rows;
    } catch (rolesError) {
        logAuth('roles', rolesError.message);
    }

    const allowedOfficePages = await getAllowedOfficePages(client, user.tenant_type, user.entity_id, user.office_id);
    let menuRows = [];
    try {
        const menuResult = await client.query(`
            SELECT id, title_ar, title_en, icon, url, display_order
            FROM sidebar_menu
            WHERE is_active = true
              AND (required_entity_id IS NULL OR required_entity_id = $1)
            ORDER BY display_order
        `, [user.entity_id]);
        menuRows = menuResult.rows;
    } catch (menuError) {
        console.warn('⚠️  تعذر تحميل القائمة الجانبية:', menuError.message);
    }

    return {
        user: {
            id: user.id,
            name: user.name,
            email: user.email,
            entity_id: user.entity_id,
            entity_name: user.entity_name,
            role: user.role,
            job_title: user.job_title,
            tenant_type: user.tenant_type,
            office_id: user.office_id || null,
            allowed_pages: allowedOfficePages
        },
        roles: rolesRows,
        menu: menuRows.map(item => ({
            id: item.id,
            title: item.title_ar,
            titleEn: item.title_en,
            icon: item.icon,
            url: item.url,
            order: item.display_order
        })),
        session: {
            token: sessionToken,
            expires_at: expiresAt
        }
    };
}

// ============================================
// 0. بيانات إنشاء الحساب - GET /api/auth/register-options
// ============================================
router.get('/register-options', async (req, res) => {
    const client = await pool.connect();

    try {
        await ensureRegistrationSchema(client);
        const roles = await getRegistrationRoles(client);

        res.json({
            success: true,
            roles,
            office_types: VALID_ACCOUNT_TYPES.map(type => ({
                value: type,
                label: {
                    BRANCH: 'فرع',
                    OFFICE: 'مكتب',
                    INCUBATOR: 'حاضنة',
                    PLATFORM: 'منصة'
                }[type] || type
            }))
        });
    } catch (error) {
        console.error('Register options error:', error);
        res.status(500).json({
            success: false,
            message: 'تعذر تحميل بيانات إنشاء الحساب'
        });
    } finally {
        client.release();
    }
});

// ============================================
// 0.1 إنشاء حساب - POST /api/auth/register
// ============================================
router.post('/register', registerRateLimiter, async (req, res) => {
    const client = await pool.connect();

    try {
        const {
            name,
            email,
            password,
            confirm_password,
            job_title_code,
            tenant_type,
            entity_name
        } = req.body;

        const normalizedName = String(name || '').trim();
        const normalizedEmail = String(email || '').trim().toLowerCase();
        const normalizedEntityName = String(entity_name || '').trim();
        const normalizedTenantType = String(tenant_type || '').trim().toUpperCase();
        const normalizedJobTitleCode = String(job_title_code || '').trim();

        if (!normalizedName || !normalizedEmail || !password || !confirm_password || !normalizedJobTitleCode || !normalizedTenantType || !normalizedEntityName) {
            return res.status(400).json({
                success: false,
                message: 'يرجى تعبئة جميع الحقول المطلوبة'
            });
        }

        if (!isValidEmail(normalizedEmail)) {
            return res.status(400).json({
                success: false,
                message: 'يرجى إدخال بريد إلكتروني صحيح'
            });
        }

        if (!VALID_ACCOUNT_TYPES.includes(normalizedTenantType)) {
            return res.status(400).json({
                success: false,
                message: 'نوع الحساب غير صالح'
            });
        }

        if (password.length < 8) {
            return res.status(400).json({
                success: false,
                message: 'يجب أن تكون كلمة المرور 8 أحرف على الأقل'
            });
        }

        if (password !== confirm_password) {
            return res.status(400).json({
                success: false,
                message: 'كلمتا المرور غير متطابقتين'
            });
        }

        await client.query('BEGIN');
        await ensureRegistrationSchema(client);

        const existingUser = await client.query(
            'SELECT id FROM users WHERE LOWER(email) = LOWER($1) LIMIT 1',
            [normalizedEmail]
        );

        if (existingUser.rows.length > 0) {
            await client.query('ROLLBACK');
            return res.status(409).json({
                success: false,
                message: 'هذا البريد الإلكتروني مسجل بالفعل'
            });
        }

        const roleResult = await client.query(`
            SELECT
                name AS code,
                COALESCE(NULLIF(job_title_ar, ''), NULLIF(name_ar, ''), name) AS title_ar
            FROM roles
            WHERE (name = $1 OR id::text = $1)
              AND COALESCE(is_active, true) = true
            LIMIT 1
        `, [normalizedJobTitleCode]);

        if (roleResult.rows.length === 0) {
            await client.query('ROLLBACK');
            return res.status(400).json({
                success: false,
                message: 'المسمى الوظيفي غير صالح'
            });
        }

        const selectedRole = roleResult.rows[0];
        const passwordHash = await bcrypt.hash(password, 10);
        const entityId = await createRegistrationEntity(client, normalizedTenantType, normalizedEntityName);

        const userResult = await client.query(`
            INSERT INTO users (
                name,
                email,
                role,
                tenant_type,
                entity_id,
                entity_name,
                is_active,
                job_title
            )
            VALUES ($1, $2, $3, $4, $5, $6, true, $7)
            RETURNING id, name, email, role, tenant_type, entity_id, entity_name, job_title, is_active, created_at
        `, [
            normalizedName,
            normalizedEmail,
            selectedRole.code,
            normalizedTenantType,
            entityId,
            normalizedEntityName,
            selectedRole.title_ar
        ]);

        await client.query(`
            INSERT INTO user_credentials (user_id, username, password_hash, is_active, failed_attempts)
            VALUES ($1, $2, $3, true, 0)
        `, [userResult.rows[0].id, normalizedEmail, passwordHash]);

        try {
            await client.query(`
                INSERT INTO audit_log (
                    entity_type,
                    entity_reference_id,
                    action_type,
                    user_name,
                    description
                ) VALUES ($1, $2, $3, $4, $5)
            `, [
                'users',
                String(userResult.rows[0].id),
                'REGISTER',
                normalizedEmail,
                JSON.stringify({
                    tenant_type: normalizedTenantType,
                    entity_name: normalizedEntityName,
                    job_title: selectedRole.title_ar,
                    role_code: selectedRole.code
                })
            ]);
        } catch (auditError) {
            console.log('⚠️  لم يتم تسجيل إنشاء الحساب في audit log:', auditError.message);
        }

        const authData = await buildAuthenticatedResponse(client, {
            ...userResult.rows[0],
            office_id: null
        }, req);

        await client.query('COMMIT');

        res.status(201).json({
            success: true,
            message: 'تم إنشاء الحساب وتسجيل الدخول بنجاح',
            data: authData
        });
    } catch (error) {
        await client.query('ROLLBACK');
        console.error('Register error:', error);
        res.status(error.code === '23505' ? 409 : 500).json({
            success: false,
            message: error.code === '23505' ? 'هذا البريد الإلكتروني مسجل بالفعل' : 'حدث خطأ أثناء إنشاء الحساب'
        });
    } finally {
        client.release();
    }
});

// ============================================
// 0.9 فحص الاتصال - GET /api/auth/ping
// ============================================
router.get('/ping', async (req, res) => {
    try {
        const result = await pool.query('SELECT NOW() AS now');
        res.json({
            success: true,
            apiBuild: AUTH_API_BUILD,
            database: 'connected',
            hasDatabaseUrl: Boolean(process.env.DATABASE_URL),
            time: result.rows[0].now
        });
    } catch (error) {
        logAuth('ping', error.message, { code: error.code });
        sendAuthJsonError(res, 500, {
            message: 'فشل الاتصال بقاعدة البيانات',
            detail: error.message,
            code: error.code,
            stack: DEBUG_AUTH ? error.stack : undefined
        });
    }
});

// ============================================
// 0.95 تشخيص كامل - GET /api/auth/debug
// ============================================
router.get('/debug', async (req, res) => {
    const report = {
        success: true,
        apiBuild: AUTH_API_BUILD,
        nodeVersion: process.version,
        hasDatabaseUrl: Boolean(process.env.DATABASE_URL),
        databaseSsl: process.env.DATABASE_SSL,
        steps: []
    };

    const addStep = (name, ok, detail) => {
        report.steps.push({ name, ok, detail });
        logAuth('debug', `${name}: ${ok ? 'OK' : 'FAIL'}`, detail);
    };

    try {
        const now = await pool.query('SELECT NOW() AS now');
        addStep('pool_query', true, { time: now.rows[0].now });

        const tables = await pool.query(`
            SELECT table_name
            FROM information_schema.tables
            WHERE table_schema = 'public'
              AND table_name IN ('users', 'user_credentials', 'user_sessions', 'sidebar_menu')
            ORDER BY table_name
        `);
        addStep('required_tables', tables.rows.length >= 3, {
            found: tables.rows.map(r => r.table_name)
        });

        const counts = await pool.query(`
            SELECT
              (SELECT COUNT(*)::int FROM users) AS users,
              (SELECT COUNT(*)::int FROM user_credentials) AS credentials,
              (SELECT COUNT(*)::int FROM user_sessions) AS sessions
        `);
        addStep('row_counts', true, counts.rows[0]);

        res.json(report);
    } catch (error) {
        addStep('fatal', false, { message: error.message, code: error.code });
        logAuth('debug', 'fatal', error.stack);
        res.status(500).json({
            ...report,
            success: false,
            detail: error.message,
            code: error.code,
            stack: DEBUG_AUTH ? error.stack : undefined
        });
    }
});

// ============================================
// 1. تسجيل الدخول - POST /api/auth/login
// ============================================
router.post('/login', async (req, res) => {
    let client;
    let step = 'start';

    const fail = (status, message, error) => {
        logAuth('login', `${step} → ${message}`, {
            status,
            code: error?.code,
            detail: error?.message
        });
        sendAuthJsonError(res, status, {
            message,
            step,
            detail: error?.message || message,
            code: error?.code,
            stack: DEBUG_AUTH ? error?.stack : undefined
        });
    };

    try {
        const identifier = String(req.body?.email || req.body?.identifier || '').trim();
        const password = String(req.body?.password || '');

        if (!identifier || !password) {
            return fail(400, 'يرجى إدخال البريد الإلكتروني وكلمة المرور');
        }

        step = 'connect';
        client = await pool.connect();
        await ensureRegistrationSchema(client);

        step = 'lookup_credentials';
        const userResult = await client.query(`
            SELECT
                u.id,
                u.name,
                u.email,
                u.role,
                u.tenant_type,
                u.entity_id,
                u.entity_name,
                u.job_title,
                u.office_id,
                u.is_active AS user_active,
                uc.id AS credential_id,
                uc.username,
                uc.password_hash,
                uc.is_active AS credential_active,
                COALESCE(uc.failed_attempts, 0) AS failed_attempts,
                uc.locked_until
            FROM user_credentials uc
            JOIN users u ON u.id = uc.user_id
            WHERE LOWER(uc.username) = LOWER($1)
               OR LOWER(u.email) = LOWER($1)
            ORDER BY u.id
            LIMIT 1
        `, [identifier]);

        if (userResult.rows.length === 0) {
            return fail(401, 'البريد الإلكتروني أو كلمة المرور غير صحيحة');
        }

        const user = userResult.rows[0];
        if (!user.user_active || !user.credential_active) {
            return fail(403, 'هذا الحساب غير مفعل');
        }

        if (user.locked_until && new Date(user.locked_until).getTime() > Date.now()) {
            return fail(423, 'تم قفل الحساب مؤقتاً بسبب محاولات فاشلة. يرجى المحاولة لاحقاً.');
        }

        step = 'validate_password';
        const passwordValid = await comparePassword(password, user.password_hash);
        if (!passwordValid) {
            await client.query(`
                UPDATE user_credentials
                SET failed_attempts = COALESCE(failed_attempts, 0) + 1,
                    locked_until = CASE
                        WHEN COALESCE(failed_attempts, 0) + 1 >= 5 THEN NOW() + INTERVAL '15 minutes'
                        ELSE locked_until
                    END,
                    updated_at = NOW()
                WHERE id = $1
            `, [user.credential_id]);
            return fail(401, 'البريد الإلكتروني أو كلمة المرور غير صحيحة');
        }

        step = 'reset_failed_attempts';
        await client.query(`
            UPDATE user_credentials
            SET failed_attempts = 0,
                locked_until = NULL,
                last_login = NOW(),
                updated_at = NOW()
            WHERE id = $1
        `, [user.credential_id]);

        step = 'create_session';
        const data = await buildAuthenticatedResponse(client, user, req);
        setAuthCookie(req, res, data.session.token);

        return res.json({
            success: true,
            apiBuild: AUTH_API_BUILD,
            message: 'تم تسجيل الدخول بنجاح',
            data
        });
    } catch (error) {
        fail(500, 'حدث خطأ أثناء تسجيل الدخول', error);
    } finally {
        if (client) client.release();
    }
});

// ============================================
// 2. التحقق من الجلسة - GET /api/auth/verify
// ============================================
router.get('/verify', async (req, res) => {
    const token = getRequestToken(req);

    if (!token) {
        return res.status(401).json({
            success: false,
            message: 'لم يتم توفير رمز الجلسة'
        });
    }

    const client = await pool.connect();
    try {
        const sessionQuery = `
            SELECT s.user_id, s.expires_at,
                   u.name, u.email, u.entity_id, u.entity_name, u.role, u.job_title, u.tenant_type,
                   u.office_id
            FROM user_sessions s
            JOIN users u ON s.user_id = u.id
            WHERE s.session_token = $1 AND s.expires_at > NOW()
        `;

        const sessionResult = await client.query(sessionQuery, [token]);

        if (sessionResult.rows.length === 0) {
            clearAuthCookie(res);
            return res.status(401).json({
                success: false,
                message: 'انتهت صلاحية الجلسة أو أنها غير صحيحة'
            });
        }

        const session = sessionResult.rows[0];
        await client.query(
            'UPDATE user_sessions SET last_activity = NOW() WHERE session_token = $1',
            [token]
        );

        let allowedOfficePages = [];
        const verifyTenantType = session.tenant_type;
        if (verifyTenantType && verifyTenantType !== 'HQ') {
            try {
                if (verifyTenantType === 'OFFICE') {
                    const officeResult = await client.query(`
                        SELECT id, entity_id
                        FROM offices
                        WHERE entity_id = $1 OR id::text = $1 OR id = $2
                        LIMIT 1
                    `, [session.entity_id, session.office_id]);

                    if (officeResult.rows.length > 0) {
                        const officeId = officeResult.rows[0].id;
                        await client.query(`
                            CREATE TABLE IF NOT EXISTS office_page_access (
                                id SERIAL PRIMARY KEY,
                                office_id INTEGER REFERENCES offices(id) ON DELETE CASCADE,
                                office_entity_id VARCHAR(120),
                                page_key VARCHAR(120) NOT NULL,
                                created_at TIMESTAMP DEFAULT NOW()
                            )
                        `);
                        await client.query(`ALTER TABLE office_page_access ALTER COLUMN office_id DROP NOT NULL`);
                        await client.query(`ALTER TABLE office_page_access ADD COLUMN IF NOT EXISTS office_entity_id VARCHAR(120)`);
                        await client.query(`
                            CREATE UNIQUE INDEX IF NOT EXISTS office_page_access_office_page_key_idx
                            ON office_page_access (office_id, page_key)
                        `);
                        await client.query(`
                            CREATE UNIQUE INDEX IF NOT EXISTS office_page_access_entity_page_key_idx
                            ON office_page_access (office_entity_id, page_key)
                        `);
                        const pagesResult = await client.query(`
                            SELECT page_key
                            FROM office_page_access
                            WHERE office_id = $1 OR office_entity_id = $2
                            ORDER BY page_key
                        `, [officeId, session.entity_id]);
                        allowedOfficePages = pagesResult.rows.map(row => row.page_key);
                    } else {
                        await client.query(`
                            CREATE TABLE IF NOT EXISTS office_page_access (
                                id SERIAL PRIMARY KEY,
                                office_id INTEGER REFERENCES offices(id) ON DELETE CASCADE,
                                office_entity_id VARCHAR(120),
                                page_key VARCHAR(120) NOT NULL,
                                created_at TIMESTAMP DEFAULT NOW()
                            )
                        `);
                        await client.query(`ALTER TABLE office_page_access ALTER COLUMN office_id DROP NOT NULL`);
                        await client.query(`ALTER TABLE office_page_access ADD COLUMN IF NOT EXISTS office_entity_id VARCHAR(120)`);
                        await client.query(`
                            CREATE UNIQUE INDEX IF NOT EXISTS office_page_access_office_page_key_idx
                            ON office_page_access (office_id, page_key)
                        `);
                        await client.query(`
                            CREATE UNIQUE INDEX IF NOT EXISTS office_page_access_entity_page_key_idx
                            ON office_page_access (office_entity_id, page_key)
                        `);
                        const pagesResult = await client.query(`
                            SELECT page_key
                            FROM office_page_access
                            WHERE office_entity_id = $1
                            ORDER BY page_key
                        `, [session.entity_id]);
                        allowedOfficePages = pagesResult.rows.map(row => row.page_key);
                    }
                }
                if (allowedOfficePages.length === 0) {
                    await client.query(`
                        CREATE TABLE IF NOT EXISTS account_type_sidebar_config (
                            id SERIAL PRIMARY KEY,
                            account_type VARCHAR(50) NOT NULL,
                            page_key VARCHAR(120) NOT NULL,
                            created_at TIMESTAMP DEFAULT NOW(),
                            UNIQUE(account_type, page_key)
                        )
                    `);
                    const typePages = await client.query(
                        'SELECT page_key FROM account_type_sidebar_config WHERE account_type = $1 ORDER BY page_key',
                        [verifyTenantType]
                    );
                    allowedOfficePages = typePages.rows.map(row => row.page_key);
                }
            } catch (error) {
                console.log('⚠️  لم يتم تحميل صلاحيات صفحات الحساب:', error.message);
            }
        }

        res.json({
            success: true,
            user: {
                id: session.user_id,
                name: session.name,
                email: session.email,
                entity_id: session.entity_id,
                entity_name: session.entity_name,
                role: session.role,
                job_title: session.job_title,
                tenant_type: session.tenant_type,
                office_id: session.office_id,
                allowed_pages: allowedOfficePages
            },
            data: {
                user: {
                    id: session.user_id,
                    name: session.name,
                    email: session.email,
                    entity_id: session.entity_id,
                    entity_name: session.entity_name,
                    role: session.role,
                    job_title: session.job_title,
                    tenant_type: session.tenant_type,
                    office_id: session.office_id,
                    allowed_pages: allowedOfficePages
                }
            }
        });
        
    } catch (error) {
        console.error('Verify error:', error);
        res.status(500).json({
            success: false,
            message: 'حدث خطأ أثناء التحقق من الجلسة'
        });
    } finally {
        client.release();
    }
});

// ============================================
// 3. تسجيل الخروج - POST /api/auth/logout
// ============================================
router.post('/logout', async (req, res) => {
    const client = await pool.connect();
    
    try {
        const token = getRequestToken(req);
        
        if (token) {
            await client.query('DELETE FROM user_sessions WHERE session_token = $1', [token]);
        }

        clearAuthCookie(res);
        
        res.json({
            success: true,
            message: 'تم تسجيل الخروج بنجاح'
        });
        
    } catch (error) {
        console.error('Logout error:', error);
        res.status(500).json({
            success: false,
            message: 'حدث خطأ أثناء تسجيل الخروج'
        });
    } finally {
        client.release();
    }
});

// ============================================
// 4. تغيير كلمة المرور - POST /api/auth/change-password
// ============================================
router.post('/change-password', async (req, res) => {
    const client = await pool.connect();
    
    try {
        const token = req.headers.authorization?.replace('Bearer ', '');
        const { old_password, new_password } = req.body;
        
        if (!token) {
            return res.status(401).json({
                success: false,
                message: 'غير مصرح'
            });
        }
        
        if (!old_password || !new_password) {
            return res.status(400).json({
                success: false,
                message: 'يرجى إدخال كلمة المرور القديمة والجديدة'
            });
        }
        
        // التحقق من الجلسة
        const sessionQuery = 'SELECT user_id FROM user_sessions WHERE session_token = $1 AND expires_at > NOW()';
        const sessionResult = await client.query(sessionQuery, [token]);
        
        if (sessionResult.rows.length === 0) {
            return res.status(401).json({
                success: false,
                message: 'الجلسة غير صالحة'
            });
        }
        
        const userId = sessionResult.rows[0].user_id;
        
        // جلب كلمة المرور الحالية
        const credQuery = 'SELECT id, password_hash FROM user_credentials WHERE user_id = $1';
        const credResult = await client.query(credQuery, [userId]);
        
        if (credResult.rows.length === 0) {
            return res.status(404).json({
                success: false,
                message: 'بيانات الاعتماد غير موجودة'
            });
        }
        
        const credential = credResult.rows[0];
        
        // التحقق من كلمة المرور القديمة
        const isOldPasswordValid = await bcrypt.compare(old_password, credential.password_hash);
        
        if (!isOldPasswordValid) {
            return res.status(401).json({
                success: false,
                message: 'كلمة المرور القديمة غير صحيحة'
            });
        }
        
        // تشفير كلمة المرور الجديدة
        const hashedPassword = await bcrypt.hash(new_password, 10);
        
        // تحديث كلمة المرور
        await client.query(
            'UPDATE user_credentials SET password_hash = $1, updated_at = NOW() WHERE id = $2',
            [hashedPassword, credential.id]
        );
        
        res.json({
            success: true,
            message: 'تم تغيير كلمة المرور بنجاح'
        });
        
    } catch (error) {
        console.error('Change password error:', error);
        res.status(500).json({
            success: false,
            message: 'حدث خطأ أثناء تغيير كلمة المرور'
        });
    } finally {
        client.release();
    }
});

router.use((err, req, res, next) => {
    logAuth('router', err.message, { path: req.path, stack: err.stack });
    if (res.headersSent) {
        return next(err);
    }
    sendAuthJsonError(res, 500, {
        message: 'خطأ في واجهة المصادقة',
        detail: err.message,
        path: req.path,
        stack: DEBUG_AUTH ? err.stack : undefined
    });
});

logAuth('boot', `loaded ${AUTH_API_BUILD}`);

module.exports = router;
