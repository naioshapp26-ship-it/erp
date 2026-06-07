const express = require('express');
const cors = require('cors');
const bodyParser = require('body-parser');
const multer = require('multer');
const QRCode = require('qrcode');
const { rateLimit } = require('express-rate-limit');
const fs = require('fs');
const path = require('path');
const db = require('./db');
const { ensureDatabaseReady } = require('./database-bootstrap');
const { buildCentralTenantEntityId } = require('./tenant-directory-sync');
const {
  DEFAULT_ENTITY_CONTEXT,
  normalizeEntityContext,
  getRequestEntityContext,
  buildEntityScopeCondition
} = require('./entity-context');
require('dotenv').config();

const app = express();
const databaseReady = ensureDatabaseReady();
// cPanel يمرّر PORT ديناميكياً — لا تثبّته في .env
const listenHost = process.env.HOST || '0.0.0.0';
const listenPort = Number(process.env.PORT) || 3000;
const UPLOADS_ROOT_DIR = path.resolve(process.env.UPLOADS_ROOT_DIR || path.join(__dirname, 'uploads'));

app.use('/api', (req, res, next) => {
  res.setHeader('X-Naiosh-Api', '1');
  next();
});

const getTrustProxySetting = () => {
  const rawValue = process.env.TRUST_PROXY;
  if (rawValue === undefined || rawValue === null || rawValue === '') {
    return 1;
  }

  const normalizedValue = String(rawValue).trim().toLowerCase();
  if (normalizedValue === 'true') return true;
  if (normalizedValue === 'false') return false;

  const numericValue = Number(rawValue);
  return Number.isNaN(numericValue) ? rawValue : numericValue;
};

app.set('trust proxy', getTrustProxySetting());

const BYPASS_AUTH_TOKEN = process.env.BYPASS_AUTH_TOKEN || 'naiosh-bypass-token';
const DEFAULT_BYPASS_USER = {
  id: 0,
  name: 'Super Admin',
  email: 'admin@naiosh.com',
  role: 'مسؤول النظام',
  job_title: 'مدير النظام',
  tenant_type: 'HQ',
  tenantType: 'HQ',
  entity_id: 'HQ001',
  entityId: 'HQ001',
  entity_name: 'NAIOSH HQ',
  entityName: 'NAIOSH HQ'
};

const assetExists = (assetPath) => {
  const normalizedPath = String(assetPath || '').replace(/^\/+/, '');
  return fs.existsSync(path.join(__dirname, normalizedPath));
};

const injectHeadAssetIfExists = (html, assetPath, tag) => {
  if (!html || html.includes(tag) || !assetExists(assetPath)) return html;
  return html.includes('</head>')
    ? html.replace('</head>', `${tag}</head>`)
    : `${tag}${html}`;
};

const injectBodyAssetIfExists = (html, assetPath, tag) => {
  if (!html || html.includes(tag) || !assetExists(assetPath)) return html;
  return html.includes('</body>')
    ? html.replace('</body>', `${tag}</body>`)
    : `${html}${tag}`;
};

const injectNumberFormatScript = (html) => {
  const scriptTag = '<script src="/public/number-format.js"></script>';
  return injectBodyAssetIfExists(html, '/public/number-format.js', scriptTag);
};

const injectGlobalSearchAssets = (html) => {
  if (!html) return html;
  const cssTag = '<link rel="stylesheet" href="/global-search.css">';
  const scriptTag = '<script src="/global-search.js" defer></script>';
  let output = html;
  if (!output.includes(cssTag)) {
    output = output.includes('</head>')
      ? output.replace('</head>', `${cssTag}</head>`)
      : `${cssTag}${output}`;
  }
  if (!output.includes(scriptTag)) {
    output = output.includes('</body>')
      ? output.replace('</body>', `${scriptTag}</body>`)
      : `${output}${scriptTag}`;
  }
  return output;
};

const injectGlobalBackButtonAssets = (html) => {
  if (!html) return html;
  const cssTag = '<link rel="stylesheet" href="/public/global-back.css">';
  const scriptTag = '<script src="/public/global-back.js" defer></script>';
  let output = html;
  if (!output.includes(cssTag)) {
    output = output.includes('</head>')
      ? output.replace('</head>', `${cssTag}</head>`)
      : `${cssTag}${output}`;
  }
  if (!output.includes(scriptTag)) {
    output = output.includes('</body>')
      ? output.replace('</body>', `${scriptTag}</body>`)
      : `${output}${scriptTag}`;
  }
  return output;
};

const injectPageGuideAssets = (html) => {
  if (!html) return html;
  const cssTag = '<link rel="stylesheet" href="/public/page-guide.css">';
  const scriptTag = '<script src="/public/page-guide.js" defer></script>';
  const withCss = injectHeadAssetIfExists(html, '/public/page-guide.css', cssTag);
  return injectBodyAssetIfExists(withCss, '/public/page-guide.js', scriptTag);
};

const injectDarkModeAssets = (html) => {
  if (!html) return html;
  const cssTag = '<link rel="stylesheet" href="/public/global-dark-mode.css">';
  const scriptTag = '<script src="/public/global-dark-mode.js"></script>';
  const withCss = injectHeadAssetIfExists(html, '/public/global-dark-mode.css', cssTag);
  return injectBodyAssetIfExists(withCss, '/public/global-dark-mode.js', scriptTag);
};

const injectFormValidationAssets = (html) => {
  if (!html) return html;
  const cssTag = '<link rel="stylesheet" href="/public/form-validation.css">';
  const scriptTag = '<script src="/public/form-validation.js" defer></script>';
  const withCss = injectHeadAssetIfExists(html, '/public/form-validation.css', cssTag);
  return injectBodyAssetIfExists(withCss, '/public/form-validation.js', scriptTag);
};

const sendHtmlWithNumberFormat = (res, filePath) => {
  fs.readFile(filePath, 'utf8', (err, html) => {
    if (err) {
      res.status(500).send('Page not available');
      return;
    }
    res.set('Content-Type', 'text/html; charset=utf-8');
    const withNumberFormat = injectNumberFormatScript(html);
    const withFormValidation = injectFormValidationAssets(withNumberFormat);
    const fileName = path.basename(filePath || '');
    if (fileName === 'login-page.html' || fileName === 'register.html') {
      res.send(injectDarkModeAssets(withFormValidation));
      return;
    }
    const isNewhomePage = filePath.includes(`${path.sep}newhome${path.sep}`);
    if (isNewhomePage) {
      res.send(withFormValidation);
      return;
    }
    res.send(injectDarkModeAssets(withFormValidation));
  });
};

const extractMapFromBlock = (block) => {
  const map = {};
  if (!block) return map;
  const regex = /['"]([^'"]+)['"]\s*:\s*['"]([^'"]+)['"]/g;
  let match = null;
  while ((match = regex.exec(block))) {
    map[match[1]] = match[2];
  }
  return map;
};

const extractScriptMap = (content, marker) => {
  const start = content.indexOf(marker);
  if (start === -1) return {};
  const braceStart = content.indexOf('{', start);
  const braceEnd = content.indexOf('\n    };', braceStart);
  if (braceStart === -1 || braceEnd === -1) return {};
  const block = content.slice(braceStart + 1, braceEnd);
  return extractMapFromBlock(block);
};

const extractGetTitleMap = (content) => {
  const match = content.match(/const map = \{([\s\S]*?)\n\s*\};/m);
  if (!match) return {};
  return extractMapFromBlock(match[1]);
};

const extractHtmlTitle = (filePath) => {
  try {
    const content = fs.readFileSync(filePath, 'utf8');
    const match = content.match(/<title>([\s\S]*?)<\/title>/i);
    return match ? match[1].trim() : '';
  } catch (error) {
    return '';
  }
};

const extractHrSectionTitles = () => {
  const hrSectionPath = path.join(__dirname, 'finance', 'hr-section.html');
  const map = {};
  if (!fs.existsSync(hrSectionPath)) return map;
  const content = fs.readFileSync(hrSectionPath, 'utf8');
  const regex = /'([^']+)'\s*:\s*\{[\s\S]*?title:\s*'([^']+)'/g;
  let match = null;
  while ((match = regex.exec(content))) {
    if (match[1].startsWith('/hr/')) {
      map[match[1]] = match[2];
    }
  }
  return map;
};

let cachedSearchIndex = null;

const buildSearchIndex = () => {
  const entries = new Map();
  const addEntry = (pathValue, titleValue, extraKeywords = '') => {
    if (!pathValue || !titleValue) return;
    if (entries.has(pathValue)) return;
    entries.set(pathValue, {
      path: pathValue,
      title: titleValue,
      keywords: [titleValue, pathValue, extraKeywords].filter(Boolean).join(' ')
    });
  };

  try {
    const scriptPath = path.join(__dirname, 'script.js');
    if (fs.existsSync(scriptPath)) {
      const scriptContent = fs.readFileSync(scriptPath, 'utf8');
      const titleMap = extractGetTitleMap(scriptContent);
      const routeToPathMap = extractScriptMap(scriptContent, 'const routeToPath');
      Object.keys(routeToPathMap).forEach(routeKey => {
        const pathValue = routeToPathMap[routeKey];
        const titleValue = titleMap[routeKey] || routeKey;
        addEntry(pathValue, titleValue, routeKey.replace(/-/g, ' '));
      });
    }
  } catch (error) {
    console.warn('Failed to read SPA search index:', error.message);
  }

  const hrSectionTitles = extractHrSectionTitles();
  Object.entries(hrRouteMap).forEach(([routePath, fileName]) => {
    const filePath = path.join(__dirname, 'finance', fileName);
    if (!fs.existsSync(filePath)) return;
    const titleValue = hrSectionTitles[routePath] || extractHtmlTitle(filePath) || routePath;
    addEntry(routePath, titleValue, 'HR');
  });

  return Array.from(entries.values());
};

const ensureFacilitiesContractsTable = async () => {
  try {
    await db.query(`
      CREATE TABLE IF NOT EXISTS facilities_project_contracts (
        id SERIAL PRIMARY KEY,
        contract_name TEXT NOT NULL,
        partner TEXT NOT NULL,
        expiry DATE,
        value_text TEXT,
        status TEXT DEFAULT 'قيد المراجعة',
        sla_percent NUMERIC,
        risk_level TEXT DEFAULT 'متوسط',
        notes TEXT,
        entity_id TEXT,
        entity_type TEXT,
        created_at TIMESTAMP DEFAULT NOW(),
        updated_at TIMESTAMP DEFAULT NOW()
      );
      ALTER TABLE facilities_project_contracts ADD COLUMN IF NOT EXISTS notes TEXT;
    `);
    console.log('✅ facilities_project_contracts table ready');
  } catch (error) {
    console.error('❌ Failed to ensure facilities_project_contracts table:', error);
  }
};

const ensureFacilitiesContractLogsTable = async () => {
  try {
    await db.query(`
      CREATE TABLE IF NOT EXISTS facilities_contract_logs (
        id SERIAL PRIMARY KEY,
        contract_id INTEGER REFERENCES facilities_project_contracts(id) ON DELETE CASCADE,
        action TEXT NOT NULL,
        user_name TEXT,
        note TEXT,
        status TEXT DEFAULT 'تم التسجيل',
        entity_id TEXT,
        entity_type TEXT,
        created_at TIMESTAMP DEFAULT NOW()
      );
      CREATE INDEX IF NOT EXISTS idx_fac_contract_logs_contract ON facilities_contract_logs(contract_id);
      CREATE INDEX IF NOT EXISTS idx_fac_contract_logs_entity ON facilities_contract_logs(entity_id);
    `);
    console.log('✅ facilities_contract_logs table ready');
  } catch (error) {
    console.error('❌ Failed to ensure facilities_contract_logs table:', error);
  }
};

(async () => {
  await ensureFacilitiesContractsTable();
  await ensureFacilitiesContractLogsTable();
})();

// Electronic signature tables (حفظ التوقيع وسجل التدقيق)
const ensureElectronicSignatureTables = async () => {
  try {
    await db.query(`
      CREATE TABLE IF NOT EXISTS finance_electronic_signatures (
        signature_id SERIAL PRIMARY KEY,
        document_key TEXT UNIQUE NOT NULL,
        document_type TEXT NOT NULL,
        document_id TEXT NOT NULL,
        owner_name TEXT,
        document_status TEXT,
        signature_status TEXT DEFAULT 'غير موقع',
        verified BOOLEAN DEFAULT false,
        fingerprint TEXT,
        action TEXT,
        user_name TEXT,
        notes TEXT,
        entity_id TEXT DEFAULT 'HQ001',
        created_at TIMESTAMP DEFAULT NOW(),
        updated_at TIMESTAMP DEFAULT NOW()
      );
      CREATE TABLE IF NOT EXISTS finance_signature_logs (
        log_id SERIAL PRIMARY KEY,
        signature_id INTEGER REFERENCES finance_electronic_signatures(signature_id) ON DELETE CASCADE,
        document_key TEXT NOT NULL,
        action TEXT NOT NULL,
        user_name TEXT,
        fingerprint TEXT,
        created_at TIMESTAMP DEFAULT NOW()
      );
      CREATE INDEX IF NOT EXISTS idx_fin_sign_doc_key ON finance_electronic_signatures(document_key);
      CREATE INDEX IF NOT EXISTS idx_fin_sign_logs_doc_key ON finance_signature_logs(document_key);
    `);
    console.log('✅ finance_electronic_signatures tables ready');
  } catch (error) {
    console.error('❌ Failed to ensure electronic signature tables:', error);
  }
};

ensureElectronicSignatureTables();

const ensureHrEmployeeProfileTables = async () => {
  try {
    await db.query(`
      CREATE TABLE IF NOT EXISTS hr_employee_profiles (
        id SERIAL PRIMARY KEY,
        employee_id TEXT NOT NULL,
        name TEXT NOT NULL,
        title TEXT,
        department TEXT,
        status TEXT,
        hire_date DATE,
        manager TEXT,
        avatar_initials TEXT,
        entity_id TEXT,
        entity_type TEXT,
        created_at TIMESTAMP DEFAULT NOW(),
        updated_at TIMESTAMP DEFAULT NOW()
      );
      ALTER TABLE hr_employee_profiles ADD COLUMN IF NOT EXISTS entity_id TEXT;
      ALTER TABLE hr_employee_profiles ADD COLUMN IF NOT EXISTS entity_type TEXT;
      ALTER TABLE hr_employee_profiles DROP CONSTRAINT IF EXISTS hr_employee_profiles_employee_id_key;
      CREATE TABLE IF NOT EXISTS hr_employee_records (
        id SERIAL PRIMARY KEY,
        employee_id TEXT NOT NULL,
        section TEXT NOT NULL,
        status TEXT,
        period TEXT,
        record JSONB NOT NULL,
        entity_id TEXT,
        entity_type TEXT,
        created_at TIMESTAMP DEFAULT NOW(),
        updated_at TIMESTAMP DEFAULT NOW()
      );
      ALTER TABLE hr_employee_records ADD COLUMN IF NOT EXISTS entity_id TEXT;
      ALTER TABLE hr_employee_records ADD COLUMN IF NOT EXISTS entity_type TEXT;
      CREATE INDEX IF NOT EXISTS idx_hr_emp_records_employee ON hr_employee_records(employee_id);
      CREATE INDEX IF NOT EXISTS idx_hr_emp_records_section ON hr_employee_records(section);
      CREATE INDEX IF NOT EXISTS idx_hr_emp_records_period ON hr_employee_records(period);
      CREATE INDEX IF NOT EXISTS idx_hr_emp_records_status ON hr_employee_records(status);
      CREATE INDEX IF NOT EXISTS idx_hr_emp_records_entity ON hr_employee_records(entity_id);
      CREATE INDEX IF NOT EXISTS idx_hr_emp_profiles_entity ON hr_employee_profiles(entity_id);
      CREATE UNIQUE INDEX IF NOT EXISTS uq_hr_employee_profiles_entity_employee
        ON hr_employee_profiles(entity_id, employee_id);
    `);

    await db.query(`
      UPDATE hr_employee_profiles
      SET entity_id = COALESCE(NULLIF(entity_id, ''), 'HQ001'),
          entity_type = COALESCE(NULLIF(entity_type, ''), 'HQ')
      WHERE entity_id IS NULL OR entity_id = '' OR entity_type IS NULL OR entity_type = ''
    `);
    await db.query(`
      UPDATE hr_employee_records
      SET entity_id = COALESCE(NULLIF(entity_id, ''), 'HQ001'),
          entity_type = COALESCE(NULLIF(entity_type, ''), 'HQ')
      WHERE entity_id IS NULL OR entity_id = '' OR entity_type IS NULL OR entity_type = ''
    `);

    const profileCheck = await db.query(
      "SELECT COUNT(*)::int AS count FROM hr_employee_profiles WHERE employee_id = 'EMP001' AND entity_id = 'HQ001'"
    );
    if (profileCheck.rows[0]?.count === 0) {
      await db.query(
        `INSERT INTO hr_employee_profiles
         (employee_id, name, title, department, status, hire_date, manager, avatar_initials, entity_id, entity_type)
         VALUES
         ('EMP001', 'رانيا السبيعي', 'مدير شؤون الموظفين', 'الموارد البشرية', 'نشط', '2019-04-12', 'مها الفقيه', 'را', 'HQ001', 'HQ')`
      );
    }

    const recordsCheck = await db.query(
      "SELECT COUNT(*)::int AS count FROM hr_employee_records WHERE employee_id = 'EMP001' AND entity_id = 'HQ001'"
    );
    if (recordsCheck.rows[0]?.count === 0) {
      await db.query(
        `INSERT INTO hr_employee_records (employee_id, section, status, period, record, entity_id, entity_type) VALUES
         ('EMP001', 'attendance', 'حضور', '2026-02-20', '{"date":"2026-02-20","checkIn":"08:45","checkOut":"17:05","shift":"صباحي","status":"حضور"}', 'HQ001', 'HQ'),
         ('EMP001', 'attendance', 'حضور', '2026-02-19', '{"date":"2026-02-19","checkIn":"08:50","checkOut":"17:00","shift":"صباحي","status":"حضور"}', 'HQ001', 'HQ'),
         ('EMP001', 'attendance', 'غياب', '2026-02-18', '{"date":"2026-02-18","checkIn":"--","checkOut":"--","shift":"صباحي","status":"غياب"}', 'HQ001', 'HQ'),
         ('EMP001', 'attendance', 'إجازة', '2026-02-17', '{"date":"2026-02-17","checkIn":"--","checkOut":"--","shift":"صباحي","status":"إجازة"}', 'HQ001', 'HQ'),
         ('EMP001', 'attendance', 'حضور', '2026-02-16', '{"date":"2026-02-16","checkIn":"08:35","checkOut":"17:10","shift":"صباحي","status":"حضور"}', 'HQ001', 'HQ'),
         ('EMP001', 'payroll', 'تم الصرف', '2026-02', '{"month":"2026-02","base":14500,"bonuses":1200,"deductions":450,"net":15250,"status":"تم الصرف"}', 'HQ001', 'HQ'),
         ('EMP001', 'payroll', 'تم الصرف', '2026-01', '{"month":"2026-01","base":14500,"bonuses":900,"deductions":650,"net":14750,"status":"تم الصرف"}', 'HQ001', 'HQ'),
         ('EMP001', 'payroll', 'تم الصرف', '2025-12', '{"month":"2025-12","base":14000,"bonuses":1100,"deductions":500,"net":14600,"status":"تم الصرف"}', 'HQ001', 'HQ'),
         ('EMP001', 'evaluations', 'ممتاز', '2025 Q4', '{"period":"2025 Q4","score":4.7,"reviewer":"مها الفقيه","status":"ممتاز","notes":"أداء قيادي مميز"}', 'HQ001', 'HQ'),
         ('EMP001', 'evaluations', 'جيد جدا', '2025 Q3', '{"period":"2025 Q3","score":4.5,"reviewer":"مها الفقيه","status":"جيد جدا","notes":"تحسن في مؤشرات الالتزام"}', 'HQ001', 'HQ'),
         ('EMP001', 'evaluations', 'جيد جدا', '2025 Q2', '{"period":"2025 Q2","score":4.3,"reviewer":"مها الفقيه","status":"جيد جدا","notes":"تطوير ملحوظ في العمليات"}', 'HQ001', 'HQ'),
         ('EMP001', 'trainings', 'مكتملة', '2026-02-10', '{"course":"إدارة المواهب المتقدمة","provider":"Nayosh Academy","date":"2026-02-10","hours":12,"status":"مكتملة"}', 'HQ001', 'HQ'),
         ('EMP001', 'trainings', 'مكتملة', '2026-01-18', '{"course":"تحليل بيانات الموارد البشرية","provider":"Coursera","date":"2026-01-18","hours":20,"status":"مكتملة"}', 'HQ001', 'HQ'),
         ('EMP001', 'trainings', 'مكتملة', '2025-12-05', '{"course":"التخطيط الاستراتيجي","provider":"CIPD","date":"2025-12-05","hours":16,"status":"مكتملة"}', 'HQ001', 'HQ'),
         ('EMP001', 'warnings', 'مغلق', '2025-11-12', '{"type":"تنبيه التزام","severity":"منخفض","date":"2025-11-12","action":"تذكير شفهي","status":"مغلق"}', 'HQ001', 'HQ'),
         ('EMP001', 'warnings', 'متابعة', '2025-09-22', '{"type":"تنبيه تأخير","severity":"متوسط","date":"2025-09-22","action":"خطة تحسين","status":"متابعة"}', 'HQ001', 'HQ'),
         ('EMP001', 'attachments', 'معتمد', '2019-04-12', '{"name":"عقد العمل","type":"PDF","date":"2019-04-12","size":"1.2 MB","status":"معتمد"}', 'HQ001', 'HQ'),
         ('EMP001', 'attachments', 'موثق', '2025-12-10', '{"name":"شهادة تدريب قيادي","type":"PDF","date":"2025-12-10","size":"850 KB","status":"موثق"}', 'HQ001', 'HQ'),
         ('EMP001', 'attachments', 'موثق', '2025-12-30', '{"name":"مراجعة أداء 2025","type":"PDF","date":"2025-12-30","size":"980 KB","status":"موثق"}', 'HQ001', 'HQ')
        `
      );
    }

    console.log('✅ hr_employee_profiles tables ready');
  } catch (error) {
    console.error('❌ Failed to ensure hr_employee_profiles tables:', error);
  }
};

ensureHrEmployeeProfileTables();
const ensureHrStrategicMonthlyIndicatorsTable = async () => {
  try {
    await db.query(`
      CREATE TABLE IF NOT EXISTS hr_strategic_monthly_indicators (
        id SERIAL PRIMARY KEY,
        month_key TEXT NOT NULL,
        month_label TEXT NOT NULL,
        period TEXT,
        headcount INTEGER NOT NULL,
        attendance_rate NUMERIC(5,2) NOT NULL,
        turnover_rate NUMERIC(5,2) NOT NULL,
        performance_score NUMERIC(5,2) NOT NULL,
        new_hires INTEGER NOT NULL,
        resignations INTEGER NOT NULL,
        absence_rate NUMERIC(5,2) NOT NULL,
        tardy_rate NUMERIC(5,2) NOT NULL,
        entity_id TEXT,
        entity_type TEXT,
        created_at TIMESTAMP DEFAULT NOW(),
        updated_at TIMESTAMP DEFAULT NOW()
      );
      ALTER TABLE hr_strategic_monthly_indicators ADD COLUMN IF NOT EXISTS entity_id TEXT;
      ALTER TABLE hr_strategic_monthly_indicators ADD COLUMN IF NOT EXISTS entity_type TEXT;
      DROP INDEX IF EXISTS idx_hr_strategic_month_key;
      CREATE UNIQUE INDEX IF NOT EXISTS idx_hr_strategic_month_entity_key
        ON hr_strategic_monthly_indicators(entity_id, month_key);
      CREATE INDEX IF NOT EXISTS idx_hr_strategic_period ON hr_strategic_monthly_indicators(period);
      CREATE INDEX IF NOT EXISTS idx_hr_strategic_entity ON hr_strategic_monthly_indicators(entity_id);
    `);

    await db.query(`
      UPDATE hr_strategic_monthly_indicators
      SET entity_id = COALESCE(NULLIF(entity_id, ''), 'HQ001'),
          entity_type = COALESCE(NULLIF(entity_type, ''), 'HQ')
      WHERE entity_id IS NULL OR entity_id = '' OR entity_type IS NULL OR entity_type = ''
    `);

    const seedCheck = await db.query(
      "SELECT COUNT(*)::int AS count FROM hr_strategic_monthly_indicators WHERE entity_id = 'HQ001'"
    );
    if (seedCheck.rows[0]?.count === 0) {
      await db.query(
        `INSERT INTO hr_strategic_monthly_indicators
          (month_key, month_label, period, headcount, attendance_rate, turnover_rate, performance_score, new_hires, resignations, absence_rate, tardy_rate, entity_id, entity_type)
         VALUES
          ('2025-04', 'Apr 2025', '2025-Q2', 4520, 91.8, 13.6, 3.90, 90, 70, 3.7, 2.4, 'HQ001', 'HQ'),
          ('2025-05', 'May 2025', '2025-Q2', 4565, 92.0, 13.4, 3.95, 110, 72, 3.6, 2.3, 'HQ001', 'HQ'),
          ('2025-06', 'Jun 2025', '2025-Q2', 4610, 92.2, 13.1, 4.00, 115, 68, 3.5, 2.2, 'HQ001', 'HQ'),
          ('2025-07', 'Jul 2025', '2025-Q3', 4650, 92.3, 13.0, 4.00, 100, 66, 3.5, 2.1, 'HQ001', 'HQ'),
          ('2025-08', 'Aug 2025', '2025-Q3', 4700, 92.5, 12.9, 4.00, 118, 64, 3.4, 2.1, 'HQ001', 'HQ'),
          ('2025-09', 'Sep 2025', '2025-Q3', 4735, 92.7, 12.7, 4.10, 122, 63, 3.3, 2.0, 'HQ001', 'HQ'),
          ('2025-10', 'Oct 2025', '2025-Q4', 4700, 92.8, 12.9, 4.00, 120, 65, 3.4, 2.1, 'HQ001', 'HQ'),
          ('2025-11', 'Nov 2025', '2025-Q4', 4760, 93.0, 12.6, 4.10, 130, 62, 3.2, 1.9, 'HQ001', 'HQ'),
          ('2025-12', 'Dec 2025', '2025-Q4', 4805, 93.2, 12.3, 4.20, 135, 60, 3.1, 1.8, 'HQ001', 'HQ'),
          ('2026-01', 'Jan 2026', '2026-Q1', 4820, 93.1, 12.4, 4.20, 140, 63, 3.1, 1.9, 'HQ001', 'HQ'),
          ('2026-02', 'Feb 2026', '2026-Q1', 4875, 93.4, 12.1, 4.30, 150, 58, 3.0, 1.8, 'HQ001', 'HQ'),
          ('2026-03', 'Mar 2026', '2026-Q1', 4902, 93.6, 11.9, 4.30, 155, 55, 2.9, 1.7, 'HQ001', 'HQ')
        `
      );
    }

    console.log('✅ hr_strategic_monthly_indicators table ready');
  } catch (error) {
    console.error('❌ Failed to ensure hr_strategic_monthly_indicators table:', error);
  }
};

ensureHrStrategicMonthlyIndicatorsTable();
const ensureHrSatisfactionAnalyticsTable = async () => {
  try {
    await db.query(`
      CREATE TABLE IF NOT EXISTS hr_satisfaction_analytics (
        id SERIAL PRIMARY KEY,
        employee_name TEXT NOT NULL,
        department_name TEXT NOT NULL,
        survey_type TEXT NOT NULL,
        satisfaction_score NUMERIC(4,2) NOT NULL,
        satisfaction_level TEXT NOT NULL,
        evaluation_date DATE DEFAULT CURRENT_DATE,
        notes TEXT,
        follow_up_status TEXT DEFAULT 'قيد المتابعة',
        entity_id TEXT,
        entity_type TEXT,
        created_at TIMESTAMP DEFAULT NOW(),
        updated_at TIMESTAMP DEFAULT NOW()
      );
      ALTER TABLE hr_satisfaction_analytics ADD COLUMN IF NOT EXISTS employee_name TEXT;
      ALTER TABLE hr_satisfaction_analytics ADD COLUMN IF NOT EXISTS department_name TEXT;
      ALTER TABLE hr_satisfaction_analytics ADD COLUMN IF NOT EXISTS survey_type TEXT;
      ALTER TABLE hr_satisfaction_analytics ADD COLUMN IF NOT EXISTS satisfaction_score NUMERIC(4,2);
      ALTER TABLE hr_satisfaction_analytics ADD COLUMN IF NOT EXISTS satisfaction_level TEXT;
      ALTER TABLE hr_satisfaction_analytics ADD COLUMN IF NOT EXISTS evaluation_date DATE;
      ALTER TABLE hr_satisfaction_analytics ADD COLUMN IF NOT EXISTS notes TEXT;
      ALTER TABLE hr_satisfaction_analytics ADD COLUMN IF NOT EXISTS follow_up_status TEXT DEFAULT 'قيد المتابعة';
      ALTER TABLE hr_satisfaction_analytics ADD COLUMN IF NOT EXISTS entity_id TEXT;
      ALTER TABLE hr_satisfaction_analytics ADD COLUMN IF NOT EXISTS entity_type TEXT;
      CREATE INDEX IF NOT EXISTS idx_hr_satisfaction_employee ON hr_satisfaction_analytics(employee_name);
      CREATE INDEX IF NOT EXISTS idx_hr_satisfaction_department ON hr_satisfaction_analytics(department_name);
      CREATE INDEX IF NOT EXISTS idx_hr_satisfaction_level ON hr_satisfaction_analytics(satisfaction_level);
      CREATE INDEX IF NOT EXISTS idx_hr_satisfaction_date ON hr_satisfaction_analytics(evaluation_date);
      CREATE INDEX IF NOT EXISTS idx_hr_satisfaction_entity ON hr_satisfaction_analytics(entity_id);
    `);

    const seedCheck = await db.query(
      "SELECT COUNT(*)::int AS count FROM hr_satisfaction_analytics WHERE entity_id = 'HQ001'"
    );

    if (seedCheck.rows[0]?.count === 0) {
      await db.query(
        `INSERT INTO hr_satisfaction_analytics
          (employee_name, department_name, survey_type, satisfaction_score, satisfaction_level, evaluation_date, notes, follow_up_status, entity_id, entity_type)
         VALUES
          ('سارة نجيب', 'التقنية', 'استبيان نبض شهري', 4.6, 'مرتفع', '2026-02-12', 'تقدير مرتفع لمرونة العمل مع طلب تحسين أدوات التعاون.', 'مكتمل', 'HQ001', 'HQ'),
          ('أحمد لطفي', 'المبيعات', 'استبيان تجربة العمل', 3.4, 'متوسط', '2026-02-10', 'الحوافز بحاجة لارتباط أوضح بالأهداف الشهرية.', 'قيد المتابعة', 'HQ001', 'HQ'),
          ('منة سامي', 'الموارد البشرية', 'استبيان القيادة', 4.2, 'مرتفع', '2026-01-28', 'قيادة داعمة ولكن تحتاج مشاركة أوسع في القرارات.', 'مكتمل', 'HQ001', 'HQ'),
          ('كريم عادل', 'المالية', 'استبيان بيئة العمل', 3.1, 'متوسط', '2026-02-05', 'ضغط نهاية الشهر مرتفع ويحتاج توزيع أفضل للمهام.', 'قيد المتابعة', 'HQ001', 'HQ'),
          ('نوران عز', 'العمليات', 'استبيان نبض شهري', 2.8, 'منخفض', '2026-02-07', 'فجوة في توزيع الأحمال خلال المناوبات الحرجة.', 'مفتوح', 'HQ001', 'HQ'),
          ('ليلى صادق', 'الدعم', 'استبيان تجربة العمل', 3.6, 'متوسط', '2026-01-22', 'تجربة العملاء جيدة لكن هناك نقص في الموارد.', 'قيد المتابعة', 'HQ001', 'HQ'),
          ('عمر هشام', 'التشغيل', 'استبيان القيادة', 4.0, 'مرتفع', '2026-02-01', 'وضوح الأهداف ساهم في رفع المعنويات.', 'مكتمل', 'HQ001', 'HQ'),
          ('ميسون سعد', 'المنتج', 'استبيان بيئة العمل', 2.9, 'منخفض', '2026-02-03', 'الحاجة إلى مزيد من التوافق بين فرق المنتج والتقنية.', 'مفتوح', 'HQ001', 'HQ'),
          ('هالة السالم', 'التسويق', 'استبيان نبض شهري', 4.4, 'مرتفع', '2026-02-14', 'رضا مرتفع عن حملات التواصل الداخلي.', 'مكتمل', 'HQ001', 'HQ'),
          ('طلال الصالح', 'الدعم', 'استبيان تجربة العمل', 3.0, 'متوسط', '2026-01-18', 'الحاجة لرفع مستوى التدريب على الأدوات الجديدة.', 'قيد المتابعة', 'HQ001', 'HQ')
        `
      );
    }

    console.log('✅ hr_satisfaction_analytics table ready');
  } catch (error) {
    console.error('❌ Failed to ensure hr_satisfaction_analytics table:', error);
  }
};

ensureHrSatisfactionAnalyticsTable();
const ensureHrExperienceRecordsTable = async () => {
  try {
    await db.query(`
      CREATE TABLE IF NOT EXISTS hr_experience_records (
        id SERIAL PRIMARY KEY,
        employee_name TEXT NOT NULL,
        experience_type TEXT NOT NULL,
        experience_field TEXT NOT NULL,
        years_of_experience INTEGER NOT NULL,
        experience_level TEXT NOT NULL,
        added_on DATE DEFAULT CURRENT_DATE,
        status TEXT DEFAULT 'قيد المراجعة',
        notes TEXT,
        skills JSONB DEFAULT '[]',
        entity_id TEXT,
        entity_type TEXT,
        created_at TIMESTAMP DEFAULT NOW(),
        updated_at TIMESTAMP DEFAULT NOW()
      );
      ALTER TABLE hr_experience_records ADD COLUMN IF NOT EXISTS entity_id TEXT;
      ALTER TABLE hr_experience_records ADD COLUMN IF NOT EXISTS entity_type TEXT;
      CREATE INDEX IF NOT EXISTS idx_hr_experience_status ON hr_experience_records(status);
      CREATE INDEX IF NOT EXISTS idx_hr_experience_field ON hr_experience_records(experience_field);
      CREATE INDEX IF NOT EXISTS idx_hr_experience_type ON hr_experience_records(experience_type);
      CREATE INDEX IF NOT EXISTS idx_hr_experience_entity ON hr_experience_records(entity_id);
    `);

    await db.query(`
      UPDATE hr_experience_records
      SET entity_id = COALESCE(NULLIF(entity_id, ''), 'HQ001'),
          entity_type = COALESCE(NULLIF(entity_type, ''), 'HQ')
      WHERE entity_id IS NULL OR entity_id = '' OR entity_type IS NULL OR entity_type = ''
    `);

    const seedCheck = await db.query(
      "SELECT COUNT(*)::int AS count FROM hr_experience_records WHERE entity_id = 'HQ001'"
    );
    if (seedCheck.rows[0]?.count === 0) {
      await db.query(
        `INSERT INTO hr_experience_records
          (employee_name, experience_type, experience_field, years_of_experience, experience_level, added_on, status, notes, skills, entity_id, entity_type)
         VALUES
          ('سارة نجيب', 'تحليل بيانات الموارد البشرية', 'تحليلات الموارد البشرية', 8, 'خبير', '2024-11-12', 'معتمدة', 'قائدة مبادرات تحسين الاحتفاظ بالموظفين.', '["People Analytics","Power BI","Retention Strategy"]'::jsonb, 'HQ001', 'HQ'),
          ('أحمد لطفي', 'إدارة برامج التعلم', 'التطوير المؤسسي', 6, 'متقدم', '2024-10-04', 'قيد المراجعة', 'تصميم مسارات تدريبية للمناصب الحرجة.', '["Learning Design","Leadership Programs","Coaching"]'::jsonb, 'HQ001', 'HQ'),
          ('منة سامي', 'إدارة علاقات الموظفين', 'علاقات الموظفين', 5, 'متوسط', '2024-12-02', 'معتمدة', 'حل النزاعات وتعزيز التواصل الداخلي.', '["Conflict Resolution","Policy Advisory","Case Management"]'::jsonb, 'HQ001', 'HQ'),
          ('كريم عادل', 'تعويضات ومزايا', 'المكافآت والتعويضات', 7, 'متقدم', '2024-09-18', 'معتمدة', 'إعادة هيكلة سلم المزايا للكوادر الرقمية.', '["Compensation Design","Salary Benchmarking","Benefits Strategy"]'::jsonb, 'HQ001', 'HQ'),
          ('نوران عز', 'تشغيل أنظمة الموارد البشرية', 'أنظمة الموارد البشرية', 4, 'متوسط', '2024-08-27', 'قيد المراجعة', 'تطوير لوحات مراقبة للالتزام بالبيانات.', '["HRIS","Data Governance","Workflow Automation"]'::jsonb, 'HQ001', 'HQ'),
          ('ليلى صادق', 'إدارة المواهب', 'إدارة المواهب', 9, 'خبير', '2024-12-15', 'معتمدة', 'قيادة مراجعات الأداء عالية التأثير.', '["Talent Review","Succession Planning","Performance Calibration"]'::jsonb, 'HQ001', 'HQ'),
          ('عمر هشام', 'التخطيط للقوى العاملة', 'التخطيط الاستراتيجي', 10, 'خبير', '2024-07-09', 'معتمدة', 'نماذج توقعات التوسع الإقليمي.', '["Workforce Planning","Scenario Modeling","Strategic Hiring"]'::jsonb, 'HQ001', 'HQ'),
          ('ميسون سعد', 'التوظيف المتخصص', 'الاستقطاب', 3, 'مبتدئ', '2024-12-20', 'قيد المراجعة', 'بناء شبكات مرشحين للتقنيات النادرة.', '["Sourcing","Tech Hiring","Employer Branding"]'::jsonb, 'HQ001', 'HQ')
        `
      );
    }

    console.log('✅ hr_experience_records table ready');
  } catch (error) {
    console.error('❌ Failed to ensure hr_experience_records table:', error);
  }
};

ensureHrExperienceRecordsTable();
const ensureHrCostOptimizationTables = async () => {
  try {
    await db.query(`
      CREATE TABLE IF NOT EXISTS hr_cost_optimization_departments (
        id SERIAL PRIMARY KEY,
        department_name TEXT NOT NULL,
        employee_count INTEGER NOT NULL,
        total_cost NUMERIC(12,2) NOT NULL,
        avg_performance INTEGER NOT NULL,
        efficiency_percent INTEGER NOT NULL,
        recommendation TEXT,
        planned_cost NUMERIC(12,2),
        actual_cost NUMERIC(12,2),
        overtime_waste_hours INTEGER DEFAULT 0,
        entity_id TEXT,
        entity_type TEXT,
        created_at TIMESTAMP DEFAULT NOW(),
        updated_at TIMESTAMP DEFAULT NOW()
      );
      ALTER TABLE hr_cost_optimization_departments ADD COLUMN IF NOT EXISTS entity_id TEXT;
      ALTER TABLE hr_cost_optimization_departments ADD COLUMN IF NOT EXISTS entity_type TEXT;
      CREATE INDEX IF NOT EXISTS idx_hr_cost_dept_name ON hr_cost_optimization_departments(department_name);
      CREATE INDEX IF NOT EXISTS idx_hr_cost_efficiency ON hr_cost_optimization_departments(efficiency_percent);
      CREATE INDEX IF NOT EXISTS idx_hr_cost_entity ON hr_cost_optimization_departments(entity_id);
    `);

    await db.query(`
      UPDATE hr_cost_optimization_departments
      SET entity_id = COALESCE(NULLIF(entity_id, ''), 'HQ001'),
          entity_type = COALESCE(NULLIF(entity_type, ''), 'HQ')
      WHERE entity_id IS NULL OR entity_id = '' OR entity_type IS NULL OR entity_type = ''
    `);

    const seedCheck = await db.query(
      "SELECT COUNT(*)::int AS count FROM hr_cost_optimization_departments WHERE entity_id = 'HQ001'"
    );
    if (seedCheck.rows[0]?.count === 0) {
      await db.query(
        `INSERT INTO hr_cost_optimization_departments
          (department_name, employee_count, total_cost, avg_performance, efficiency_percent, recommendation, planned_cost, actual_cost, overtime_waste_hours, entity_id, entity_type)
         VALUES
          ('التوظيف والاستقطاب', 18, 62000, 82, 78, 'خفض التعاقدات الخارجية', 58000, 62000, 18, 'HQ001', 'HQ'),
          ('التطوير المؤسسي', 22, 54000, 88, 90, 'إعادة توزيع المدربين', 55000, 54000, 8, 'HQ001', 'HQ'),
          ('العمليات الإدارية', 30, 71000, 74, 69, 'أتمتة المهام المتكررة', 68000, 71000, 22, 'HQ001', 'HQ'),
          ('الرواتب والتعويضات', 12, 39000, 92, 88, 'تحسين التدفقات المالية', 40000, 39000, 5, 'HQ001', 'HQ'),
          ('علاقات الموظفين', 16, 33000, 86, 82, 'تعزيز حلول الخدمة الذاتية', 36000, 33000, 11, 'HQ001', 'HQ'),
          ('تحليلات الموارد البشرية', 10, 28000, 95, 93, 'توسيع التحليلات التنبؤية', 30000, 28000, 4, 'HQ001', 'HQ')
        `
      );
    }

    console.log('✅ hr_cost_optimization_departments table ready');
  } catch (error) {
    console.error('❌ Failed to ensure hr_cost_optimization_departments table:', error);
  }
};

ensureHrCostOptimizationTables();
const ensureHrProductivityRecordsTable = async () => {
  try {
    await db.query(`
      CREATE TABLE IF NOT EXISTS hr_productivity_records (
        id SERIAL PRIMARY KEY,
        employee_name TEXT NOT NULL,
        department TEXT NOT NULL,
        work_hours INTEGER NOT NULL,
        overtime_hours INTEGER DEFAULT 0,
        productivity_level INTEGER NOT NULL,
        efficiency_percent INTEGER NOT NULL,
        final_rating TEXT,
        entity_id TEXT,
        entity_type TEXT,
        created_at TIMESTAMP DEFAULT NOW(),
        updated_at TIMESTAMP DEFAULT NOW()
      );
      ALTER TABLE hr_productivity_records ADD COLUMN IF NOT EXISTS entity_id TEXT;
      ALTER TABLE hr_productivity_records ADD COLUMN IF NOT EXISTS entity_type TEXT;
      CREATE INDEX IF NOT EXISTS idx_hr_prod_department ON hr_productivity_records(department);
      CREATE INDEX IF NOT EXISTS idx_hr_prod_efficiency ON hr_productivity_records(efficiency_percent);
      CREATE INDEX IF NOT EXISTS idx_hr_prod_entity ON hr_productivity_records(entity_id);
    `);

    await db.query(`
      UPDATE hr_productivity_records
      SET entity_id = COALESCE(NULLIF(entity_id, ''), 'HQ001'),
          entity_type = COALESCE(NULLIF(entity_type, ''), 'HQ')
      WHERE entity_id IS NULL OR entity_id = '' OR entity_type IS NULL OR entity_type = ''
    `);

    const seedCheck = await db.query(
      "SELECT COUNT(*)::int AS count FROM hr_productivity_records WHERE entity_id = 'HQ001'"
    );
    if (seedCheck.rows[0]?.count === 0) {
      await db.query(
        `INSERT INTO hr_productivity_records
          (employee_name, department, work_hours, overtime_hours, productivity_level, efficiency_percent, final_rating, entity_id, entity_type)
         VALUES
          ('داليا عمر', 'التطوير المؤسسي', 192, 12, 94, 92, 'ممتاز', 'HQ001', 'HQ'),
          ('زياد المصري', 'العمليات الإدارية', 208, 26, 68, 63, 'منخفض', 'HQ001', 'HQ'),
          ('هند عبد الرحمن', 'التوظيف والاستقطاب', 180, 10, 86, 84, 'جيد جدا', 'HQ001', 'HQ'),
          ('سيف النجار', 'علاقات الموظفين', 165, 8, 88, 90, 'ممتاز', 'HQ001', 'HQ'),
          ('نجلاء يوسف', 'الرواتب والتعويضات', 176, 14, 78, 75, 'جيد', 'HQ001', 'HQ'),
          ('مروان السيد', 'تحليلات الموارد البشرية', 158, 6, 96, 95, 'ممتاز', 'HQ001', 'HQ'),
          ('ريم خالد', 'العمليات الإدارية', 214, 28, 70, 66, 'متوسط', 'HQ001', 'HQ'),
          ('حسين مجدي', 'التوظيف والاستقطاب', 186, 16, 82, 80, 'جيد جدا', 'HQ001', 'HQ')
        `
      );
    }

    console.log('✅ hr_productivity_records table ready');
  } catch (error) {
    console.error('❌ Failed to ensure hr_productivity_records table:', error);
  }
};

ensureHrProductivityRecordsTable();
const ensureHrWorkforcePlansTable = async () => {
  try {
    await db.query(`
      CREATE TABLE IF NOT EXISTS hr_workforce_plans (
        id SERIAL PRIMARY KEY,
        department_name TEXT NOT NULL,
        current_headcount INTEGER NOT NULL,
        target_headcount INTEGER NOT NULL,
        gap INTEGER NOT NULL,
        hiring_plan TEXT,
        review_date DATE,
        status TEXT DEFAULT 'قيد المراجعة',
        notes TEXT,
        entity_id TEXT,
        entity_type TEXT,
        created_at TIMESTAMP DEFAULT NOW(),
        updated_at TIMESTAMP DEFAULT NOW()
      );
      ALTER TABLE hr_workforce_plans ADD COLUMN IF NOT EXISTS department_name TEXT;
      ALTER TABLE hr_workforce_plans ADD COLUMN IF NOT EXISTS current_headcount INTEGER;
      ALTER TABLE hr_workforce_plans ADD COLUMN IF NOT EXISTS target_headcount INTEGER;
      ALTER TABLE hr_workforce_plans ADD COLUMN IF NOT EXISTS gap INTEGER;
      ALTER TABLE hr_workforce_plans ADD COLUMN IF NOT EXISTS hiring_plan TEXT;
      ALTER TABLE hr_workforce_plans ADD COLUMN IF NOT EXISTS review_date DATE;
      ALTER TABLE hr_workforce_plans ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'قيد المراجعة';
      ALTER TABLE hr_workforce_plans ADD COLUMN IF NOT EXISTS notes TEXT;
      ALTER TABLE hr_workforce_plans ADD COLUMN IF NOT EXISTS entity_id TEXT;
      ALTER TABLE hr_workforce_plans ADD COLUMN IF NOT EXISTS entity_type TEXT;
      CREATE INDEX IF NOT EXISTS idx_hr_workforce_department ON hr_workforce_plans(department_name);
      CREATE INDEX IF NOT EXISTS idx_hr_workforce_status ON hr_workforce_plans(status);
      CREATE INDEX IF NOT EXISTS idx_hr_workforce_review_date ON hr_workforce_plans(review_date);
      CREATE INDEX IF NOT EXISTS idx_hr_workforce_entity ON hr_workforce_plans(entity_id);
    `);

    const seedCheck = await db.query(
      "SELECT COUNT(*)::int AS count FROM hr_workforce_plans WHERE entity_id = 'HQ001'"
    );

    if (seedCheck.rows[0]?.count === 0) {
      await db.query(
        `INSERT INTO hr_workforce_plans
          (department_name, current_headcount, target_headcount, gap, hiring_plan, review_date, status, notes, entity_id, entity_type)
         VALUES
          ('التقنية', 980, 1120, 140, 'توظيف 160 مهندس برمجيات وعلوم بيانات', '2026-03-15', 'معتمدة', 'أولوية عالية لدعم توسع المنصة.', 'HQ001', 'HQ'),
          ('المبيعات', 760, 870, 110, 'توسيع فرق المبيعات في 3 مناطق', '2026-03-20', 'قيد المراجعة', 'تركيز على الحسابات الاستراتيجية.', 'HQ001', 'HQ'),
          ('العمليات', 640, 730, 90, 'إحلال 40 وظيفة وتحويل داخلي', '2026-04-05', 'محدثة', 'تحسين التغطية للمناوبات الحرجة.', 'HQ001', 'HQ'),
          ('الدعم', 520, 590, 70, 'توظيف 80 ممثل دعم متعدد اللغات', '2026-04-18', 'معتمدة', 'تحسين زمن الاستجابة.', 'HQ001', 'HQ'),
          ('المنتج', 260, 300, 40, 'تعيين 50 مدير منتج وباحث UX', '2026-05-02', 'قيد المراجعة', 'زيادة القدرة على البحث والتجربة.', 'HQ001', 'HQ'),
          ('المالية', 210, 195, -15, 'تجميد التوظيف مع إعادة توزيع', '2026-03-28', 'معتمدة', 'تخفيف فائض محدود.', 'HQ001', 'HQ'),
          ('الموارد البشرية', 180, 205, 25, 'استقطاب مختصي بيانات وعمليات', '2026-04-10', 'قيد المراجعة', 'تعزيز التحليلات والخدمة الذاتية.', 'HQ001', 'HQ')
        `
      );
    }

    console.log('✅ hr_workforce_plans table ready');
  } catch (error) {
    console.error('❌ Failed to ensure hr_workforce_plans table:', error);
  }
};

ensureHrWorkforcePlansTable();
const ensureHrSuccessionPlansTable = async () => {
  try {
    await db.query(`
      CREATE TABLE IF NOT EXISTS hr_succession_plans (
        id SERIAL PRIMARY KEY,
        role_title TEXT NOT NULL,
        incumbent_name TEXT NOT NULL,
        successor_name TEXT,
        readiness_level TEXT,
        development_plan TEXT,
        review_date DATE,
        succession_status TEXT DEFAULT 'قيد التطوير',
        entity_id TEXT,
        entity_type TEXT,
        created_at TIMESTAMP DEFAULT NOW(),
        updated_at TIMESTAMP DEFAULT NOW()
      );
      ALTER TABLE hr_succession_plans ADD COLUMN IF NOT EXISTS role_title TEXT;
      ALTER TABLE hr_succession_plans ADD COLUMN IF NOT EXISTS incumbent_name TEXT;
      ALTER TABLE hr_succession_plans ADD COLUMN IF NOT EXISTS successor_name TEXT;
      ALTER TABLE hr_succession_plans ADD COLUMN IF NOT EXISTS readiness_level TEXT;
      ALTER TABLE hr_succession_plans ADD COLUMN IF NOT EXISTS development_plan TEXT;
      ALTER TABLE hr_succession_plans ADD COLUMN IF NOT EXISTS review_date DATE;
      ALTER TABLE hr_succession_plans ADD COLUMN IF NOT EXISTS succession_status TEXT DEFAULT 'قيد التطوير';
      ALTER TABLE hr_succession_plans ADD COLUMN IF NOT EXISTS entity_id TEXT;
      ALTER TABLE hr_succession_plans ADD COLUMN IF NOT EXISTS entity_type TEXT;
      CREATE INDEX IF NOT EXISTS idx_hr_succession_role ON hr_succession_plans(role_title);
      CREATE INDEX IF NOT EXISTS idx_hr_succession_status ON hr_succession_plans(succession_status);
      CREATE INDEX IF NOT EXISTS idx_hr_succession_readiness ON hr_succession_plans(readiness_level);
      CREATE INDEX IF NOT EXISTS idx_hr_succession_review ON hr_succession_plans(review_date);
      CREATE INDEX IF NOT EXISTS idx_hr_succession_entity ON hr_succession_plans(entity_id);
    `);

    const seedCheck = await db.query(
      "SELECT COUNT(*)::int AS count FROM hr_succession_plans WHERE entity_id = 'HQ001'"
    );

    if (seedCheck.rows[0]?.count === 0) {
      await db.query(
        `INSERT INTO hr_succession_plans
          (role_title, incumbent_name, successor_name, readiness_level, development_plan, review_date, succession_status, entity_id, entity_type)
         VALUES
          ('مدير العمليات', 'فيصل العتيبي', 'نوف الحربي', 'جاهز الآن', 'برنامج قيادة تنفيذي', '2026-02-15', 'جاهز', 'HQ001', 'HQ'),
          ('رئيس التقنية', 'حسام الغامدي', 'عادل الشريف', 'خلال 6-12 شهر', 'تطوير منصة استراتيجية وقيادة فرق المنتج', '2026-03-05', 'قيد التطوير', 'HQ001', 'HQ'),
          ('مدير الموارد البشرية', 'رانيا السبيعي', 'شيماء عمر', 'جاهز الآن', 'خطة تطوير استراتيجي للقيادات', '2026-02-20', 'جاهز', 'HQ001', 'HQ'),
          ('مدير المالية', 'عبدالله السبيعي', 'رشا السيد', 'خلال 12-24 شهر', 'تدوير عبر وحدات التمويل والتحليل', '2026-04-02', 'قيد التطوير', 'HQ001', 'HQ'),
          ('مدير المبيعات', 'مها الفقيه', 'لين يوسف', 'خلال 6-12 شهر', 'خطة تسريع المواهب وإدارة الحسابات', '2026-03-18', 'قيد التطوير', 'HQ001', 'HQ'),
          ('مدير الامتثال', 'سامي الزهراني', NULL, 'غير متوفر', 'تحديد بديل داخلي وإطلاق برنامج إعداد', '2026-04-12', 'غير متوفر', 'HQ001', 'HQ'),
          ('مدير تجربة العميل', 'هدى منصور', 'سارة العتيق', 'خلال 12-24 شهر', 'تطوير قيادة رحلة العميل متعددة القنوات', '2026-05-01', 'قيد التطوير', 'HQ001', 'HQ'),
          ('مدير البيانات والتحليلات', 'طارق المدني', NULL, 'غير متوفر', 'بناء مسار بديل من فريق التحليلات المتقدم', '2026-05-10', 'غير متوفر', 'HQ001', 'HQ')
        `
      );
    }

    console.log('✅ hr_succession_plans table ready');
  } catch (error) {
    console.error('❌ Failed to ensure hr_succession_plans table:', error);
  }
};

ensureHrSuccessionPlansTable();
const ensureHrInnovationIdeasTable = async () => {
  try {
    await db.query(`
      CREATE TABLE IF NOT EXISTS hr_innovation_ideas (
        id SERIAL PRIMARY KEY,
        owner_name TEXT NOT NULL,
        idea_title TEXT NOT NULL,
        department TEXT NOT NULL,
        innovation_type TEXT NOT NULL,
        expected_impact TEXT NOT NULL,
        status TEXT DEFAULT 'جديدة',
        submitted_on DATE DEFAULT CURRENT_DATE,
        rating NUMERIC(3,1) DEFAULT 0,
        votes INTEGER DEFAULT 0,
        financial_impact NUMERIC(14,2) DEFAULT 0,
        history JSONB DEFAULT '[]',
        entity_id TEXT,
        entity_type TEXT,
        created_at TIMESTAMP DEFAULT NOW(),
        updated_at TIMESTAMP DEFAULT NOW()
      );
      ALTER TABLE hr_innovation_ideas ADD COLUMN IF NOT EXISTS entity_id TEXT;
      ALTER TABLE hr_innovation_ideas ADD COLUMN IF NOT EXISTS entity_type TEXT;
      CREATE INDEX IF NOT EXISTS idx_hr_innovation_status ON hr_innovation_ideas(status);
      CREATE INDEX IF NOT EXISTS idx_hr_innovation_department ON hr_innovation_ideas(department);
      CREATE INDEX IF NOT EXISTS idx_hr_innovation_type ON hr_innovation_ideas(innovation_type);
      CREATE INDEX IF NOT EXISTS idx_hr_innovation_entity ON hr_innovation_ideas(entity_id);
    `);

    await db.query(`
      UPDATE hr_innovation_ideas
      SET entity_id = COALESCE(NULLIF(entity_id, ''), 'HQ001'),
          entity_type = COALESCE(NULLIF(entity_type, ''), 'HQ')
      WHERE entity_id IS NULL OR entity_id = '' OR entity_type IS NULL OR entity_type = ''
    `);

    const seedCheck = await db.query(
      "SELECT COUNT(*)::int AS count FROM hr_innovation_ideas WHERE entity_id = 'HQ001'"
    );
    if (seedCheck.rows[0]?.count === 0) {
      await db.query(
        `INSERT INTO hr_innovation_ideas
          (owner_name, idea_title, department, innovation_type, expected_impact, status, submitted_on, rating, votes, financial_impact, history, entity_id, entity_type)
         VALUES
          ('هالة السالم', 'منصة توصيات ذكية للموظفين', 'التقنية', 'تقني', 'رفع الإنتاجية', 'قيد التقييم', '2026-01-18', 4.3, 124, 4200000,
           '[{"date":"2026-01-18","title":"تقديم الفكرة","note":"تم تسجيل الفكرة ضمن الابتكارات التقنية."},{"date":"2026-01-26","title":"مراجعة أولية","note":"تم طلب بيانات إضافية عن الأثر المالي."}]', 'HQ001', 'HQ'),
          ('طلال الصالح', 'تحسين دورة الموافقات الداخلية', 'العمليات', 'تشغيلي', 'خفض الوقت التشغيلي', 'معتمدة', '2026-01-10', 4.6, 96, 2600000,
           '[{"date":"2026-01-10","title":"تقديم الفكرة","note":"تم تسجيل الفكرة كنموذج تحسين عمليات."},{"date":"2026-01-20","title":"اعتماد الفكرة","note":"تمت الموافقة لبدء التنفيذ."}]', 'HQ001', 'HQ'),
          ('سارة الغانم', 'لوحة توقع الطلب الذكية', 'المبيعات', 'تقني', 'زيادة الإيرادات', 'جديدة', '2026-02-05', 4.1, 78, 1200000,
           '[{"date":"2026-02-05","title":"تقديم الفكرة","note":"تم إدراج الفكرة ضمن مبادرات البيانات."}]', 'HQ001', 'HQ'),
          ('زياد يوسف', 'تحليل صوت العميل تلقائيا', 'الدعم', 'إداري', 'تحسين تجربة العميل', 'قيد التقييم', '2026-01-27', 3.9, 64, 980000,
           '[{"date":"2026-01-27","title":"تقديم الفكرة","note":"تمت إحالة الفكرة للجنة تجربة العميل."}]', 'HQ001', 'HQ'),
          ('رانيا السبيعي', 'خدمة ذاتية للموظف', 'الموارد البشرية', 'تشغيلي', 'توفير تكلفة', 'منفذة', '2025-12-20', 4.8, 142, 1700000,
           '[{"date":"2025-12-20","title":"تقديم الفكرة","note":"تم اعتمادها كأولوية رقمية."},{"date":"2026-01-15","title":"تنفيذ الفكرة","note":"تم إطلاق الخدمة الذاتية."}]', 'HQ001', 'HQ'),
          ('ناصر الحكمي', 'أتمتة طلبات الصيانة', 'الخدمات العامة', 'إداري', 'خفض التكلفة', 'مرفوضة', '2026-01-08', 3.2, 33, 450000,
           '[{"date":"2026-01-08","title":"تقديم الفكرة","note":"تم تقييم الجدوى المبدئية."},{"date":"2026-01-19","title":"رفض الفكرة","note":"العائد أقل من التوقعات الحالية."}]', 'HQ001', 'HQ')
        `
      );
    }

    console.log('✅ hr_innovation_ideas table ready');
  } catch (error) {
    console.error('❌ Failed to ensure hr_innovation_ideas table:', error);
  }
};

ensureHrInnovationIdeasTable();
const ensureHrPayrollRecordsTable = async () => {
  try {
    await db.query(`
      CREATE TABLE IF NOT EXISTS hr_payroll_records (
        id SERIAL PRIMARY KEY,
        employee_name TEXT NOT NULL,
        department TEXT,
        operation_type TEXT DEFAULT 'salary',
        amount NUMERIC(12,2) DEFAULT 0,
        base_salary NUMERIC(12,2) DEFAULT 0,
        allowances NUMERIC(12,2) DEFAULT 0,
        deductions NUMERIC(12,2) DEFAULT 0,
        bonuses NUMERIC(12,2) DEFAULT 0,
        status TEXT DEFAULT 'قيد المعالجة',
        pay_date DATE,
        payroll_month TEXT,
        notes TEXT,
        history JSONB DEFAULT '[]',
        adjustments JSONB DEFAULT '[]',
        entity_id TEXT,
        entity_type TEXT,
        created_at TIMESTAMP DEFAULT NOW(),
        updated_at TIMESTAMP DEFAULT NOW()
      );
      ALTER TABLE hr_payroll_records ADD COLUMN IF NOT EXISTS operation_type TEXT DEFAULT 'salary';
      ALTER TABLE hr_payroll_records ADD COLUMN IF NOT EXISTS amount NUMERIC(12,2) DEFAULT 0;
      ALTER TABLE hr_payroll_records ADD COLUMN IF NOT EXISTS entity_id TEXT;
      ALTER TABLE hr_payroll_records ADD COLUMN IF NOT EXISTS entity_type TEXT;
      CREATE INDEX IF NOT EXISTS idx_hr_payroll_date ON hr_payroll_records(pay_date);
      CREATE INDEX IF NOT EXISTS idx_hr_payroll_status ON hr_payroll_records(status);
      CREATE INDEX IF NOT EXISTS idx_hr_payroll_department ON hr_payroll_records(department);
      CREATE INDEX IF NOT EXISTS idx_hr_payroll_month ON hr_payroll_records(payroll_month);
      CREATE INDEX IF NOT EXISTS idx_hr_payroll_entity ON hr_payroll_records(entity_id);
    `);

    await db.query(`
      UPDATE hr_payroll_records
      SET entity_id = COALESCE(NULLIF(entity_id, ''), 'HQ001'),
          entity_type = COALESCE(NULLIF(entity_type, ''), 'HQ')
      WHERE entity_id IS NULL OR entity_id = '' OR entity_type IS NULL OR entity_type = ''
    `);

    const seedCheck = await db.query(
      "SELECT COUNT(*)::int AS count FROM hr_payroll_records WHERE entity_id = 'HQ001'"
    );
    if (seedCheck.rows[0]?.count === 0) {
      await db.query(
        `INSERT INTO hr_payroll_records
         (employee_name, department, operation_type, amount, base_salary, allowances, deductions, bonuses, status, pay_date, payroll_month, notes, history, adjustments, entity_id, entity_type)
         VALUES
         ('سارة المهنا', 'المالية', 'salary', 14750, 12500, 1800, 450, 900, 'تم الصرف', '2026-02-26', '2026-02', 'تم اعتماد مكافأة الأداء الربع سنوية.',
           '[{"month":"2026-01","net":13500,"status":"تم الصرف"},{"month":"2025-12","net":13200,"status":"تم الصرف"}]',
           '[{"type":"bonus","label":"مكافأة أداء","amount":900,"date":"2026-02-20"},{"type":"deduction","label":"تأمين صحي","amount":200,"date":"2026-02-05"}]', 'HQ001', 'HQ'),
         ('فهد الشمري', 'العمليات', 'salary', 10800, 9800, 1200, 600, 400, 'قيد المعالجة', '2026-02-27', '2026-02', 'في انتظار مطابقة التحويل البنكي.',
           '[{"month":"2026-01","net":10500,"status":"تم الصرف"},{"month":"2025-12","net":10200,"status":"تم الصرف"}]',
           '[{"type":"deduction","label":"غياب يومين","amount":400,"date":"2026-02-12"}]', 'HQ001', 'HQ'),
         ('ريم الدوسري', 'الموارد البشرية', 'salary', 12900, 11000, 1500, 300, 700, 'تم الصرف', '2026-02-25', '2026-02', 'مكافأة احتفاظ بالموهبة.',
           '[{"month":"2026-01","net":12300,"status":"تم الصرف"},{"month":"2025-12","net":12000,"status":"تم الصرف"}]',
           '[{"type":"bonus","label":"مكافأة احتفاظ","amount":700,"date":"2026-02-18"}]', 'HQ001', 'HQ'),
         ('تركي الحربي', 'المبيعات', 'salary', 10950, 9000, 1400, 950, 1500, 'قيد المعالجة', '2026-02-28', '2026-02', 'مكافأة عمولة مبيعات مرتفعة.',
           '[{"month":"2026-01","net":10100,"status":"تم الصرف"},{"month":"2025-12","net":9800,"status":"تم الصرف"}]',
           '[{"type":"bonus","label":"عمولة إضافية","amount":1500,"date":"2026-02-21"},{"type":"deduction","label":"سلفة","amount":600,"date":"2026-02-10"}]', 'HQ001', 'HQ'),
         ('نورة القحطاني', 'التقنية', 'salary', 17700, 15000, 2200, 700, 1200, 'تم الصرف', '2026-02-24', '2026-02', 'تعديل بدل اتصال شهري.',
           '[{"month":"2026-01","net":16500,"status":"تم الصرف"},{"month":"2025-12","net":16200,"status":"تم الصرف"}]',
           '[{"type":"bonus","label":"مكافأة مشروع","amount":1200,"date":"2026-02-15"}]', 'HQ001', 'HQ'),
         ('محمد الغامدي', 'خدمة العملاء', 'salary', 8150, 7800, 900, 850, 300, 'متأخر', '2026-02-20', '2026-02', 'تم تعليق الصرف لحين مراجعة سجل الخصومات.',
           '[{"month":"2026-01","net":8200,"status":"تم الصرف"},{"month":"2025-12","net":8100,"status":"تم الصرف"}]',
           '[{"type":"deduction","label":"خصم تأخير","amount":350,"date":"2026-02-08"},{"type":"deduction","label":"سلفة","amount":500,"date":"2026-02-12"}]', 'HQ001', 'HQ'),
         ('هدى الزهراني', 'التسويق', 'salary', 11950, 10400, 1300, 400, 650, 'تم الصرف', '2026-02-23', '2026-02', 'تعديل بدل التنقل.',
           '[{"month":"2026-01","net":11450,"status":"تم الصرف"},{"month":"2025-12","net":11200,"status":"تم الصرف"}]',
           '[{"type":"bonus","label":"مكافأة حملة","amount":650,"date":"2026-02-19"}]', 'HQ001', 'HQ'),
         ('زياد المطيري', 'المشتريات', 'salary', 10250, 9200, 1100, 500, 450, 'قيد المعالجة', '2026-02-28', '2026-02', 'بانتظار اعتماد الحوافز.',
           '[{"month":"2026-01","net":10000,"status":"تم الصرف"},{"month":"2025-12","net":9800,"status":"تم الصرف"}]',
           '[{"type":"bonus","label":"مكافأة توريد","amount":450,"date":"2026-02-17"}]', 'HQ001', 'HQ')
        `
      );
    }

    console.log('✅ hr_payroll_records table ready');
  } catch (error) {
    console.error('❌ Failed to ensure hr_payroll_records table:', error);
  }
};

ensureHrPayrollRecordsTable();
const ensureHrPerformanceEvaluationsTable = async () => {
  try {
    await db.query(`
      CREATE TABLE IF NOT EXISTS hr_performance_evaluations (
        id SERIAL PRIMARY KEY,
        employee_name TEXT NOT NULL,
        department TEXT,
        evaluation_type TEXT,
        evaluation_period TEXT,
        score NUMERIC(5,2),
        status TEXT DEFAULT 'قيد التقييم',
        evaluator_name TEXT,
        evaluation_date DATE,
        strengths TEXT[],
        improvements TEXT[],
        manager_notes TEXT,
        development_plan TEXT[],
        entity_id TEXT,
        entity_type TEXT,
        created_at TIMESTAMP DEFAULT NOW(),
        updated_at TIMESTAMP DEFAULT NOW()
      );
      ALTER TABLE hr_performance_evaluations ADD COLUMN IF NOT EXISTS entity_id TEXT;
      ALTER TABLE hr_performance_evaluations ADD COLUMN IF NOT EXISTS entity_type TEXT;
      CREATE INDEX IF NOT EXISTS idx_hr_perf_eval_date ON hr_performance_evaluations(evaluation_date);
      CREATE INDEX IF NOT EXISTS idx_hr_perf_eval_status ON hr_performance_evaluations(status);
      CREATE INDEX IF NOT EXISTS idx_hr_perf_eval_department ON hr_performance_evaluations(department);
      CREATE INDEX IF NOT EXISTS idx_hr_perf_eval_entity ON hr_performance_evaluations(entity_id);
    `);

    await db.query(`
      UPDATE hr_performance_evaluations
      SET entity_id = COALESCE(NULLIF(entity_id, ''), 'HQ001'),
          entity_type = COALESCE(NULLIF(entity_type, ''), 'HQ')
      WHERE entity_id IS NULL OR entity_id = '' OR entity_type IS NULL OR entity_type = ''
    `);

    const seedCheck = await db.query(
      "SELECT COUNT(*)::int AS count FROM hr_performance_evaluations WHERE entity_id = 'HQ001'"
    );
    if (seedCheck.rows[0]?.count === 0) {
      await db.query(
        `INSERT INTO hr_performance_evaluations
         (employee_name, department, evaluation_type, evaluation_period, score, status, evaluator_name, evaluation_date, strengths, improvements, manager_notes, development_plan, entity_id, entity_type)
         VALUES
         ('فريق الدعم التقني', 'الدعم الفني', 'تقييم 360', '2025 Q4', 92, 'مكتمل', 'أ. ريم السالمي', '2025-12-28', ARRAY['استجابة سريعة للعملاء','توثيق ممتاز للحالات','التزام واضح بالمعايير'], ARRAY['زيادة التدريب على المنتجات الجديدة','تعزيز التنسيق مع فرق الهندسة'], 'الفريق قدم أداء قوي ومستقر، مع الحاجة لدعم أكبر في موسم الذروة.', ARRAY['جلسات تدريب شهرية للمنتجات','مراجعة أسبوعية لأوقات الاستجابة','مبادرة Mentorship داخل الفريق'], 'HQ001', 'HQ'),
         ('ليان العتيبي', 'الموارد البشرية', 'تقييم أهداف', '2025 Q4', 87, 'قيد التقييم', 'م. سارة عبدالكريم', '2025-12-22', ARRAY['تنفيذ سريع للعمليات','تعاون قوي مع الإدارات'], ARRAY['تطوير مهارات التحليل','تنظيم أولويات المشاريع'], 'التقدم واضح مع الحاجة لهيكلة الأولويات.', ARRAY['تدريب تحليلي لمدة 6 أسابيع','جلسات تخطيط أسبوعية','تحديد مؤشرات أداء أسبوعية'], 'HQ001', 'HQ'),
         ('فريق المبيعات الميدانية', 'المبيعات', 'تقييم 360', '2025 Q3', 79, 'يحتاج مراجعة', 'أ. خالد الشريف', '2025-10-05', ARRAY['بناء علاقات قوية','ارتفاع نسبة الإغلاق'], ARRAY['تحسين التوقعات الشهرية','رفع جودة التقارير'], 'مطلوب خطة لرفع الدقة في التوقعات وتعزيز المتابعة.', ARRAY['إعادة ضبط مؤشرات التوقعات','تدريب على إعداد التقارير','جلسات Coaching فردية'], 'HQ001', 'HQ'),
         ('سلمان الدوسري', 'العمليات', 'تقييم أداء فردي', '2025 Q4', 90, 'مكتمل', 'أ. ناصر الغامدي', '2025-12-18', ARRAY['ضبط العمليات بدقة','قيادة فريق الشفتات'], ARRAY['تفويض أكبر للمهام','توحيد التقارير'], 'الأداء عالي لكن يتطلب توسعة دائرة التفويض.', ARRAY['تطبيق نموذج تفويض','قائمة متابعة أسبوعية','تطوير مهارات قيادية'], 'HQ001', 'HQ'),
         ('فريق المنتج', 'المنتج', 'تقييم أهداف', '2025 Q3', 95, 'مكتمل', 'أ. دانا الحربي', '2025-10-12', ARRAY['ابتكار مستمر','تنفيذ سريع للميزات'], ARRAY['تنسيق أكبر مع التسويق'], 'أفضل أداء خلال الربع، مع احتياج للتواصل مع السوق.', ARRAY['جلسات مشتركة مع التسويق','تحليل دوري لاحتياجات العملاء'], 'HQ001', 'HQ'),
         ('جود القحطاني', 'المالية', 'تقييم أداء فردي', '2025 Q4', 83, 'قيد التقييم', 'م. هدى الشمري', '2025-12-20', ARRAY['تحليل مالي قوي','إدارة دقيقة للبيانات'], ARRAY['رفع جودة التقارير الشهرية'], 'يتم مراجعة المؤشرات مع التركيز على توحيد التقارير.', ARRAY['قالب تقارير موحد','مراجعة أسبوعية مع المدير'], 'HQ001', 'HQ')
        `
      );
    }

    console.log('✅ hr_performance_evaluations table ready');
  } catch (error) {
    console.error('❌ Failed to ensure hr_performance_evaluations table:', error);
  }
};

ensureHrPerformanceEvaluationsTable();

const ensureHrTalentManagementTable = async () => {
  try {
    await db.query(`
      CREATE TABLE IF NOT EXISTS hr_talent_management (
        id SERIAL PRIMARY KEY,
        employee_name TEXT NOT NULL,
        department TEXT,
        core_skills TEXT[] DEFAULT ARRAY[]::TEXT[],
        performance_level NUMERIC(4,2),
        potential_level NUMERIC(4,2),
        talent_classification TEXT DEFAULT 'متوسطة',
        development_plan TEXT,
        development_plan_status TEXT DEFAULT 'نشطة',
        last_review_date DATE,
        notes TEXT,
        entity_id TEXT,
        entity_type TEXT,
        created_at TIMESTAMP DEFAULT NOW(),
        updated_at TIMESTAMP DEFAULT NOW()
      );
      CREATE INDEX IF NOT EXISTS idx_hr_talent_entity ON hr_talent_management(entity_id);
      CREATE INDEX IF NOT EXISTS idx_hr_talent_classification ON hr_talent_management(talent_classification);
      CREATE INDEX IF NOT EXISTS idx_hr_talent_performance ON hr_talent_management(performance_level);
      CREATE INDEX IF NOT EXISTS idx_hr_talent_potential ON hr_talent_management(potential_level);
      CREATE INDEX IF NOT EXISTS idx_hr_talent_review_date ON hr_talent_management(last_review_date);
    `);

    const seedCheck = await db.query('SELECT COUNT(*)::int AS count FROM hr_talent_management');
    if (seedCheck.rows[0]?.count === 0) {
      await db.query(
        `INSERT INTO hr_talent_management
         (employee_name, department, core_skills, performance_level, potential_level, talent_classification, development_plan, development_plan_status, last_review_date, notes, entity_id, entity_type)
         VALUES
         ('سارة اليامي', 'المنتج', ARRAY['قيادة الفرق','تحليل السوق','إدارة المبادرات'], 4.8, 4.7, 'عالية', 'برنامج قيادة إقليمي لمدة 6 أشهر', 'نشطة', '2026-02-15', 'مرشحة لدور مديرة منتج أولى.', 'HQ001', 'HQ'),
         ('مالك الراشد', 'التقنية', ARRAY['بنية الأنظمة','هندسة الأداء','الأمن السيبراني'], 4.6, 4.5, 'عالية', 'مسار خبراء التقنية المتقدم', 'قيد التنفيذ', '2026-02-10', 'يحتاج دعم في بناء قادة الصف الثاني.', 'HQ001', 'HQ'),
         ('ريم الشمري', 'المبيعات', ARRAY['إغلاق الصفقات','إدارة العلاقات','التفاوض'], 4.4, 4.2, 'متوسطة', 'تطوير مهارات القيادة التجارية', 'نشطة', '2026-01-28', 'مطلوب تعزيز التنبؤات البيعية.', 'HQ001', 'HQ'),
         ('محمد حماد', 'التسويق', ARRAY['استراتيجية العلامة','تحليل البيانات','قيادة الحملات'], 4.7, 4.6, 'عالية', 'برنامج قيادة التسويق الاستراتيجي', 'نشطة', '2026-02-18', 'جاهز لمسؤولية إقليمية خلال 3 أشهر.', 'HQ001', 'HQ'),
         ('هدى القحطاني', 'الموارد البشرية', ARRAY['تصميم المواهب','إدارة الأداء','تحليل القوى العاملة'], 4.3, 4.1, 'متوسطة', 'مسار تطوير خبراء الموارد البشرية', 'قيد التنفيذ', '2026-01-20', 'تحتاج لتوسيع شبكة التوجيه الداخلي.', 'HQ001', 'HQ'),
         ('تركي الحربي', 'العمليات', ARRAY['تحسين العمليات','إدارة المخاطر','إدارة الموردين'], 4.1, 3.9, 'قيد التطوير', 'خطة تحسين الكفاءة التشغيلية', 'نشطة', '2026-02-05', 'خطة متابعة أسبوعية للأهداف التشغيلية.', 'HQ001', 'HQ'),
         ('نورة الغامدي', 'المالية', ARRAY['تحليل مالي','التخطيط المالي','إدارة التدفق النقدي'], 4.5, 4.4, 'عالية', 'برنامج قيادة مالية متقدم', 'نشطة', '2026-02-12', 'مستوى جاهزية عالي لإدارة وحدة مالية.', 'HQ001', 'HQ'),
         ('يوسف الدوسري', 'خدمة العملاء', ARRAY['تحسين تجربة العملاء','التواصل الفعال','إدارة الشكاوى'], 3.9, 4.0, 'قيد التطوير', 'برنامج تطوير مهارات تجربة العميل', 'قيد التنفيذ', '2026-01-30', 'بحاجة لتعزيز إدارة الفريق.', 'HQ001', 'HQ')
        `
      );
    }

    console.log('✅ hr_talent_management table ready');
  } catch (error) {
    console.error('❌ Failed to ensure hr_talent_management table:', error);
  }
};

ensureHrTalentManagementTable();

const ensureHrSsoIntegrationsTable = async () => {
  try {
    await db.query(`
      CREATE TABLE IF NOT EXISTS hr_sso_integrations (
        id SERIAL PRIMARY KEY,
        provider_name TEXT NOT NULL,
        protocol TEXT NOT NULL,
        status TEXT DEFAULT 'غير مفعل',
        domain TEXT,
        metadata_url TEXT,
        login_url TEXT,
        last_sync_at TIMESTAMP,
        notes TEXT,
        entity_id TEXT,
        entity_type TEXT,
        created_at TIMESTAMP DEFAULT NOW(),
        updated_at TIMESTAMP DEFAULT NOW()
      );
      CREATE INDEX IF NOT EXISTS idx_hr_sso_integrations_entity ON hr_sso_integrations(entity_id);
      CREATE INDEX IF NOT EXISTS idx_hr_sso_integrations_protocol ON hr_sso_integrations(protocol);
    `);

    const seedCheck = await db.query(
      "SELECT COUNT(*)::int AS count FROM hr_sso_integrations WHERE entity_id = 'HQ001'"
    );
    if (seedCheck.rows[0]?.count === 0) {
      await db.query(
        `INSERT INTO hr_sso_integrations
         (provider_name, protocol, status, domain, metadata_url, login_url, last_sync_at, notes, entity_id, entity_type)
         VALUES
         ('Azure AD', 'SAML 2.0', 'مفعل', 'naiosherp.com', 'https://login.microsoftonline.com/metadata', 'https://login.microsoftonline.com', NOW() - INTERVAL '6 hours', 'ربط الدليل المركزي مع سياسات تكيفية.', 'HQ001', 'HQ'),
         ('Okta Workforce', 'OIDC', 'تجريبي', 'naiosherp.com', 'https://example.okta.com/.well-known/openid-configuration', 'https://example.okta.com', NOW() - INTERVAL '1 day', 'التكامل قيد المراجعة الأمنية.', 'HQ001', 'HQ'),
         ('Google Workspace', 'SAML 2.0', 'غير مفعل', 'naiosherp.com', 'https://accounts.google.com/saml/metadata', 'https://accounts.google.com', NULL, 'جاهز للتفعيل عند اعتماد الشهادة.', 'HQ001', 'HQ')`
      );
    }

    console.log('✅ hr_sso_integrations table ready');
  } catch (error) {
    console.error('❌ Failed to ensure hr_sso_integrations table:', error);
  }
};

ensureHrSsoIntegrationsTable();

const ensureHrErpIntegrationsTable = async () => {
  try {
    await db.query(`
      CREATE TABLE IF NOT EXISTS hr_erp_integrations (
        id SERIAL PRIMARY KEY,
        integration_name TEXT NOT NULL,
        integration_type TEXT NOT NULL,
        linked_entity TEXT,
        status TEXT DEFAULT 'قيد الإعداد',
        owner TEXT,
        notes TEXT,
        entity_id TEXT,
        entity_type TEXT,
        created_at TIMESTAMP DEFAULT NOW(),
        updated_at TIMESTAMP DEFAULT NOW()
      );
      CREATE INDEX IF NOT EXISTS idx_hr_erp_integrations_entity ON hr_erp_integrations(entity_id);
      CREATE INDEX IF NOT EXISTS idx_hr_erp_integrations_status ON hr_erp_integrations(status);
    `);

    const seedCheck = await db.query(
      "SELECT COUNT(*)::int AS count FROM hr_erp_integrations WHERE entity_id = 'HQ001'"
    );
    if (seedCheck.rows[0]?.count === 0) {
      await db.query(
        `INSERT INTO hr_erp_integrations
         (integration_name, integration_type, linked_entity, status, owner, notes, entity_id, entity_type, created_at, updated_at)
         VALUES
         ('SAP Finance Suite', 'مالي', 'SAP - الخليج', 'مفعل', 'م. نجلاء إبراهيم', 'مزامنة يومية مع قيود الرواتب والتسويات.', 'HQ001', 'HQ', NOW() - INTERVAL '500 days', NOW() - INTERVAL '4 days'),
         ('Oracle HCM Link', 'موارد بشرية', 'Oracle - الرياض', 'قيد الإعداد', 'أ. إسراء غانم', 'في انتظار اعتماد مفاتيح API وتطابق الحقول.', 'HQ001', 'HQ', NOW() - INTERVAL '350 days', NOW() - INTERVAL '12 days'),
         ('Dynamics 365 Inventory', 'مخزون', 'Microsoft - جدة', 'غير مفعل', 'م. طارق المنيف', 'متوقف بسبب تغيير سياسات المستودعات.', 'HQ001', 'HQ', NOW() - INTERVAL '600 days', NOW() - INTERVAL '24 days'),
         ('Odoo Procurement Bridge', 'مشتريات', 'Odoo - الدمام', 'مفعل', 'د. مها الرشيد', 'متصل مع نظام الموافقات وربط الموردين.', 'HQ001', 'HQ', NOW() - INTERVAL '240 days', NOW() - INTERVAL '2 days'),
         ('Zoho Books Sync', 'مالي', 'Zoho - أبوظبي', 'مفعل', 'أ. سامر المالكي', 'مزامنة فورية للفواتير ودفعات العملاء.', 'HQ001', 'HQ', NOW() - INTERVAL '310 days', NOW() - INTERVAL '3 days'),
         ('GOSI Compliance Gateway', 'حكومي', 'Microsoft Gov Cloud', 'قيد الإعداد', 'أ. دانيا الشريف', 'مراجعة الامتثال وربط بوابة التأمينات.', 'HQ001', 'HQ', NOW() - INTERVAL '90 days', NOW() - INTERVAL '13 days'),
         ('SuccessFactors Bridge', 'موارد بشرية', 'SAP - المنامة', 'غير مفعل', 'م. وفاء حلمي', 'متوقف بعد انتقال البنية إلى السحابة الخاصة.', 'HQ001', 'HQ', NOW() - INTERVAL '820 days', NOW() - INTERVAL '41 days'),
         ('Oracle Inventory Matrix', 'مخزون', 'Oracle - الدوحة', 'مفعل', 'م. حسام العتيبي', 'مراقبة مستويات المخزون عبر 4 مستودعات.', 'HQ001', 'HQ', NOW() - INTERVAL '260 days', NOW() - INTERVAL '5 days')
        `
      );
    }

    console.log('✅ hr_erp_integrations table ready');
  } catch (error) {
    console.error('❌ Failed to ensure hr_erp_integrations table:', error);
  }
};

ensureHrErpIntegrationsTable();

const ensureHrLearningAcademyTable = async () => {
  try {
    await db.query(`
      CREATE TABLE IF NOT EXISTS hr_learning_academy (
        id SERIAL PRIMARY KEY,
        item_name TEXT NOT NULL,
        item_type TEXT NOT NULL,
        status TEXT DEFAULT 'نشط',
        owner TEXT,
        notes TEXT,
        entity_id TEXT,
        entity_type TEXT,
        created_at TIMESTAMP DEFAULT NOW(),
        updated_at TIMESTAMP DEFAULT NOW()
      );
      CREATE INDEX IF NOT EXISTS idx_hr_learning_entity ON hr_learning_academy(entity_id);
      CREATE INDEX IF NOT EXISTS idx_hr_learning_status ON hr_learning_academy(status);
    `);

    const seedCheck = await db.query(
      "SELECT COUNT(*)::int AS count FROM hr_learning_academy WHERE entity_id = 'HQ001'"
    );
    if (seedCheck.rows[0]?.count === 0) {
      await db.query(
        `INSERT INTO hr_learning_academy
         (item_name, item_type, status, owner, notes, entity_id, entity_type, created_at, updated_at)
         VALUES
         ('برنامج القيادة المرنة', 'برنامج قيادي', 'نشط', 'أ. هند العتيبي', 'يشمل تقييم 360 ومتابعة شهرية.', 'HQ001', 'HQ', NOW() - INTERVAL '72 days', NOW() - INTERVAL '4 days'),
         ('مسار الأمن السيبراني', 'مسار تدريبي', 'نشط', 'م. ناصر الحربي', '4 مستويات تدريبية مع مختبرات عملية.', 'HQ001', 'HQ', NOW() - INTERVAL '113 days', NOW() - INTERVAL '12 days'),
         ('شهادة PMP الداخلية', 'شهادة احترافية', 'موقوف مؤقتا', 'د. ريم الزهراني', 'موقوف مؤقتا لحين تحديث المنهج.', 'HQ001', 'HQ', NOW() - INTERVAL '240 days', NOW() - INTERVAL '25 days'),
         ('ورشة تحسين تجربة العميل', 'ورشة عمل', 'نشط', 'أ. أحمد الشمري', 'جلسات تفاعلية مع تحليل حالات واقعية.', 'HQ001', 'HQ', NOW() - INTERVAL '17 days', NOW() - INTERVAL '3 days'),
         ('مبادرة تطوير القادة الجدد', 'مبادرة تطوير', 'غير نشط', 'م. سارة الغامدي', 'معلقة لعدم اكتمال المرشحين.', 'HQ001', 'HQ', NOW() - INTERVAL '320 days', NOW() - INTERVAL '46 days'),
         ('مسار التحليل المالي المتقدم', 'مسار تدريبي', 'نشط', 'أ. خالد الحازمي', 'يشمل تطبيقات على بيانات الشركة.', 'HQ001', 'HQ', NOW() - INTERVAL '160 days', NOW() - INTERVAL '10 days'),
         ('برنامج خبراء الموارد البشرية', 'برنامج قيادي', 'غير نشط', 'م. فاطمة الأنصاري', 'بانتظار اعتماد الميزانية السنوية.', 'HQ001', 'HQ', NOW() - INTERVAL '410 days', NOW() - INTERVAL '31 days')
        `
      );
    }

    console.log('✅ hr_learning_academy table ready');
  } catch (error) {
    console.error('❌ Failed to ensure hr_learning_academy table:', error);
  }
};

ensureHrLearningAcademyTable();

const ensureTermsConditionsTables = async () => {
  try {
    await db.query(`
      CREATE TABLE IF NOT EXISTS terms_sections (
        id SERIAL PRIMARY KEY,
        title TEXT NOT NULL,
        description TEXT,
        is_active BOOLEAN DEFAULT TRUE,
        display_order INTEGER DEFAULT 0,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
      CREATE TABLE IF NOT EXISTS terms_rules (
        id SERIAL PRIMARY KEY,
        section_id INTEGER REFERENCES terms_sections(id) ON DELETE CASCADE,
        rule_text TEXT NOT NULL,
        is_active BOOLEAN DEFAULT TRUE,
        display_order INTEGER DEFAULT 0,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
      CREATE INDEX IF NOT EXISTS idx_terms_sections_active ON terms_sections(is_active);
      CREATE INDEX IF NOT EXISTS idx_terms_sections_order ON terms_sections(display_order);
      CREATE INDEX IF NOT EXISTS idx_terms_rules_section ON terms_rules(section_id);
      CREATE INDEX IF NOT EXISTS idx_terms_rules_active ON terms_rules(is_active);
      CREATE INDEX IF NOT EXISTS idx_terms_rules_order ON terms_rules(display_order);

      CREATE OR REPLACE FUNCTION update_terms_sections_updated_at()
      RETURNS TRIGGER AS $$
      BEGIN
        NEW.updated_at = CURRENT_TIMESTAMP;
        RETURN NEW;
      END;
      $$ language 'plpgsql';

      DROP TRIGGER IF EXISTS update_terms_sections_timestamp ON terms_sections;
      CREATE TRIGGER update_terms_sections_timestamp
        BEFORE UPDATE ON terms_sections
        FOR EACH ROW
        EXECUTE FUNCTION update_terms_sections_updated_at();

      CREATE OR REPLACE FUNCTION update_terms_rules_updated_at()
      RETURNS TRIGGER AS $$
      BEGIN
        NEW.updated_at = CURRENT_TIMESTAMP;
        RETURN NEW;
      END;
      $$ language 'plpgsql';

      DROP TRIGGER IF EXISTS update_terms_rules_timestamp ON terms_rules;
      CREATE TRIGGER update_terms_rules_timestamp
        BEFORE UPDATE ON terms_rules
        FOR EACH ROW
        EXECUTE FUNCTION update_terms_rules_updated_at();
    `);
    console.log('✅ terms sections & rules tables ready');
  } catch (error) {
    console.error('❌ Failed to ensure terms tables:', error);
  }
};

ensureTermsConditionsTables();

const ensureOperationalPoliciesTables = async () => {
  try {
    await db.query(`
      CREATE TABLE IF NOT EXISTS operational_policies (
        id SERIAL PRIMARY KEY,
        slug TEXT UNIQUE NOT NULL,
        title TEXT NOT NULL,
        authority TEXT NOT NULL,
        category TEXT NOT NULL,
        system_key TEXT DEFAULT 'ADMIN',
        issue_date DATE,
        version TEXT,
        reference TEXT,
        status TEXT DEFAULT 'سارية',
        review_date DATE,
        full_text TEXT,
        download_url TEXT,
        entity_id TEXT DEFAULT 'HQ001',
        entity_type TEXT DEFAULT 'HQ',
        created_at TIMESTAMP DEFAULT NOW(),
        updated_at TIMESTAMP DEFAULT NOW()
      );
      ALTER TABLE operational_policies ADD COLUMN IF NOT EXISTS system_key TEXT DEFAULT 'ADMIN';
      CREATE TABLE IF NOT EXISTS operational_policy_updates (
        id SERIAL PRIMARY KEY,
        policy_id INTEGER REFERENCES operational_policies(id) ON DELETE CASCADE,
        title TEXT NOT NULL,
        note TEXT,
        update_date DATE,
        created_at TIMESTAMP DEFAULT NOW()
      );
      CREATE INDEX IF NOT EXISTS idx_operational_policies_slug ON operational_policies(slug);
      CREATE INDEX IF NOT EXISTS idx_operational_policy_updates_policy ON operational_policy_updates(policy_id);
    `);

    await db.query(`
      INSERT INTO operational_policies
        (slug, title, authority, category, system_key, issue_date, version, reference, status, review_date)
      VALUES
        ('privacy-data', 'سياسة الخصوصية وحماية البيانات', 'إدارة التطوير والجودة', 'تقنية', 'TECH', '2025-04-01', NULL, NULL, 'سارية', '2026-03-15'),
        ('acceptable-use', 'سياسة الاستخدام المقبول', 'إدارة التطوير والجودة', 'تقنية', 'TECH', '2025-04-01', NULL, NULL, 'سارية', '2026-04-01'),
        ('cyber-security', 'سياسة الأمن السيبراني وحماية المعلومات', 'إدارة التطوير والجودة', 'تقنية', 'TECH', '2025-04-01', NULL, NULL, 'سارية', '2026-03-10'),
        ('transparency-disclosure', 'سياسة الشفافية والإفصاح المؤسسي', 'إدارة التطوير والجودة', 'إدارية', 'ADMIN', '2025-04-05', NULL, NULL, 'سارية', '2026-04-05'),
        ('quality-excellence', 'سياسة الجودة وضمان التميز المؤسسي', 'إدارة التطوير والجودة', 'إدارية', 'ADMIN', '2025-04-05', NULL, NULL, 'سارية', '2026-04-05'),
        ('complaints-grievances', 'سياسة الشكاوى والتظلمات', 'إدارة التطوير والجودة', 'إدارية', 'ADMIN', '2025-04-05', NULL, NULL, 'سارية', '2026-04-05'),
        ('anti-discrimination', 'سياسة مكافحة التمييز والتحرش', 'إدارة التطوير والجودة', 'سلوكية', 'HR', '2025-04-05', NULL, NULL, 'سارية', '2026-04-05'),
        ('diversity-inclusion', 'سياسة التنوع والشمول المؤسسي', 'إدارة التطوير والجودة', 'إدارية', 'ADMIN', '2025-04-05', NULL, NULL, 'سارية', '2026-04-05'),
        ('intellectual-property', 'سياسة حماية الملكية الفكرية والحقوق الفكرية', 'إدارة التطوير والجودة', 'إدارية', 'ADMIN', '2025-04-05', NULL, NULL, 'سارية', '2026-04-05'),
        ('admission-registration', 'سياسة القبول والتسجيل', 'إدارة التطوير والجودة', 'أكاديمية', 'ACADEMIC', '2025-04-05', NULL, NULL, 'سارية', '2026-04-05'),
        ('program-transfer', 'سياسة التحويل بين البرامج أو الكليات', 'عمادة القبول و التسجيل', 'أكاديمية', 'ACADEMIC', '2025-08-01', NULL, NULL, 'سارية', '2026-08-01'),
        ('withdrawal-freeze', 'سياسة الانسحاب والتجميد التعليمي', 'إدارة التطوير والجودة', 'أكاديمية', 'ACADEMIC', '2025-04-05', NULL, NULL, 'سارية', '2026-04-05'),
        ('grading-system', 'سياسة الدرجات ونظام توزيعها', 'إدارة التطوير والجودة', 'أكاديمية', 'ACADEMIC', '2025-04-01', NULL, NULL, 'سارية', '2026-04-01'),
        ('academic-excuse', 'سياسة الأعذار الأكاديمية والتغيب', 'إدارة التطوير والجودة', 'أكاديمية', 'ACADEMIC', '2025-04-05', NULL, NULL, 'سارية', '2026-04-05'),
        ('bridging-program', 'سياسة الضوابط والشروط لبرنامج التجسير', 'إدارة القبول والتسجيل', 'أكاديمية', 'ACADEMIC', '2025-08-01', NULL, NULL, 'سارية', '2026-08-01'),
        ('postgraduate-regulations', 'السياسات واللوائح التنظيمية للدراسات العليا', 'إدارة التطوير والجودة', 'أكاديمية', 'ACADEMIC', '2025-04-05', NULL, NULL, 'سارية', '2026-04-05'),
        ('postgraduate-supervision', 'سياسة الإشراف والرسائل العلمية (للدراسات العليا)', 'إدارة التطوير والجودة', 'أكاديمية', 'ACADEMIC', '2025-04-05', NULL, NULL, 'سارية', '2026-04-05'),
        ('student-rights', 'وثيقة حقوق ومسؤوليات الطالب', 'إدارة التطوير والجودة', 'أكاديمية', 'ACADEMIC', '2025-04-05', NULL, NULL, 'سارية', '2026-04-05'),
        ('student-affairs', 'سياسة شؤون الطلبة والأنشطة', 'إدارة التطوير والجودة', 'أكاديمية', 'ACADEMIC', '2025-04-05', NULL, NULL, 'سارية', '2026-04-05'),
        ('academic-guidance', 'سياسة التوجيه والإرشاد الأكاديمي', 'إدارة التطوير والجودة', 'أكاديمية', 'ACADEMIC', '2025-04-05', NULL, NULL, 'سارية', '2026-04-05'),
        ('academic-conduct', 'سياسة السلوك الأكاديمي والانضباط', 'إدارة التطوير والجودة', 'سلوكية', 'HR', '2025-04-05', NULL, NULL, 'سارية', '2026-04-05'),
        ('anti-cheating', 'سياسة مكافحة الغش والانتحال', 'إدارة التطوير والجودة', 'سلوكية', 'HR', '2025-04-05', NULL, NULL, 'سارية', '2026-04-05'),
        ('online-attendance', 'سياسة الحضور والمشاركة الإلكترونية', 'إدارة التطوير والجودة', 'أكاديمية', 'ACADEMIC', '2025-04-05', NULL, NULL, 'سارية', '2026-04-05'),
        ('student-faculty-communication', 'سياسة التواصل بين الطالب والهيئة التدريسية', 'إدارة التطوير والجودة', 'أكاديمية', 'ACADEMIC', '2025-04-05', NULL, NULL, 'سارية', '2026-04-05'),
        ('lms-usage', 'سياسة استخدام نظام إدارة التعلم (LMS)', 'إدارة التطوير والجودة', 'تقنية', 'TECH', '2025-04-05', NULL, NULL, 'سارية', '2026-04-05'),
        ('academic-procedural-guide', 'الدليل الأكاديمي والإجرائي', 'إدارة الشؤون الأكاديمية', 'أكاديمية', 'ACADEMIC', '2025-10-15', NULL, NULL, 'محدثة', '2026-10-15'),
        ('postgraduate-bylaws', 'اللائحة الداخلية لبرامج الدراسات العليا', 'إدارة التطوير والجودة', 'أكاديمية', 'ACADEMIC', '2025-08-01', NULL, NULL, 'سارية', '2026-08-01'),
        ('tuition-fees', 'سياسة دفع الرسوم الدراسية', 'الإدارة المالية', 'مالية', 'FINANCE', '2025-04-01', NULL, NULL, 'سارية', '2026-04-01'),
        ('refunds-policy', 'سياسة الانسحاب واسترداد الرسوم', 'الإدارة المالية', 'مالية', 'FINANCE', '2025-04-01', NULL, NULL, 'سارية', '2026-04-01'),
        ('online-exams-guide', 'دليل الاختبارات الإلكترونية', 'إدارة التطوير والجودة', 'تقنية', 'TECH', '2025-08-01', NULL, NULL, 'سارية', '2026-08-01'),
        ('assessment-policy', 'سياسة التقييم والاختبارات', 'إدارة التطوير والجودة', 'أكاديمية', 'ACADEMIC', '2025-10-10', NULL, NULL, 'محدثة', '2026-10-10')
      ON CONFLICT (slug) DO NOTHING;
    `);

    await db.query(`
      UPDATE operational_policies
      SET system_key = CASE
        WHEN category = 'مالية' THEN 'FINANCE'
        WHEN category = 'تقنية' THEN 'TECH'
        WHEN category = 'أكاديمية' THEN 'ACADEMIC'
        WHEN category = 'سلوكية' THEN 'HR'
        WHEN category = 'إدارية' THEN 'ADMIN'
        ELSE system_key
      END
      WHERE system_key IS NULL
        OR system_key = ''
        OR (system_key = 'ADMIN' AND category IN ('مالية', 'تقنية', 'أكاديمية', 'سلوكية'));
    `);

    console.log('✅ operational_policies tables ready');
  } catch (error) {
    console.error('❌ Failed to ensure operational_policies tables:', error);
  }
};

ensureOperationalPoliciesTables();

// Accepted employees table
const ensureAcceptedEmployeesTable = async () => {
  try {
    await db.query(`
      CREATE TABLE IF NOT EXISTS accepted_employees (
        id SERIAL PRIMARY KEY,
        full_name TEXT NOT NULL,
        job_title TEXT NOT NULL,
        email TEXT,
        phone TEXT,
        hire_date DATE NOT NULL,
        entity_id TEXT DEFAULT 'HQ001',
        created_at TIMESTAMP DEFAULT NOW(),
        updated_at TIMESTAMP DEFAULT NOW()
      );
      CREATE INDEX IF NOT EXISTS idx_accepted_employees_entity ON accepted_employees(entity_id);
      CREATE INDEX IF NOT EXISTS idx_accepted_employees_hire_date ON accepted_employees(hire_date);
      CREATE UNIQUE INDEX IF NOT EXISTS uq_accepted_employees_identity ON accepted_employees(full_name, job_title, hire_date, entity_id);
    `);
    console.log('✅ accepted_employees table ready');
  } catch (error) {
    console.error('❌ Failed to ensure accepted_employees table:', error);
  }
};

ensureAcceptedEmployeesTable();

// New hires table
const ensureNewHiresTable = async () => {
  try {
    await db.query(`
      CREATE TABLE IF NOT EXISTS new_hires (
        id SERIAL PRIMARY KEY,
        full_name TEXT NOT NULL,
        reference_code TEXT NOT NULL,
        phone TEXT,
        employee_info TEXT,
        interview_date DATE NOT NULL,
        match_percent NUMERIC,
        status TEXT DEFAULT 'pending',
        decision_reason TEXT,
        decision_at TIMESTAMP,
        entity_id TEXT DEFAULT 'HQ001',
        created_at TIMESTAMP DEFAULT NOW(),
        updated_at TIMESTAMP DEFAULT NOW()
      );
      ALTER TABLE new_hires ADD COLUMN IF NOT EXISTS decision_reason TEXT;
      ALTER TABLE new_hires ADD COLUMN IF NOT EXISTS decision_at TIMESTAMP;
      CREATE INDEX IF NOT EXISTS idx_new_hires_entity ON new_hires(entity_id);
      CREATE INDEX IF NOT EXISTS idx_new_hires_interview_date ON new_hires(interview_date);
      CREATE INDEX IF NOT EXISTS idx_new_hires_status ON new_hires(status);
      CREATE INDEX IF NOT EXISTS idx_new_hires_decision_at ON new_hires(decision_at);
      CREATE UNIQUE INDEX IF NOT EXISTS uq_new_hires_reference ON new_hires(reference_code, entity_id);
    `);
    console.log('✅ new_hires table ready');
  } catch (error) {
    console.error('❌ Failed to ensure new_hires table:', error);
  }
};

ensureNewHiresTable();

// Attendance logs table
const ensureAttendanceLogsTable = async () => {
  try {
    await db.query(`
      CREATE TABLE IF NOT EXISTS attendance_logs (
        id SERIAL PRIMARY KEY,
        employee_id TEXT,
        employee_name TEXT NOT NULL,
        department TEXT,
        attendance_date DATE NOT NULL,
        shift_type TEXT,
        check_in TIMESTAMP,
        check_out TIMESTAMP,
        work_minutes INTEGER,
        status TEXT DEFAULT 'pending',
        decision_reason TEXT,
        decision_at TIMESTAMP,
        notes TEXT,
        entity_id TEXT DEFAULT 'HQ001',
        created_at TIMESTAMP DEFAULT NOW(),
        updated_at TIMESTAMP DEFAULT NOW()
      );
      ALTER TABLE attendance_logs ADD COLUMN IF NOT EXISTS employee_id TEXT;
      ALTER TABLE attendance_logs ADD COLUMN IF NOT EXISTS department TEXT;
      ALTER TABLE attendance_logs ADD COLUMN IF NOT EXISTS attendance_date DATE;
      ALTER TABLE attendance_logs ADD COLUMN IF NOT EXISTS shift_type TEXT;
      ALTER TABLE attendance_logs ADD COLUMN IF NOT EXISTS check_in TIMESTAMP;
      ALTER TABLE attendance_logs ADD COLUMN IF NOT EXISTS check_out TIMESTAMP;
      ALTER TABLE attendance_logs ADD COLUMN IF NOT EXISTS work_minutes INTEGER;
      ALTER TABLE attendance_logs ADD COLUMN IF NOT EXISTS status TEXT;
      ALTER TABLE attendance_logs ADD COLUMN IF NOT EXISTS decision_reason TEXT;
      ALTER TABLE attendance_logs ADD COLUMN IF NOT EXISTS decision_at TIMESTAMP;
      ALTER TABLE attendance_logs ADD COLUMN IF NOT EXISTS notes TEXT;
      CREATE INDEX IF NOT EXISTS idx_attendance_logs_entity ON attendance_logs(entity_id);
      CREATE INDEX IF NOT EXISTS idx_attendance_logs_date ON attendance_logs(attendance_date);
      CREATE INDEX IF NOT EXISTS idx_attendance_logs_status ON attendance_logs(status);
    `);
    console.log('✅ attendance_logs table ready');
  } catch (error) {
    console.error('❌ Failed to ensure attendance_logs table:', error);
  }
};

ensureAttendanceLogsTable();

// Shift schedules table
const ensureShiftSchedulesTable = async () => {
  try {
    await db.query(`
      CREATE TABLE IF NOT EXISTS shift_schedules (
        id SERIAL PRIMARY KEY,
        employee_id TEXT,
        employee_name TEXT NOT NULL,
        department TEXT,
        work_days TEXT[],
        off_days TEXT[],
        shift_type TEXT,
        shift_start TIME,
        shift_end TIME,
        status TEXT DEFAULT 'active',
        notes TEXT,
        entity_id TEXT DEFAULT 'HQ001',
        created_at TIMESTAMP DEFAULT NOW(),
        updated_at TIMESTAMP DEFAULT NOW()
      );
      ALTER TABLE shift_schedules ADD COLUMN IF NOT EXISTS employee_id TEXT;
      ALTER TABLE shift_schedules ADD COLUMN IF NOT EXISTS department TEXT;
      ALTER TABLE shift_schedules ADD COLUMN IF NOT EXISTS work_days TEXT[];
      ALTER TABLE shift_schedules ADD COLUMN IF NOT EXISTS off_days TEXT[];
      ALTER TABLE shift_schedules ADD COLUMN IF NOT EXISTS shift_type TEXT;
      ALTER TABLE shift_schedules ADD COLUMN IF NOT EXISTS shift_start TIME;
      ALTER TABLE shift_schedules ADD COLUMN IF NOT EXISTS shift_end TIME;
      ALTER TABLE shift_schedules ADD COLUMN IF NOT EXISTS status TEXT;
      ALTER TABLE shift_schedules ADD COLUMN IF NOT EXISTS notes TEXT;
      CREATE INDEX IF NOT EXISTS idx_shift_schedules_entity ON shift_schedules(entity_id);
      CREATE INDEX IF NOT EXISTS idx_shift_schedules_status ON shift_schedules(status);
      CREATE INDEX IF NOT EXISTS idx_shift_schedules_name ON shift_schedules(employee_name);
    `);
    console.log('✅ shift_schedules table ready');
  } catch (error) {
    console.error('❌ Failed to ensure shift_schedules table:', error);
  }
};

ensureShiftSchedulesTable();

// Leave management tables
const ensureLeaveManagementTables = async () => {
  try {
    await db.query(`
      CREATE TABLE IF NOT EXISTS leave_balances (
        id SERIAL PRIMARY KEY,
        employee_id TEXT,
        employee_name TEXT NOT NULL,
        department TEXT,
        annual_days INTEGER DEFAULT 0,
        used_days INTEGER DEFAULT 0,
        pending_days INTEGER DEFAULT 0,
        carry_over INTEGER DEFAULT 0,
        year INTEGER DEFAULT EXTRACT(YEAR FROM CURRENT_DATE),
        notes TEXT,
        entity_id TEXT DEFAULT 'HQ001',
        created_at TIMESTAMP DEFAULT NOW(),
        updated_at TIMESTAMP DEFAULT NOW()
      );
      CREATE TABLE IF NOT EXISTS leave_requests (
        id SERIAL PRIMARY KEY,
        employee_id TEXT,
        employee_name TEXT NOT NULL,
        department TEXT,
        leave_type TEXT,
        start_date DATE NOT NULL,
        end_date DATE NOT NULL,
        days_count INTEGER,
        reason TEXT,
        status TEXT DEFAULT 'pending',
        decision_reason TEXT,
        decision_at TIMESTAMP,
        reviewed_by TEXT,
        entity_id TEXT DEFAULT 'HQ001',
        created_at TIMESTAMP DEFAULT NOW(),
        updated_at TIMESTAMP DEFAULT NOW()
      );
      ALTER TABLE leave_balances ADD COLUMN IF NOT EXISTS employee_id TEXT;
      ALTER TABLE leave_balances ADD COLUMN IF NOT EXISTS employee_name TEXT;
      ALTER TABLE leave_balances ADD COLUMN IF NOT EXISTS department TEXT;
      ALTER TABLE leave_balances ADD COLUMN IF NOT EXISTS annual_days INTEGER;
      ALTER TABLE leave_balances ADD COLUMN IF NOT EXISTS used_days INTEGER;
      ALTER TABLE leave_balances ADD COLUMN IF NOT EXISTS pending_days INTEGER;
      ALTER TABLE leave_balances ADD COLUMN IF NOT EXISTS carry_over INTEGER;
      ALTER TABLE leave_balances ADD COLUMN IF NOT EXISTS year INTEGER;
      ALTER TABLE leave_balances ADD COLUMN IF NOT EXISTS notes TEXT;
      ALTER TABLE leave_requests ADD COLUMN IF NOT EXISTS employee_id TEXT;
      ALTER TABLE leave_requests ADD COLUMN IF NOT EXISTS employee_name TEXT;
      ALTER TABLE leave_requests ADD COLUMN IF NOT EXISTS department TEXT;
      ALTER TABLE leave_requests ADD COLUMN IF NOT EXISTS leave_type TEXT;
      ALTER TABLE leave_requests ADD COLUMN IF NOT EXISTS start_date DATE;
      ALTER TABLE leave_requests ADD COLUMN IF NOT EXISTS end_date DATE;
      ALTER TABLE leave_requests ADD COLUMN IF NOT EXISTS days_count INTEGER;
      ALTER TABLE leave_requests ADD COLUMN IF NOT EXISTS reason TEXT;
      ALTER TABLE leave_requests ADD COLUMN IF NOT EXISTS status TEXT;
      ALTER TABLE leave_requests ADD COLUMN IF NOT EXISTS decision_reason TEXT;
      ALTER TABLE leave_requests ADD COLUMN IF NOT EXISTS decision_at TIMESTAMP;
      ALTER TABLE leave_requests ADD COLUMN IF NOT EXISTS reviewed_by TEXT;
      CREATE INDEX IF NOT EXISTS idx_leave_balances_entity ON leave_balances(entity_id);
      CREATE INDEX IF NOT EXISTS idx_leave_balances_employee ON leave_balances(employee_name);
      CREATE INDEX IF NOT EXISTS idx_leave_balances_year ON leave_balances(year);
      CREATE INDEX IF NOT EXISTS idx_leave_requests_entity ON leave_requests(entity_id);
      CREATE INDEX IF NOT EXISTS idx_leave_requests_status ON leave_requests(status);
      CREATE INDEX IF NOT EXISTS idx_leave_requests_dates ON leave_requests(start_date, end_date);
      CREATE INDEX IF NOT EXISTS idx_leave_requests_employee ON leave_requests(employee_name);
      CREATE UNIQUE INDEX IF NOT EXISTS uq_leave_balances_employee_year ON leave_balances(entity_id, employee_name, year);
    `);
    console.log('✅ leave management tables ready');
  } catch (error) {
    console.error('❌ Failed to ensure leave management tables:', error);
  }
};

ensureLeaveManagementTables();

// HR assets & custodies tables
const ensureHrAssetsCustodiesTables = async () => {
  try {
    await db.query(`
      CREATE TABLE IF NOT EXISTS hr_asset_coding_system (
        id SERIAL PRIMARY KEY,
        code_prefix TEXT UNIQUE NOT NULL,
        name_en TEXT,
        name_ar TEXT,
        category_ar TEXT,
        category_en TEXT,
        example_code TEXT,
        entity_id TEXT DEFAULT 'HQ001',
        created_at TIMESTAMP DEFAULT NOW(),
        updated_at TIMESTAMP DEFAULT NOW()
      );
      CREATE TABLE IF NOT EXISTS hr_asset_registry (
        id SERIAL PRIMARY KEY,
        serial_number TEXT UNIQUE NOT NULL,
        asset_name TEXT,
        description TEXT,
        location TEXT,
        status TEXT,
        notes TEXT,
        entity_id TEXT DEFAULT 'HQ001',
        created_at TIMESTAMP DEFAULT NOW(),
        updated_at TIMESTAMP DEFAULT NOW()
      );
      CREATE TABLE IF NOT EXISTS hr_asset_classifications (
        id SERIAL PRIMARY KEY,
        serial_number TEXT UNIQUE NOT NULL,
        item_name_ar TEXT,
        item_name_en TEXT,
        location TEXT,
        status TEXT,
        notes TEXT,
        asset_type_ar TEXT,
        asset_type_en TEXT,
        entity_id TEXT DEFAULT 'HQ001',
        created_at TIMESTAMP DEFAULT NOW(),
        updated_at TIMESTAMP DEFAULT NOW()
      );
      CREATE TABLE IF NOT EXISTS hr_asset_type_summary (
        id SERIAL PRIMARY KEY,
        asset_type_ar TEXT,
        asset_type_en TEXT,
        total_count INTEGER DEFAULT 0,
        entity_id TEXT DEFAULT 'HQ001',
        created_at TIMESTAMP DEFAULT NOW(),
        updated_at TIMESTAMP DEFAULT NOW(),
        UNIQUE (asset_type_ar, asset_type_en, entity_id)
      );
      CREATE TABLE IF NOT EXISTS hr_asset_warehouse (
        id SERIAL PRIMARY KEY,
        serial_number_ar TEXT UNIQUE NOT NULL,
        serial_number_en TEXT,
        asset_code_ar TEXT,
        asset_code_en TEXT,
        asset_name_ar TEXT,
        asset_name_en TEXT,
        quantity INTEGER,
        condition_ar TEXT,
        condition_en TEXT,
        entry_date DATE,
        reason_ar TEXT,
        reason_en TEXT,
        entity_id TEXT DEFAULT 'HQ001',
        created_at TIMESTAMP DEFAULT NOW(),
        updated_at TIMESTAMP DEFAULT NOW()
      );
      ALTER TABLE hr_asset_coding_system ADD COLUMN IF NOT EXISTS name_en TEXT;
      ALTER TABLE hr_asset_coding_system ADD COLUMN IF NOT EXISTS name_ar TEXT;
      ALTER TABLE hr_asset_coding_system ADD COLUMN IF NOT EXISTS category_ar TEXT;
      ALTER TABLE hr_asset_coding_system ADD COLUMN IF NOT EXISTS category_en TEXT;
      ALTER TABLE hr_asset_coding_system ADD COLUMN IF NOT EXISTS example_code TEXT;
      ALTER TABLE hr_asset_registry ADD COLUMN IF NOT EXISTS asset_name TEXT;
      ALTER TABLE hr_asset_registry ADD COLUMN IF NOT EXISTS description TEXT;
      ALTER TABLE hr_asset_registry ADD COLUMN IF NOT EXISTS location TEXT;
      ALTER TABLE hr_asset_registry ADD COLUMN IF NOT EXISTS status TEXT;
      ALTER TABLE hr_asset_registry ADD COLUMN IF NOT EXISTS notes TEXT;
      ALTER TABLE hr_asset_classifications ADD COLUMN IF NOT EXISTS item_name_ar TEXT;
      ALTER TABLE hr_asset_classifications ADD COLUMN IF NOT EXISTS item_name_en TEXT;
      ALTER TABLE hr_asset_classifications ADD COLUMN IF NOT EXISTS location TEXT;
      ALTER TABLE hr_asset_classifications ADD COLUMN IF NOT EXISTS status TEXT;
      ALTER TABLE hr_asset_classifications ADD COLUMN IF NOT EXISTS notes TEXT;
      ALTER TABLE hr_asset_classifications ADD COLUMN IF NOT EXISTS asset_type_ar TEXT;
      ALTER TABLE hr_asset_classifications ADD COLUMN IF NOT EXISTS asset_type_en TEXT;
      ALTER TABLE hr_asset_type_summary ADD COLUMN IF NOT EXISTS total_count INTEGER;
      ALTER TABLE hr_asset_warehouse ADD COLUMN IF NOT EXISTS serial_number_en TEXT;
      ALTER TABLE hr_asset_warehouse ADD COLUMN IF NOT EXISTS asset_code_ar TEXT;
      ALTER TABLE hr_asset_warehouse ADD COLUMN IF NOT EXISTS asset_code_en TEXT;
      ALTER TABLE hr_asset_warehouse ADD COLUMN IF NOT EXISTS asset_name_ar TEXT;
      ALTER TABLE hr_asset_warehouse ADD COLUMN IF NOT EXISTS asset_name_en TEXT;
      ALTER TABLE hr_asset_warehouse ADD COLUMN IF NOT EXISTS quantity INTEGER;
      ALTER TABLE hr_asset_warehouse ADD COLUMN IF NOT EXISTS condition_ar TEXT;
      ALTER TABLE hr_asset_warehouse ADD COLUMN IF NOT EXISTS condition_en TEXT;
      ALTER TABLE hr_asset_warehouse ADD COLUMN IF NOT EXISTS entry_date DATE;
      ALTER TABLE hr_asset_warehouse ADD COLUMN IF NOT EXISTS reason_ar TEXT;
      ALTER TABLE hr_asset_warehouse ADD COLUMN IF NOT EXISTS reason_en TEXT;
      CREATE INDEX IF NOT EXISTS idx_hr_asset_registry_entity ON hr_asset_registry(entity_id);
      CREATE INDEX IF NOT EXISTS idx_hr_asset_classifications_entity ON hr_asset_classifications(entity_id);
      CREATE INDEX IF NOT EXISTS idx_hr_asset_warehouse_entity ON hr_asset_warehouse(entity_id);
      CREATE INDEX IF NOT EXISTS idx_hr_asset_coding_entity ON hr_asset_coding_system(entity_id);
      CREATE INDEX IF NOT EXISTS idx_hr_asset_type_summary_entity ON hr_asset_type_summary(entity_id);
    `);
    console.log('✅ hr assets & custodies tables ready');
  } catch (error) {
    console.error('❌ Failed to ensure hr assets tables:', error);
  }
};

ensureHrAssetsCustodiesTables();

const ensureHrModuleRecordsTable = async () => {
  try {
    await db.query(`
      CREATE TABLE IF NOT EXISTS hr_module_records (
        id SERIAL PRIMARY KEY,
        module_key TEXT NOT NULL,
        title TEXT NOT NULL,
        department TEXT,
        doc_number TEXT,
        doc_type TEXT,
        doc_category TEXT,
        archive_date DATE,
        confidentiality TEXT,
        procedure_type TEXT,
        steps_count INTEGER,
        owner TEXT,
        status TEXT DEFAULT 'قيد المراجعة',
        priority TEXT DEFAULT 'متوسط',
        due_date DATE,
        issue_date DATE,
        notes TEXT,
        keywords TEXT,
        display_order INTEGER,
        review_status TEXT,
        share_status TEXT,
        is_locked BOOLEAN DEFAULT false,
        locked_by TEXT,
        locked_at TIMESTAMP,
        last_activity_at TIMESTAMP,
        entity_id TEXT,
        entity_type TEXT,
        created_at TIMESTAMP DEFAULT NOW(),
        updated_at TIMESTAMP DEFAULT NOW()
      );
      ALTER TABLE hr_module_records ADD COLUMN IF NOT EXISTS department TEXT;
      ALTER TABLE hr_module_records ADD COLUMN IF NOT EXISTS doc_number TEXT;
      ALTER TABLE hr_module_records ADD COLUMN IF NOT EXISTS doc_type TEXT;
      ALTER TABLE hr_module_records ADD COLUMN IF NOT EXISTS doc_category TEXT;
      ALTER TABLE hr_module_records ADD COLUMN IF NOT EXISTS archive_date DATE;
      ALTER TABLE hr_module_records ADD COLUMN IF NOT EXISTS confidentiality TEXT;
      ALTER TABLE hr_module_records ADD COLUMN IF NOT EXISTS procedure_type TEXT;
      ALTER TABLE hr_module_records ADD COLUMN IF NOT EXISTS steps_count INTEGER;
      ALTER TABLE hr_module_records ADD COLUMN IF NOT EXISTS issue_date DATE;
      ALTER TABLE hr_module_records ADD COLUMN IF NOT EXISTS keywords TEXT;
      ALTER TABLE hr_module_records ADD COLUMN IF NOT EXISTS display_order INTEGER;
      ALTER TABLE hr_module_records ADD COLUMN IF NOT EXISTS review_status TEXT;
      ALTER TABLE hr_module_records ADD COLUMN IF NOT EXISTS share_status TEXT;
      ALTER TABLE hr_module_records ADD COLUMN IF NOT EXISTS is_locked BOOLEAN DEFAULT false;
      ALTER TABLE hr_module_records ADD COLUMN IF NOT EXISTS locked_by TEXT;
      ALTER TABLE hr_module_records ADD COLUMN IF NOT EXISTS locked_at TIMESTAMP;
      ALTER TABLE hr_module_records ADD COLUMN IF NOT EXISTS last_activity_at TIMESTAMP;
      CREATE INDEX IF NOT EXISTS idx_hr_module_records_module ON hr_module_records(module_key);
      CREATE INDEX IF NOT EXISTS idx_hr_module_records_entity ON hr_module_records(entity_id);
      CREATE INDEX IF NOT EXISTS idx_hr_module_records_status ON hr_module_records(status);
      CREATE INDEX IF NOT EXISTS idx_hr_module_records_doc_number ON hr_module_records(doc_number);
      CREATE INDEX IF NOT EXISTS idx_hr_module_records_confidentiality ON hr_module_records(confidentiality);
      CREATE INDEX IF NOT EXISTS idx_hr_module_records_archive_date ON hr_module_records(archive_date);
      CREATE INDEX IF NOT EXISTS idx_hr_module_records_doc_category ON hr_module_records(doc_category);
      CREATE INDEX IF NOT EXISTS idx_hr_module_records_display_order ON hr_module_records(display_order);
      CREATE INDEX IF NOT EXISTS idx_hr_module_records_keywords ON hr_module_records(keywords);

      CREATE TABLE IF NOT EXISTS hr_module_record_files (
        id SERIAL PRIMARY KEY,
        record_id INTEGER NOT NULL REFERENCES hr_module_records(id) ON DELETE CASCADE,
        module_key TEXT NOT NULL,
        original_name TEXT NOT NULL,
        stored_name TEXT NOT NULL,
        mime_type TEXT,
        size_bytes INTEGER,
        extension TEXT,
        file_path TEXT NOT NULL,
        entity_id TEXT,
        entity_type TEXT,
        created_at TIMESTAMP DEFAULT NOW()
      );
      CREATE INDEX IF NOT EXISTS idx_hr_module_record_files_record ON hr_module_record_files(record_id);
      CREATE INDEX IF NOT EXISTS idx_hr_module_record_files_module ON hr_module_record_files(module_key);
      CREATE INDEX IF NOT EXISTS idx_hr_module_record_files_entity ON hr_module_record_files(entity_id);

      CREATE TABLE IF NOT EXISTS hr_archive_activity_log (
        id SERIAL PRIMARY KEY,
        record_id INTEGER NOT NULL REFERENCES hr_module_records(id) ON DELETE CASCADE,
        module_key TEXT NOT NULL,
        action TEXT NOT NULL,
        actor_name TEXT,
        actor_role TEXT,
        details TEXT,
        entity_id TEXT,
        entity_type TEXT,
        created_at TIMESTAMP DEFAULT NOW()
      );
      CREATE INDEX IF NOT EXISTS idx_hr_archive_activity_record ON hr_archive_activity_log(record_id);
      CREATE INDEX IF NOT EXISTS idx_hr_archive_activity_entity ON hr_archive_activity_log(entity_id);
      CREATE INDEX IF NOT EXISTS idx_hr_archive_activity_created ON hr_archive_activity_log(created_at DESC);
    `);
    console.log('✅ hr module records table ready');

    const seedCheck = await db.query(
      "SELECT COUNT(*)::int AS count FROM hr_module_records WHERE module_key = 'process-automation' AND entity_id = 'HQ001'"
    );

    if (seedCheck.rows[0]?.count === 0) {
      await db.query(
        `INSERT INTO hr_module_records
          (module_key, title, department, procedure_type, status, steps_count, owner, notes, entity_id, entity_type, created_at, updated_at)
         VALUES
          ('process-automation', 'أتمتة اعتماد الإجازات', 'الموارد البشرية', 'اعتماد إداري', 'نشط', 5, 'فريق شؤون الموظفين', 'اعتماد آلي مع إشعار المدير المباشر.', 'HQ001', 'HQ', '2026-02-10', '2026-02-26'),
          ('process-automation', 'أتمتة طلبات العهد', 'الخدمات الإدارية', 'طلب خدمة', 'قيد التنفيذ', 6, 'وحدة الخدمات', 'ربط الطلب بالمخزون وموافقات الإدارة.', 'HQ001', 'HQ', '2026-02-12', '2026-02-28'),
          ('process-automation', 'أتمتة متابعة التعيين', 'الاستقطاب', 'تشغيل يومي', 'نشط', 4, 'قسم التوظيف', 'تسلسل رقمي للموافقات والفحص الطبي.', 'HQ001', 'HQ', '2026-02-15', '2026-02-27'),
          ('process-automation', 'أتمتة تحديث بيانات الموظف', 'شؤون الموظفين', 'تشغيل يومي', 'متوقف', 3, 'مكتب شؤون الموظفين', 'تم إيقافه لحين مراجعة ضوابط الخصوصية.', 'HQ001', 'HQ', '2026-02-08', '2026-02-20'),
          ('process-automation', 'أتمتة تصعيد الإنذارات', 'الانضباط الوظيفي', 'متابعة امتثال', 'قيد التنفيذ', 7, 'لجنة الانضباط', 'تصعيد تلقائي حسب مستويات المخالفة.', 'HQ001', 'HQ', '2026-02-18', '2026-02-28'),
          ('process-automation', 'أتمتة اعتماد بدل المناوبة', 'الرواتب', 'إجراء مالي', 'نشط', 5, 'قسم الرواتب', 'تطابق الحضور مع جداول المناوبات.', 'HQ001', 'HQ', '2026-02-20', '2026-02-27')
        `
      );
    }

    const circularsSeedCheck = await db.query(
      "SELECT COUNT(*)::int AS count FROM hr_module_records WHERE module_key = 'admin-circulars' AND entity_id = 'HQ001'"
    );

    if (circularsSeedCheck.rows[0]?.count === 0) {
      await db.query(
        `INSERT INTO hr_module_records
          (module_key, title, department, procedure_type, status, priority, issue_date, notes, entity_id, entity_type, created_at, updated_at)
         VALUES
          ('admin-circulars', 'تعميم آلية الحضور والانصراف 2026', 'إدارة الموارد البشرية', 'تعميم', 'ساري', 'عالي', '2026-02-05', 'يشمل تحديثات أجهزة البصمة ونقاط المرونة.', 'HQ001', 'HQ', '2026-02-05', '2026-02-18'),
          ('admin-circulars', 'لائحة تنظيم العمل عن بعد', 'إدارة الامتثال', 'لائحة', 'محدث', 'متوسط', '2026-02-12', 'تم تحديث النسب المعتمدة للدوام المرن.', 'HQ001', 'HQ', '2026-02-12', '2026-02-26'),
          ('admin-circulars', 'قرار إداري بتحديث سلم الصلاحيات', 'الإدارة العليا', 'قرار إداري', 'ساري', 'عالي', '2026-01-28', 'تطبيق فوري على جميع الإدارات.', 'HQ001', 'HQ', '2026-01-28', '2026-02-10'),
          ('admin-circulars', 'تعميم إجراءات السلامة المهنية', 'إدارة الأمن والسلامة', 'تعميم', 'ساري', 'متوسط', '2026-02-20', 'إلزام حضور جلسات التوعية الشهرية.', 'HQ001', 'HQ', '2026-02-20', '2026-02-25'),
          ('admin-circulars', 'لائحة السفر والانتداب', 'الإدارة المالية', 'لائحة', 'منتهي', 'منخفض', '2025-12-30', 'تم استبدالها بلائحة جديدة لعام 2026.', 'HQ001', 'HQ', '2025-12-30', '2026-01-15'),
          ('admin-circulars', 'قرار إداري بتنظيم الإجازات الخاصة', 'إدارة شؤون الموظفين', 'قرار إداري', 'محدث', 'متوسط', '2026-02-08', 'إضافة شرط الإشعار المسبق بـ 14 يوما.', 'HQ001', 'HQ', '2026-02-08', '2026-02-22')
        `
      );
    }

    const notificationsSeedCheck = await db.query(
      "SELECT COUNT(*)::int AS count FROM hr_module_records WHERE module_key = 'notifications-center' AND entity_id = 'HQ001'"
    );

    if (notificationsSeedCheck.rows[0]?.count === 0) {
      await db.query(
        `INSERT INTO hr_module_records
          (module_key, title, department, procedure_type, status, priority, issue_date, notes, entity_id, entity_type, created_at, updated_at)
         VALUES
          ('notifications-center', 'تذكير بإغلاق تقييم الأداء الشهري', 'إدارة الأداء', 'تذكير', 'مرسل', 'عالي', '2026-03-01', 'تم إرسال التنبيه لجميع المدراء المباشرين.', 'HQ001', 'HQ', '2026-03-01', '2026-03-01'),
          ('notifications-center', 'تنبيه عاجل لتحديث كلمات المرور', 'تقنية المعلومات', 'تنبيه عاجل', 'قيد الإرسال', 'عالي', '2026-03-02', 'يشمل جميع الحسابات الإدارية مع مهلة 24 ساعة.', 'HQ001', 'HQ', '2026-03-02', '2026-03-02'),
          ('notifications-center', 'إشعار نظامي بصيانة النظام الليلي', 'مركز العمليات', 'نظامي', 'مرسل', 'متوسط', '2026-02-28', 'سيتم إيقاف الخدمة من 02:00 إلى 03:00 صباحا.', 'HQ001', 'HQ', '2026-02-28', '2026-02-28'),
          ('notifications-center', 'تنبيه إداري بخصوص سياسة الحضور المرن', 'إدارة الموارد البشرية', 'إداري', 'مرسل', 'متوسط', '2026-02-27', 'تطبيق السياسة الجديدة بدءا من الأسبوع المقبل.', 'HQ001', 'HQ', '2026-02-27', '2026-02-27'),
          ('notifications-center', 'تذكير بموعد التدريب الإلزامي للأمن السيبراني', 'الأمن السيبراني', 'تذكير', 'مجدول', 'متوسط', '2026-03-05', 'البرنامج يستهدف الموظفين الجدد خلال الربع الأول.', 'HQ001', 'HQ', '2026-02-26', '2026-02-26'),
          ('notifications-center', 'تنبيه عاجل لتعطل نظام البصمة', 'إدارة المرافق', 'تنبيه عاجل', 'قيد الإرسال', 'عالي', '2026-03-02', 'الرجاء اعتماد بدائل الحضور اليدوي مؤقتا.', 'HQ001', 'HQ', '2026-03-02', '2026-03-02'),
          ('notifications-center', 'إشعار نظامي بتحديث بوابة الرواتب', 'الرواتب', 'نظامي', 'مجدول', 'منخفض', '2026-03-06', 'تحديثات على التقارير الشهرية وإضافة حقول جديدة.', 'HQ001', 'HQ', '2026-02-25', '2026-02-25'),
          ('notifications-center', 'تنبيه إداري بإغلاق طلبات الاجازات السنوية', 'شؤون الموظفين', 'إداري', 'مرسل', 'متوسط', '2026-03-01', 'تجميد الطلبات لمدة يومين لمراجعة التوازن.', 'HQ001', 'HQ', '2026-03-01', '2026-03-01')
        `
      );
    }

    const smartsheetSeedCheck = await db.query(
      "SELECT COUNT(*)::int AS count FROM hr_module_records WHERE module_key = 'smartsheet-bundle' AND entity_id = 'HQ001'"
    );

    if (smartsheetSeedCheck.rows[0]?.count === 0) {
      await db.query(
        `INSERT INTO hr_module_records
          (module_key, title, department, procedure_type, status, steps_count, owner, notes, entity_id, entity_type, created_at, updated_at)
         VALUES
          ('smartsheet-bundle', 'جدول بيانات الموظفين الأساسي', 'شؤون الموظفين', 'بيانات الموظفين', 'نشط', 1240, 'فريق بيانات الموارد البشرية', 'جدول موحد لملفات الموظفين والمتغيرات الأساسية.', 'HQ001', 'HQ', '2026-01-10', '2026-03-01'),
          ('smartsheet-bundle', 'سجل الحضور اليومي', 'الانضباط الوظيفي', 'الحضور والانصراف', 'متوقف', 38750, 'قسم الانضباط', 'جداول مجمعة للحضور مع تحديث مباشر من أجهزة البصمة.', 'HQ001', 'HQ', '2026-02-02', '2026-03-02'),
          ('smartsheet-bundle', 'مراجعة الرواتب الشهرية', 'الرواتب', 'الرواتب والمستحقات', 'نشط', 540, 'قسم الرواتب', 'متابعة التوافق بين الاستحقاقات والبدلات.', 'HQ001', 'HQ', '2026-01-22', '2026-02-28'),
          ('smartsheet-bundle', 'خطة التدريب الربع سنوية', 'التطوير المؤسسي', 'التدريب والتطوير', 'متوقف', 86, 'إدارة التدريب', 'تحديث مستمر لخطة البرامج الداخلية والخارجية.', 'HQ001', 'HQ', '2026-02-05', '2026-03-01'),
          ('smartsheet-bundle', 'سجل العهد والأصول', 'الخدمات الإدارية', 'الأصول والعهد', 'نشط', 312, 'إدارة الخدمات', 'مزامنة تلقائية مع نظام الأصول.', 'HQ001', 'HQ', '2026-01-18', '2026-02-26'),
          ('smartsheet-bundle', 'نتائج تقييم الأداء 2025', 'إدارة الأداء', 'التقييم والأداء', 'متوقف', 680, 'إدارة الأداء', 'أرشفة نتائج العام السابق بعد اعتماد الإدارة.', 'HQ001', 'HQ', '2025-12-20', '2026-01-15'),
          ('smartsheet-bundle', 'سجل الامتثال والسياسات', 'الامتثال', 'الامتثال والسياسات', 'نشط', 142, 'فريق الامتثال', 'متابعة بنود الامتثال وتواريخ المراجعة.', 'HQ001', 'HQ', '2026-01-12', '2026-02-24'),
          ('smartsheet-bundle', 'مراسلات الموارد البشرية الداخلية', 'التواصل الداخلي', 'المراسلات الداخلية', 'متوقف', 920, 'مكتب التواصل', 'توثيق الرسائل الداخلية مع تصنيف دوري.', 'HQ001', 'HQ', '2026-02-14', '2026-03-02')
        `
      );
    }

    const archiveSeedCheck = await db.query(
      "SELECT COUNT(*)::int AS count FROM hr_module_records WHERE module_key = 'e-archive' AND entity_id = 'HQ001'"
    );

    if (archiveSeedCheck.rows[0]?.count === 0) {
      await db.query(
        `INSERT INTO hr_module_records
          (module_key, title, doc_number, doc_type, department, archive_date, confidentiality, status, owner, notes, entity_id, entity_type, created_at, updated_at)
         VALUES
          ('e-archive', 'قرار تحديث سياسة العمل المرن', 'HR-ARCH-2026-001', 'سياسات ولوائح', 'إدارة الموارد البشرية', '2026-02-18', 'داخلي', 'نشط', 'نورة الحربي', 'نسخة معتمدة من السياسة المحدثة لعام 2026.', 'HQ001', 'HQ', '2026-02-18', '2026-02-20'),
          ('e-archive', 'محضر اجتماع لجنة الرواتب', 'HR-ARCH-2026-002', 'محاضر اجتماعات', 'قسم الرواتب', '2026-02-20', 'سري', 'نشط', 'أحمد الشمري', 'يتضمن توصيات المراجعة النهائية للبدلات.', 'HQ001', 'HQ', '2026-02-20', '2026-02-22'),
          ('e-archive', 'نموذج طلب إجازة سنوية', 'HR-ARCH-2026-003', 'نماذج وطلبات', 'شؤون الموظفين', '2026-02-10', 'عام', 'مؤرشف', 'سارة القحطاني', 'تم اعتماد النموذج الموحد للاستخدام الداخلي.', 'HQ001', 'HQ', '2026-02-10', '2026-02-15'),
          ('e-archive', 'تقرير تقييم الأداء للربع الأول', 'HR-ARCH-2026-004', 'تقارير وإحصاءات', 'إدارة الأداء', '2026-02-25', 'داخلي', 'نشط', 'فهد العنزي', 'تقرير شامل بنتائج KPI للفرق التشغيلية.', 'HQ001', 'HQ', '2026-02-25', '2026-02-27'),
          ('e-archive', 'عقد عمل موظف جديد', 'HR-ARCH-2026-005', 'عقود وقرارات', 'قسم التوظيف', '2026-02-14', 'سري', 'نشط', 'ليلى عبدالله', 'عقد موقع مع جميع الملاحق المطلوبة.', 'HQ001', 'HQ', '2026-02-14', '2026-02-18'),
          ('e-archive', 'سجل تحديثات بيانات الموظفين', 'HR-ARCH-2026-006', 'ملفات موظفين', 'شؤون الموظفين', '2026-02-28', 'داخلي', 'قيد المراجعة', 'علي الدوسري', 'قيد مراجعة فريق التدقيق الداخلي.', 'HQ001', 'HQ', '2026-02-28', '2026-03-01'),
          ('e-archive', 'خطاب إنهاء خدمة', 'HR-ARCH-2026-007', 'خطابات رسمية', 'إدارة الامتثال', '2026-02-05', 'سري للغاية', 'مؤرشف', 'منى الغامدي', 'محفوظ ضمن الملفات ذات السرية العالية.', 'HQ001', 'HQ', '2026-02-05', '2026-02-12'),
          ('e-archive', 'سجل مصروفات التدريب', 'HR-ARCH-2026-008', 'سجلات مالية', 'إدارة التدريب', '2026-02-22', 'داخلي', 'نشط', 'خالد الزهراني', 'مطابقة بيانات المصروفات مع أوامر الشراء.', 'HQ001', 'HQ', '2026-02-22', '2026-02-24')
        `
      );
    }
  } catch (error) {
    console.error('❌ Failed to ensure hr module records table:', error);
  }
};

ensureHrModuleRecordsTable();

const ensureStudioAdContentsTable = async () => {
  try {
    await db.query(`
      CREATE TABLE IF NOT EXISTS studio_ad_contents (
        id SERIAL PRIMARY KEY,
        campaign_id INTEGER,
        campaign_name VARCHAR(255),
        ad_title VARCHAR(500) NOT NULL,
        ad_text TEXT NOT NULL,
        caption TEXT DEFAULT '',
        hashtags TEXT DEFAULT '',
        platform VARCHAR(100) DEFAULT '',
        status VARCHAR(50) DEFAULT 'قيد المراجعة',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);
    console.log('✅ studio_ad_contents table ready');
  } catch (error) {
    console.error('❌ Failed to ensure studio_ad_contents table:', error);
  }
};
ensureStudioAdContentsTable();

const ensureStudioReelsTable = async () => {
  try {
    await db.query(`
      CREATE TABLE IF NOT EXISTS studio_reels (
        id SERIAL PRIMARY KEY,
        name VARCHAR(500) NOT NULL,
        title VARCHAR(500) DEFAULT '',
        description TEXT DEFAULT '',
        hashtags TEXT DEFAULT '',
        platform VARCHAR(100) DEFAULT '',
        source_type VARCHAR(50) DEFAULT 'uploaded',
        file_name VARCHAR(500) NOT NULL,
        original_file_name VARCHAR(500) DEFAULT '',
        file_path TEXT NOT NULL,
        file_type VARCHAR(20) DEFAULT 'WEBM',
        created_by VARCHAR(255) DEFAULT 'فريق الاستوديو',
        publish_status VARCHAR(50) DEFAULT 'مسودة',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        published_at TIMESTAMP
      );
    `);
    console.log('✅ studio_reels table ready');
  } catch (error) {
    console.error('❌ Failed to ensure studio_reels table:', error);
  }
};
ensureStudioReelsTable();

const ensureRecordsMasterRegisterTable = async () => {
  try {
    await db.query(`
      CREATE TABLE IF NOT EXISTS records_master_register (
        id SERIAL PRIMARY KEY,
        doc_number TEXT NOT NULL,
        doc_type TEXT NOT NULL,
        department TEXT NOT NULL,
        doc_date DATE NOT NULL,
        subject TEXT NOT NULL,
        status TEXT NOT NULL,
        confidentiality TEXT NOT NULL,
        url TEXT,
        direction TEXT NOT NULL,
        notes TEXT,
        source TEXT NOT NULL,
        password TEXT,
        entity_id TEXT,
        entity_type TEXT,
        created_at TIMESTAMP DEFAULT NOW(),
        updated_at TIMESTAMP DEFAULT NOW()
      );
      CREATE INDEX IF NOT EXISTS idx_master_register_entity ON records_master_register(entity_id);
      CREATE INDEX IF NOT EXISTS idx_master_register_date ON records_master_register(doc_date);
      CREATE INDEX IF NOT EXISTS idx_master_register_status ON records_master_register(status);
      CREATE INDEX IF NOT EXISTS idx_master_register_confidentiality ON records_master_register(confidentiality);
    `);

    const seedCheck = await db.query(
      "SELECT COUNT(*)::int AS count FROM records_master_register WHERE entity_id = 'HQ001'"
    );

    if (seedCheck.rows[0]?.count === 0) {
      await db.query(
        `INSERT INTO records_master_register
          (doc_number, doc_type, department, doc_date, subject, status, confidentiality, url, direction, notes, source, password, entity_id, entity_type)
         VALUES
          ('DOC-2026-0001', 'محضر اجتماع', 'الإدارة العليا', '2026-02-18', 'اعتماد خطة الأرشفة الرقمية', 'معتمد', 'سري', 'https://docs.naiosh.edu/records/DOC-2026-0001', 'صادر', 'نسخة معتمدة من الإدارة العليا', 'مكتب الإدارة العليا', 'SEC-2026-1101', 'HQ001', 'HQ'),
          ('DOC-2026-0002', 'تعميم مالي', 'الشؤون المالية', '2026-02-17', 'ضوابط المصروفات التشغيلية', 'ساري', 'داخلي', 'https://docs.naiosh.edu/records/DOC-2026-0002', 'صادر', 'يطبق على جميع الإدارات', 'الإدارة المالية', 'FIN-2026-2202', 'HQ001', 'HQ'),
          ('DOC-2026-0003', 'خطاب تحصيل', 'التحصيل المالي', '2026-02-16', 'تذكير بسداد رسوم الفصل الثاني', 'قيد المتابعة', 'داخلي', 'https://docs.naiosh.edu/records/DOC-2026-0003', 'صادر', 'مرتبط بخطة سداد 60 يوم', 'وحدة التحصيل', 'COL-2026-3303', 'HQ001', 'HQ'),
          ('DOC-2026-0004', 'طلب خدمة', 'المرافق والصيانة', '2026-02-15', 'صيانة شبكة التهوية بمبنى B', 'قيد التنفيذ', 'داخلي', 'https://docs.naiosh.edu/records/DOC-2026-0004', 'وارد', 'الأولوية: عالية', 'إدارة المرافق', 'OPS-2026-4404', 'HQ001', 'HQ'),
          ('DOC-2026-0005', 'قرار إداري', 'الإدارة الأكاديمية', '2026-02-14', 'تحديث سياسات التقييم النهائي', 'معتمد', 'عام', 'https://docs.naiosh.edu/records/DOC-2026-0005', 'صادر', 'يسري من 2026-03-01', 'مجلس البرامج', 'ACA-2026-5505', 'HQ001', 'HQ'),
          ('DOC-2026-0006', 'تقرير جودة', 'إدارة الجودة', '2026-02-13', 'نتائج تدقيق الجودة الربع سنوي', 'قيد المراجعة', 'سري', 'https://docs.naiosh.edu/records/DOC-2026-0006', 'صادر', 'يتطلب خطة تحسين', 'إدارة الجودة', 'QMS-2026-6606', 'HQ001', 'HQ'),
          ('DOC-2026-0007', 'ملف طالب', 'شؤون الطلاب', '2026-02-12', 'تحديث بيانات طالب - برنامج الإدارة', 'مكتمل', 'سري', 'https://docs.naiosh.edu/records/DOC-2026-0007', 'وارد', 'تم التحقق من الهوية', 'بوابة الطلاب', 'STD-2026-7707', 'HQ001', 'HQ'),
          ('DOC-2026-0008', 'إشعار مالي', 'الشؤون المالية', '2026-02-11', 'تسوية دفعة مورد خدمات تقنية', 'ساري', 'داخلي', 'https://docs.naiosh.edu/records/DOC-2026-0008', 'صادر', 'مرفق أمر شراء', 'الإدارة المالية', 'FIN-2026-8808', 'HQ001', 'HQ'),
          ('DOC-2026-0009', 'محضر لجنة', 'الإدارة العليا', '2026-02-10', 'اجتماع لجنة المخاطر المؤسسية', 'معتمد', 'سري للغاية', 'https://docs.naiosh.edu/records/DOC-2026-0009', 'صادر', 'مشاركة محدودة', 'لجنة المخاطر', 'SEC-2026-9909', 'HQ001', 'HQ'),
          ('DOC-2026-0010', 'طلب اعتماد', 'إدارة الجودة', '2026-02-09', 'اعتماد معيار برنامج التدريب المهني', 'قيد المراجعة', 'داخلي', 'https://docs.naiosh.edu/records/DOC-2026-0010', 'وارد', 'بانتظار المراجعة النهائية', 'وحدة الاعتماد', 'QMS-2026-1010', 'HQ001', 'HQ'),
          ('DOC-2026-0011', 'خطة صيانة', 'المرافق والصيانة', '2026-02-08', 'خطة صيانة المصاعد السنوية', 'ساري', 'داخلي', 'https://docs.naiosh.edu/records/DOC-2026-0011', 'صادر', 'تاريخ بداية التنفيذ 2026-03-10', 'إدارة الصيانة', 'OPS-2026-1111', 'HQ001', 'HQ'),
          ('DOC-2026-0012', 'جدول أكاديمي', 'الإدارة الأكاديمية', '2026-02-07', 'جدول المحاضرات للفصل الثاني', 'ساري', 'عام', 'https://docs.naiosh.edu/records/DOC-2026-0012', 'صادر', 'تحديث نهائي بعد المراجعة', 'وحدة الجداول', 'ACA-2026-1212', 'HQ001', 'HQ'),
          ('DOC-2026-0013', 'اتفاقية شراكة', 'الإدارة العليا', '2026-02-06', 'تجديد اتفاقية تعاون مع جهة خارجية', 'قيد المراجعة', 'داخلي', 'https://docs.naiosh.edu/records/DOC-2026-0013', 'صادر', 'بانتظار توقيع الطرف الثاني', 'إدارة الشراكات', 'PRT-2026-1313', 'HQ001', 'HQ'),
          ('DOC-2026-0014', 'محضر تسليم', 'المرافق والصيانة', '2026-02-05', 'استلام أجهزة التحكم بنظام السلامة', 'مكتمل', 'داخلي', 'https://docs.naiosh.edu/records/DOC-2026-0014', 'وارد', 'تم فحص الأجهزة عند الاستلام', 'إدارة المشتريات', 'OPS-2026-1414', 'HQ001', 'HQ'),
          ('DOC-2026-0015', 'تقرير متابعة', 'إدارة الجودة', '2026-02-04', 'متابعة تنفيذ خطة التحسين المؤسسي', 'قيد المتابعة', 'سري', 'https://docs.naiosh.edu/records/DOC-2026-0015', 'صادر', 'يتطلب تحديث أسبوعي للمؤشرات', 'مكتب الجودة', 'QMS-2026-1515', 'HQ001', 'HQ')
        `
      );
    }

    console.log('✅ records_master_register table ready');
  } catch (error) {
    console.error('❌ Failed to ensure records_master_register table:', error);
  }
};

ensureRecordsMasterRegisterTable();

const ensureRecordsStudentsAffairsTable = async () => {
  try {
    await db.query(`
      CREATE TABLE IF NOT EXISTS records_students_affairs (
        id SERIAL PRIMARY KEY,
        student_number TEXT NOT NULL,
        student_name TEXT NOT NULL,
        stage_department TEXT NOT NULL,
        document_type TEXT NOT NULL,
        status TEXT NOT NULL,
        registration_date DATE NOT NULL,
        notes TEXT,
        entity_id TEXT,
        entity_type TEXT,
        created_at TIMESTAMP DEFAULT NOW(),
        updated_at TIMESTAMP DEFAULT NOW()
      );
      CREATE INDEX IF NOT EXISTS idx_students_affairs_entity ON records_students_affairs(entity_id);
      CREATE INDEX IF NOT EXISTS idx_students_affairs_status ON records_students_affairs(status);
      CREATE INDEX IF NOT EXISTS idx_students_affairs_date ON records_students_affairs(registration_date);
      CREATE INDEX IF NOT EXISTS idx_students_affairs_student_number ON records_students_affairs(student_number);
    `);

    const seedCheck = await db.query(
      "SELECT COUNT(*)::int AS count FROM records_students_affairs WHERE entity_id = 'HQ001'"
    );

    if (seedCheck.rows[0]?.count === 0) {
      await db.query(
        `INSERT INTO records_students_affairs
          (student_number, student_name, stage_department, document_type, status, registration_date, notes, entity_id, entity_type)
         VALUES
          ('ST-2026-1001', 'ليان العتيبي', 'كلية الإدارة - المستوى الرابع', 'طلب تحويل تخصص', 'قيد المراجعة', '2026-02-18', 'بانتظار اعتماد لجنة البرامج.', 'HQ001', 'HQ'),
          ('ST-2026-1002', 'سارة الحربي', 'كلية العلوم - المستوى الثالث', 'طلب تأجيل فصل', 'معلقة', '2026-02-17', 'تم استكمال المستندات الطبية.', 'HQ001', 'HQ'),
          ('ST-2026-1003', 'عبدالله الشمري', 'كلية الهندسة - المستوى الخامس', 'إخلاء طرف', 'منتهية', '2026-02-16', 'تم تسليم نسخة للطالب.', 'HQ001', 'HQ'),
          ('ST-2026-1004', 'نورة الزهراني', 'كلية الإدارة - المستوى الثاني', 'خطاب إفادة', 'منتهية', '2026-02-15', 'الخطاب تم إرساله عبر البريد الجامعي.', 'HQ001', 'HQ'),
          ('ST-2026-1005', 'راشد المطيري', 'كلية الحاسب - المستوى السادس', 'طلب إعادة اختبار', 'معلقة', '2026-02-14', 'بانتظار سداد الرسوم.', 'HQ001', 'HQ'),
          ('ST-2026-1006', 'رهف القحطاني', 'كلية العلوم - المستوى الأول', 'طلب بطاقة جامعية', 'منتهية', '2026-02-13', 'تم إصدار البطاقة واستلامها.', 'HQ001', 'HQ'),
          ('ST-2026-1007', 'محمد الغامدي', 'كلية الإدارة - المستوى الثالث', 'طلب تظلم', 'قيد المراجعة', '2026-02-12', 'تم تحويل الطلب للمرشد الأكاديمي.', 'HQ001', 'HQ'),
          ('ST-2026-1008', 'هند السبيعي', 'كلية الهندسة - المستوى الرابع', 'طلب تدريب تعاوني', 'معلقة', '2026-02-11', 'بانتظار خطاب الجهة التدريبية.', 'HQ001', 'HQ'),
          ('ST-2026-1009', 'فهد الدوسري', 'كلية الحاسب - المستوى الثاني', 'طلب إفادة', 'منتهية', '2026-02-10', 'تم إرسال الإفادة للطالب.', 'HQ001', 'HQ'),
          ('ST-2026-1010', 'مها العتيبي', 'كلية العلوم - المستوى الخامس', 'طلب تعديل بيانات', 'قيد المراجعة', '2026-02-09', 'تم استلام الهوية الوطنية.', 'HQ001', 'HQ'),
          ('ST-2026-1011', 'أحمد السالم', 'كلية الإدارة - المستوى الأول', 'طلب تسجيل مقرر', 'معلقة', '2026-02-08', 'بانتظار موافقة شؤون الطلاب.', 'HQ001', 'HQ'),
          ('ST-2026-1012', 'جود الخالدي', 'كلية الحاسب - المستوى الثالث', 'طلب إفادة', 'منتهية', '2026-02-07', 'الإفادة جاهزة للاستلام.', 'HQ001', 'HQ'),
          ('ST-2026-1013', 'تركي الحربي', 'كلية الهندسة - المستوى السادس', 'طلب تخرج', 'قيد المراجعة', '2026-02-06', 'مراجعة متطلبات التخرج.', 'HQ001', 'HQ'),
          ('ST-2026-1014', 'سماح النجار', 'كلية العلوم - المستوى الرابع', 'طلب تأجيل فصل', 'منتهية', '2026-02-05', 'تم اعتماد التأجيل.', 'HQ001', 'HQ'),
          ('ST-2026-1015', 'نايف العنزي', 'كلية الإدارة - المستوى الخامس', 'طلب إفادة', 'منتهية', '2026-02-04', 'تمت الموافقة والإرسال.', 'HQ001', 'HQ'),
          ('ST-2026-1016', 'دلال الشريف', 'كلية الحاسب - المستوى الرابع', 'طلب إعادة جدولة اختبار', 'معلقة', '2026-02-03', 'بانتظار رد لجنة الاختبارات.', 'HQ001', 'HQ'),
          ('ST-2026-1017', 'خالد الوهيبي', 'كلية الهندسة - المستوى الثاني', 'طلب تحويل شعبة', 'منتهية', '2026-02-02', 'تم تنفيذ التحويل.', 'HQ001', 'HQ'),
          ('ST-2026-1018', 'لمى السليمان', 'كلية العلوم - المستوى السادس', 'طلب تظلم', 'قيد المراجعة', '2026-02-01', 'تم استلام المستندات الداعمة.', 'HQ001', 'HQ'),
          ('ST-2026-1019', 'سيف الرشيد', 'كلية الإدارة - المستوى الثالث', 'طلب إفادة', 'منتهية', '2026-01-31', 'تم تسليم الإفادة.', 'HQ001', 'HQ'),
          ('ST-2026-1020', 'منار العبدالله', 'كلية الحاسب - المستوى الأول', 'طلب بطاقة جامعية', 'منتهية', '2026-01-30', 'تم استلام البطاقة.', 'HQ001', 'HQ')
        `
      );
    }

    console.log('✅ records_students_affairs table ready');
  } catch (error) {
    console.error('❌ Failed to ensure records_students_affairs table:', error);
  }
};

ensureRecordsStudentsAffairsTable();

// Middleware
app.use(cors());
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));

app.use(async (req, res, next) => {
  if (!req.path.startsWith('/api/')) {
    return next();
  }

  try {
    await databaseReady;
    return next();
  } catch (error) {
    console.error('Database bootstrap failed:', error.message);
    return res.status(503).json({
      success: false,
      message: 'Database initialization failed',
      detail: error.message
    });
  }
});

// ---- Auth + API diagnostics (قبل tenantResolver — أولوية لـ /api/auth) ----
app.get('/api/auth/ping', async (req, res) => {
  try {
    const result = await db.query('SELECT NOW() AS now');
    res.setHeader('X-Auth-Api-Build', 'server-js-ping-v1');
    res.json({
      success: true,
      source: 'server.js',
      hasDatabaseUrl: Boolean(process.env.DATABASE_URL),
      database: 'connected',
      time: result.rows[0].now
    });
  } catch (error) {
    console.error('[server /api/auth/ping]', error.message);
    res.status(500).json({
      success: false,
      source: 'server.js',
      detail: error.message,
      code: error.code
    });
  }
});

app.get('/api/auth/debug', async (req, res) => {
  const report = {
    success: true,
    source: 'server.js',
    nodeVersion: process.version,
    hasDatabaseUrl: Boolean(process.env.DATABASE_URL),
    databaseSsl: process.env.DATABASE_SSL,
    steps: []
  };
  const addStep = (name, ok, detail) => report.steps.push({ name, ok, detail });

  try {
    const now = await db.query('SELECT NOW() AS now');
    addStep('pool_query', true, { time: now.rows[0].now });

    const tables = await db.query(`
      SELECT table_name
      FROM information_schema.tables
      WHERE table_schema = 'public'
        AND table_name IN ('users', 'user_credentials', 'user_sessions', 'sidebar_menu')
      ORDER BY table_name
    `);
    addStep('required_tables', tables.rows.length >= 3, { found: tables.rows.map((r) => r.table_name) });

    const counts = await db.query(`
      SELECT
        (SELECT COUNT(*)::int FROM users) AS users,
        (SELECT COUNT(*)::int FROM user_credentials) AS credentials,
        (SELECT COUNT(*)::int FROM user_sessions) AS sessions
    `);
    addStep('row_counts', true, counts.rows[0]);

    res.setHeader('X-Auth-Api-Build', 'server-js-debug-v1');
    res.json(report);
  } catch (error) {
    console.error('[server /api/auth/debug]', error.message, error.stack);
    addStep('fatal', false, { message: error.message, code: error.code });
    res.status(500).json({
      ...report,
      success: false,
      detail: error.message,
      code: error.code
    });
  }
});

// ---- Phase 2: Tenant Resolution Middleware ----
const { tenantResolver } = require('./tenant-resolver');
app.use(tenantResolver);

// Authentication API Routes
try {
  const authRoutes = require('./auth-api');
  app.use('/api/auth', authRoutes);
  console.log('✅ auth-api loaded');
} catch (authLoadError) {
  console.error('❌ فشل تحميل auth-api:', authLoadError);
  app.post('/api/auth/login', (req, res) => {
    res.status(500).json({
      success: false,
      message: 'auth-api.js فشل التحميل على السيرفر',
      detail: authLoadError.message
    });
  });
}

// Sidebar Menu API Routes
const menuRoutes = require('./sidebar-menu-api');
app.use('/api/menu', menuRoutes);

// Super Admin API Routes
const superAdminRoutes = require('./super-admin-api');
app.use('/api/admin', superAdminRoutes);

// Permissions API Routes
const permissionsRoutes = require('./api-permissions-routes');
app.use('/api/permissions', permissionsRoutes);

// No-Code Builder API Routes
const { router: nocodeRoutes, initNocodeBuilderTables } = require('./nocode-builder-api');
app.use('/api/nocode', nocodeRoutes);
initNocodeBuilderTables();

// ---- Phase 1: Multi-Tenant Onboarding & Management ----

// SaaS Self-Service Signup Routes
const saasSignupRoutes = require('./saas-signup-api');
app.use('/api/saas', saasSignupRoutes);

// Tenant Management Routes (Super Admin only)
const tenantManagementRoutes = require('./tenant-management-api');
app.use('/api/tenants', tenantManagementRoutes);

// ---- Phase 2: Tenant Authentication & User Management ----

// Tenant Auth Routes (login/verify/logout/register against tenant DB)
const tenantAuthRoutes = require('./tenant-auth-api');
app.use('/api/tenant-auth', tenantAuthRoutes);

// Tenant User Management Routes (CRUD in tenant DB, admin-only for create/update/delete)
const tenantUserRoutes = require('./tenant-user-api');
app.use('/api/tenant-users', tenantUserRoutes);

// ---- Phase 3: Tenant ERP Schema, Settings & Public Routes ----

// Tenant Settings Routes (payment/email/branding/SEO/AI/public-site/payment-transactions)
const tenantSettingsRoutes = require('./tenant-settings-api');
app.use('/api/tenant-settings', tenantSettingsRoutes);

// ---- Phase 4: Platform (Central/Apex) Settings Routes ----
// إعدادات المنصة المركزية — مقيدة بالنطاق الرئيسي + دور super_admin
const platformSettingsRoutes = require('./platform-settings-api');
app.use('/api/platform', platformSettingsRoutes);

// Tenant Public Routes (robots.txt, sitemap.xml, privacy, terms, public JSON endpoints)
const tenantPublicRoutes = require('./tenant-public-api');
app.use(tenantPublicRoutes);

const parseCookies = (cookieHeader = '') => {
  return cookieHeader.split(';').reduce((acc, part) => {
    const [key, ...rest] = part.trim().split('=');
    if (!key) return acc;
    acc[key] = decodeURIComponent(rest.join('=') || '');
    return acc;
  }, {});
};

const getAuthToken = (req) => {
  const authHeader = req.headers.authorization || '';
  if (authHeader.toLowerCase().startsWith('bearer ')) {
    return authHeader.slice(7).trim();
  }
  const cookies = parseCookies(req.headers.cookie || '');
  return cookies.authToken || '';
};

const isScopedBusinessRequest = (req) => {
  const requestPath = String(req.path || '');
  return requestPath.startsWith('/finance/')
    || requestPath === '/finance'
    || requestPath.startsWith('/api/hr/')
    || requestPath.startsWith('/api/tenant-users')
    || requestPath.startsWith('/api/tenant-settings');
};

const resolveCentralSessionEntityContext = async (token) => {
  if (!token) return null;

  const sessionResult = await db.query(
    `SELECT us.user_id, u.tenant_type, u.entity_id, u.office_id, u.role
     FROM user_sessions us
     JOIN users u ON us.user_id = u.id
     WHERE us.session_token = $1
       AND us.expires_at > NOW()
       AND COALESCE(u.is_active, true) = true
     LIMIT 1`,
    [token]
  );

  if (!sessionResult.rows.length) {
    return null;
  }

  const sessionUser = sessionResult.rows[0];
  return {
    userId: sessionUser.user_id,
    role: sessionUser.role,
    officeId: sessionUser.office_id || null,
    type: String(sessionUser.tenant_type || DEFAULT_ENTITY_CONTEXT.type).trim().toUpperCase(),
    id: String(sessionUser.entity_id || DEFAULT_ENTITY_CONTEXT.id).trim()
  };
};

const resolveTenantSessionEntityContext = async (req, token) => {
  if (!req.tenant || !req.tenantPool) {
    return null;
  }

  const tenantContext = {
    type: 'TENANT',
    id: buildCentralTenantEntityId(req.tenant.id),
    tenantId: req.tenant.id,
    tenantSubdomain: req.tenant.subdomain
  };

  if (!token) {
    return tenantContext;
  }

  const sessionResult = await req.tenantPool.query(
    `SELECT u.id, u.role
     FROM sessions s
     JOIN users u ON s.user_id = u.id
     WHERE s.session_token = $1
       AND s.expires_at > NOW()
       AND u.is_active = true
     LIMIT 1`,
    [token]
  );

  if (!sessionResult.rows.length) {
    return tenantContext;
  }

  return {
    ...tenantContext,
    userId: sessionResult.rows[0].id,
    role: sessionResult.rows[0].role
  };
};

const requestValueMatchesContext = (value, expectedValue) => {
  if (value === undefined || value === null || String(value).trim() === '') {
    return true;
  }
  return String(value).trim() === String(expectedValue).trim();
};

const applyResolvedEntityContext = (req, resolvedContext) => {
  const context = normalizeEntityContext(resolvedContext);
  const lockEntityScope = context.type !== 'HQ';
  const body = req.body && typeof req.body === 'object' ? req.body : null;
  const query = req.query && typeof req.query === 'object' ? req.query : null;

  if (lockEntityScope) {
    const incomingEntityId = body?.entity_id ?? query?.entity_id ?? req.headers['x-entity-id'];
    const incomingEntityType = body?.entity_type ?? query?.entity_type ?? req.headers['x-entity-type'];
    if (!requestValueMatchesContext(incomingEntityId, context.id) || !requestValueMatchesContext(incomingEntityType, context.type)) {
      return false;
    }
  }

  req.userEntity = context;
  req.authenticatedEntityContext = context;
  req.headers['x-entity-id'] = context.id;
  req.headers['x-entity-type'] = context.type;

  if (lockEntityScope || (query && Object.prototype.hasOwnProperty.call(query, 'entity_id'))) {
    if (query) {
      query.entity_id = context.id;
      query.entity_type = context.type;
    }
  }

  if (lockEntityScope || (body && (Object.prototype.hasOwnProperty.call(body, 'entity_id') || Object.prototype.hasOwnProperty.call(body, 'entity_type')))) {
    if (body) {
      body.entity_id = context.id;
      body.entity_type = context.type;
    }
  }

  return true;
};

app.use(async (req, res, next) => {
  try {
    const token = getAuthToken(req);
    const resolvedContext = req.tenant && req.tenantPool
      ? await resolveTenantSessionEntityContext(req, token)
      : await resolveCentralSessionEntityContext(token);

    if (req.tenant && isScopedBusinessRequest(req) && !token) {
      return res.status(401).json({ error: 'يجب تسجيل الدخول أولاً.' });
    }

    if (resolvedContext) {
      if (!applyResolvedEntityContext(req, resolvedContext)) {
        return res.status(403).json({ error: 'لا يمكن الوصول إلى بيانات كيان آخر.' });
      }
      return next();
    }

    if (req.tenant && req.tenantPool) {
      const tenantContext = {
        type: 'TENANT',
        id: buildCentralTenantEntityId(req.tenant.id)
      };
      if (!applyResolvedEntityContext(req, tenantContext)) {
        return res.status(403).json({ error: 'لا يمكن الوصول إلى بيانات كيان آخر.' });
      }
      return next();
    }

    req.userEntity = normalizeEntityContext({
      type: req.headers['x-entity-type'] || DEFAULT_ENTITY_CONTEXT.type,
      id: req.headers['x-entity-id'] || DEFAULT_ENTITY_CONTEXT.id
    });
    return next();
  } catch (error) {
    console.error('❌ Failed to resolve request entity context:', error);
    return res.status(500).json({ error: 'تعذّر تحديد نطاق البيانات الحالي.' });
  }
});

const protectedHtmlExactPaths = new Set([
  '/dashboard.html',
  '/home',
  '/archive',
  '/hierarchy',
  '/saas',
  '/billing',
  '/finance',
  '/events-studio-main.html',
  '/requests',
  '/incubator',
  '/tenants',
  '/register-tenant',
  '/ads',
  '/tasks',
  '/facilities',
  '/audit-logs',
  '/settings',
  '/hr',
  '/operational-policies'
]);

/**
 * Map a request path to one or more permission page keys.
 * Returns null when no restriction applies (unknown/public paths).
 * Returns an array of keys that grant access (any match is sufficient).
 */
const getPageKeysForPath = (requestPath) => {
  const p = (requestPath || '').split('?')[0].replace(/\/+$/, '') || '/';
  if (p === '/dashboard.html' || p === '/home') return ['dashboard'];
  if (p === '/archive' || p.startsWith('/archive/')) return ['records-archive-home'];
  if (p === '/hr' || p.startsWith('/hr/')) return ['hr'];
  if (p === '/finance/events-studio-main' || p === '/finance/events-studio-main.html' || p.startsWith('/finance/events-studio-main/')) return ['events-studio-main', 'finance'];
  if (p === '/events-studio-main.html') return ['events-studio-main', 'finance'];
  if (p === '/finance' || p.startsWith('/finance/')) return ['finance'];
  if (p === '/strategic' || p.startsWith('/strategic/')) return ['strategic-management'];
  if (p === '/saas' || p.startsWith('/saas/')) return ['saas'];
  if (p === '/billing' || p.startsWith('/billing/')) return ['saas'];
  if (p === '/hierarchy' || p.startsWith('/hierarchy/')) return ['hierarchy'];
  if (p === '/incubator' || p.startsWith('/incubator/')) return ['incubator'];
  if (p === '/requests' || p.startsWith('/requests/')) return ['requests'];
  if (p === '/tasks' || p.startsWith('/tasks/')) return ['tasks-management'];
  if (p === '/facilities' || p.startsWith('/facilities/')) return ['facilities'];
  if (p === '/audit-logs' || p.startsWith('/audit-logs/')) return ['audit-logs'];
  if (p === '/settings' || p.startsWith('/settings/')) return ['settings'];
  if (p === '/ads' || p.startsWith('/ads/')) return ['ads'];
  if (p === '/operational-policies' || p.startsWith('/operational-policies/')) return ['operational-policies'];
  if (p === '/tenants' || p.startsWith('/tenants/') || p === '/register-tenant') return ['entities'];
  return null;
};

const protectedHtmlPathPrefixes = [
  '/archive/',
  '/finance/',
  '/hr/',
  '/strategic/',
  '/tasks/',
  '/facilities/',
  '/settings/',
  '/operational-policies/'
];

const isProtectedHtmlPath = (requestPath = '') => {
  const rawPath = (requestPath || '').split('?')[0];
  if (!rawPath) return false;
  const normalizedPath = rawPath === '/' ? '/' : rawPath.replace(/\/+$/, '');
  if (protectedHtmlExactPaths.has(normalizedPath)) {
    return true;
  }
  return protectedHtmlPathPrefixes.some(prefix => normalizedPath.startsWith(prefix));
};

const shouldGuardHtml = (req) => {
  if (req.path.startsWith('/api/') || req.path.startsWith('/public/') || req.path.startsWith('/uploads/')) {
    return false;
  }
  const fileExtension = path.extname(req.path || '');
  if (fileExtension && fileExtension !== '.html') {
    return false;
  }
  const acceptHeader = (req.headers.accept || '').toLowerCase();
  if (!acceptHeader.includes('text/html')) return false;
  return isProtectedHtmlPath(req.path);
};

const requireAuthForHtml = async (_req, _res, next) => {
  // Temporary bypass for deployment: do not guard HTML pages.
  return next();
};

app.use(requireAuthForHtml);

app.get(['/login-page.html', '/register.html'], (_req, res) => {
  return res.redirect('/dashboard.html');
});

// Serve static files (must come AFTER API routes to avoid conflicts)
app.get('/finance*', (req, res, next) => {
  try {
    const acceptHeader = (req.headers.accept || '').toLowerCase();
    const wantsJson = acceptHeader.includes('application/json');
    const isApiQuery = req.query && (req.query.entity_id || req.query.fiscal_year || req.query.payment_id || req.query.budget_id);
    if (req.method !== 'GET' || wantsJson || isApiQuery) {
      return next();
    }

    const hasFileExtension = path.extname(req.path || '') !== '';
    if (!hasFileExtension && !req.path.endsWith('/') && req.path !== '/finance' && req.path !== '/finance/') {
      return next();
    }
    if (hasFileExtension && !req.path.endsWith('.html')) {
      return next();
    }

    let requestPath = null;
    if (req.path === '/finance' || req.path === '/finance/') {
      requestPath = '/finance/index.html';
    } else if (req.path.endsWith('/')) {
      requestPath = `${req.path}index.html`;
    } else if (req.path.endsWith('.html')) {
      requestPath = req.path;
    } else {
      const indexPath = path.join(__dirname, req.path, 'index.html');
      if (fs.existsSync(indexPath)) {
        requestPath = `${req.path}/index.html`;
      }
    }

    if (!requestPath) {
      return next();
    }

    const safePath = decodeURIComponent(requestPath).replace(/\.{2,}/g, '');
    const filePath = path.join(__dirname, safePath);

    if (!filePath.startsWith(path.join(__dirname, 'finance')) || !fs.existsSync(filePath)) {
      return next();
    }

    let html = fs.readFileSync(filePath, 'utf8');
    html = html
      .replace(/const ENTITY_ID = '1';/g, "const ENTITY_ID = window.getFinanceEntityId ? window.getFinanceEntityId() : 'HQ001';")
      .replace(/const ENTITY_ID = 'HQ001';/g, "const ENTITY_ID = window.getFinanceEntityId ? window.getFinanceEntityId() : 'HQ001';")
      .replace(/const CASHFLOW_ENTITY_ID = '1';/g, "const CASHFLOW_ENTITY_ID = window.getFinanceEntityId ? window.getFinanceEntityId() : 'HQ001';")
      .replace(/const AR_ENTITY_ID = 'HQ001';/g, "const AR_ENTITY_ID = window.getFinanceEntityId ? window.getFinanceEntityId() : 'HQ001';");
    const hasTheme = html.includes('/finance/brand-theme.css');
    const injection = hasTheme
      ? '    <script src="/finance/finance-context.js"></script>\n    <script src="/finance/finance-help.js?v=20260215"></script>\n'
      : '    <link rel="stylesheet" href="/finance/brand-theme.css?v=20260215">\n    <script src="/finance/brand-theme.js"></script>\n    <script src="/finance/finance-context.js"></script>\n    <script src="/finance/finance-help.js?v=20260215"></script>\n';
    const injected = html.replace('</head>', `${injection}</head>`);
    res.type('html').send(injectFormValidationAssets(injected));
  } catch (error) {
    next();
  }
});


// Serve Events Studio on its finance path
app.get('/finance/events-studio-main.html', (req, res, next) => serveEventsStudio(req, res, next));

// Finance System API Routes
const financeRoutes = require('./finance/api/finance-routes');
app.use('/finance', financeRoutes);

// Finance Quick Offers API Routes
const quickOffersRoutes = require('./finance/api/quick-offers');
app.use('/finance/quick-offers', quickOffersRoutes);

// Finance Return Requests API Routes
const returnRequestsRoutes = require('./finance/api/return-requests');
app.use('/finance/return-requests', returnRequestsRoutes);

// Finance Related Details API Routes
const relatedDetailsRoutes = require('./finance/api/related-details');
app.use('/finance/related-details', relatedDetailsRoutes);

// Finance Shipping Fees API Routes
const shippingFeesRoutes = require('./finance/api/shipping-fees');
app.use('/finance/shipping-fees', shippingFeesRoutes);

// Finance Exchange Requests API Routes
const exchangeRequestsRoutes = require('./finance/api/exchange-requests');
app.use('/finance/exchange-requests', exchangeRequestsRoutes);

// Finance Amount Adjustments API Routes (Value Increase Adjustment page)
const amountAdjustmentsRoutes = require('./finance/api/amount-adjustments');
app.use('/finance/amount-adjustments', amountAdjustmentsRoutes);

// Finance Payment System API Routes
const paymentSystemRoutes = require('./finance/api/payment-system');
app.use('/finance/payment-system', paymentSystemRoutes);

// Finance Cashflow API Routes (Page 1: Operating, Investing, Financing + AI Forecasting)
const cashflowRoutes = require('./finance/api/cashflow-routes');
app.use('/finance/cashflow', cashflowRoutes);

// Finance Journal API Routes (Page 2: Journal Entries & General Ledger)
const journalAPI = require('./finance/api/journal');
app.get('/finance/journal/test', journalAPI.testConnection);
app.get('/finance/journal/entries/:entry_id', journalAPI.getJournalEntry);
app.get('/finance/journal/entries', journalAPI.getJournalEntries);
app.post('/finance/journal/entries', journalAPI.createJournalEntry);
app.put('/finance/journal/entries/:entry_id', journalAPI.updateJournalEntry);
app.delete('/finance/journal/entries/:entry_id', journalAPI.deleteJournalEntry);
app.get('/finance/journal/balances', journalAPI.getAccountBalances);
app.get('/finance/journal/ledger/:account_id', journalAPI.getAccountLedger);

// Finance Balance Sheet API Routes (Page 3: Balance Sheet - Assets, Liabilities, Equity)
const balanceSheetAPI = require('./finance/api/balance-sheet');
app.get('/finance/balance-sheet/test', balanceSheetAPI.testConnection);
app.get('/finance/balance-sheet', balanceSheetAPI.getBalanceSheet);
app.get('/finance/balance-sheet/assets', balanceSheetAPI.getAssets);
app.post('/finance/balance-sheet/assets', balanceSheetAPI.createAsset);
app.put('/finance/balance-sheet/assets/:asset_id', balanceSheetAPI.updateAsset);
app.delete('/finance/balance-sheet/assets/:asset_id', balanceSheetAPI.deleteAsset);
app.get('/finance/balance-sheet/liabilities', balanceSheetAPI.getLiabilities);
app.post('/finance/balance-sheet/liabilities', balanceSheetAPI.createLiability);
app.put('/finance/balance-sheet/liabilities/:liability_id', balanceSheetAPI.updateLiability);
app.delete('/finance/balance-sheet/liabilities/:liability_id', balanceSheetAPI.deleteLiability);
app.get('/finance/balance-sheet/equity', balanceSheetAPI.getEquity);
app.post('/finance/balance-sheet/equity', balanceSheetAPI.createEquity);
app.put('/finance/balance-sheet/equity/:equity_id', balanceSheetAPI.updateEquity);
app.delete('/finance/balance-sheet/equity/:equity_id', balanceSheetAPI.deleteEquity);
app.get('/finance/balance-sheet/complete', balanceSheetAPI.getCompleteBalanceSheet);

// Finance Income Statement API Routes (Page 4: Income Statement - Revenue & Expenses)
const incomeStatementAPI = require('./finance/api/income-statement');
app.get('/finance/income-statement/test', incomeStatementAPI.testConnection);
app.get('/finance/income-statement', incomeStatementAPI.getIncomeStatement);
app.post('/finance/income-statement/items', incomeStatementAPI.createIncomeItem);
app.put('/finance/income-statement/items/:item_id', incomeStatementAPI.updateIncomeItem);
app.delete('/finance/income-statement/items/:item_id', incomeStatementAPI.deleteIncomeItem);

// Finance Chart of Accounts API Routes (Page 5: Chart of Accounts)
const chartOfAccountsAPI = require('./finance/api/chart-of-accounts');
app.get('/finance/chart-of-accounts/test', chartOfAccountsAPI.testConnection);
app.get('/finance/chart-of-accounts', chartOfAccountsAPI.getChartOfAccounts);
app.get('/finance/chart-of-accounts/:account_id', chartOfAccountsAPI.getAccount);
app.post('/finance/chart-of-accounts', chartOfAccountsAPI.createAccount);
app.put('/finance/chart-of-accounts/:account_id', chartOfAccountsAPI.updateAccount);
app.delete('/finance/chart-of-accounts/:account_id', chartOfAccountsAPI.deleteAccount);

// Finance Payments API Routes (Page 6: Payments)
const paymentsAPI = require('./finance/api/payments');
app.get('/finance/payments/test', paymentsAPI.testConnection);
app.get('/finance/payments', paymentsAPI.getPayments);
app.post('/finance/payments', paymentsAPI.createPayment);
app.put('/finance/payments/:payment_id', paymentsAPI.updatePayment);
app.delete('/finance/payments/:payment_id', paymentsAPI.deletePayment);

// Payroll API Routes
const payrollRoutes = require('./finance/api/payroll-routes');
app.use('/finance/payroll', payrollRoutes);

// Finance Customers API Routes (Page 7: Customers)
const customersAPI = require('./finance/api/customers');
app.get('/finance/customers/test', customersAPI.testConnection);
app.get('/finance/customers', customersAPI.getCustomers);
app.post('/finance/customers', customersAPI.createCustomer);
app.put('/finance/customers/:customer_id', customersAPI.updateCustomer);
app.delete('/finance/customers/:customer_id', customersAPI.deleteCustomer);

// Finance AI Forecasts API Routes (Page 8: AI Forecasts)
const aiForecastsAPI = require('./finance/api/ai-forecasts');
app.get('/finance/ai-forecasts/test', aiForecastsAPI.testConnection);
app.get('/finance/ai-forecasts', aiForecastsAPI.getForecasts);
app.post('/finance/ai-forecasts', aiForecastsAPI.createForecast);
app.put('/finance/ai-forecasts/:forecast_id', aiForecastsAPI.updateForecast);
app.delete('/finance/ai-forecasts/:forecast_id', aiForecastsAPI.deleteForecast);

// Finance Cashflow Summary API Routes (Page 9: Cashflow Summary)
const cashflowSummaryAPI = require('./finance/api/cashflow-summary');
app.get('/finance/cashflow-summary/test', cashflowSummaryAPI.testConnection);
app.get('/finance/cashflow-summary', cashflowSummaryAPI.getCashflowSummary);
app.post('/finance/cashflow-summary', cashflowSummaryAPI.createCashflowSummary);
app.put('/finance/cashflow-summary', cashflowSummaryAPI.updateCashflowSummary);
app.delete('/finance/cashflow-summary', cashflowSummaryAPI.deleteCashflowSummary);

// Finance Journal Lines API Routes (Page 10: Journal Lines)
const journalLinesAPI = require('./finance/api/journal-lines');
app.get('/finance/journal-lines/test', journalLinesAPI.testConnection);
app.get('/finance/journal-lines', journalLinesAPI.getJournalLines);
app.post('/finance/journal-lines', journalLinesAPI.createJournalLine);
app.put('/finance/journal-lines/:line_id', journalLinesAPI.updateJournalLine);
app.delete('/finance/journal-lines/:line_id', journalLinesAPI.deleteJournalLine);

// Finance Cashflow Transactions API Routes (Page 11: Cashflow Transactions)
const cashflowTransactionsAPI = require('./finance/api/cashflow-transactions');
app.get('/finance/cashflow-transactions/test', cashflowTransactionsAPI.testConnection);
app.get('/finance/cashflow-transactions', cashflowTransactionsAPI.getCashflowTransactions);
app.post('/finance/cashflow-transactions', cashflowTransactionsAPI.createCashflowTransaction);
app.put('/finance/cashflow-transactions/:cashflow_id', cashflowTransactionsAPI.updateCashflowTransaction);
app.delete('/finance/cashflow-transactions/:cashflow_id', cashflowTransactionsAPI.deleteCashflowTransaction);

// Finance Cashflow Comprehensive API Routes (Page 12: Comprehensive Cashflow Report)
const cashflowComprehensiveAPI = require('./finance/api/cashflow-comprehensive');
app.get('/finance/cashflow-comprehensive/test', cashflowComprehensiveAPI.testConnection);
app.get('/finance/cashflow-comprehensive', cashflowComprehensiveAPI.getCashflowComprehensive);

// Finance AI Risk Scores API Routes (Page 13: AI Risk Scores)
const aiRiskScoresAPI = require('./finance/api/ai-risk-scores');
app.get('/finance/ai-risk-scores/test', aiRiskScoresAPI.testConnection);
app.get('/finance/ai-risk-scores', aiRiskScoresAPI.getRiskScores);
app.post('/finance/ai-risk-scores', aiRiskScoresAPI.createRiskScore);
app.put('/finance/ai-risk-scores/:risk_id', aiRiskScoresAPI.updateRiskScore);
app.delete('/finance/ai-risk-scores/:risk_id', aiRiskScoresAPI.deleteRiskScore);

// Finance Fixed Assets API Routes (Page 14: Fixed Assets & Depreciation)
const fixedAssetsAPI = require('./finance/api/fixed-assets');
app.get('/finance/fixed-assets/test', fixedAssetsAPI.testConnection);
app.get('/finance/fixed-assets', fixedAssetsAPI.getFixedAssets);
app.post('/finance/fixed-assets', fixedAssetsAPI.createFixedAsset);
app.put('/finance/fixed-assets/:asset_id', fixedAssetsAPI.updateFixedAsset);
app.delete('/finance/fixed-assets/:asset_id', fixedAssetsAPI.deleteFixedAsset);
app.post('/finance/fixed-assets/depreciation', fixedAssetsAPI.createDepreciation);
app.put('/finance/fixed-assets/depreciation/:depreciation_id', fixedAssetsAPI.updateDepreciation);
app.delete('/finance/fixed-assets/depreciation/:depreciation_id', fixedAssetsAPI.deleteDepreciation);

// Finance Budgets API Routes (Page 15: Budgets & Variances)
const budgetsAPI = require('./finance/api/budgets');
app.get('/finance/budgets/test', budgetsAPI.testConnection);
app.get('/finance/budgets', budgetsAPI.getBudgets);
app.post('/finance/budgets', budgetsAPI.createBudget);
app.put('/finance/budgets/:budget_id', budgetsAPI.updateBudget);
app.delete('/finance/budgets/:budget_id', budgetsAPI.deleteBudget);
app.post('/finance/budget-lines', budgetsAPI.createBudgetLine);
app.put('/finance/budget-lines/:line_id', budgetsAPI.updateBudgetLine);
app.delete('/finance/budget-lines/:line_id', budgetsAPI.deleteBudgetLine);
app.post('/finance/budget-variances', budgetsAPI.createVariance);
app.put('/finance/budget-variances/:variance_id', budgetsAPI.updateVariance);
app.delete('/finance/budget-variances/:variance_id', budgetsAPI.deleteVariance);

// Finance Payment Plans API Routes (Page 16: Payment Plans & Allocations)
const paymentPlansAPI = require('./finance/api/payment-plans');
app.get('/finance/payment-plans/test', paymentPlansAPI.testConnection);
app.get('/finance/payment-plans', paymentPlansAPI.getPaymentPlans);
app.post('/finance/payment-plans', paymentPlansAPI.createPaymentPlan);
app.put('/finance/payment-plans/:plan_id', paymentPlansAPI.updatePaymentPlan);
app.delete('/finance/payment-plans/:plan_id', paymentPlansAPI.deletePaymentPlan);
app.delete('/finance/payment-allocations/:allocation_id', paymentPlansAPI.deletePaymentAllocation);
app.post('/finance/payment-allocations', paymentPlansAPI.createPaymentAllocation);
app.put('/finance/payment-allocations/:allocation_id', paymentPlansAPI.updatePaymentAllocation);
app.delete('/finance/payment-allocations/:allocation_id', paymentPlansAPI.deletePaymentAllocation);

// Finance Expenses API Routes (Page 17: Expenses & Vendors)
const expensesAPI = require('./finance/api/expenses');
app.get('/finance/expenses/test', expensesAPI.testConnection);
app.get('/finance/expenses', expensesAPI.getExpenses);
app.post('/finance/expenses', expensesAPI.createExpense);
app.put('/finance/expenses/:id', expensesAPI.updateExpense);
app.delete('/finance/expenses/:id', expensesAPI.deleteExpense);
app.post('/finance/vendors', expensesAPI.createVendor);
app.put('/finance/vendors/:id', expensesAPI.updateVendor);
app.delete('/finance/vendors/:id', expensesAPI.deleteVendor);

// Finance AR Aging API Routes (Page 18: Accounts Receivable Aging)
const arAgingAPI = require('./finance/api/ar-aging');
app.get('/finance/ar-aging/test', arAgingAPI.testConnection);
app.get('/finance/ar-aging', arAgingAPI.getARAging);
app.post('/finance/ar-aging/invoices', arAgingAPI.createARAgingInvoice);
app.put('/finance/ar-aging/invoices/:id', arAgingAPI.updateARAgingInvoice);
app.delete('/finance/ar-aging/invoices/:id', arAgingAPI.deleteARAgingInvoice);

// Finance Plan Installments API Routes (Page 19: Plan Installments)
const planInstallmentsAPI = require('./finance/api/plan-installments');
app.get('/finance/plan-installments/test', planInstallmentsAPI.testConnection);
app.get('/finance/plan-installments', planInstallmentsAPI.getPlanInstallments);
app.post('/finance/plan-installments', planInstallmentsAPI.createPlanInstallment);
app.put('/finance/plan-installments/:id', planInstallmentsAPI.updatePlanInstallment);
app.delete('/finance/plan-installments/:id', planInstallmentsAPI.deletePlanInstallment);

// Finance Account Balances API Routes (Page 20: Account Balances)
const accountBalancesAPI = require('./finance/api/account-balances');
app.get('/finance/account-balances/test', accountBalancesAPI.testConnection);
app.get('/finance/account-balances', accountBalancesAPI.getAccountBalances);

// ========================================
// DATA ISOLATION MIDDLEWARE
// ========================================

// Middleware to extract and validate user entity
app.use((req, res, next) => {
  try {
    if (!req.userEntity) {
      req.userEntity = normalizeEntityContext({
        type: req.headers['x-entity-type'] || DEFAULT_ENTITY_CONTEXT.type,
        id: req.headers['x-entity-id'] || DEFAULT_ENTITY_CONTEXT.id
      });
    }
    next();
  } catch (error) {
    res.status(400).json({ error: 'Invalid entity context' });
  }
});

const SUPPORTED_ENTITY_CONTEXT_TYPES = new Set(['HQ', 'BRANCH', 'INCUBATOR', 'PLATFORM', 'OFFICE']);

const isHqEntityContext = (req) => getRequestEntityContext(req).type === 'HQ';

const isDedicatedTenantEntityContext = (req) => !SUPPORTED_ENTITY_CONTEXT_TYPES.has(getRequestEntityContext(req).type);

const isCurrentEntityScope = (req, entityId) => {
  if (isHqEntityContext(req)) return true;
  return String(entityId || '').trim() === getRequestEntityContext(req).id;
};

const resolveOperationalEntityRecordId = async (entityType, entityId) => {
  const normalizedType = String(entityType || '').trim().toUpperCase();
  const normalizedEntityId = String(entityId || '').trim();
  if (!normalizedEntityId) {
    return null;
  }

  const tableMap = {
    HQ: 'headquarters',
    BRANCH: 'branches',
    INCUBATOR: 'incubators',
    PLATFORM: 'platforms',
    OFFICE: 'offices'
  };

  const tableName = tableMap[normalizedType];
  if (!tableName) {
    return null;
  }

  const result = await db.query(
    `SELECT id
     FROM ${tableName}
     WHERE entity_id = $1 OR id::text = $1
     LIMIT 1`,
    [normalizedEntityId]
  );

  return result.rows[0]?.id || null;
};

const isTenantHostRequest = (req) => Boolean(req.tenant && req.tenantPool);

const getTenantHostEntityId = (req) => {
  if (!req?.tenant?.id) return null;
  return buildCentralTenantEntityId(req.tenant.id);
};

const mapTenantEmploymentTypeToUi = (value) => {
  const normalized = String(value || '').trim().toLowerCase();
  if (normalized === 'part_time') return 'PART_TIME';
  if (normalized === 'contract') return 'CONTRACT';
  if (normalized === 'intern') return 'INTERN';
  return 'FULL_TIME';
};

const mapUiEmploymentTypeToTenant = (value) => {
  const normalized = String(value || '').trim().toUpperCase();
  if (normalized === 'PART_TIME') return 'part_time';
  if (normalized === 'CONTRACT') return 'contract';
  if (normalized === 'INTERN') return 'intern';
  return 'full_time';
};

const splitFullName = (fullName) => {
  const normalized = String(fullName || '').trim().replace(/\s+/g, ' ');
  if (!normalized) {
    return { firstName: '', lastName: '' };
  }

  const parts = normalized.split(' ');
  if (parts.length === 1) {
    return { firstName: parts[0], lastName: '' };
  }

  return {
    firstName: parts.shift(),
    lastName: parts.join(' ')
  };
};

const ensureTenantEmployeeRequestsTable = async (tenantPool) => {
  await tenantPool.query(`
    CREATE TABLE IF NOT EXISTS employee_requests (
      id VARCHAR(50) PRIMARY KEY,
      entity_id VARCHAR(120),
      employee_id VARCHAR(50),
      employee_name VARCHAR(255) NOT NULL,
      request_type VARCHAR(100) NOT NULL,
      request_title VARCHAR(255) NOT NULL,
      description TEXT,
      status VARCHAR(20) DEFAULT 'PENDING'
        CHECK (status IN ('PENDING', 'APPROVED', 'REJECTED', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED')),
      priority VARCHAR(20) DEFAULT 'NORMAL'
        CHECK (priority IN ('LOW', 'NORMAL', 'HIGH', 'URGENT')),
      request_data JSONB,
      requires_approval BOOLEAN DEFAULT TRUE,
      approver_id VARCHAR(50),
      approver_name VARCHAR(255),
      approval_date TIMESTAMP,
      approval_notes TEXT,
      requested_date DATE NOT NULL,
      start_date DATE,
      end_date DATE,
      completion_date DATE,
      attachments TEXT[],
      notes TEXT,
      created_by VARCHAR(50),
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      CONSTRAINT tenant_employee_requests_dates_chk
        CHECK (end_date IS NULL OR start_date IS NULL OR end_date >= start_date)
    )
  `);

  await tenantPool.query(`
    CREATE INDEX IF NOT EXISTS idx_tenant_employee_requests_status
      ON employee_requests(status)
  `);
  await tenantPool.query(`
    CREATE INDEX IF NOT EXISTS idx_tenant_employee_requests_type
      ON employee_requests(request_type)
  `);
  await tenantPool.query(`
    CREATE INDEX IF NOT EXISTS idx_tenant_employee_requests_date
      ON employee_requests(requested_date)
  `);
};

const extractAuthTokenFromRequest = (req) => {
  const authHeader = req.headers.authorization || '';
  if (authHeader.toLowerCase().startsWith('bearer ')) {
    return authHeader.slice(7).trim();
  }

  const cookies = (req.headers.cookie || '').split(';').reduce((acc, part) => {
    const [key, ...values] = part.trim().split('=');
    if (key) acc[key.trim()] = decodeURIComponent(values.join('=') || '');
    return acc;
  }, {});

  return cookies.authToken || '';
};

const requireTenantSessionUser = async (req, res) => {
  if (!isTenantHostRequest(req)) {
    return null;
  }

  if (req.tenantSessionUser) {
    return req.tenantSessionUser;
  }

  const token = extractAuthTokenFromRequest(req);
  if (!token) {
    res.status(401).json({ error: 'يجب تسجيل الدخول أولاً.' });
    return null;
  }

  const sessionResult = await req.tenantPool.query(
    `SELECT u.id, u.role, u.is_active
     FROM sessions s
     JOIN users u ON s.user_id = u.id
     WHERE s.session_token = $1
       AND s.expires_at > NOW()
       AND u.is_active = true
     LIMIT 1`,
    [token]
  );

  if (!sessionResult.rows.length) {
    res.status(401).json({ error: 'جلسة المستأجر غير صالحة.' });
    return null;
  }

  req.tenantSessionUser = sessionResult.rows[0];
  return req.tenantSessionUser;
};

// HR Human Risk API Routes
const humanRiskRoutes = require('./hr/api/human-risk');
app.use('/api/hr/human-risks', humanRiskRoutes);

// HR Skills Management API Routes
const skillsManagementRoutes = require('./hr/api/skills-management');
app.use('/api/hr/skills', skillsManagementRoutes);

// HR Tasks Management API Routes
const tasksManagementRoutes = require('./hr/api/tasks-management');
app.use('/api/hr/tasks', tasksManagementRoutes);

// Helper function to build entity filter WHERE clause
const getEntityFilter = (userEntity, tableAlias = '') => {
  const alias = tableAlias ? `${tableAlias}.` : '';
  
  if (userEntity.type === 'HQ') {
    // HQ sees all data
    return '1=1';
  } else if (userEntity.type === 'BRANCH') {
    return `${alias}branch_id = '${userEntity.id}' OR ${alias}entity_id = '${userEntity.id}'`;
  } else if (userEntity.type === 'INCUBATOR') {
    return `${alias}incubator_id = '${userEntity.id}' OR ${alias}entity_id = '${userEntity.id}'`;
  } else if (userEntity.type === 'PLATFORM') {
    return `${alias}platform_id = '${userEntity.id}' OR ${alias}entity_id = '${userEntity.id}'`;
  } else if (userEntity.type === 'OFFICE') {
    return `${alias}office_id = '${userEntity.id}' OR ${alias}entity_id = '${userEntity.id}'`;
  }
  
  return `${alias}entity_id = '${userEntity.id}'`;
};

const getStrictRequestEntityCondition = (req, column = 'entity_id', paramIndex = 1) =>
  buildEntityScopeCondition(getRequestEntityContext(req), column, paramIndex, { includeGlobalForHq: false });


// Root health check for Railway
app.get('/', (req, res) => {
  sendHtmlWithNumberFormat(res, path.join(__dirname, 'newhome', 'index.html'));
});

// إن وُجد index.html قديم بالروت (Apache DirectoryIndex) — لا يفتح الداشبورد على /
app.get('/index.html', (req, res) => {
  res.redirect(301, '/');
});

app.get('/dashboard.html', (req, res) => {
  sendHtmlWithNumberFormat(res, path.join(__dirname, 'dashboard.html'));
});

app.get('/home', (req, res) => {
  res.redirect(302, '/dashboard.html');
});

app.get('/login.html', (req, res) => {
  res.redirect(301, '/login-page.html');
});

app.get(['/newhome', '/newhome/', '/newhome/index.html'], (req, res) => {
  res.redirect(301, '/');
});

app.get('/products', (req, res) => {
  sendHtmlWithNumberFormat(res, path.join(__dirname, 'newhome', 'products.html'));
});

// Identity / Homepage settings page
app.get('/settings', (req, res) => {
  res.sendFile(path.join(__dirname, 'settings.html'));
});

app.get('/create-page', (req, res) => {
  sendHtmlWithNumberFormat(res, path.join(__dirname, 'create-page.html'));
});

app.get('/creators', (req, res) => {
  sendHtmlWithNumberFormat(res, path.join(__dirname, 'creators.html'));
});

app.get('/u/:username', (req, res) => {
  sendHtmlWithNumberFormat(res, path.join(__dirname, 'public-profile.html'));
});

// HR landing serve (direct path + nested)
const hrRouteMap = {
  '/hr': 'hr-home.html',
  '/hr/employees': 'admin-erp-hr.html',
  '/hr/requests': 'requests-processing.html',
  '/hr/operations': 'hr-portal-workflows.html',
  '/hr/employee-360': 'hr-employee-360.html',
  '/hr/attendance-hub': 'hr-attendance-hub.html',
  '/hr/performance': 'hr-performance-hub.html',
  '/hr/learning': 'hr-learning-academy.html',
  '/hr/payroll-hub': 'hr-payroll-hub.html',
  '/hr/integrations-erp': 'hr-integrations-erp.html',
  '/hr/integrations-comms': 'hr-integrations-comms.html',
  '/hr/integrations-sso': 'hr-integrations-sso.html',
  '/hr/accepted-employees': 'accepted-employees.html',
  '/hr/new-hires': 'new-hires.html',
  '/hr/attendance-departure': 'attendance-logs.html',
  '/hr/attendance-register': 'attendance-logs.html',
  '/hr/attendance-table': 'attendance-logs.html',
  '/hr/shift-schedules': 'shift-schedules.html',
  '/hr/payroll': 'payroll-simplified-management.html',
  '/hr/payroll-employees': 'payroll-employees.html',
  '/hr/strategic-analytics': 'hr-strategic-analytics.html',
  '/hr/workforce-planning': 'hr-workforce-planning.html',
  '/hr/succession-planning': 'hr-succession-planning.html',
  '/hr/satisfaction-analytics': 'hr-satisfaction-analytics.html',
  '/hr/talent-management': 'hr-talent-management.html',
  '/hr/human-risk': 'hr-human-risk.html',
  '/hr/skills-management': 'hr-skills-management.html',
  '/hr/innovation-management': 'hr-innovation-management.html',
  '/hr/experience-management': 'hr-experience-management.html',
  '/hr/cost-optimization': 'hr-cost-optimization.html',
  '/hr/productivity-comparison': 'hr-productivity-comparison.html',
  '/hr/process-automation': 'hr-process-automation.html',
  '/hr/admin-circulars': 'admin-circulars.html',
  '/hr/notifications-center': 'hr-notifications-center.html',
  '/hr/smartsheet-bundle': 'hr-section.html',
  '/hr/e-archive': 'hr-section.html',
  '/hr/inbound-outbound-mail': 'inbound-outbound-mail.html',
  '/hr/reporting-suite': 'hr-section.html',
  '/hr/ocr-suite': 'hr-ocr-suite.html',
  '/hr/workflow-engine': 'hr-workflow-engine.html',
  '/hr/tasks-management': 'hr-tasks-management.html',
  '/hr/cybersecurity': 'hr-cybersecurity.html',
  '/hr/api-library': 'hr-api-library.html',
  '/hr/no-code-builder': 'hr-no-code-builder.html',
  '/hr/nocode-system': 'hr-nocode-system.html',
  '/hr/attachment-merge': 'hr-attachment-merge.html',
  '/hr/bulk-messaging': 'hr-bulk-messaging.html',
  '/hr/scanner-integration': 'hr-scanner-integration.html',
  '/hr/quality-scoring': 'hr-quality-scoring.html',
  '/hr/text-chat': 'hr-text-chat.html',
  '/hr/assets-custodies': 'hr-assets-custodies.html',
  '/hr/policies': 'hr-policies.html'
};

const resolveHrTarget = (reqPath) => {
  const cleanPath = (reqPath || '').replace(/\/$/, '') || '/hr';
  // Handle dynamic nocode system viewer routes like /hr/nocode-system/123
  if (/^\/hr\/nocode-system\/\d+$/.test(cleanPath)) {
    return 'hr-nocode-system.html';
  }
  return hrRouteMap[cleanPath] || 'hr-section.html';
};

const serveHrHome = (req, res, next) => {
  try {
    // Serve only when no file extension to avoid blocking assets
    const hasExt = path.extname(req.path || '') !== '';
    if (hasExt) return next();
    const target = resolveHrTarget(req.path);
    res.set('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
    res.set('Pragma', 'no-cache');
    res.set('Expires', '0');
    res.set('Surrogate-Control', 'no-store');
    sendHtmlWithNumberFormat(res, path.join(__dirname, 'finance', target));
  } catch (error) {
    res.status(500).send('HR page not available');
  }
};

app.get('/api/search-index', (req, res) => {
  if (!cachedSearchIndex) {
    cachedSearchIndex = buildSearchIndex();
  }
  res.json(cachedSearchIndex);
});

app.get('/hr', serveHrHome);
app.get('/hr/*', serveHrHome);

// Events Studio page (standalone outside /finance)
const serveEventsStudio = (req, res, next) => {
  try {
    const hasExt = path.extname(req.path || '') !== '';
    if (hasExt) return next();
    res.set('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
    res.set('Pragma', 'no-cache');
    res.set('Expires', '0');
    res.set('Surrogate-Control', 'no-store');
    sendHtmlWithNumberFormat(res, path.join(__dirname, 'finance', 'events-studio-main.html'));
  } catch (error) {
    res.status(500).send('Events Studio page not available');
  }
};

app.get('/events-studio-main.html', (req, res) => res.redirect(301, '/finance/events-studio-main.html'));

// Redirect old /events-studio path to the finance URL
app.get('/events-studio', (req, res) => res.redirect(301, '/finance/events-studio-main.html'));

// Archive home page
const serveArchiveHome = (req, res, next) => {
  try {
    const hasExt = path.extname(req.path || '') !== '';
    if (hasExt) return next();
    res.set('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
    res.set('Pragma', 'no-cache');
    res.set('Expires', '0');
    res.set('Surrogate-Control', 'no-store');
    sendHtmlWithNumberFormat(res, path.join(__dirname, 'finance', 'archive-home.html'));
  } catch (error) {
    res.status(500).send('Archive page not available');
  }
};

app.get('/archive', serveArchiveHome);

// Operational policies pages
const resolveOperationalPoliciesTarget = (reqPath) => {
  const cleanPath = (reqPath || '').replace(/\/$/, '') || '/operational-policies';
  if (cleanPath === '/operational-policies') return 'operational-policies.html';
  return 'operational-policy-detail.html';
};

const serveOperationalPolicies = (req, res, next) => {
  try {
    const hasExt = path.extname(req.path || '') !== '';
    if (hasExt) return next();
    const target = resolveOperationalPoliciesTarget(req.path);
    res.set('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
    res.set('Pragma', 'no-cache');
    res.set('Expires', '0');
    res.set('Surrogate-Control', 'no-store');
    sendHtmlWithNumberFormat(res, path.join(__dirname, 'finance', target));
  } catch (error) {
    res.status(500).send('Operational policies page not available');
  }
};

app.get('/operational-policies', serveOperationalPolicies);
app.get('/operational-policies/*', serveOperationalPolicies);

// System policies pages
const systemPoliciesRoutes = new Set([
  '/finance/policies',
  '/academic/policies',
  '/tech/policies',
  '/admin/policies'
]);

const resolveSystemPoliciesTarget = (reqPath) => {
  const cleanPath = (reqPath || '').replace(/\/$/, '');
  if (systemPoliciesRoutes.has(cleanPath)) return 'system-policies.html';
  return null;
};

const serveSystemPolicies = (req, res, next) => {
  try {
    const hasExt = path.extname(req.path || '') !== '';
    if (hasExt) return next();
    const target = resolveSystemPoliciesTarget(req.path);
    if (!target) return next();
    res.set('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
    res.set('Pragma', 'no-cache');
    res.set('Expires', '0');
    res.set('Surrogate-Control', 'no-store');
    sendHtmlWithNumberFormat(res, path.join(__dirname, 'finance', target));
  } catch (error) {
    res.status(500).send('System policies page not available');
  }
};

app.get(['/finance/policies', '/academic/policies', '/tech/policies', '/admin/policies'], serveSystemPolicies);

// ========================================
// API Routes
// ========================================

// Health check
app.get('/api/health', async (req, res) => {
  try {
    const result = await db.query('SELECT NOW()');
    res.json({ status: 'OK', database: 'Connected', time: result.rows[0].now });
  } catch (error) {
    res.status(500).json({ status: 'ERROR', message: error.message });
  }
});

const HR_MODULE_KEYS = new Set([
  'process-automation',
  'admin-circulars',
  'notifications-center',
  'smartsheet-bundle',
  'e-archive',
  'inbound-outbound-mail',
  'reporting-suite',
  'ocr-suite',
  'workflow-engine',
  'tasks-management',
  'cybersecurity',
  'api-library',
  'no-code-builder',
  'attachment-merge',
  'bulk-messaging',
  'scanner-integration',
  'quality-scoring',
  'text-chat'
]);

const isValidHrModuleKey = (moduleKey) => HR_MODULE_KEYS.has(moduleKey);

const HR_ARCHIVE_UPLOAD_ROOT = path.join(__dirname, 'uploads', 'hr-archive');

const getRequestActor = (req) => {
  const actorName = req.headers['x-user-name'] || req.headers['x-user'] || 'مستخدم النظام';
  const actorRole = req.headers['x-user-role'] || req.headers['x-role'] || 'admin';
  return { actorName, actorRole };
};

const ARCHIVE_ROLE_PERMISSIONS = {
  admin: new Set(['create', 'update', 'delete', 'upload', 'lock', 'share', 'review', 'archive', 'confidentiality', 'reorder']),
  manager: new Set(['create', 'update', 'upload', 'share', 'review', 'archive', 'confidentiality', 'reorder']),
  archivist: new Set(['create', 'update', 'upload', 'lock', 'share', 'review', 'archive', 'confidentiality', 'reorder']),
  reviewer: new Set(['review', 'share']),
  viewer: new Set([])
};

const requireArchivePermission = (req, res, action) => {
  const { actorRole } = getRequestActor(req);
  const permissions = ARCHIVE_ROLE_PERMISSIONS[actorRole] || ARCHIVE_ROLE_PERMISSIONS.viewer;
  if (!permissions.has(action)) {
    res.status(403).json({ error: 'Insufficient permissions' });
    return false;
  }
  return true;
};

const logArchiveActivity = async (req, recordId, action, details = null) => {
  if (!recordId) return;
  const { actorName, actorRole } = getRequestActor(req);
  try {
    await db.query(
      `INSERT INTO hr_archive_activity_log
       (record_id, module_key, action, actor_name, actor_role, details, entity_id, entity_type)
       VALUES ($1, 'e-archive', $2, $3, $4, $5, $6, $7)`,
      [recordId, action, actorName, actorRole, details, req.userEntity?.id, req.userEntity?.type]
    );
    await db.query(
      `UPDATE hr_module_records
       SET last_activity_at = NOW()
       WHERE id = $1`,
      [recordId]
    );
  } catch (error) {
    console.warn('Failed to log archive activity:', error.message);
  }
};

const ensureDir = (dirPath) => {
  if (!fs.existsSync(dirPath)) {
    fs.mkdirSync(dirPath, { recursive: true });
  }
};

const sanitizeFileName = (name = '') => name.replace(/[\s]+/g, '-').replace(/[^a-zA-Z0-9._-]/g, '');

const archiveStorage = multer.diskStorage({
  destination: (req, file, cb) => {
    const entityId = req.userEntity?.id || 'HQ001';
    const recordId = req.params.id || 'unknown';
    const targetDir = path.join(HR_ARCHIVE_UPLOAD_ROOT, entityId, String(recordId));
    ensureDir(targetDir);
    cb(null, targetDir);
  },
  filename: (req, file, cb) => {
    const safeName = sanitizeFileName(file.originalname || 'file');
    const suffix = `${Date.now()}-${Math.round(Math.random() * 1e6)}`;
    cb(null, `${suffix}-${safeName}`);
  }
});

const ARCHIVE_FILE_TYPE_RULES = {
  mimePrefixes: ['image/', 'video/'],
  mimes: new Set([
    'application/pdf',
    'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'application/vnd.ms-powerpoint',
    'application/vnd.openxmlformats-officedocument.presentationml.presentation',
    'application/vnd.ms-excel',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    'application/zip',
    'application/x-zip-compressed',
    'multipart/x-zip',
    'text/plain',
    'text/csv',
    'application/csv'
  ]),
  extensions: new Set([
    'pdf',
    'doc',
    'docx',
    'ppt',
    'pptx',
    'xls',
    'xlsx',
    'zip',
    'txt',
    'csv'
  ])
};

const isArchiveFileAllowed = (file) => {
  const mime = (file.mimetype || '').toLowerCase();
  const extension = path.extname(file.originalname || '').replace('.', '').toLowerCase();
  if (ARCHIVE_FILE_TYPE_RULES.mimePrefixes.some(prefix => mime.startsWith(prefix))) {
    return true;
  }
  if (ARCHIVE_FILE_TYPE_RULES.mimes.has(mime)) {
    return true;
  }
  if (extension && ARCHIVE_FILE_TYPE_RULES.extensions.has(extension)) {
    return true;
  }
  return false;
};

const archiveFileFilter = (req, file, cb) => {
  if (isArchiveFileAllowed(file)) {
    cb(null, true);
    return;
  }
  cb(new Error('Unsupported file type'));
};

const archiveUpload = multer({ storage: archiveStorage, fileFilter: archiveFileFilter });

const deleteArchiveFilesByRecordId = async (recordId, moduleKey, userEntity) => {
  if (!recordId) return;
  const fileFilter = getEntityFilter(userEntity, 'f');
  const filesResult = await db.query(
    `SELECT f.id, f.file_path
     FROM hr_module_record_files f
     WHERE f.record_id = $1 AND f.module_key = $2 AND ${fileFilter}`,
    [recordId, moduleKey]
  );
  for (const file of filesResult.rows) {
    const absolutePath = path.join(__dirname, file.file_path || '');
    if (absolutePath.startsWith(HR_ARCHIVE_UPLOAD_ROOT) && fs.existsSync(absolutePath)) {
      try {
        fs.unlinkSync(absolutePath);
      } catch (error) {
        console.warn('Failed to delete archive file:', error.message);
      }
    }
  }
  await db.query(
    `DELETE FROM hr_module_record_files f WHERE f.record_id = $1 AND f.module_key = $2 AND ${fileFilter}`,
    [recordId, moduleKey]
  );
};

app.get('/api/hr/modules/:moduleKey/records', async (req, res) => {
  try {
    const { moduleKey } = req.params;
    if (!isValidHrModuleKey(moduleKey)) {
      return res.status(400).json({ error: 'Invalid HR module key' });
    }

    const filter = getEntityFilter(req.userEntity, 'r');
    const result = await db.query(
            `SELECT r.id, r.module_key, r.title, r.department, r.procedure_type, r.steps_count,
              r.owner, r.status, r.priority, r.due_date, r.issue_date, r.notes, r.keywords, r.created_at, r.updated_at,
              r.doc_number, r.doc_type, r.doc_category, r.archive_date, r.confidentiality,
              r.display_order, r.review_status, r.share_status, r.is_locked, r.locked_by, r.locked_at, r.last_activity_at
       FROM hr_module_records r
       WHERE r.module_key = $1 AND ${filter}
       ORDER BY COALESCE(r.display_order, 999999), r.updated_at DESC`,
      [moduleKey]
    );
    let rows = result.rows || [];

    if (moduleKey === 'e-archive' && rows.length === 0 && isHqEntityContext(req)) {
      const entityId = req.userEntity?.id || 'HQ001';
      const entityType = req.userEntity?.type || 'HQ';
      const templateCheck = await db.query(
        `SELECT COUNT(*)::int AS count
         FROM hr_module_records
         WHERE module_key = 'e-archive' AND entity_id = 'HQ001'`
      );
      if ((templateCheck.rows[0]?.count || 0) > 0) {
        await db.query(
          `INSERT INTO hr_module_records
           (module_key, title, department, procedure_type, steps_count, owner, status, priority, due_date, issue_date, notes,
            entity_id, entity_type, doc_number, doc_type, doc_category, archive_date, confidentiality, display_order, review_status, share_status)
           SELECT module_key, title, department, procedure_type, steps_count, owner, status, priority, due_date, issue_date, notes,
                  $1, $2, doc_number, doc_type, doc_category, archive_date, confidentiality, display_order, review_status, share_status
           FROM hr_module_records
           WHERE module_key = 'e-archive' AND entity_id = 'HQ001'`,
          [entityId, entityType]
        );

        const seededResult = await db.query(
            `SELECT r.id, r.module_key, r.title, r.department, r.procedure_type, r.steps_count,
              r.owner, r.status, r.priority, r.due_date, r.issue_date, r.notes, r.keywords, r.created_at, r.updated_at,
                  r.doc_number, r.doc_type, r.doc_category, r.archive_date, r.confidentiality,
                  r.display_order, r.review_status, r.share_status, r.is_locked, r.locked_by, r.locked_at, r.last_activity_at
           FROM hr_module_records r
           WHERE r.module_key = $1 AND ${filter}
           ORDER BY COALESCE(r.display_order, 999999), r.updated_at DESC`,
          [moduleKey]
        );
        rows = seededResult.rows || [];
      }
    }

    const FILE_SUPPORTED_MODULES = new Set(['e-archive', 'inbound-outbound-mail']);
    if (FILE_SUPPORTED_MODULES.has(moduleKey) && rows.length) {
      const recordIds = rows.map(row => row.id);
      const fileFilter = getEntityFilter(req.userEntity, 'f');
      const filesResult = await db.query(
        `SELECT f.id, f.record_id, f.module_key, f.original_name, f.stored_name, f.mime_type, f.size_bytes, f.extension, f.file_path, f.created_at
         FROM hr_module_record_files f
         WHERE f.record_id = ANY($1) AND f.module_key = $2 AND ${fileFilter}
         ORDER BY f.created_at DESC`,
        [recordIds, moduleKey]
      );
      const filesByRecord = filesResult.rows.reduce((acc, file) => {
        if (!acc[file.record_id]) acc[file.record_id] = [];
        acc[file.record_id].push(file);
        return acc;
      }, {});
      rows.forEach(row => {
        row.files = filesByRecord[row.id] || [];
      });
    }

    res.json(rows);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/hr/modules/:moduleKey/records', async (req, res) => {
  try {
    const { moduleKey } = req.params;
    if (!isValidHrModuleKey(moduleKey)) {
      return res.status(400).json({ error: 'Invalid HR module key' });
    }

    if (moduleKey === 'e-archive' && !requireArchivePermission(req, res, 'create')) {
      return;
    }

    const {
      title,
      owner,
      status,
      priority,
      due_date,
      issue_date,
      notes,
      keywords,
      department,
      procedure_type,
      steps_count,
      doc_number,
      doc_type,
      doc_category,
      archive_date,
      confidentiality,
      display_order,
      review_status,
      share_status
    } = req.body || {};
    if (!title) {
      return res.status(400).json({ error: 'title is required' });
    }

    const stepsCountValue = Number(steps_count);
    const stepsCountSafe = Number.isFinite(stepsCountValue) ? stepsCountValue : null;
    let displayOrderSafe = Number.isFinite(Number(display_order)) ? Number(display_order) : null;

    if (moduleKey === 'e-archive' && displayOrderSafe === null) {
      const maxOrderResult = await db.query(
        `SELECT COALESCE(MAX(display_order), 0) AS max_order
         FROM hr_module_records
         WHERE module_key = 'e-archive' AND ${getEntityFilter(req.userEntity, 'r')}`
      );
      displayOrderSafe = Number(maxOrderResult.rows[0]?.max_order || 0) + 1;
    }

    const result = await db.query(
      `INSERT INTO hr_module_records
       (module_key, title, department, procedure_type, steps_count, owner, status, priority, due_date, issue_date, notes, keywords, entity_id, entity_type, doc_number, doc_type, doc_category, archive_date, confidentiality, display_order, review_status, share_status)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20, $21, $22)
       RETURNING id, module_key, title, department, procedure_type, steps_count, owner, status, priority, due_date, issue_date, notes, keywords, created_at, updated_at, doc_number, doc_type, doc_category, archive_date, confidentiality, display_order, review_status, share_status, is_locked, locked_by, locked_at, last_activity_at`,
      [
        moduleKey,
        title,
        department || null,
        procedure_type || null,
        stepsCountSafe,
        owner || null,
        status || 'قيد المراجعة',
        priority || 'متوسط',
        due_date || null,
        issue_date || null,
        notes || null,
        keywords || null,
        req.userEntity.id,
        req.userEntity.type,
        doc_number || null,
        doc_type || null,
        doc_category || null,
        archive_date || null,
        confidentiality || null,
        displayOrderSafe,
        review_status || null,
        share_status || null
      ]
    );

    if (moduleKey === 'e-archive') {
      await logArchiveActivity(req, result.rows[0].id, 'CREATE', `تمت إضافة المستند ${title}`);
    }

    res.status(201).json(result.rows[0]);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.put('/api/hr/modules/:moduleKey/records/:id', async (req, res) => {
  try {
    const { moduleKey, id } = req.params;
    if (!isValidHrModuleKey(moduleKey)) {
      return res.status(400).json({ error: 'Invalid HR module key' });
    }

    if (moduleKey === 'e-archive' && !requireArchivePermission(req, res, 'update')) {
      return;
    }

    const {
      title,
      owner,
      status,
      priority,
      due_date,
      issue_date,
      notes,
      keywords,
      department,
      procedure_type,
      steps_count,
      doc_number,
      doc_type,
      doc_category,
      archive_date,
      confidentiality,
      display_order,
      review_status,
      share_status
    } = req.body || {};
    const filter = getEntityFilter(req.userEntity, 'r');

    let existingRecord = null;
    if (moduleKey === 'e-archive') {
      const recordResult = await db.query(
        `SELECT id, title, confidentiality, is_locked, locked_by
         FROM hr_module_records r
         WHERE r.id = $1 AND r.module_key = $2 AND ${filter}`,
        [id, moduleKey]
      );
      if (!recordResult.rows.length) {
        return res.status(404).json({ error: 'Record not found' });
      }
      existingRecord = recordResult.rows[0];
      if (existingRecord.is_locked) {
        const { actorRole } = getRequestActor(req);
        if (!['admin', 'archivist'].includes(actorRole)) {
          return res.status(423).json({ error: 'Record is locked' });
        }
      }
    }

    const stepsCountValue = Number(steps_count);
    const stepsCountSafe = Number.isFinite(stepsCountValue) ? stepsCountValue : null;
    const displayOrderSafe = Number.isFinite(Number(display_order)) ? Number(display_order) : null;

    const result = await db.query(
      `UPDATE hr_module_records r
       SET title = COALESCE($1, r.title),
           department = COALESCE($2, r.department),
           procedure_type = COALESCE($3, r.procedure_type),
           steps_count = COALESCE($4, r.steps_count),
           owner = COALESCE($5, r.owner),
           status = COALESCE($6, r.status),
           priority = COALESCE($7, r.priority),
           due_date = COALESCE($8, r.due_date),
           issue_date = COALESCE($9, r.issue_date),
           notes = COALESCE($10, r.notes),
           keywords = COALESCE($11, r.keywords),
           doc_number = COALESCE($12, r.doc_number),
           doc_type = COALESCE($13, r.doc_type),
           doc_category = COALESCE($14, r.doc_category),
           archive_date = COALESCE($15, r.archive_date),
           confidentiality = COALESCE($16, r.confidentiality),
           display_order = COALESCE($17, r.display_order),
           review_status = COALESCE($18, r.review_status),
           share_status = COALESCE($19, r.share_status),
           updated_at = NOW()
       WHERE r.id = $20 AND r.module_key = $21 AND ${filter}
       RETURNING id, module_key, title, department, procedure_type, steps_count, owner, status, priority, due_date, issue_date, notes, keywords, created_at, updated_at, doc_number, doc_type, doc_category, archive_date, confidentiality, display_order, review_status, share_status, is_locked, locked_by, locked_at, last_activity_at`,
      [
        title || null,
        department || null,
        procedure_type || null,
        stepsCountSafe,
        owner || null,
        status || null,
        priority || null,
        due_date || null,
        issue_date || null,
        notes || null,
        keywords || null,
        doc_number || null,
        doc_type || null,
        doc_category || null,
        archive_date || null,
        confidentiality || null,
        displayOrderSafe,
        review_status || null,
        share_status || null,
        id,
        moduleKey
      ]
    );

    if (!result.rows.length) {
      return res.status(404).json({ error: 'Record not found' });
    }

    if (moduleKey === 'e-archive') {
      await logArchiveActivity(req, id, 'UPDATE', `تم تحديث المستند ${result.rows[0].title}`);
      const nextConfidentiality = confidentiality || existingRecord?.confidentiality;
      if (nextConfidentiality === 'سري' || nextConfidentiality === 'سري للغاية') {
        await db.query(
          `INSERT INTO notifications
           (user_id, entity_id, type, title, message, link_type, link_id, priority)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
          [
            null,
            req.userEntity.id,
            'CONFIDENTIAL_UPDATE',
            'تنبيه تعديل مستند سري',
            `تم تعديل مستند سري: ${result.rows[0].title}`,
            'ARCHIVE',
            id,
            'HIGH'
          ]
        );
      }
    }

    res.json(result.rows[0]);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.delete('/api/hr/modules/:moduleKey/records/:id', async (req, res) => {
  try {
    const { moduleKey, id } = req.params;
    if (!isValidHrModuleKey(moduleKey)) {
      return res.status(400).json({ error: 'Invalid HR module key' });
    }

    if (moduleKey === 'e-archive' && !requireArchivePermission(req, res, 'delete')) {
      return;
    }

    const filter = getEntityFilter(req.userEntity, 'r');
    if (moduleKey === 'e-archive') {
      await deleteArchiveFilesByRecordId(id, moduleKey, req.userEntity);
    }

    const result = await db.query(
      `DELETE FROM hr_module_records r
       WHERE r.id = $1 AND r.module_key = $2 AND ${filter}
       RETURNING id`,
      [id, moduleKey]
    );

    if (!result.rows.length) {
      return res.status(404).json({ error: 'Record not found' });
    }

    if (moduleKey === 'e-archive') {
      await logArchiveActivity(req, id, 'DELETE', `تم حذف المستند رقم ${id}`);
    }

    res.json({ success: true, id: result.rows[0].id });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

const HR_FILE_MODULES = new Set(['e-archive', 'inbound-outbound-mail']);

app.get('/api/hr/modules/:moduleKey/records/:id/files', async (req, res) => {
  try {
    const { moduleKey, id } = req.params;
    if (!isValidHrModuleKey(moduleKey) || !HR_FILE_MODULES.has(moduleKey)) {
      return res.status(400).json({ error: 'Invalid HR module key' });
    }

    const fileFilter = getEntityFilter(req.userEntity, 'f');
    const filesResult = await db.query(
      `SELECT f.id, f.record_id, f.module_key, f.original_name, f.stored_name, f.mime_type, f.size_bytes, f.extension, f.file_path, f.created_at
       FROM hr_module_record_files f
       WHERE f.record_id = $1 AND f.module_key = $2 AND ${fileFilter}
       ORDER BY f.created_at DESC`,
      [id, moduleKey]
    );

    res.json(filesResult.rows || []);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/hr/modules/:moduleKey/records/:id/files', async (req, res) => {
  try {
    const { moduleKey, id } = req.params;
    if (!isValidHrModuleKey(moduleKey) || !HR_FILE_MODULES.has(moduleKey)) {
      return res.status(400).json({ error: 'Invalid HR module key' });
    }

    if (moduleKey === 'e-archive' && !requireArchivePermission(req, res, 'upload')) {
      return;
    }

    const recordFilter = getEntityFilter(req.userEntity, 'r');
    const recordCheck = await db.query(
      `SELECT id FROM hr_module_records r WHERE r.id = $1 AND r.module_key = $2 AND ${recordFilter}`,
      [id, moduleKey]
    );
    if (!recordCheck.rows.length) {
      return res.status(404).json({ error: 'Record not found' });
    }

    archiveUpload.array('files', 12)(req, res, async (err) => {
      if (err) {
        return res.status(400).json({ error: err.message || 'Upload failed' });
      }

      const files = Array.isArray(req.files) ? req.files : [];
      if (!files.length) {
        return res.status(400).json({ error: 'No files uploaded' });
      }

      const insertPromises = files.map(file => {
        const relativePath = path.relative(__dirname, file.path);
        const extension = path.extname(file.originalname || '').replace('.', '').toLowerCase();
        return db.query(
          `INSERT INTO hr_module_record_files
           (record_id, module_key, original_name, stored_name, mime_type, size_bytes, extension, file_path, entity_id, entity_type)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
           RETURNING id, record_id, module_key, original_name, stored_name, mime_type, size_bytes, extension, file_path, created_at`,
          [
            id,
            moduleKey,
            file.originalname,
            file.filename,
            file.mimetype,
            file.size,
            extension,
            relativePath,
            req.userEntity.id,
            req.userEntity.type
          ]
        );
      });

      const results = await Promise.all(insertPromises);
      const inserted = results.map(result => result.rows[0]);
      await logArchiveActivity(req, id, 'UPLOAD', `تم رفع ${inserted.length} ملف`);
      res.status(201).json(inserted);
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.get('/api/hr/modules/:moduleKey/records/:id/files/:fileId', async (req, res) => {
  try {
    const { moduleKey, id, fileId } = req.params;
    if (!isValidHrModuleKey(moduleKey) || !HR_FILE_MODULES.has(moduleKey)) {
      return res.status(400).json({ error: 'Invalid HR module key' });
    }

    const fileFilter = getEntityFilter(req.userEntity, 'f');
    const fileResult = await db.query(
      `SELECT f.id, f.record_id, f.original_name, f.mime_type, f.file_path
       FROM hr_module_record_files f
       WHERE f.id = $1 AND f.record_id = $2 AND f.module_key = $3 AND ${fileFilter}
       LIMIT 1`,
      [fileId, id, moduleKey]
    );

    if (!fileResult.rows.length) {
      return res.status(404).json({ error: 'File not found' });
    }

    const file = fileResult.rows[0];
    const absolutePath = path.join(__dirname, file.file_path || '');
    if (!absolutePath.startsWith(HR_ARCHIVE_UPLOAD_ROOT) || !fs.existsSync(absolutePath)) {
      return res.status(404).json({ error: 'File not found' });
    }

    const download = req.query.download === '1';
    res.setHeader('Content-Type', file.mime_type || 'application/octet-stream');
    res.setHeader('Content-Disposition', `${download ? 'attachment' : 'inline'}; filename="${file.original_name}"`);
    if (download) {
      await logArchiveActivity(req, id, 'DOWNLOAD', `تم تنزيل الملف ${file.original_name}`);
    }
    res.sendFile(absolutePath);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.delete('/api/hr/modules/:moduleKey/records/:id/files/:fileId', async (req, res) => {
  try {
    const { moduleKey, id, fileId } = req.params;
    if (!isValidHrModuleKey(moduleKey) || moduleKey !== 'e-archive') {
      return res.status(400).json({ error: 'Invalid HR module key' });
    }

    if (!requireArchivePermission(req, res, 'update')) {
      return;
    }

    const fileFilter = getEntityFilter(req.userEntity, 'f');
    const fileResult = await db.query(
      `SELECT f.id, f.file_path
       FROM hr_module_record_files f
       WHERE f.id = $1 AND f.record_id = $2 AND f.module_key = $3 AND ${fileFilter}
       LIMIT 1`,
      [fileId, id, moduleKey]
    );

    if (!fileResult.rows.length) {
      return res.status(404).json({ error: 'File not found' });
    }

    const file = fileResult.rows[0];
    const absolutePath = path.join(__dirname, file.file_path || '');
    if (absolutePath.startsWith(HR_ARCHIVE_UPLOAD_ROOT) && fs.existsSync(absolutePath)) {
      try {
        fs.unlinkSync(absolutePath);
      } catch (error) {
        console.warn('Failed to delete archive file:', error.message);
      }
    }

    await db.query(
      `DELETE FROM hr_module_record_files f WHERE f.id = $1 AND f.record_id = $2 AND f.module_key = $3 AND ${fileFilter}`,
      [fileId, id, moduleKey]
    );

    await logArchiveActivity(req, id, 'DELETE_FILE', `تم حذف الملف رقم ${fileId}`);

    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.get('/api/hr/modules/e-archive/records/:id/activity', async (req, res) => {
  try {
    const { id } = req.params;
    const filter = getEntityFilter(req.userEntity, 'r');
    const recordCheck = await db.query(
      `SELECT id FROM hr_module_records r WHERE r.id = $1 AND r.module_key = 'e-archive' AND ${filter}`,
      [id]
    );
    if (!recordCheck.rows.length) {
      return res.status(404).json({ error: 'Record not found' });
    }

    const activityFilter = getEntityFilter(req.userEntity, 'a');
    const result = await db.query(
      `SELECT a.id, a.action, a.actor_name, a.actor_role, a.details, a.created_at
       FROM hr_archive_activity_log a
       WHERE a.record_id = $1 AND ${activityFilter}
       ORDER BY a.created_at DESC
       LIMIT 50`,
      [id]
    );

    res.json(result.rows || []);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/hr/modules/e-archive/records/:id/activity', async (req, res) => {
  try {
    const { id } = req.params;
    const { action, details } = req.body || {};
    if (!action) {
      return res.status(400).json({ error: 'action is required' });
    }
    await logArchiveActivity(req, id, action, details || null);
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/hr/modules/e-archive/records/reorder', async (req, res) => {
  try {
    if (!requireArchivePermission(req, res, 'reorder')) {
      return;
    }
    const { orderedIds } = req.body || {};
    if (!Array.isArray(orderedIds) || !orderedIds.length) {
      return res.status(400).json({ error: 'orderedIds is required' });
    }
    const filter = getEntityFilter(req.userEntity, 'r');
    await db.query('BEGIN');
    for (let index = 0; index < orderedIds.length; index += 1) {
      await db.query(
        `UPDATE hr_module_records r
         SET display_order = $1
         WHERE r.id = $2 AND r.module_key = 'e-archive' AND ${filter}`,
        [index + 1, orderedIds[index]]
      );
    }
    await db.query('COMMIT');
    res.json({ success: true });
  } catch (error) {
    await db.query('ROLLBACK');
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/hr/modules/e-archive/records/bulk-archive', async (req, res) => {
  try {
    if (!requireArchivePermission(req, res, 'archive')) {
      return;
    }
    const { ids } = req.body || {};
    if (!Array.isArray(ids) || !ids.length) {
      return res.status(400).json({ error: 'ids is required' });
    }
    const filter = getEntityFilter(req.userEntity, 'r');
    await db.query(
      `UPDATE hr_module_records r
       SET status = 'مؤرشف', updated_at = NOW()
       WHERE r.id = ANY($1) AND r.module_key = 'e-archive' AND ${filter}`,
      [ids]
    );
    for (const recordId of ids) {
      await logArchiveActivity(req, recordId, 'ARCHIVE', 'تمت الأرشفة الجماعية');
    }
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/hr/modules/e-archive/records/bulk-confidentiality', async (req, res) => {
  try {
    if (!requireArchivePermission(req, res, 'confidentiality')) {
      return;
    }
    const { ids, confidentiality } = req.body || {};
    if (!Array.isArray(ids) || !ids.length || !confidentiality) {
      return res.status(400).json({ error: 'ids and confidentiality are required' });
    }
    const filter = getEntityFilter(req.userEntity, 'r');
    await db.query(
      `UPDATE hr_module_records r
       SET confidentiality = $1, updated_at = NOW()
       WHERE r.id = ANY($2) AND r.module_key = 'e-archive' AND ${filter}`,
      [confidentiality, ids]
    );
    for (const recordId of ids) {
      await logArchiveActivity(req, recordId, 'CONFIDENTIALITY', `تم تغيير السرية إلى ${confidentiality}`);
    }
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/hr/modules/e-archive/records/:id/actions/review', async (req, res) => {
  try {
    const { id } = req.params;
    if (!requireArchivePermission(req, res, 'review')) {
      return;
    }
    const filter = getEntityFilter(req.userEntity, 'r');
    const result = await db.query(
      `UPDATE hr_module_records r
       SET status = 'قيد المراجعة', review_status = 'IN_REVIEW', updated_at = NOW()
       WHERE r.id = $1 AND r.module_key = 'e-archive' AND ${filter}
       RETURNING id, title`,
      [id]
    );
    if (!result.rows.length) {
      return res.status(404).json({ error: 'Record not found' });
    }
    await logArchiveActivity(req, id, 'REVIEW', 'تم إرسال المستند للمراجعة');
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/hr/modules/e-archive/records/:id/actions/share', async (req, res) => {
  try {
    const { id } = req.params;
    if (!requireArchivePermission(req, res, 'share')) {
      return;
    }
    const filter = getEntityFilter(req.userEntity, 'r');
    const result = await db.query(
      `UPDATE hr_module_records r
       SET share_status = 'SHARED', updated_at = NOW()
       WHERE r.id = $1 AND r.module_key = 'e-archive' AND ${filter}
       RETURNING id, title`,
      [id]
    );
    if (!result.rows.length) {
      return res.status(404).json({ error: 'Record not found' });
    }
    await logArchiveActivity(req, id, 'SHARE', 'تمت المشاركة الداخلية');
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/hr/modules/e-archive/records/:id/actions/lock', async (req, res) => {
  try {
    const { id } = req.params;
    const { locked } = req.body || {};
    if (!requireArchivePermission(req, res, 'lock')) {
      return;
    }
    const filter = getEntityFilter(req.userEntity, 'r');
    const { actorName } = getRequestActor(req);
    const result = await db.query(
      `UPDATE hr_module_records r
       SET is_locked = $1,
           locked_by = $2,
           locked_at = CASE WHEN $1 THEN NOW() ELSE NULL END,
           updated_at = NOW()
       WHERE r.id = $3 AND r.module_key = 'e-archive' AND ${filter}
       RETURNING id`,
      [Boolean(locked), Boolean(locked) ? actorName : null, id]
    );
    if (!result.rows.length) {
      return res.status(404).json({ error: 'Record not found' });
    }
    await logArchiveActivity(req, id, Boolean(locked) ? 'LOCK' : 'UNLOCK', Boolean(locked) ? 'تم قفل المستند' : 'تم فتح المستند');
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Records Archive - Master Register
app.get('/api/records/master-register', async (req, res) => {
  try {
    const filter = getEntityFilter(req.userEntity, 'r');
    const result = await db.query(
      `SELECT r.id,
              r.doc_number AS "docNumber",
              r.doc_type AS "docType",
              r.department,
              TO_CHAR(r.doc_date, 'YYYY-MM-DD') AS "date",
              r.subject,
              r.status,
              r.confidentiality,
              r.url,
              r.direction,
              r.notes,
              r.source,
              r.password
       FROM records_master_register r
       WHERE ${filter}
       ORDER BY r.doc_date DESC, r.id DESC`
    );

    res.json(result.rows || []);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/records/master-register', async (req, res) => {
  try {
    const {
      docNumber,
      docType,
      department,
      date,
      subject,
      status,
      confidentiality,
      url,
      direction,
      notes,
      source,
      password
    } = req.body || {};

    if (!docNumber || !docType || !department || !date || !subject || !status || !confidentiality || !direction || !source) {
      return res.status(400).json({ error: 'Missing required fields' });
    }

    const result = await db.query(
      `INSERT INTO records_master_register
        (doc_number, doc_type, department, doc_date, subject, status, confidentiality, url, direction, notes, source, password, entity_id, entity_type)
       VALUES
        ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14)
       RETURNING id,
                 doc_number AS "docNumber",
                 doc_type AS "docType",
                 department,
                 TO_CHAR(doc_date, 'YYYY-MM-DD') AS "date",
                 subject,
                 status,
                 confidentiality,
                 url,
                 direction,
                 notes,
                 source,
                 password`,
      [
        docNumber,
        docType,
        department,
        date,
        subject,
        status,
        confidentiality,
        url || null,
        direction,
        notes || null,
        source,
        password || null,
        req.userEntity.id,
        req.userEntity.type
      ]
    );

    res.status(201).json(result.rows[0]);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.put('/api/records/master-register/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const {
      docNumber,
      docType,
      department,
      date,
      subject,
      status,
      confidentiality,
      url,
      direction,
      notes,
      source,
      password
    } = req.body || {};

    const filter = getEntityFilter(req.userEntity, 'r');
    const result = await db.query(
      `UPDATE records_master_register r
       SET doc_number = COALESCE($1, r.doc_number),
           doc_type = COALESCE($2, r.doc_type),
           department = COALESCE($3, r.department),
           doc_date = COALESCE($4, r.doc_date),
           subject = COALESCE($5, r.subject),
           status = COALESCE($6, r.status),
           confidentiality = COALESCE($7, r.confidentiality),
           url = COALESCE($8, r.url),
           direction = COALESCE($9, r.direction),
           notes = COALESCE($10, r.notes),
           source = COALESCE($11, r.source),
           password = COALESCE($12, r.password),
           updated_at = NOW()
       WHERE r.id = $13 AND ${filter}
       RETURNING id,
                 doc_number AS "docNumber",
                 doc_type AS "docType",
                 department,
                 TO_CHAR(doc_date, 'YYYY-MM-DD') AS "date",
                 subject,
                 status,
                 confidentiality,
                 url,
                 direction,
                 notes,
                 source,
                 password`,
      [
        docNumber || null,
        docType || null,
        department || null,
        date || null,
        subject || null,
        status || null,
        confidentiality || null,
        url || null,
        direction || null,
        notes || null,
        source || null,
        password || null,
        id
      ]
    );

    if (!result.rows.length) {
      return res.status(404).json({ error: 'Record not found' });
    }

    res.json(result.rows[0]);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.delete('/api/records/master-register/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const filter = getEntityFilter(req.userEntity, 'r');
    const result = await db.query(
      `DELETE FROM records_master_register r
       WHERE r.id = $1 AND ${filter}
       RETURNING id`,
      [id]
    );

    if (!result.rows.length) {
      return res.status(404).json({ error: 'Record not found' });
    }

    res.json({ id: result.rows[0].id });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Records Archive - Students Affairs
app.get('/api/records/students-affairs', async (req, res) => {
  try {
    const filter = getEntityFilter(req.userEntity, 'r');
    const result = await db.query(
      `SELECT r.id,
              r.student_number AS "studentNumber",
              r.student_name AS "studentName",
              r.stage_department AS "stageDepartment",
              r.document_type AS "documentType",
              r.status,
              TO_CHAR(r.registration_date, 'YYYY-MM-DD') AS "registrationDate",
              r.notes
       FROM records_students_affairs r
       WHERE ${filter}
       ORDER BY r.registration_date DESC, r.id DESC`
    );

    res.json(result.rows || []);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/records/students-affairs', async (req, res) => {
  try {
    const {
      studentNumber,
      studentName,
      stageDepartment,
      documentType,
      status,
      registrationDate,
      notes
    } = req.body || {};

    if (!studentNumber || !studentName || !stageDepartment || !documentType || !status || !registrationDate) {
      return res.status(400).json({ error: 'Missing required fields' });
    }

    const result = await db.query(
      `INSERT INTO records_students_affairs
        (student_number, student_name, stage_department, document_type, status, registration_date, notes, entity_id, entity_type)
       VALUES
        ($1,$2,$3,$4,$5,$6,$7,$8,$9)
       RETURNING id,
                 student_number AS "studentNumber",
                 student_name AS "studentName",
                 stage_department AS "stageDepartment",
                 document_type AS "documentType",
                 status,
                 TO_CHAR(registration_date, 'YYYY-MM-DD') AS "registrationDate",
                 notes`,
      [
        studentNumber,
        studentName,
        stageDepartment,
        documentType,
        status,
        registrationDate,
        notes || null,
        req.userEntity.id,
        req.userEntity.type
      ]
    );

    res.status(201).json(result.rows[0]);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.put('/api/records/students-affairs/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const {
      studentNumber,
      studentName,
      stageDepartment,
      documentType,
      status,
      registrationDate,
      notes
    } = req.body || {};

    const filter = getEntityFilter(req.userEntity, 'r');
    const result = await db.query(
      `UPDATE records_students_affairs r
       SET student_number = COALESCE($1, r.student_number),
           student_name = COALESCE($2, r.student_name),
           stage_department = COALESCE($3, r.stage_department),
           document_type = COALESCE($4, r.document_type),
           status = COALESCE($5, r.status),
           registration_date = COALESCE($6, r.registration_date),
           notes = COALESCE($7, r.notes),
           updated_at = NOW()
       WHERE r.id = $8 AND ${filter}
       RETURNING id,
                 student_number AS "studentNumber",
                 student_name AS "studentName",
                 stage_department AS "stageDepartment",
                 document_type AS "documentType",
                 status,
                 TO_CHAR(registration_date, 'YYYY-MM-DD') AS "registrationDate",
                 notes`,
      [
        studentNumber || null,
        studentName || null,
        stageDepartment || null,
        documentType || null,
        status || null,
        registrationDate || null,
        notes || null,
        id
      ]
    );

    if (!result.rows.length) {
      return res.status(404).json({ error: 'Record not found' });
    }

    res.json(result.rows[0]);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.delete('/api/records/students-affairs/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const filter = getEntityFilter(req.userEntity, 'r');
    const result = await db.query(
      `DELETE FROM records_students_affairs r
       WHERE r.id = $1 AND ${filter}
       RETURNING id`,
      [id]
    );

    if (!result.rows.length) {
      return res.status(404).json({ error: 'Record not found' });
    }

    res.json({ id: result.rows[0].id });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// HR SSO Integrations API
app.get('/api/hr/sso-integrations', async (req, res) => {
  try {
    const filter = getEntityFilter(req.userEntity, 's');
    const result = await db.query(
      `SELECT s.id, s.provider_name, s.protocol, s.status, s.domain, s.metadata_url,
              s.login_url, s.last_sync_at, s.notes, s.created_at, s.updated_at
       FROM hr_sso_integrations s
       WHERE ${filter}
       ORDER BY s.created_at DESC`
    );
    res.json(result.rows || []);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/hr/sso-integrations', async (req, res) => {
  try {
    const {
      provider_name,
      protocol,
      status,
      domain,
      metadata_url,
      login_url,
      last_sync_at,
      notes
    } = req.body || {};

    if (!provider_name || !protocol) {
      return res.status(400).json({ error: 'provider_name and protocol are required' });
    }

    const result = await db.query(
      `INSERT INTO hr_sso_integrations
       (provider_name, protocol, status, domain, metadata_url, login_url, last_sync_at, notes, entity_id, entity_type)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
       RETURNING id, provider_name, protocol, status, domain, metadata_url, login_url, last_sync_at, notes, created_at, updated_at`,
      [
        provider_name,
        protocol,
        status || 'غير مفعل',
        domain || null,
        metadata_url || null,
        login_url || null,
        last_sync_at || null,
        notes || null,
        req.userEntity.id,
        req.userEntity.type
      ]
    );
    res.status(201).json(result.rows[0]);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.put('/api/hr/sso-integrations/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const {
      provider_name,
      protocol,
      status,
      domain,
      metadata_url,
      login_url,
      last_sync_at,
      notes
    } = req.body || {};
    const filter = getEntityFilter(req.userEntity, 's');

    const result = await db.query(
      `UPDATE hr_sso_integrations s
       SET provider_name = COALESCE($1, s.provider_name),
           protocol = COALESCE($2, s.protocol),
           status = COALESCE($3, s.status),
           domain = COALESCE($4, s.domain),
           metadata_url = COALESCE($5, s.metadata_url),
           login_url = COALESCE($6, s.login_url),
           last_sync_at = COALESCE($7, s.last_sync_at),
           notes = COALESCE($8, s.notes),
           updated_at = NOW()
       WHERE s.id = $9 AND ${filter}
       RETURNING id, provider_name, protocol, status, domain, metadata_url, login_url, last_sync_at, notes, created_at, updated_at`,
      [
        provider_name || null,
        protocol || null,
        status || null,
        domain || null,
        metadata_url || null,
        login_url || null,
        last_sync_at || null,
        notes || null,
        id
      ]
    );

    if (!result.rows.length) {
      return res.status(404).json({ error: 'Integration not found' });
    }
    res.json(result.rows[0]);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.delete('/api/hr/sso-integrations/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const filter = getEntityFilter(req.userEntity, 's');
    const result = await db.query(
      `DELETE FROM hr_sso_integrations s
       WHERE s.id = $1 AND ${filter}
       RETURNING id`,
      [id]
    );

    if (!result.rows.length) {
      return res.status(404).json({ error: 'Integration not found' });
    }
    res.json({ success: true, id: result.rows[0].id });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// HR ERP Integrations API
app.get('/api/hr/erp-integrations', async (req, res) => {
  try {
    const filter = getEntityFilter(req.userEntity, 'e');
    const result = await db.query(
      `SELECT e.id, e.integration_name, e.integration_type, e.linked_entity,
              e.status, e.owner, e.notes, e.created_at, e.updated_at
       FROM hr_erp_integrations e
       WHERE ${filter}
       ORDER BY e.created_at DESC`
    );
    res.json(result.rows || []);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/hr/erp-integrations', async (req, res) => {
  try {
    const {
      integration_name,
      integration_type,
      linked_entity,
      status,
      owner,
      notes
    } = req.body || {};

    if (!integration_name || !integration_type) {
      return res.status(400).json({ error: 'integration_name and integration_type are required' });
    }

    const result = await db.query(
      `INSERT INTO hr_erp_integrations
       (integration_name, integration_type, linked_entity, status, owner, notes, entity_id, entity_type)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
       RETURNING id, integration_name, integration_type, linked_entity, status, owner, notes, created_at, updated_at`,
      [
        integration_name,
        integration_type,
        linked_entity || null,
        status || 'قيد الإعداد',
        owner || null,
        notes || null,
        req.userEntity.id,
        req.userEntity.type
      ]
    );

    res.status(201).json(result.rows[0]);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.put('/api/hr/erp-integrations/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const {
      integration_name,
      integration_type,
      linked_entity,
      status,
      owner,
      notes
    } = req.body || {};
    const filter = getEntityFilter(req.userEntity, 'e');

    const result = await db.query(
      `UPDATE hr_erp_integrations e
       SET integration_name = COALESCE($1, e.integration_name),
           integration_type = COALESCE($2, e.integration_type),
           linked_entity = COALESCE($3, e.linked_entity),
           status = COALESCE($4, e.status),
           owner = COALESCE($5, e.owner),
           notes = COALESCE($6, e.notes),
           updated_at = NOW()
       WHERE e.id = $7 AND ${filter}
       RETURNING id, integration_name, integration_type, linked_entity, status, owner, notes, created_at, updated_at`,
      [
        integration_name || null,
        integration_type || null,
        linked_entity || null,
        status || null,
        owner || null,
        notes || null,
        id
      ]
    );

    if (!result.rows.length) {
      return res.status(404).json({ error: 'Integration not found' });
    }
    res.json(result.rows[0]);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.delete('/api/hr/erp-integrations/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const filter = getEntityFilter(req.userEntity, 'e');
    const result = await db.query(
      `DELETE FROM hr_erp_integrations e
       WHERE e.id = $1 AND ${filter}
       RETURNING id`,
      [id]
    );

    if (!result.rows.length) {
      return res.status(404).json({ error: 'Integration not found' });
    }
    res.json({ success: true, id: result.rows[0].id });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// HR Learning Academy API
app.get('/api/hr/learning-academy', async (req, res) => {
  try {
    const filter = getEntityFilter(req.userEntity, 'l');
    const result = await db.query(
      `SELECT l.id, l.item_name, l.item_type, l.status, l.owner,
              l.notes, l.created_at, l.updated_at
       FROM hr_learning_academy l
       WHERE ${filter}
       ORDER BY l.created_at DESC`
    );
    res.json(result.rows || []);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/hr/learning-academy', async (req, res) => {
  try {
    const {
      item_name,
      item_type,
      status,
      owner,
      notes
    } = req.body || {};

    if (!item_name || !item_type) {
      return res.status(400).json({ error: 'item_name and item_type are required' });
    }

    const result = await db.query(
      `INSERT INTO hr_learning_academy
       (item_name, item_type, status, owner, notes, entity_id, entity_type)
       VALUES ($1, $2, $3, $4, $5, $6, $7)
       RETURNING id, item_name, item_type, status, owner, notes, created_at, updated_at`,
      [
        item_name,
        item_type,
        status || 'نشط',
        owner || null,
        notes || null,
        req.userEntity.id,
        req.userEntity.type
      ]
    );

    res.status(201).json(result.rows[0]);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.put('/api/hr/learning-academy/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const {
      item_name,
      item_type,
      status,
      owner,
      notes
    } = req.body || {};
    const filter = getEntityFilter(req.userEntity, 'l');

    const result = await db.query(
      `UPDATE hr_learning_academy l
       SET item_name = COALESCE($1, l.item_name),
           item_type = COALESCE($2, l.item_type),
           status = COALESCE($3, l.status),
           owner = COALESCE($4, l.owner),
           notes = COALESCE($5, l.notes),
           updated_at = NOW()
       WHERE l.id = $6 AND ${filter}
       RETURNING id, item_name, item_type, status, owner, notes, created_at, updated_at`,
      [
        item_name || null,
        item_type || null,
        status || null,
        owner || null,
        notes || null,
        id
      ]
    );

    if (!result.rows.length) {
      return res.status(404).json({ error: 'Learning item not found' });
    }
    res.json(result.rows[0]);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.delete('/api/hr/learning-academy/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const filter = getEntityFilter(req.userEntity, 'l');
    const result = await db.query(
      `DELETE FROM hr_learning_academy l
       WHERE l.id = $1 AND ${filter}
       RETURNING id`,
      [id]
    );

    if (!result.rows.length) {
      return res.status(404).json({ error: 'Learning item not found' });
    }
    res.json({ success: true, id: result.rows[0].id });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Facilities Projects Contracts API
app.get('/api/facilities/contracts', async (req, res) => {
  try {
    const filter = getEntityFilter(req.userEntity, 'c');
    const result = await db.query(
      `SELECT c.id, c.contract_name, c.partner, c.expiry, c.value_text, c.status, c.sla_percent, c.risk_level, c.notes, c.created_at, c.updated_at
       FROM facilities_project_contracts c
       WHERE ${filter}
       ORDER BY c.created_at DESC`
    );
    res.json(result.rows || []);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/facilities/contracts', async (req, res) => {
  try {
    const { contract_name, partner, expiry, value_text, status, sla_percent, risk_level, notes } = req.body || {};
    if (!contract_name || !partner) {
      return res.status(400).json({ error: 'contract_name and partner are required' });
    }

    const result = await db.query(
      `INSERT INTO facilities_project_contracts
       (contract_name, partner, expiry, value_text, status, sla_percent, risk_level, notes, entity_id, entity_type)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
      RETURNING id, contract_name, partner, expiry, value_text, status, sla_percent, risk_level, notes, created_at, updated_at`,
      [
        contract_name,
        partner,
        expiry || null,
        value_text || null,
        status || 'قيد المراجعة',
        sla_percent || null,
        risk_level || 'متوسط',
        notes || null,
        req.userEntity.id,
        req.userEntity.type
      ]
    );
    res.status(201).json(result.rows[0]);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.put('/api/facilities/contracts/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { contract_name, partner, expiry, value_text, status, sla_percent, risk_level, notes } = req.body || {};
    const filter = getEntityFilter(req.userEntity, 'c');
    const result = await db.query(
      `UPDATE facilities_project_contracts c
       SET contract_name = COALESCE($1, c.contract_name),
           partner = COALESCE($2, c.partner),
           expiry = COALESCE($3, c.expiry),
           value_text = COALESCE($4, c.value_text),
           status = COALESCE($5, c.status),
           sla_percent = COALESCE($6, c.sla_percent),
           risk_level = COALESCE($7, c.risk_level),
           notes = COALESCE($8, c.notes),
           updated_at = NOW()
       WHERE c.id = $9 AND ${filter}
      RETURNING id, contract_name, partner, expiry, value_text, status, sla_percent, risk_level, notes, created_at, updated_at`,
      [
        contract_name || null,
        partner || null,
        expiry || null,
        value_text || null,
        status || null,
        sla_percent || null,
        risk_level || null,
        notes || null,
        id
      ]
    );

    if (!result.rows.length) {
      return res.status(404).json({ error: 'Contract not found' });
    }
    res.json(result.rows[0]);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.delete('/api/facilities/contracts/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const filter = getEntityFilter(req.userEntity, 'c');
    const result = await db.query(
      `DELETE FROM facilities_project_contracts c
       WHERE c.id = $1 AND ${filter}
       RETURNING id`,
      [id]
    );

    if (!result.rows.length) {
      return res.status(404).json({ error: 'Contract not found' });
    }
    res.json({ success: true, id: result.rows[0].id });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.get('/api/facilities/contract-logs', async (req, res) => {
  try {
    const { contract_id } = req.query;
    const filter = getEntityFilter(req.userEntity, 'l');
    const params = [];
    let whereClause = `WHERE ${filter}`;

    if (contract_id) {
      params.push(contract_id);
      whereClause += ` AND l.contract_id = $${params.length}`;
    }

    const result = await db.query(
      `SELECT l.id, l.contract_id, l.action, l.user_name, l.note, l.status, l.created_at
       FROM facilities_contract_logs l
       ${whereClause}
       ORDER BY l.created_at DESC`,
      params
    );
    res.json(result.rows || []);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/facilities/contract-logs', async (req, res) => {
  try {
    const { contract_id, action, user_name, note, status } = req.body || {};

    if (!contract_id || !action) {
      return res.status(400).json({ error: 'contract_id and action are required' });
    }

    const result = await db.query(
      `INSERT INTO facilities_contract_logs
       (contract_id, action, user_name, note, status, entity_id, entity_type)
       VALUES ($1, $2, $3, $4, $5, $6, $7)
       RETURNING id, contract_id, action, user_name, note, status, created_at`,
      [
        contract_id,
        action,
        user_name || 'مسؤول العقود',
        note || '',
        status || 'تم التسجيل',
        req.userEntity.id,
        req.userEntity.type
      ]
    );

    res.status(201).json(result.rows[0]);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.put('/api/facilities/contract-logs/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { action, user_name, note, status } = req.body || {};
    const filter = getEntityFilter(req.userEntity, 'l');

    const result = await db.query(
      `UPDATE facilities_contract_logs l
       SET action = COALESCE($1, l.action),
           user_name = COALESCE($2, l.user_name),
           note = COALESCE($3, l.note),
           status = COALESCE($4, l.status)
       WHERE l.id = $5 AND ${filter}
       RETURNING id, contract_id, action, user_name, note, status, created_at`,
      [
        action || null,
        user_name || null,
        note || null,
        status || null,
        id
      ]
    );

    if (!result.rows.length) {
      return res.status(404).json({ error: 'Log not found' });
    }

    res.json(result.rows[0]);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.delete('/api/facilities/contract-logs/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const filter = getEntityFilter(req.userEntity, 'l');

    const result = await db.query(
      `DELETE FROM facilities_contract_logs l
       WHERE l.id = $1 AND ${filter}
       RETURNING id`,
      [id]
    );

    if (!result.rows.length) {
      return res.status(404).json({ error: 'Log not found' });
    }

    res.json({ success: true, id: result.rows[0].id });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Get all entities
app.get('/api/entities', async (req, res) => {
  try {
    const entityContext = getRequestEntityContext(req);

    if (!isHqEntityContext(req)) {
      const result = await db.query(
        'SELECT * FROM entities WHERE id = $1 ORDER BY created_at DESC',
        [entityContext.id]
      );
      return res.json(result.rows);
    }

    // PERFORMANCE OPTIMIZATION: Support query parameters for filtering and limiting
    const { types, limit, offset } = req.query;
    
    let query = 'SELECT * FROM entities WHERE 1=1';
    const values = [];
    let paramIndex = 1;
    
    // Filter by entity types (comma-separated)
    if (types) {
      const typeArray = types.split(',').map(t => t.trim());
      query += ` AND type = ANY($${paramIndex})`;
      values.push(typeArray);
      paramIndex++;
    }
    
    query += ' ORDER BY created_at DESC';
    
    // Apply limit
    if (limit) {
      query += ` LIMIT $${paramIndex}`;
      values.push(parseInt(limit));
      paramIndex++;
    }
    
    // Apply offset for pagination
    if (offset) {
      query += ` OFFSET $${paramIndex}`;
      values.push(parseInt(offset));
      paramIndex++;
    }
    
    const result = await db.query(query, values);
    console.log(`📊 [/api/entities] Returned ${result.rows.length} entities (filters: ${types || 'none'}, limit: ${limit || 'none'})`);
    res.json(result.rows);
  } catch (error) {
    console.error('❌ [/api/entities] Error:', error);
    res.status(500).json({ error: error.message });
  }
});

// Get entity by ID
app.get('/api/entities/:id', async (req, res) => {
  try {
    const { id } = req.params;
    if (!isCurrentEntityScope(req, id)) {
      return res.status(404).json({ error: 'Entity not found' });
    }
    const result = await db.query('SELECT * FROM entities WHERE id = $1', [id]);
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Entity not found' });
    }
    res.json(result.rows[0]);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Create new entity
app.post('/api/entities', async (req, res) => {
  try {
    const { id, name, type, location, status = 'Active' } = req.body;
    
    if (!id || !name || !type) {
      return res.status(400).json({ error: 'Missing required fields: id, name, type' });
    }
    
    const query = `
      INSERT INTO entities (id, name, type, location, status, created_at)
      VALUES ($1, $2, $3, $4, $5, NOW())
      RETURNING *
    `;
    
    const result = await db.query(query, [id, name, type, location || '', status]);
    res.status(201).json(result.rows[0]);
  } catch (error) {
    console.error('Error creating entity:', error);
    res.status(500).json({ error: error.message });
  }
});

// Update entity
app.put('/api/entities/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { name, location, status } = req.body;
    
    const updates = [];
    const values = [];
    let paramIndex = 1;
    
    if (name !== undefined) {
      updates.push(`name = $${paramIndex}`);
      values.push(name);
      paramIndex++;
    }
    
    if (location !== undefined) {
      updates.push(`location = $${paramIndex}`);
      values.push(location);
      paramIndex++;
    }
    
    if (status !== undefined) {
      updates.push(`status = $${paramIndex}`);
      values.push(status);
      paramIndex++;
    }
    
    if (updates.length === 0) {
      return res.status(400).json({ error: 'No fields to update' });
    }
    
    values.push(id);
    const query = `
      UPDATE entities 
      SET ${updates.join(', ')}
      WHERE id = $${paramIndex}
      RETURNING *
    `;
    
    const result = await db.query(query, values);
    
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Entity not found' });
    }
    
    res.json(result.rows[0]);
  } catch (error) {
    console.error('Error updating entity:', error);
    res.status(500).json({ error: error.message });
  }
});

// Delete entity
app.delete('/api/entities/:id', async (req, res) => {
  try {
    const { id } = req.params;
    
    // Check if entity exists
    const checkResult = await db.query('SELECT * FROM entities WHERE id = $1', [id]);
    if (checkResult.rows.length === 0) {
      return res.status(404).json({ error: 'Entity not found' });
    }
    
    // Delete entity
    const deleteQuery = 'DELETE FROM entities WHERE id = $1 RETURNING *';
    const result = await db.query(deleteQuery, [id]);
    
    res.json({ 
      message: 'Entity deleted successfully',
      entity: result.rows[0]
    });
  } catch (error) {
    console.error('Error deleting entity:', error);
    res.status(500).json({ error: error.message });
  }
});

// Get all users with data isolation
app.get('/api/users', async (req, res) => {
  try {
    const isHQ = req.userEntity.type === 'HQ';
    const whereClause = isHQ ? '1=1' : 'u.entity_id = $1';
    const params = isHQ ? [] : [req.userEntity.id];

    const query = `
      SELECT u.*, 
        COALESCE(e.name, 'غير محدد') as entity_name
      FROM users u
      LEFT JOIN entities e ON u.entity_id = e.id
      WHERE ${whereClause}
      ORDER BY u.created_at DESC
    `;
    
    const result = await db.query(query, params);
    res.json(result.rows);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Get user by ID
app.get('/api/users/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const params = [id];
    let query = `
      SELECT u.*, COALESCE(e.name, u.entity_name, 'غير محدد') AS entity_name
      FROM users u
      LEFT JOIN entities e ON u.entity_id = e.id
      WHERE u.id = $1
    `;

    if (!isHqEntityContext(req)) {
      params.push(getRequestEntityContext(req).id);
      query += ` AND u.entity_id = $2`;
    }

    const result = await db.query(query, params);
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'User not found' });
    }
    res.json(result.rows[0]);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Create new invoice
app.post('/api/invoices', async (req, res) => {
  try {
    const {
      id,
      entityId,
      type,
      title,
      amount,
      paidAmount,
      status,
      date,
      dueDate,
      customerName,
      customerNumber,
      customerPhone,
      customerEmail,
      paymentMethod
    } = req.body;

    // Validate required fields
    if (!id || !entityId || !type || !title || !amount || !date || !dueDate) {
      return res.status(400).json({ error: 'الرجاء تعبئة جميع الحقول المطلوبة' });
    }

    // Check permissions - only HQ or the entity itself can create invoice
    if (req.userEntity.type !== 'HQ' && entityId !== req.userEntity.id) {
      return res.status(403).json({ error: 'ليس لديك صلاحيات لإنشاء فاتورة لهذا الكيان' });
    }

    // Insert invoice
    const query = `
      INSERT INTO invoices (
        id, entity_id, type, title, amount, paid_amount, status,
        issue_date, due_date, customer_name, customer_number,
        customer_phone, customer_email, payment_method
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14)
      RETURNING *
    `;
    
    const values = [
      id,
      entityId,
      type,
      title,
      amount,
      paidAmount || 0,
      status || 'UNPAID',
      date,
      dueDate,
      customerName || null,
      customerNumber || null,
      customerPhone || null,
      customerEmail || null,
      paymentMethod || null
    ];

    const result = await db.query(query, values);
    res.json({ success: true, invoice: result.rows[0] });
  } catch (error) {
    console.error('Error creating invoice:', error);
    res.status(500).json({ error: error.message });
  }
});

// Get all invoices with data isolation
app.get('/api/invoices', async (req, res) => {
  try {
    const { entity_id, status } = req.query;
    let query = 'SELECT * FROM invoices WHERE 1=1';
    let params = [];
    let paramIndex = 1;
    
    // Apply user's entity filter
    if (req.userEntity.type === 'HQ') {
      // HQ sees all invoices
    } else if (req.userEntity.type === 'BRANCH') {
      query += ` AND entity_id = $${paramIndex}`;
      params.push(req.userEntity.id);
      paramIndex++;
    } else if (req.userEntity.type === 'INCUBATOR') {
      query += ` AND entity_id = $${paramIndex}`;
      params.push(req.userEntity.id);
      paramIndex++;
    } else if (req.userEntity.type === 'PLATFORM') {
      query += ` AND entity_id = $${paramIndex}`;
      params.push(req.userEntity.id);
      paramIndex++;
    } else if (req.userEntity.type === 'OFFICE') {
      query += ` AND entity_id = $${paramIndex}`;
      params.push(req.userEntity.id);
      paramIndex++;
    }
    
    // Additional filters
    if (entity_id) {
      query += ` AND entity_id = $${paramIndex}`;
      params.push(entity_id);
      paramIndex++;
    }
    
    if (status) {
      query += ` AND status = $${paramIndex}`;
      params.push(status);
      paramIndex++;
    }
    
    query += ' ORDER BY created_at DESC';
    const result = await db.query(query, params);
    res.json(result.rows);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Delete invoice
app.delete('/api/invoices/:id', async (req, res) => {
  try {
    const { id } = req.params;
    
    // First check if invoice exists and user has permission
    const checkQuery = 'SELECT * FROM invoices WHERE id = $1';
    const checkResult = await db.query(checkQuery, [id]);
    
    if (checkResult.rows.length === 0) {
      return res.status(404).json({ error: 'الفاتورة غير موجودة' });
    }
    
    const invoice = checkResult.rows[0];
    
    // Check permissions - only HQ or the entity that created it can delete
    if (req.userEntity.type !== 'HQ' && invoice.entity_id !== req.userEntity.id) {
      return res.status(403).json({ error: 'ليس لديك صلاحيات لحذف هذه الفاتورة' });
    }
    
    // Delete the invoice
    const deleteQuery = 'DELETE FROM invoices WHERE id = $1 RETURNING *';
    const result = await db.query(deleteQuery, [id]);
    
    res.json({ 
      message: 'تم حذف الفاتورة بنجاح',
      invoice: result.rows[0]
    });
  } catch (error) {
    console.error('Error deleting invoice:', error);
    res.status(500).json({ error: error.message });
  }
});

// ========================================
// EMPLOYEE REQUESTS APIs
// ========================================

// Get all employee requests with data isolation
app.get('/api/employee-requests', async (req, res) => {
  try {
    if (isTenantHostRequest(req)) {
      const tenantSessionUser = await requireTenantSessionUser(req, res);
      if (!tenantSessionUser) return;
      await ensureTenantEmployeeRequestsTable(req.tenantPool);

      const { status, request_type, employee_id } = req.query;
      let query = 'SELECT * FROM employee_requests WHERE 1=1';
      const params = [];
      let paramIndex = 1;

      if (status) {
        query += ` AND status = $${paramIndex++}`;
        params.push(status);
      }

      if (request_type) {
        query += ` AND request_type = $${paramIndex++}`;
        params.push(request_type);
      }

      if (employee_id) {
        query += ` AND employee_id = $${paramIndex++}`;
        params.push(employee_id);
      }

      query += ' ORDER BY created_at DESC';
      const tenantResult = await req.tenantPool.query(query, params);
      return res.json(tenantResult.rows);
    }

    const { status, request_type, employee_id } = req.query;
    let query = 'SELECT * FROM employee_requests WHERE 1=1';
    let params = [];
    let paramIndex = 1;
    
    // Apply user's entity filter
    if (req.userEntity.type !== 'HQ') {
      query += ` AND entity_id = $${paramIndex}`;
      params.push(req.userEntity.id);
      paramIndex++;
    }
    
    // Additional filters
    if (status) {
      query += ` AND status = $${paramIndex}`;
      params.push(status);
      paramIndex++;
    }
    
    if (request_type) {
      query += ` AND request_type = $${paramIndex}`;
      params.push(request_type);
      paramIndex++;
    }
    
    if (employee_id) {
      query += ` AND employee_id = $${paramIndex}`;
      params.push(employee_id);
      paramIndex++;
    }
    
    query += ' ORDER BY created_at DESC';
    const result = await db.query(query, params);
    res.json(result.rows);
  } catch (error) {
    console.error('Error fetching employee requests:', error);
    res.status(500).json({ error: error.message });
  }
});

// Create new employee request
app.post('/api/employee-requests', async (req, res) => {
  try {
    const {
      id,
      entityId,
      employeeId,
      employeeName,
      requestType,
      requestTitle,
      description,
      status,
      priority,
      requestData,
      requiresApproval,
      requestedDate,
      startDate,
      endDate,
      notes,
      createdBy
    } = req.body;

    // Validate required fields
    if (isTenantHostRequest(req)) {
      const tenantSessionUser = await requireTenantSessionUser(req, res);
      if (!tenantSessionUser) return;
      await ensureTenantEmployeeRequestsTable(req.tenantPool);

      const tenantEntityId = getTenantHostEntityId(req);
      const owningEntityId = tenantEntityId;

      if (!id || !employeeName || !requestType || !requestTitle || !requestedDate) {
        return res.status(400).json({ error: 'الرجاء تعبئة جميع الحقول المطلوبة' });
      }

      const tenantInsertQuery = `
        INSERT INTO employee_requests (
          id, entity_id, employee_id, employee_name, request_type, request_title,
          description, status, priority, request_data, requires_approval,
          requested_date, start_date, end_date, notes, created_by
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16)
        RETURNING *
      `;

      const tenantValues = [
        id,
        owningEntityId,
        employeeId || null,
        employeeName,
        requestType,
        requestTitle,
        description || null,
        status || 'PENDING',
        priority || 'NORMAL',
        requestData ? JSON.stringify(requestData) : null,
        requiresApproval !== undefined ? requiresApproval : true,
        requestedDate,
        startDate || null,
        endDate || null,
        notes || null,
        createdBy || null
      ];

      const tenantResult = await req.tenantPool.query(tenantInsertQuery, tenantValues);
      return res.json({ success: true, request: tenantResult.rows[0] });
    }

    const owningEntityId = isHqEntityContext(req) ? entityId : getRequestEntityContext(req).id;

    if (!id || !owningEntityId || !employeeName || !requestType || !requestTitle || !requestedDate) {
      return res.status(400).json({ error: 'الرجاء تعبئة جميع الحقول المطلوبة' });
    }

    // Insert request
    const query = `
      INSERT INTO employee_requests (
        id, entity_id, employee_id, employee_name, request_type, request_title,
        description, status, priority, request_data, requires_approval,
        requested_date, start_date, end_date, notes, created_by
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16)
      RETURNING *
    `;
    
    const values = [
      id,
      owningEntityId,
      employeeId || null,
      employeeName,
      requestType,
      requestTitle,
      description || null,
      status || 'PENDING',
      priority || 'NORMAL',
      requestData ? JSON.stringify(requestData) : null,
      requiresApproval !== undefined ? requiresApproval : true,
      requestedDate,
      startDate || null,
      endDate || null,
      notes || null,
      createdBy || null
    ];

    const result = await db.query(query, values);
    res.json({ success: true, request: result.rows[0] });
  } catch (error) {
    console.error('Error creating employee request:', error);
    res.status(500).json({ error: error.message });
  }
});

// Update employee request status
app.put('/api/employee-requests/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const {
      status,
      approverName,
      approvalNotes,
      completionDate,
      requestTitle,
      description,
      priority,
      requestData,
      requiresApproval,
      requestedDate,
      startDate,
      endDate,
      notes,
      employeeName,
      employeeId,
      requestType,
      entityId
    } = req.body;

    if (isTenantHostRequest(req)) {
      const tenantSessionUser = await requireTenantSessionUser(req, res);
      if (!tenantSessionUser) return;
      await ensureTenantEmployeeRequestsTable(req.tenantPool);

      const tenantResult = await req.tenantPool.query(`
        UPDATE employee_requests
        SET request_title = COALESCE($1, request_title),
            description = COALESCE($2, description),
            status = COALESCE($3, status),
            priority = COALESCE($4, priority),
            request_data = COALESCE($5, request_data),
            requires_approval = COALESCE($6, requires_approval),
            requested_date = COALESCE($7, requested_date),
            start_date = COALESCE($8, start_date),
            end_date = COALESCE($9, end_date),
            notes = COALESCE($10, notes),
            approver_name = COALESCE($11, approver_name),
            approval_date = CASE WHEN $3 IN ('APPROVED', 'REJECTED') THEN CURRENT_TIMESTAMP ELSE approval_date END,
            approval_notes = COALESCE($12, approval_notes),
            completion_date = COALESCE($13, completion_date),
            employee_name = COALESCE($14, employee_name),
            employee_id = COALESCE($15, employee_id),
            request_type = COALESCE($16, request_type),
            entity_id = COALESCE($17, entity_id),
            updated_at = CURRENT_TIMESTAMP
        WHERE id = $18
        RETURNING *
      `, [
        requestTitle,
        description,
        status,
        priority,
        requestData ? JSON.stringify(requestData) : null,
        requiresApproval,
        requestedDate,
        startDate,
        endDate,
        notes,
        approverName,
        approvalNotes,
        completionDate,
        employeeName,
        employeeId,
        requestType,
        getTenantHostEntityId(req),
        id
      ]);

      if (tenantResult.rows.length === 0) {
        return res.status(404).json({ error: 'الطلب غير موجود' });
      }

      return res.json({ success: true, request: tenantResult.rows[0] });
    }

    if (!isHqEntityContext(req)) {
      const scopeCheck = await db.query(
        `SELECT id FROM employee_requests WHERE id = $1 AND entity_id = $2 LIMIT 1`,
        [id, getRequestEntityContext(req).id]
      );
      if (scopeCheck.rows.length === 0) {
        return res.status(404).json({ error: 'الطلب غير موجود' });
      }
    }

    const query = `
      UPDATE employee_requests 
      SET request_title = COALESCE($1, request_title),
          description = COALESCE($2, description),
          status = COALESCE($3, status),
          priority = COALESCE($4, priority),
          request_data = COALESCE($5, request_data),
          requires_approval = COALESCE($6, requires_approval),
          requested_date = COALESCE($7, requested_date),
          start_date = COALESCE($8, start_date),
          end_date = COALESCE($9, end_date),
          notes = COALESCE($10, notes),
          approver_name = COALESCE($11, approver_name),
          approval_date = CASE WHEN $3 IN ('APPROVED', 'REJECTED') THEN CURRENT_TIMESTAMP ELSE approval_date END,
          approval_notes = COALESCE($12, approval_notes),
          completion_date = COALESCE($13, completion_date),
          employee_name = COALESCE($14, employee_name),
          employee_id = COALESCE($15, employee_id),
          request_type = COALESCE($16, request_type),
          entity_id = COALESCE($17, entity_id),
          updated_at = CURRENT_TIMESTAMP
      WHERE id = $18
      RETURNING *
    `;
    
    const result = await db.query(query, [
      requestTitle,
      description,
      status,
      priority,
      requestData ? JSON.stringify(requestData) : null,
      requiresApproval,
      requestedDate,
      startDate,
      endDate,
      notes,
      approverName,
      approvalNotes,
      completionDate,
      employeeName,
      employeeId,
      requestType,
      isHqEntityContext(req) ? entityId : getRequestEntityContext(req).id,
      id
    ]);
    
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'الطلب غير موجود' });
    }
    
    res.json({ success: true, request: result.rows[0] });
  } catch (error) {
    console.error('Error updating employee request:', error);
    res.status(500).json({ error: error.message });
  }
});

// Delete employee request
app.delete('/api/employee-requests/:id', async (req, res) => {
  try {
    const { id } = req.params;

    if (isTenantHostRequest(req)) {
      const tenantSessionUser = await requireTenantSessionUser(req, res);
      if (!tenantSessionUser) return;
      await ensureTenantEmployeeRequestsTable(req.tenantPool);
      const tenantResult = await req.tenantPool.query(
        'DELETE FROM employee_requests WHERE id = $1 RETURNING *',
        [id]
      );

      if (tenantResult.rows.length === 0) {
        return res.status(404).json({ error: 'الطلب غير موجود' });
      }

      return res.json({ success: true, message: 'تم حذف الطلب بنجاح' });
    }

    const params = [id];
    let query = 'DELETE FROM employee_requests WHERE id = $1';

    if (!isHqEntityContext(req)) {
      params.push(getRequestEntityContext(req).id);
      query += ' AND entity_id = $2';
    }

    query += ' RETURNING *';

    const result = await db.query(query, params);
    
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'الطلب غير موجود' });
    }
    
    res.json({ success: true, message: 'تم حذف الطلب بنجاح' });
  } catch (error) {
    console.error('Error deleting employee request:', error);
    res.status(500).json({ error: error.message });
  }
});

// ========================================
// REQUEST TYPES APIs (إدارة أنواع الطلبات)
// ========================================

// ========================================
// TERMS & CONDITIONS APIs (الشروط والأحكام)
// ========================================

// Get all terms sections
app.get('/api/terms-sections', async (req, res) => {
  try {
    const includeRules = req.query.include_rules === 'true';
    const includeInactive = req.query.include_inactive === 'true';
    let sectionQuery = 'SELECT * FROM terms_sections';

    if (!includeInactive) {
      sectionQuery += ' WHERE is_active = true';
    }

    sectionQuery += ' ORDER BY display_order, id';
    const sections = (await db.query(sectionQuery)).rows;

    if (!includeRules || sections.length === 0) {
      return res.json({ success: true, sections });
    }

    const sectionIds = sections.map((section) => section.id);
    const placeholders = sectionIds.map((_, idx) => `$${idx + 1}`).join(', ');
    let rulesQuery = `SELECT * FROM terms_rules WHERE section_id IN (${placeholders})`;

    if (!includeInactive) {
      rulesQuery += ' AND is_active = true';
    }

    rulesQuery += ' ORDER BY display_order, id';
    const rules = (await db.query(rulesQuery, sectionIds)).rows;
    const rulesBySection = new Map();

    rules.forEach((rule) => {
      const list = rulesBySection.get(rule.section_id) || [];
      list.push(rule);
      rulesBySection.set(rule.section_id, list);
    });

    const hydrated = sections.map((section) => ({
      ...section,
      rules: rulesBySection.get(section.id) || []
    }));

    res.json({ success: true, sections: hydrated });
  } catch (error) {
    console.error('Error fetching terms sections:', error);
    res.status(500).json({ error: error.message });
  }
});

// Get single terms section
app.get('/api/terms-sections/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const result = await db.query('SELECT * FROM terms_sections WHERE id = $1', [id]);

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'البند غير موجود' });
    }

    res.json({ success: true, section: result.rows[0] });
  } catch (error) {
    console.error('Error fetching terms section:', error);
    res.status(500).json({ error: error.message });
  }
});

// Create new terms section
app.post('/api/terms-sections', async (req, res) => {
  try {
    const { title, description, is_active, display_order } = req.body;

    if (!title) {
      return res.status(400).json({ error: 'عنوان البند مطلوب' });
    }

    const result = await db.query(
      `INSERT INTO terms_sections (title, description, is_active, display_order)
       VALUES ($1, $2, $3, $4)
       RETURNING *`,
      [title, description || null, is_active !== undefined ? is_active : true, display_order || 0]
    );

    res.status(201).json({ success: true, section: result.rows[0] });
  } catch (error) {
    console.error('Error creating terms section:', error);
    res.status(500).json({ error: error.message });
  }
});

// Update terms section
app.put('/api/terms-sections/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { title, description, is_active, display_order } = req.body;

    const result = await db.query(
      `UPDATE terms_sections
       SET title = COALESCE($1, title),
           description = COALESCE($2, description),
           is_active = COALESCE($3, is_active),
           display_order = COALESCE($4, display_order),
           updated_at = CURRENT_TIMESTAMP
       WHERE id = $5
       RETURNING *`,
      [title, description, is_active, display_order, id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'البند غير موجود' });
    }

    res.json({ success: true, section: result.rows[0] });
  } catch (error) {
    console.error('Error updating terms section:', error);
    res.status(500).json({ error: error.message });
  }
});

// Delete terms section
app.delete('/api/terms-sections/:id', async (req, res) => {
  try {
    const { id } = req.params;

    const result = await db.query(
      'DELETE FROM terms_sections WHERE id = $1 RETURNING *',
      [id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'البند غير موجود' });
    }

    res.json({ success: true, message: 'تم حذف البند بنجاح' });
  } catch (error) {
    console.error('Error deleting terms section:', error);
    res.status(500).json({ error: error.message });
  }
});

// Toggle terms section active status
app.patch('/api/terms-sections/:id/toggle-active', async (req, res) => {
  try {
    const { id } = req.params;
    const result = await db.query(
      'UPDATE terms_sections SET is_active = NOT is_active, updated_at = CURRENT_TIMESTAMP WHERE id = $1 RETURNING *',
      [id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'البند غير موجود' });
    }

    res.json({ success: true, section: result.rows[0] });
  } catch (error) {
    console.error('Error toggling terms section status:', error);
    res.status(500).json({ error: error.message });
  }
});

// Get all terms rules
app.get('/api/terms-rules', async (req, res) => {
  try {
    const { section_id } = req.query;
    const includeInactive = req.query.include_inactive === 'true';
    let query = 'SELECT * FROM terms_rules WHERE 1=1';
    const params = [];

    if (section_id) {
      params.push(section_id);
      query += ` AND section_id = $${params.length}`;
    }

    if (!includeInactive) {
      query += ' AND is_active = true';
    }

    query += ' ORDER BY display_order, id';
    const result = await db.query(query, params);
    res.json({ success: true, rules: result.rows });
  } catch (error) {
    console.error('Error fetching terms rules:', error);
    res.status(500).json({ error: error.message });
  }
});

// Get single terms rule
app.get('/api/terms-rules/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const result = await db.query('SELECT * FROM terms_rules WHERE id = $1', [id]);

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'الحكم غير موجود' });
    }

    res.json({ success: true, rule: result.rows[0] });
  } catch (error) {
    console.error('Error fetching terms rule:', error);
    res.status(500).json({ error: error.message });
  }
});

// Create new terms rule
app.post('/api/terms-rules', async (req, res) => {
  try {
    const { section_id, rule_text, is_active, display_order } = req.body;

    if (!section_id || !rule_text) {
      return res.status(400).json({ error: 'نص الحكم والبند التابع له مطلوبان' });
    }

    const sectionResult = await db.query('SELECT id FROM terms_sections WHERE id = $1', [section_id]);
    if (sectionResult.rows.length === 0) {
      return res.status(404).json({ error: 'البند المحدد غير موجود' });
    }

    const result = await db.query(
      `INSERT INTO terms_rules (section_id, rule_text, is_active, display_order)
       VALUES ($1, $2, $3, $4)
       RETURNING *`,
      [section_id, rule_text, is_active !== undefined ? is_active : true, display_order || 0]
    );

    res.status(201).json({ success: true, rule: result.rows[0] });
  } catch (error) {
    console.error('Error creating terms rule:', error);
    res.status(500).json({ error: error.message });
  }
});

// Update terms rule
app.put('/api/terms-rules/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { section_id, rule_text, is_active, display_order } = req.body;

    if (section_id) {
      const sectionResult = await db.query('SELECT id FROM terms_sections WHERE id = $1', [section_id]);
      if (sectionResult.rows.length === 0) {
        return res.status(404).json({ error: 'البند المحدد غير موجود' });
      }
    }

    const result = await db.query(
      `UPDATE terms_rules
       SET section_id = COALESCE($1, section_id),
           rule_text = COALESCE($2, rule_text),
           is_active = COALESCE($3, is_active),
           display_order = COALESCE($4, display_order),
           updated_at = CURRENT_TIMESTAMP
       WHERE id = $5
       RETURNING *`,
      [section_id, rule_text, is_active, display_order, id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'الحكم غير موجود' });
    }

    res.json({ success: true, rule: result.rows[0] });
  } catch (error) {
    console.error('Error updating terms rule:', error);
    res.status(500).json({ error: error.message });
  }
});

// Delete terms rule
app.delete('/api/terms-rules/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const result = await db.query('DELETE FROM terms_rules WHERE id = $1 RETURNING *', [id]);

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'الحكم غير موجود' });
    }

    res.json({ success: true, message: 'تم حذف الحكم بنجاح' });
  } catch (error) {
    console.error('Error deleting terms rule:', error);
    res.status(500).json({ error: error.message });
  }
});

// Toggle terms rule active status
app.patch('/api/terms-rules/:id/toggle-active', async (req, res) => {
  try {
    const { id } = req.params;
    const result = await db.query(
      'UPDATE terms_rules SET is_active = NOT is_active, updated_at = CURRENT_TIMESTAMP WHERE id = $1 RETURNING *',
      [id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'الحكم غير موجود' });
    }

    res.json({ success: true, rule: result.rows[0] });
  } catch (error) {
    console.error('Error toggling terms rule status:', error);
    res.status(500).json({ error: error.message });
  }
});

// ========================================
// OPERATIONAL POLICIES APIs
// ========================================

const slugifyPolicy = (value) => {
  const slugBase = (value || '').toString().trim().toLowerCase();
  const slug = slugBase
    .replace(/[^\w\u0600-\u06FF]+/g, '-')
    .replace(/--+/g, '-')
    .replace(/(^-|-$)/g, '');
  return slug || `policy-${Date.now()}`;
};

app.get('/api/operational-policies', async (req, res) => {
  try {
    const policies = (await db.query(
      `SELECT * FROM operational_policies
       ORDER BY issue_date DESC NULLS LAST, id DESC`
    )).rows;

    if (!policies.length) {
      return res.json({ success: true, policies: [] });
    }

    const ids = policies.map((policy) => policy.id);
    const placeholders = ids.map((_, idx) => `$${idx + 1}`).join(', ');
    const updates = (await db.query(
      `SELECT * FROM operational_policy_updates
       WHERE policy_id IN (${placeholders})
       ORDER BY update_date DESC NULLS LAST, id DESC`,
      ids
    )).rows;

    const updatesByPolicy = new Map();
    updates.forEach((update) => {
      const list = updatesByPolicy.get(update.policy_id) || [];
      list.push(update);
      updatesByPolicy.set(update.policy_id, list);
    });

    const hydrated = policies.map((policy) => ({
      ...policy,
      updates: updatesByPolicy.get(policy.id) || []
    }));

    res.json({ success: true, policies: hydrated });
  } catch (error) {
    console.error('Error fetching operational policies:', error);
    res.status(500).json({ error: error.message });
  }
});

app.get('/api/operational-policies/:slug', async (req, res) => {
  try {
    const { slug } = req.params;
    const policyResult = await db.query(
      'SELECT * FROM operational_policies WHERE slug = $1 OR id::text = $1',
      [slug]
    );

    if (!policyResult.rows.length) {
      return res.status(404).json({ error: 'Policy not found' });
    }

    const policy = policyResult.rows[0];
    const updates = (await db.query(
      `SELECT * FROM operational_policy_updates
       WHERE policy_id = $1
       ORDER BY update_date DESC NULLS LAST, id DESC`,
      [policy.id]
    )).rows;

    res.json({ success: true, policy: { ...policy, updates } });
  } catch (error) {
    console.error('Error fetching operational policy:', error);
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/operational-policies', async (req, res) => {
  try {
    const {
      slug,
      title,
      authority,
      category,
      system_key,
      issue_date,
      version,
      reference,
      status,
      review_date,
      full_text,
      download_url
    } = req.body || {};

    if (!title || !authority || !category) {
      return res.status(400).json({ error: 'title, authority, and category are required' });
    }

    const finalSlug = slugifyPolicy(slug || title);
    const result = await db.query(
      `INSERT INTO operational_policies
        (slug, title, authority, category, system_key, issue_date, version, reference, status, review_date, full_text, download_url)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
       RETURNING *`,
      [
        finalSlug,
        title,
        authority,
        category,
        system_key || 'ADMIN',
        issue_date || null,
        version || null,
        reference || null,
        status || 'سارية',
        review_date || null,
        full_text || null,
        download_url || null
      ]
    );

    res.status(201).json({ success: true, policy: result.rows[0] });
  } catch (error) {
    console.error('Error creating operational policy:', error);
    res.status(500).json({ error: error.message });
  }
});

app.put('/api/operational-policies/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const {
      slug,
      title,
      authority,
      category,
      system_key,
      issue_date,
      version,
      reference,
      status,
      review_date,
      full_text,
      download_url
    } = req.body || {};

    const finalSlug = slug ? slugifyPolicy(slug) : null;
    const result = await db.query(
      `UPDATE operational_policies
       SET slug = COALESCE($1, slug),
           title = COALESCE($2, title),
           authority = COALESCE($3, authority),
           category = COALESCE($4, category),
           system_key = COALESCE($5, system_key),
           issue_date = COALESCE($6, issue_date),
           version = COALESCE($7, version),
           reference = COALESCE($8, reference),
           status = COALESCE($9, status),
           review_date = COALESCE($10, review_date),
           full_text = COALESCE($11, full_text),
           download_url = COALESCE($12, download_url),
           updated_at = NOW()
       WHERE id = $13
       RETURNING *`,
      [
        finalSlug,
        title || null,
        authority || null,
        category || null,
        system_key || null,
        issue_date || null,
        version || null,
        reference || null,
        status || null,
        review_date || null,
        full_text || null,
        download_url || null,
        id
      ]
    );

    if (!result.rows.length) {
      return res.status(404).json({ error: 'Policy not found' });
    }

    res.json({ success: true, policy: result.rows[0] });
  } catch (error) {
    console.error('Error updating operational policy:', error);
    res.status(500).json({ error: error.message });
  }
});

app.delete('/api/operational-policies/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const result = await db.query(
      'DELETE FROM operational_policies WHERE id = $1 RETURNING id',
      [id]
    );

    if (!result.rows.length) {
      return res.status(404).json({ error: 'Policy not found' });
    }

    res.json({ success: true, id: result.rows[0].id });
  } catch (error) {
    console.error('Error deleting operational policy:', error);
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/operational-policies/:id/updates', async (req, res) => {
  try {
    const { id } = req.params;
    const { title, note, update_date } = req.body || {};

    if (!title) {
      return res.status(400).json({ error: 'title is required' });
    }

    const policyResult = await db.query('SELECT id FROM operational_policies WHERE id = $1', [id]);
    if (!policyResult.rows.length) {
      return res.status(404).json({ error: 'Policy not found' });
    }

    const result = await db.query(
      `INSERT INTO operational_policy_updates (policy_id, title, note, update_date)
       VALUES ($1, $2, $3, $4)
       RETURNING *`,
      [id, title, note || null, update_date || null]
    );

    res.status(201).json({ success: true, update: result.rows[0] });
  } catch (error) {
    console.error('Error creating operational policy update:', error);
    res.status(500).json({ error: error.message });
  }
});

app.delete('/api/operational-policies/:id/updates/:updateId', async (req, res) => {
  try {
    const { id, updateId } = req.params;
    const result = await db.query(
      'DELETE FROM operational_policy_updates WHERE id = $1 AND policy_id = $2 RETURNING id',
      [updateId, id]
    );

    if (!result.rows.length) {
      return res.status(404).json({ error: 'Update not found' });
    }

    res.json({ success: true, id: result.rows[0].id });
  } catch (error) {
    console.error('Error deleting operational policy update:', error);
    res.status(500).json({ error: error.message });
  }
});

// Get all request types
app.get('/api/request-types', async (req, res) => {
  try {
    const { is_active, category } = req.query;
    let query = 'SELECT * FROM request_types WHERE 1=1';
    let params = [];
    let paramIndex = 1;
    
    if (is_active !== undefined) {
      query += ` AND is_active = $${paramIndex}`;
      params.push(is_active === 'true');
      paramIndex++;
    }
    
    if (category) {
      query += ` AND category = $${paramIndex}`;
      params.push(category);
      paramIndex++;
    }
    
    query += ' ORDER BY display_order, type_name_ar';
    const result = await db.query(query, params);
    res.json(result.rows);
  } catch (error) {
    console.error('Error fetching request types:', error);
    res.status(500).json({ error: error.message });
  }
});

// Get single request type
app.get('/api/request-types/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const result = await db.query('SELECT * FROM request_types WHERE id = $1', [id]);
    
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'نوع الطلب غير موجود' });
    }
    
    res.json(result.rows[0]);
  } catch (error) {
    console.error('Error fetching request type:', error);
    res.status(500).json({ error: error.message });
  }
});

// Create new request type
app.post('/api/request-types', async (req, res) => {
  try {
    const {
      type_code,
      type_name_ar,
      type_name_en,
      description_ar,
      description_en,
      icon,
      color,
      category,
      is_active,
      requires_approval,
      requires_manager_approval,
      requires_hr_approval,
      approval_levels,
      form_fields,
      display_order,
      created_by
    } = req.body;

    // Validate required fields
    if (!type_code || !type_name_ar) {
      return res.status(400).json({ error: 'الرجاء تعبئة الحقول المطلوبة (الكود والاسم)' });
    }

    const query = `
      INSERT INTO request_types (
        type_code, type_name_ar, type_name_en, description_ar, description_en,
        icon, color, category, is_active, requires_approval,
        requires_manager_approval, requires_hr_approval, approval_levels,
        form_fields, display_order, created_by
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16)
      RETURNING *
    `;
    
    const values = [
      type_code,
      type_name_ar,
      type_name_en || null,
      description_ar || null,
      description_en || null,
      icon || '📄',
      color || '#ffffff',
      category || 'general',
      is_active !== undefined ? is_active : true,
      requires_approval !== undefined ? requires_approval : true,
      requires_manager_approval || false,
      requires_hr_approval || false,
      approval_levels || 1,
      form_fields ? JSON.stringify(form_fields) : null,
      display_order || 0,
      created_by || null
    ];

    const result = await db.query(query, values);
    res.status(201).json({ success: true, requestType: result.rows[0] });
  } catch (error) {
    console.error('Error creating request type:', error);
    
    // Handle unique constraint violation
    if (error.code === '23505') {
      return res.status(409).json({ error: 'كود نوع الطلب موجود مسبقاً' });
    }
    
    res.status(500).json({ error: error.message });
  }
});

// Update request type
app.put('/api/request-types/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const {
      type_code,
      type_name_ar,
      type_name_en,
      description_ar,
      description_en,
      icon,
      color,
      category,
      is_active,
      requires_approval,
      requires_manager_approval,
      requires_hr_approval,
      approval_levels,
      form_fields,
      display_order
    } = req.body;

    const query = `
      UPDATE request_types 
      SET type_code = COALESCE($1, type_code),
          type_name_ar = COALESCE($2, type_name_ar),
          type_name_en = COALESCE($3, type_name_en),
          description_ar = COALESCE($4, description_ar),
          description_en = COALESCE($5, description_en),
          icon = COALESCE($6, icon),
          color = COALESCE($7, color),
          category = COALESCE($8, category),
          is_active = COALESCE($9, is_active),
          requires_approval = COALESCE($10, requires_approval),
          requires_manager_approval = COALESCE($11, requires_manager_approval),
          requires_hr_approval = COALESCE($12, requires_hr_approval),
          approval_levels = COALESCE($13, approval_levels),
          form_fields = COALESCE($14, form_fields),
          display_order = COALESCE($15, display_order),
          updated_at = CURRENT_TIMESTAMP
      WHERE id = $16
      RETURNING *
    `;
    
    const result = await db.query(query, [
      type_code, type_name_ar, type_name_en, description_ar, description_en,
      icon, color, category, is_active, requires_approval,
      requires_manager_approval, requires_hr_approval, approval_levels,
      form_fields ? JSON.stringify(form_fields) : null,
      display_order, id
    ]);
    
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'نوع الطلب غير موجود' });
    }
    
    res.json({ success: true, requestType: result.rows[0] });
  } catch (error) {
    console.error('Error updating request type:', error);
    res.status(500).json({ error: error.message });
  }
});

// Delete request type
app.delete('/api/request-types/:id', async (req, res) => {
  try {
    const { id } = req.params;
    
    const result = await db.query(
      'DELETE FROM request_types WHERE id = $1 RETURNING *',
      [id]
    );
    
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'نوع الطلب غير موجود' });
    }
    
    res.json({ success: true, message: 'تم حذف نوع الطلب بنجاح' });
  } catch (error) {
    console.error('Error deleting request type:', error);
    res.status(500).json({ error: error.message });
  }
});

// Toggle request type active status
app.patch('/api/request-types/:id/toggle-active', async (req, res) => {
  try {
    const { id } = req.params;
    
    const result = await db.query(
      'UPDATE request_types SET is_active = NOT is_active, updated_at = CURRENT_TIMESTAMP WHERE id = $1 RETURNING *',
      [id]
    );
    
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'نوع الطلب غير موجود' });
    }
    
    res.json({ success: true, requestType: result.rows[0] });
  } catch (error) {
    console.error('Error toggling request type status:', error);
    res.status(500).json({ error: error.message });
  }
});

// ========================================
// PAYMENT METHODS APIs (إدارة طرق الدفع)
// ========================================

// Get all payment methods
app.get('/api/payment-methods', async (req, res) => {
  try {
    const { is_active } = req.query;
    let query = 'SELECT * FROM payment_methods WHERE 1=1';
    let params = [];
    
    if (is_active !== undefined) {
      query += ' AND is_active = $1';
      params.push(is_active === 'true');
    }
    
    query += ' ORDER BY display_order, method_name_ar';
    const result = await db.query(query, params);
    res.json(result.rows);
  } catch (error) {
    console.error('Error fetching payment methods:', error);
    res.status(500).json({ error: error.message });
  }
});

// Get single payment method
app.get('/api/payment-methods/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const result = await db.query('SELECT * FROM payment_methods WHERE id = $1', [id]);
    
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'طريقة الدفع غير موجودة' });
    }
    
    res.json(result.rows[0]);
  } catch (error) {
    console.error('Error fetching payment method:', error);
    res.status(500).json({ error: error.message });
  }
});

// Create new payment method
app.post('/api/payment-methods', async (req, res) => {
  try {
    const {
      method_code,
      method_name_ar,
      method_name_en,
      description_ar,
      description_en,
      icon,
      color,
      is_active,
      requires_bank_details,
      requires_card_details,
      processing_fee_percentage,
      processing_fee_fixed,
      min_amount,
      max_amount,
      display_order,
      created_by
    } = req.body;

    // Validate required fields
    if (!method_code || !method_name_ar) {
      return res.status(400).json({ error: 'الرجاء تعبئة الحقول المطلوبة (الكود والاسم)' });
    }

    const query = `
      INSERT INTO payment_methods (
        method_code, method_name_ar, method_name_en, description_ar, description_en,
        icon, color, is_active, requires_bank_details, requires_card_details,
        processing_fee_percentage, processing_fee_fixed, min_amount, max_amount,
        display_order, created_by
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16)
      RETURNING *
    `;
    
    const values = [
      method_code,
      method_name_ar,
      method_name_en || null,
      description_ar || null,
      description_en || null,
      icon || '💳',
      color || '#3b82f6',
      is_active !== undefined ? is_active : true,
      requires_bank_details || false,
      requires_card_details || false,
      processing_fee_percentage || 0,
      processing_fee_fixed || 0,
      min_amount || null,
      max_amount || null,
      display_order || 0,
      created_by || null
    ];

    const result = await db.query(query, values);
    res.status(201).json({ success: true, paymentMethod: result.rows[0] });
  } catch (error) {
    console.error('Error creating payment method:', error);
    
    // Handle unique constraint violation
    if (error.code === '23505') {
      return res.status(409).json({ error: 'كود طريقة الدفع موجود مسبقاً' });
    }
    
    res.status(500).json({ error: error.message });
  }
});

// Update payment method
app.put('/api/payment-methods/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const {
      method_code,
      method_name_ar,
      method_name_en,
      description_ar,
      description_en,
      icon,
      color,
      is_active,
      requires_bank_details,
      requires_card_details,
      processing_fee_percentage,
      processing_fee_fixed,
      min_amount,
      max_amount,
      display_order
    } = req.body;

    const query = `
      UPDATE payment_methods 
      SET method_code = COALESCE($1, method_code),
          method_name_ar = COALESCE($2, method_name_ar),
          method_name_en = COALESCE($3, method_name_en),
          description_ar = COALESCE($4, description_ar),
          description_en = COALESCE($5, description_en),
          icon = COALESCE($6, icon),
          color = COALESCE($7, color),
          is_active = COALESCE($8, is_active),
          requires_bank_details = COALESCE($9, requires_bank_details),
          requires_card_details = COALESCE($10, requires_card_details),
          processing_fee_percentage = COALESCE($11, processing_fee_percentage),
          processing_fee_fixed = COALESCE($12, processing_fee_fixed),
          min_amount = COALESCE($13, min_amount),
          max_amount = COALESCE($14, max_amount),
          display_order = COALESCE($15, display_order),
          updated_at = CURRENT_TIMESTAMP
      WHERE id = $16
      RETURNING *
    `;
    
    const result = await db.query(query, [
      method_code, method_name_ar, method_name_en, description_ar, description_en,
      icon, color, is_active, requires_bank_details, requires_card_details,
      processing_fee_percentage, processing_fee_fixed, min_amount, max_amount,
      display_order, id
    ]);
    
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'طريقة الدفع غير موجودة' });
    }
    
    res.json({ success: true, paymentMethod: result.rows[0] });
  } catch (error) {
    console.error('Error updating payment method:', error);
    res.status(500).json({ error: error.message });
  }
});

// Delete payment method
app.delete('/api/payment-methods/:id', async (req, res) => {
  try {
    const { id } = req.params;
    
    const result = await db.query(
      'DELETE FROM payment_methods WHERE id = $1 RETURNING *',
      [id]
    );
    
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'طريقة الدفع غير موجودة' });
    }
    
    res.json({ success: true, message: 'تم حذف طريقة الدفع بنجاح' });
  } catch (error) {
    console.error('Error deleting payment method:', error);
    res.status(500).json({ error: error.message });
  }
});

// Toggle payment method active status
app.patch('/api/payment-methods/:id/toggle-active', async (req, res) => {
  try {
    const { id } = req.params;
    
    const result = await db.query(
      'UPDATE payment_methods SET is_active = NOT is_active, updated_at = CURRENT_TIMESTAMP WHERE id = $1 RETURNING *',
      [id]
    );
    
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'طريقة الدفع غير موجودة' });
    }
    
    res.json({ success: true, paymentMethod: result.rows[0] });
  } catch (error) {
    console.error('Error toggling payment method status:', error);
    res.status(500).json({ error: error.message });
  }
});

// ========================================
// INSTALLMENT PLAN TYPES APIs
// ========================================

// Get all installment plan types
app.get('/api/installment-plan-types', async (req, res) => {
  try {
    const { is_active } = req.query;
    let query = 'SELECT * FROM installment_plan_types WHERE 1=1';
    let params = [];
    
    if (is_active !== undefined) {
      query += ' AND is_active = $1';
      params.push(is_active === 'true');
    }
    
    query += ' ORDER BY display_order, duration_months';
    const result = await db.query(query, params);
    res.json(result.rows);
  } catch (error) {
    console.error('Error fetching installment plan types:', error);
    res.status(500).json({ error: error.message });
  }
});

// Get single installment plan type
app.get('/api/installment-plan-types/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const result = await db.query('SELECT * FROM installment_plan_types WHERE id = $1', [id]);
    
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'خطة الأقساط غير موجودة' });
    }
    
    res.json(result.rows[0]);
  } catch (error) {
    console.error('Error fetching installment plan type:', error);
    res.status(500).json({ error: error.message });
  }
});

// Create new installment plan type
app.post('/api/installment-plan-types', async (req, res) => {
  try {
    const {
      plan_code,
      plan_name_ar,
      plan_name_en,
      description_ar,
      description_en,
      duration_months,
      number_of_payments,
      payment_frequency,
      interest_rate,
      admin_fee,
      late_payment_fee,
      min_amount,
      max_amount,
      has_grace_period,
      grace_period_days,
      early_payment_discount,
      icon,
      color,
      badge_text,
      is_active,
      is_featured,
      display_order,
      created_by
    } = req.body;

    // Validate required fields
    if (!plan_code || !plan_name_ar || !duration_months || !number_of_payments) {
      return res.status(400).json({ error: 'الرجاء تعبئة الحقول المطلوبة (الكود، الاسم، المدة، عدد الدفعات)' });
    }

    const query = `
      INSERT INTO installment_plan_types (
        plan_code, plan_name_ar, plan_name_en, description_ar, description_en,
        duration_months, number_of_payments, payment_frequency,
        interest_rate, admin_fee, late_payment_fee,
        min_amount, max_amount,
        has_grace_period, grace_period_days, early_payment_discount,
        icon, color, badge_text,
        is_active, is_featured, display_order, created_by
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20, $21, $22, $23)
      RETURNING *
    `;
    
    const values = [
      plan_code,
      plan_name_ar,
      plan_name_en || null,
      description_ar || null,
      description_en || null,
      duration_months,
      number_of_payments,
      payment_frequency || 'MONTHLY',
      interest_rate || 0,
      admin_fee || 0,
      late_payment_fee || 0,
      min_amount || null,
      max_amount || null,
      has_grace_period || false,
      grace_period_days || 0,
      early_payment_discount || 0,
      icon || '📅',
      color || '#3b82f6',
      badge_text || null,
      is_active !== undefined ? is_active : true,
      is_featured || false,
      display_order || 0,
      created_by || null
    ];

    const result = await db.query(query, values);
    res.status(201).json({ success: true, planType: result.rows[0] });
  } catch (error) {
    console.error('Error creating installment plan type:', error);
    
    if (error.code === '23505') {
      return res.status(409).json({ error: 'كود خطة الأقساط موجود مسبقاً' });
    }
    
    res.status(500).json({ error: error.message });
  }
});

// Update installment plan type
app.put('/api/installment-plan-types/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const {
      plan_code,
      plan_name_ar,
      plan_name_en,
      description_ar,
      description_en,
      duration_months,
      number_of_payments,
      payment_frequency,
      interest_rate,
      admin_fee,
      late_payment_fee,
      min_amount,
      max_amount,
      has_grace_period,
      grace_period_days,
      early_payment_discount,
      icon,
      color,
      badge_text,
      is_active,
      is_featured,
      display_order
    } = req.body;

    const query = `
      UPDATE installment_plan_types 
      SET plan_code = COALESCE($1, plan_code),
          plan_name_ar = COALESCE($2, plan_name_ar),
          plan_name_en = COALESCE($3, plan_name_en),
          description_ar = COALESCE($4, description_ar),
          description_en = COALESCE($5, description_en),
          duration_months = COALESCE($6, duration_months),
          number_of_payments = COALESCE($7, number_of_payments),
          payment_frequency = COALESCE($8, payment_frequency),
          interest_rate = COALESCE($9, interest_rate),
          admin_fee = COALESCE($10, admin_fee),
          late_payment_fee = COALESCE($11, late_payment_fee),
          min_amount = COALESCE($12, min_amount),
          max_amount = COALESCE($13, max_amount),
          has_grace_period = COALESCE($14, has_grace_period),
          grace_period_days = COALESCE($15, grace_period_days),
          early_payment_discount = COALESCE($16, early_payment_discount),
          icon = COALESCE($17, icon),
          color = COALESCE($18, color),
          badge_text = COALESCE($19, badge_text),
          is_active = COALESCE($20, is_active),
          is_featured = COALESCE($21, is_featured),
          display_order = COALESCE($22, display_order),
          updated_at = CURRENT_TIMESTAMP
      WHERE id = $23
      RETURNING *
    `;
    
    const result = await db.query(query, [
      plan_code, plan_name_ar, plan_name_en, description_ar, description_en,
      duration_months, number_of_payments, payment_frequency,
      interest_rate, admin_fee, late_payment_fee,
      min_amount, max_amount,
      has_grace_period, grace_period_days, early_payment_discount,
      icon, color, badge_text,
      is_active, is_featured, display_order,
      id
    ]);
    
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'خطة الأقساط غير موجودة' });
    }
    
    res.json({ success: true, planType: result.rows[0] });
  } catch (error) {
    console.error('Error updating installment plan type:', error);
    res.status(500).json({ error: error.message });
  }
});

// Delete installment plan type
app.delete('/api/installment-plan-types/:id', async (req, res) => {
  try {
    const { id } = req.params;
    
    const result = await db.query(
      'DELETE FROM installment_plan_types WHERE id = $1 RETURNING *',
      [id]
    );
    
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'خطة الأقساط غير موجودة' });
    }
    
    res.json({ success: true, message: 'تم حذف خطة الأقساط بنجاح' });
  } catch (error) {
    console.error('Error deleting installment plan type:', error);
    res.status(500).json({ error: error.message });
  }
});

// Toggle installment plan type active status
app.patch('/api/installment-plan-types/:id/toggle-active', async (req, res) => {
  try {
    const { id } = req.params;
    
    const result = await db.query(
      'UPDATE installment_plan_types SET is_active = NOT is_active, updated_at = CURRENT_TIMESTAMP WHERE id = $1 RETURNING *',
      [id]
    );
    
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'خطة الأقساط غير موجودة' });
    }
    
    res.json({ success: true, planType: result.rows[0] });
  } catch (error) {
    console.error('Error toggling installment plan type status:', error);
    res.status(500).json({ error: error.message });
  }
});

// ========================================
// TAX SETTINGS APIs
// ========================================

// Get all tax settings
app.get('/api/tax-settings', async (req, res) => {
  try {
    const { is_active, branch_id, tax_type } = req.query;
    let query = 'SELECT * FROM tax_settings WHERE 1=1';
    let params = [];
    let paramIndex = 1;

    if (is_active !== undefined) {
      query += ` AND is_active = $${paramIndex}`;
      params.push(is_active === 'true');
      paramIndex++;
    }

    if (branch_id !== undefined) {
      query += ` AND (branch_id = $${paramIndex} OR branch_id IS NULL)`;
      params.push(branch_id);
      paramIndex++;
    }

    if (tax_type) {
      query += ` AND tax_type = $${paramIndex}`;
      params.push(tax_type);
      paramIndex++;
    }

    query += ' ORDER BY branch_id DESC NULLS FIRST, priority, tax_name_ar';
    
    const result = await db.query(query, params);
    res.json(result.rows);
  } catch (error) {
    console.error('Error fetching tax settings:', error);
    res.status(500).json({ error: error.message });
  }
});

// Get tax setting by ID
app.get('/api/tax-settings/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const result = await db.query('SELECT * FROM tax_settings WHERE id = $1', [id]);

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'إعداد الضريبة غير موجود' });
    }

    res.json(result.rows[0]);
  } catch (error) {
    console.error('Error fetching tax setting:', error);
    res.status(500).json({ error: error.message });
  }
});

// Create new tax setting
app.post('/api/tax-settings', async (req, res) => {
  try {
    const {
      tax_code,
      tax_name_ar,
      tax_name_en,
      description_ar,
      description_en,
      tax_type,
      default_rate,
      branch_id,
      branch_name_ar,
      branch_specific_rate,
      is_active,
      applicable_on,
      calculation_method,
      include_in_total,
      is_default,
      priority,
      min_amount,
      max_amount,
      created_by
    } = req.body;

    if (!tax_code || !tax_name_ar || default_rate === undefined) {
      return res.status(400).json({ error: 'البيانات المطلوبة: tax_code, tax_name_ar, default_rate' });
    }

    const result = await db.query(
      `INSERT INTO tax_settings (
        tax_code, tax_name_ar, tax_name_en, description_ar, description_en, tax_type,
        default_rate, branch_id, branch_name_ar, branch_specific_rate, is_active,
        applicable_on, calculation_method, include_in_total, is_default, priority,
        min_amount, max_amount, created_by
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19)
      RETURNING *`,
      [
        tax_code, tax_name_ar, tax_name_en, description_ar, description_en,
        tax_type || 'VAT', default_rate, branch_id || null, branch_name_ar || null,
        branch_specific_rate || null, is_active !== false, applicable_on || 'invoice',
        calculation_method || 'percentage', include_in_total !== false, is_default || false,
        priority || 0, min_amount || null, max_amount || null, created_by || 'system'
      ]
    );

    res.status(201).json(result.rows[0]);
  } catch (error) {
    console.error('Error creating tax setting:', error);
    res.status(500).json({ error: error.message });
  }
});

// Update tax setting
app.put('/api/tax-settings/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const {
      tax_code,
      tax_name_ar,
      tax_name_en,
      description_ar,
      description_en,
      tax_type,
      default_rate,
      branch_id,
      branch_name_ar,
      branch_specific_rate,
      is_active,
      applicable_on,
      calculation_method,
      include_in_total,
      is_default,
      priority,
      min_amount,
      max_amount,
      updated_by
    } = req.body;

    const result = await db.query(
      `UPDATE tax_settings SET
        tax_code = COALESCE($1, tax_code),
        tax_name_ar = COALESCE($2, tax_name_ar),
        tax_name_en = COALESCE($3, tax_name_en),
        description_ar = COALESCE($4, description_ar),
        description_en = COALESCE($5, description_en),
        tax_type = COALESCE($6, tax_type),
        default_rate = COALESCE($7, default_rate),
        branch_id = COALESCE($8, branch_id),
        branch_name_ar = COALESCE($9, branch_name_ar),
        branch_specific_rate = COALESCE($10, branch_specific_rate),
        is_active = COALESCE($11, is_active),
        applicable_on = COALESCE($12, applicable_on),
        calculation_method = COALESCE($13, calculation_method),
        include_in_total = COALESCE($14, include_in_total),
        is_default = COALESCE($15, is_default),
        priority = COALESCE($16, priority),
        min_amount = COALESCE($17, min_amount),
        max_amount = COALESCE($18, max_amount),
        updated_by = $19,
        updated_at = CURRENT_TIMESTAMP
      WHERE id = $20
      RETURNING *`,
      [
        tax_code, tax_name_ar, tax_name_en, description_ar, description_en, tax_type,
        default_rate, branch_id, branch_name_ar, branch_specific_rate, is_active,
        applicable_on, calculation_method, include_in_total, is_default, priority,
        min_amount, max_amount, updated_by || 'system', id
      ]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'إعداد الضريبة غير موجود' });
    }

    res.json(result.rows[0]);
  } catch (error) {
    console.error('Error updating tax setting:', error);
    res.status(500).json({ error: error.message });
  }
});

// Delete tax setting
app.delete('/api/tax-settings/:id', async (req, res) => {
  try {
    const { id } = req.params;

    const result = await db.query(
      'DELETE FROM tax_settings WHERE id = $1 RETURNING id',
      [id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'إعداد الضريبة غير موجود' });
    }

    res.json({ success: true, message: 'تم حذف إعداد الضريبة بنجاح' });
  } catch (error) {
    console.error('Error deleting tax setting:', error);
    res.status(500).json({ error: error.message });
  }
});

// Toggle tax setting active status
app.patch('/api/tax-settings/:id/toggle-active', async (req, res) => {
  try {
    const { id } = req.params;

    const result = await db.query(
      'UPDATE tax_settings SET is_active = NOT is_active, updated_at = CURRENT_TIMESTAMP WHERE id = $1 RETURNING *',
      [id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'إعداد الضريبة غير موجود' });
    }

    res.json({ success: true, taxSetting: result.rows[0] });
  } catch (error) {
    console.error('Error toggling tax setting status:', error);
    res.status(500).json({ error: error.message });
  }
});

// ========================================
// BRANCH RELATIONSHIPS APIs
// ========================================

// Get incubators for a specific branch
app.get('/api/branches/:branchId/incubators', async (req, res) => {
  try {
    const { branchId } = req.params;
    
    const query = `
      SELECT 
        i.*,
        b.name as branch_name,
        b.code as branch_code
      FROM incubators i
      LEFT JOIN branches b ON i.branch_id = b.id
      WHERE i.branch_id = $1 AND i.is_active = true
      ORDER BY i.name
    `;
    
    const result = await db.query(query, [branchId]);
    res.json(result.rows);
  } catch (error) {
    console.error('Error fetching branch incubators:', error);
    res.status(500).json({ error: error.message });
  }
});

// Get platforms for a specific branch
app.get('/api/branches/:branchId/platforms', async (req, res) => {
  try {
    const { branchId } = req.params;
    
    const query = `
      SELECT 
        p.*
      FROM platforms p
      JOIN incubators i ON p.incubator_id = i.id
      WHERE i.branch_id = $1 AND p.is_active = true
      ORDER BY p.name
    `;
    
    const result = await db.query(query, [branchId]);
    res.json(result.rows);
  } catch (error) {
    console.error('Error fetching branch platforms:', error);
    res.status(500).json({ error: error.message });
  }
});

// Get all branches with their relationship counts
app.get('/api/branches/stats', async (req, res) => {
  try {
    const query = `
      SELECT 
        b.id,
        b.name,
        b.type,
        b.status,
        b.location,
        COUNT(DISTINCT bi.incubator_id) as incubator_count,
        COUNT(DISTINCT bp.platform_id) as platform_count
      FROM entities b
      LEFT JOIN branch_incubators bi ON b.id = bi.branch_id
      LEFT JOIN branch_platforms bp ON b.id = bp.branch_id
      WHERE b.type = 'BRANCH'
      GROUP BY b.id, b.name, b.type, b.status, b.location
      ORDER BY b.name
    `;
    
    const result = await db.query(query);
    res.json(result.rows);
  } catch (error) {
    console.error('Error fetching branch stats:', error);
    res.status(500).json({ error: error.message });
  }
});

// Get merge statistics summary
app.get('/api/merge-stats', async (req, res) => {
  try {
    const branchesCount = await db.query(`SELECT COUNT(*) as count FROM entities WHERE type = 'BRANCH'`);
    const incubatorsCount = await db.query(`SELECT COUNT(*) as count FROM entities WHERE type = 'INCUBATOR'`);
    const platformsCount = await db.query(`SELECT COUNT(*) as count FROM entities WHERE type = 'PLATFORM'`);
    const branchIncubatorsCount = await db.query(`SELECT COUNT(*) as count FROM branch_incubators`);
    const branchPlatformsCount = await db.query(`SELECT COUNT(*) as count FROM branch_platforms`);
    
    res.json({
      entities: {
        branches: parseInt(branchesCount.rows[0].count),
        incubators: parseInt(incubatorsCount.rows[0].count),
        platforms: parseInt(platformsCount.rows[0].count)
      },
      merges: {
        branchIncubators: parseInt(branchIncubatorsCount.rows[0].count),
        branchPlatforms: parseInt(branchPlatformsCount.rows[0].count),
        total: parseInt(branchIncubatorsCount.rows[0].count) + parseInt(branchPlatformsCount.rows[0].count)
      }
    });
  } catch (error) {
    console.error('Error fetching merge stats:', error);
    res.status(500).json({ error: error.message });
  }
});

// Get all transactions
app.get('/api/transactions', async (req, res) => {
  try {
    const { entity_id } = req.query;
    let query = 'SELECT * FROM transactions WHERE 1=1';
    let params = [];
    let paramIndex = 1;
    
    // Apply user's entity filter
    if (req.userEntity.type === 'HQ') {
      // HQ sees all transactions
    } else if (req.userEntity.type === 'BRANCH') {
      query += ` AND entity_id = $${paramIndex}`;
      params.push(req.userEntity.id);
      paramIndex++;
    } else if (req.userEntity.type === 'INCUBATOR') {
      query += ` AND entity_id = $${paramIndex}`;
      params.push(req.userEntity.id);
      paramIndex++;
    } else if (req.userEntity.type === 'PLATFORM') {
      query += ` AND entity_id = $${paramIndex}`;
      params.push(req.userEntity.id);
      paramIndex++;
    } else if (req.userEntity.type === 'OFFICE') {
      query += ` AND entity_id = $${paramIndex}`;
      params.push(req.userEntity.id);
      paramIndex++;
    }
    
    // Additional entity_id filter if provided
    if (entity_id) {
      query += ` AND entity_id = $${paramIndex}`;
      params.push(entity_id);
      paramIndex++;
    }
    
    query += ' ORDER BY transaction_date DESC';
    const result = await db.query(query, params);
    res.json(result.rows);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Get ledger entries with data isolation
app.get('/api/ledger', async (req, res) => {
  try {
    const { entity_id } = req.query;
    let query = 'SELECT * FROM ledger WHERE 1=1';
    let params = [];
    let paramIndex = 1;
    
    // Apply user's entity filter
    if (req.userEntity.type === 'HQ') {
      // HQ sees all ledger entries
    } else if (req.userEntity.type === 'BRANCH') {
      query += ` AND entity_id = $${paramIndex}`;
      params.push(req.userEntity.id);
      paramIndex++;
    } else if (req.userEntity.type === 'INCUBATOR') {
      query += ` AND entity_id = $${paramIndex}`;
      params.push(req.userEntity.id);
      paramIndex++;
    } else if (req.userEntity.type === 'PLATFORM') {
      query += ` AND entity_id = $${paramIndex}`;
      params.push(req.userEntity.id);
      paramIndex++;
    } else if (req.userEntity.type === 'OFFICE') {
      query += ` AND entity_id = $${paramIndex}`;
      params.push(req.userEntity.id);
      paramIndex++;
    }
    
    // Additional entity_id filter if provided
    if (entity_id) {
      query += ` AND entity_id = $${paramIndex}`;
      params.push(entity_id);
      paramIndex++;
    }
    
    query += ' ORDER BY transaction_date DESC';
    const result = await db.query(query, params);
    res.json(result.rows);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Get all ads with data isolation
app.get('/api/ads', async (req, res) => {
  try {
    const { entity_id, status, level } = req.query;
    let query = 'SELECT * FROM ads WHERE 1=1';
    let params = [];
    let paramIndex = 1;
    
    // Apply user's entity filter - use entity_id column for data isolation
    if (req.userEntity.type === 'HQ') {
      // HQ sees all ads
    } else {
      // Other entities see their own ads via entity_id
      query += ` AND entity_id = $${paramIndex}`;
      params.push(req.userEntity.id);
      paramIndex++;
    }
    
    // Additional filters
    if (entity_id) {
      query += ` AND entity_id = $${paramIndex}`;
      params.push(entity_id);
      paramIndex++;
    }
    
    if (status) {
      query += ` AND status = $${paramIndex}`;
      params.push(status);
      paramIndex++;
    }
    
    if (level) {
      query += ` AND level = $${paramIndex}`;
      params.push(level);
      paramIndex++;
    }
    
    query += ' ORDER BY created_at DESC';
    const result = await db.query(query, params);
    res.json(result.rows);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Create new ad
app.post('/api/ads', async (req, res) => {
  try {
    const {
      title, content, level, scope, status, source_entity_id,
      source_type, target_ids, cost, budget, start_date, end_date
    } = req.body;
    
    const result = await db.query(
      `INSERT INTO ads 
       (title, content, level, scope, status, source_entity_id, source_type, 
        target_ids, cost, budget, start_date, end_date)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
       RETURNING *`,
      [title, content, level, scope, status || 'PENDING', source_entity_id,
       source_type, target_ids || [], cost || 0, budget || 0, start_date, end_date]
    );
    
    res.status(201).json(result.rows[0]);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Update ad
app.put('/api/ads/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const updates = req.body;
    
    const fields = Object.keys(updates).map((key, index) => `${key} = $${index + 2}`).join(', ');
    const values = [id, ...Object.values(updates)];
    
    const result = await db.query(
      `UPDATE ads SET ${fields}, updated_at = CURRENT_TIMESTAMP WHERE id = $1 RETURNING *`,
      values
    );
    
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Ad not found' });
    }
    
    res.json(result.rows[0]);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Dashboard stats
app.get('/api/stats', async (req, res) => {
  try {
    const { entity_id } = req.query;
    
    const stats = {};
    
    // Total entities
    const entitiesCount = await db.query('SELECT COUNT(*) FROM entities');
    stats.totalEntities = parseInt(entitiesCount.rows[0].count);
    
    // Total users
    const usersCount = await db.query(
      entity_id 
        ? 'SELECT COUNT(*) FROM users WHERE entity_id = $1'
        : 'SELECT COUNT(*) FROM users',
      entity_id ? [entity_id] : []
    );
    stats.totalUsers = parseInt(usersCount.rows[0].count);
    
    // Total revenue
    const revenue = await db.query(
      entity_id
        ? 'SELECT SUM(paid_amount) as total FROM invoices WHERE entity_id = $1'
        : 'SELECT SUM(paid_amount) as total FROM invoices',
      entity_id ? [entity_id] : []
    );
    stats.totalRevenue = parseFloat(revenue.rows[0].total || 0);
    
    // Active ads
    const adsCount = await db.query(
      entity_id
        ? 'SELECT COUNT(*) FROM ads WHERE source_entity_id = $1 AND status = \'ACTIVE\''
        : 'SELECT COUNT(*) FROM ads WHERE status = \'ACTIVE\'',
      entity_id ? [entity_id] : []
    );
    stats.activeAds = parseInt(adsCount.rows[0].count);
    
    // Outstanding invoices
    const outstanding = await db.query(
      entity_id
        ? 'SELECT SUM(amount - paid_amount) as total FROM invoices WHERE entity_id = $1 AND status != \'PAID\''
        : 'SELECT SUM(amount - paid_amount) as total FROM invoices WHERE status != \'PAID\'',
      entity_id ? [entity_id] : []
    );
    stats.outstandingAmount = parseFloat(outstanding.rows[0].total || 0);
    
    res.json(stats);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});


// ========================================
// NOTIFICATIONS ENDPOINTS
// ========================================

// Get notifications for a user
app.get('/api/notifications', async (req, res) => {
  try {
    const { user_id, is_read } = req.query;
    
    let query = 'SELECT * FROM notifications WHERE 1=1';
    const params = [];
    const requestEntityId = getRequestEntityContext(req).id;
    const isHqRequest = isHqEntityContext(req);

    if (!isHqRequest) {
      params.push(requestEntityId);
      query += ` AND entity_id = $${params.length}`;
    }
    
    if (user_id) {
      params.push(user_id);
      query += ` AND user_id = $${params.length}`;
    }
    
    if (is_read !== undefined) {
      params.push(is_read === 'true');
      query += ` AND is_read = $${params.length}`;
    }
    
    query += ' ORDER BY created_at DESC LIMIT 50';
    
    const result = await db.query(query, params);
    res.json(result.rows);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Mark notification as read
app.put('/api/notifications/:id/read', async (req, res) => {
  try {
    const { id } = req.params;
    const requestEntityId = getRequestEntityContext(req).id;
    const filter = isHqEntityContext(req) ? 'id = $1' : 'id = $1 AND entity_id = $2';
    const params = isHqEntityContext(req) ? [id] : [id, requestEntityId];
    await db.query(`UPDATE notifications SET is_read = true WHERE ${filter}`, params);
    
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Mark all notifications as read for a user
app.put('/api/notifications/read-all', async (req, res) => {
  try {
    const { user_id } = req.body;
    const requestEntityId = getRequestEntityContext(req).id;
    const filter = isHqEntityContext(req)
      ? 'user_id = $1'
      : 'user_id = $1 AND entity_id = $2';
    const params = isHqEntityContext(req) ? [user_id] : [user_id, requestEntityId];
    await db.query(`UPDATE notifications SET is_read = true WHERE ${filter}`, params);
    
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Get unread count
app.get('/api/notifications/unread-count', async (req, res) => {
  try {
    const { user_id } = req.query;
    const requestEntityId = getRequestEntityContext(req).id;
    const filter = isHqEntityContext(req)
      ? 'user_id = $1 AND is_read = false'
      : 'user_id = $1 AND entity_id = $2 AND is_read = false';
    const params = isHqEntityContext(req) ? [user_id] : [user_id, requestEntityId];
    const result = await db.query(`SELECT COUNT(*) FROM notifications WHERE ${filter}`, params);
    
    res.json({ count: parseInt(result.rows[0].count) });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// ---- HeadQuarters APIs (المقرات الرئيسية) ----

// Get all headquarters
app.get('/api/headquarters', async (req, res) => {
  try {
    const result = await db.query('SELECT * FROM headquarters ORDER BY created_at DESC');
    res.json(result.rows);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Get headquarters by ID
app.get('/api/headquarters/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const result = await db.query('SELECT * FROM headquarters WHERE id = $1', [id]);
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'المقر الرئيسي غير موجود' });
    }
    res.json(result.rows[0]);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Create new headquarters
app.post('/api/headquarters', async (req, res) => {
  try {
    const { name, code, description, country, contact_email, contact_phone, logo_url, settings } = req.body;
    const result = await db.query(
      `INSERT INTO headquarters (name, code, description, country, contact_email, contact_phone, logo_url, settings)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8) RETURNING *`,
      [name, code, description, country, contact_email, contact_phone, logo_url, settings || {}]
    );
    res.status(201).json(result.rows[0]);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Update headquarters
app.put('/api/headquarters/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { name, code, description, country, contact_email, contact_phone, logo_url, settings, is_active } = req.body;
    const result = await db.query(
      `UPDATE headquarters 
       SET name = COALESCE($1, name),
           code = COALESCE($2, code),
           description = COALESCE($3, description),
           country = COALESCE($4, country),
           contact_email = COALESCE($5, contact_email),
           contact_phone = COALESCE($6, contact_phone),
           logo_url = COALESCE($7, logo_url),
           settings = COALESCE($8, settings),
           is_active = COALESCE($9, is_active)
       WHERE id = $10 RETURNING *`,
      [name, code, description, country, contact_email, contact_phone, logo_url, settings, is_active, id]
    );
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'المقر الرئيسي غير موجود' });
    }
    res.json(result.rows[0]);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Delete headquarters
app.delete('/api/headquarters/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const result = await db.query('DELETE FROM headquarters WHERE id = $1 RETURNING *', [id]);
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'المقر الرئيسي غير موجود' });
    }
    res.json({ message: 'تم حذف المقر الرئيسي بنجاح', data: result.rows[0] });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// ---- Branches APIs (الفروع) ----

// Get all branches (with optional HQ filter)
app.get('/api/branches', async (req, res) => {
  try {
    if (isDedicatedTenantEntityContext(req)) {
      return res.json([]);
    }

    const { hq_id } = req.query;
    let query = `
      SELECT b.*, hq.name as hq_name, hq.code as hq_code
      FROM branches b
      LEFT JOIN headquarters hq ON b.hq_id = hq.id
    `;
    const params = [];
    if (hq_id) {
      query += ' WHERE b.hq_id = $1';
      params.push(hq_id);
    }
    query += ' ORDER BY b.created_at DESC';
    const result = await db.query(query, params);
    res.json(result.rows);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Get branch by ID
app.get('/api/branches/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const result = await db.query(`
      SELECT b.*, hq.name as hq_name, hq.code as hq_code
      FROM branches b
      LEFT JOIN headquarters hq ON b.hq_id = hq.id
      WHERE b.id = $1
    `, [id]);
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'الفرع غير موجود' });
    }
    res.json(result.rows[0]);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Create new branch
app.post('/api/branches', async (req, res) => {
  try {
    const { hq_id, name, code, description, country, city, address, contact_email, contact_phone, manager_name, settings } = req.body;
    const result = await db.query(
      `INSERT INTO branches (hq_id, name, code, description, country, city, address, contact_email, contact_phone, manager_name, settings)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11) RETURNING *`,
      [hq_id, name, code, description, country, city, address, contact_email, contact_phone, manager_name, settings || {}]
    );
    res.status(201).json(result.rows[0]);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Update branch
app.put('/api/branches/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { name, code, description, country, city, address, contact_email, contact_phone, manager_name, settings, is_active } = req.body;
    const result = await db.query(
      `UPDATE branches 
       SET name = COALESCE($1, name),
           code = COALESCE($2, code),
           description = COALESCE($3, description),
           country = COALESCE($4, country),
           city = COALESCE($5, city),
           address = COALESCE($6, address),
           contact_email = COALESCE($7, contact_email),
           contact_phone = COALESCE($8, contact_phone),
           manager_name = COALESCE($9, manager_name),
           settings = COALESCE($10, settings),
           is_active = COALESCE($11, is_active)
       WHERE id = $12 RETURNING *`,
      [name, code, description, country, city, address, contact_email, contact_phone, manager_name, settings, is_active, id]
    );
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'الفرع غير موجود' });
    }
    res.json(result.rows[0]);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Delete branch
app.delete('/api/branches/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const result = await db.query('DELETE FROM branches WHERE id = $1 RETURNING *', [id]);
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'الفرع غير موجود' });
    }
    res.json({ message: 'تم حذف الفرع بنجاح', data: result.rows[0] });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// ---- Incubators APIs (الحاضنات) ----

// Get all incubators (with optional branch filter using junction table)
app.get('/api/incubators', async (req, res) => {
  try {
    if (isDedicatedTenantEntityContext(req)) {
      return res.json([]);
    }

    const { branch_id } = req.query;
    
    if (branch_id) {
      // Use branch_incubators junction table for merged relationships
      const query = `
        SELECT DISTINCT i.*, 
               bi.relationship_status,
               bi.assigned_date
        FROM entities i
        INNER JOIN branch_incubators bi ON i.id = bi.incubator_id
        WHERE bi.branch_id = $1 
          AND i.type = 'INCUBATOR'
          AND bi.relationship_status = 'ACTIVE'
        ORDER BY i.name
      `;
      const result = await db.query(query, [branch_id]);
      res.json(result.rows);
    } else {
      // Get all incubators
      const query = `SELECT * FROM entities WHERE type = 'INCUBATOR' ORDER BY created_at DESC`;
      const result = await db.query(query);
      res.json(result.rows);
    }
  } catch (error) {
    console.error('Error fetching incubators:', error);
    res.status(500).json({ error: error.message });
  }
});

// Get incubator by ID
app.get('/api/incubators/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const result = await db.query(`
      SELECT i.*, 
             b.name as branch_name, b.code as branch_code,
             hq.name as hq_name, hq.code as hq_code
      FROM incubators i
      LEFT JOIN branches b ON i.branch_id = b.id
      LEFT JOIN headquarters hq ON b.hq_id = hq.id
      WHERE i.id = $1
    `, [id]);
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'الحاضنة غير موجودة' });
    }
    res.json(result.rows[0]);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Create new incubator
app.post('/api/incubators', async (req, res) => {
  try {
    const { branch_id, name, code, description, program_type, capacity, contact_email, contact_phone, manager_name, start_date, end_date, settings } = req.body;
    const result = await db.query(
      `INSERT INTO incubators (branch_id, name, code, description, program_type, capacity, contact_email, contact_phone, manager_name, start_date, end_date, settings)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12) RETURNING *`,
      [branch_id, name, code, description, program_type, capacity, contact_email, contact_phone, manager_name, start_date, end_date, settings || {}]
    );
    res.status(201).json(result.rows[0]);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Update incubator
app.put('/api/incubators/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { name, code, description, program_type, capacity, contact_email, contact_phone, manager_name, start_date, end_date, settings, is_active } = req.body;
    const result = await db.query(
      `UPDATE incubators 
       SET name = COALESCE($1, name),
           code = COALESCE($2, code),
           description = COALESCE($3, description),
           program_type = COALESCE($4, program_type),
           capacity = COALESCE($5, capacity),
           contact_email = COALESCE($6, contact_email),
           contact_phone = COALESCE($7, contact_phone),
           manager_name = COALESCE($8, manager_name),
           start_date = COALESCE($9, start_date),
           end_date = COALESCE($10, end_date),
           settings = COALESCE($11, settings),
           is_active = COALESCE($12, is_active)
       WHERE id = $13 RETURNING *`,
      [name, code, description, program_type, capacity, contact_email, contact_phone, manager_name, start_date, end_date, settings, is_active, id]
    );
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'الحاضنة غير موجودة' });
    }
    res.json(result.rows[0]);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Delete incubator
app.delete('/api/incubators/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const result = await db.query('DELETE FROM incubators WHERE id = $1 RETURNING *', [id]);
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'الحاضنة غير موجودة' });
    }
    res.json({ message: 'تم حذف الحاضنة بنجاح', data: result.rows[0] });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// ---- Platforms APIs (المنصات) ----

// Get all platforms (with optional incubator filter)
app.get('/api/platforms', async (req, res) => {
  try {
    if (isDedicatedTenantEntityContext(req)) {
      return res.json([]);
    }

    const { incubator_id, branch_id } = req.query;
    
    if (branch_id) {
      // Use branch_platforms junction table for merged relationships
      const query = `
        SELECT DISTINCT p.*, 
               bp.relationship_status,
               bp.performance_score,
               bp.assigned_date
        FROM entities p
        INNER JOIN branch_platforms bp ON p.id = bp.platform_id
        WHERE bp.branch_id = $1 
          AND p.type = 'PLATFORM'
          AND bp.relationship_status = 'ACTIVE'
        ORDER BY p.name
      `;
      const result = await db.query(query, [branch_id]);
      res.json(result.rows);
    } else if (incubator_id) {
      // Filter by incubator (if needed for old system)
      const query = `SELECT * FROM entities WHERE incubator_id = $1 AND type = 'PLATFORM' ORDER BY created_at DESC`;
      const result = await db.query(query, [incubator_id]);
      res.json(result.rows);
    } else {
      // Get all platforms
      const query = `SELECT * FROM entities WHERE type = 'PLATFORM' ORDER BY created_at DESC`;
      const result = await db.query(query);
      res.json(result.rows);
    }
  } catch (error) {
    console.error('Error fetching platforms:', error);
    res.status(500).json({ error: error.message });
  }
});

// Get platform by ID
app.get('/api/platforms/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const result = await db.query(`
      SELECT p.*, 
             i.name as incubator_name, i.code as incubator_code,
             b.name as branch_name,
             hq.name as hq_name
      FROM platforms p
      LEFT JOIN incubators i ON p.incubator_id = i.id
      LEFT JOIN branches b ON i.branch_id = b.id
      LEFT JOIN headquarters hq ON b.hq_id = hq.id
      WHERE p.id = $1
    `, [id]);
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'المنصة غير موجودة' });
    }
    res.json(result.rows[0]);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Create new platform
app.post('/api/platforms', async (req, res) => {
  try {
    const { incubator_id, name, code, description, platform_type, pricing_model, base_price, currency, features, settings } = req.body;
    const result = await db.query(
      `INSERT INTO platforms (incubator_id, name, code, description, platform_type, pricing_model, base_price, currency, features, settings)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10) RETURNING *`,
      [incubator_id, name, code, description, platform_type, pricing_model, base_price || 0, currency || 'USD', features || [], settings || {}]
    );
    res.status(201).json(result.rows[0]);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Update platform
app.put('/api/platforms/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { name, code, description, platform_type, pricing_model, base_price, currency, features, settings, is_active } = req.body;
    const result = await db.query(
      `UPDATE platforms 
       SET name = COALESCE($1, name),
           code = COALESCE($2, code),
           description = COALESCE($3, description),
           platform_type = COALESCE($4, platform_type),
           pricing_model = COALESCE($5, pricing_model),
           base_price = COALESCE($6, base_price),
           currency = COALESCE($7, currency),
           features = COALESCE($8, features),
           settings = COALESCE($9, settings),
           is_active = COALESCE($10, is_active)
       WHERE id = $11 RETURNING *`,
      [name, code, description, platform_type, pricing_model, base_price, currency, features, settings, is_active, id]
    );
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'المنصة غير موجودة' });
    }
    res.json(result.rows[0]);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Delete platform
app.delete('/api/platforms/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const result = await db.query('DELETE FROM platforms WHERE id = $1 RETURNING *', [id]);
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'المنصة غير موجودة' });
    }
    res.json({ message: 'تم حذف المنصة بنجاح', data: result.rows[0] });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// ---- Offices APIs (المكاتب) ----

// Get all offices (with optional incubator filter)
app.get('/api/offices', async (req, res) => {
  try {
    if (isDedicatedTenantEntityContext(req)) {
      return res.json([]);
    }

    const { incubator_id } = req.query;
    let query = `
      SELECT o.*, 
             i.name as incubator_name, i.code as incubator_code,
             b.name as branch_name,
             hq.name as hq_name
      FROM offices o
      LEFT JOIN incubators i ON o.incubator_id = i.id
      LEFT JOIN branches b ON i.branch_id = b.id
      LEFT JOIN headquarters hq ON b.hq_id = hq.id
    `;
    const params = [];
    if (incubator_id) {
      query += ' WHERE o.incubator_id = $1';
      params.push(incubator_id);
    }
    query += ' ORDER BY o.created_at DESC';
    const result = await db.query(query, params);
    res.json(result.rows);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Get office by ID
app.get('/api/offices/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const result = await db.query(`
      SELECT o.*, 
             i.name as incubator_name, i.code as incubator_code,
             b.name as branch_name,
             hq.name as hq_name
      FROM offices o
      LEFT JOIN incubators i ON o.incubator_id = i.id
      LEFT JOIN branches b ON i.branch_id = b.id
      LEFT JOIN headquarters hq ON b.hq_id = hq.id
      WHERE o.id = $1
    `, [id]);
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'المكتب غير موجود' });
    }
    res.json(result.rows[0]);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Create new office
app.post('/api/offices', async (req, res) => {
  try {
    const { incubator_id, name, code, description, office_type, location, address, capacity, working_hours, contact_email, contact_phone, manager_name, settings } = req.body;
    const result = await db.query(
      `INSERT INTO offices (incubator_id, name, code, description, office_type, location, address, capacity, working_hours, contact_email, contact_phone, manager_name, settings)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13) RETURNING *`,
      [incubator_id, name, code, description, office_type, location, address, capacity || 0, working_hours || {}, contact_email, contact_phone, manager_name, settings || {}]
    );
    res.status(201).json(result.rows[0]);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Update office
app.put('/api/offices/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { name, code, description, office_type, location, address, capacity, working_hours, contact_email, contact_phone, manager_name, settings, is_active } = req.body;
    const result = await db.query(
      `UPDATE offices 
       SET name = COALESCE($1, name),
           code = COALESCE($2, code),
           description = COALESCE($3, description),
           office_type = COALESCE($4, office_type),
           location = COALESCE($5, location),
           address = COALESCE($6, address),
           capacity = COALESCE($7, capacity),
           working_hours = COALESCE($8, working_hours),
           contact_email = COALESCE($9, contact_email),
           contact_phone = COALESCE($10, contact_phone),
           manager_name = COALESCE($11, manager_name),
           settings = COALESCE($12, settings),
           is_active = COALESCE($13, is_active)
       WHERE id = $14 RETURNING *`,
      [name, code, description, office_type, location, address, capacity, working_hours, contact_email, contact_phone, manager_name, settings, is_active, id]
    );
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'المكتب غير موجود' });
    }
    res.json(result.rows[0]);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Delete office
app.delete('/api/offices/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const result = await db.query('DELETE FROM offices WHERE id = $1 RETURNING *', [id]);
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'المكتب غير موجود' });
    }
    res.json({ message: 'تم حذف المكتب بنجاح', data: result.rows[0] });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Get platforms for a specific office
app.get('/api/offices/:id/platforms', async (req, res) => {
  try {
    const { id } = req.params;
    const result = await db.query(`
      SELECT p.*, op.is_active as is_linked
      FROM office_platforms op
      JOIN platforms p ON op.platform_id = p.id
      WHERE op.office_id = $1 AND op.is_active = true
      ORDER BY p.name
    `, [id]);
    res.json(result.rows);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Get platforms for a specific incubator or headquarters
app.get('/api/incubators/:id/platforms', async (req, res) => {
  try {
    const { id } = req.params;
    console.log('📋 Fetching platforms for:', id);
    
    let incubatorIds = [];
    const numericId = parseInt(id, 10);
    
    // Check if it's a headquarters entity_id (like 'HQ001')
    if (id.startsWith('HQ')) {
      console.log('→ Detected HQ entity_id, finding all incubators for HQ branches');
      
      // Get HQ ID
      const hqResult = await db.query(`
        SELECT id FROM headquarters WHERE entity_id = $1
      `, [id]);
      
      if (hqResult.rows.length === 0) {
        console.log('❌ HQ not found for entity_id:', id);
        return res.status(404).json({ error: 'Headquarters not found' });
      }
      
      const hqId = hqResult.rows[0].id;
      console.log('✅ Found HQ ID:', hqId);
      
      // Get all branches for this HQ
      const branchResult = await db.query(`
        SELECT id FROM branches WHERE hq_id = $1
      `, [hqId]);
      
      console.log('✅ Found branches:', branchResult.rows.length);
      
      if (branchResult.rows.length === 0) {
        console.log('⚠️  No branches found for HQ');
        return res.json([]);
      }
      
      const branchIds = branchResult.rows.map(b => b.id);
      
      // Get all incubators for these branches
      const incubatorResult = await db.query(`
        SELECT id FROM incubators WHERE branch_id = ANY($1)
      `, [branchIds]);
      
      console.log('✅ Found incubators:', incubatorResult.rows.length);
      
      if (incubatorResult.rows.length === 0) {
        console.log('⚠️  No incubators found for these branches');
        return res.json([]);
      }
      
      incubatorIds = incubatorResult.rows.map(i => i.id);
      
    } else if (isNaN(numericId) || id !== numericId.toString()) {
      // It's an incubator entity_id (like 'INC03')
      console.log('→ Looking up incubator entity_id:', id);
      const incubatorResult = await db.query(`
        SELECT id FROM incubators WHERE entity_id = $1
      `, [id]);
      
      if (incubatorResult.rows.length === 0) {
        console.log('❌ Incubator not found for entity_id:', id);
        return res.status(404).json({ error: 'Incubator not found' });
      }
      incubatorIds = [incubatorResult.rows[0].id];
      console.log('✅ Found incubator ID:', incubatorIds[0], 'for entity_id:', id);
    } else {
      // Numeric ID
      incubatorIds = [numericId];
      console.log('→ Using numeric ID:', numericId);
    }
    
    // Get platforms for all incubators
    const result = await db.query(`
      SELECT id, name, incubator_id, description, code
      FROM platforms
      WHERE incubator_id = ANY($1)
      ORDER BY name
    `, [incubatorIds]);
    
    console.log('✅ Found platforms:', result.rows.length);
    res.json(result.rows);
  } catch (error) {
    console.error('❌ Error fetching platforms:', error);
    res.status(500).json({ error: error.message });
  }
});

// Link office to platform
app.post('/api/offices/:office_id/platforms/:platform_id', async (req, res) => {
  try {
    const { office_id, platform_id } = req.params;
    const result = await db.query(
      `INSERT INTO office_platforms (office_id, platform_id)
       VALUES ($1, $2)
       ON CONFLICT (office_id, platform_id) DO UPDATE SET is_active = true
       RETURNING *`,
      [office_id, platform_id]
    );
    res.status(201).json(result.rows[0]);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Unlink office from platform
app.delete('/api/offices/:office_id/platforms/:platform_id', async (req, res) => {
  try {
    const { office_id, platform_id } = req.params;
    const result = await db.query(
      'DELETE FROM office_platforms WHERE office_id = $1 AND platform_id = $2 RETURNING *',
      [office_id, platform_id]
    );
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'الربط غير موجود' });
    }
    res.json({ message: 'تم إلغاء ربط المكتب بالمنصة', data: result.rows[0] });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Get full hierarchy view
app.get('/api/hierarchy', async (req, res) => {
  try {
    const result = await db.query(`
      SELECT * FROM entity_hierarchy
      ORDER BY hq_id, branch_id, incubator_id, platform_id, office_id
    `);
    res.json(result.rows);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Get hierarchy statistics
app.get('/api/hierarchy/stats', async (req, res) => {
  try {
    const stats = await db.query(`
      SELECT 
        (SELECT COUNT(*) FROM headquarters WHERE is_active = true) as active_hqs,
        (SELECT COUNT(*) FROM branches WHERE is_active = true) as active_branches,
        (SELECT COUNT(*) FROM incubators WHERE is_active = true) as active_incubators,
        (SELECT COUNT(*) FROM platforms WHERE is_active = true) as active_platforms,
        (SELECT COUNT(*) FROM offices WHERE is_active = true) as active_offices,
        (SELECT COUNT(*) FROM office_platforms WHERE is_active = true) as active_links
    `);
    res.json(stats.rows[0]);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// ========================================
// EMPLOYEES APIs
// ========================================

// Get all employees with data isolation
app.get('/api/employees', async (req, res) => {
  try {
    if (isTenantHostRequest(req)) {
      const tenantSessionUser = await requireTenantSessionUser(req, res);
      if (!tenantSessionUser) return;
      const tenantResult = await req.tenantPool.query(`
        SELECT
          emp.id,
          emp.employee_number,
          TRIM(CONCAT(emp.first_name, ' ', COALESCE(emp.last_name, ''))) AS full_name,
          emp.email,
          emp.phone,
          emp.job_title AS position,
          COALESCE(td.name, emp.metadata->>'department', '') AS department,
          'TENANT' AS assigned_entity_type,
          $1 AS entity_id,
          $2 AS entity_name,
          $3 AS entity_code,
          emp.hire_date,
          emp.basic_salary AS salary,
          emp.employment_type,
          (emp.status = 'active') AS is_active,
          emp.address,
          emp.branch_id,
          emp.department_id
        FROM employees emp
        LEFT JOIN tenant_departments td ON emp.department_id = td.id
        ORDER BY emp.created_at DESC, emp.id DESC
      `, [getTenantHostEntityId(req), req.tenant.company_name, req.tenant.subdomain]);

      return res.json(tenantResult.rows.map((row) => ({
        ...row,
        employment_type: mapTenantEmploymentTypeToUi(row.employment_type)
      })));
    }

    const { entity_type, entity_id, is_active } = req.query;
    
    // Build base query with data isolation
    let query = `
      SELECT 
        emp.id,
        emp.employee_number,
        emp.full_name,
        emp.email,
        emp.position,
        emp.department,
        emp.assigned_entity_type,
        COALESCE(hq.entity_id, b.entity_id, i.entity_id, p.entity_id, o.entity_id, 'HQ001') as entity_id,
        COALESCE(hq.name, b.name, i.name, p.name, o.name) as entity_name,
        COALESCE(b.code, i.code, p.code, o.code) as entity_code,
        emp.hire_date,
        emp.salary,
        emp.employment_type,
        emp.is_active,
        emp.hq_id,
        emp.branch_id,
        emp.incubator_id,
        emp.platform_id,
        emp.office_id
      FROM employees emp
      LEFT JOIN headquarters hq ON emp.hq_id = hq.id
      LEFT JOIN branches b ON emp.branch_id = b.id
      LEFT JOIN incubators i ON emp.incubator_id = i.id
      LEFT JOIN platforms p ON emp.platform_id = p.id
      LEFT JOIN offices o ON emp.office_id = o.id
      WHERE 1=1
    `;
    const params = [];
    let paramIndex = 1;

    // Apply user's entity filter by entity ID string
    if (req.userEntity.type !== 'HQ') {
      // Non-HQ entities see only their own employees
      // Use entity_id from the joined tables
      query += ` AND COALESCE(b.entity_id, i.entity_id, p.entity_id, o.entity_id) = $${paramIndex}`;
      params.push(req.userEntity.id);
      paramIndex++;
    }

    // Additional filters
    if (entity_type) {
      query += ` AND emp.assigned_entity_type = $${paramIndex}`;
      params.push(entity_type);
      paramIndex++;
    }

    if (entity_id) {
      query += ` AND COALESCE(b.entity_id, i.entity_id, p.entity_id, o.entity_id) = $${paramIndex}`;
      params.push(entity_id);
      paramIndex++;
    }

    if (is_active !== undefined) {
      query += ` AND emp.is_active = $${paramIndex}`;
      params.push(is_active === 'true');
      paramIndex++;
    }

    query += ' ORDER BY emp.full_name';

    const result = await db.query(query, params);
    res.json(result.rows);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Get employee by ID
app.get('/api/employees/:id', async (req, res) => {
  try {
    const { id } = req.params;
    if (isTenantHostRequest(req)) {
      const tenantSessionUser = await requireTenantSessionUser(req, res);
      if (!tenantSessionUser) return;
      const tenantResult = await req.tenantPool.query(`
        SELECT
          emp.id,
          emp.employee_number,
          TRIM(CONCAT(emp.first_name, ' ', COALESCE(emp.last_name, ''))) AS full_name,
          emp.email,
          emp.phone,
          emp.national_id,
          emp.job_title AS position,
          COALESCE(td.name, emp.metadata->>'department', '') AS department,
          'TENANT' AS assigned_entity_type,
          $1 AS entity_id,
          $2 AS entity_name,
          $3 AS entity_code,
          emp.hire_date,
          emp.basic_salary AS salary,
          emp.employment_type,
          (emp.status = 'active') AS is_active,
          emp.address,
          emp.created_at,
          emp.updated_at
        FROM employees emp
        LEFT JOIN tenant_departments td ON emp.department_id = td.id
        WHERE emp.id = $4
        LIMIT 1
      `, [getTenantHostEntityId(req), req.tenant.company_name, req.tenant.subdomain, id]);

      if (tenantResult.rows.length === 0) {
        return res.status(404).json({ error: 'الموظف غير موجود' });
      }

      return res.json({
        ...tenantResult.rows[0],
        employment_type: mapTenantEmploymentTypeToUi(tenantResult.rows[0].employment_type)
      });
    }

    const params = [id];
    let query = `
      SELECT 
        emp.id,
        emp.employee_number,
        emp.full_name,
        emp.email,
        emp.phone,
        emp.position,
        emp.department,
        emp.assigned_entity_type,
        COALESCE(hq.entity_id, b.entity_id, i.entity_id, p.entity_id, o.entity_id, 'HQ001') as entity_id,
        COALESCE(hq.name, b.name, i.name, p.name, o.name) as entity_name,
        COALESCE(b.code, i.code, p.code, o.code) as entity_code,
        emp.hire_date,
        emp.salary,
        emp.employment_type,
        emp.is_active,
        emp.address,
        emp.emergency_contact,
        emp.emergency_phone
      FROM employees emp
      LEFT JOIN headquarters hq ON emp.hq_id = hq.id
      LEFT JOIN branches b ON emp.branch_id = b.id
      LEFT JOIN incubators i ON emp.incubator_id = i.id
      LEFT JOIN platforms p ON emp.platform_id = p.id
      LEFT JOIN offices o ON emp.office_id = o.id
      WHERE emp.id = $1
    `;

    if (!isHqEntityContext(req)) {
      params.push(getRequestEntityContext(req).id);
      query += ` AND COALESCE(hq.entity_id, b.entity_id, i.entity_id, p.entity_id, o.entity_id, 'HQ001') = $2`;
    }

    const result = await db.query(query, params);
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'الموظف غير موجود' });
    }
    res.json(result.rows[0]);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Create employee
app.post('/api/employees', async (req, res) => {
  try {
    const { 
      employee_number, full_name, email, phone, national_id, 
      position, department, assigned_entity_type,
      hq_id, branch_id, incubator_id, platform_id, office_id,
      hire_date, salary, employment_type, address, 
      emergency_contact, emergency_phone 
    } = req.body;

    if (isTenantHostRequest(req)) {
      const tenantSessionUser = await requireTenantSessionUser(req, res);
      if (!tenantSessionUser) return;
      const { firstName, lastName } = splitFullName(full_name);
      if (!employee_number || !firstName || !position || !department || !employment_type) {
        return res.status(400).json({ error: 'الحقول الأساسية مطلوبة' });
      }

      const tenantInsert = await req.tenantPool.query(
        `INSERT INTO employees (
          employee_number, first_name, last_name, email, phone, national_id,
          job_title, hire_date, basic_salary, employment_type, address, metadata, status
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, jsonb_build_object('department', $12), 'active')
        RETURNING id, employee_number`,
        [
          employee_number,
          firstName,
          lastName,
          email,
          phone,
          national_id,
          position,
          hire_date,
          salary,
          mapUiEmploymentTypeToTenant(employment_type),
          address,
          department
        ]
      );

      return res.status(201).json({
        id: tenantInsert.rows[0].id,
        employee_number: tenantInsert.rows[0].employee_number,
        full_name,
        email,
        phone,
        position,
        department,
        entity_id: getTenantHostEntityId(req),
        entity_name: req.tenant.company_name,
        salary,
        employment_type,
        is_active: true,
        address
      });
    }

    console.log('Creating employee with data:', {
      employee_number, full_name, position, department, assigned_entity_type,
      hire_date, employment_type
    });

    let scopedAssignedEntityType = assigned_entity_type;
    let scopedHqId = hq_id || null;
    let scopedBranchId = branch_id || null;
    let scopedIncubatorId = incubator_id || null;
    let scopedPlatformId = platform_id || null;
    let scopedOfficeId = office_id || null;

    if (!isHqEntityContext(req)) {
      const entityContext = getRequestEntityContext(req);
      if (isDedicatedTenantEntityContext(req)) {
        return res.status(403).json({ error: 'إدارة الموظفين العامة غير متاحة لحسابات المستأجر المعزولة' });
      }

      const resolvedEntityRecordId = await resolveOperationalEntityRecordId(entityContext.type, entityContext.id);
      if (!resolvedEntityRecordId) {
        return res.status(400).json({ error: 'تعذر ربط الموظف بكيان المستخدم الحالي' });
      }

      scopedAssignedEntityType = entityContext.type;
      scopedHqId = null;
      scopedBranchId = null;
      scopedIncubatorId = null;
      scopedPlatformId = null;
      scopedOfficeId = null;

      if (entityContext.type === 'HQ') scopedHqId = resolvedEntityRecordId;
      if (entityContext.type === 'BRANCH') scopedBranchId = resolvedEntityRecordId;
      if (entityContext.type === 'INCUBATOR') scopedIncubatorId = resolvedEntityRecordId;
      if (entityContext.type === 'PLATFORM') scopedPlatformId = resolvedEntityRecordId;
      if (entityContext.type === 'OFFICE') scopedOfficeId = resolvedEntityRecordId;
    }

    const result = await db.query(
      `INSERT INTO employees (
        employee_number, full_name, email, phone, national_id,
        position, department, assigned_entity_type,
        hq_id, branch_id, incubator_id, platform_id, office_id,
        hire_date, salary, employment_type, address,
        emergency_contact, emergency_phone
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19) 
      RETURNING *`,
      [
        employee_number, full_name, email, phone, national_id,
        position, department, scopedAssignedEntityType,
        scopedHqId, scopedBranchId, scopedIncubatorId, scopedPlatformId, scopedOfficeId,
        hire_date, salary, employment_type, address,
        emergency_contact, emergency_phone
      ]
    );
    res.status(201).json(result.rows[0]);
  } catch (error) {
    console.error('Employee creation error:', error.message, error.stack);
    res.status(500).json({ error: error.message, details: error.detail });
  }
});

// Update employee
app.put('/api/employees/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { 
      full_name, email, phone, position, department,
      salary, employment_type, is_active, address,
      emergency_contact, emergency_phone
    } = req.body;

    if (isTenantHostRequest(req)) {
      const tenantSessionUser = await requireTenantSessionUser(req, res);
      if (!tenantSessionUser) return;
      const { firstName, lastName } = splitFullName(full_name);
      const tenantResult = await req.tenantPool.query(
        `UPDATE employees SET
          first_name = COALESCE($1, first_name),
          last_name = COALESCE($2, last_name),
          email = COALESCE($3, email),
          phone = COALESCE($4, phone),
          job_title = COALESCE($5, job_title),
          basic_salary = COALESCE($6, basic_salary),
          employment_type = COALESCE($7, employment_type),
          status = CASE
            WHEN $8 IS NULL THEN status
            WHEN $8 = true THEN 'active'
            ELSE 'suspended'
          END,
          address = COALESCE($9, address),
          metadata = CASE
            WHEN $10 IS NULL THEN metadata
            ELSE jsonb_set(COALESCE(metadata, '{}'::jsonb), '{department}', to_jsonb($10::text), true)
          END,
          updated_at = CURRENT_TIMESTAMP
        WHERE id = $11
        RETURNING id`,
        [
          firstName || null,
          (firstName ? lastName : null),
          email,
          phone,
          position,
          salary,
          employment_type ? mapUiEmploymentTypeToTenant(employment_type) : null,
          typeof is_active === 'boolean' ? is_active : null,
          address,
          department || null,
          id
        ]
      );

      if (tenantResult.rows.length === 0) {
        return res.status(404).json({ error: 'الموظف غير موجود' });
      }

      return res.json({ success: true, id: tenantResult.rows[0].id });
    }

    if (!isHqEntityContext(req)) {
      const scopeCheck = await db.query(`
        SELECT emp.id
        FROM employees emp
        LEFT JOIN headquarters hq ON emp.hq_id = hq.id
        LEFT JOIN branches b ON emp.branch_id = b.id
        LEFT JOIN incubators i ON emp.incubator_id = i.id
        LEFT JOIN platforms p ON emp.platform_id = p.id
        LEFT JOIN offices o ON emp.office_id = o.id
        WHERE emp.id = $1
          AND COALESCE(hq.entity_id, b.entity_id, i.entity_id, p.entity_id, o.entity_id, 'HQ001') = $2
        LIMIT 1
      `, [id, getRequestEntityContext(req).id]);

      if (scopeCheck.rows.length === 0) {
        return res.status(404).json({ error: 'الموظف غير موجود' });
      }
    }

    const result = await db.query(
      `UPDATE employees SET
        full_name = COALESCE($1, full_name),
        email = COALESCE($2, email),
        phone = COALESCE($3, phone),
        position = COALESCE($4, position),
        department = COALESCE($5, department),
        salary = COALESCE($6, salary),
        employment_type = COALESCE($7, employment_type),
        is_active = COALESCE($8, is_active),
        address = COALESCE($9, address),
        emergency_contact = COALESCE($10, emergency_contact),
        emergency_phone = COALESCE($11, emergency_phone),
        updated_at = CURRENT_TIMESTAMP
      WHERE id = $12 RETURNING *`,
      [full_name, email, phone, position, department, salary, employment_type, is_active, address, emergency_contact, emergency_phone, id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'الموظف غير موجود' });
    }
    res.json(result.rows[0]);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Delete employee
app.delete('/api/employees/:id', async (req, res) => {
  try {
    const { id } = req.params;
    if (isTenantHostRequest(req)) {
      const tenantSessionUser = await requireTenantSessionUser(req, res);
      if (!tenantSessionUser) return;
      const tenantResult = await req.tenantPool.query(
        'DELETE FROM employees WHERE id = $1 RETURNING id',
        [id]
      );
      if (tenantResult.rows.length === 0) {
        return res.status(404).json({ error: 'الموظف غير موجود' });
      }
      return res.json({ message: 'تم حذف الموظف بنجاح' });
    }

    const params = [id];
    let query = 'DELETE FROM employees WHERE id = $1';

    if (!isHqEntityContext(req)) {
      const scopeCheck = await db.query(`
        SELECT emp.id
        FROM employees emp
        LEFT JOIN headquarters hq ON emp.hq_id = hq.id
        LEFT JOIN branches b ON emp.branch_id = b.id
        LEFT JOIN incubators i ON emp.incubator_id = i.id
        LEFT JOIN platforms p ON emp.platform_id = p.id
        LEFT JOIN offices o ON emp.office_id = o.id
        WHERE emp.id = $1
          AND COALESCE(hq.entity_id, b.entity_id, i.entity_id, p.entity_id, o.entity_id, 'HQ001') = $2
        LIMIT 1
      `, [id, getRequestEntityContext(req).id]);

      if (scopeCheck.rows.length === 0) {
        return res.status(404).json({ error: 'الموظف غير موجود' });
      }
    }

    query += ' RETURNING *';
    const result = await db.query(query, params);
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'الموظف غير موجود' });
    }
    res.json({ message: 'تم حذف الموظف بنجاح', data: result.rows[0] });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Get employees by entity
app.get('/api/entities/:entity_type/:entity_id/employees', async (req, res) => {
  try {
    const { entity_type, entity_id } = req.params;
    const result = await db.query(
      'SELECT * FROM employees_with_entity WHERE assigned_entity_type = $1 AND CASE WHEN $1 = \'HQ\' THEN hq_id = $2 WHEN $1 = \'BRANCH\' THEN branch_id = $2 WHEN $1 = \'INCUBATOR\' THEN incubator_id = $2 WHEN $1 = \'PLATFORM\' THEN platform_id = $2 WHEN $1 = \'OFFICE\' THEN office_id = $2 END',
      [entity_type.toUpperCase(), entity_id]
    );
    res.json(result.rows);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// ========================================
// ACCEPTED EMPLOYEES APIs
// ========================================

// List accepted employees (respect entity isolation)
app.get('/api/accepted-employees', async (req, res) => {
  try {
    const { search, entity_id } = req.query;
    const params = [];
    let idx = 1;
    let query = `
      SELECT id, full_name, job_title, email, phone, hire_date, entity_id, created_at, updated_at
      FROM accepted_employees
      WHERE 1=1
    `;

    if (req.userEntity.type !== 'HQ') {
      query += ` AND entity_id = $${idx}`;
      params.push(req.userEntity.id);
      idx++;
    } else if (entity_id) {
      query += ` AND entity_id = $${idx}`;
      params.push(entity_id);
      idx++;
    }

    if (search) {
      query += ` AND (full_name ILIKE $${idx} OR job_title ILIKE $${idx} OR email ILIKE $${idx} OR phone ILIKE $${idx})`;
      params.push(`%${search}%`);
      idx++;
    }

    query += ' ORDER BY hire_date DESC, id DESC';

    const { rows } = await db.query(query, params);
    res.json(rows);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Create accepted employee
app.post('/api/accepted-employees', async (req, res) => {
  try {
    const { full_name, job_title, email, phone, hire_date, entity_id } = req.body;

    if (!full_name || !job_title || !hire_date) {
      return res.status(400).json({ error: 'الاسم، الوظيفة، وتاريخ التعيين مطلوبة' });
    }

    const owningEntity = req.userEntity.type === 'HQ' ? (entity_id || 'HQ001') : req.userEntity.id;

    const { rows } = await db.query(
      `INSERT INTO accepted_employees (full_name, job_title, email, phone, hire_date, entity_id)
       VALUES ($1, $2, $3, $4, $5, $6)
       RETURNING id, full_name, job_title, email, phone, hire_date, entity_id, created_at, updated_at`,
      [full_name.trim(), job_title.trim(), email || null, phone || null, hire_date, owningEntity]
    );

    res.status(201).json(rows[0]);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Update accepted employee
app.put('/api/accepted-employees/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { full_name, job_title, email, phone, hire_date, entity_id } = req.body;

    const params = [
      full_name || null,
      job_title || null,
      email || null,
      phone || null,
      hire_date || null,
      req.userEntity.type === 'HQ' ? (entity_id || null) : req.userEntity.id,
      id
    ];

    let query = `
      UPDATE accepted_employees SET
        full_name = COALESCE($1, full_name),
        job_title = COALESCE($2, job_title),
        email = COALESCE($3, email),
        phone = COALESCE($4, phone),
        hire_date = COALESCE($5, hire_date),
        entity_id = COALESCE($6, entity_id),
        updated_at = CURRENT_TIMESTAMP
      WHERE id = $7
    `;

    if (req.userEntity.type !== 'HQ') {
      query += ' AND entity_id = $8';
      params.push(req.userEntity.id);
    }

    query += ' RETURNING id, full_name, job_title, email, phone, hire_date, entity_id, created_at, updated_at';

    const { rows } = await db.query(query, params);

    if (rows.length === 0) {
      return res.status(404).json({ error: 'الموظف غير موجود أو غير مسموح بتعديله' });
    }

    res.json(rows[0]);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Delete accepted employee
app.delete('/api/accepted-employees/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const params = [id];
    let query = 'DELETE FROM accepted_employees WHERE id = $1';

    if (req.userEntity.type !== 'HQ') {
      query += ' AND entity_id = $2';
      params.push(req.userEntity.id);
    }

    query += ' RETURNING id';

    const { rows } = await db.query(query, params);

    if (rows.length === 0) {
      return res.status(404).json({ error: 'الموظف غير موجود أو غير مسموح بحذفه' });
    }

    res.json({ message: 'تم حذف الموظف المقبول بنجاح' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// ========================================
// NEW HIRES APIs
// ========================================

// List new hires (respect entity isolation)
app.get('/api/new-hires', async (req, res) => {
  try {
    const { search, status, entity_id } = req.query;
    const params = [];
    let idx = 1;
    let query = `
      SELECT id, full_name, reference_code, phone, employee_info, interview_date, match_percent, status,
             decision_reason, decision_at, entity_id, created_at, updated_at
      FROM new_hires
      WHERE 1=1
    `;

    if (req.userEntity.type !== 'HQ') {
      query += ` AND entity_id = $${idx}`;
      params.push(req.userEntity.id);
      idx++;
    } else if (entity_id) {
      query += ` AND entity_id = $${idx}`;
      params.push(entity_id);
      idx++;
    }

    if (status && status !== 'all') {
      query += ` AND status = $${idx}`;
      params.push(status);
      idx++;
    }

    if (search) {
      query += ` AND (full_name ILIKE $${idx} OR reference_code ILIKE $${idx} OR phone ILIKE $${idx})`;
      params.push(`%${search}%`);
      idx++;
    }

    query += ' ORDER BY interview_date DESC, id DESC';

    const { rows } = await db.query(query, params);
    res.json(rows);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Create new hire
app.post('/api/new-hires', async (req, res) => {
  try {
    const {
      full_name,
      reference_code,
      phone,
      employee_info,
      interview_date,
      match_percent,
      status,
      decision_reason,
      entity_id
    } = req.body;

    if (!full_name || !reference_code || !interview_date) {
      return res.status(400).json({ error: 'الاسم، الرقم المرجعي، وموعد المقابلة مطلوبة' });
    }

    const owningEntity = req.userEntity.type === 'HQ' ? (entity_id || 'HQ001') : req.userEntity.id;

    const { rows } = await db.query(
      `INSERT INTO new_hires (
        full_name, reference_code, phone, employee_info, interview_date, match_percent, status, decision_reason, entity_id
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
      RETURNING id, full_name, reference_code, phone, employee_info, interview_date, match_percent, status,
                decision_reason, decision_at, entity_id, created_at, updated_at`,
      [
        full_name.trim(),
        reference_code.trim(),
        phone || null,
        employee_info || null,
        interview_date,
        match_percent !== undefined ? match_percent : null,
        status || 'pending',
        decision_reason || null,
        owningEntity
      ]
    );

    res.status(201).json(rows[0]);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Update new hire
app.put('/api/new-hires/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const {
      full_name,
      reference_code,
      phone,
      employee_info,
      interview_date,
      match_percent,
      status,
      decision_reason,
      entity_id
    } = req.body;

    const normalizedDecisionReason = decision_reason !== undefined && decision_reason !== null
      ? decision_reason.trim()
      : null;

    if (status === 'rejected' && (!normalizedDecisionReason || !normalizedDecisionReason.length)) {
      return res.status(400).json({ error: 'سبب الرفض مطلوب' });
    }

    const shouldStampDecision = status === 'accepted' || status === 'rejected';
    const decisionAt = shouldStampDecision ? new Date() : null;

    const params = [
      full_name || null,
      reference_code || null,
      phone || null,
      employee_info || null,
      interview_date || null,
      match_percent !== undefined ? match_percent : null,
      status || null,
      decision_reason !== undefined ? normalizedDecisionReason : null,
      decisionAt,
      req.userEntity.type === 'HQ' ? (entity_id || null) : req.userEntity.id,
      id
    ];

    let query = `
      UPDATE new_hires SET
        full_name = COALESCE($1, full_name),
        reference_code = COALESCE($2, reference_code),
        phone = COALESCE($3, phone),
        employee_info = COALESCE($4, employee_info),
        interview_date = COALESCE($5, interview_date),
        match_percent = COALESCE($6, match_percent),
        status = COALESCE($7, status),
        decision_reason = COALESCE($8, decision_reason),
        decision_at = COALESCE($9, decision_at),
        entity_id = COALESCE($10, entity_id),
        updated_at = CURRENT_TIMESTAMP
      WHERE id = $11
    `;

    if (req.userEntity.type !== 'HQ') {
      query += ' AND entity_id = $12';
      params.push(req.userEntity.id);
    }

    query += ' RETURNING id, full_name, reference_code, phone, employee_info, interview_date, match_percent, status, decision_reason, decision_at, entity_id, created_at, updated_at';

    const { rows } = await db.query(query, params);

    if (rows.length === 0) {
      return res.status(404).json({ error: 'المرشح غير موجود أو غير مسموح بتعديله' });
    }

    res.json(rows[0]);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Delete new hire
app.delete('/api/new-hires/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const params = [id];
    let query = 'DELETE FROM new_hires WHERE id = $1';

    if (req.userEntity.type !== 'HQ') {
      query += ' AND entity_id = $2';
      params.push(req.userEntity.id);
    }

    query += ' RETURNING id';

    const { rows } = await db.query(query, params);

    if (rows.length === 0) {
      return res.status(404).json({ error: 'المرشح غير موجود أو غير مسموح بحذفه' });
    }

    res.json({ message: 'تم حذف المرشح بنجاح' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// ========================================
// ATTENDANCE LOGS APIs
// ========================================

const computeWorkMinutes = (checkIn, checkOut) => {
  if (!checkIn || !checkOut) return null;
  const start = new Date(checkIn);
  const end = new Date(checkOut);
  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) return null;
  const diffMs = end.getTime() - start.getTime();
  if (diffMs <= 0) return null;
  return Math.round(diffMs / 60000);
};

// List attendance logs (respect entity isolation)
app.get('/api/attendance-logs', async (req, res) => {
  try {
    const { search, status, start_date, end_date, entity_id } = req.query;
    const params = [];
    let idx = 1;
    let query = `
            SELECT id, employee_id, employee_name, department, attendance_date, shift_type, check_in, check_out, work_minutes,
             status, decision_reason, decision_at, notes, entity_id, created_at, updated_at
      FROM attendance_logs
      WHERE 1=1
    `;

    if (req.userEntity.type !== 'HQ') {
      query += ` AND entity_id = $${idx}`;
      params.push(req.userEntity.id);
      idx++;
    } else if (entity_id) {
      query += ` AND entity_id = $${idx}`;
      params.push(entity_id);
      idx++;
    }

    if (status && status !== 'all') {
      query += ` AND status = $${idx}`;
      params.push(status);
      idx++;
    }

    if (start_date) {
      query += ` AND attendance_date >= $${idx}`;
      params.push(start_date);
      idx++;
    }

    if (end_date) {
      query += ` AND attendance_date <= $${idx}`;
      params.push(end_date);
      idx++;
    }

    if (search) {
      query += ` AND (employee_name ILIKE $${idx} OR employee_id ILIKE $${idx} OR department ILIKE $${idx})`;
      params.push(`%${search}%`);
      idx++;
    }

    query += ' ORDER BY attendance_date DESC, id DESC';

    const { rows } = await db.query(query, params);
    res.json(rows);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Create attendance log
app.post('/api/attendance-logs', async (req, res) => {
  try {
    const {
      employee_id,
      employee_name,
      department,
      shift_type,
      attendance_date,
      check_in,
      check_out,
      status,
      decision_reason,
      notes,
      entity_id
    } = req.body;

    if (!employee_name || !attendance_date) {
      return res.status(400).json({ error: 'اسم الموظف وتاريخ الحضور مطلوبان' });
    }

    const owningEntity = req.userEntity.type === 'HQ' ? (entity_id || 'HQ001') : req.userEntity.id;
    const workMinutes = computeWorkMinutes(check_in, check_out);

    const { rows } = await db.query(
      `INSERT INTO attendance_logs (
        employee_id, employee_name, department, shift_type, attendance_date, check_in, check_out,
        work_minutes, status, decision_reason, notes, entity_id
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
      RETURNING id, employee_id, employee_name, department, shift_type, attendance_date, check_in, check_out, work_minutes,
                status, decision_reason, decision_at, notes, entity_id, created_at, updated_at`,
      [
        employee_id || null,
        employee_name.trim(),
        department || null,
        shift_type || null,
        attendance_date,
        check_in || null,
        check_out || null,
        workMinutes,
        status || 'pending',
        decision_reason || null,
        notes || null,
        owningEntity
      ]
    );

    res.status(201).json(rows[0]);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Update attendance log
app.put('/api/attendance-logs/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const {
      employee_id,
      employee_name,
      department,
      shift_type,
      attendance_date,
      check_in,
      check_out,
      status,
      decision_reason,
      notes,
      entity_id
    } = req.body;

    const normalizedDecisionReason = decision_reason !== undefined && decision_reason !== null
      ? decision_reason.trim()
      : null;

    const shouldStampDecision = status === 'approved' || status === 'rejected' || status === 'APPROVED' || status === 'REJECTED';
    const decisionAt = shouldStampDecision ? new Date() : null;
    const workMinutes = computeWorkMinutes(check_in, check_out);

    const params = [
      employee_id || null,
      employee_name || null,
      department || null,
      shift_type || null,
      attendance_date || null,
      check_in || null,
      check_out || null,
      workMinutes,
      status || null,
      decision_reason !== undefined ? normalizedDecisionReason : null,
      decisionAt,
      notes || null,
      req.userEntity.type === 'HQ' ? (entity_id || null) : req.userEntity.id,
      id
    ];

    let query = `
      UPDATE attendance_logs SET
        employee_id = COALESCE($1, employee_id),
        employee_name = COALESCE($2, employee_name),
        department = COALESCE($3, department),
        shift_type = COALESCE($4, shift_type),
        attendance_date = COALESCE($5, attendance_date),
        check_in = COALESCE($6, check_in),
        check_out = COALESCE($7, check_out),
        work_minutes = COALESCE($8, work_minutes),
        status = COALESCE($9, status),
        decision_reason = COALESCE($10, decision_reason),
        decision_at = COALESCE($11, decision_at),
        notes = COALESCE($12, notes),
        entity_id = COALESCE($13, entity_id),
        updated_at = CURRENT_TIMESTAMP
      WHERE id = $14
    `;

    if (req.userEntity.type !== 'HQ') {
      query += ' AND entity_id = $15';
      params.push(req.userEntity.id);
    }

    query += ' RETURNING id, employee_id, employee_name, department, shift_type, attendance_date, check_in, check_out, work_minutes, status, decision_reason, decision_at, notes, entity_id, created_at, updated_at';

    const { rows } = await db.query(query, params);

    if (rows.length === 0) {
      return res.status(404).json({ error: 'السجل غير موجود أو غير مسموح بتعديله' });
    }

    res.json(rows[0]);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Delete attendance log
app.delete('/api/attendance-logs/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const params = [id];
    let query = 'DELETE FROM attendance_logs WHERE id = $1';

    if (req.userEntity.type !== 'HQ') {
      query += ' AND entity_id = $2';
      params.push(req.userEntity.id);
    }

    query += ' RETURNING id';

    const { rows } = await db.query(query, params);

    if (rows.length === 0) {
      return res.status(404).json({ error: 'السجل غير موجود أو غير مسموح بحذفه' });
    }

    res.json({ message: 'تم حذف السجل بنجاح' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// ========================================
// SHIFT SCHEDULES APIs
// ========================================

// List shift schedules (respect entity isolation)
app.get('/api/shift-schedules', async (req, res) => {
  try {
    const { search, status, entity_id } = req.query;
    const params = [];
    let idx = 1;
    let query = `
      SELECT id, employee_id, employee_name, department, work_days, off_days, shift_type,
             shift_start, shift_end, status, notes, entity_id, created_at, updated_at
      FROM shift_schedules
      WHERE 1=1
    `;

    if (req.userEntity.type !== 'HQ') {
      query += ` AND entity_id = $${idx}`;
      params.push(req.userEntity.id);
      idx++;
    } else if (entity_id) {
      query += ` AND entity_id = $${idx}`;
      params.push(entity_id);
      idx++;
    }

    if (status && status !== 'all') {
      query += ` AND status = $${idx}`;
      params.push(status);
      idx++;
    }

    if (search) {
      query += ` AND (employee_name ILIKE $${idx} OR employee_id ILIKE $${idx} OR department ILIKE $${idx})`;
      params.push(`%${search}%`);
      idx++;
    }

    query += ' ORDER BY employee_name ASC, id DESC';

    const { rows } = await db.query(query, params);
    res.json(rows);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Create shift schedule
app.post('/api/shift-schedules', async (req, res) => {
  try {
    const {
      employee_id,
      employee_name,
      department,
      work_days,
      off_days,
      shift_type,
      shift_start,
      shift_end,
      status,
      notes,
      entity_id
    } = req.body;

    if (!employee_name || !work_days || !Array.isArray(work_days) || work_days.length === 0) {
      return res.status(400).json({ error: 'اسم الموظف وأيام العمل مطلوبة' });
    }

    const owningEntity = req.userEntity.type === 'HQ' ? (entity_id || 'HQ001') : req.userEntity.id;

    const { rows } = await db.query(
      `INSERT INTO shift_schedules (
        employee_id, employee_name, department, work_days, off_days, shift_type,
        shift_start, shift_end, status, notes, entity_id
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
      RETURNING id, employee_id, employee_name, department, work_days, off_days, shift_type,
                shift_start, shift_end, status, notes, entity_id, created_at, updated_at`,
      [
        employee_id || null,
        employee_name.trim(),
        department || null,
        work_days,
        off_days || null,
        shift_type || null,
        shift_start || null,
        shift_end || null,
        status || 'active',
        notes || null,
        owningEntity
      ]
    );

    res.status(201).json(rows[0]);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Update shift schedule
app.put('/api/shift-schedules/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const {
      employee_id,
      employee_name,
      department,
      work_days,
      off_days,
      shift_type,
      shift_start,
      shift_end,
      status,
      notes,
      entity_id
    } = req.body;

    const params = [
      employee_id || null,
      employee_name || null,
      department || null,
      Array.isArray(work_days) ? work_days : null,
      Array.isArray(off_days) ? off_days : null,
      shift_type || null,
      shift_start || null,
      shift_end || null,
      status || null,
      notes || null,
      req.userEntity.type === 'HQ' ? (entity_id || null) : req.userEntity.id,
      id
    ];

    let query = `
      UPDATE shift_schedules SET
        employee_id = COALESCE($1, employee_id),
        employee_name = COALESCE($2, employee_name),
        department = COALESCE($3, department),
        work_days = COALESCE($4, work_days),
        off_days = COALESCE($5, off_days),
        shift_type = COALESCE($6, shift_type),
        shift_start = COALESCE($7, shift_start),
        shift_end = COALESCE($8, shift_end),
        status = COALESCE($9, status),
        notes = COALESCE($10, notes),
        entity_id = COALESCE($11, entity_id),
        updated_at = CURRENT_TIMESTAMP
      WHERE id = $12
    `;

    if (req.userEntity.type !== 'HQ') {
      query += ' AND entity_id = $13';
      params.push(req.userEntity.id);
    }

    query += ' RETURNING id, employee_id, employee_name, department, work_days, off_days, shift_type, shift_start, shift_end, status, notes, entity_id, created_at, updated_at';

    const { rows } = await db.query(query, params);

    if (rows.length === 0) {
      return res.status(404).json({ error: 'الجدول غير موجود أو غير مسموح بتعديله' });
    }

    res.json(rows[0]);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Delete shift schedule
app.delete('/api/shift-schedules/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const params = [id];
    let query = 'DELETE FROM shift_schedules WHERE id = $1';

    if (req.userEntity.type !== 'HQ') {
      query += ' AND entity_id = $2';
      params.push(req.userEntity.id);
    }

    query += ' RETURNING id';

    const { rows } = await db.query(query, params);

    if (rows.length === 0) {
      return res.status(404).json({ error: 'الجدول غير موجود أو غير مسموح بحذفه' });
    }

    res.json({ message: 'تم حذف الجدول بنجاح' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// ========================================
// LEAVE MANAGEMENT APIs
// ========================================

const computeLeaveDays = (startDate, endDate) => {
  if (!startDate || !endDate) return null;
  const start = new Date(startDate);
  const end = new Date(endDate);
  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) return null;
  const diffMs = end.getTime() - start.getTime();
  if (diffMs < 0) return null;
  return Math.floor(diffMs / 86400000) + 1;
};

// List leave balances (respect entity isolation)
app.get('/api/leave-balances', async (req, res) => {
  try {
    const { search, year, entity_id } = req.query;
    const params = [];
    let idx = 1;
    let query = `
      SELECT id, employee_id, employee_name, department, annual_days, used_days, pending_days,
             carry_over, year, notes, entity_id, created_at, updated_at
      FROM leave_balances
      WHERE 1=1
    `;

    if (req.userEntity.type !== 'HQ') {
      query += ` AND entity_id = $${idx}`;
      params.push(req.userEntity.id);
      idx++;
    } else if (entity_id) {
      query += ` AND entity_id = $${idx}`;
      params.push(entity_id);
      idx++;
    }

    if (year) {
      query += ` AND year = $${idx}`;
      params.push(Number(year));
      idx++;
    }

    if (search) {
      query += ` AND (employee_name ILIKE $${idx} OR employee_id ILIKE $${idx} OR department ILIKE $${idx})`;
      params.push(`%${search}%`);
      idx++;
    }

    query += ' ORDER BY employee_name ASC, year DESC';

    const { rows } = await db.query(query, params);
    res.json(rows);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Create leave balance
app.post('/api/leave-balances', async (req, res) => {
  try {
    const {
      employee_id,
      employee_name,
      department,
      annual_days,
      used_days,
      pending_days,
      carry_over,
      year,
      notes,
      entity_id
    } = req.body;

    if (!employee_name) {
      return res.status(400).json({ error: 'اسم الموظف مطلوب' });
    }

    const owningEntity = req.userEntity.type === 'HQ' ? (entity_id || 'HQ001') : req.userEntity.id;

    const { rows } = await db.query(
      `INSERT INTO leave_balances (
        employee_id, employee_name, department, annual_days, used_days, pending_days,
        carry_over, year, notes, entity_id
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
      RETURNING id, employee_id, employee_name, department, annual_days, used_days, pending_days,
                carry_over, year, notes, entity_id, created_at, updated_at`,
      [
        employee_id || null,
        employee_name.trim(),
        department || null,
        Number(annual_days) || 0,
        Number(used_days) || 0,
        Number(pending_days) || 0,
        Number(carry_over) || 0,
        Number(year) || new Date().getFullYear(),
        notes || null,
        owningEntity
      ]
    );

    res.status(201).json(rows[0]);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Update leave balance
app.put('/api/leave-balances/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const {
      employee_id,
      employee_name,
      department,
      annual_days,
      used_days,
      pending_days,
      carry_over,
      year,
      notes,
      entity_id
    } = req.body;

    const params = [
      employee_id || null,
      employee_name || null,
      department || null,
      annual_days !== undefined ? Number(annual_days) : null,
      used_days !== undefined ? Number(used_days) : null,
      pending_days !== undefined ? Number(pending_days) : null,
      carry_over !== undefined ? Number(carry_over) : null,
      year !== undefined ? Number(year) : null,
      notes || null,
      req.userEntity.type === 'HQ' ? (entity_id || null) : req.userEntity.id,
      id
    ];

    let query = `
      UPDATE leave_balances SET
        employee_id = COALESCE($1, employee_id),
        employee_name = COALESCE($2, employee_name),
        department = COALESCE($3, department),
        annual_days = COALESCE($4, annual_days),
        used_days = COALESCE($5, used_days),
        pending_days = COALESCE($6, pending_days),
        carry_over = COALESCE($7, carry_over),
        year = COALESCE($8, year),
        notes = COALESCE($9, notes),
        entity_id = COALESCE($10, entity_id),
        updated_at = CURRENT_TIMESTAMP
      WHERE id = $11
    `;

    if (req.userEntity.type !== 'HQ') {
      query += ' AND entity_id = $12';
      params.push(req.userEntity.id);
    }

    query += ' RETURNING id, employee_id, employee_name, department, annual_days, used_days, pending_days, carry_over, year, notes, entity_id, created_at, updated_at';

    const { rows } = await db.query(query, params);

    if (rows.length === 0) {
      return res.status(404).json({ error: 'الرصيد غير موجود أو غير مسموح بتعديله' });
    }

    res.json(rows[0]);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Delete leave balance
app.delete('/api/leave-balances/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const params = [id];
    let query = 'DELETE FROM leave_balances WHERE id = $1';

    if (req.userEntity.type !== 'HQ') {
      query += ' AND entity_id = $2';
      params.push(req.userEntity.id);
    }

    query += ' RETURNING id';

    const { rows } = await db.query(query, params);

    if (rows.length === 0) {
      return res.status(404).json({ error: 'الرصيد غير موجود أو غير مسموح بحذفه' });
    }

    res.json({ message: 'تم حذف الرصيد بنجاح' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// List leave requests (respect entity isolation)
app.get('/api/leave-requests', async (req, res) => {
  try {
    const { status, search, upcoming, history, pending, from_date, to_date, entity_id } = req.query;
    const params = [];
    let idx = 1;
    let query = `
      SELECT id, employee_id, employee_name, department, leave_type, start_date, end_date,
             days_count, reason, status, decision_reason, decision_at, reviewed_by,
             entity_id, created_at, updated_at
      FROM leave_requests
      WHERE 1=1
    `;

    if (req.userEntity.type !== 'HQ') {
      query += ` AND entity_id = $${idx}`;
      params.push(req.userEntity.id);
      idx++;
    } else if (entity_id) {
      query += ` AND entity_id = $${idx}`;
      params.push(entity_id);
      idx++;
    }

    if (status) {
      query += ` AND status = $${idx}`;
      params.push(status);
      idx++;
    }

    if (pending === 'true') {
      query += ` AND status = $${idx}`;
      params.push('pending');
      idx++;
    }

    if (upcoming === 'true') {
      query += ` AND status = $${idx} AND start_date >= CURRENT_DATE`;
      params.push('approved');
      idx++;
    }

    if (history === 'true') {
      query += ` AND status = $${idx} AND end_date < CURRENT_DATE`;
      params.push('approved');
      idx++;
    }

    if (from_date) {
      query += ` AND start_date >= $${idx}`;
      params.push(from_date);
      idx++;
    }

    if (to_date) {
      query += ` AND end_date <= $${idx}`;
      params.push(to_date);
      idx++;
    }

    if (search) {
      query += ` AND (employee_name ILIKE $${idx} OR employee_id ILIKE $${idx} OR department ILIKE $${idx})`;
      params.push(`%${search}%`);
      idx++;
    }

    query += ' ORDER BY start_date DESC, id DESC';

    const { rows } = await db.query(query, params);
    res.json(rows);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Create leave request
app.post('/api/leave-requests', async (req, res) => {
  const client = await db.connect();
  try {
    const {
      employee_id,
      employee_name,
      department,
      leave_type,
      start_date,
      end_date,
      days_count,
      reason,
      status,
      entity_id
    } = req.body;

    if (!employee_name || !start_date || !end_date) {
      client.release();
      return res.status(400).json({ error: 'اسم الموظف وتواريخ الإجازة مطلوبة' });
    }

    const computedDays = Number(days_count) || computeLeaveDays(start_date, end_date) || 0;
    const owningEntity = req.userEntity.type === 'HQ' ? (entity_id || 'HQ001') : req.userEntity.id;
    const mapLeaveStatus = (value) => {
      const normalized = (value || 'pending').toString().toLowerCase();
      if (normalized === 'approved') return 'APPROVED';
      if (normalized === 'rejected') return 'REJECTED';
      return 'PENDING';
    };

    await client.query('BEGIN');

    const { rows } = await client.query(
      `INSERT INTO leave_requests (
        employee_id, employee_name, department, leave_type, start_date, end_date,
        days_count, reason, status, entity_id
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
      RETURNING id, employee_id, employee_name, department, leave_type, start_date, end_date,
                days_count, reason, status, decision_reason, decision_at, reviewed_by,
                entity_id, created_at, updated_at`,
      [
        employee_id || null,
        employee_name.trim(),
        department || null,
        leave_type || null,
        start_date,
        end_date,
        computedDays,
        reason || null,
        status || 'pending',
        owningEntity
      ]
    );

    const leaveRecord = rows[0];
    const employeeRequestId = `LR-${leaveRecord.id}`;
    const employeeStatus = mapLeaveStatus(status);
    const requestTitle = leave_type ? `طلب اجازة (${leave_type})` : 'طلب اجازة';

    await client.query(
      `INSERT INTO employee_requests (
        id, entity_id, employee_id, employee_name, request_type, request_title,
        description, status, priority, request_data, requires_approval,
        requested_date, start_date, end_date, notes, created_by
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, 'NORMAL', $9, $10, CURRENT_DATE, $11, $12, $13, $14)
      ON CONFLICT (id) DO NOTHING`,
      [
        employeeRequestId,
        owningEntity,
        employee_id || null,
        employee_name.trim(),
        'إجازة',
        requestTitle,
        reason || null,
        employeeStatus,
        JSON.stringify({ leave_request_id: leaveRecord.id, leave_type: leave_type || null, days_count: computedDays }),
        true,
        start_date,
        end_date,
        null,
        null
      ]
    );

    const yearValue = new Date(start_date).getFullYear();
    const balanceResult = await client.query(
      `UPDATE leave_balances
       SET pending_days = COALESCE(pending_days, 0) + $1,
           updated_at = CURRENT_TIMESTAMP
       WHERE entity_id = $2 AND employee_name = $3 AND year = $4
       RETURNING id`,
      [computedDays, owningEntity, employee_name.trim(), yearValue]
    );

    if (!balanceResult.rows.length) {
      await client.query(
        `INSERT INTO leave_balances
         (employee_id, employee_name, department, annual_days, used_days, pending_days, carry_over, year, entity_id)
         VALUES ($1, $2, $3, 0, 0, $4, 0, $5, $6)`,
        [employee_id || null, employee_name.trim(), department || null, computedDays, yearValue, owningEntity]
      );
    }

    await client.query('COMMIT');
    res.status(201).json(leaveRecord);
  } catch (error) {
    await client.query('ROLLBACK');
    res.status(500).json({ error: error.message });
  } finally {
    client.release();
  }
});

// Update leave request
app.put('/api/leave-requests/:id', async (req, res) => {
  const client = await db.connect();
  try {
    const { id } = req.params;
    const {
      employee_id,
      employee_name,
      department,
      leave_type,
      start_date,
      end_date,
      days_count,
      reason,
      status,
      decision_reason,
      reviewed_by,
      entity_id
    } = req.body;

    await client.query('BEGIN');

    const existing = await client.query(
      'SELECT * FROM leave_requests WHERE id = $1',
      [id]
    );

    if (!existing.rows.length) {
      await client.query('ROLLBACK');
      return res.status(404).json({ error: 'طلب الإجازة غير موجود' });
    }

    const current = existing.rows[0];
    const updatedStatus = status || current.status;
    const updatedStart = start_date || current.start_date;
    const updatedEnd = end_date || current.end_date;
    const updatedDays = Number(days_count) || computeLeaveDays(updatedStart, updatedEnd) || current.days_count || 0;
    const owningEntity = req.userEntity.type === 'HQ' ? (entity_id || current.entity_id) : req.userEntity.id;
    const yearValue = new Date(updatedStart).getFullYear();
    const mapLeaveStatus = (value) => {
      const normalized = (value || 'pending').toString().toLowerCase();
      if (normalized === 'approved') return 'APPROVED';
      if (normalized === 'rejected') return 'REJECTED';
      return 'PENDING';
    };

    let decisionAt = current.decision_at;
    if (current.status === 'pending' && (updatedStatus === 'approved' || updatedStatus === 'rejected')) {
      decisionAt = new Date();
    }

    const params = [
      employee_id || null,
      employee_name || null,
      department || null,
      leave_type || null,
      updatedStart,
      updatedEnd,
      updatedDays,
      reason || null,
      updatedStatus,
      decision_reason || null,
      decisionAt,
      reviewed_by || null,
      owningEntity,
      id
    ];

    let query = `
      UPDATE leave_requests SET
        employee_id = COALESCE($1, employee_id),
        employee_name = COALESCE($2, employee_name),
        department = COALESCE($3, department),
        leave_type = COALESCE($4, leave_type),
        start_date = $5,
        end_date = $6,
        days_count = $7,
        reason = COALESCE($8, reason),
        status = COALESCE($9, status),
        decision_reason = COALESCE($10, decision_reason),
        decision_at = $11,
        reviewed_by = COALESCE($12, reviewed_by),
        entity_id = COALESCE($13, entity_id),
        updated_at = CURRENT_TIMESTAMP
      WHERE id = $14
    `;

    if (req.userEntity.type !== 'HQ') {
      query += ' AND entity_id = $15';
      params.push(req.userEntity.id);
    }

    query += ' RETURNING id, employee_id, employee_name, department, leave_type, start_date, end_date, days_count, reason, status, decision_reason, decision_at, reviewed_by, entity_id, created_at, updated_at';

    const updated = await client.query(query, params);

    if (!updated.rows.length) {
      await client.query('ROLLBACK');
      return res.status(404).json({ error: 'طلب الإجازة غير موجود أو غير مسموح بتعديله' });
    }

    const employeeRequestId = `LR-${id}`;
    const employeeStatus = mapLeaveStatus(updatedStatus);
    const mergedLeaveType = leave_type || current.leave_type || null;
    const requestTitle = mergedLeaveType ? `طلب اجازة (${mergedLeaveType})` : 'طلب اجازة';
    const requestData = JSON.stringify({ leave_request_id: current.id, leave_type: mergedLeaveType, days_count: updatedDays });

    await client.query(
      `INSERT INTO employee_requests (
        id, entity_id, employee_id, employee_name, request_type, request_title,
        description, status, priority, request_data, requires_approval,
        requested_date, start_date, end_date, notes, created_by
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, 'NORMAL', $9, $10, CURRENT_DATE, $11, $12, $13, $14)
      ON CONFLICT (id) DO UPDATE SET
        status = EXCLUDED.status,
        request_title = EXCLUDED.request_title,
        description = COALESCE(EXCLUDED.description, employee_requests.description),
        request_data = EXCLUDED.request_data,
        start_date = EXCLUDED.start_date,
        end_date = EXCLUDED.end_date,
        approval_notes = COALESCE($15, employee_requests.approval_notes),
        approver_name = COALESCE($16, employee_requests.approver_name),
        approval_date = CASE WHEN EXCLUDED.status IN ('APPROVED', 'REJECTED') THEN CURRENT_TIMESTAMP ELSE employee_requests.approval_date END,
        updated_at = CURRENT_TIMESTAMP`,
      [
        employeeRequestId,
        owningEntity,
        employee_id || current.employee_id || null,
        employee_name || current.employee_name,
        'إجازة',
        requestTitle,
        reason || null,
        employeeStatus,
        requestData,
        true,
        updatedStart,
        updatedEnd,
        null,
        null,
        decision_reason || null,
        reviewed_by || null
      ]
    );

    if (current.status === 'pending' && updatedStatus !== 'pending') {
      const pendingDays = current.days_count || updatedDays;
      const pendingDelta = -Math.abs(pendingDays);
      const usedDelta = updatedStatus === 'approved' ? Math.abs(updatedDays) : 0;

      await client.query(
        `UPDATE leave_balances
         SET pending_days = GREATEST(COALESCE(pending_days, 0) + $1, 0),
             used_days = GREATEST(COALESCE(used_days, 0) + $2, 0),
             updated_at = CURRENT_TIMESTAMP
         WHERE entity_id = $3 AND employee_name = $4 AND year = $5`,
        [pendingDelta, usedDelta, owningEntity, (employee_name || current.employee_name), yearValue]
      );
    }

    await client.query('COMMIT');
    res.json(updated.rows[0]);
  } catch (error) {
    await client.query('ROLLBACK');
    res.status(500).json({ error: error.message });
  } finally {
    client.release();
  }
});

// Delete leave request
app.delete('/api/leave-requests/:id', async (req, res) => {
  const client = await db.connect();
  try {
    const { id } = req.params;
    await client.query('BEGIN');

    const existing = await client.query('SELECT * FROM leave_requests WHERE id = $1', [id]);
    if (!existing.rows.length) {
      await client.query('ROLLBACK');
      return res.status(404).json({ error: 'طلب الإجازة غير موجود' });
    }

    const request = existing.rows[0];
    if (req.userEntity.type !== 'HQ' && request.entity_id !== req.userEntity.id) {
      await client.query('ROLLBACK');
      return res.status(404).json({ error: 'طلب الإجازة غير موجود أو غير مسموح بحذفه' });
    }

    await client.query('DELETE FROM leave_requests WHERE id = $1', [id]);
    await client.query('DELETE FROM employee_requests WHERE id = $1', [`LR-${id}`]);

    if (request.status === 'pending') {
      const yearValue = new Date(request.start_date).getFullYear();
      await client.query(
        `UPDATE leave_balances
         SET pending_days = GREATEST(COALESCE(pending_days, 0) - $1, 0),
             updated_at = CURRENT_TIMESTAMP
         WHERE entity_id = $2 AND employee_name = $3 AND year = $4`,
        [request.days_count || 0, request.entity_id, request.employee_name, yearValue]
      );
    }

    await client.query('COMMIT');
    res.json({ message: 'تم حذف طلب الإجازة بنجاح' });
  } catch (error) {
    await client.query('ROLLBACK');
    res.status(500).json({ error: error.message });
  } finally {
    client.release();
  }
});

// ========================================
// ENHANCED USERS APIs (with entity relationships)
// ========================================

// Update user to link with new entities
app.put('/api/users/:id/link-entity', async (req, res) => {
  try {
    const { id } = req.params;
    const { entity_type, branch_id, incubator_id, platform_id, office_id } = req.body;

    const result = await db.query(
      `UPDATE users SET
        branch_id = $1,
        incubator_id = $2,
        platform_id = $3,
        office_id = $4,
        linked_entity_type = $5,
        updated_at = CURRENT_TIMESTAMP
      WHERE id = $6 RETURNING *`,
      [branch_id, incubator_id, platform_id, office_id, entity_type, id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'المستخدم غير موجود' });
    }
    res.json(result.rows[0]);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Get users with full entity details
app.get('/api/users-with-entity', async (req, res) => {
  try {
    const { entity_type, is_active } = req.query;
    let query = 'SELECT * FROM users_with_entity WHERE 1=1';
    const params = [];
    const requestEntityId = getRequestEntityContext(req).id;

    if (entity_type) {
      query += ' AND (linked_entity_type = $1 OR tenant_type = $1)';
      params.push(entity_type);
    }

    if (is_active !== undefined) {
      query += ` AND is_active = $${params.length + 1}`;
      params.push(is_active === 'true');
    }

    if (!isHqEntityContext(req)) {
      query += ` AND linked_entity_id = $${params.length + 1}`;
      params.push(requestEntityId);
    }

    query += ' ORDER BY name';

    const result = await db.query(query, params);
    res.json(result.rows);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// ========================================
// ENHANCED INVOICES APIs (with entity relationships)
// ========================================

// Get invoices with full details
app.get('/api/invoices-with-details', async (req, res) => {
  try {
    const { entity_type, status, user_id } = req.query;
    let query = 'SELECT * FROM invoices_with_details WHERE 1=1';
    const params = [];
    let paramIndex = 1;

    if (entity_type) {
      query += ` AND issuer_entity_type = $${paramIndex}`;
      params.push(entity_type);
      paramIndex++;
    }

    if (status) {
      query += ` AND status = $${paramIndex}`;
      params.push(status);
      paramIndex++;
    }

    if (user_id) {
      query += ` AND user_id = $${paramIndex}`;
      params.push(user_id);
      paramIndex++;
    }

    if (!isHqEntityContext(req)) {
      query += ` AND issuer_entity_id = $${paramIndex}`;
      params.push(getRequestEntityContext(req).id);
      paramIndex++;
    }

    query += ' ORDER BY issue_date DESC';

    const result = await db.query(query, params);
    res.json(result.rows);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Link invoice to user and entity
app.put('/api/invoices/:id/link', async (req, res) => {
  try {
    const { id } = req.params;
    const { user_id, branch_id, office_id, incubator_id, issuer_entity_type } = req.body;

    const result = await db.query(
      `UPDATE invoices SET
        user_id = $1,
        branch_id = $2,
        office_id = $3,
        incubator_id = $4,
        issuer_entity_type = $5,
        updated_at = CURRENT_TIMESTAMP
      WHERE id = $6 RETURNING *`,
      [user_id, branch_id, office_id, incubator_id, issuer_entity_type, id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'الفاتورة غير موجودة' });
    }
    res.json(result.rows[0]);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// ========================================
// ENHANCED ADS APIs (with entity relationships)
// ========================================

// Get ads with source entity details
app.get('/api/ads-with-source', async (req, res) => {
  try {
    const { entity_type, status } = req.query;
    let query = 'SELECT * FROM ads_with_source WHERE 1=1';
    const params = [];
    let paramIndex = 1;

    if (entity_type) {
      query += ` AND ad_source_entity_type = $${paramIndex}`;
      params.push(entity_type);
      paramIndex++;
    }

    if (status) {
      query += ` AND status = $${paramIndex}`;
      params.push(status);
      paramIndex++;
    }

    if (!isHqEntityContext(req)) {
      query += ` AND source_entity_id = $${paramIndex}`;
      params.push(getRequestEntityContext(req).id);
      paramIndex++;
    }

    query += ' ORDER BY created_at DESC';

    const result = await db.query(query, params);
    res.json(result.rows);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Link ad to new hierarchy entity
app.put('/api/ads/:id/link-source', async (req, res) => {
  try {
    const { id } = req.params;
    const { entity_type, hq_id, branch_id, incubator_id, platform_id, office_id } = req.body;

    const result = await db.query(
      `UPDATE ads SET
        hq_id = $1,
        new_branch_id = $2,
        new_incubator_id = $3,
        new_platform_id = $4,
        new_office_id = $5,
        ad_source_entity_type = $6,
        updated_at = CURRENT_TIMESTAMP
      WHERE id = $7 RETURNING *`,
      [hq_id, branch_id, incubator_id, platform_id, office_id, entity_type, id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'الإعلان غير موجود' });
    }
    res.json(result.rows[0]);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// ========================================
// DASHBOARD ENDPOINTS
// ========================================

// Incubator Dashboard - Customer Journey & Programs
app.get('/api/dashboard/incubator', async (req, res) => {
  try {
    const { entity_id } = req.query;
    const entityFilter = entity_id || req.userEntity.id;
    
    // Get beneficiaries (customers) with their journey status
    const beneficiariesResult = await db.query(`
      SELECT 
        b.*,
        b.full_name as name,
        COUNT(DISTINCT e.id) as enrollment_count,
        COUNT(DISTINCT ts.id) as sessions_attended,
        COALESCE(AVG(e.attendance_percentage), 0) as avg_completion
      FROM beneficiaries b
      LEFT JOIN enrollments e ON e.beneficiary_id = b.id
      LEFT JOIN training_sessions ts ON ts.id = e.session_id
      WHERE b.entity_id = $1
      GROUP BY b.id, b.full_name
      ORDER BY b.created_at DESC
    `, [entityFilter]);
    
    // Get training programs
    const programsResult = await db.query(`
      SELECT 
        tp.*,
        COUNT(DISTINCT ts.id) as total_sessions,
        COUNT(DISTINCT e.beneficiary_id) as total_beneficiaries,
        COALESCE(AVG(e.attendance_percentage), 0) as avg_completion_rate
      FROM training_programs tp
      LEFT JOIN training_sessions ts ON ts.program_id = tp.id
      LEFT JOIN enrollments e ON e.session_id = ts.id
      WHERE tp.entity_id = $1
      GROUP BY tp.id
      ORDER BY tp.created_at DESC
    `, [entityFilter]);
    
    // Get recent sessions
    const sessionsResult = await db.query(`
      SELECT 
        ts.*,
        tp.name as program_name,
        COUNT(DISTINCT e.beneficiary_id) as attendees_count
      FROM training_sessions ts
      JOIN training_programs tp ON tp.id = ts.program_id
      LEFT JOIN enrollments e ON e.session_id = ts.id
      WHERE ts.entity_id = $1
      GROUP BY ts.id, tp.name
      ORDER BY ts.start_date DESC
      LIMIT 10
    `, [entityFilter]);
    
    // Get statistics
    const statsResult = await db.query(`
      SELECT 
        (SELECT COUNT(*) FROM beneficiaries WHERE entity_id = $1) as total_beneficiaries,
        (SELECT COUNT(*) FROM training_programs WHERE entity_id = $1) as total_programs,
        (SELECT COUNT(*) FROM training_sessions WHERE entity_id = $1) as total_sessions,
        (SELECT COUNT(*) FROM enrollments e JOIN training_sessions ts ON ts.id = e.session_id WHERE ts.entity_id = $1) as total_enrollments,
        COALESCE((SELECT AVG(attendance_percentage) FROM enrollments e JOIN training_sessions ts ON ts.id = e.session_id WHERE ts.entity_id = $1), 0) as overall_completion_rate
    `, [entityFilter]);
    
    res.json({
      beneficiaries: beneficiariesResult.rows,
      programs: programsResult.rows,
      recent_sessions: sessionsResult.rows,
      statistics: statsResult.rows[0] || {}
    });
  } catch (error) {
    console.error('Incubator dashboard error:', error);
    res.status(500).json({ error: error.message });
  }
});

// Platform Dashboard - Services/Content/Subscriptions
app.get('/api/dashboard/platform', async (req, res) => {
  try {
    const { entity_id } = req.query;
    const entityFilter = entity_id || req.userEntity.id;
    
    // Get services/products
    const servicesResult = await db.query(`
      SELECT 
        *
      FROM ads
      WHERE entity_id = $1 AND level = 'Platform'
      ORDER BY created_at DESC
    `, [entityFilter]);
    
    // Get subscriptions (from enrollments - treating them as subscriptions)
    const subscriptionsResult = await db.query(`
      SELECT 
        e.*,
        b.full_name as customer_name,
        b.email as customer_email,
        tp.name as service_name,
        tp.price
      FROM enrollments e
      JOIN beneficiaries b ON b.id = e.beneficiary_id
      JOIN training_sessions ts ON ts.id = e.session_id
      JOIN training_programs tp ON tp.id = ts.program_id
      WHERE ts.entity_id = $1
      ORDER BY e.created_at DESC
    `, [entityFilter]);
    
    // Get content/ads statistics
    const contentResult = await db.query(`
      SELECT 
        status,
        COUNT(*) as count,
        COUNT(*) FILTER (WHERE created_at >= NOW() - INTERVAL '7 days') as new_this_week
      FROM ads
      WHERE entity_id = $1
      GROUP BY status
    `, [entityFilter]);
    
    // Get revenue statistics (from transactions)
    const revenueResult = await db.query(`
      SELECT 
        COALESCE(SUM(amount), 0) as total_revenue,
        COALESCE(SUM(amount) FILTER (WHERE transaction_date >= NOW() - INTERVAL '30 days'), 0) as monthly_revenue,
        COUNT(*) as total_transactions,
        COUNT(*) FILTER (WHERE transaction_date >= NOW() - INTERVAL '30 days') as monthly_transactions
      FROM transactions
      WHERE entity_id = $1 AND type = 'income'
    `, [entityFilter]);
    
    // Get statistics
    const statsResult = await db.query(`
      SELECT 
        (SELECT COUNT(*) FROM ads WHERE entity_id = $1 AND level = 'Platform') as total_services,
        (SELECT COUNT(*) FROM enrollments e JOIN training_sessions ts ON ts.id = e.session_id WHERE ts.entity_id = $1) as active_subscriptions,
        (SELECT COUNT(*) FROM beneficiaries WHERE entity_id = $1) as total_customers,
        COALESCE((SELECT SUM(amount) FROM transactions WHERE entity_id = $1 AND type = 'income'), 0) as total_revenue
    `, [entityFilter]);
    
    res.json({
      services: servicesResult.rows,
      subscriptions: subscriptionsResult.rows,
      content_stats: contentResult.rows,
      revenue: revenueResult.rows[0] || {},
      statistics: statsResult.rows[0] || {}
    });
  } catch (error) {
    console.error('Platform dashboard error:', error);
    res.status(500).json({ error: error.message });
  }
});

// Office Dashboard - Service Execution & Customer Appointments
app.get('/api/dashboard/office', async (req, res) => {
  try {
    const { entity_id } = req.query;
    const entityFilter = entity_id || req.userEntity.id;
    
    // Get upcoming appointments (training sessions as appointments)
    const appointmentsResult = await db.query(`
      SELECT 
        ts.*,
        tp.name as service_name,
        tp.description,
        ts.current_participants as booked_slots,
        ts.max_participants as total_slots
      FROM training_sessions ts
      JOIN training_programs tp ON tp.id = ts.program_id
      WHERE ts.entity_id = $1
      ORDER BY ts.start_date ASC
    `, [entityFilter]);
    
    // Get customers with their appointments
    const customersResult = await db.query(`
      SELECT 
        b.*,
        b.full_name as name,
        COUNT(DISTINCT e.id) as total_bookings,
        COUNT(DISTINCT e.id) FILTER (WHERE e.status = 'active') as active_bookings,
        MAX(ts.start_date) as last_visit
      FROM beneficiaries b
      LEFT JOIN enrollments e ON e.beneficiary_id = b.id
      LEFT JOIN training_sessions ts ON ts.id = e.session_id
      WHERE b.entity_id = $1
      GROUP BY b.id, b.full_name
      ORDER BY last_visit DESC NULLS LAST
    `, [entityFilter]);
    
    // Get service execution status
    const executionResult = await db.query(`
      SELECT 
        ts.status,
        COUNT(*) as count,
        COUNT(*) FILTER (WHERE ts.start_date >= NOW()) as upcoming,
        COUNT(*) FILTER (WHERE ts.end_date < NOW()) as completed
      FROM training_sessions ts
      WHERE ts.entity_id = $1
      GROUP BY ts.status
    `, [entityFilter]);
    
    // Get daily schedule (today's appointments)
    const todayScheduleResult = await db.query(`
      SELECT 
        ts.*,
        tp.name as service_name,
        tp.duration_hours as duration,
        ts.current_participants as attendees
      FROM training_sessions ts
      JOIN training_programs tp ON tp.id = ts.program_id
      WHERE ts.entity_id = $1 
        AND DATE(ts.start_date) = CURRENT_DATE
      ORDER BY ts.start_date ASC
    `, [entityFilter]);
    
    // Get statistics
    const statsResult = await db.query(`
      SELECT 
        (SELECT COUNT(*) FROM training_sessions WHERE entity_id = $1) as total_appointments,
        (SELECT COUNT(*) FROM training_sessions WHERE entity_id = $1 AND start_date >= NOW()) as upcoming_appointments,
        (SELECT COUNT(*) FROM training_sessions WHERE entity_id = $1 AND DATE(start_date) = CURRENT_DATE) as today_appointments,
        (SELECT COUNT(*) FROM beneficiaries WHERE entity_id = $1) as total_customers,
        (SELECT COUNT(*) FROM enrollments e JOIN training_sessions ts ON ts.id = e.session_id WHERE ts.entity_id = $1 AND e.status = 'active') as active_services
    `, [entityFilter]);
    
    res.json({
      appointments: appointmentsResult.rows,
      customers: customersResult.rows,
      execution_status: executionResult.rows,
      today_schedule: todayScheduleResult.rows,
      statistics: statsResult.rows[0] || {}
    });
  } catch (error) {
    console.error('Office dashboard error:', error);
    res.status(500).json({ error: error.message });
  }
});

// Get dashboard type based on entity
app.get('/api/dashboard/type', async (req, res) => {
  try {
    const { entity_id } = req.query;
    const entityFilter = entity_id || req.userEntity.id;
    
    // Get entity information to determine dashboard type
    const entityResult = await db.query(`
      SELECT type, name FROM entities WHERE id = $1
    `, [entityFilter]);
    
    if (entityResult.rows.length === 0) {
      return res.status(404).json({ error: 'Entity not found' });
    }
    
    const entity = entityResult.rows[0];
    let dashboardType = 'general';
    
    // Determine dashboard type based on entity type
    if (entity.type === 'INCUBATOR') {
      dashboardType = 'incubator';
    } else if (entity.type === 'PLATFORM') {
      dashboardType = 'platform';
    } else if (entity.type === 'OFFICE') {
      dashboardType = 'office';
    }
    
    res.json({
      entity_id: entityFilter,
      entity_type: entity.type,
      entity_name: entity.name,
      dashboard_type: dashboardType
    });
  } catch (error) {
    console.error('Dashboard type error:', error);
    res.status(500).json({ error: error.message });
  }
});

// ========================================
// INCUBATOR SYSTEM ENDPOINTS
// ========================================

// Get incubator stats
app.get('/api/incubator/stats', async (req, res) => {
  try {
    const entityId = req.query.entity_id;
    
    if (!entityId) {
      return res.status(400).json({ error: 'entity_id is required' });
    }
    
    const filter = getEntityFilter(req.userEntity);
    
    // Get counts from database
    const programsResult = await db.query(
      `SELECT COUNT(*) as count FROM training_programs WHERE ${filter} AND is_active = true`
    );
    
    const beneficiariesResult = await db.query(
      `SELECT COUNT(*) as count FROM beneficiaries WHERE ${filter} AND status = 'ACTIVE'`
    );
    
    const sessionsResult = await db.query(
      `SELECT COUNT(*) as count FROM training_sessions WHERE ${filter} AND status = 'IN_PROGRESS'`
    );
    
    const certificatesResult = await db.query(
      `SELECT COUNT(*) as count FROM certificates WHERE ${filter} AND status = 'VALID'`
    );
    
    res.json({
      total_programs: parseInt(programsResult.rows[0]?.count || 0),
      total_beneficiaries: parseInt(beneficiariesResult.rows[0]?.count || 0),
      active_sessions: parseInt(sessionsResult.rows[0]?.count || 0),
      active_certificates: parseInt(certificatesResult.rows[0]?.count || 0),
      expired_certificates: 0
    });
  } catch (error) {
    console.error('Error fetching incubator stats:', error);
    res.status(500).json({ error: error.message });
  }
});

// Training Programs
app.get('/api/training-programs', async (req, res) => {
  try {
    const filter = getEntityFilter(req.userEntity);
    const result = await db.query(
      `SELECT * FROM training_programs WHERE ${filter} ORDER BY created_at DESC`
    );
    res.json(result.rows);
  } catch (error) {
    console.error('Error fetching training programs:', error);
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/training-programs', async (req, res) => {
  try {
    const { entity_id, name, code, description, duration_hours, max_participants, price, passing_score, certificate_validity_months, is_active } = req.body;
    
    const result = await db.query(
      `INSERT INTO training_programs (
        entity_id, name, code, description, duration_hours, max_participants, 
        price, passing_score, certificate_validity_months, is_active,
        incubator_id
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11) RETURNING *`,
      [entity_id, name, code, description, duration_hours, max_participants, price, passing_score, certificate_validity_months, is_active || true, entity_id]
    );
    
    res.status(201).json(result.rows[0]);
  } catch (error) {
    console.error('Error creating training program:', error);
    res.status(500).json({ error: error.message });
  }
});

// Update training program
app.put('/api/training-programs/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { name, code, description, duration_hours, max_participants, price, passing_score, certificate_validity_months, is_active } = req.body;
    
    console.log('📝 Updating training program:', id, req.body);
    
    const result = await db.query(
      `UPDATE training_programs 
       SET name = $1, code = $2, description = $3, duration_hours = $4, max_participants = $5,
           price = $6, passing_score = $7, certificate_validity_months = $8, is_active = $9,
           updated_at = CURRENT_TIMESTAMP
       WHERE id = $10
       RETURNING *`,
      [name, code, description, duration_hours, max_participants, price, passing_score, certificate_validity_months, is_active, id]
    );
    
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Training program not found' });
    }
    
    console.log('✅ Training program updated:', result.rows[0]);
    res.json(result.rows[0]);
  } catch (error) {
    console.error('❌ Error updating training program:', error);
    res.status(500).json({ error: error.message });
  }
});

// Beneficiaries
app.get('/api/beneficiaries', async (req, res) => {
  try {
    const filter = getEntityFilter(req.userEntity);
    const result = await db.query(
      `SELECT * FROM beneficiaries WHERE ${filter} ORDER BY created_at DESC`
    );
    res.json(result.rows);
  } catch (error) {
    console.error('Error fetching beneficiaries:', error);
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/beneficiaries', async (req, res) => {
  try {
    const { entity_id, full_name, national_id, phone, email, education_level, status } = req.body;
    
    const result = await db.query(
      `INSERT INTO beneficiaries (
        entity_id, full_name, national_id, phone, email, education_level, status,
        incubator_id
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8) RETURNING *`,
      [entity_id, full_name, national_id, phone, email, education_level, status || 'ACTIVE', entity_id]
    );
    
    res.status(201).json(result.rows[0]);
  } catch (error) {
    console.error('Error creating beneficiary:', error);
    res.status(500).json({ error: error.message });
  }
});

// Update beneficiary
app.put('/api/beneficiaries/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { full_name, national_id, phone, email, education_level, status } = req.body;
    
    console.log('📝 Updating beneficiary:', id, req.body);
    
    const result = await db.query(
      `UPDATE beneficiaries 
       SET full_name = $1, national_id = $2, phone = $3, email = $4,
           education_level = $5, status = $6, updated_at = CURRENT_TIMESTAMP
       WHERE id = $7
       RETURNING *`,
      [full_name, national_id, phone, email, education_level, status, id]
    );
    
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Beneficiary not found' });
    }
    
    console.log('✅ Beneficiary updated:', result.rows[0]);
    res.json(result.rows[0]);
  } catch (error) {
    console.error('❌ Error updating beneficiary:', error);
    res.status(500).json({ error: error.message });
  }
});

// Training Sessions
app.get('/api/training-sessions', async (req, res) => {
  try {
    const filter = getEntityFilter(req.userEntity);
    const result = await db.query(
      `SELECT 
        ts.*,
        tp.name as program_name,
        tp.code as program_code,
        tp.max_participants
      FROM training_sessions ts
      LEFT JOIN training_programs tp ON ts.program_id = tp.id
      WHERE ${filter.replace('ts.', 'ts.')}
      ORDER BY ts.start_date DESC`
    );
    res.json(result.rows);
  } catch (error) {
    console.error('Error fetching training sessions:', error);
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/training-sessions', async (req, res) => {
  try {
    const { entity_id, session_name, program_id, start_date, end_date, instructor_name, location, status } = req.body;
    
    console.log('📝 Creating training session with data:', {
      entity_id, session_name, program_id, start_date, end_date, instructor_name, location, status
    });
    
    // Validate required fields
    if (!entity_id || !session_name || !program_id || !start_date || !end_date) {
      console.error('❌ Missing required fields');
      return res.status(400).json({ 
        error: 'Missing required fields',
        details: { entity_id, session_name, program_id, start_date, end_date }
      });
    }
    
    // Generate unique session code
    const session_code = `SESSION-${Date.now()}-${Math.floor(Math.random() * 1000)}`;
    
    const result = await db.query(
      `INSERT INTO training_sessions (
        entity_id, session_name, session_code, program_id, start_date, end_date, 
        instructor_name, location, status, current_participants, max_participants
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11) RETURNING *`,
      [entity_id, session_name, session_code, program_id, start_date, end_date, instructor_name || null, location || null, status || 'PLANNED', 0, 30]
    );
    
    console.log('✅ Training session created:', result.rows[0]);
    res.status(201).json(result.rows[0]);
  } catch (error) {
    console.error('❌ Error creating training session:', error.message);
    console.error('Full error:', error);
    res.status(500).json({ error: error.message, details: error.detail });
  }
});

// Update training session
app.put('/api/training-sessions/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { session_name, program_id, start_date, end_date, instructor_name, location, status } = req.body;
    
    console.log('📝 Updating training session:', id, req.body);
    
    const result = await db.query(
      `UPDATE training_sessions 
       SET session_name = $1, program_id = $2, start_date = $3, end_date = $4,
           instructor_name = $5, location = $6, status = $7, updated_at = CURRENT_TIMESTAMP
       WHERE id = $8
       RETURNING *`,
      [session_name, program_id, start_date, end_date, instructor_name, location, status, id]
    );
    
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Training session not found' });
    }
    
    console.log('✅ Training session updated:', result.rows[0]);
    res.json(result.rows[0]);
  } catch (error) {
    console.error('❌ Error updating training session:', error);
    res.status(500).json({ error: error.message });
  }
});

// Certificates
app.get('/api/certificates', async (req, res) => {
  try {
    const filter = getEntityFilter(req.userEntity);
    const result = await db.query(
      `SELECT 
        c.*,
        b.full_name,
        b.national_id,
        tp.name as program_name
      FROM certificates c
      LEFT JOIN beneficiaries b ON c.beneficiary_id = b.id
      LEFT JOIN training_programs tp ON c.program_id = tp.id
      WHERE ${filter.replace('c.', 'c.')}
      ORDER BY c.issue_date DESC`
    );
    res.json(result.rows);
  } catch (error) {
    console.error('Error fetching certificates:', error);
    res.status(500).json({ error: error.message });
  }
});

// ========================================
// ENROLLMENTS (Training Session Participants)
// ========================================

// Get enrollments
app.get('/api/enrollments', async (req, res) => {
  try {
    const { session_id, beneficiary_id } = req.query;
    
    let query = `
      SELECT 
        e.*,
        b.full_name as beneficiary_name,
        b.national_id as beneficiary_national_id,
        ts.session_name,
        tp.duration_hours,
        ROUND((a.score / a.max_score * 100)::numeric, 2) as final_grade
      FROM enrollments e
      LEFT JOIN beneficiaries b ON e.beneficiary_id = b.id
      LEFT JOIN training_sessions ts ON e.session_id = ts.id
      LEFT JOIN training_programs tp ON ts.program_id = tp.id
      LEFT JOIN assessments a ON e.id = a.enrollment_id
      WHERE 1=1
    `;
    const params = [];
    
    if (session_id) {
      params.push(session_id);
      query += ` AND e.session_id = $${params.length}`;
    }
    
    if (beneficiary_id) {
      params.push(beneficiary_id);
      query += ` AND e.beneficiary_id = $${params.length}`;
    }
    
    query += ' ORDER BY e.enrollment_date DESC';
    
    console.log('📋 [API] Fetching enrollments:', { session_id, beneficiary_id });
    const result = await db.query(query, params);
    console.log('✅ [API] Found enrollments:', result.rows.length);
    res.json(result.rows);
  } catch (error) {
    console.error('❌ [API] Error fetching enrollments:', error);
    res.status(500).json({ error: error.message });
  }
});

// Create enrollment
app.post('/api/enrollments', async (req, res) => {
  try {
    const { session_id, beneficiary_id, enrollment_date, status } = req.body;
    
    console.log('📝 Creating enrollment:', { session_id, beneficiary_id, enrollment_date, status });
    
    // Check if already enrolled
    const existing = await db.query(
      'SELECT id FROM enrollments WHERE session_id = $1 AND beneficiary_id = $2',
      [session_id, beneficiary_id]
    );
    
    if (existing.rows.length > 0) {
      return res.status(400).json({ error: 'المتدرب مسجل بالفعل في هذه الدفعة' });
    }
    
    const result = await db.query(
      `INSERT INTO enrollments (
        session_id, beneficiary_id, enrollment_date, status,
        attendance_percentage
      ) VALUES ($1, $2, $3, $4, 0) RETURNING *`,
      [session_id, beneficiary_id, enrollment_date, status || 'REGISTERED']
    );
    
    // Update session participant count
    await db.query(
      `UPDATE training_sessions 
       SET current_participants = (SELECT COUNT(*) FROM enrollments WHERE session_id = $1)
       WHERE id = $1`,
      [session_id]
    );
    
    console.log('✅ Enrollment created:', result.rows[0]);
    res.status(201).json(result.rows[0]);
  } catch (error) {
    console.error('❌ Error creating enrollment:', error);
    res.status(500).json({ error: error.message });
  }
});

// Delete enrollment
app.delete('/api/enrollments/:id', async (req, res) => {
  try {
    const { id } = req.params;
    
    // Get session_id before deleting
    const enrollment = await db.query('SELECT session_id FROM enrollments WHERE id = $1', [id]);
    
    if (enrollment.rows.length === 0) {
      return res.status(404).json({ error: 'Enrollment not found' });
    }
    
    const session_id = enrollment.rows[0].session_id;
    
    // Delete enrollment
    await db.query('DELETE FROM enrollments WHERE id = $1', [id]);
    
    // Update session participant count
    await db.query(
      `UPDATE training_sessions 
       SET current_participants = (SELECT COUNT(*) FROM enrollments WHERE session_id = $1)
       WHERE id = $1`,
      [session_id]
    );
    
    console.log('✅ Enrollment deleted:', id);
    res.json({ success: true });
  } catch (error) {
    console.error('❌ Error deleting enrollment:', error);
    res.status(500).json({ error: error.message });
  }
});

// ========================================
// Error handling middleware
// ========================================
// ========================================
// HIERARCHY DETAIL VIEW API
// ========================================

// Get entity details with all children based on entity type and ID
app.get('/api/hierarchy/entity/:type/:id', async (req, res) => {
  try {
    const { type, id } = req.params;
    const entityType = type.toUpperCase();
    const entityData = {};

    // Get entity basic info
    if (entityType === 'BRANCH') {
      const branch = await db.query(`
        SELECT b.*, hq.name as hq_name 
        FROM branches b
        LEFT JOIN headquarters hq ON b.hq_id = hq.id
        WHERE b.id = $1
      `, [id]);
      
      if (branch.rows.length === 0) {
        return res.status(404).json({ error: 'الفرع غير موجود' });
      }
      
      entityData.entity = branch.rows[0];
      entityData.entity.type = 'BRANCH';
      
      // Get incubators, platforms, and offices under this branch
      const incubators = await db.query('SELECT * FROM incubators WHERE branch_id = $1 AND is_active = true ORDER BY name', [id]);
      const platforms = await db.query(`
        SELECT p.* FROM platforms p
        INNER JOIN incubators i ON p.incubator_id = i.id
        WHERE i.branch_id = $1 AND p.is_active = true
        ORDER BY p.name
      `, [id]);
      const offices = await db.query(`
        SELECT o.* FROM offices o
        INNER JOIN incubators i ON o.incubator_id = i.id
        WHERE i.branch_id = $1 AND o.is_active = true
        ORDER BY o.name
      `, [id]);
      
      entityData.incubators = incubators.rows;
      entityData.platforms = platforms.rows;
      entityData.offices = offices.rows;
      
    } else if (entityType === 'INCUBATOR') {
      const incubator = await db.query(`
        SELECT i.*, b.name as branch_name, b.city, b.country 
        FROM incubators i
        LEFT JOIN branches b ON i.branch_id = b.id
        WHERE i.id = $1
      `, [id]);
      
      if (incubator.rows.length === 0) {
        return res.status(404).json({ error: 'الحاضنة غير موجودة' });
      }
      
      entityData.entity = incubator.rows[0];
      entityData.entity.type = 'INCUBATOR';
      
      // Get platforms and offices under this incubator
      const platforms = await db.query('SELECT * FROM platforms WHERE incubator_id = $1 AND is_active = true ORDER BY name', [id]);
      const offices = await db.query('SELECT * FROM offices WHERE incubator_id = $1 AND is_active = true ORDER BY name', [id]);
      
      entityData.platforms = platforms.rows;
      entityData.offices = offices.rows;
      entityData.incubators = []; // Incubators don't have child incubators
      
    } else if (entityType === 'PLATFORM') {
      const platform = await db.query(`
        SELECT p.*, i.name as incubator_name, b.name as branch_name 
        FROM platforms p
        LEFT JOIN incubators i ON p.incubator_id = i.id
        LEFT JOIN branches b ON i.branch_id = b.id
        WHERE p.id = $1
      `, [id]);
      
      if (platform.rows.length === 0) {
        return res.status(404).json({ error: 'المنصة غير موجودة' });
      }
      
      entityData.entity = platform.rows[0];
      entityData.entity.type = 'PLATFORM';
      
      // Get offices linked to this platform
      const offices = await db.query(`
        SELECT o.* FROM offices o
        INNER JOIN office_platforms op ON o.id = op.office_id
        WHERE op.platform_id = $1 AND op.is_active = true
        ORDER BY o.name
      `, [id]);
      
      entityData.platforms = []; // Platforms don't have child platforms
      entityData.offices = offices.rows;
      entityData.incubators = [];
      
    } else if (entityType === 'OFFICE') {
      const office = await db.query(`
        SELECT o.*, i.name as incubator_name, b.name as branch_name 
        FROM offices o
        LEFT JOIN incubators i ON o.incubator_id = i.id
        LEFT JOIN branches b ON i.branch_id = b.id
        WHERE o.id = $1
      `, [id]);
      
      if (office.rows.length === 0) {
        return res.status(404).json({ error: 'المكتب غير موجود' });
      }
      
      entityData.entity = office.rows[0];
      entityData.entity.type = 'OFFICE';
      
      // Get linked platforms
      const platforms = await db.query(`
        SELECT p.* FROM platforms p
        INNER JOIN office_platforms op ON p.id = op.platform_id
        WHERE op.office_id = $1 AND op.is_active = true
        ORDER BY p.name
      `, [id]);
      
      entityData.platforms = platforms.rows;
      entityData.offices = []; // Offices don't have child offices
      entityData.incubators = [];
      
    } else {
      return res.status(400).json({ error: 'نوع كيان غير صحيح' });
    }

    res.json(entityData);
  } catch (error) {
    console.error('Error fetching entity details:', error);
    res.status(500).json({ error: error.message });
  }
});

// ========================================
// Strategic Management API Routes
// ========================================
// MUST BE BEFORE catch-all route!

// Executive Management KPIs
app.get('/api/executive-kpis', async (req, res) => {
  try {
    const result = await db.query('SELECT * FROM executive_kpis WHERE status = $1 ORDER BY created_at DESC', ['active']);
    res.json(result.rows);
  } catch (error) {
    console.error('Error fetching executive KPIs:', error);
    res.status(500).json({ error: error.message });
  }
});

// Executive Goals
app.get('/api/executive-goals', async (req, res) => {
  try {
    const result = await db.query('SELECT * FROM executive_goals ORDER BY target_date ASC');
    res.json(result.rows);
  } catch (error) {
    console.error('Error fetching executive goals:', error);
    res.status(500).json({ error: error.message });
  }
});

// Executive Operations
app.get('/api/executive-operations', async (req, res) => {
  try {
    const result = await db.query('SELECT * FROM executive_operations ORDER BY start_date DESC LIMIT 10');
    res.json(result.rows);
  } catch (error) {
    console.error('Error fetching executive operations:', error);
    res.status(500).json({ error: error.message });
  }
});

// Digital Marketing Campaigns
app.get('/api/digital-marketing', async (req, res) => {
  try {
    const result = await db.query('SELECT * FROM digital_marketing_campaigns ORDER BY start_date DESC');
    res.json(result.rows);
  } catch (error) {
    console.error('Error fetching digital marketing campaigns:', error);
    res.status(500).json({ error: error.message });
  }
});

// Community Marketing
app.get('/api/community-marketing', async (req, res) => {
  try {
    const result = await db.query('SELECT * FROM community_marketing ORDER BY event_date DESC');
    res.json(result.rows);
  } catch (error) {
    console.error('Error fetching community marketing:', error);
    res.status(500).json({ error: error.message });
  }
});

// Event Marketing
app.get('/api/event-marketing', async (req, res) => {
  try {
    const result = await db.query('SELECT * FROM event_marketing ORDER BY event_date ASC');
    res.json(result.rows);
  } catch (error) {
    console.error('Error fetching event marketing:', error);
    res.status(500).json({ error: error.message });
  }
});

// Training Courses
app.get('/api/training-courses', async (req, res) => {
  try {
    const result = await db.query('SELECT * FROM training_courses ORDER BY start_date DESC');
    res.json(result.rows);
  } catch (error) {
    console.error('Error fetching training courses:', error);
    res.status(500).json({ error: error.message });
  }
});

// Skills Registry
app.get('/api/skills', async (req, res) => {
  try {
    const result = await db.query('SELECT * FROM skills_registry ORDER BY skill_name ASC');
    res.json(result.rows);
  } catch (error) {
    console.error('Error fetching skills:', error);
    res.status(500).json({ error: error.message });
  }
});

// Financial Policies
app.get('/api/financial-policies', async (req, res) => {
  try {
    const result = await db.query('SELECT * FROM financial_policies ORDER BY created_at DESC');
    res.json(result.rows);
  } catch (error) {
    console.error('Error fetching financial policies:', error);
    res.status(500).json({ error: error.message });
  }
});

// Financial Manual
app.get('/api/financial-manual', async (req, res) => {
  try {
    const result = await db.query('SELECT * FROM financial_manual ORDER BY section_order ASC');
    res.json(result.rows);
  } catch (error) {
    console.error('Error fetching financial manual:', error);
    res.status(500).json({ error: error.message });
  }
});

// Financial News
app.get('/api/financial-news', async (req, res) => {
  try {
    const result = await db.query('SELECT * FROM financial_news ORDER BY published_date DESC LIMIT 20');
    res.json(result.rows);
  } catch (error) {
    console.error('Error fetching financial news:', error);
    res.status(500).json({ error: error.message });
  }
});

// Development Programs
app.get('/api/development-programs', async (req, res) => {
  try {
    const result = await db.query('SELECT * FROM development_programs ORDER BY start_date DESC');
    res.json(result.rows);
  } catch (error) {
    console.error('Error fetching development programs:', error);
    res.status(500).json({ error: error.message });
  }
});

// Quality Standards
app.get('/api/quality-standards', async (req, res) => {
  try {
    const result = await db.query('SELECT * FROM quality_standards ORDER BY standard_code ASC');
    res.json(result.rows);
  } catch (error) {
    console.error('Error fetching quality standards:', error);
    res.status(500).json({ error: error.message });
  }
});

// Quality Audits
app.get('/api/quality-audits', async (req, res) => {
  try {
    const result = await db.query('SELECT * FROM quality_audits ORDER BY audit_date DESC');
    res.json(result.rows);
  } catch (error) {
    console.error('Error fetching quality audits:', error);
    res.status(500).json({ error: error.message });
  }
});

// Evaluations
app.get('/api/evaluations', async (req, res) => {
  try {
    const result = await db.query('SELECT * FROM evaluations ORDER BY evaluation_date DESC');
    res.json(result.rows);
  } catch (error) {
    console.error('Error fetching evaluations:', error);
    res.status(500).json({ error: error.message });
  }
});

// HR Performance Evaluations
app.get('/api/hr-performance-evaluations', async (req, res) => {
  try {
    const result = await db.query(
      `SELECT * FROM hr_performance_evaluations
       WHERE ${getStrictRequestEntityCondition(req, 'entity_id', 1)}
       ORDER BY evaluation_date DESC`,
      [getRequestEntityContext(req).id]
    );
    res.json(result.rows);
  } catch (error) {
    console.error('Error fetching HR performance evaluations:', error);
    res.status(500).json({ error: error.message });
  }
});

// HR Payroll Records
app.get('/api/hr-payroll-records', async (req, res) => {
  try {
    const result = await db.query(
      `SELECT * FROM hr_payroll_records
       WHERE ${getStrictRequestEntityCondition(req, 'entity_id', 1)}
       ORDER BY pay_date DESC`,
      [getRequestEntityContext(req).id]
    );
    res.json(result.rows);
  } catch (error) {
    console.error('Error fetching HR payroll records:', error);
    res.status(500).json({ error: error.message });
  }
});

// HR Talent Management
app.get('/api/hr-talent-management', async (req, res) => {
  try {
    const filter = getEntityFilter(req.userEntity, 't');
    const result = await db.query(
      `SELECT t.*
       FROM hr_talent_management t
       WHERE ${filter}
       ORDER BY t.last_review_date DESC NULLS LAST, t.created_at DESC`
    );
    res.json(result.rows || []);
  } catch (error) {
    console.error('Error fetching HR talent management records:', error);
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/hr-talent-management', async (req, res) => {
  try {
    const {
      employee_name,
      department,
      core_skills,
      performance_level,
      potential_level,
      talent_classification,
      development_plan,
      development_plan_status,
      last_review_date,
      notes
    } = req.body || {};

    if (!employee_name || !department || !talent_classification) {
      return res.status(400).json({
        error: 'employee_name, department, talent_classification are required'
      });
    }

    const skillsArray = Array.isArray(core_skills)
      ? core_skills
      : typeof core_skills === 'string'
        ? core_skills.split(',').map((skill) => skill.trim()).filter(Boolean)
        : [];

    const result = await db.query(
      `INSERT INTO hr_talent_management
       (employee_name, department, core_skills, performance_level, potential_level, talent_classification,
        development_plan, development_plan_status, last_review_date, notes, entity_id, entity_type)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12)
       RETURNING *`,
      [
        employee_name,
        department,
        skillsArray,
        performance_level !== undefined && performance_level !== null ? Number(performance_level) : null,
        potential_level !== undefined && potential_level !== null ? Number(potential_level) : null,
        talent_classification,
        development_plan || null,
        development_plan_status || 'نشطة',
        last_review_date || null,
        notes || null,
        req.userEntity.id,
        req.userEntity.type
      ]
    );

    res.status(201).json(result.rows[0]);
  } catch (error) {
    console.error('Error creating HR talent management record:', error);
    res.status(500).json({ error: error.message });
  }
});

app.put('/api/hr-talent-management/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const {
      employee_name,
      department,
      core_skills,
      performance_level,
      potential_level,
      talent_classification,
      development_plan,
      development_plan_status,
      last_review_date,
      notes
    } = req.body || {};

    const skillsArray = Array.isArray(core_skills)
      ? core_skills
      : typeof core_skills === 'string'
        ? core_skills.split(',').map((skill) => skill.trim()).filter(Boolean)
        : [];

    const filter = getEntityFilter(req.userEntity, 't');
    const result = await db.query(
      `UPDATE hr_talent_management t
       SET employee_name = $1,
           department = $2,
           core_skills = $3,
           performance_level = $4,
           potential_level = $5,
           talent_classification = $6,
           development_plan = $7,
           development_plan_status = $8,
           last_review_date = $9,
           notes = $10,
           updated_at = NOW()
       WHERE t.id = $11 AND ${filter}
       RETURNING *`,
      [
        employee_name,
        department,
        skillsArray,
        performance_level !== undefined && performance_level !== null ? Number(performance_level) : null,
        potential_level !== undefined && potential_level !== null ? Number(potential_level) : null,
        talent_classification,
        development_plan || null,
        development_plan_status || 'نشطة',
        last_review_date || null,
        notes || null,
        id
      ]
    );

    if (!result.rows[0]) {
      return res.status(404).json({ error: 'Talent record not found' });
    }

    res.json(result.rows[0]);
  } catch (error) {
    console.error('Error updating HR talent management record:', error);
    res.status(500).json({ error: error.message });
  }
});

app.delete('/api/hr-talent-management/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const filter = getEntityFilter(req.userEntity, 't');
    const result = await db.query(
      `DELETE FROM hr_talent_management t
       WHERE t.id = $1 AND ${filter}
       RETURNING t.id`,
      [id]
    );

    if (!result.rows[0]) {
      return res.status(404).json({ error: 'Talent record not found' });
    }

    res.json({ success: true, id: result.rows[0].id });
  } catch (error) {
    console.error('Error deleting HR talent management record:', error);
    res.status(500).json({ error: error.message });
  }
});

// HR Strategic Monthly Indicators
const getHrStrategicMonthlyIndicators = async (req, res) => {
  try {
    const { period } = req.query;
    const params = [getRequestEntityContext(req).id];
    let sql = `SELECT *
               FROM hr_strategic_monthly_indicators
               WHERE ${getStrictRequestEntityCondition(req, 'entity_id', 1)}`;
    if (period && period !== 'all') {
      params.push(period);
      sql += ` AND period = $${params.length}`;
    }
    sql += ' ORDER BY month_key ASC';
    const result = await db.query(sql, params);
    res.json(result.rows);
  } catch (error) {
    console.error('Error fetching HR strategic monthly indicators:', error);
    res.status(500).json({ error: error.message });
  }
};

const createHrStrategicMonthlyIndicator = async (req, res) => {
  try {
    const {
      month_key,
      month_label,
      period,
      headcount,
      attendance_rate,
      turnover_rate,
      performance_score,
      new_hires,
      resignations,
      absence_rate,
      tardy_rate
    } = req.body || {};

    if (!month_key || !month_label || headcount === undefined || attendance_rate === undefined || turnover_rate === undefined || performance_score === undefined || new_hires === undefined || resignations === undefined || absence_rate === undefined || tardy_rate === undefined) {
      return res.status(400).json({
        error: 'month_key, month_label, headcount, attendance_rate, turnover_rate, performance_score, new_hires, resignations, absence_rate, tardy_rate are required'
      });
    }

    const result = await db.query(
      `INSERT INTO hr_strategic_monthly_indicators
       (month_key, month_label, period, headcount, attendance_rate, turnover_rate, performance_score, new_hires, resignations, absence_rate, tardy_rate, entity_id, entity_type)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13)
       RETURNING *`,
      [
        month_key,
        month_label,
        period || null,
        Number(headcount),
        Number(attendance_rate),
        Number(turnover_rate),
        Number(performance_score),
        Number(new_hires),
        Number(resignations),
        Number(absence_rate),
        Number(tardy_rate),
        getRequestEntityContext(req).id,
        getRequestEntityContext(req).type
      ]
    );

    res.json(result.rows[0]);
  } catch (error) {
    console.error('Error creating HR strategic monthly indicator:', error);
    res.status(500).json({ error: error.message });
  }
};

const updateHrStrategicMonthlyIndicator = async (req, res) => {
  try {
    const { id } = req.params;
    const {
      month_key,
      month_label,
      period,
      headcount,
      attendance_rate,
      turnover_rate,
      performance_score,
      new_hires,
      resignations,
      absence_rate,
      tardy_rate
    } = req.body || {};

    const result = await db.query(
      `UPDATE hr_strategic_monthly_indicators
       SET month_key = $1,
           month_label = $2,
           period = $3,
           headcount = $4,
           attendance_rate = $5,
           turnover_rate = $6,
           performance_score = $7,
           new_hires = $8,
           resignations = $9,
           absence_rate = $10,
           tardy_rate = $11,
           updated_at = NOW()
       WHERE id = $12 AND ${getStrictRequestEntityCondition(req, 'entity_id', 13)}
       RETURNING *`,
      [
        month_key,
        month_label,
        period || null,
        Number(headcount),
        Number(attendance_rate),
        Number(turnover_rate),
        Number(performance_score),
        Number(new_hires),
        Number(resignations),
        Number(absence_rate),
        Number(tardy_rate),
        id,
        getRequestEntityContext(req).id
      ]
    );

    if (!result.rows[0]) {
      return res.status(404).json({ error: 'Monthly indicator not found' });
    }

    res.json(result.rows[0]);
  } catch (error) {
    console.error('Error updating HR strategic monthly indicator:', error);
    res.status(500).json({ error: error.message });
  }
};

const deleteHrStrategicMonthlyIndicator = async (req, res) => {
  try {
    const { id } = req.params;
    const result = await db.query(
      `DELETE FROM hr_strategic_monthly_indicators
       WHERE id = $1 AND ${getStrictRequestEntityCondition(req, 'entity_id', 2)}
       RETURNING id`,
      [id, getRequestEntityContext(req).id]
    );

    if (!result.rows[0]) {
      return res.status(404).json({ error: 'Monthly indicator not found' });
    }

    res.json({ success: true, id: result.rows[0].id });
  } catch (error) {
    console.error('Error deleting HR strategic monthly indicator:', error);
    res.status(500).json({ error: error.message });
  }
};

app.get('/api/hr-strategic-monthly-indicators', getHrStrategicMonthlyIndicators);
app.post('/api/hr-strategic-monthly-indicators', createHrStrategicMonthlyIndicator);
app.put('/api/hr-strategic-monthly-indicators/:id', updateHrStrategicMonthlyIndicator);
app.delete('/api/hr-strategic-monthly-indicators/:id', deleteHrStrategicMonthlyIndicator);

app.get('/api/hr/strategic-analytics/monthly', getHrStrategicMonthlyIndicators);
app.post('/api/hr/strategic-analytics/monthly', createHrStrategicMonthlyIndicator);
app.put('/api/hr/strategic-analytics/monthly/:id', updateHrStrategicMonthlyIndicator);
app.delete('/api/hr/strategic-analytics/monthly/:id', deleteHrStrategicMonthlyIndicator);

// HR Satisfaction Analytics
const resolveSatisfactionLevel = (score, level) => {
  if (level) return level;
  const numericScore = Number(score || 0);
  if (numericScore >= 4) return 'مرتفع';
  if (numericScore >= 3) return 'متوسط';
  return 'منخفض';
};

const getHrSatisfactionAnalytics = async (req, res) => {
  try {
    const filter = getStrictRequestEntityCondition(req, 's.entity_id', 1);
    const result = await db.query(
      `SELECT s.id,
              s.employee_name,
              s.department_name,
              s.survey_type,
              s.satisfaction_score,
              s.satisfaction_level,
              TO_CHAR(s.evaluation_date, 'YYYY-MM-DD') AS evaluation_date,
              s.notes,
              s.follow_up_status,
              s.created_at,
              s.updated_at
       FROM hr_satisfaction_analytics s
       WHERE ${filter}
       ORDER BY s.evaluation_date DESC NULLS LAST, s.id DESC`,
      [getRequestEntityContext(req).id]
    );
    res.json(result.rows || []);
  } catch (error) {
    console.error('Error fetching HR satisfaction analytics:', error);
    res.status(500).json({ error: error.message });
  }
};

const createHrSatisfactionAnalytics = async (req, res) => {
  try {
    const {
      employee_name,
      department_name,
      survey_type,
      satisfaction_score,
      satisfaction_level,
      evaluation_date,
      notes,
      follow_up_status
    } = req.body || {};

    if (!employee_name || !department_name || !survey_type || satisfaction_score === undefined) {
      return res.status(400).json({
        error: 'employee_name, department_name, survey_type, satisfaction_score are required'
      });
    }

    const level = resolveSatisfactionLevel(satisfaction_score, satisfaction_level);

    const result = await db.query(
      `INSERT INTO hr_satisfaction_analytics
        (employee_name, department_name, survey_type, satisfaction_score, satisfaction_level, evaluation_date, notes, follow_up_status, entity_id, entity_type)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)
       RETURNING *`,
      [
        employee_name,
        department_name,
        survey_type,
        Number(satisfaction_score),
        level,
        evaluation_date || null,
        notes || null,
        follow_up_status || 'قيد المتابعة',
        req.userEntity?.id || 'HQ001',
        req.userEntity?.type || 'HQ'
      ]
    );

    res.json(result.rows[0]);
  } catch (error) {
    console.error('Error creating HR satisfaction analytics:', error);
    res.status(500).json({ error: error.message });
  }
};

const updateHrSatisfactionAnalytics = async (req, res) => {
  try {
    const { id } = req.params;
    const {
      employee_name,
      department_name,
      survey_type,
      satisfaction_score,
      satisfaction_level,
      evaluation_date,
      notes,
      follow_up_status
    } = req.body || {};

    const level = resolveSatisfactionLevel(satisfaction_score, satisfaction_level);
    const result = await db.query(
      `UPDATE hr_satisfaction_analytics
       SET employee_name = $1,
           department_name = $2,
           survey_type = $3,
           satisfaction_score = $4,
           satisfaction_level = $5,
           evaluation_date = $6,
           notes = $7,
           follow_up_status = $8,
           updated_at = NOW()
       WHERE id = $9 AND ${getStrictRequestEntityCondition(req, 'entity_id', 10)}
       RETURNING *`,
      [
        employee_name,
        department_name,
        survey_type,
        Number(satisfaction_score),
        level,
        evaluation_date || null,
        notes || null,
        follow_up_status || 'قيد المتابعة',
        id,
        getRequestEntityContext(req).id
      ]
    );

    if (!result.rows[0]) {
      return res.status(404).json({ error: 'Satisfaction record not found' });
    }

    res.json(result.rows[0]);
  } catch (error) {
    console.error('Error updating HR satisfaction analytics:', error);
    res.status(500).json({ error: error.message });
  }
};

const deleteHrSatisfactionAnalytics = async (req, res) => {
  try {
    const { id } = req.params;
    const result = await db.query(
      `DELETE FROM hr_satisfaction_analytics
       WHERE id = $1 AND ${getStrictRequestEntityCondition(req, 'entity_id', 2)}
       RETURNING id`,
      [id, getRequestEntityContext(req).id]
    );

    if (!result.rows[0]) {
      return res.status(404).json({ error: 'Satisfaction record not found' });
    }

    res.json({ success: true, id: result.rows[0].id });
  } catch (error) {
    console.error('Error deleting HR satisfaction analytics:', error);
    res.status(500).json({ error: error.message });
  }
};

app.get('/api/hr-satisfaction-analytics', getHrSatisfactionAnalytics);
app.post('/api/hr-satisfaction-analytics', createHrSatisfactionAnalytics);
app.put('/api/hr-satisfaction-analytics/:id', updateHrSatisfactionAnalytics);
app.delete('/api/hr-satisfaction-analytics/:id', deleteHrSatisfactionAnalytics);

app.get('/api/hr/satisfaction-analytics', getHrSatisfactionAnalytics);
app.post('/api/hr/satisfaction-analytics', createHrSatisfactionAnalytics);
app.put('/api/hr/satisfaction-analytics/:id', updateHrSatisfactionAnalytics);
app.delete('/api/hr/satisfaction-analytics/:id', deleteHrSatisfactionAnalytics);

// HR Employee 360 Profile
const getHrEmployeeProfile = async (req, res) => {
  try {
    const employeeId = req.query.employeeId || 'EMP001';
    const result = await db.query(
      `SELECT * FROM hr_employee_profiles
       WHERE employee_id = $1 AND ${getStrictRequestEntityCondition(req, 'entity_id', 2)}
       LIMIT 1`,
      [employeeId, getRequestEntityContext(req).id]
    );
    res.json(result.rows[0] || null);
  } catch (error) {
    console.error('Error fetching HR employee profile:', error);
    res.status(500).json({ error: error.message });
  }
};

const updateHrEmployeeProfile = async (req, res) => {
  try {
    const { employeeId } = req.params;
    const {
      name,
      title,
      department,
      status,
      hire_date,
      manager,
      avatar_initials
    } = req.body || {};

    const result = await db.query(
      `UPDATE hr_employee_profiles
       SET name = $1,
           title = $2,
           department = $3,
           status = $4,
           hire_date = $5,
           manager = $6,
           avatar_initials = $7,
           updated_at = NOW()
       WHERE employee_id = $8 AND ${getStrictRequestEntityCondition(req, 'entity_id', 9)}
       RETURNING *`,
      [
        name,
        title || null,
        department || null,
        status || null,
        hire_date || null,
        manager || null,
        avatar_initials || null,
        employeeId,
        getRequestEntityContext(req).id
      ]
    );

    if (!result.rows[0]) {
      return res.status(404).json({ error: 'Employee profile not found' });
    }

    res.json(result.rows[0]);
  } catch (error) {
    console.error('Error updating HR employee profile:', error);
    res.status(500).json({ error: error.message });
  }
};

app.get('/api/hr-employee-profile', getHrEmployeeProfile);
app.put('/api/hr-employee-profile/:employeeId', updateHrEmployeeProfile);
app.get('/api/hr/employee-profile', getHrEmployeeProfile);
app.put('/api/hr/employee-profile/:employeeId', updateHrEmployeeProfile);

// HR Employee 360 Records
const getHrEmployeeRecords = async (req, res) => {
  try {
    const employeeId = req.query.employeeId || 'EMP001';
    const section = req.query.section;
    const params = [employeeId, getRequestEntityContext(req).id];
    let sql = `SELECT * FROM hr_employee_records
               WHERE employee_id = $1 AND ${getStrictRequestEntityCondition(req, 'entity_id', 2)}`;
    if (section) {
      params.push(section);
      sql += ` AND section = $${params.length}`;
    }
    sql += ' ORDER BY period DESC';

    const result = await db.query(sql, params);
    res.json(result.rows);
  } catch (error) {
    console.error('Error fetching HR employee records:', error);
    res.status(500).json({ error: error.message });
  }
};

const createHrEmployeeRecord = async (req, res) => {
  try {
    const {
      employee_id,
      section,
      status,
      period,
      record
    } = req.body || {};

    if (!employee_id || !section || !record) {
      return res.status(400).json({ error: 'employee_id, section, and record are required' });
    }

    const result = await db.query(
      `INSERT INTO hr_employee_records
       (employee_id, section, status, period, record, entity_id, entity_type)
       VALUES ($1,$2,$3,$4,$5,$6,$7)
       RETURNING *`,
      [
        employee_id,
        section,
        status || null,
        period || null,
        JSON.stringify(record),
        getRequestEntityContext(req).id,
        getRequestEntityContext(req).type
      ]
    );

    res.json(result.rows[0]);
  } catch (error) {
    console.error('Error creating HR employee record:', error);
    res.status(500).json({ error: error.message });
  }
};

const updateHrEmployeeRecord = async (req, res) => {
  try {
    const { id } = req.params;
    const {
      status,
      period,
      record
    } = req.body || {};

    const result = await db.query(
      `UPDATE hr_employee_records
       SET status = $1,
           period = $2,
           record = $3,
           updated_at = NOW()
       WHERE id = $4 AND ${getStrictRequestEntityCondition(req, 'entity_id', 5)}
       RETURNING *`,
      [
        status || null,
        period || null,
        JSON.stringify(record),
        id,
        getRequestEntityContext(req).id
      ]
    );

    if (!result.rows[0]) {
      return res.status(404).json({ error: 'Employee record not found' });
    }

    res.json(result.rows[0]);
  } catch (error) {
    console.error('Error updating HR employee record:', error);
    res.status(500).json({ error: error.message });
  }
};

const deleteHrEmployeeRecord = async (req, res) => {
  try {
    const { id } = req.params;
    const result = await db.query(
      `DELETE FROM hr_employee_records
       WHERE id = $1 AND ${getStrictRequestEntityCondition(req, 'entity_id', 2)}
       RETURNING id`,
      [id, getRequestEntityContext(req).id]
    );

    if (!result.rows[0]) {
      return res.status(404).json({ error: 'Employee record not found' });
    }

    res.json({ success: true, id: result.rows[0].id });
  } catch (error) {
    console.error('Error deleting HR employee record:', error);
    res.status(500).json({ error: error.message });
  }
};

app.get('/api/hr-employee-records', getHrEmployeeRecords);
app.post('/api/hr-employee-records', createHrEmployeeRecord);
app.put('/api/hr-employee-records/:id', updateHrEmployeeRecord);
app.delete('/api/hr-employee-records/:id', deleteHrEmployeeRecord);
app.get('/api/hr/employee-records', getHrEmployeeRecords);
app.post('/api/hr/employee-records', createHrEmployeeRecord);
app.put('/api/hr/employee-records/:id', updateHrEmployeeRecord);
app.delete('/api/hr/employee-records/:id', deleteHrEmployeeRecord);

// HR Experience Records
const getHrExperienceRecords = async (req, res) => {
  try {

// HR Assets & Custodies API
const getHrAssetsOverview = async (req, res) => {
  try {
    const entityId = getRequestEntityContext(req).id;
    const summaryResult = await db.query(
      `SELECT
         (SELECT COUNT(*) FROM hr_asset_registry WHERE entity_id = $1) AS registry_count,
         (SELECT COUNT(*) FROM hr_asset_warehouse WHERE entity_id = $1) AS warehouse_count,
         (SELECT COALESCE(SUM(quantity), 0) FROM hr_asset_warehouse WHERE entity_id = $1) AS warehouse_quantity,
         (SELECT COUNT(*) FROM hr_asset_classifications WHERE entity_id = $1) AS classification_count,
         (SELECT COUNT(*) FROM hr_asset_coding_system WHERE entity_id = $1) AS coding_count`,
      [entityId]
    );
    const typeSummary = await db.query(
      `SELECT asset_type_ar, asset_type_en, total_count
       FROM hr_asset_type_summary
       WHERE entity_id = $1
       ORDER BY total_count DESC, asset_type_ar`,
      [entityId]
    );
    const summary = summaryResult.rows[0] || {
      registry_count: 0,
      warehouse_count: 0,
      warehouse_quantity: 0,
      classification_count: 0,
      coding_count: 0
    };
    summary.type_summary_count = (typeSummary.rows || []).length;
    res.json({
      summary,
      type_summary: typeSummary.rows || []
    });
  } catch (error) {
    console.error('Error fetching HR assets overview:', error);
    res.status(500).json({ error: error.message });
  }
};

const getHrAssetRegistry = async (req, res) => {
  try {
    const entityId = getRequestEntityContext(req).id;
    const result = await db.query(
      `SELECT serial_number, asset_name, description, location, status, notes, created_at
       FROM hr_asset_registry
       WHERE entity_id = $1
       ORDER BY id ASC`,
      [entityId]
    );
    res.json(result.rows || []);
  } catch (error) {
    console.error('Error fetching HR asset registry:', error);
    res.status(500).json({ error: error.message });
  }
};

const getHrAssetWarehouse = async (req, res) => {
  try {
    const entityId = getRequestEntityContext(req).id;
    const result = await db.query(
      `SELECT serial_number_ar, serial_number_en, asset_code_ar, asset_code_en,
              asset_name_ar, asset_name_en, quantity, condition_ar, condition_en,
              entry_date, reason_ar, reason_en
       FROM hr_asset_warehouse
       WHERE entity_id = $1
       ORDER BY entry_date DESC NULLS LAST, id ASC`,
      [entityId]
    );
    res.json(result.rows || []);
  } catch (error) {
    console.error('Error fetching HR asset warehouse:', error);
    res.status(500).json({ error: error.message });
  }
};

const getHrAssetClassifications = async (req, res) => {
  try {
    const entityId = getRequestEntityContext(req).id;
    const result = await db.query(
      `SELECT serial_number, item_name_ar, item_name_en, location, status, notes, asset_type_ar, asset_type_en
       FROM hr_asset_classifications
       WHERE entity_id = $1
       ORDER BY id ASC`,
      [entityId]
    );
    res.json(result.rows || []);
  } catch (error) {
    console.error('Error fetching HR asset classifications:', error);
    res.status(500).json({ error: error.message });
  }
};

const getHrAssetCodingSystem = async (req, res) => {
  try {
    const entityId = getRequestEntityContext(req).id;
    const result = await db.query(
      `SELECT code_prefix, name_en, name_ar, category_ar, category_en, example_code
       FROM hr_asset_coding_system
       WHERE entity_id = $1
       ORDER BY code_prefix`,
      [entityId]
    );
    res.json(result.rows || []);
  } catch (error) {
    console.error('Error fetching HR asset coding system:', error);
    res.status(500).json({ error: error.message });
  }
};

app.get('/api/hr/assets/overview', getHrAssetsOverview);
app.get('/api/hr/assets/registry', getHrAssetRegistry);
app.get('/api/hr/assets/warehouse', getHrAssetWarehouse);
app.get('/api/hr/assets/classifications', getHrAssetClassifications);
app.get('/api/hr/assets/coding', getHrAssetCodingSystem);
    const result = await db.query(
      `SELECT * FROM hr_experience_records
       WHERE ${getStrictRequestEntityCondition(req, 'entity_id', 1)}
       ORDER BY added_on DESC, id DESC`,
      [getRequestEntityContext(req).id]
    );
    res.json(result.rows);
  } catch (error) {
    console.error('Error fetching HR experience records:', error);
    res.status(500).json({ error: error.message });
  }
};

const createHrExperienceRecord = async (req, res) => {
  try {
    const {
      employee_name,
      experience_type,
      experience_field,
      years_of_experience,
      experience_level,
      added_on,
      status,
      notes,
      skills
    } = req.body || {};

    if (!employee_name || !experience_type || !experience_field || years_of_experience === undefined || !experience_level) {
      return res.status(400).json({
        error: 'employee_name, experience_type, experience_field, years_of_experience, experience_level are required'
      });
    }

    const result = await db.query(
      `INSERT INTO hr_experience_records
        (employee_name, experience_type, experience_field, years_of_experience, experience_level, added_on, status, notes, skills, entity_id, entity_type)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)
       RETURNING *`,
      [
        employee_name,
        experience_type,
        experience_field,
        Number(years_of_experience),
        experience_level,
        added_on || null,
        status || 'قيد المراجعة',
        notes || null,
        JSON.stringify(Array.isArray(skills) ? skills : []),
        getRequestEntityContext(req).id,
        getRequestEntityContext(req).type
      ]
    );

    res.json(result.rows[0]);
  } catch (error) {
    console.error('Error creating HR experience record:', error);
    res.status(500).json({ error: error.message });
  }
};

const updateHrExperienceRecord = async (req, res) => {
  try {
    const { id } = req.params;
    const {
      employee_name,
      experience_type,
      experience_field,
      years_of_experience,
      experience_level,
      added_on,
      status,
      notes,
      skills
    } = req.body || {};

    const result = await db.query(
      `UPDATE hr_experience_records
       SET employee_name = $1,
           experience_type = $2,
           experience_field = $3,
           years_of_experience = $4,
           experience_level = $5,
           added_on = $6,
           status = $7,
           notes = $8,
           skills = $9,
           updated_at = NOW()
       WHERE id = $10 AND ${getStrictRequestEntityCondition(req, 'entity_id', 11)}
       RETURNING *`,
      [
        employee_name,
        experience_type,
        experience_field,
        Number(years_of_experience),
        experience_level,
        added_on || null,
        status || 'قيد المراجعة',
        notes || null,
        JSON.stringify(Array.isArray(skills) ? skills : []),
        id,
        getRequestEntityContext(req).id
      ]
    );

    if (!result.rows[0]) {
      return res.status(404).json({ error: 'Experience record not found' });
    }

    res.json(result.rows[0]);
  } catch (error) {
    console.error('Error updating HR experience record:', error);
    res.status(500).json({ error: error.message });
  }
};

const deleteHrExperienceRecord = async (req, res) => {
  try {
    const { id } = req.params;
    const result = await db.query(
      `DELETE FROM hr_experience_records
       WHERE id = $1 AND ${getStrictRequestEntityCondition(req, 'entity_id', 2)}
       RETURNING id`,
      [id, getRequestEntityContext(req).id]
    );

    if (!result.rows[0]) {
      return res.status(404).json({ error: 'Experience record not found' });
    }

    res.json({ success: true, id: result.rows[0].id });
  } catch (error) {
    console.error('Error deleting HR experience record:', error);
    res.status(500).json({ error: error.message });
  }
};

app.get('/api/hr-experience-records', getHrExperienceRecords);
app.post('/api/hr-experience-records', createHrExperienceRecord);
app.put('/api/hr-experience-records/:id', updateHrExperienceRecord);
app.delete('/api/hr-experience-records/:id', deleteHrExperienceRecord);
app.get('/api/hr/experience-records', getHrExperienceRecords);
app.post('/api/hr/experience-records', createHrExperienceRecord);
app.put('/api/hr/experience-records/:id', updateHrExperienceRecord);
app.delete('/api/hr/experience-records/:id', deleteHrExperienceRecord);

// HR Workforce Planning
const getHrWorkforcePlans = async (req, res) => {
  try {
    await ensureHrWorkforcePlansTable();
    const isHq = req.userEntity?.type === 'HQ';
    const filterClause = isHq ? '1=1' : 'w.entity_id = $1';
    const params = isHq ? [] : [req.userEntity.id];
    const result = await db.query(
      `SELECT w.id,
              w.department_name,
              w.current_headcount,
              w.target_headcount,
              w.gap,
              w.hiring_plan,
              TO_CHAR(w.review_date, 'YYYY-MM-DD') AS review_date,
              w.status,
              w.notes,
              w.created_at,
              w.updated_at
       FROM hr_workforce_plans w
       WHERE ${filterClause}
       ORDER BY w.review_date DESC NULLS LAST, w.updated_at DESC`,
      params
    );
    res.json(result.rows || []);
  } catch (error) {
    console.error('Error fetching HR workforce plans:', error);
    res.status(500).json({ error: error.message });
  }
};

const createHrWorkforcePlan = async (req, res) => {
  try {
    await ensureHrWorkforcePlansTable();
    const {
      department_name,
      current_headcount,
      target_headcount,
      hiring_plan,
      review_date,
      status,
      notes
    } = req.body || {};

    if (!department_name || current_headcount === undefined || target_headcount === undefined) {
      return res.status(400).json({
        error: 'department_name, current_headcount, target_headcount are required'
      });
    }

    const gap = Number(target_headcount) - Number(current_headcount);
    const result = await db.query(
      `INSERT INTO hr_workforce_plans
        (department_name, current_headcount, target_headcount, gap, hiring_plan, review_date, status, notes, entity_id, entity_type)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)
       RETURNING id, department_name, current_headcount, target_headcount, gap, hiring_plan,
                 TO_CHAR(review_date, 'YYYY-MM-DD') AS review_date, status, notes, created_at, updated_at`,
      [
        department_name,
        Number(current_headcount),
        Number(target_headcount),
        gap,
        hiring_plan || null,
        review_date || null,
        status || 'قيد المراجعة',
        notes || null,
        req.userEntity.id,
        req.userEntity.type
      ]
    );

    res.status(201).json(result.rows[0]);
  } catch (error) {
    console.error('Error creating HR workforce plan:', error);
    res.status(500).json({ error: error.message });
  }
};

const updateHrWorkforcePlan = async (req, res) => {
  try {
    await ensureHrWorkforcePlansTable();
    const { id } = req.params;
    const {
      department_name,
      current_headcount,
      target_headcount,
      hiring_plan,
      review_date,
      status,
      notes
    } = req.body || {};

    const isHq = req.userEntity?.type === 'HQ';
    const filterClause = isHq ? '1=1' : 'w.entity_id = $8';
    const params = [
      department_name || null,
      current_headcount !== undefined ? Number(current_headcount) : null,
      target_headcount !== undefined ? Number(target_headcount) : null,
      hiring_plan || null,
      review_date || null,
      status || null,
      notes || null,
      id
    ];
    if (!isHq) {
      params.push(req.userEntity.id);
    }

    const result = await db.query(
      `UPDATE hr_workforce_plans w
       SET department_name = COALESCE($1, w.department_name),
           current_headcount = COALESCE($2, w.current_headcount),
           target_headcount = COALESCE($3, w.target_headcount),
           gap = COALESCE($3, w.target_headcount) - COALESCE($2, w.current_headcount),
           hiring_plan = COALESCE($4, w.hiring_plan),
           review_date = COALESCE($5, w.review_date),
           status = COALESCE($6, w.status),
           notes = COALESCE($7, w.notes),
           updated_at = NOW()
       WHERE w.id = $8 AND ${filterClause}
       RETURNING id, department_name, current_headcount, target_headcount, gap, hiring_plan,
                 TO_CHAR(review_date, 'YYYY-MM-DD') AS review_date, status, notes, created_at, updated_at`,
      params
    );

    if (!result.rows[0]) {
      return res.status(404).json({ error: 'Workforce plan not found' });
    }

    res.json(result.rows[0]);
  } catch (error) {
    console.error('Error updating HR workforce plan:', error);
    res.status(500).json({ error: error.message });
  }
};

const deleteHrWorkforcePlan = async (req, res) => {
  try {
    await ensureHrWorkforcePlansTable();
    const { id } = req.params;
    const isHq = req.userEntity?.type === 'HQ';
    const filterClause = isHq ? '1=1' : 'w.entity_id = $2';
    const params = isHq ? [id] : [id, req.userEntity.id];
    const result = await db.query(
      `DELETE FROM hr_workforce_plans w
       WHERE w.id = $1 AND ${filterClause}
       RETURNING id`,
      params
    );

    if (!result.rows[0]) {
      return res.status(404).json({ error: 'Workforce plan not found' });
    }

    res.json({ success: true, id: result.rows[0].id });
  } catch (error) {
    console.error('Error deleting HR workforce plan:', error);
    res.status(500).json({ error: error.message });
  }
};

app.get('/api/hr-workforce-plans', getHrWorkforcePlans);
app.post('/api/hr-workforce-plans', createHrWorkforcePlan);
app.put('/api/hr-workforce-plans/:id', updateHrWorkforcePlan);
app.delete('/api/hr-workforce-plans/:id', deleteHrWorkforcePlan);
app.get('/api/hr/workforce-plans', getHrWorkforcePlans);
app.post('/api/hr/workforce-plans', createHrWorkforcePlan);
app.put('/api/hr/workforce-plans/:id', updateHrWorkforcePlan);
app.delete('/api/hr/workforce-plans/:id', deleteHrWorkforcePlan);

// HR Succession Planning
const getHrSuccessionPlans = async (req, res) => {
  try {
    await ensureHrSuccessionPlansTable();
    const isHq = req.userEntity?.type === 'HQ';
    const filterClause = isHq ? '1=1' : 's.entity_id = $1';
    const params = isHq ? [] : [req.userEntity.id];
    const result = await db.query(
      `SELECT s.id,
              s.role_title,
              s.incumbent_name,
              s.successor_name,
              s.readiness_level,
              s.development_plan,
              TO_CHAR(s.review_date, 'YYYY-MM-DD') AS review_date,
              s.succession_status,
              s.created_at,
              s.updated_at
       FROM hr_succession_plans s
       WHERE ${filterClause}
       ORDER BY s.review_date DESC NULLS LAST, s.updated_at DESC`,
      params
    );
    res.json(result.rows || []);
  } catch (error) {
    console.error('Error fetching HR succession plans:', error);
    res.status(500).json({ error: error.message });
  }
};

const createHrSuccessionPlan = async (req, res) => {
  try {
    await ensureHrSuccessionPlansTable();
    const {
      role_title,
      incumbent_name,
      successor_name,
      readiness_level,
      development_plan,
      review_date,
      succession_status
    } = req.body || {};

    if (!role_title || !incumbent_name) {
      return res.status(400).json({
        error: 'role_title and incumbent_name are required'
      });
    }

    const result = await db.query(
      `INSERT INTO hr_succession_plans
        (role_title, incumbent_name, successor_name, readiness_level, development_plan, review_date, succession_status, entity_id, entity_type)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)
       RETURNING id, role_title, incumbent_name, successor_name, readiness_level, development_plan,
                 TO_CHAR(review_date, 'YYYY-MM-DD') AS review_date, succession_status, created_at, updated_at`,
      [
        role_title,
        incumbent_name,
        successor_name || null,
        readiness_level || 'غير متوفر',
        development_plan || null,
        review_date || null,
        succession_status || 'قيد التطوير',
        req.userEntity.id,
        req.userEntity.type
      ]
    );

    res.status(201).json(result.rows[0]);
  } catch (error) {
    console.error('Error creating HR succession plan:', error);
    res.status(500).json({ error: error.message });
  }
};

const updateHrSuccessionPlan = async (req, res) => {
  try {
    await ensureHrSuccessionPlansTable();
    const { id } = req.params;
    const {
      role_title,
      incumbent_name,
      successor_name,
      readiness_level,
      development_plan,
      review_date,
      succession_status
    } = req.body || {};

    const isHq = req.userEntity?.type === 'HQ';
    const filterClause = isHq ? '1=1' : 's.entity_id = $8';
    const params = [
      role_title || null,
      incumbent_name || null,
      successor_name || null,
      readiness_level || 'غير متوفر',
      development_plan || null,
      review_date || null,
      succession_status || 'قيد التطوير',
      id
    ];
    if (!isHq) {
      params.push(req.userEntity.id);
    }

    const result = await db.query(
      `UPDATE hr_succession_plans s
       SET role_title = COALESCE($1, s.role_title),
           incumbent_name = COALESCE($2, s.incumbent_name),
           successor_name = $3,
           readiness_level = $4,
           development_plan = $5,
           review_date = $6,
           succession_status = $7,
           updated_at = NOW()
       WHERE s.id = $8 AND ${filterClause}
       RETURNING id, role_title, incumbent_name, successor_name, readiness_level, development_plan,
                 TO_CHAR(review_date, 'YYYY-MM-DD') AS review_date, succession_status, created_at, updated_at`,
      params
    );

    if (!result.rows[0]) {
      return res.status(404).json({ error: 'Succession plan not found' });
    }

    res.json(result.rows[0]);
  } catch (error) {
    console.error('Error updating HR succession plan:', error);
    res.status(500).json({ error: error.message });
  }
};

const deleteHrSuccessionPlan = async (req, res) => {
  try {
    await ensureHrSuccessionPlansTable();
    const { id } = req.params;
    const isHq = req.userEntity?.type === 'HQ';
    const filterClause = isHq ? '1=1' : 's.entity_id = $2';
    const params = isHq ? [id] : [id, req.userEntity.id];
    const result = await db.query(
      `DELETE FROM hr_succession_plans s
       WHERE s.id = $1 AND ${filterClause}
       RETURNING id`,
      params
    );

    if (!result.rows[0]) {
      return res.status(404).json({ error: 'Succession plan not found' });
    }

    res.json({ success: true, id: result.rows[0].id });
  } catch (error) {
    console.error('Error deleting HR succession plan:', error);
    res.status(500).json({ error: error.message });
  }
};

app.get('/api/hr-succession-plans', getHrSuccessionPlans);
app.post('/api/hr-succession-plans', createHrSuccessionPlan);
app.put('/api/hr-succession-plans/:id', updateHrSuccessionPlan);
app.delete('/api/hr-succession-plans/:id', deleteHrSuccessionPlan);
app.get('/api/hr/succession-plans', getHrSuccessionPlans);
app.post('/api/hr/succession-plans', createHrSuccessionPlan);
app.put('/api/hr/succession-plans/:id', updateHrSuccessionPlan);
app.delete('/api/hr/succession-plans/:id', deleteHrSuccessionPlan);

// HR Cost Optimization Departments
const getHrCostOptimizationDepartments = async (req, res) => {
  try {
    const result = await db.query(
      `SELECT * FROM hr_cost_optimization_departments
       WHERE ${getStrictRequestEntityCondition(req, 'entity_id', 1)}
       ORDER BY total_cost DESC, id DESC`,
      [getRequestEntityContext(req).id]
    );
    res.json(result.rows);
  } catch (error) {
    console.error('Error fetching HR cost optimization departments:', error);
    res.status(500).json({ error: error.message });
  }
};

const createHrCostOptimizationDepartment = async (req, res) => {
  try {
    const {
      department_name,
      employee_count,
      total_cost,
      avg_performance,
      efficiency_percent,
      recommendation,
      planned_cost,
      actual_cost,
      overtime_waste_hours
    } = req.body || {};

    if (!department_name || employee_count === undefined || total_cost === undefined || avg_performance === undefined || efficiency_percent === undefined) {
      return res.status(400).json({
        error: 'department_name, employee_count, total_cost, avg_performance, efficiency_percent are required'
      });
    }

    const result = await db.query(
      `INSERT INTO hr_cost_optimization_departments
        (department_name, employee_count, total_cost, avg_performance, efficiency_percent, recommendation, planned_cost, actual_cost, overtime_waste_hours, entity_id, entity_type)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)
       RETURNING *`,
      [
        department_name,
        Number(employee_count),
        Number(total_cost),
        Number(avg_performance),
        Number(efficiency_percent),
        recommendation || null,
        planned_cost !== undefined && planned_cost !== null ? Number(planned_cost) : null,
        actual_cost !== undefined && actual_cost !== null ? Number(actual_cost) : null,
        overtime_waste_hours !== undefined && overtime_waste_hours !== null ? Number(overtime_waste_hours) : 0,
        getRequestEntityContext(req).id,
        getRequestEntityContext(req).type
      ]
    );

    res.json(result.rows[0]);
  } catch (error) {
    console.error('Error creating HR cost optimization department:', error);
    res.status(500).json({ error: error.message });
  }
};

const updateHrCostOptimizationDepartment = async (req, res) => {
  try {
    const { id } = req.params;
    const {
      department_name,
      employee_count,
      total_cost,
      avg_performance,
      efficiency_percent,
      recommendation,
      planned_cost,
      actual_cost,
      overtime_waste_hours
    } = req.body || {};

    const result = await db.query(
      `UPDATE hr_cost_optimization_departments
       SET department_name = $1,
           employee_count = $2,
           total_cost = $3,
           avg_performance = $4,
           efficiency_percent = $5,
           recommendation = $6,
           planned_cost = $7,
           actual_cost = $8,
           overtime_waste_hours = $9,
           updated_at = NOW()
       WHERE id = $10 AND ${getStrictRequestEntityCondition(req, 'entity_id', 11)}
       RETURNING *`,
      [
        department_name,
        Number(employee_count),
        Number(total_cost),
        Number(avg_performance),
        Number(efficiency_percent),
        recommendation || null,
        planned_cost !== undefined && planned_cost !== null ? Number(planned_cost) : null,
        actual_cost !== undefined && actual_cost !== null ? Number(actual_cost) : null,
        overtime_waste_hours !== undefined && overtime_waste_hours !== null ? Number(overtime_waste_hours) : 0,
        id,
        getRequestEntityContext(req).id
      ]
    );

    if (!result.rows[0]) {
      return res.status(404).json({ error: 'Cost department not found' });
    }

    res.json(result.rows[0]);
  } catch (error) {
    console.error('Error updating HR cost optimization department:', error);
    res.status(500).json({ error: error.message });
  }
};

const deleteHrCostOptimizationDepartment = async (req, res) => {
  try {
    const { id } = req.params;
    const result = await db.query(
      `DELETE FROM hr_cost_optimization_departments
       WHERE id = $1 AND ${getStrictRequestEntityCondition(req, 'entity_id', 2)}
       RETURNING id`,
      [id, getRequestEntityContext(req).id]
    );

    if (!result.rows[0]) {
      return res.status(404).json({ error: 'Cost department not found' });
    }

    res.json({ success: true, id: result.rows[0].id });
  } catch (error) {
    console.error('Error deleting HR cost optimization department:', error);
    res.status(500).json({ error: error.message });
  }
};

app.get('/api/hr-cost-optimization-departments', getHrCostOptimizationDepartments);
app.post('/api/hr-cost-optimization-departments', createHrCostOptimizationDepartment);
app.put('/api/hr-cost-optimization-departments/:id', updateHrCostOptimizationDepartment);
app.delete('/api/hr-cost-optimization-departments/:id', deleteHrCostOptimizationDepartment);
app.get('/api/hr/cost-optimization-departments', getHrCostOptimizationDepartments);
app.post('/api/hr/cost-optimization-departments', createHrCostOptimizationDepartment);
app.put('/api/hr/cost-optimization-departments/:id', updateHrCostOptimizationDepartment);
app.delete('/api/hr/cost-optimization-departments/:id', deleteHrCostOptimizationDepartment);

// HR Productivity Records
const getHrProductivityRecords = async (req, res) => {
  try {
    const result = await db.query(
      `SELECT * FROM hr_productivity_records
       WHERE ${getStrictRequestEntityCondition(req, 'entity_id', 1)}
       ORDER BY productivity_level DESC, id DESC`,
      [getRequestEntityContext(req).id]
    );
    res.json(result.rows);
  } catch (error) {
    console.error('Error fetching HR productivity records:', error);
    res.status(500).json({ error: error.message });
  }
};

const createHrProductivityRecord = async (req, res) => {
  try {
    const {
      employee_name,
      department,
      work_hours,
      overtime_hours,
      productivity_level,
      efficiency_percent,
      final_rating
    } = req.body || {};

    if (!employee_name || !department || work_hours === undefined || productivity_level === undefined || efficiency_percent === undefined) {
      return res.status(400).json({
        error: 'employee_name, department, work_hours, productivity_level, efficiency_percent are required'
      });
    }

    const result = await db.query(
      `INSERT INTO hr_productivity_records
        (employee_name, department, work_hours, overtime_hours, productivity_level, efficiency_percent, final_rating, entity_id, entity_type)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)
       RETURNING *`,
      [
        employee_name,
        department,
        Number(work_hours),
        overtime_hours !== undefined && overtime_hours !== null ? Number(overtime_hours) : 0,
        Number(productivity_level),
        Number(efficiency_percent),
        final_rating || null,
        getRequestEntityContext(req).id,
        getRequestEntityContext(req).type
      ]
    );

    res.json(result.rows[0]);
  } catch (error) {
    console.error('Error creating HR productivity record:', error);
    res.status(500).json({ error: error.message });
  }
};

const updateHrProductivityRecord = async (req, res) => {
  try {
    const { id } = req.params;
    const {
      employee_name,
      department,
      work_hours,
      overtime_hours,
      productivity_level,
      efficiency_percent,
      final_rating
    } = req.body || {};

    const result = await db.query(
      `UPDATE hr_productivity_records
       SET employee_name = $1,
           department = $2,
           work_hours = $3,
           overtime_hours = $4,
           productivity_level = $5,
           efficiency_percent = $6,
           final_rating = $7,
           updated_at = NOW()
       WHERE id = $8 AND ${getStrictRequestEntityCondition(req, 'entity_id', 9)}
       RETURNING *`,
      [
        employee_name,
        department,
        Number(work_hours),
        overtime_hours !== undefined && overtime_hours !== null ? Number(overtime_hours) : 0,
        Number(productivity_level),
        Number(efficiency_percent),
        final_rating || null,
        id,
        getRequestEntityContext(req).id
      ]
    );

    if (!result.rows[0]) {
      return res.status(404).json({ error: 'Productivity record not found' });
    }

    res.json(result.rows[0]);
  } catch (error) {
    console.error('Error updating HR productivity record:', error);
    res.status(500).json({ error: error.message });
  }
};

const deleteHrProductivityRecord = async (req, res) => {
  try {
    const { id } = req.params;
    const result = await db.query(
      `DELETE FROM hr_productivity_records
       WHERE id = $1 AND ${getStrictRequestEntityCondition(req, 'entity_id', 2)}
       RETURNING id`,
      [id, getRequestEntityContext(req).id]
    );

    if (!result.rows[0]) {
      return res.status(404).json({ error: 'Productivity record not found' });
    }

    res.json({ success: true, id: result.rows[0].id });
  } catch (error) {
    console.error('Error deleting HR productivity record:', error);
    res.status(500).json({ error: error.message });
  }
};

app.get('/api/hr-productivity-records', getHrProductivityRecords);
app.post('/api/hr-productivity-records', createHrProductivityRecord);
app.put('/api/hr-productivity-records/:id', updateHrProductivityRecord);
app.delete('/api/hr-productivity-records/:id', deleteHrProductivityRecord);
app.get('/api/hr/productivity-records', getHrProductivityRecords);
app.post('/api/hr/productivity-records', createHrProductivityRecord);
app.put('/api/hr/productivity-records/:id', updateHrProductivityRecord);
app.delete('/api/hr/productivity-records/:id', deleteHrProductivityRecord);

// HR Innovation Ideas
const getHrInnovationIdeas = async (req, res) => {
  try {
    const result = await db.query(
      `SELECT * FROM hr_innovation_ideas
       WHERE ${getStrictRequestEntityCondition(req, 'entity_id', 1)}
       ORDER BY submitted_on DESC, id DESC`,
      [getRequestEntityContext(req).id]
    );
    res.json(result.rows);
  } catch (error) {
    console.error('Error fetching HR innovation ideas:', error);
    res.status(500).json({ error: error.message });
  }
};

const createHrInnovationIdea = async (req, res) => {
  try {
    const {
      owner_name,
      idea_title,
      department,
      innovation_type,
      expected_impact,
      status,
      submitted_on,
      rating,
      votes,
      financial_impact,
      history
    } = req.body || {};

    if (!owner_name || !idea_title || !department || !innovation_type || !expected_impact) {
      return res.status(400).json({
        error: 'owner_name, idea_title, department, innovation_type, expected_impact are required'
      });
    }

    const result = await db.query(
      `INSERT INTO hr_innovation_ideas
        (owner_name, idea_title, department, innovation_type, expected_impact, status, submitted_on, rating, votes, financial_impact, history, entity_id, entity_type)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13)
       RETURNING *`,
      [
        owner_name,
        idea_title,
        department,
        innovation_type,
        expected_impact,
        status || 'جديدة',
        submitted_on || null,
        rating !== undefined && rating !== null ? Number(rating) : 0,
        votes !== undefined && votes !== null ? Number(votes) : 0,
        financial_impact !== undefined && financial_impact !== null ? Number(financial_impact) : 0,
        JSON.stringify(Array.isArray(history) ? history : []),
        getRequestEntityContext(req).id,
        getRequestEntityContext(req).type
      ]
    );

    res.json(result.rows[0]);
  } catch (error) {
    console.error('Error creating HR innovation idea:', error);
    res.status(500).json({ error: error.message });
  }
};

const updateHrInnovationIdea = async (req, res) => {
  try {
    const { id } = req.params;
    const {
      owner_name,
      idea_title,
      department,
      innovation_type,
      expected_impact,
      status,
      submitted_on,
      rating,
      votes,
      financial_impact,
      history
    } = req.body || {};

    const result = await db.query(
      `UPDATE hr_innovation_ideas
       SET owner_name = $1,
           idea_title = $2,
           department = $3,
           innovation_type = $4,
           expected_impact = $5,
           status = $6,
           submitted_on = $7,
           rating = $8,
           votes = $9,
           financial_impact = $10,
           history = $11,
           updated_at = NOW()
       WHERE id = $12 AND ${getStrictRequestEntityCondition(req, 'entity_id', 13)}
       RETURNING *`,
      [
        owner_name,
        idea_title,
        department,
        innovation_type,
        expected_impact,
        status || 'جديدة',
        submitted_on || null,
        rating !== undefined && rating !== null ? Number(rating) : 0,
        votes !== undefined && votes !== null ? Number(votes) : 0,
        financial_impact !== undefined && financial_impact !== null ? Number(financial_impact) : 0,
        JSON.stringify(Array.isArray(history) ? history : []),
        id,
        getRequestEntityContext(req).id
      ]
    );

    if (!result.rows[0]) {
      return res.status(404).json({ error: 'Innovation idea not found' });
    }

    res.json(result.rows[0]);
  } catch (error) {
    console.error('Error updating HR innovation idea:', error);
    res.status(500).json({ error: error.message });
  }
};

const deleteHrInnovationIdea = async (req, res) => {
  try {
    const { id } = req.params;
    const result = await db.query(
      `DELETE FROM hr_innovation_ideas
       WHERE id = $1 AND ${getStrictRequestEntityCondition(req, 'entity_id', 2)}
       RETURNING id`,
      [id, getRequestEntityContext(req).id]
    );

    if (!result.rows[0]) {
      return res.status(404).json({ error: 'Innovation idea not found' });
    }

    res.json({ success: true, id: result.rows[0].id });
  } catch (error) {
    console.error('Error deleting HR innovation idea:', error);
    res.status(500).json({ error: error.message });
  }
};

app.get('/api/hr-innovation-ideas', getHrInnovationIdeas);
app.post('/api/hr-innovation-ideas', createHrInnovationIdea);
app.put('/api/hr-innovation-ideas/:id', updateHrInnovationIdea);
app.delete('/api/hr-innovation-ideas/:id', deleteHrInnovationIdea);
app.get('/api/hr/innovation-ideas', getHrInnovationIdeas);
app.post('/api/hr/innovation-ideas', createHrInnovationIdea);
app.put('/api/hr/innovation-ideas/:id', updateHrInnovationIdea);
app.delete('/api/hr/innovation-ideas/:id', deleteHrInnovationIdea);

app.post('/api/hr-payroll-records', async (req, res) => {
  try {
    const {
      employee_name,
      department,
      operation_type,
      amount,
      base_salary,
      allowances,
      deductions,
      bonuses,
      status,
      pay_date,
      payroll_month,
      notes,
      history,
      adjustments
    } = req.body || {};

    const toNumber = (value) => Number(value || 0);
    const computedAmount =
      amount !== undefined && amount !== null
        ? toNumber(amount)
        : toNumber(base_salary) + toNumber(allowances) + toNumber(bonuses) - toNumber(deductions);
    const operationType = operation_type || 'salary';

    if (!employee_name || !pay_date) {
      return res.status(400).json({ error: 'employee_name and pay_date are required' });
    }

    const result = await db.query(
      `INSERT INTO hr_payroll_records
       (employee_name, department, operation_type, amount, base_salary, allowances, deductions, bonuses, status, pay_date, payroll_month, notes, history, adjustments, entity_id, entity_type)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16)
       RETURNING *`,
      [
        employee_name,
        department || null,
        operationType,
        computedAmount,
        base_salary || 0,
        allowances || 0,
        deductions || 0,
        bonuses || 0,
        status || 'قيد المعالجة',
        pay_date,
        payroll_month || null,
        notes || null,
        JSON.stringify(history || []),
        JSON.stringify(adjustments || []),
        getRequestEntityContext(req).id,
        getRequestEntityContext(req).type
      ]
    );

    res.json(result.rows[0]);
  } catch (error) {
    console.error('Error creating HR payroll record:', error);
    res.status(500).json({ error: error.message });
  }
});

app.put('/api/hr-payroll-records/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const {
      employee_name,
      department,
      operation_type,
      amount,
      base_salary,
      allowances,
      deductions,
      bonuses,
      status,
      pay_date,
      payroll_month,
      notes,
      history,
      adjustments
    } = req.body || {};

    const toNumber = (value) => Number(value || 0);
    const computedAmount =
      amount !== undefined && amount !== null
        ? toNumber(amount)
        : toNumber(base_salary) + toNumber(allowances) + toNumber(bonuses) - toNumber(deductions);
    const operationType = operation_type || 'salary';

    const result = await db.query(
      `UPDATE hr_payroll_records
       SET employee_name = $1,
           department = $2,
           operation_type = $3,
           amount = $4,
           base_salary = $5,
           allowances = $6,
           deductions = $7,
           bonuses = $8,
           status = $9,
           pay_date = $10,
           payroll_month = $11,
           notes = $12,
           history = $13,
           adjustments = $14,
           updated_at = NOW()
       WHERE id = $15 AND ${getStrictRequestEntityCondition(req, 'entity_id', 16)}
       RETURNING *`,
      [
        employee_name,
        department || null,
        operationType,
        computedAmount,
        base_salary || 0,
        allowances || 0,
        deductions || 0,
        bonuses || 0,
        status || 'قيد المعالجة',
        pay_date,
        payroll_month || null,
        notes || null,
        JSON.stringify(history || []),
        JSON.stringify(adjustments || []),
        id,
        getRequestEntityContext(req).id
      ]
    );

    if (!result.rows[0]) {
      return res.status(404).json({ error: 'Payroll record not found' });
    }

    res.json(result.rows[0]);
  } catch (error) {
    console.error('Error updating HR payroll record:', error);
    res.status(500).json({ error: error.message });
  }
});

app.delete('/api/hr-payroll-records/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const result = await db.query(
      `DELETE FROM hr_payroll_records
       WHERE id = $1 AND ${getStrictRequestEntityCondition(req, 'entity_id', 2)}
       RETURNING id`,
      [id, getRequestEntityContext(req).id]
    );

    if (!result.rows[0]) {
      return res.status(404).json({ error: 'Payroll record not found' });
    }

    res.json({ success: true, id: result.rows[0].id });
  } catch (error) {
    console.error('Error deleting HR payroll record:', error);
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/hr-performance-evaluations', async (req, res) => {
  try {
    const {
      employee_name,
      department,
      evaluation_type,
      evaluation_period,
      score,
      status,
      evaluator_name,
      evaluation_date,
      strengths,
      improvements,
      manager_notes,
      development_plan
    } = req.body || {};

    if (!employee_name || !evaluation_date) {
      return res.status(400).json({ error: 'employee_name and evaluation_date are required' });
    }

    const result = await db.query(
      `INSERT INTO hr_performance_evaluations
       (employee_name, department, evaluation_type, evaluation_period, score, status, evaluator_name, evaluation_date, strengths, improvements, manager_notes, development_plan, entity_id, entity_type)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14)
       RETURNING *`,
      [
        employee_name,
        department || null,
        evaluation_type || null,
        evaluation_period || null,
        score || null,
        status || 'قيد التقييم',
        evaluator_name || null,
        evaluation_date,
        strengths || [],
        improvements || [],
        manager_notes || null,
        development_plan || [],
        getRequestEntityContext(req).id,
        getRequestEntityContext(req).type
      ]
    );

    res.json(result.rows[0]);
  } catch (error) {
    console.error('Error creating HR performance evaluation:', error);
    res.status(500).json({ error: error.message });
  }
});

app.put('/api/hr-performance-evaluations/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const {
      employee_name,
      department,
      evaluation_type,
      evaluation_period,
      score,
      status,
      evaluator_name,
      evaluation_date,
      strengths,
      improvements,
      manager_notes,
      development_plan
    } = req.body || {};

    const result = await db.query(
      `UPDATE hr_performance_evaluations
       SET employee_name = $1,
           department = $2,
           evaluation_type = $3,
           evaluation_period = $4,
           score = $5,
           status = $6,
           evaluator_name = $7,
           evaluation_date = $8,
           strengths = $9,
           improvements = $10,
           manager_notes = $11,
           development_plan = $12,
           updated_at = NOW()
       WHERE id = $13 AND ${getStrictRequestEntityCondition(req, 'entity_id', 14)}
       RETURNING *`,
      [
        employee_name,
        department || null,
        evaluation_type || null,
        evaluation_period || null,
        score || null,
        status || 'قيد التقييم',
        evaluator_name || null,
        evaluation_date,
        strengths || [],
        improvements || [],
        manager_notes || null,
        development_plan || [],
        id,
        getRequestEntityContext(req).id
      ]
    );

    if (!result.rows[0]) {
      return res.status(404).json({ error: 'Evaluation not found' });
    }

    res.json(result.rows[0]);
  } catch (error) {
    console.error('Error updating HR performance evaluation:', error);
    res.status(500).json({ error: error.message });
  }
});

app.delete('/api/hr-performance-evaluations/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const result = await db.query(
      `DELETE FROM hr_performance_evaluations
       WHERE id = $1 AND ${getStrictRequestEntityCondition(req, 'entity_id', 2)}
       RETURNING id`,
      [id, getRequestEntityContext(req).id]
    );

    if (!result.rows[0]) {
      return res.status(404).json({ error: 'Evaluation not found' });
    }

    res.json({ success: true, id: result.rows[0].id });
  } catch (error) {
    console.error('Error deleting HR performance evaluation:', error);
    res.status(500).json({ error: error.message });
  }
});

// Information Repository
app.get('/api/information-repository', async (req, res) => {
  try {
    const result = await db.query('SELECT * FROM information_repository ORDER BY category, title');
    res.json(result.rows);
  } catch (error) {
    console.error('Error fetching information repository:', error);
    res.status(500).json({ error: error.message });
  }
});

// Knowledge Base
app.get('/api/knowledge-base', async (req, res) => {
  try {
    const result = await db.query('SELECT * FROM knowledge_base ORDER BY helpful_count DESC');
    res.json(result.rows);
  } catch (error) {
    console.error('Error fetching knowledge base:', error);
    res.status(500).json({ error: error.message });
  }
});

const CREATOR_UPLOADS_DIR = path.join(__dirname, 'uploads', 'creator-pages');

const ensureCreatorUploadsDir = () => {
  if (!fs.existsSync(CREATOR_UPLOADS_DIR)) {
    fs.mkdirSync(CREATOR_UPLOADS_DIR, { recursive: true });
  }
};

const normalizeCreatorUsername = (value = '') => String(value).trim().toLowerCase();
const isValidCreatorUsername = (value = '') => /^[a-z0-9][a-z0-9_-]{2,29}$/.test(value);

const toSafeCreatorUrl = (value = '') => {
  const trimmed = String(value || '').trim();
  if (!trimmed) return '';
  try {
    const parsed = new URL(trimmed);
    if (parsed.protocol === 'http:' || parsed.protocol === 'https:') return parsed.toString();
    return '';
  } catch (_error) {
    return '';
  }
};

const creatorImageStorage = multer.diskStorage({
  destination: (_req, _file, cb) => {
    ensureCreatorUploadsDir();
    cb(null, CREATOR_UPLOADS_DIR);
  },
  filename: (_req, file, cb) => {
    const rawName = path.basename(String(file.originalname || 'image'));
    const safeBaseName = rawName
      .replace(/[^\p{L}\p{N}._-]/gu, '-')
      .replace(/-+/g, '-');
    const normalizedName = safeBaseName.replace(/\.{2,}/g, '.').replace(/^\.+/, '');
    const finalName = normalizedName || 'image.png';
    cb(null, `${Date.now()}-${Math.round(Math.random() * 1e6)}-${finalName}`);
  }
});

const creatorImageUpload = multer({
  storage: creatorImageStorage,
  fileFilter: (_req, file, cb) => {
    const allowedMimes = new Set(['image/jpeg', 'image/png', 'image/webp', 'image/gif']);
    if (!allowedMimes.has(file.mimetype)) {
      return cb(new Error('Only image uploads are allowed'));
    }
    cb(null, true);
  }
});

const getAuthenticatedUser = async (req) => {
  const token = getAuthToken(req) || (req.headers.authorization || '').replace(/^Bearer\s+/i, '').trim();
  if (!token) {
    return DEFAULT_BYPASS_USER;
  }
  if (token === BYPASS_AUTH_TOKEN) {
    return DEFAULT_BYPASS_USER;
  }

  try {
    const result = await db.query(
      `SELECT u.id, u.name, u.email, u.role, u.tenant_type
       FROM user_sessions s
       JOIN users u ON s.user_id = u.id
       WHERE s.session_token = $1
         AND s.expires_at > NOW()
       LIMIT 1`,
      [token]
    );
    return result.rows[0] || DEFAULT_BYPASS_USER;
  } catch (error) {
    console.warn('Authentication DB lookup failed, using bypass user:', error.message);
    return DEFAULT_BYPASS_USER;
  }
};

const hasCreatorAdminAccess = (user) => {
  if (!user) return false;
  const roleValue = String(user.role || '').toLowerCase();
  return user.tenant_type === 'HQ' || roleValue.includes('admin') || roleValue.includes('مدير');
};

const ensureCreatorPagesTables = async () => {
  await db.query(`
    CREATE TABLE IF NOT EXISTS creator_pages (
      id SERIAL PRIMARY KEY,
      user_id INTEGER NOT NULL UNIQUE REFERENCES users(id) ON DELETE CASCADE,
      name VARCHAR(180) NOT NULL,
      username VARCHAR(30) NOT NULL UNIQUE,
      profile_image_url TEXT,
      cover_image_url TEXT,
      bio TEXT,
      phone VARCHAR(40),
      email VARCHAR(200),
      whatsapp TEXT,
      facebook TEXT,
      instagram TEXT,
      youtube TEXT,
      snapchat TEXT,
      tiktok TEXT,
      is_enabled BOOLEAN DEFAULT true,
      is_deleted BOOLEAN DEFAULT false,
      created_at TIMESTAMP DEFAULT NOW(),
      updated_at TIMESTAMP DEFAULT NOW()
    )
  `);
  await db.query(`
    CREATE TABLE IF NOT EXISTS creator_page_links (
      id SERIAL PRIMARY KEY,
      page_id INTEGER NOT NULL REFERENCES creator_pages(id) ON DELETE CASCADE,
      label VARCHAR(120) NOT NULL,
      url TEXT NOT NULL,
      sort_order INTEGER DEFAULT 0,
      created_at TIMESTAMP DEFAULT NOW()
    )
  `);
  await db.query(`
    CREATE TABLE IF NOT EXISTS creator_page_views (
      id SERIAL PRIMARY KEY,
      page_id INTEGER NOT NULL REFERENCES creator_pages(id) ON DELETE CASCADE,
      viewer_user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
      ip_address VARCHAR(120),
      user_agent TEXT,
      created_at TIMESTAMP DEFAULT NOW()
    )
  `);
  await db.query(`
    CREATE TABLE IF NOT EXISTS creator_page_link_clicks (
      id SERIAL PRIMARY KEY,
      page_id INTEGER NOT NULL REFERENCES creator_pages(id) ON DELETE CASCADE,
      click_key VARCHAR(120),
      target_url TEXT,
      viewer_user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
      created_at TIMESTAMP DEFAULT NOW()
    )
  `);
  await db.query(`
    CREATE TABLE IF NOT EXISTS creator_page_follows (
      follower_user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      page_id INTEGER NOT NULL REFERENCES creator_pages(id) ON DELETE CASCADE,
      created_at TIMESTAMP DEFAULT NOW(),
      PRIMARY KEY (follower_user_id, page_id)
    )
  `);
  await db.query('CREATE INDEX IF NOT EXISTS idx_creator_pages_username ON creator_pages(username)');
  await db.query('CREATE INDEX IF NOT EXISTS idx_creator_pages_user_id ON creator_pages(user_id)');
  await db.query('CREATE INDEX IF NOT EXISTS idx_creator_pages_enabled ON creator_pages(is_enabled, is_deleted)');
};

databaseReady
  .then(() => ensureCreatorPagesTables())
  .catch((error) => {
    console.error('Failed to initialize creator pages tables:', error.message);
  });

app.get('/api/creator-pages/check-username', async (req, res) => {
  try {
    const normalized = normalizeCreatorUsername(req.query.username || '');
    if (!isValidCreatorUsername(normalized)) {
      return res.status(400).json({ available: false, error: 'Invalid username format' });
    }
    const exists = await db.query(
      'SELECT 1 FROM creator_pages WHERE username = $1 AND is_deleted = false LIMIT 1',
      [normalized]
    );
    res.json({ available: exists.rowCount === 0 });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.get('/api/creator-pages/me', async (req, res) => {
  try {
    const user = await getAuthenticatedUser(req);
    if (!user) return res.status(401).json({ error: 'Unauthorized' });
    const pageResult = await db.query(
      `SELECT * FROM creator_pages
       WHERE user_id = $1
       LIMIT 1`,
      [user.id]
    );
    if (!pageResult.rows[0]) {
      return res.json({
        page: {
          name: user.name || '',
          username: '',
          profile_image_url: '',
          cover_image_url: '',
          bio: '',
          phone: '',
          email: user.email || '',
          whatsapp: '',
          facebook: '',
          instagram: '',
          youtube: '',
          snapchat: '',
          tiktok: '',
          is_enabled: true
        },
        customLinks: []
      });
    }
    const page = pageResult.rows[0];
    const linksResult = await db.query(
      'SELECT id, label, url, sort_order FROM creator_page_links WHERE page_id = $1 ORDER BY sort_order ASC, id ASC',
      [page.id]
    );
    const followersResult = await db.query('SELECT COUNT(*)::int AS count FROM creator_page_follows WHERE page_id = $1', [page.id]);
    res.json({ page: { ...page, followers_count: followersResult.rows[0]?.count || 0 }, customLinks: linksResult.rows });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/creator-pages/me', creatorImageUpload.fields([{ name: 'profileImage', maxCount: 1 }, { name: 'coverImage', maxCount: 1 }]), async (req, res) => {
  try {
    const user = await getAuthenticatedUser(req);
    if (!user) return res.status(401).json({ error: 'Unauthorized' });
    const existingResult = await db.query('SELECT * FROM creator_pages WHERE user_id = $1 LIMIT 1', [user.id]);
    const existingPage = existingResult.rows[0] || null;

    const username = normalizeCreatorUsername(req.body.username || '');
    if (!isValidCreatorUsername(username)) {
      return res.status(400).json({ error: 'Username must be 3-30 chars and use a-z, 0-9, _ or -' });
    }
    const usernameTaken = await db.query(
      `SELECT 1 FROM creator_pages
       WHERE username = $1
         AND user_id <> $2
         AND is_deleted = false
       LIMIT 1`,
      [username, user.id]
    );
    if (usernameTaken.rowCount > 0) {
      return res.status(409).json({ error: 'Username already in use' });
    }

    const name = String(req.body.name || user.name || '').trim();
    if (!name) return res.status(400).json({ error: 'Name is required' });

    const files = req.files || {};
    const profileImage = files.profileImage?.[0]
      ? `/uploads/creator-pages/${encodeURIComponent(files.profileImage[0].filename)}`
      : (existingPage?.profile_image_url || null);
    const coverImage = files.coverImage?.[0]
      ? `/uploads/creator-pages/${encodeURIComponent(files.coverImage[0].filename)}`
      : (existingPage?.cover_image_url || null);

    const values = [
      user.id,
      name,
      username,
      profileImage,
      coverImage,
      String(req.body.bio || '').trim() || null,
      String(req.body.phone || '').trim() || null,
      String(req.body.email || user.email || '').trim() || null,
      toSafeCreatorUrl(req.body.whatsapp),
      toSafeCreatorUrl(req.body.facebook),
      toSafeCreatorUrl(req.body.instagram),
      toSafeCreatorUrl(req.body.youtube),
      toSafeCreatorUrl(req.body.snapchat),
      toSafeCreatorUrl(req.body.tiktok)
    ];

    const saveResult = await db.query(
      `INSERT INTO creator_pages (
         user_id, name, username, profile_image_url, cover_image_url, bio, phone, email,
         whatsapp, facebook, instagram, youtube, snapchat, tiktok, is_enabled, is_deleted, updated_at
       )
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,true,false,NOW())
       ON CONFLICT (user_id)
       DO UPDATE SET
         name = EXCLUDED.name,
         username = EXCLUDED.username,
         profile_image_url = EXCLUDED.profile_image_url,
         cover_image_url = EXCLUDED.cover_image_url,
         bio = EXCLUDED.bio,
         phone = EXCLUDED.phone,
         email = EXCLUDED.email,
         whatsapp = EXCLUDED.whatsapp,
         facebook = EXCLUDED.facebook,
         instagram = EXCLUDED.instagram,
         youtube = EXCLUDED.youtube,
         snapchat = EXCLUDED.snapchat,
         tiktok = EXCLUDED.tiktok,
         is_deleted = false,
         updated_at = NOW()
       RETURNING *`,
      values
    );

    const page = saveResult.rows[0];
    let customLinks = [];
    try {
      customLinks = JSON.parse(req.body.customLinks || '[]');
    } catch (_error) {
      customLinks = [];
    }
    const safeLinks = Array.isArray(customLinks)
      ? customLinks
        .map((item, index) => ({
          label: String(item?.label || '').trim().slice(0, 120),
          url: toSafeCreatorUrl(item?.url || ''),
          sort_order: index
        }))
        .filter((item) => item.label && item.url)
      : [];

    await db.query('DELETE FROM creator_page_links WHERE page_id = $1', [page.id]);
    if (safeLinks.length > 0) {
      const values = [];
      const placeholders = safeLinks.map((link, index) => {
        const offset = index * 4;
        values.push(page.id, link.label, link.url, link.sort_order);
        return `($${offset + 1}, $${offset + 2}, $${offset + 3}, $${offset + 4})`;
      });
      await db.query(
        `INSERT INTO creator_page_links (page_id, label, url, sort_order) VALUES ${placeholders.join(', ')}`,
        values
      );
    }

    res.json({ success: true, page });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.get('/api/creator-pages/discover', async (req, res) => {
  try {
    const query = String(req.query.query || '').trim();
    const listResult = await db.query(
      `SELECT p.name, p.username, p.bio, p.profile_image_url,
              COALESCE(f.followers_count, 0)::int AS followers_count
       FROM creator_pages p
       LEFT JOIN (
         SELECT page_id, COUNT(*) AS followers_count
         FROM creator_page_follows
         GROUP BY page_id
       ) f ON f.page_id = p.id
       WHERE p.is_deleted = false
         AND p.is_enabled = true
         AND ($1 = '' OR p.name ILIKE '%' || $1 || '%' OR p.username ILIKE '%' || $1 || '%')
       ORDER BY followers_count DESC, p.updated_at DESC
       LIMIT 100`,
      [query]
    );
    res.json({ creators: listResult.rows });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.get('/api/creator-pages/:username', async (req, res) => {
  try {
    const username = normalizeCreatorUsername(req.params.username || '');
    const pageResult = await db.query(
      `SELECT p.*,
              COALESCE(f.followers_count, 0)::int AS followers_count
       FROM creator_pages p
       LEFT JOIN (
         SELECT page_id, COUNT(*) AS followers_count
         FROM creator_page_follows
         GROUP BY page_id
       ) f ON f.page_id = p.id
       WHERE p.username = $1
         AND p.is_deleted = false
         AND p.is_enabled = true
       LIMIT 1`,
      [username]
    );
    const page = pageResult.rows[0];
    if (!page) return res.status(404).json({ error: 'Page not found' });
    const linksResult = await db.query(
      'SELECT id, label, url, sort_order FROM creator_page_links WHERE page_id = $1 ORDER BY sort_order ASC, id ASC',
      [page.id]
    );
    res.json({ page, customLinks: linksResult.rows });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/creator-pages/:username/view', async (req, res) => {
  try {
    const username = normalizeCreatorUsername(req.params.username || '');
    const pageResult = await db.query(
      'SELECT id FROM creator_pages WHERE username = $1 AND is_deleted = false AND is_enabled = true LIMIT 1',
      [username]
    );
    if (!pageResult.rows[0]) return res.status(404).json({ error: 'Page not found' });
    const user = await getAuthenticatedUser(req);
    await db.query(
      `INSERT INTO creator_page_views (page_id, viewer_user_id, ip_address, user_agent)
       VALUES ($1, $2, $3, $4)`,
      [
        pageResult.rows[0].id,
        user?.id || null,
        String(req.headers['x-forwarded-for'] || req.ip || '').slice(0, 120),
        String(req.headers['user-agent'] || '').slice(0, 900)
      ]
    );
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/creator-pages/:username/link-click', async (req, res) => {
  try {
    const username = normalizeCreatorUsername(req.params.username || '');
    const pageResult = await db.query(
      'SELECT id FROM creator_pages WHERE username = $1 AND is_deleted = false AND is_enabled = true LIMIT 1',
      [username]
    );
    if (!pageResult.rows[0]) return res.status(404).json({ error: 'Page not found' });
    const clickKey = String(req.body?.clickKey || '').slice(0, 120);
    const targetUrl = toSafeCreatorUrl(req.body?.targetUrl || '');
    const user = await getAuthenticatedUser(req);
    await db.query(
      `INSERT INTO creator_page_link_clicks (page_id, click_key, target_url, viewer_user_id)
       VALUES ($1, $2, $3, $4)`,
      [pageResult.rows[0].id, clickKey || null, targetUrl || null, user?.id || null]
    );
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.get('/api/creator-pages/:username/follow-state', async (req, res) => {
  try {
    const username = normalizeCreatorUsername(req.params.username || '');
    const pageResult = await db.query(
      `SELECT p.id,
              COALESCE(f.followers_count, 0)::int AS followers_count
       FROM creator_pages p
       LEFT JOIN (
         SELECT page_id, COUNT(*) AS followers_count
         FROM creator_page_follows
         GROUP BY page_id
       ) f ON f.page_id = p.id
       WHERE p.username = $1
         AND p.is_deleted = false
         AND p.is_enabled = true
       LIMIT 1`,
      [username]
    );
    if (!pageResult.rows[0]) return res.status(404).json({ error: 'Page not found' });
    const user = await getAuthenticatedUser(req);
    if (!user) {
      return res.json({ following: false, followers_count: pageResult.rows[0].followers_count });
    }
    const followResult = await db.query(
      'SELECT 1 FROM creator_page_follows WHERE follower_user_id = $1 AND page_id = $2 LIMIT 1',
      [user.id, pageResult.rows[0].id]
    );
    res.json({
      following: followResult.rowCount > 0,
      followers_count: pageResult.rows[0].followers_count
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/creator-pages/:username/follow', async (req, res) => {
  try {
    const user = await getAuthenticatedUser(req);
    if (!user) return res.status(401).json({ error: 'Unauthorized' });
    const username = normalizeCreatorUsername(req.params.username || '');
    const pageResult = await db.query(
      'SELECT id, user_id FROM creator_pages WHERE username = $1 AND is_deleted = false AND is_enabled = true LIMIT 1',
      [username]
    );
    const page = pageResult.rows[0];
    if (!page) return res.status(404).json({ error: 'Page not found' });
    if (Number(page.user_id) === Number(user.id)) {
      return res.status(400).json({ error: 'You cannot follow your own page' });
    }
    await db.query(
      `INSERT INTO creator_page_follows (follower_user_id, page_id)
       VALUES ($1, $2)
       ON CONFLICT (follower_user_id, page_id) DO NOTHING`,
      [user.id, page.id]
    );
    const countResult = await db.query('SELECT COUNT(*)::int AS count FROM creator_page_follows WHERE page_id = $1', [page.id]);
    res.json({ success: true, following: true, followers_count: countResult.rows[0]?.count || 0 });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.delete('/api/creator-pages/:username/follow', async (req, res) => {
  try {
    const user = await getAuthenticatedUser(req);
    if (!user) return res.status(401).json({ error: 'Unauthorized' });
    const username = normalizeCreatorUsername(req.params.username || '');
    const pageResult = await db.query(
      'SELECT id FROM creator_pages WHERE username = $1 AND is_deleted = false AND is_enabled = true LIMIT 1',
      [username]
    );
    const page = pageResult.rows[0];
    if (!page) return res.status(404).json({ error: 'Page not found' });
    await db.query('DELETE FROM creator_page_follows WHERE follower_user_id = $1 AND page_id = $2', [user.id, page.id]);
    const countResult = await db.query('SELECT COUNT(*)::int AS count FROM creator_page_follows WHERE page_id = $1', [page.id]);
    res.json({ success: true, following: false, followers_count: countResult.rows[0]?.count || 0 });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.get('/api/creator-pages/me/stats', async (req, res) => {
  try {
    const user = await getAuthenticatedUser(req);
    if (!user) return res.status(401).json({ error: 'Unauthorized' });
    const pageResult = await db.query(
      'SELECT id, username, name FROM creator_pages WHERE user_id = $1 AND is_deleted = false LIMIT 1',
      [user.id]
    );
    const page = pageResult.rows[0];
    if (!page) {
      return res.json({
        page: null,
        stats: { views: 0, clicks: 0, followers: 0 },
        topLinks: []
      });
    }
    const [viewsResult, clicksResult, followersResult, topLinksResult] = await Promise.all([
      db.query('SELECT COUNT(*)::int AS count FROM creator_page_views WHERE page_id = $1', [page.id]),
      db.query('SELECT COUNT(*)::int AS count FROM creator_page_link_clicks WHERE page_id = $1', [page.id]),
      db.query('SELECT COUNT(*)::int AS count FROM creator_page_follows WHERE page_id = $1', [page.id]),
      db.query(
        `SELECT COALESCE(click_key, 'unlabeled') AS click_key, COUNT(*)::int AS clicks
         FROM creator_page_link_clicks
         WHERE page_id = $1
         GROUP BY click_key
         ORDER BY clicks DESC
         LIMIT 10`,
        [page.id]
      )
    ]);

    res.json({
      page,
      stats: {
        views: viewsResult.rows[0]?.count || 0,
        clicks: clicksResult.rows[0]?.count || 0,
        followers: followersResult.rows[0]?.count || 0
      },
      topLinks: topLinksResult.rows
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.get('/api/creator-pages/:username/qr', async (req, res) => {
  try {
    const username = normalizeCreatorUsername(req.params.username || '');
    const pageResult = await db.query(
      'SELECT username FROM creator_pages WHERE username = $1 AND is_deleted = false AND is_enabled = true LIMIT 1',
      [username]
    );
    if (!pageResult.rows[0]) return res.status(404).json({ error: 'Page not found' });
    const pageUrl = `${req.protocol}://${req.get('host')}/u/${encodeURIComponent(username)}`;
    const qrDataUrl = await QRCode.toDataURL(pageUrl, { margin: 1, width: 480 });
    res.set('Cache-Control', 'public, max-age=300');
    res.json({ pageUrl, qrDataUrl });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.get('/api/admin/creator-pages', async (req, res) => {
  try {
    const user = await getAuthenticatedUser(req);
    if (!hasCreatorAdminAccess(user)) return res.status(403).json({ error: 'Forbidden' });
    const result = await db.query(
      `SELECT p.id, p.name, p.username, p.bio, p.is_enabled, p.is_deleted, p.updated_at,
              u.email,
              COALESCE(f.followers_count, 0)::int AS followers_count
       FROM creator_pages p
       JOIN users u ON u.id = p.user_id
       LEFT JOIN (
         SELECT page_id, COUNT(*) AS followers_count
         FROM creator_page_follows
         GROUP BY page_id
       ) f ON f.page_id = p.id
       ORDER BY p.updated_at DESC`
    );
    res.json({ pages: result.rows });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.patch('/api/admin/creator-pages/:id/status', async (req, res) => {
  try {
    const user = await getAuthenticatedUser(req);
    if (!hasCreatorAdminAccess(user)) return res.status(403).json({ error: 'Forbidden' });
    const id = Number(req.params.id);
    if (!Number.isFinite(id)) return res.status(400).json({ error: 'Invalid page id' });
    const isEnabled = req.body?.is_enabled;
    const isDeleted = req.body?.is_deleted;
    const result = await db.query(
      `UPDATE creator_pages
       SET is_enabled = COALESCE($2, is_enabled),
           is_deleted = COALESCE($3, is_deleted),
           updated_at = NOW()
       WHERE id = $1
       RETURNING *`,
      [id, typeof isEnabled === 'boolean' ? isEnabled : null, typeof isDeleted === 'boolean' ? isDeleted : null]
    );
    if (!result.rows[0]) return res.status(404).json({ error: 'Page not found' });
    res.json({ success: true, page: result.rows[0] });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.delete('/api/admin/creator-pages/:id', async (req, res) => {
  try {
    const user = await getAuthenticatedUser(req);
    if (!hasCreatorAdminAccess(user)) return res.status(403).json({ error: 'Forbidden' });
    const id = Number(req.params.id);
    if (!Number.isFinite(id)) return res.status(400).json({ error: 'Invalid page id' });
    const result = await db.query('DELETE FROM creator_pages WHERE id = $1 RETURNING id', [id]);
    if (!result.rows[0]) return res.status(404).json({ error: 'Page not found' });
    res.json({ success: true, id: result.rows[0].id });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// API errors must return JSON (not Express default HTML page in production)
app.use((err, req, res, next) => {
  if (res.headersSent) return next(err);
  if (req.path.startsWith('/api/')) {
    console.error('API error:', req.method, req.path, err.message, err.stack);
    return res.status(err.status || 500).json({
      success: false,
      message: err.message || 'Internal Server Error',
      path: req.path,
      detail: err.message
    });
  }
  return next(err);
});

// Serve static files after API routes but before SPA catch-all
app.use('/public', express.static(path.join(__dirname, 'public')));
app.use('/uploads', express.static(UPLOADS_ROOT_DIR));

app.get('/*.html', (req, res, next) => {
  const safePath = req.path.replace(/^\/+/, '');
  const filePath = path.join(__dirname, safePath);
  fs.access(filePath, fs.constants.F_OK, (err) => {
    if (err) return next();
    sendHtmlWithNumberFormat(res, filePath);
  });
});

app.use(express.static('.', { index: false }));

app.use((req, res, next) => {
  if (req.method === 'GET' && /\.(?:js|css|mjs|map|png|jpe?g|gif|svg|ico|webmanifest|webp|woff2?|ttf|eot)$/i.test(req.path)) {
    return res.status(404).type('text/plain').send('Static asset not found');
  }
  return next();
});

// مسارات غير معروفة → الصفحة الرئيسية (لا تفتح الداشبورد تلقائياً)
app.get('*', (req, res) => {
  if (req.method !== 'GET') {
    return res.status(404).json({ success: false, message: 'Not found' });
  }
  res.redirect(302, '/');
});

app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({ error: 'Something went wrong!' });
});

// Handle uncaught errors
// ========================================
// PERMISSIONS TESTING API ENDPOINTS
// ========================================

// Get all roles with hierarchy levels
app.get('/api/permissions/roles', async (req, res) => {
  try {
    const result = await db.query(`
      SELECT 
        id,
        name,
        name_ar,
        job_title_ar,
        hierarchy_level,
        max_approval_limit,
        approval_notes_ar,
        description
      FROM roles
      ORDER BY hierarchy_level, job_title_ar
    `);
    
    res.json({
      success: true,
      roles: result.rows,
      count: result.rows.length
    });
  } catch (error) {
    console.error('Error fetching roles:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// Get permissions for specific role
app.get('/api/permissions/role/:roleId', async (req, res) => {
  try {
    const { roleId } = req.params;
    
    const result = await db.query(`
      SELECT 
        rsp.role_id,
        r.name as role_name,
        r.name_ar as role_name_ar,
        r.job_title_ar,
        s.name as system_name,
        s.name_ar as system_name_ar,
        s.description as system_description,
        pl.code as level_code,
        pl.name_ar as level_name_ar,
        pl.allowed_actions,
        pl.restrictions,
        rsp.notes
      FROM role_system_permissions rsp
      JOIN roles r ON r.id = rsp.role_id
      JOIN systems s ON s.id = rsp.system_id
      JOIN permission_levels pl ON pl.id = rsp.permission_level_id
      WHERE rsp.role_id = $1
      ORDER BY s.name
    `, [roleId]);
    
    res.json({
      success: true,
      permissions: result.rows,
      count: result.rows.length
    });
  } catch (error) {
    console.error('Error fetching role permissions:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// Get system statistics
app.get('/api/permissions/stats', async (req, res) => {
  try {
    const rolesCount = await db.query('SELECT COUNT(*) as count FROM roles');
    const systemsCount = await db.query('SELECT COUNT(*) as count FROM systems');
    const levelsCount = await db.query('SELECT COUNT(*) as count FROM permission_levels');
    const permissionsCount = await db.query('SELECT COUNT(*) as count FROM role_system_permissions');
    
    // Roles by hierarchy level
    const rolesByLevel = await db.query(`
      SELECT 
        hierarchy_level,
        COUNT(*) as count
      FROM roles
      GROUP BY hierarchy_level
      ORDER BY hierarchy_level
    `);
    
    res.json({
      success: true,
      stats: {
        total_roles: parseInt(rolesCount.rows[0].count),
        total_systems: parseInt(systemsCount.rows[0].count),
        total_permission_levels: parseInt(levelsCount.rows[0].count),
        total_permissions: parseInt(permissionsCount.rows[0].count),
        roles_by_level: rolesByLevel.rows
      }
    });
  } catch (error) {
    console.error('Error fetching stats:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// Get full permissions matrix
app.get('/api/permissions/matrix', async (req, res) => {
  try {
    // Get all systems
    const systems = await db.query(`
      SELECT id, name, name_ar, description
      FROM systems
      ORDER BY name
    `);
    
    // Get all roles with their permissions
    const roles = await db.query(`
      SELECT 
        r.id,
        r.name,
        r.name_ar,
        r.job_title_ar,
        r.hierarchy_level
      FROM roles r
      ORDER BY r.hierarchy_level, r.job_title_ar
    `);
    
    // Get all permissions
    const matrix = [];
    
    for (const role of roles.rows) {
      const permissions = await db.query(`
        SELECT 
          s.id as system_id,
          s.name as system_name,
          s.name_ar as system_name_ar,
          pl.code as level_code,
          pl.name_ar as level_name_ar
        FROM systems s
        LEFT JOIN role_system_permissions rsp ON rsp.system_id = s.id AND rsp.role_id = $1
        LEFT JOIN permission_levels pl ON pl.id = rsp.permission_level_id
        ORDER BY s.name
      `, [role.id]);
      
      matrix.push({
        role_id: role.id,
        role_name: role.name,
        role_name_ar: role.job_title_ar || role.name_ar,
        hierarchy_level: role.hierarchy_level,
        permissions: permissions.rows
      });
    }
    
    res.json({
      success: true,
      systems: systems.rows,
      matrix: matrix
    });
  } catch (error) {
    console.error('Error fetching matrix:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// Get permission levels
app.get('/api/permissions/levels', async (req, res) => {
  try {
    const result = await db.query(`
      SELECT 
        id,
        code,
        name_ar,
        color_code,
        allowed_actions,
        restrictions,
        description
      FROM permission_levels
      ORDER BY 
        CASE code
          WHEN 'FULL' THEN 1
          WHEN 'VIEW_APPROVE' THEN 2
          WHEN 'EXECUTIVE' THEN 3
          WHEN 'VIEW' THEN 4
          WHEN 'LIMITED' THEN 5
          WHEN 'NONE' THEN 6
        END
    `);
    
    res.json({
      success: true,
      levels: result.rows,
      count: result.rows.length
    });
  } catch (error) {
    console.error('Error fetching permission levels:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// Get all systems
app.get('/api/permissions/systems', async (req, res) => {
  try {
    const result = await db.query(`
      SELECT 
        id,
        name,
        name_ar,
        description,
        color_code,
        icon
      FROM systems
      ORDER BY name
    `);
    
    res.json({
      success: true,
      systems: result.rows,
      count: result.rows.length
    });
  } catch (error) {
    console.error('Error fetching systems:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// Check user permission for specific action
app.post('/api/permissions/check', async (req, res) => {
  try {
    const { roleId, systemName, action } = req.body;
    
    if (!roleId || !systemName || !action) {
      return res.status(400).json({ 
        success: false, 
        error: 'Missing required fields: roleId, systemName, action' 
      });
    }
    
    const result = await db.query(`
      SELECT 
        r.name as role_name,
        r.name_ar as role_name_ar,
        s.name as system_name,
        s.name_ar as system_name_ar,
        pl.code as permission_level,
        pl.name_ar as permission_name_ar,
        pl.allowed_actions,
        pl.restrictions,
        r.max_approval_limit
      FROM role_system_permissions rsp
      JOIN roles r ON r.id = rsp.role_id
      JOIN systems s ON s.id = rsp.system_id
      JOIN permission_levels pl ON pl.id = rsp.permission_level_id
      WHERE rsp.role_id = $1 AND s.name = $2
    `, [roleId, systemName]);
    
    if (result.rows.length === 0) {
      return res.json({
        success: false,
        allowed: false,
        message: 'لا توجد صلاحيات لهذا الدور في هذا النظام'
      });
    }
    
    const permission = result.rows[0];
    const allowedActions = permission.allowed_actions || '';
    const isAllowed = permission.permission_level !== 'NONE' && 
                     (permission.permission_level === 'FULL' || allowedActions.includes(action));
    
    res.json({
      success: true,
      allowed: isAllowed,
      permission_level: permission.permission_level,
      permission_name_ar: permission.permission_name_ar,
      allowed_actions: permission.allowed_actions,
      restrictions: permission.restrictions,
      max_approval_limit: permission.max_approval_limit,
      message: isAllowed ? `مسموح: ${action}` : `غير مسموح: ${action}`
    });
  } catch (error) {
    console.error('Error checking permission:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// Get security policies
app.get('/api/permissions/security-policies', async (req, res) => {
  try {
    const result = await db.query(`
      SELECT 
        id,
        policy_number,
        policy_name_ar,
        description_ar,
        applies_to_levels,
        is_active
      FROM security_policies
      WHERE is_active = true
      ORDER BY policy_number
    `);
    
    res.json({
      success: true,
      policies: result.rows,
      count: result.rows.length
    });
  } catch (error) {
    console.error('Error fetching security policies:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// ============================================================
// API Integrations Library Endpoints
// ============================================================

const ensureApiIntegrationsTable = async () => {
  await db.query(`
    CREATE TABLE IF NOT EXISTS hr_api_integrations (
      id SERIAL PRIMARY KEY,
      service_key VARCHAR(100) NOT NULL,
      api_key TEXT,
      api_secret TEXT,
      endpoint TEXT,
      extra_config JSONB DEFAULT '{}',
      is_connected BOOLEAN DEFAULT FALSE,
      entity_id INTEGER,
      entity_type VARCHAR(50),
      created_at TIMESTAMPTZ DEFAULT NOW(),
      updated_at TIMESTAMPTZ DEFAULT NOW(),
      UNIQUE(service_key, entity_id, entity_type)
    )
  `);
};

app.get('/api/hr/api-integrations', async (req, res) => {
  try {
    await ensureApiIntegrationsTable();
    const filter = getEntityFilter(req.userEntity, 'a');
    const result = await db.query(
      `SELECT a.id, a.service_key, a.api_key, a.api_secret, a.endpoint,
              a.extra_config, a.is_connected, a.created_at, a.updated_at
       FROM hr_api_integrations a
       WHERE ${filter}
       ORDER BY a.service_key ASC`
    );
    res.json(result.rows || []);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.put('/api/hr/api-integrations/:serviceKey', async (req, res) => {
  try {
    await ensureApiIntegrationsTable();
    const { serviceKey } = req.params;
    const { api_key, api_secret, endpoint, extra_config, is_connected } = req.body || {};
    const result = await db.query(
      `INSERT INTO hr_api_integrations
         (service_key, api_key, api_secret, endpoint, extra_config, is_connected, entity_id, entity_type)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
       ON CONFLICT (service_key, entity_id, entity_type)
       DO UPDATE SET
         api_key = EXCLUDED.api_key,
         api_secret = EXCLUDED.api_secret,
         endpoint = EXCLUDED.endpoint,
         extra_config = EXCLUDED.extra_config,
         is_connected = EXCLUDED.is_connected,
         updated_at = NOW()
       RETURNING id, service_key, api_key, api_secret, endpoint, extra_config, is_connected, created_at, updated_at`,
      [
        serviceKey,
        api_key || null,
        api_secret || null,
        endpoint || null,
        JSON.stringify(extra_config || {}),
        is_connected === true || is_connected === 'true',
        req.userEntity.id,
        req.userEntity.type
      ]
    );
    res.json(result.rows[0]);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.delete('/api/hr/api-integrations/:serviceKey', async (req, res) => {
  try {
    await ensureApiIntegrationsTable();
    const { serviceKey } = req.params;
    const filter = getEntityFilter(req.userEntity, 'a');
    await db.query(
      `DELETE FROM hr_api_integrations a WHERE a.service_key = $1 AND ${filter}`,
      [serviceKey]
    );
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// ===================================================================
// BULK MESSAGING API
// ===================================================================
async function ensureBulkMessagesTable() {
  await db.query(`
    CREATE TABLE IF NOT EXISTS hr_bulk_messages (
      id SERIAL PRIMARY KEY,
      title TEXT,
      body TEXT NOT NULL,
      channel VARCHAR(20) NOT NULL DEFAULT 'whatsapp',
      target_group VARCHAR(20) NOT NULL DEFAULT 'all',
      filter_status VARCHAR(50),
      filter_category VARCHAR(100),
      filter_date DATE,
      recipients INTEGER DEFAULT 0,
      status VARCHAR(20) NOT NULL DEFAULT 'pending',
      scheduled_at TIMESTAMPTZ,
      sent_at TIMESTAMPTZ,
      entity_id INTEGER,
      entity_type VARCHAR(50),
      created_at TIMESTAMPTZ DEFAULT NOW()
    )
  `);
}

app.get('/api/hr/bulk-messages', async (req, res) => {
  try {
    await ensureBulkMessagesTable();
    const { channel, status, limit = 50, offset = 0 } = req.query;
    let where = [];
    let params = [];
    let idx = 1;
    if (channel) { where.push(`channel = $${idx++}`); params.push(channel); }
    if (status) { where.push(`status = $${idx++}`); params.push(status); }
    if (req.userEntity) {
      where.push(`(entity_id = $${idx++} AND entity_type = $${idx++})`);
      params.push(req.userEntity.id, req.userEntity.type);
    }
    const whereClause = where.length ? 'WHERE ' + where.join(' AND ') : '';
    params.push(parseInt(limit), parseInt(offset));
    const result = await db.query(
      `SELECT * FROM hr_bulk_messages ${whereClause} ORDER BY created_at DESC LIMIT $${idx++} OFFSET $${idx}`,
      params
    );
    res.json({ messages: result.rows, total: result.rows.length });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/hr/bulk-messages', async (req, res) => {
  try {
    await ensureBulkMessagesTable();
    const {
      title, body, channel = 'whatsapp', target = 'all',
      filter_status, filter_category, filter_date, scheduled_at
    } = req.body || {};

    if (!body) return res.status(400).json({ error: 'نص الرسالة مطلوب' });
    const validChannels = ['whatsapp', 'email', 'sms'];
    if (!validChannels.includes(channel)) return res.status(400).json({ error: 'قناة غير صالحة' });

    // Estimate recipient count (demo)
    const recipientMap = { all: 2340, group: 850, manual: 1 };
    const recipients = recipientMap[target] || 2340;

    const status = scheduled_at ? 'pending' : 'sent';
    const sentAt = scheduled_at ? null : new Date();

    const result = await db.query(
      `INSERT INTO hr_bulk_messages
         (title, body, channel, target_group, filter_status, filter_category, filter_date,
          recipients, status, scheduled_at, sent_at, entity_id, entity_type)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13)
       RETURNING *`,
      [
        title || null,
        body,
        channel,
        target,
        filter_status || null,
        filter_category || null,
        filter_date || null,
        recipients,
        status,
        scheduled_at || null,
        sentAt,
        req.userEntity ? req.userEntity.id : null,
        req.userEntity ? req.userEntity.type : null
      ]
    );
    res.json({ success: true, message: result.rows[0], recipients });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.get('/api/hr/bulk-messages/stats', async (req, res) => {
  try {
    await ensureBulkMessagesTable();
    const result = await db.query(`
      SELECT
        COUNT(*) FILTER (WHERE status = 'sent')    AS sent,
        COUNT(*) FILTER (WHERE status = 'failed')  AS failed,
        COUNT(*) FILTER (WHERE status = 'pending') AS pending,
        SUM(recipients) FILTER (WHERE status = 'sent') AS total_recipients
      FROM hr_bulk_messages
    `);
    res.json(result.rows[0]);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

process.on('uncaughtException', (error) => {
  console.error('💥 Uncaught Exception:', error);
  // Don't exit - let the process continue
});

process.on('unhandledRejection', (reason, promise) => {
  console.error('💥 Unhandled Rejection at:', promise, 'reason:', reason);
  // Don't exit - let the process continue
});

// Unknown /api/* (registered last so it does not shadow real API routes)
app.use('/api', (req, res) => {
  res.status(404).json({
    success: false,
    message: 'API route not found',
    method: req.method,
    path: req.originalUrl || req.path
  });
});

const server = app.listen(listenPort, listenHost, () => {
  const addr = server.address();
  const activePort = addr && typeof addr === 'object' ? addr.port : listenPort;
  const portSource = process.env.PORT ? 'cPanel/env PORT' : 'default 3000';
  console.log(`🚀 نظام نايوش يعمل على ${listenHost}:${activePort} (${portSource})`);
  console.log(`📊 API متاح على: http://127.0.0.1:${activePort}/api/health`);
  console.log(`🌍 Environment: ${process.env.NODE_ENV || 'development'}`);
  console.log(`✅ Server is ready to accept connections`);
});

// Keep server alive - increase timeouts for Railway
server.keepAliveTimeout = 120000; // 120 seconds
server.headersTimeout = 121000;   // 121 seconds
server.timeout = 120000;          // 120 seconds

// Graceful shutdown
let isShuttingDown = false;
process.on('SIGTERM', () => {
  if (isShuttingDown) return;
  isShuttingDown = true;
  
  console.log('⚠️  SIGTERM received, starting graceful shutdown...');
  
  // Give active connections time to finish
  server.close((err) => {
    if (err) {
      console.error('❌ Error during shutdown:', err);
      process.exit(1);
    }
    console.log('✅ Server closed gracefully');
    process.exit(0);
  });
  
  // Force close after 30 seconds
  setTimeout(() => {
    console.error('⏰ Forced shutdown after timeout');
    process.exit(1);
  }, 30000);
});

process.on('SIGINT', () => {
  if (isShuttingDown) return;
  isShuttingDown = true;
  
  console.log('⚠️  SIGINT received, shutting down...');
  server.close(() => {
    console.log('✅ Server closed');
    process.exit(0);
  });
});
