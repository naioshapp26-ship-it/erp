/**
 * Super Admin API Endpoints
 * إدارة الأدوار والصلاحيات بالكامل
 */

const express = require('express');
const bcrypt = require('bcryptjs');
const fs = require('fs');
const path = require('path');
const multer = require('multer');
const crypto = require('crypto');
const rateLimit = require('express-rate-limit');
require('dotenv').config();
const db = require('./db');
const { getTenantPool } = require('./tenant-connection-manager');
const { buildCentralTenantEntityId, syncCentralTenantUserDirectoryEntry } = require('./tenant-directory-sync');

const router = express.Router();
const pool = db.pool;

const UPLOADS_ROOT_DIR = path.resolve(process.env.UPLOADS_ROOT_DIR || path.join(__dirname, 'uploads'));
const HOMEPAGE_UPLOAD_PUBLIC_PREFIX = '/uploads/homepage/';
const HOMEPAGE_UPLOAD_ROOT = path.join(UPLOADS_ROOT_DIR, 'homepage');
const MAX_HOMEPAGE_IMAGE_SIZE_BYTES = 8 * 1024 * 1024;
const MAX_HOMEPAGE_VIDEO_SIZE_BYTES = 45 * 1024 * 1024;
if (!fs.existsSync(HOMEPAGE_UPLOAD_ROOT)) {
    fs.mkdirSync(HOMEPAGE_UPLOAD_ROOT, { recursive: true });
}

const homepageImageStorage = multer.diskStorage({
    destination: (_req, _file, cb) => cb(null, HOMEPAGE_UPLOAD_ROOT),
    filename: (_req, file, cb) => {
        const extension = path.extname(file.originalname || '').toLowerCase() || '.png';
        cb(null, `homepage-${Date.now()}-${crypto.randomUUID()}${extension}`);
    }
});

const homepageImageUpload = multer({
    storage: homepageImageStorage,
    limits: { fileSize: MAX_HOMEPAGE_IMAGE_SIZE_BYTES },
    fileFilter: (_req, file, cb) => {
        const allowedTypes = new Set(['image/png', 'image/jpeg', 'image/jpg', 'image/webp', 'image/gif']);
        if (!allowedTypes.has(file.mimetype)) {
            return cb(new Error('نوع الملف غير مدعوم. يرجى رفع صورة PNG/JPG/WEBP/GIF فقط.'));
        }
        cb(null, true);
    }
});

const homepageVideoUpload = multer({
    storage: homepageImageStorage,
    limits: { fileSize: MAX_HOMEPAGE_VIDEO_SIZE_BYTES },
    fileFilter: (_req, file, cb) => {
        const allowedTypes = new Set(['video/mp4', 'video/webm']);
        if (!allowedTypes.has(file.mimetype)) {
            return cb(new Error('نوع الملف غير مدعوم. يرجى رفع فيديو MP4/WEBM فقط.'));
        }
        cb(null, true);
    }
});

/**
 * Wrap a multer middleware so that any multer error (LIMIT_FILE_SIZE,
 * bad mime type, etc.) is caught and returned as a JSON response
 * instead of falling through to Express's default HTML error handler.
 */
function wrapMulter(multerMiddleware, maxBytes) {
    return (req, res, next) => {
        multerMiddleware(req, res, (err) => {
            if (!err) return next();
            if (err.code === 'LIMIT_FILE_SIZE') {
                const maxMB = Math.round((maxBytes || 0) / 1024 / 1024);
                return res.status(413).json({ success: false, message: `حجم الملف كبير جداً (الحد الأقصى ${maxMB} ميجابايت)` });
            }
            return res.status(400).json({ success: false, message: err.message || 'تعذر رفع الملف — تحقق من نوع الملف وحجمه' });
        });
    };
}

const DEFAULT_HOMEPAGE_SETTINGS = {
    theme: {
        primaryColor: '#d70000',
        secondaryColor: '#ff4f63',
        buttonColor: '#b10011',
        headerBgColor: '#ffffff',
        textColor: '#171a20'
    },
    typography: {
        headingColor: '#171a20',
        paragraphColor: '#5e636d',
        linkColor: '#1f232b'
    },
    logoUrl: '/public/naiosh-logo.png',
    heroImageUrl: '/newhome/booking-workspace.svg',
    heroImageMode: 'cover',
    heroMedia: {
        activeType: 'image',
        imageUrls: ['/newhome/booking-workspace.svg'],
        imageCaptions: [''],
        activeImageIndex: 0,
        videoUrls: [],
        videoCaptions: [],
        videoDescriptions: [],
        activeVideoIndex: 0,
        videoUrl: '',
        autoPlaySlider: true,
        overlayStrength: 0.62
    },
    announcementBar: {
        text: '🔥 خصومات على الخدمات 🔥 | 🚀 ابدأ الآن | 📢 عروض محدودة',
        backgroundColor: '#1a0208',
        textColor: '#ffffff',
        speed: 28
    },
    floatingCard: {
        title: 'التكنولوجيا في حياتنا اليومية',
        description: 'مقال مميز من منصتنا يسلط الضوء على أهم التطورات الحديثة',
        primaryButtonText: 'اقرأ المزيد',
        primaryButtonLink: '/newhome/blog.html',
        secondaryButtonText: 'ابدأ الآن',
        secondaryButtonLink: '/register.html'
    },
    tourMedia: {
        activeType: 'image',
        imageUrl: '/%D8%B5%D9%88%D8%B1%D8%A9%20%D8%A7%D9%84%D8%B1%D8%A6%D9%8A%D8%B3%D9%8A%D8%A9.png',
        imagePublicId: null,
        videoUrl: '',
        videoPublicId: null,
        overlayStrength: 0.55
    },
    logoPublicId: null
};

const DEFAULT_MAIN_SECTIONS = [
    {
        title: 'المدونة',
        description: 'مقالات وتحديثات عن الخدمات والبرامج وأخبار المنصة.',
        icon_url: 'fa:fas fa-newspaper',
        link: '/newhome/blog.html',
        order_index: 1
    },
    {
        title: 'الفروع',
        description: 'عرض الفروع ومعلوماتها الأساسية وساعات العمل والخدمات.',
        icon_url: 'fa:fas fa-building',
        link: '/newhome/branches.html',
        order_index: 2
    },
    {
        title: 'الحاضنات',
        description: 'رحلة برامج الاحتضان والحزم ومراحل المتابعة والتطوير.',
        icon_url: 'fa:fas fa-seedling',
        link: '/newhome/incubators.html',
        order_index: 3
    },
    {
        title: 'الإعلانات',
        description: 'حملات دعائية منظمة مع تتبع سريع للحالة والأداء.',
        icon_url: 'fa:fas fa-bullhorn',
        link: '/newhome/ads.html',
        order_index: 4
    }
];

const isHexColor = (value) => typeof value === 'string' && /^#([A-Fa-f0-9]{3}|[A-Fa-f0-9]{6})$/.test(value.trim());
const normalizeColor = (value, fallback) => {
    if (!isHexColor(value)) return fallback;
    const normalized = value.trim();
    if (normalized.length === 4) {
        return `#${normalized[1]}${normalized[1]}${normalized[2]}${normalized[2]}${normalized[3]}${normalized[3]}`.toLowerCase();
    }
    return normalized.toLowerCase();
};

const ensureHomepageSettingsTable = async () => {
    await pool.query(`
        CREATE TABLE IF NOT EXISTS homepage_settings (
            id INTEGER PRIMARY KEY CHECK (id = 1),
            settings JSONB NOT NULL DEFAULT '{}'::jsonb,
            created_at TIMESTAMP DEFAULT NOW(),
            updated_at TIMESTAMP DEFAULT NOW()
        )
    `);
};

const TENANT_LOGIN_BASE_DOMAIN = String(process.env.BASE_DOMAIN || 'localhost').trim().toLowerCase();
const TENANT_DIRECTORY_BACKFILL_TTL_MS = 60 * 1000;
let tenantDirectoryBackfillInFlight = null;
let tenantDirectoryBackfillLastRunAt = 0;

const normalizeTenantDirectorySearch = (value) => {
    const normalized = String(value || '').trim().toLowerCase().replace(/^https?:\/\//, '');
    const hostOnly = normalized.split('/')[0].split(':')[0];
    if (!hostOnly) return '';
    if (TENANT_LOGIN_BASE_DOMAIN && hostOnly.endsWith(`.${TENANT_LOGIN_BASE_DOMAIN}`)) {
        return hostOnly.slice(0, -(TENANT_LOGIN_BASE_DOMAIN.length + 1));
    }
    return hostOnly.split('.')[0] || hostOnly;
};

const buildTenantLoginUrl = (subdomain) => {
    const normalizedSubdomain = String(subdomain || '').trim().toLowerCase();
    if (!normalizedSubdomain) return null;
    return `https://${normalizedSubdomain}.${TENANT_LOGIN_BASE_DOMAIN}`;
};

const parseTenantSettings = (value) => {
    if (!value) return {};
    if (typeof value === 'object' && !Array.isArray(value)) return value;
    if (typeof value !== 'string') return {};
    try {
        const parsed = JSON.parse(value);
        return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? parsed : {};
    } catch (_error) {
        return {};
    }
};

const buildSyntheticTenantDirectoryUser = (tenant) => {
    const settings = parseTenantSettings(tenant.settings);
    const directoryContact = settings.directoryContact || {};

    return {
        id: `tenant-admin-${tenant.id}`,
        first_name: String(directoryContact.adminName || tenant.company_name || tenant.subdomain || 'Tenant').trim(),
        last_name: '',
        username: String(directoryContact.adminEmail || tenant.subdomain || `tenant-${tenant.id}`).trim().toLowerCase(),
        email: String(directoryContact.adminEmail || '').trim().toLowerCase() || null,
        role: 'admin',
        is_active: tenant.status !== 'deleted'
    };
};

const loadTenantDirectorySeedUser = async (tenant) => {
    if (tenant.encrypted_db_url) {
        try {
            const tenantPool = getTenantPool(tenant.subdomain, tenant.encrypted_db_url);
            const tenantUserResult = await tenantPool.query(`
                SELECT id, first_name, last_name, username, email, role, is_active
                FROM users
                WHERE COALESCE(is_active, true) = true
                ORDER BY CASE WHEN LOWER(COALESCE(role, '')) = 'admin' THEN 0 ELSE 1 END, id ASC
                LIMIT 1
            `);

            if (tenantUserResult.rows.length > 0) {
                return tenantUserResult.rows[0];
            }
        } catch (error) {
            console.warn('[SuperAdmin] tenant directory seed lookup failed:', tenant.subdomain, error.message);
        }
    }

    return buildSyntheticTenantDirectoryUser(tenant);
};

const syncTenantDirectoryBackfill = async () => {
    const now = Date.now();
    if (tenantDirectoryBackfillInFlight) {
        return tenantDirectoryBackfillInFlight;
    }
    if (tenantDirectoryBackfillLastRunAt && (now - tenantDirectoryBackfillLastRunAt) < TENANT_DIRECTORY_BACKFILL_TTL_MS) {
        return;
    }

    tenantDirectoryBackfillInFlight = (async () => {
        const tenantsResult = await pool.query(`
            SELECT
                t.id,
                t.subdomain,
                t.company_name,
                t.subscription_plan,
                t.status,
                t.encrypted_db_url,
                t.settings,
                directory_user.email AS directory_email
            FROM tenants t
            LEFT JOIN LATERAL (
                SELECT u.id, u.email
                FROM users u
                WHERE u.tenant_type = 'TENANT'
                  AND u.entity_id = CONCAT('TEN', LPAD(t.id::text, 6, '0'))
                ORDER BY u.created_at ASC NULLS LAST, u.id ASC
                LIMIT 1
            ) directory_user ON true
            WHERE t.status != 'deleted'
              AND (
                directory_user.id IS NULL
                OR COALESCE(directory_user.email, '') = ''
              )
            ORDER BY t.id ASC
        `);

        for (const tenant of tenantsResult.rows) {
            try {
                const seedUser = await loadTenantDirectorySeedUser(tenant);
                await syncCentralTenantUserDirectoryEntry({
                    tenant,
                    user: seedUser,
                    allowEntityFallback: true
                });
            } catch (error) {
                console.warn('[SuperAdmin] tenant directory backfill failed:', tenant.subdomain, error.message);
            }
        }
        tenantDirectoryBackfillLastRunAt = Date.now();
    })();

    try {
        await tenantDirectoryBackfillInFlight;
    } finally {
        tenantDirectoryBackfillInFlight = null;
    }
};

const sanitizeUrlPath = (value, fallback) => {
    if (typeof value !== 'string') return fallback;
    const trimmed = value.trim();
    if (!trimmed) return fallback;
    if (/^https?:\/\//i.test(trimmed)) {
        try {
            const parsed = new URL(trimmed);
            if ((parsed.protocol === 'https:' || parsed.protocol === 'http:') && !trimmed.includes('\0')) {
                return trimmed;
            }
            return fallback;
        } catch (_error) {
            return fallback;
        }
    }
    const decoded = safeDecodeURIComponent(trimmed);
    if (!decoded) return fallback;
    if (/(^|\/)\.\.(\/|$)/.test(decoded)) return fallback;
    const normalized = path.posix.normalize(decoded);
    if (!trimmed.startsWith('/') || !normalized.startsWith('/') || decoded.includes('\0')) {
        return fallback;
    }
    return trimmed;
};

const sanitizeOptionalUrlPath = (value) => {
    if (typeof value !== 'string') return '';
    const trimmed = value.trim();
    if (!trimmed) return '';
    if (/^https?:\/\//i.test(trimmed)) {
        try {
            const parsed = new URL(trimmed);
            if ((parsed.protocol === 'https:' || parsed.protocol === 'http:') && !trimmed.includes('\0')) {
                return trimmed;
            }
            return '';
        } catch (_error) {
            return '';
        }
    }
    const decoded = safeDecodeURIComponent(trimmed);
    if (!decoded) return '';
    if (/(^|\/)\.\.(\/|$)/.test(decoded)) return '';
    const normalized = path.posix.normalize(decoded);
    if (!trimmed.startsWith('/') || !normalized.startsWith('/') || decoded.includes('\0')) {
        return '';
    }
    return trimmed;
};

const buildHomepageUploadUrl = (filename = '') => {
    const rawName = path.basename(String(filename || ''));
    if (!rawName || rawName === '.' || rawName === '..') return '';
    const rawExt = path.extname(rawName || '').toLowerCase();
    const baseName = rawExt ? rawName.slice(0, -rawExt.length) : rawName;
    const safeBaseName = baseName.replace(/[^\w-]/g, '');
    const safeExt = rawExt;
    const allowedExtensions = new Set([
        '.png', '.jpg', '.jpeg', '.webp', '.gif', '.svg', '.mp4', '.webm'
    ]);
    if (!safeBaseName || !/^\.[a-z0-9]{1,10}$/.test(safeExt) || !allowedExtensions.has(safeExt)) return '';
    return `${HOMEPAGE_UPLOAD_PUBLIC_PREFIX}${encodeURIComponent(`${safeBaseName}${safeExt}`)}`;
};

const getHomepageUploadFilePathFromUrl = (fileUrl = '') => {
    if (typeof fileUrl !== 'string') return '';
    const normalizedUrl = fileUrl.trim().split('?')[0].split('#')[0];
    if (!normalizedUrl.startsWith(HOMEPAGE_UPLOAD_PUBLIC_PREFIX)) return '';
    const encodedName = normalizedUrl.slice(HOMEPAGE_UPLOAD_PUBLIC_PREFIX.length);
    const decodedName = safeDecodeURIComponent(encodedName);
    if (!decodedName) return '';
    const safeName = path.basename(decodedName);
    if (!safeName || safeName === '.' || safeName === '..' || safeName !== decodedName) return '';
    return path.join(HOMEPAGE_UPLOAD_ROOT, safeName);
};

const deleteHomepageUploadByUrl = async (fileUrl = '') => {
    const localFilePath = getHomepageUploadFilePathFromUrl(fileUrl);
    if (!localFilePath) return false;
    try {
        await fs.promises.unlink(localFilePath);
        return true;
    } catch (error) {
        if (error?.code !== 'ENOENT') {
            console.error('Failed to delete homepage upload:', localFilePath, error);
        }
        return false;
    }
};

const safeDecodeURIComponent = (value) => {
    if (typeof value !== 'string') return null;
    let decoded = value;
    for (let i = 0; i < 3; i += 1) {
        try {
            const next = decodeURIComponent(decoded);
            if (next === decoded) break;
            decoded = next;
        } catch (_error) {
            return null;
        }
    }
    return decoded;
};

const clampNumber = (value, min, max, fallback) => {
    const parsed = Number(value);
    if (!Number.isFinite(parsed)) return fallback;
    return Math.min(max, Math.max(min, parsed));
};

const sanitizeCaptionText = (value) => {
    if (typeof value !== 'string') return '';
    return value.replace(/\s+/g, ' ').trim().slice(0, 200);
};

const sanitizeShortText = (value, maxLength = 120) => {
    if (typeof value !== 'string') return '';
    return value.replace(/\s+/g, ' ').trim().slice(0, maxLength);
};

const sanitizeSectionTitle = (value) => {
    if (typeof value !== 'string') return '';
    return value.replace(/\s+/g, ' ').trim().slice(0, 120);
};

const sanitizeSectionDescription = (value) => {
    if (typeof value !== 'string') return '';
    return value.replace(/\s+/g, ' ').trim().slice(0, 500);
};

const sanitizeSectionIconValue = (value, fallback = 'fa:fas fa-square') => {
    if (typeof value !== 'string') return fallback;
    const trimmed = value.trim();
    if (!trimmed) return fallback;
    if (trimmed.startsWith('fa:')) {
        const iconClass = trimmed.slice(3).trim();
        if (/^[A-Za-z0-9\s-]{2,120}$/.test(iconClass)) {
            return `fa:${iconClass}`;
        }
        return fallback;
    }
    return sanitizeOptionalUrlPath(trimmed) || fallback;
};

const normalizeSectionRow = (row) => {
    const iconValue = typeof row.icon_url === 'string' ? row.icon_url : '';
    const isFontIcon = iconValue.startsWith('fa:');
    return {
        id: Number(row.id),
        title: sanitizeSectionTitle(row.title),
        description: sanitizeSectionDescription(row.description),
        icon_url: iconValue,
        icon_class: isFontIcon ? iconValue.slice(3).trim() : '',
        link: sanitizeOptionalUrlPath(row.link || ''),
        order_index: Number(row.order_index) || 0,
        created_at: row.created_at
    };
};

const ensureHeroMediaTable = async () => {
    await pool.query(`
        CREATE TABLE IF NOT EXISTS hero_media (
            id SERIAL PRIMARY KEY,
            type VARCHAR(10) NOT NULL CHECK (type IN ('image', 'video')),
            url TEXT NOT NULL,
            title VARCHAR(200),
            order_index INTEGER NOT NULL DEFAULT 0,
            is_active BOOLEAN NOT NULL DEFAULT true,
            created_at TIMESTAMP DEFAULT NOW()
        )
    `);
    // Add target column if it doesn't exist (safe migration)
    await pool.query(`
        ALTER TABLE hero_media
        ADD COLUMN IF NOT EXISTS target VARCHAR(20) NOT NULL DEFAULT 'frame'
    `);
    // Add cloudinary_public_id column if it doesn't exist (safe migration)
    await pool.query(`
        ALTER TABLE hero_media
        ADD COLUMN IF NOT EXISTS cloudinary_public_id TEXT
    `);
};

const getHeroMediaList = async (activeOnly = false) => {
    await ensureHeroMediaTable();
    const whereClause = activeOnly ? 'WHERE is_active = true' : '';
    const result = await pool.query(`
        SELECT id, type, url, title, target, order_index, is_active, created_at
        FROM hero_media
        ${whereClause}
        ORDER BY order_index ASC, id ASC
    `);
    return result.rows;
};

const homepageSettingsReadLimiter = rateLimit({
    windowMs: 60 * 1000,
    limit: 120,
    standardHeaders: 'draft-8',
    legacyHeaders: false,
    message: { success: false, message: 'عدد كبير من الطلبات، يرجى المحاولة بعد قليل' }
});

const homepageSettingsWriteLimiter = rateLimit({
    windowMs: 60 * 1000,
    limit: 30,
    standardHeaders: 'draft-8',
    legacyHeaders: false,
    message: { success: false, message: 'عدد كبير من الطلبات، يرجى المحاولة بعد قليل' }
});

const homepageSettingsUploadLimiter = rateLimit({
    windowMs: 60 * 1000,
    limit: 10,
    standardHeaders: 'draft-8',
    legacyHeaders: false,
    message: { success: false, message: 'عدد كبير من الطلبات، يرجى المحاولة بعد قليل' }
});

const homepageSectionsWriteLimiter = rateLimit({
    windowMs: 60 * 1000,
    limit: 30,
    standardHeaders: 'draft-8',
    legacyHeaders: false,
    message: { success: false, message: 'عدد كبير من الطلبات على الأقسام الرئيسية، يرجى المحاولة بعد قليل' }
});

const superAdminReadLimiter = rateLimit({
    windowMs: 60 * 1000,
    limit: 120,
    standardHeaders: 'draft-8',
    legacyHeaders: false,
    message: { success: false, message: 'عدد كبير من طلبات لوحة السوبر أدمن، يرجى المحاولة بعد قليل' }
});

const superAdminWriteLimiter = rateLimit({
    windowMs: 60 * 1000,
    limit: 40,
    standardHeaders: 'draft-8',
    legacyHeaders: false,
    message: { success: false, message: 'عدد كبير من عمليات التعديل، يرجى المحاولة بعد قليل' }
});

const sanitizeHomepageSettings = (input = {}) => {
    const themeInput = input.theme || {};
    const typographyInput = input.typography || {};

    const fallbackImage = sanitizeUrlPath(input.heroImageUrl, DEFAULT_HOMEPAGE_SETTINGS.heroImageUrl);
    const heroMediaInput = input.heroMedia || {};
    const rawImageUrls = Array.isArray(heroMediaInput.imageUrls) ? heroMediaInput.imageUrls : [fallbackImage];
    const imageUrls = rawImageUrls
        .map((item) => sanitizeOptionalUrlPath(item))
        .filter(Boolean)
        .slice(0, 8);
    const normalizedImageUrls = imageUrls.length ? imageUrls : [fallbackImage];
    const rawImageCaptions = Array.isArray(heroMediaInput.imageCaptions) ? heroMediaInput.imageCaptions : [];
    const imageCaptions = normalizedImageUrls.map((_, index) => sanitizeCaptionText(rawImageCaptions[index] || ''));
    const activeImageIndex = clampNumber(
        heroMediaInput.activeImageIndex,
        0,
        Math.max(0, normalizedImageUrls.length - 1),
        0
    );
    const activeImageUrl = normalizedImageUrls[activeImageIndex] || fallbackImage;
    const legacyVideoUrl = sanitizeOptionalUrlPath(heroMediaInput.videoUrl);
    const rawVideoUrls = Array.isArray(heroMediaInput.videoUrls)
        ? heroMediaInput.videoUrls
        : (legacyVideoUrl ? [legacyVideoUrl] : []);
    const videoUrls = rawVideoUrls
        .map((item) => sanitizeOptionalUrlPath(item))
        .filter(Boolean)
        .slice(0, 8);
    const rawVideoCaptions = Array.isArray(heroMediaInput.videoCaptions) ? heroMediaInput.videoCaptions : [];
    const videoCaptions = videoUrls.map((_, index) => sanitizeCaptionText(rawVideoCaptions[index] || ''));
    const rawVideoDescriptions = Array.isArray(heroMediaInput.videoDescriptions) ? heroMediaInput.videoDescriptions : [];
    const videoDescriptions = videoUrls.map((_, index) => sanitizeShortText(rawVideoDescriptions[index] || '', 300));
    const activeVideoIndex = clampNumber(
        heroMediaInput.activeVideoIndex,
        0,
        Math.max(0, videoUrls.length - 1),
        0
    );
    const activeVideoUrl = videoUrls[activeVideoIndex] || '';
    const activeType = heroMediaInput.activeType === 'video' ? 'video' : 'image';

    const tourMediaInput = input.tourMedia || {};
    const tourActiveType = tourMediaInput.activeType === 'video' ? 'video' : 'image';
    const announcementInput = input.announcementBar || {};
    const floatingCardInput = input.floatingCard || {};

    return {
        theme: {
            primaryColor: normalizeColor(themeInput.primaryColor, DEFAULT_HOMEPAGE_SETTINGS.theme.primaryColor),
            secondaryColor: normalizeColor(themeInput.secondaryColor, DEFAULT_HOMEPAGE_SETTINGS.theme.secondaryColor),
            buttonColor: normalizeColor(themeInput.buttonColor, DEFAULT_HOMEPAGE_SETTINGS.theme.buttonColor),
            headerBgColor: normalizeColor(themeInput.headerBgColor, DEFAULT_HOMEPAGE_SETTINGS.theme.headerBgColor),
            textColor: normalizeColor(themeInput.textColor, DEFAULT_HOMEPAGE_SETTINGS.theme.textColor)
        },
        typography: {
            headingColor: normalizeColor(typographyInput.headingColor, DEFAULT_HOMEPAGE_SETTINGS.typography.headingColor),
            paragraphColor: normalizeColor(typographyInput.paragraphColor, DEFAULT_HOMEPAGE_SETTINGS.typography.paragraphColor),
            linkColor: normalizeColor(typographyInput.linkColor, DEFAULT_HOMEPAGE_SETTINGS.typography.linkColor)
        },
        logoUrl: sanitizeUrlPath(input.logoUrl, DEFAULT_HOMEPAGE_SETTINGS.logoUrl),
        logoPublicId: null,
        heroImageUrl: activeImageUrl,
        heroImageMode: input.heroImageMode === 'center' ? 'center' : 'cover',
        heroMedia: {
            activeType,
            imageUrls: normalizedImageUrls,
            imageCaptions,
            activeImageIndex,
            videoUrls,
            videoCaptions,
            videoDescriptions,
            activeVideoIndex,
            videoUrl: activeVideoUrl,
            autoPlaySlider: heroMediaInput.autoPlaySlider !== false,
            overlayStrength: clampNumber(heroMediaInput.overlayStrength, 0.5, 0.7, 0.62)
        },
        announcementBar: {
            text: sanitizeShortText(announcementInput.text, 600) || DEFAULT_HOMEPAGE_SETTINGS.announcementBar.text,
            backgroundColor: normalizeColor(announcementInput.backgroundColor, DEFAULT_HOMEPAGE_SETTINGS.announcementBar.backgroundColor),
            textColor: normalizeColor(announcementInput.textColor, DEFAULT_HOMEPAGE_SETTINGS.announcementBar.textColor),
            speed: clampNumber(announcementInput.speed, 10, 120, DEFAULT_HOMEPAGE_SETTINGS.announcementBar.speed)
        },
        floatingCard: {
            title: sanitizeShortText(floatingCardInput.title, 160) || DEFAULT_HOMEPAGE_SETTINGS.floatingCard.title,
            description: sanitizeShortText(floatingCardInput.description, 300) || DEFAULT_HOMEPAGE_SETTINGS.floatingCard.description,
            primaryButtonText: sanitizeShortText(floatingCardInput.primaryButtonText, 60) || DEFAULT_HOMEPAGE_SETTINGS.floatingCard.primaryButtonText,
            primaryButtonLink: sanitizeOptionalUrlPath(floatingCardInput.primaryButtonLink) || DEFAULT_HOMEPAGE_SETTINGS.floatingCard.primaryButtonLink,
            secondaryButtonText: sanitizeShortText(floatingCardInput.secondaryButtonText, 60) || DEFAULT_HOMEPAGE_SETTINGS.floatingCard.secondaryButtonText,
            secondaryButtonLink: sanitizeOptionalUrlPath(floatingCardInput.secondaryButtonLink) || DEFAULT_HOMEPAGE_SETTINGS.floatingCard.secondaryButtonLink
        },
        tourMedia: {
            activeType: tourActiveType,
            imageUrl: sanitizeOptionalUrlPath(tourMediaInput.imageUrl) || DEFAULT_HOMEPAGE_SETTINGS.tourMedia.imageUrl,
            imagePublicId: null,
            videoUrl: sanitizeOptionalUrlPath(tourMediaInput.videoUrl),
            videoPublicId: null,
            overlayStrength: clampNumber(tourMediaInput.overlayStrength, 0, 1, 0.55)
        }
    };
};

const getHomepageSettings = async () => {
    await ensureHomepageSettingsTable();
    const result = await pool.query('SELECT settings FROM homepage_settings WHERE id = 1');
    const fromDb = result.rows[0]?.settings || {};
    return sanitizeHomepageSettings({ ...DEFAULT_HOMEPAGE_SETTINGS, ...fromDb });
};

const saveHomepageSettings = async (settings) => {
    await ensureHomepageSettingsTable();
    await pool.query(
        `INSERT INTO homepage_settings (id, settings, updated_at)
         VALUES (1, $1::jsonb, NOW())
         ON CONFLICT (id)
         DO UPDATE SET settings = $1::jsonb, updated_at = NOW()`,
        [JSON.stringify(settings)]
    );
};

const ensureHomepageSectionsTable = async () => {
    await pool.query(`
        CREATE TABLE IF NOT EXISTS sections (
            id SERIAL PRIMARY KEY,
            title VARCHAR(120) NOT NULL,
            description TEXT NOT NULL DEFAULT '',
            icon_url TEXT NOT NULL,
            link TEXT NULL,
            order_index INTEGER NOT NULL DEFAULT 0,
            created_at TIMESTAMP DEFAULT NOW()
        )
    `);
    const { rows } = await pool.query('SELECT COUNT(*)::int AS total FROM sections');
    if ((rows[0]?.total || 0) === 0) {
        for (const section of DEFAULT_MAIN_SECTIONS) {
            await pool.query(
                `INSERT INTO sections (title, description, icon_url, link, order_index)
                 VALUES ($1, $2, $3, $4, $5)`,
                [section.title, section.description, section.icon_url, section.link, section.order_index]
            );
        }
    }
};

const getHomepageSections = async () => {
    await ensureHomepageSectionsTable();
    const result = await pool.query(`
        SELECT id, title, description, icon_url, link, order_index, created_at
        FROM sections
        ORDER BY order_index ASC, id ASC
    `);
    return result.rows.map(normalizeSectionRow);
};

const ensureOfficePageAccessTable = async () => {
    await pool.query(`
        CREATE TABLE IF NOT EXISTS office_page_access (
            id SERIAL PRIMARY KEY,
            office_id INTEGER REFERENCES offices(id) ON DELETE CASCADE,
            office_entity_id VARCHAR(120),
            page_key VARCHAR(120) NOT NULL,
            created_at TIMESTAMP DEFAULT NOW()
        )
    `);
    await pool.query(`ALTER TABLE office_page_access ALTER COLUMN office_id DROP NOT NULL`);
    await pool.query(`ALTER TABLE office_page_access ADD COLUMN IF NOT EXISTS office_entity_id VARCHAR(120)`);
    await pool.query(`
        CREATE UNIQUE INDEX IF NOT EXISTS office_page_access_office_page_key_idx
        ON office_page_access (office_id, page_key)
    `);
    await pool.query(`
        CREATE UNIQUE INDEX IF NOT EXISTS office_page_access_entity_page_key_idx
        ON office_page_access (office_entity_id, page_key)
    `);
};

const ensureTenantPageAccessTable = async () => {
    await pool.query(`
        CREATE TABLE IF NOT EXISTS tenant_page_access (
            id SERIAL PRIMARY KEY,
            tenant_id INTEGER REFERENCES tenants(id) ON DELETE CASCADE,
            tenant_entity_id VARCHAR(120),
            page_key VARCHAR(120) NOT NULL,
            created_at TIMESTAMP DEFAULT NOW()
        )
    `);
    await pool.query(`ALTER TABLE tenant_page_access ALTER COLUMN tenant_id DROP NOT NULL`);
    await pool.query(`ALTER TABLE tenant_page_access ADD COLUMN IF NOT EXISTS tenant_entity_id VARCHAR(120)`);
    await pool.query(`
        CREATE UNIQUE INDEX IF NOT EXISTS tenant_page_access_tenant_page_key_idx
        ON tenant_page_access (tenant_id, page_key)
    `);
    await pool.query(`
        CREATE UNIQUE INDEX IF NOT EXISTS tenant_page_access_entity_page_key_idx
        ON tenant_page_access (tenant_entity_id, page_key)
    `);
};

const ensureAccountTypeSidebarTable = async () => {
    await pool.query(`
        CREATE TABLE IF NOT EXISTS account_type_sidebar_config (
            id SERIAL PRIMARY KEY,
            account_type VARCHAR(50) NOT NULL,
            page_key VARCHAR(120) NOT NULL,
            created_at TIMESTAMP DEFAULT NOW(),
            UNIQUE(account_type, page_key)
        )
    `);
};

const isValidEmail = (email) => {
    if (!email || email.length > 254) return false;
    const parts = String(email).split('@');
    if (parts.length !== 2) return false;

    const [localPart, domainPart] = parts;
    if (!localPart || !domainPart) return false;
    if (domainPart.startsWith('.') || domainPart.endsWith('.') || domainPart.includes('..')) return false;

    const domainSegments = domainPart.split('.');
    return domainSegments.length >= 2 && domainSegments.every(segment => Boolean(segment));
};

const normalizeOptionalText = (value) => {
    const normalized = String(value ?? '').trim();
    return normalized || null;
};

const resolveOfficeReference = async (client, officeLookupValue) => {
    const lookup = String(officeLookupValue || '').trim();
    if (!lookup) {
        return null;
    }

    const directOfficeResult = await client.query(`
        SELECT id, name, code, entity_id
        FROM offices
        WHERE id::text = $1
           OR UPPER(COALESCE(code, '')) = UPPER($1)
           OR COALESCE(entity_id, '') = $1
           OR UPPER(COALESCE(name, '')) LIKE UPPER($1 || '%')
        LIMIT 1
    `, [lookup]);

    if (directOfficeResult.rows.length > 0) {
        return directOfficeResult.rows[0];
    }

    const officeUserResult = await client.query(`
        SELECT id, entity_id, entity_name, email
        FROM users
        WHERE tenant_type = 'OFFICE'
          AND (
              id::text = $1
              OR COALESCE(entity_id, '') = $1
              OR UPPER(COALESCE(entity_name, '')) LIKE UPPER($1 || '%')
              OR LOWER(COALESCE(email, '')) = LOWER($1)
          )
        ORDER BY id DESC
        LIMIT 1
    `, [lookup]);

    let fallbackEntityId = null;
    let fallbackName = null;
    if (officeUserResult.rows.length > 0) {
        fallbackEntityId = officeUserResult.rows[0].entity_id || null;
        fallbackName = officeUserResult.rows[0].entity_name || null;
    }

    if (!fallbackEntityId) {
        const entityResult = await client.query(`
            SELECT id, name
            FROM entities
            WHERE type = 'OFFICE'
              AND (
                  id = $1
                  OR UPPER(COALESCE(name, '')) LIKE UPPER($1 || '%')
              )
            ORDER BY created_at DESC NULLS LAST, updated_at DESC NULLS LAST, id DESC
            LIMIT 1
        `, [lookup]);

        if (entityResult.rows.length > 0) {
            fallbackEntityId = entityResult.rows[0].id;
            fallbackName = entityResult.rows[0].name || null;
        }
    }

    if (!fallbackEntityId) {
        return null;
    }

    const existingProvisionedOffice = await client.query(`
        SELECT id, name, code, entity_id
        FROM offices
        WHERE entity_id = $1
           OR UPPER(COALESCE(code, '')) = UPPER($1)
        LIMIT 1
    `, [fallbackEntityId]);

    if (existingProvisionedOffice.rows.length > 0) {
        return existingProvisionedOffice.rows[0];
    }

    return {
        id: null,
        name: fallbackName || fallbackEntityId,
        code: fallbackEntityId,
        entity_id: fallbackEntityId
    };
};

const resolveTenantReference = async (client, tenantLookupValue) => {
    const lookup = String(tenantLookupValue || '').trim();
    if (!lookup) {
        return null;
    }

    const normalizedLookup = normalizeTenantDirectorySearch(lookup) || lookup.toLowerCase();
    const normalizedEmail = lookup.toLowerCase();

    const directTenantResult = await client.query(`
        SELECT
            id,
            company_name,
            subdomain,
            CONCAT('TEN', LPAD(id::text, 6, '0')) AS entity_id
        FROM tenants
        WHERE id::text = $1
           OR LOWER(COALESCE(subdomain, '')) = LOWER($2)
           OR LOWER(COALESCE(company_name, '')) LIKE LOWER($1 || '%')
           OR CONCAT('TEN', LPAD(id::text, 6, '0')) = $1
        ORDER BY id DESC
        LIMIT 1
    `, [lookup, normalizedLookup]);

    if (directTenantResult.rows.length > 0) {
        const tenant = directTenantResult.rows[0];
        return {
            id: tenant.id,
            name: tenant.company_name,
            subdomain: tenant.subdomain,
            entity_id: tenant.entity_id
        };
    }

    const tenantUserResult = await client.query(`
        SELECT id, entity_id, entity_name, email
        FROM users
        WHERE tenant_type = 'TENANT'
          AND (
              id::text = $1
              OR COALESCE(entity_id, '') = $1
              OR LOWER(COALESCE(email, '')) = LOWER($2)
              OR LOWER(COALESCE(entity_name, '')) LIKE LOWER($1 || '%')
          )
        ORDER BY id DESC
        LIMIT 1
    `, [lookup, normalizedEmail]);

    let fallbackEntityId = null;
    let fallbackName = null;
    if (tenantUserResult.rows.length > 0) {
        fallbackEntityId = tenantUserResult.rows[0].entity_id || null;
        fallbackName = tenantUserResult.rows[0].entity_name || null;
    }

    if (fallbackEntityId && /^TEN\d{6}$/i.test(fallbackEntityId)) {
        const tenantId = Number.parseInt(fallbackEntityId.slice(3), 10);
        if (Number.isInteger(tenantId) && tenantId > 0) {
            const mappedTenantResult = await client.query(`
                SELECT
                    id,
                    company_name,
                    subdomain,
                    CONCAT('TEN', LPAD(id::text, 6, '0')) AS entity_id
                FROM tenants
                WHERE id = $1
                LIMIT 1
            `, [tenantId]);

            if (mappedTenantResult.rows.length > 0) {
                const tenant = mappedTenantResult.rows[0];
                return {
                    id: tenant.id,
                    name: tenant.company_name,
                    subdomain: tenant.subdomain,
                    entity_id: tenant.entity_id
                };
            }
        }
    }

    const entityResult = await client.query(`
        SELECT id, name
        FROM entities
        WHERE type = 'PLATFORM'
          AND (
              id = $1
              OR LOWER(COALESCE(name, '')) LIKE LOWER($1 || '%')
          )
        ORDER BY created_at DESC NULLS LAST, updated_at DESC NULLS LAST, id DESC
        LIMIT 1
    `, [lookup]);

    if (entityResult.rows.length > 0 && /^TEN\d{6}$/i.test(entityResult.rows[0].id || '')) {
        const tenantId = Number.parseInt(entityResult.rows[0].id.slice(3), 10);
        if (Number.isInteger(tenantId) && tenantId > 0) {
            const mappedTenantResult = await client.query(`
                SELECT
                    id,
                    company_name,
                    subdomain,
                    CONCAT('TEN', LPAD(id::text, 6, '0')) AS entity_id
                FROM tenants
                WHERE id = $1
                LIMIT 1
            `, [tenantId]);

            if (mappedTenantResult.rows.length > 0) {
                const tenant = mappedTenantResult.rows[0];
                return {
                    id: tenant.id,
                    name: tenant.company_name,
                    subdomain: tenant.subdomain,
                    entity_id: tenant.entity_id
                };
            }
        }
    }

    if (!fallbackEntityId) {
        return null;
    }

    return {
        id: null,
        name: fallbackName || fallbackEntityId,
        subdomain: normalizedLookup || null,
        entity_id: fallbackEntityId
    };
};

const findUserByEmail = async (client, email, excludedUserId = null) => {
    const params = [email];
    let query = 'SELECT id FROM users WHERE LOWER(email) = LOWER($1)';

    if (excludedUserId !== null && excludedUserId !== undefined) {
        params.push(excludedUserId);
        query += ` AND id <> $${params.length}`;
    }

    query += ' LIMIT 1';
    return client.query(query, params);
};

const VALID_TENANT_USER_ROLES = new Set(['admin', 'manager', 'staff', 'readonly']);

const normalizeEmailAddress = (value) => {
    const normalized = String(value || '').trim().toLowerCase();
    return normalized || null;
};

const normalizeDisplayName = (value) => {
    const normalized = String(value || '').trim().replace(/\s+/g, ' ');
    return normalized || null;
};

const resolveTenantForCentralUser = async (client, entityId) => {
    const normalizedEntityId = String(entityId || '').trim().toUpperCase();
    const match = normalizedEntityId.match(/^TEN(\d{6})$/);
    if (!match) {
        return null;
    }

    const tenantId = Number.parseInt(match[1], 10);
    if (!Number.isInteger(tenantId) || tenantId <= 0) {
        return null;
    }

    const tenantResult = await client.query(`
        SELECT id, subdomain, company_name, encrypted_db_url, status
        FROM tenants
        WHERE id = $1
        LIMIT 1
    `, [tenantId]);

    return tenantResult.rows[0] || null;
};

const findTenantUserForCentralDirectoryUser = async (tenantPool, centralUser, previousEmail = null) => {
    const emailCandidates = Array.from(new Set([
        normalizeEmailAddress(previousEmail),
        normalizeEmailAddress(centralUser?.email)
    ].filter(Boolean)));

    if (emailCandidates.length > 0) {
        const tenantUserByEmail = await tenantPool.query(`
            SELECT id, first_name, last_name, username, email, phone, role, is_active
            FROM users
            WHERE LOWER(COALESCE(email, '')) = ANY($1::text[])
            ORDER BY CASE WHEN LOWER(COALESCE(role, '')) = 'admin' THEN 0 ELSE 1 END, id ASC
            LIMIT 1
        `, [emailCandidates]);

        if (tenantUserByEmail.rows[0]) {
            return tenantUserByEmail.rows[0];
        }
    }

    const normalizedName = normalizeDisplayName(centralUser?.name);
    if (normalizedName) {
        const tenantUserByName = await tenantPool.query(`
            SELECT id, first_name, last_name, username, email, phone, role, is_active
            FROM users
            WHERE LOWER(TRIM(CONCAT_WS(' ', COALESCE(first_name, ''), COALESCE(last_name, '')))) = LOWER($1)
               OR LOWER(COALESCE(first_name, '')) = LOWER($1)
            ORDER BY CASE WHEN LOWER(COALESCE(role, '')) = 'admin' THEN 0 ELSE 1 END, id ASC
            LIMIT 1
        `, [normalizedName]);

        if (tenantUserByName.rows[0]) {
            return tenantUserByName.rows[0];
        }
    }

    return null;
};

const syncTenantUserFromCentralDirectory = async ({
    centralClient,
    nextCentralUser,
    previousCentralUser,
    password
}) => {
    if (!nextCentralUser || String(nextCentralUser.tenant_type || '').trim().toUpperCase() !== 'TENANT') {
        return null;
    }

    const tenant = await resolveTenantForCentralUser(centralClient, nextCentralUser.entity_id || previousCentralUser?.entity_id);
    if (!tenant?.encrypted_db_url || !tenant?.subdomain) {
        return null;
    }

    const tenantPool = getTenantPool(tenant.subdomain, tenant.encrypted_db_url);
    const tenantUser = await findTenantUserForCentralDirectoryUser(
        tenantPool,
        previousCentralUser || nextCentralUser,
        previousCentralUser?.email || null
    );

    if (!tenantUser) {
        throw new Error('تعذر العثور على حساب المستخدم داخل قاعدة بيانات المستأجر');
    }

    const updates = [];
    const params = [];
    const normalizedName = normalizeDisplayName(nextCentralUser.name);
    const normalizedEmail = normalizeEmailAddress(nextCentralUser.email);
    const normalizedRole = String(nextCentralUser.role || '').trim().toLowerCase();

    if (normalizedName) {
        params.push(normalizedName);
        updates.push(`first_name = $${params.length}`);
        params.push('');
        updates.push(`last_name = $${params.length}`);
    }

    params.push(normalizedEmail);
    updates.push(`email = $${params.length}`);

    if (VALID_TENANT_USER_ROLES.has(normalizedRole)) {
        params.push(normalizedRole);
        updates.push(`role = $${params.length}`);
    }

    params.push(nextCentralUser.is_active !== false);
    updates.push(`is_active = $${params.length}`);

    const passwordToSync = typeof password === 'string' ? password : '';
    if (passwordToSync.length > 0) {
        const passwordHash = await bcrypt.hash(passwordToSync, 10);
        params.push(passwordHash);
        updates.push(`password_hash = $${params.length}`);
    }

    params.push(tenantUser.id);
    const updatedTenantUser = await tenantPool.query(
        `UPDATE users
         SET ${updates.join(', ')}, updated_at = CURRENT_TIMESTAMP
         WHERE id = $${params.length}
         RETURNING id, first_name, last_name, username, email, phone, role, is_active`,
        params
    );

    if (!updatedTenantUser.rows[0]) {
        throw new Error('تعذر تحديث حساب المستأجر');
    }

    if (nextCentralUser.is_active === false) {
        const deletedSessions = await tenantPool.query(
            `DELETE FROM sessions WHERE user_id = $1 RETURNING session_token`,
            [tenantUser.id]
        );

        if (deletedSessions.rows.length > 0) {
            await centralClient.query(
                `DELETE FROM tenant_session_index WHERE session_token = ANY($1)`,
                [deletedSessions.rows.map((row) => row.session_token)]
            );
        }
    }

    return {
        tenant,
        tenantUser: updatedTenantUser.rows[0]
    };
};

// ========== Middleware للتحقق من Super Admin ==========
const verifySuperAdmin = async (req, res, next) => {
    try {
        const userId = req.userId || req.headers['x-user-id'];
        
        if (!userId) {
            return res.status(401).json({ success: false, message: 'غير مصرح - مطلوب تسجيل دخول' });
        }

        const result = await pool.query(`
            SELECT r.name, r.hierarchy_level
            FROM user_roles ur
            JOIN roles r ON ur.role_id = r.id
            WHERE ur.user_id = $1 AND ur.is_active = true
            ORDER BY r.hierarchy_level ASC
            LIMIT 1
        `, [userId]);

        if (result.rows.length === 0) {
            return res.status(403).json({ success: false, message: 'غير مصرح - لا يوجد دور نشط' });
        }

        const userRole = result.rows[0];

        // فقط المستخدمين بمستوى 0 (القيادة العليا) لديهم صلاحيات Super Admin
        if (userRole.hierarchy_level !== 0) {
            return res.status(403).json({ 
                success: false, 
                message: 'غير مصرح - يجب أن تكون من القيادة العليا للوصول لهذه الصفحة' 
            });
        }

        req.userRole = userRole;
        next();
    } catch (error) {
        console.error('خطأ في التحقق من Super Admin:', error);
        res.status(500).json({ success: false, message: 'خطأ في التحقق من الصلاحيات' });
    }
};

// ========== 1. جلب جميع الأدوار ==========
router.get('/roles', verifySuperAdmin, async (req, res) => {
    try {
        const result = await pool.query(`
            SELECT 
                r.id,
                r.name as code,
                r.name_ar,
                r.job_title_ar as title_ar,
                r.job_title_en as title_en,
                r.description,
                r.hierarchy_level,
                r.min_approval_limit,
                r.max_approval_limit,
                r.is_active,
                r.created_at,
                COUNT(DISTINCT ur.user_id) FILTER (WHERE ur.is_active = true) as users_count,
                0 as systems_count
            FROM roles r
            LEFT JOIN user_roles ur ON r.id = ur.role_id
            GROUP BY r.id
            ORDER BY r.hierarchy_level ASC, r.job_title_ar ASC
        `);

        res.json({
            success: true,
            roles: result.rows,
            total: result.rows.length
        });
    } catch (error) {
        console.error('خطأ في جلب الأدوار:', error);
        res.status(500).json({ success: false, message: 'خطأ في جلب الأدوار' });
    }
});

// ========== 2. جلب تفاصيل دور محدد ==========
router.get('/roles/:roleCode', superAdminReadLimiter, verifySuperAdmin, async (req, res) => {
    try {
        const { roleCode } = req.params;

        // يمكن أن يكون roleCode إما id أو name
        const roleResult = await pool.query(`
            SELECT 
                id,
                name as code,
                name_ar,
                job_title_ar as title_ar,
                job_title_en as title_en,
                description,
                hierarchy_level,
                min_approval_limit,
                max_approval_limit,
                is_active
            FROM roles 
            WHERE name = $1 OR id::text = $1
        `, [roleCode]);

        if (roleResult.rows.length === 0) {
            return res.status(404).json({ success: false, message: 'الدور غير موجود' });
        }

        // جلب المستخدمين المعينين لهذا الدور
        const usersResult = await pool.query(`
            SELECT 
                ur.user_id,
                ur.granted_at as assigned_at,
                ur.is_active
            FROM user_roles ur
            WHERE ur.role_id = $1
            ORDER BY ur.granted_at DESC
        `, [roleResult.rows[0].id]);

        const permissionsResult = await pool.query(`
            SELECT
                s.system_code,
                pl.level_code AS permission_level
            FROM role_system_permissions rsp
            JOIN systems s ON s.id = rsp.system_id
            JOIN permission_levels pl ON pl.id = rsp.permission_level_id
            WHERE rsp.role_id = $1
              AND COALESCE(rsp.is_active, true) = true
            ORDER BY s.display_order, s.system_code
        `, [roleResult.rows[0].id]);

        res.json({
            success: true,
            role: roleResult.rows[0],
            permissions: permissionsResult.rows,
            users: usersResult.rows
        });
    } catch (error) {
        console.error('خطأ في جلب تفاصيل الدور:', error);
        res.status(500).json({ success: false, message: 'خطأ في جلب التفاصيل' });
    }
});

// ========== 3. تحديث صلاحيات دور ==========
router.put('/roles/:roleCode/permissions', superAdminWriteLimiter, verifySuperAdmin, async (req, res) => {
    const client = await pool.connect();
    
    try {
        const { roleCode } = req.params;
        const { permissions } = req.body; // [{system_code, permission_level}, ...]

        if (!Array.isArray(permissions)) {
            return res.status(400).json({ success: false, message: 'يجب أن تكون الصلاحيات مصفوفة' });
        }

        const roleResult = await client.query(`
            SELECT id, name
            FROM roles
            WHERE name = $1 OR id::text = $1
            LIMIT 1
        `, [roleCode]);

        if (roleResult.rows.length === 0) {
            return res.status(404).json({ success: false, message: 'الدور غير موجود' });
        }

        const roleId = roleResult.rows[0].id;

        await client.query('BEGIN');

        await client.query(`
            UPDATE role_system_permissions
            SET is_active = false, updated_at = NOW()
            WHERE role_id = $1
        `, [roleId]);

        // إضافة الصلاحيات الجديدة
        for (const perm of permissions) {
            if (!perm.system_code || !perm.permission_level) continue;

            const mappingResult = await client.query(`
                SELECT s.id AS system_id, pl.id AS permission_level_id
                FROM systems s
                JOIN permission_levels pl ON pl.level_code = $2
                WHERE s.system_code = $1
                  AND COALESCE(s.is_active, true) = true
                LIMIT 1
            `, [perm.system_code, perm.permission_level]);

            if (mappingResult.rows.length === 0) continue;

            const { system_id: systemId, permission_level_id: permissionLevelId } = mappingResult.rows[0];

            await client.query(`
                INSERT INTO role_system_permissions (role_id, system_id, permission_level_id, is_active, created_at, updated_at)
                VALUES ($1, $2, $3, true, NOW(), NOW())
                ON CONFLICT (role_id, system_id)
                DO UPDATE SET
                    permission_level_id = EXCLUDED.permission_level_id,
                    is_active = true,
                    updated_at = NOW()
            `, [roleId, systemId, permissionLevelId]);
        }

        await client.query('COMMIT');

        // سجل في audit log
        await pool.query(`
            INSERT INTO audit_log (
                entity_type, entity_reference_id, action_type, 
                user_name, description
            ) VALUES ($1, $2, $3, $4, $5)
        `, [
            'role_permissions',
            roleId,
            'UPDATE',
            req.userId || 'super-admin',
            JSON.stringify({ permissions_count: permissions.length })
        ]);

        res.json({
            success: true,
            message: 'تم تحديث الصلاحيات بنجاح',
            updated_count: permissions.length
        });
    } catch (error) {
        await client.query('ROLLBACK');
        console.error('خطأ في تحديث الصلاحيات:', error);
        res.status(500).json({ success: false, message: 'خطأ في تحديث الصلاحيات' });
    } finally {
        client.release();
    }
});

// ========== 4. تحديث معلومات دور ==========
router.put('/roles/:roleCode', verifySuperAdmin, async (req, res) => {
    try {
        const { roleCode } = req.params;
        const { 
            title_ar, 
            title_en, 
            description, 
            hierarchy_level,
            min_approval_limit,
            max_approval_limit,
            is_active
        } = req.body;

        const result = await pool.query(`
            UPDATE roles SET
                title_ar = COALESCE($1, title_ar),
                title_en = COALESCE($2, title_en),
                description = COALESCE($3, description),
                hierarchy_level = COALESCE($4, hierarchy_level),
                min_approval_limit = COALESCE($5, min_approval_limit),
                max_approval_limit = COALESCE($6, max_approval_limit),
                is_active = COALESCE($7, is_active)
            WHERE code = $8
            RETURNING *
        `, [
            title_ar, 
            title_en, 
            description, 
            hierarchy_level,
            min_approval_limit,
            max_approval_limit,
            is_active,
            roleCode
        ]);

        if (result.rows.length === 0) {
            return res.status(404).json({ success: false, message: 'الدور غير موجود' });
        }

        // سجل في audit log
        await pool.query(`
            INSERT INTO audit_log (
                entity_type, entity_reference_id, action_type, 
                user_name, description
            ) VALUES ($1, $2, $3, $4, $5)
        `, [
            'roles',
            roleCode,
            'UPDATE',
            req.userId || 'super-admin',
            JSON.stringify(req.body)
        ]);

        res.json({
            success: true,
            message: 'تم تحديث الدور بنجاح',
            role: result.rows[0]
        });
    } catch (error) {
        console.error('خطأ في تحديث الدور:', error);
        res.status(500).json({ success: false, message: 'خطأ في تحديث الدور' });
    }
});

// ========== 5. إنشاء دور جديد ==========
router.post('/roles', verifySuperAdmin, async (req, res) => {
    try {
        const {
            code,
            title_ar,
            title_en,
            description,
            hierarchy_level,
            min_approval_limit,
            max_approval_limit,
            level
        } = req.body;

        // التحقق من البيانات المطلوبة
        if (!code || !title_ar || hierarchy_level === undefined) {
            return res.status(400).json({ 
                success: false, 
                message: 'البيانات المطلوبة: code, title_ar, hierarchy_level' 
            });
        }

        const result = await pool.query(`
            INSERT INTO roles (
                name, name_ar, job_title_ar, job_title_en, description,
                level, hierarchy_level, min_approval_limit, max_approval_limit,
                is_active
            ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, true)
            RETURNING *
        `, [
            code,                           // name
            code,                           // name_ar (نفس الكود)
            title_ar,                       // job_title_ar
            title_en || title_ar,          // job_title_en
            description || null,
            level || 'OPERATIONAL',        // level
            hierarchy_level,
            min_approval_limit || 0,
            max_approval_limit || null
        ]);

        // سجل في audit log
        await pool.query(`
            INSERT INTO audit_log (
                entity_type, entity_reference_id, action_type, 
                user_name, description
            ) VALUES ($1, $2, $3, $4, $5)
        `, [
            'roles',
            code,
            'CREATE',
            req.userId || 'super-admin',
            JSON.stringify(req.body)
        ]);

        res.status(201).json({
            success: true,
            message: 'تم إنشاء الدور بنجاح',
            role: result.rows[0]
        });
    } catch (error) {
        if (error.code === '23505') { // unique violation
            return res.status(400).json({ success: false, message: 'الدور موجود بالفعل' });
        }
        console.error('خطأ في إنشاء الدور:', error);
        res.status(500).json({ success: false, message: 'خطأ في إنشاء الدور' });
    }
});

// ========== 6. حذف دور ==========
router.delete('/roles/:roleCode', verifySuperAdmin, async (req, res) => {
    const client = await pool.connect();
    
    try {
        const { roleCode } = req.params;

        // جلب معلومات الدور أولاً
        const roleCheck = await client.query('SELECT id, name, job_title_ar FROM roles WHERE name = $1', [roleCode]);
        
        if (roleCheck.rows.length === 0) {
            return res.status(404).json({ success: false, message: 'الدور غير موجود' });
        }
        
        const roleId = roleCheck.rows[0].id;
        const roleInfo = roleCheck.rows[0];

        // التحقق من عدم وجود مستخدمين نشطين بهذا الدور
        const usersCheck = await client.query(`
            SELECT COUNT(*) as count 
            FROM user_roles ur
            WHERE ur.role_id = $1 AND ur.is_active = true
        `, [roleId]);

        if (parseInt(usersCheck.rows[0].count) > 0) {
            return res.status(400).json({ 
                success: false, 
                message: 'لا يمكن حذف الدور - يوجد مستخدمين نشطين بهذا الدور' 
            });
        }

        await client.query('BEGIN');

        // حذف الصلاحيات (إذا كانت موجودة) - استخدام role_id
        await client.query('DELETE FROM role_permissions WHERE role_id = $1', [roleId]);

        // حذف الدور - استخدام id أفضل من name
        const result = await client.query('DELETE FROM roles WHERE id = $1 RETURNING *', [roleId]);

        if (result.rows.length === 0) {
            await client.query('ROLLBACK');
            return res.status(404).json({ success: false, message: 'الدور غير موجود' });
        }

        await client.query('COMMIT');

        // سجل في audit log
        await pool.query(`
            INSERT INTO audit_log (
                entity_type, entity_reference_id, action_type, 
                user_name, description
            ) VALUES ($1, $2, $3, $4, $5)
        `, [
            'roles',
            roleCode,
            'DELETE',
            req.userId || 'super-admin',
            JSON.stringify({ deleted_role: result.rows[0] })
        ]);

        res.json({
            success: true,
            message: 'تم حذف الدور بنجاح'
        });
    } catch (error) {
        await client.query('ROLLBACK');
        console.error('خطأ في حذف الدور:', error);
        res.status(500).json({ success: false, message: 'خطأ في حذف الدور' });
    } finally {
        client.release();
    }
});

// ========== 7. جلب جميع الأنظمة ومستويات الصلاحيات ==========
router.get('/metadata', async (req, res) => {
    try {
        // جلب الأنظمة
        const systemsResult = await pool.query(`
            SELECT system_code as code, system_name_ar as name_ar, system_name_en as name_en, description_ar as description
            FROM systems
            WHERE is_active = true
            ORDER BY display_order, system_name_ar
        `);

        // جلب مستويات الصلاحيات (إذا كان الجدول موجوداً)
        let permissionLevels = [];
        try {
            const permissionLevelsResult = await pool.query(`
                SELECT level_code as code, level_name_ar as name_ar, level_name_en as name_en, 
                       color_code as color, description_ar as description, priority_order as priority
                FROM permission_levels
                ORDER BY priority_order DESC
            `);
            permissionLevels = permissionLevelsResult.rows;
        } catch (err) {
            console.log('⚠️  جدول permission_levels غير موجود، سيتم استخدام قيم افتراضية');
            permissionLevels = [
                { code: 'FULL', name_ar: 'كامل', name_en: 'Full', color: '#10B981', priority: 5 },
                { code: 'EXECUTIVE', name_ar: 'تنفيذي', name_en: 'Executive', color: '#3B82F6', priority: 4 },
                { code: 'VIEW', name_ar: 'عرض فقط', name_en: 'View Only', color: '#6B7280', priority: 3 }
            ];
        }

        const hierarchyLevelsResult = await pool.query(`
            SELECT DISTINCT hierarchy_level
            FROM roles
            WHERE is_active = true
            ORDER BY hierarchy_level ASC
        `);

        res.json({
            success: true,
            systems: systemsResult.rows,
            permission_levels: permissionLevels,
            hierarchy_levels: hierarchyLevelsResult.rows.map(r => r.hierarchy_level)
        });
    } catch (error) {
        console.error('خطأ في جلب البيانات الوصفية:', error);
        res.status(500).json({ success: false, message: 'خطأ في جلب البيانات' });
    }
});

// ========== 7.4. جلب جميع المستخدمين ==========
router.get('/users', superAdminReadLimiter, verifySuperAdmin, async (req, res) => {
    try {
        await syncTenantDirectoryBackfill();

        const { query = '', tenant_type = '', is_active = '' } = req.query;
        const params = [];
        const conditions = [];

        if (query) {
            const normalizedQuery = String(query).trim();
            const normalizedTenantQuery = normalizeTenantDirectorySearch(normalizedQuery);
            params.push(`%${normalizedQuery}%`);
            const rawQueryParamIndex = params.length;
            const searchConditions = [
                `u.name ILIKE $${rawQueryParamIndex}`,
                `u.email ILIKE $${rawQueryParamIndex}`,
                `COALESCE(u.entity_name, '') ILIKE $${rawQueryParamIndex}`,
                `COALESCE(u.entity_id, '') ILIKE $${rawQueryParamIndex}`
            ];

            if (normalizedTenantQuery) {
                params.push(`%${normalizedTenantQuery}%`);
                searchConditions.push(`COALESCE(t.subdomain, '') ILIKE $${params.length}`);
            }

            conditions.push(`(${searchConditions.join('\n                OR ')})`);
        }

        if (tenant_type) {
            params.push(String(tenant_type).trim().toUpperCase());
            conditions.push(`COALESCE(u.tenant_type, '') = $${params.length}`);
        }

        if (is_active === 'true' || is_active === 'false') {
            params.push(is_active === 'true');
            conditions.push(`u.is_active = $${params.length}`);
        }

        const whereClause = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';
        const [result, totalUsersResult] = await Promise.all([
            pool.query(`
            SELECT
                u.id,
                u.name,
                u.email,
                u.entity_id,
                u.entity_name,
                t.subdomain AS tenant_subdomain,
                u.is_active,
                u.tenant_type,
                u.role AS requested_role_code,
                u.job_title,
                u.created_at,
                active_role.role_code AS current_role_code,
                active_role.role_name_ar AS current_role_name
            FROM users u
            LEFT JOIN LATERAL (
                SELECT
                    r.name AS role_code,
                    COALESCE(NULLIF(r.job_title_ar, ''), NULLIF(r.name_ar, ''), r.name) AS role_name_ar
                FROM user_roles ur
                JOIN roles r ON ur.role_id = r.id
                WHERE ur.user_id = u.id AND ur.is_active = true
                ORDER BY ur.granted_at DESC NULLS LAST, ur.id DESC
                LIMIT 1
            ) active_role ON true
            LEFT JOIN tenants t
                ON u.tenant_type = 'TENANT'
                AND u.entity_id = CONCAT('TEN', LPAD(t.id::text, 6, '0'))
            ${whereClause}
            ORDER BY u.created_at DESC NULLS LAST, u.id DESC
        `, params),
            pool.query('SELECT COUNT(*)::int AS total_count FROM users')
        ]);

        res.json({
            success: true,
            users: result.rows.map((user) => ({
                ...user,
                tenant_login_url: buildTenantLoginUrl(user.tenant_subdomain)
            })),
            total_users: totalUsersResult.rows[0]?.total_count || 0,
            filtered_users: result.rows.length
        });
    } catch (error) {
        console.error('خطأ في جلب المستخدمين:', error);
        res.status(500).json({ success: false, message: 'خطأ في جلب المستخدمين' });
    }
});

// ========== 7.5. جلب معلومات مستخدم ==========
router.get('/users/:userId', superAdminReadLimiter, verifySuperAdmin, async (req, res) => {
    try {
        const { userId } = req.params;

        // جلب معلومات المستخدم
        const userResult = await pool.query(`
            SELECT
                u.id,
                u.name,
                u.email,
                u.entity_id,
                u.entity_name,
                t.subdomain AS tenant_subdomain,
                u.is_active,
                u.tenant_type,
                u.role,
                u.job_title
            FROM users u
            LEFT JOIN tenants t
                ON u.tenant_type = 'TENANT'
                AND u.entity_id = CONCAT('TEN', LPAD(t.id::text, 6, '0'))
            WHERE u.id = $1
        `, [userId]);

        if (userResult.rows.length === 0) {
            return res.status(404).json({ 
                success: false, 
                message: 'المستخدم غير موجود' 
            });
        }

        const user = userResult.rows[0];

        // جلب الدور الحالي للمستخدم
        const roleResult = await pool.query(`
            SELECT r.id as role_id, r.name_ar as role_name, ur.is_active
            FROM user_roles ur
            JOIN roles r ON ur.role_id = r.id
            WHERE ur.user_id = $1 AND ur.is_active = true
            LIMIT 1
        `, [userId]);

        const currentRole = roleResult.rows.length > 0 ? roleResult.rows[0] : null;

        res.json({
            success: true,
            user: {
                id: user.id,
                name: user.name,
                email: user.email,
                entity_id: user.entity_id,
                entity_name: user.entity_name,
                tenant_subdomain: user.tenant_subdomain,
                tenant_login_url: buildTenantLoginUrl(user.tenant_subdomain),
                is_active: user.is_active,
                tenant_type: user.tenant_type,
                requested_role_code: user.role,
                job_title: user.job_title,
                current_role: currentRole
            }
        });
    } catch (error) {
        console.error('خطأ في جلب معلومات المستخدم:', error);
        res.status(500).json({ 
            success: false, 
            message: 'حدث خطأ في جلب معلومات المستخدم',
            error: error.message 
        });
    }
});

// ========== 7.5.1. إنشاء مستخدم ==========
router.post('/users', verifySuperAdmin, async (req, res) => {
    const client = await pool.connect();
    try {
        const {
            name,
            email,
            password,
            tenant_type,
            entity_id,
            entity_name,
            job_title,
            requested_role_code,
            is_active
        } = req.body;

        const normalizedName = String(name || '').trim();
        const normalizedEmail = String(email || '').trim().toLowerCase();
        const normalizedPassword = String(password || '');
        const normalizedTenantType = String(tenant_type || '').trim().toUpperCase();
        const normalizedEntityId = String(entity_id || '').trim();
        const normalizedEntityName = String(entity_name || '').trim();

        if (!normalizedName || !normalizedEmail || !normalizedPassword || !normalizedTenantType || !normalizedEntityId || !normalizedEntityName) {
            return res.status(400).json({ success: false, message: 'جميع الحقول الأساسية مطلوبة' });
        }

        if (!isValidEmail(normalizedEmail)) {
            return res.status(400).json({ success: false, message: 'البريد الإلكتروني غير صالح' });
        }

        if (normalizedPassword.length < 8) {
            return res.status(400).json({ success: false, message: 'كلمة المرور يجب أن تكون 8 أحرف على الأقل' });
        }

        await client.query('BEGIN');

        const existingUser = await findUserByEmail(client, normalizedEmail);
        if (existingUser.rows.length > 0) {
            await client.query('ROLLBACK');
            return res.status(409).json({ success: false, message: 'البريد الإلكتروني مستخدم بالفعل' });
        }

        const passwordHash = await bcrypt.hash(normalizedPassword, 10);
        const userResult = await client.query(`
            INSERT INTO users (
                name, email, role, tenant_type, entity_id, entity_name, is_active, job_title
            ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
            RETURNING id, name, email, role, tenant_type, entity_id, entity_name, is_active, job_title, created_at
        `, [
            normalizedName,
            normalizedEmail,
            normalizeOptionalText(requested_role_code),
            normalizedTenantType,
            normalizedEntityId,
            normalizedEntityName,
            is_active !== false,
            normalizeOptionalText(job_title)
        ]);

        await client.query(`
            INSERT INTO user_credentials (user_id, username, password_hash, is_active, failed_attempts)
            VALUES ($1, $2, $3, $4, 0)
        `, [userResult.rows[0].id, normalizedEmail, passwordHash, is_active !== false]);

        await client.query('COMMIT');

        res.status(201).json({
            success: true,
            message: 'تم إنشاء المستخدم بنجاح',
            user: userResult.rows[0]
        });
    } catch (error) {
        await client.query('ROLLBACK');
        console.error('خطأ في إنشاء المستخدم:', error);
        res.status(error.code === '23505' ? 409 : 500).json({
            success: false,
            message: error.code === '23505' ? 'البريد الإلكتروني مستخدم بالفعل' : 'حدث خطأ أثناء إنشاء المستخدم'
        });
    } finally {
        client.release();
    }
});

// ========== 7.5.2. تحديث مستخدم ==========
router.put('/users/:userId', verifySuperAdmin, async (req, res) => {
    const client = await pool.connect();
    try {
        const { userId } = req.params;
        const {
            name,
            email,
            password,
            tenant_type,
            entity_id,
            entity_name,
            job_title,
            requested_role_code,
            is_active
        } = req.body;

        const normalizedName = String(name || '').trim();
        const normalizedEmail = String(email || '').trim().toLowerCase();
        const normalizedPassword = String(password || '');
        const normalizedTenantType = String(tenant_type || '').trim().toUpperCase();
        const normalizedEntityId = String(entity_id || '').trim();
        const normalizedEntityName = String(entity_name || '').trim();

        if (!normalizedName || !normalizedEmail || !normalizedTenantType || !normalizedEntityId || !normalizedEntityName) {
            return res.status(400).json({ success: false, message: 'جميع الحقول الأساسية مطلوبة' });
        }

        if (!isValidEmail(normalizedEmail)) {
            return res.status(400).json({ success: false, message: 'البريد الإلكتروني غير صالح' });
        }

        if (normalizedPassword && normalizedPassword.length < 8) {
            return res.status(400).json({ success: false, message: 'كلمة المرور يجب أن تكون 8 أحرف على الأقل' });
        }

        await client.query('BEGIN');

        const previousUserResult = await client.query(`
            SELECT id, name, email, role, tenant_type, entity_id, entity_name, is_active, job_title
            FROM users
            WHERE id = $1
            LIMIT 1
        `, [userId]);

        if (previousUserResult.rows.length === 0) {
            await client.query('ROLLBACK');
            return res.status(404).json({ success: false, message: 'المستخدم غير موجود' });
        }

        const existingUser = await findUserByEmail(client, normalizedEmail, userId);
        if (existingUser.rows.length > 0) {
            await client.query('ROLLBACK');
            return res.status(409).json({ success: false, message: 'البريد الإلكتروني مستخدم بالفعل' });
        }

        const userResult = await client.query(`
            UPDATE users SET
                name = $1,
                email = $2,
                role = $3,
                tenant_type = $4,
                entity_id = $5,
                entity_name = $6,
                is_active = $7,
                job_title = $8
            WHERE id = $9
            RETURNING id, name, email, role, tenant_type, entity_id, entity_name, is_active, job_title, created_at
        `, [
            normalizedName,
            normalizedEmail,
            normalizeOptionalText(requested_role_code),
            normalizedTenantType,
            normalizedEntityId,
            normalizedEntityName,
            is_active !== false,
            normalizeOptionalText(job_title),
            userId
        ]);

        if (userResult.rows.length === 0) {
            await client.query('ROLLBACK');
            return res.status(404).json({ success: false, message: 'المستخدم غير موجود' });
        }

        await client.query(`
            UPDATE user_credentials
            SET username = $1, is_active = $2
            WHERE user_id = $3
        `, [normalizedEmail, is_active !== false, userId]);

        if (normalizedPassword) {
            const passwordHash = await bcrypt.hash(normalizedPassword, 10);
            await client.query(`
                UPDATE user_credentials
                SET password_hash = $1
                WHERE user_id = $2
            `, [passwordHash, userId]);
        }

        if (String(userResult.rows[0].tenant_type || '').trim().toUpperCase() === 'TENANT') {
            await syncTenantUserFromCentralDirectory({
                centralClient: client,
                nextCentralUser: userResult.rows[0],
                previousCentralUser: previousUserResult.rows[0],
                password: normalizedPassword || null
            });
        }

        await client.query('COMMIT');

        res.json({
            success: true,
            message: 'تم تحديث المستخدم بنجاح',
            user: userResult.rows[0]
        });
    } catch (error) {
        await client.query('ROLLBACK');
        console.error('خطأ في تحديث المستخدم:', error);
        res.status(error.code === '23505' ? 409 : 500).json({
            success: false,
            message: error.code === '23505' ? 'البريد الإلكتروني مستخدم بالفعل' : 'حدث خطأ أثناء تحديث المستخدم'
        });
    } finally {
        client.release();
    }
});

// ========== 7.5.3. حذف مستخدم ==========
router.delete('/users/:userId', verifySuperAdmin, async (req, res) => {
    const client = await pool.connect();
    try {
        const { userId } = req.params;
        const actingUserId = String(req.userId || req.headers['x-user-id'] || '');

        if (actingUserId && actingUserId === String(userId)) {
            return res.status(400).json({ success: false, message: 'لا يمكن حذف الحساب الحالي' });
        }

        await client.query('BEGIN');
        const existingUserResult = await client.query(`
            SELECT id, name, email, role, tenant_type, entity_id, entity_name, is_active, job_title
            FROM users
            WHERE id = $1
            LIMIT 1
        `, [userId]);

        if (existingUserResult.rows.length === 0) {
            await client.query('ROLLBACK');
            return res.status(404).json({ success: false, message: 'المستخدم غير موجود' });
        }

        if (String(existingUserResult.rows[0].tenant_type || '').trim().toUpperCase() === 'TENANT') {
            await syncTenantUserFromCentralDirectory({
                centralClient: client,
                nextCentralUser: {
                    ...existingUserResult.rows[0],
                    is_active: false
                },
                previousCentralUser: existingUserResult.rows[0],
                password: null
            });
        }

        await client.query('DELETE FROM user_credentials WHERE user_id = $1', [userId]);
        await client.query('DELETE FROM user_roles WHERE user_id = $1', [userId]);
        const result = await client.query('DELETE FROM users WHERE id = $1 RETURNING id, name', [userId]);

        if (result.rows.length === 0) {
            await client.query('ROLLBACK');
            return res.status(404).json({ success: false, message: 'المستخدم غير موجود' });
        }

        await client.query('COMMIT');

        res.json({
            success: true,
            message: 'تم حذف المستخدم بنجاح',
            user: result.rows[0]
        });
    } catch (error) {
        await client.query('ROLLBACK');
        console.error('خطأ في حذف المستخدم:', error);
        res.status(500).json({ success: false, message: 'حدث خطأ أثناء حذف المستخدم' });
    } finally {
        client.release();
    }
});

// ========== 7.6. جلب صلاحيات صفحات المكاتب ==========
router.get('/office-page-access', verifySuperAdmin, async (req, res) => {
    try {
        const { office_id } = req.query;
        if (!office_id) {
            return res.status(400).json({ success: false, message: 'office_id مطلوب' });
        }

        await ensureOfficePageAccessTable();

        const officeResult = await resolveOfficeReference(pool, office_id);

        if (!officeResult) {
            return res.status(404).json({ 
                success: false, 
                message: 'المكتب غير موجود. يمكنك إدخال رقم المكتب أو رقم المستخدم أو entity_id/كود المكتب مثل OFF636298' 
            });
        }

        const office = officeResult;
        const resolvedPages = await pool.query(`
            SELECT page_key
            FROM office_page_access
            WHERE ($1::INTEGER IS NOT NULL AND office_id = $1)
               OR ($2::VARCHAR IS NOT NULL AND office_entity_id = $2)
            ORDER BY page_key
        `, [office.id, office.entity_id]);

        res.json({
            success: true,
            office: {
                id: office.id,
                name: office.name,
                code: office.code,
                entity_id: office.entity_id
            },
            pages: resolvedPages.rows.map(row => row.page_key)
        });
    } catch (error) {
        console.error('خطأ في جلب صلاحيات صفحات المكتب:', error);
        res.status(500).json({ success: false, message: 'خطأ في جلب صلاحيات المكتب' });
    }
});

// ========== 7.7. حفظ صلاحيات صفحات المكاتب ==========
router.post('/office-page-access', verifySuperAdmin, async (req, res) => {
    let client;
    let transactionStarted = false;
    try {
        const { office_id, pages } = req.body;
        if (!office_id || !Array.isArray(pages)) {
            return res.status(400).json({ success: false, message: 'office_id و pages مطلوبين' });
        }

        client = await pool.connect();
        await ensureOfficePageAccessTable();

        const officeResult = await resolveOfficeReference(client, office_id);

        if (!officeResult) {
            return res.status(404).json({ success: false, message: 'المكتب غير موجود' });
        }

        const office = officeResult;
        const cleanPages = [...new Set(pages.filter(Boolean))];

        await client.query('BEGIN');
        transactionStarted = true;
        await client.query(`
            DELETE FROM office_page_access
            WHERE ($1::INTEGER IS NOT NULL AND office_id = $1)
               OR ($2::VARCHAR IS NOT NULL AND office_entity_id = $2)
        `, [office.id, office.entity_id]);

        for (const pageKey of cleanPages) {
            if (office.id) {
                await client.query(`
                    INSERT INTO office_page_access (office_id, office_entity_id, page_key)
                    VALUES ($1, $2, $3)
                    ON CONFLICT (office_id, page_key) DO NOTHING
                `, [office.id, office.entity_id || null, pageKey]);
            } else {
                await client.query(`
                    INSERT INTO office_page_access (office_entity_id, page_key)
                    VALUES ($1, $2)
                    ON CONFLICT (office_entity_id, page_key) DO NOTHING
                `, [office.entity_id, pageKey]);
            }
        }
        await client.query('COMMIT');
        transactionStarted = false;

        try {
            await pool.query(`
                INSERT INTO audit_log (
                    entity_type, entity_reference_id, action_type,
                    user_name, description
                ) VALUES ($1, $2, $3, $4, $5)
            `, [
                'office_page_access',
                office.entity_id || office.id,
                'UPDATE',
                req.userId || req.headers['x-user-id'] || 'super-admin',
                JSON.stringify({ office_id: office.id, office_entity_id: office.entity_id, pages: cleanPages })
            ]);
        } catch (auditError) {
            console.log('⚠️  لم يتم تسجيل صلاحيات المكتب في audit log:', auditError.message);
        }

        res.json({
            success: true,
            message: 'تم حفظ صلاحيات صفحات المكتب بنجاح',
            office: {
                id: office.id,
                name: office.name,
                code: office.code,
                entity_id: office.entity_id
            },
            pages: cleanPages
        });
    } catch (error) {
        if (client && transactionStarted) {
            await client.query('ROLLBACK');
        }
        console.error('خطأ في حفظ صلاحيات صفحات المكتب:', error);
        res.status(500).json({ success: false, message: 'خطأ في حفظ صلاحيات المكتب' });
    } finally {
        if (client) {
            client.release();
        }
    }
});

// ========== 8. تعيين دور لمستخدم ==========
router.post('/users/:userId/role', superAdminWriteLimiter, verifySuperAdmin, async (req, res) => {
    try {
        const { userId } = req.params;
        const { role_code } = req.body;

        if (!role_code) {
            return res.status(400).json({ success: false, message: 'role_code مطلوب' });
        }

        // التحقق من وجود المستخدم
        const userCheck = await pool.query('SELECT id FROM users WHERE id = $1', [userId]);
        if (userCheck.rows.length === 0) {
            return res.status(404).json({ success: false, message: 'المستخدم غير موجود' });
        }

        // التحقق من وجود الدور والحصول على role_id
        const roleCheck = await pool.query('SELECT id, name, job_title_ar FROM roles WHERE name = $1', [role_code]);
        if (roleCheck.rows.length === 0) {
            return res.status(404).json({ success: false, message: 'الدور غير موجود' });
        }

        const roleId = roleCheck.rows[0].id;
        const roleName = roleCheck.rows[0].job_title_ar;

        // إلغاء تفعيل الأدوار القديمة
        await pool.query(`
            UPDATE user_roles 
            SET is_active = false 
            WHERE user_id = $1
        `, [userId]);

        // البحث عن سجل موجود لنفس user_id و role_id
        const existingRole = await pool.query(`
            SELECT id FROM user_roles 
            WHERE user_id = $1 AND role_id = $2 
            AND (entity_id IS NULL OR entity_id = '')
            LIMIT 1
        `, [userId, roleId]);

        let result;
        if (existingRole.rows.length > 0) {
            // تحديث السجل الموجود
            result = await pool.query(`
                UPDATE user_roles 
                SET is_active = true, granted_at = NOW()
                WHERE id = $1
                RETURNING *
            `, [existingRole.rows[0].id]);
        } else {
            // إنشاء سجل جديد
            result = await pool.query(`
                INSERT INTO user_roles (user_id, role_id, entity_id, is_active, granted_at)
                VALUES ($1, $2, NULL, true, NOW())
                RETURNING *
            `, [userId, roleId]);
        }

        // سجل في audit log (إذا كان الجدول موجوداً)
        try {
            await pool.query(`
                INSERT INTO audit_log (
                    entity_type, entity_reference_id, action_type, 
                    user_name, description
                ) VALUES ($1, $2, $3, $4, $5)
            `, [
                'user_roles',
                userId,
                'ASSIGN_ROLE',
                req.userId || req.headers['x-user-id'] || 'super-admin',
                JSON.stringify({ role_code, role_name: roleName, user_id: userId })
            ]);
        } catch (auditError) {
            console.log('⚠️  لم يتم تسجيل في audit log:', auditError.message);
        }

        res.json({
            success: true,
            message: `تم تعيين الدور "${roleName}" بنجاح`,
            user_role: result.rows[0]
        });
    } catch (error) {
        console.error('خطأ في تعيين الدور:', error);
        res.status(500).json({ 
            success: false, 
            message: 'خطأ في تعيين الدور: ' + error.message 
        });
    }
});

// ========== 9. إلغاء دور من مستخدم ==========
router.delete('/users/:userId/role', verifySuperAdmin, async (req, res) => {
    try {
        const { userId } = req.params;

        // التحقق من وجود المستخدم
        const userCheck = await pool.query('SELECT id FROM users WHERE id = $1', [userId]);
        if (userCheck.rows.length === 0) {
            return res.status(404).json({ success: false, message: 'المستخدم غير موجود' });
        }

        // إلغاء تفعيل جميع الأدوار
        const result = await pool.query(`
            UPDATE user_roles 
            SET is_active = false 
            WHERE user_id = $1
            RETURNING *
        `, [userId]);

        if (result.rows.length === 0) {
            return res.status(404).json({ success: false, message: 'لا توجد أدوار مُعينة لهذا المستخدم' });
        }

        // سجل في audit log (إذا كان الجدول موجوداً)
        try {
            await pool.query(`
                INSERT INTO audit_log (
                    entity_type, entity_reference_id, action_type, 
                    user_name, description
                ) VALUES ($1, $2, $3, $4, $5)
            `, [
                'user_roles',
                userId,
                'REVOKE_ROLE',
                req.userId || req.headers['x-user-id'] || 'super-admin',
                JSON.stringify({ user_id: userId, revoked_count: result.rows.length })
            ]);
        } catch (auditError) {
            console.log('⚠️  لم يتم تسجيل في audit log:', auditError.message);
        }

        res.json({
            success: true,
            message: `تم إلغاء ${result.rows.length} دور بنجاح`
        });
    } catch (error) {
        console.error('خطأ في إلغاء الدور:', error);
        res.status(500).json({ 
            success: false, 
            message: 'خطأ في إلغاء الدور: ' + error.message 
        });
    }
});

// ========== 10. سجل التعديلات (Audit Log) ==========
router.get('/audit-log', verifySuperAdmin, async (req, res) => {
    try {
        const { limit = 50, offset = 0, entity_type } = req.query;

        let query = `
            SELECT *
            FROM audit_log
            WHERE entity_type IN ('roles', 'role_permissions', 'user_roles')
        `;

        const params = [];
        if (entity_type) {
            params.push(entity_type);
            query += ` AND entity_type = $${params.length}`;
        }

        query += ` ORDER BY created_at DESC LIMIT $${params.length + 1} OFFSET $${params.length + 2}`;
        params.push(limit, offset);

        const result = await pool.query(query, params);

        const countResult = await pool.query(`
            SELECT COUNT(*) as total
            FROM audit_log
            WHERE entity_type IN ('roles', 'role_permissions', 'user_roles')
            ${entity_type ? 'AND entity_type = $1' : ''}
        `, entity_type ? [entity_type] : []);

        res.json({
            success: true,
            logs: result.rows,
            total: parseInt(countResult.rows[0].total),
            limit: parseInt(limit),
            offset: parseInt(offset)
        });
    } catch (error) {
        console.error('خطأ في جلب سجل التعديلات:', error);
        res.status(500).json({ success: false, message: 'خطأ في جلب السجل' });
    }
});

// ========== 11. إدارة إعدادات الصفحة الرئيسية ==========
router.get('/homepage-settings/public', homepageSettingsReadLimiter, async (_req, res) => {
    try {
        const [settings, sections, heroMediaList] = await Promise.all([
            getHomepageSettings(),
            getHomepageSections(),
            getHeroMediaList(true)
        ]);
        res.json({ success: true, settings, sections, heroMediaList });
    } catch (error) {
        console.error('خطأ في جلب إعدادات الصفحة الرئيسية (public):', error);
        res.status(500).json({ success: false, message: 'تعذر جلب إعدادات الصفحة الرئيسية' });
    }
});

router.get('/homepage-settings', verifySuperAdmin, homepageSettingsReadLimiter, async (_req, res) => {
    try {
        const settings = await getHomepageSettings();
        const sections = await getHomepageSections();
        res.json({ success: true, settings, sections });
    } catch (error) {
        console.error('خطأ في جلب إعدادات الصفحة الرئيسية:', error);
        res.status(500).json({ success: false, message: 'تعذر جلب إعدادات الصفحة الرئيسية' });
    }
});

router.put('/homepage-settings', verifySuperAdmin, homepageSettingsWriteLimiter, async (req, res) => {
    try {
        const currentSettings = await getHomepageSettings();
        const mergedSettings = {
            ...currentSettings,
            ...req.body,
            theme: { ...currentSettings.theme, ...(req.body?.theme || {}) },
            typography: { ...currentSettings.typography, ...(req.body?.typography || {}) },
            heroMedia: { ...currentSettings.heroMedia, ...(req.body?.heroMedia || {}) },
            tourMedia: { ...currentSettings.tourMedia, ...(req.body?.tourMedia || {}) }
        };
        const sanitized = sanitizeHomepageSettings(mergedSettings);
        await saveHomepageSettings(sanitized);
        res.json({ success: true, message: 'تم حفظ إعدادات الصفحة الرئيسية', settings: sanitized });
    } catch (error) {
        console.error('خطأ في تحديث إعدادات الصفحة الرئيسية:', error);
        res.status(500).json({ success: false, message: 'تعذر حفظ إعدادات الصفحة الرئيسية' });
    }
});

router.put('/homepage-settings/hero-media', homepageSettingsWriteLimiter, verifySuperAdmin, async (req, res) => {
    try {
        const currentSettings = await getHomepageSettings();
        const mergedSettings = {
            ...currentSettings,
            heroImageMode: req.body?.heroImageMode ?? currentSettings.heroImageMode,
            heroMedia: { ...currentSettings.heroMedia, ...(req.body?.heroMedia || {}) }
        };
        const sanitized = sanitizeHomepageSettings(mergedSettings);
        await saveHomepageSettings(sanitized);
        res.json({
            success: true,
            message: 'تم حفظ وسائط Hero بنجاح',
            heroImageMode: sanitized.heroImageMode,
            heroMedia: sanitized.heroMedia
        });
    } catch (error) {
        console.error('خطأ في تحديث وسائط Hero:', error);
        res.status(500).json({ success: false, message: 'تعذر حفظ وسائط Hero' });
    }
});

router.put('/homepage-settings/tour-media', homepageSettingsWriteLimiter, verifySuperAdmin, async (req, res) => {
    try {
        const currentSettings = await getHomepageSettings();
        const mergedSettings = {
            ...currentSettings,
            tourMedia: { ...currentSettings.tourMedia, ...(req.body?.tourMedia || {}) }
        };
        const sanitized = sanitizeHomepageSettings(mergedSettings);
        await saveHomepageSettings(sanitized);
        res.json({
            success: true,
            message: 'تم حفظ وسائط قسم الجولة بنجاح',
            tourMedia: sanitized.tourMedia
        });
    } catch (error) {
        console.error('خطأ في تحديث وسائط قسم الجولة:', error);
        res.status(500).json({ success: false, message: 'تعذر حفظ وسائط قسم الجولة' });
    }
});

router.post('/homepage-settings/logo', homepageSettingsUploadLimiter, verifySuperAdmin, wrapMulter(homepageImageUpload.single('logo'), MAX_HOMEPAGE_IMAGE_SIZE_BYTES), async (req, res) => {
    try {
        if (!req.file) {
            return res.status(400).json({ success: false, message: 'يرجى اختيار صورة الشعار' });
        }
        const currentSettings = await getHomepageSettings();
        const previousLogoUrl = currentSettings.logoUrl;
        const logoUrl = buildHomepageUploadUrl(req.file.filename);
        const settings = sanitizeHomepageSettings({ ...currentSettings, logoUrl, logoPublicId: null });
        await saveHomepageSettings(settings);
        if (previousLogoUrl && previousLogoUrl !== logoUrl) {
            await deleteHomepageUploadByUrl(previousLogoUrl);
        }
        res.json({ success: true, message: 'تم رفع الشعار بنجاح', logoUrl, settings });
    } catch (error) {
        console.error('خطأ في رفع شعار الصفحة الرئيسية:', error);
        res.status(500).json({ success: false, message: 'تعذر رفع الشعار' });
    }
});

router.post('/homepage-settings/hero-image', homepageSettingsUploadLimiter, verifySuperAdmin, wrapMulter(homepageImageUpload.single('heroImage'), MAX_HOMEPAGE_IMAGE_SIZE_BYTES), async (req, res) => {
    try {
        if (!req.file) {
            return res.status(400).json({ success: false, message: 'يرجى اختيار صورة الخلفية الرئيسية' });
        }
        if (!req.file.filename) {
            return res.status(400).json({ success: false, message: 'فشل رفع الصورة: لم يتم استلام ملف صالح. يرجى إعادة المحاولة.' });
        }
        const currentSettings = await getHomepageSettings();
        const heroImageUrl = buildHomepageUploadUrl(req.file.filename);
        const caption = sanitizeCaptionText(req.body?.heroCaption || req.body?.mediaCaption || '');
        const title = String(req.body?.title || caption || '').trim().slice(0, 200) || null;
        const rawTarget = String(req.body?.target || 'frame').toLowerCase();
        const target = rawTarget === 'background' ? 'background' : 'frame';

        // Save to hero_media table
        await ensureHeroMediaTable();
        const { rows: existingRows } = await pool.query('SELECT COALESCE(MAX(order_index),0) AS max_order FROM hero_media');
        const nextOrder = (existingRows[0]?.max_order || 0) + 1;
        const insertResult = await pool.query(
            `INSERT INTO hero_media (type, url, title, target, order_index, is_active, cloudinary_public_id) VALUES ($1, $2, $3, $4, $5, true, $6) RETURNING id`,
            ['image', heroImageUrl, title, target, nextOrder, null]
        );
        const newId = insertResult.rows[0]?.id;

        // Also keep heroMedia JSONB settings in sync for backward compat
        const imageUrls = [
            ...(Array.isArray(currentSettings.heroMedia?.imageUrls) ? currentSettings.heroMedia.imageUrls : []),
            heroImageUrl
        ].slice(-8);
        const imageCaptions = [
            ...(Array.isArray(currentSettings.heroMedia?.imageCaptions) ? currentSettings.heroMedia.imageCaptions : []),
            caption
        ].slice(-8);
        const settings = sanitizeHomepageSettings({
            ...currentSettings,
            heroImageUrl,
            heroMedia: {
                ...(currentSettings.heroMedia || {}),
                activeType: 'image',
                imageUrls,
                imageCaptions,
                activeImageIndex: Math.max(0, imageUrls.length - 1)
            }
        });
        await saveHomepageSettings(settings);
        res.json({ success: true, message: 'تم رفع صورة الـ Hero بنجاح', heroImageUrl, heroMediaId: newId, settings });
    } catch (error) {
        console.error('خطأ في رفع صورة Hero:', error);
        res.status(500).json({ success: false, message: 'تعذر رفع صورة Hero' });
    }
});

router.post('/homepage-settings/hero-video', homepageSettingsUploadLimiter, verifySuperAdmin, wrapMulter(homepageVideoUpload.single('heroVideo'), MAX_HOMEPAGE_VIDEO_SIZE_BYTES), async (req, res) => {
    try {
        if (!req.file) {
            return res.status(400).json({ success: false, message: 'يرجى اختيار فيديو الخلفية الرئيسية' });
        }
        if (!req.file.filename) {
            return res.status(400).json({ success: false, message: 'فشل رفع الفيديو: لم يتم استلام ملف صالح. يرجى إعادة المحاولة.' });
        }
        const currentSettings = await getHomepageSettings();
        const uploadedVideoUrl = buildHomepageUploadUrl(req.file.filename);
        const caption = sanitizeCaptionText(req.body?.heroCaption || req.body?.mediaCaption || '');
        const description = sanitizeShortText(req.body?.heroDescription || req.body?.mediaDescription || '', 300);
        const title = String(req.body?.title || caption || '').trim().slice(0, 200) || null;
        const rawTarget = String(req.body?.target || 'frame').toLowerCase();
        const target = rawTarget === 'background' ? 'background' : 'frame';

        // Save to hero_media table
        await ensureHeroMediaTable();
        const { rows: existingRows } = await pool.query('SELECT COALESCE(MAX(order_index),0) AS max_order FROM hero_media');
        const nextOrder = (existingRows[0]?.max_order || 0) + 1;
        const insertResult = await pool.query(
            `INSERT INTO hero_media (type, url, title, target, order_index, is_active, cloudinary_public_id) VALUES ($1, $2, $3, $4, $5, true, $6) RETURNING id`,
            ['video', uploadedVideoUrl, title, target, nextOrder, null]
        );
        const newId = insertResult.rows[0]?.id;

        // Also keep heroMedia JSONB settings in sync for backward compat
        const previousVideoUrls = Array.isArray(currentSettings.heroMedia?.videoUrls)
            ? currentSettings.heroMedia.videoUrls
            : (currentSettings.heroMedia?.videoUrl ? [currentSettings.heroMedia.videoUrl] : []);
        const videoUrls = [...previousVideoUrls, uploadedVideoUrl].slice(-8);
        const videoCaptions = [
            ...(Array.isArray(currentSettings.heroMedia?.videoCaptions) ? currentSettings.heroMedia.videoCaptions : []),
            caption
        ].slice(-8);
        const videoDescriptions = [
            ...(Array.isArray(currentSettings.heroMedia?.videoDescriptions) ? currentSettings.heroMedia.videoDescriptions : []),
            description
        ].slice(-8);
        const settings = sanitizeHomepageSettings({
            ...currentSettings,
            heroMedia: {
                ...(currentSettings.heroMedia || {}),
                activeType: 'video',
                videoUrls,
                videoCaptions,
                videoDescriptions,
                activeVideoIndex: Math.max(0, videoUrls.length - 1),
                videoUrl: videoUrls[videoUrls.length - 1] || ''
            }
        });
        await saveHomepageSettings(settings);
        res.json({ success: true, message: 'تم رفع فيديو Hero بنجاح', videoUrl: uploadedVideoUrl, heroMediaId: newId, settings });
    } catch (error) {
        console.error('خطأ في رفع فيديو Hero:', error);
        res.status(500).json({ success: false, message: 'تعذر رفع فيديو Hero' });
    }
});

// ========== 12. رفع صورة قسم "احجز جولة" ==========
router.post('/homepage-settings/tour-image', homepageSettingsUploadLimiter, verifySuperAdmin, wrapMulter(homepageImageUpload.single('tourImage'), MAX_HOMEPAGE_IMAGE_SIZE_BYTES), async (req, res) => {
    try {
        if (!req.file) {
            return res.status(400).json({ success: false, message: 'يرجى اختيار صورة قسم الجولة' });
        }
        const currentSettings = await getHomepageSettings();
        const previousImageUrl = currentSettings.tourMedia?.imageUrl;
        const imageUrl = buildHomepageUploadUrl(req.file.filename);
        const settings = sanitizeHomepageSettings({
            ...currentSettings,
            tourMedia: {
                ...(currentSettings.tourMedia || {}),
                activeType: 'image',
                imageUrl,
                imagePublicId: null
            }
        });
        await saveHomepageSettings(settings);
        if (previousImageUrl && previousImageUrl !== imageUrl) {
            await deleteHomepageUploadByUrl(previousImageUrl);
        }
        res.json({ success: true, message: 'تم رفع صورة قسم الجولة بنجاح', imageUrl, settings });
    } catch (error) {
        console.error('خطأ في رفع صورة قسم الجولة:', error);
        res.status(500).json({ success: false, message: 'تعذر رفع صورة قسم الجولة' });
    }
});

// ========== 13. رفع فيديو قسم "احجز جولة" ==========
router.post('/homepage-settings/tour-video', homepageSettingsUploadLimiter, verifySuperAdmin, wrapMulter(homepageVideoUpload.single('tourVideo'), MAX_HOMEPAGE_VIDEO_SIZE_BYTES), async (req, res) => {
    try {
        if (!req.file) {
            return res.status(400).json({ success: false, message: 'يرجى اختيار فيديو قسم الجولة' });
        }
        const currentSettings = await getHomepageSettings();
        const previousVideoUrl = currentSettings.tourMedia?.videoUrl;
        const videoUrl = buildHomepageUploadUrl(req.file.filename);
        const settings = sanitizeHomepageSettings({
            ...currentSettings,
            tourMedia: {
                ...(currentSettings.tourMedia || {}),
                activeType: 'video',
                videoUrl,
                videoPublicId: null
            }
        });
        await saveHomepageSettings(settings);
        if (previousVideoUrl && previousVideoUrl !== videoUrl) {
            await deleteHomepageUploadByUrl(previousVideoUrl);
        }
        res.json({ success: true, message: 'تم رفع فيديو قسم الجولة بنجاح', videoUrl, settings });
    } catch (error) {
        console.error('خطأ في رفع فيديو قسم الجولة:', error);
        res.status(500).json({ success: false, message: 'تعذر رفع فيديو قسم الجولة' });
    }
});

router.post('/homepage-sections', verifySuperAdmin, homepageSectionsWriteLimiter, async (req, res) => {
    try {
        await ensureHomepageSectionsTable();
        const title = sanitizeSectionTitle(req.body?.title);
        if (!title) {
            return res.status(400).json({ success: false, message: 'عنوان القسم مطلوب' });
        }
        const description = sanitizeSectionDescription(req.body?.description || '');
        const link = sanitizeOptionalUrlPath(req.body?.link || '');
        const orderIndex = clampNumber(req.body?.order_index, 0, 9999, 0);
        const iconUrl = sanitizeSectionIconValue(req.body?.icon_url, 'fa:fas fa-square');
        await pool.query(
            `INSERT INTO sections (title, description, icon_url, link, order_index)
             VALUES ($1, $2, $3, $4, $5)`,
            [title, description, iconUrl, link || null, orderIndex]
        );
        const sections = await getHomepageSections();
        res.json({ success: true, sections });
    } catch (error) {
        console.error('خطأ في إضافة قسم رئيسي:', error);
        res.status(500).json({ success: false, message: 'تعذر إضافة القسم الرئيسي' });
    }
});

router.put('/homepage-sections/:id', verifySuperAdmin, homepageSectionsWriteLimiter, async (req, res) => {
    try {
        await ensureHomepageSectionsTable();
        const sectionId = Number(req.params.id);
        if (!Number.isInteger(sectionId) || sectionId <= 0) {
            return res.status(400).json({ success: false, message: 'معرّف القسم غير صالح' });
        }
        const title = sanitizeSectionTitle(req.body?.title);
        if (!title) {
            return res.status(400).json({ success: false, message: 'عنوان القسم مطلوب' });
        }
        const description = sanitizeSectionDescription(req.body?.description || '');
        const link = sanitizeOptionalUrlPath(req.body?.link || '');
        const orderIndex = clampNumber(req.body?.order_index, 0, 9999, 0);
        const iconUrl = sanitizeSectionIconValue(req.body?.icon_url, 'fa:fas fa-square');
        const updateResult = await pool.query(
            `UPDATE sections
             SET title = $1, description = $2, icon_url = $3, link = $4, order_index = $5
             WHERE id = $6`,
            [title, description, iconUrl, link || null, orderIndex, sectionId]
        );
        if (updateResult.rowCount === 0) {
            return res.status(404).json({ success: false, message: 'القسم غير موجود' });
        }
        const sections = await getHomepageSections();
        res.json({ success: true, sections });
    } catch (error) {
        console.error('خطأ في تحديث القسم الرئيسي:', error);
        res.status(500).json({ success: false, message: 'تعذر تحديث القسم الرئيسي' });
    }
});

router.delete('/homepage-sections/:id', verifySuperAdmin, homepageSectionsWriteLimiter, async (req, res) => {
    try {
        await ensureHomepageSectionsTable();
        const sectionId = Number(req.params.id);
        if (!Number.isInteger(sectionId) || sectionId <= 0) {
            return res.status(400).json({ success: false, message: 'معرّف القسم غير صالح' });
        }
        const deleteResult = await pool.query('DELETE FROM sections WHERE id = $1', [sectionId]);
        if (deleteResult.rowCount === 0) {
            return res.status(404).json({ success: false, message: 'القسم غير موجود' });
        }
        const sections = await getHomepageSections();
        res.json({ success: true, sections });
    } catch (error) {
        console.error('خطأ في حذف القسم الرئيسي:', error);
        res.status(500).json({ success: false, message: 'تعذر حذف القسم الرئيسي' });
    }
});

router.post('/homepage-sections/:id/icon', homepageSettingsUploadLimiter, verifySuperAdmin, wrapMulter(homepageImageUpload.single('icon'), MAX_HOMEPAGE_IMAGE_SIZE_BYTES), async (req, res) => {
    try {
        if (!req.file) {
            return res.status(400).json({ success: false, message: 'يرجى اختيار أيقونة القسم' });
        }
        const sectionId = Number(req.params.id);
        if (!Number.isInteger(sectionId) || sectionId <= 0) {
            return res.status(400).json({ success: false, message: 'معرّف القسم غير صالح' });
        }
        await ensureHomepageSectionsTable();
        const existingSection = await pool.query('SELECT icon_url FROM sections WHERE id = $1', [sectionId]);
        if (existingSection.rowCount === 0) {
            await deleteHomepageUploadByUrl(buildHomepageUploadUrl(req.file.filename));
            return res.status(404).json({ success: false, message: 'القسم غير موجود' });
        }
        const previousIconUrl = existingSection.rows[0]?.icon_url || '';
        const iconUrl = buildHomepageUploadUrl(req.file.filename);
        const updateResult = await pool.query(
            'UPDATE sections SET icon_url = $1 WHERE id = $2',
            [iconUrl, sectionId]
        );
        if (updateResult.rowCount > 0 && previousIconUrl && previousIconUrl !== iconUrl) {
            await deleteHomepageUploadByUrl(previousIconUrl);
        }
        const sections = await getHomepageSections();
        res.json({ success: true, icon_url: iconUrl, sections });
    } catch (error) {
        console.error('خطأ في رفع أيقونة القسم الرئيسي:', error);
        res.status(500).json({ success: false, message: 'تعذر رفع أيقونة القسم' });
    }
});

// ========== Hero Media Management (hero_media table) ==========

router.get('/hero-media', verifySuperAdmin, homepageSettingsReadLimiter, async (_req, res) => {
    try {
        const items = await getHeroMediaList(false);
        res.json({ success: true, heroMediaList: items });
    } catch (error) {
        console.error('خطأ في جلب قائمة Hero Media:', error);
        res.status(500).json({ success: false, message: 'تعذر جلب قائمة الوسائط' });
    }
});

router.delete('/hero-media/:id', verifySuperAdmin, homepageSettingsWriteLimiter, async (req, res) => {
    try {
        const id = Number(req.params.id);
        if (!Number.isInteger(id) || id <= 0) {
            return res.status(400).json({ success: false, message: 'معرّف الوسائط غير صالح' });
        }
        await ensureHeroMediaTable();
        const deleteResult = await pool.query(
            'DELETE FROM hero_media WHERE id = $1 RETURNING url, type, cloudinary_public_id',
            [id]
        );
        if (deleteResult.rowCount === 0) {
            return res.status(404).json({ success: false, message: 'الوسائط غير موجودة' });
        }
        const deletedRow = deleteResult.rows[0];
        await deleteHomepageUploadByUrl(deletedRow.url);
        const items = await getHeroMediaList(false);
        res.json({ success: true, message: 'تم حذف الوسائط بنجاح', heroMediaList: items });
    } catch (error) {
        console.error('خطأ في حذف Hero Media:', error);
        res.status(500).json({ success: false, message: 'تعذر حذف الوسائط' });
    }
});

router.patch('/hero-media/:id/toggle', verifySuperAdmin, homepageSettingsWriteLimiter, async (req, res) => {
    try {
        const id = Number(req.params.id);
        if (!Number.isInteger(id) || id <= 0) {
            return res.status(400).json({ success: false, message: 'معرّف الوسائط غير صالح' });
        }
        await ensureHeroMediaTable();
        const updateResult = await pool.query(
            'UPDATE hero_media SET is_active = NOT is_active WHERE id = $1 RETURNING id, is_active',
            [id]
        );
        if (updateResult.rowCount === 0) {
            return res.status(404).json({ success: false, message: 'الوسائط غير موجودة' });
        }
        const items = await getHeroMediaList(false);
        res.json({ success: true, message: 'تم تحديث حالة الوسائط', is_active: updateResult.rows[0].is_active, heroMediaList: items });
    } catch (error) {
        console.error('خطأ في تبديل حالة Hero Media:', error);
        res.status(500).json({ success: false, message: 'تعذر تحديث حالة الوسائط' });
    }
});

router.patch('/hero-media/reorder', verifySuperAdmin, homepageSettingsWriteLimiter, async (req, res) => {
    try {
        const items = req.body?.items;
        if (!Array.isArray(items) || items.length === 0) {
            return res.status(400).json({ success: false, message: 'يرجى إرسال قائمة الترتيب' });
        }
        await ensureHeroMediaTable();
        for (const item of items) {
            const id = Number(item.id);
            const orderIndex = Number(item.order_index);
            if (!Number.isInteger(id) || id <= 0 || !Number.isFinite(orderIndex)) continue;
            await pool.query('UPDATE hero_media SET order_index = $1 WHERE id = $2', [orderIndex, id]);
        }
        const updatedItems = await getHeroMediaList(false);
        res.json({ success: true, message: 'تم إعادة ترتيب الوسائط', heroMediaList: updatedItems });
    } catch (error) {
        console.error('خطأ في إعادة ترتيب Hero Media:', error);
        res.status(500).json({ success: false, message: 'تعذر إعادة ترتيب الوسائط' });
    }
});

router.patch('/hero-media/:id/title', verifySuperAdmin, homepageSettingsWriteLimiter, async (req, res) => {
    try {
        const id = Number(req.params.id);
        if (!Number.isInteger(id) || id <= 0) {
            return res.status(400).json({ success: false, message: 'معرّف الوسائط غير صالح' });
        }
        const title = String(req.body?.title || '').trim().slice(0, 200) || null;
        await ensureHeroMediaTable();
        const updateResult = await pool.query('UPDATE hero_media SET title = $1 WHERE id = $2 RETURNING id', [title, id]);
        if (updateResult.rowCount === 0) {
            return res.status(404).json({ success: false, message: 'الوسائط غير موجودة' });
        }
        res.json({ success: true, message: 'تم تحديث العنوان' });
    } catch (error) {
        console.error('خطأ في تحديث عنوان Hero Media:', error);
        res.status(500).json({ success: false, message: 'تعذر تحديث العنوان' });
    }
});

router.patch('/hero-media/:id/target', verifySuperAdmin, homepageSettingsWriteLimiter, async (req, res) => {
    try {
        const id = Number(req.params.id);
        if (!Number.isInteger(id) || id <= 0) {
            return res.status(400).json({ success: false, message: 'معرّف الوسائط غير صالح' });
        }
        const rawTarget = String(req.body?.target || 'frame').toLowerCase();
        const target = rawTarget === 'background' ? 'background' : 'frame';
        await ensureHeroMediaTable();
        const updateResult = await pool.query('UPDATE hero_media SET target = $1 WHERE id = $2 RETURNING id', [target, id]);
        if (updateResult.rowCount === 0) {
            return res.status(404).json({ success: false, message: 'الوسائط غير موجودة' });
        }
        const items = await getHeroMediaList(false);
        res.json({ success: true, message: 'تم تحديث وجهة الوسائط', target, heroMediaList: items });
    } catch (error) {
        console.error('خطأ في تحديث وجهة Hero Media:', error);
        res.status(500).json({ success: false, message: 'تعذر تحديث وجهة الوسائط' });
    }
});

// ========== 7.8. جلب صلاحيات صفحات المستأجرين ==========
router.get('/tenant-page-access', superAdminReadLimiter, verifySuperAdmin, async (req, res) => {
    try {
        const { tenant_id } = req.query;
        if (!tenant_id) {
            return res.status(400).json({ success: false, message: 'tenant_id مطلوب' });
        }

        await ensureTenantPageAccessTable();

        const tenantResult = await resolveTenantReference(pool, tenant_id);
        if (!tenantResult) {
            return res.status(404).json({
                success: false,
                message: 'المستأجر غير موجود. يمكنك إدخال رقم المستأجر أو الإيميل أو entity_id أو اسم/رابط المستأجر مثل moka.naiosherp.com'
            });
        }

        const resolvedPages = await pool.query(`
            SELECT page_key
            FROM tenant_page_access
            WHERE ($1::INTEGER IS NOT NULL AND tenant_id = $1)
               OR ($2::VARCHAR IS NOT NULL AND tenant_entity_id = $2)
            ORDER BY page_key
        `, [tenantResult.id, tenantResult.entity_id]);

        return res.json({
            success: true,
            tenant: {
                id: tenantResult.id,
                name: tenantResult.name,
                subdomain: tenantResult.subdomain,
                entity_id: tenantResult.entity_id
            },
            pages: resolvedPages.rows.map((row) => row.page_key)
        });
    } catch (error) {
        console.error('خطأ في جلب صلاحيات صفحات المستأجر:', error);
        return res.status(500).json({ success: false, message: 'خطأ في جلب صلاحيات المستأجر' });
    }
});

// ========== 7.9. حفظ صلاحيات صفحات المستأجرين ==========
router.post('/tenant-page-access', superAdminWriteLimiter, verifySuperAdmin, async (req, res) => {
    let client;
    let transactionStarted = false;
    try {
        const { tenant_id, pages } = req.body;
        if (!tenant_id || !Array.isArray(pages)) {
            return res.status(400).json({ success: false, message: 'tenant_id و pages مطلوبين' });
        }

        client = await pool.connect();
        await ensureTenantPageAccessTable();

        const tenantResult = await resolveTenantReference(client, tenant_id);
        if (!tenantResult) {
            return res.status(404).json({ success: false, message: 'المستأجر غير موجود' });
        }

        const tenant = tenantResult;
        const normalizedEntityId = tenant.id
            ? buildCentralTenantEntityId(tenant.id)
            : tenant.entity_id;
        const cleanPages = [...new Set(pages.filter((page) => typeof page === 'string' && page.trim()))];

        await client.query('BEGIN');
        transactionStarted = true;
        await client.query(`
            DELETE FROM tenant_page_access
            WHERE ($1::INTEGER IS NOT NULL AND tenant_id = $1)
               OR ($2::VARCHAR IS NOT NULL AND tenant_entity_id = $2)
        `, [tenant.id, normalizedEntityId]);

        for (const pageKey of cleanPages) {
            if (tenant.id) {
                await client.query(`
                    INSERT INTO tenant_page_access (tenant_id, tenant_entity_id, page_key)
                    VALUES ($1, $2, $3)
                    ON CONFLICT (tenant_id, page_key) DO NOTHING
                `, [tenant.id, normalizedEntityId || null, pageKey]);
            } else {
                await client.query(`
                    INSERT INTO tenant_page_access (tenant_entity_id, page_key)
                    VALUES ($1, $2)
                    ON CONFLICT (tenant_entity_id, page_key) DO NOTHING
                `, [normalizedEntityId, pageKey]);
            }
        }

        await client.query('COMMIT');
        transactionStarted = false;

        try {
            await pool.query(`
                INSERT INTO audit_log (
                    entity_type, entity_reference_id, action_type,
                    user_name, description
                ) VALUES ($1, $2, $3, $4, $5)
            `, [
                'tenant_page_access',
                normalizedEntityId || tenant.id,
                'UPDATE',
                req.userId || req.headers['x-user-id'] || 'super-admin',
                JSON.stringify({
                    tenant_id: tenant.id,
                    tenant_entity_id: normalizedEntityId,
                    pages: cleanPages
                })
            ]);
        } catch (auditError) {
            console.log('⚠️  لم يتم تسجيل صلاحيات المستأجر في audit log:', auditError.message);
        }

        return res.json({
            success: true,
            message: 'تم حفظ صلاحيات المستأجر بنجاح',
            tenant: {
                id: tenant.id,
                entity_id: normalizedEntityId,
                name: tenant.name,
                subdomain: tenant.subdomain
            },
            pages: cleanPages
        });
    } catch (error) {
        if (client && transactionStarted) {
            await client.query('ROLLBACK');
        }
        console.error('خطأ في حفظ صلاحيات صفحات المستأجر:', error);
        return res.status(500).json({ success: false, message: 'خطأ في حفظ صلاحيات المستأجر' });
    } finally {
        if (client) client.release();
    }
});

// ========== 7.10. جلب إعدادات القائمة الجانبية لنوع الحساب ==========
router.get('/account-type-sidebar', verifySuperAdmin, async (req, res) => {
    try {
        const { account_type } = req.query;
        if (!account_type) {
            return res.status(400).json({ success: false, message: 'account_type مطلوب' });
        }
        const validTypes = ['BRANCH', 'OFFICE', 'INCUBATOR', 'TENANT', 'PLATFORM'];
        if (!validTypes.includes(account_type.toUpperCase())) {
            return res.status(400).json({ success: false, message: 'نوع الحساب غير صالح' });
        }
        await ensureAccountTypeSidebarTable();
        const result = await pool.query(
            'SELECT page_key FROM account_type_sidebar_config WHERE account_type = $1 ORDER BY page_key',
            [account_type.toUpperCase()]
        );
        res.json({ success: true, account_type: account_type.toUpperCase(), pages: result.rows.map(r => r.page_key) });
    } catch (error) {
        console.error('خطأ في جلب إعدادات القائمة الجانبية:', error);
        res.status(500).json({ success: false, message: 'خطأ في جلب إعدادات القائمة الجانبية' });
    }
});

// ========== 7.11. حفظ إعدادات القائمة الجانبية لنوع الحساب ==========
router.post('/account-type-sidebar', verifySuperAdmin, async (req, res) => {
    let client;
    try {
        const { account_type, pages } = req.body;
        if (!account_type || !Array.isArray(pages)) {
            return res.status(400).json({ success: false, message: 'account_type و pages مطلوبين' });
        }
        const validTypes = ['BRANCH', 'OFFICE', 'INCUBATOR', 'TENANT', 'PLATFORM'];
        if (!validTypes.includes(account_type.toUpperCase())) {
            return res.status(400).json({ success: false, message: 'نوع الحساب غير صالح' });
        }
        await ensureAccountTypeSidebarTable();
        const cleanPages = [...new Set(pages.filter(p => typeof p === 'string' && p.trim()))];
        client = await pool.connect();
        await client.query('BEGIN');
        await client.query('DELETE FROM account_type_sidebar_config WHERE account_type = $1', [account_type.toUpperCase()]);
        for (const pageKey of cleanPages) {
            await client.query(
                'INSERT INTO account_type_sidebar_config (account_type, page_key) VALUES ($1, $2) ON CONFLICT DO NOTHING',
                [account_type.toUpperCase(), pageKey]
            );
        }
        await client.query('COMMIT');
        try {
            await pool.query(
                `INSERT INTO audit_log (entity_type, entity_reference_id, action_type, user_name, description)
                 VALUES ($1, $2, $3, $4, $5)`,
                ['account_type_sidebar_config', account_type.toUpperCase(), 'UPDATE',
                 req.userId || req.headers['x-user-id'] || 'super-admin',
                 JSON.stringify({ account_type: account_type.toUpperCase(), pages: cleanPages })]
            );
        } catch (_auditErr) { console.log('⚠️ لم يتم تسجيل إعدادات القائمة الجانبية في audit log:', _auditErr.message); }
        res.json({ success: true, message: 'تم حفظ إعدادات القائمة الجانبية بنجاح', account_type: account_type.toUpperCase(), pages: cleanPages });
    } catch (error) {
        if (client) await client.query('ROLLBACK');
        console.error('خطأ في حفظ إعدادات القائمة الجانبية:', error);
        res.status(500).json({ success: false, message: 'خطأ في حفظ إعدادات القائمة الجانبية' });
    } finally {
        if (client) client.release();
    }
});

module.exports = router;
