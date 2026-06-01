'use strict';

const fs = require('fs');
const path = require('path');

const ROOT = __dirname.replace(/[\\/]scripts$/, '');
const RAILWAY_MARKERS = [
  'crossover.proxy.rlwy.net',
  'PddzJpAQYezqknsntSzmCUlQYuYJldcT',
  '.proxy.rlwy.net:44255/railway'
];

const SKIP_DIRS = new Set(['node_modules', '.git', 'public', 'newhome', 'pwa', 'tests']);
const SKIP_FILES = new Set(['db.js', 'migrate-all-db-imports.js']);

function walk(dir, files = []) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (SKIP_DIRS.has(entry.name)) continue;
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) walk(full, files);
    else if (entry.isFile() && entry.name.endsWith('.js')) files.push(full);
  }
  return files;
}

function dbRequirePath(filePath) {
  const rel = path.relative(path.dirname(filePath), ROOT).replace(/\\/g, '/');
  if (!rel) return './db';
  return `${rel.split('/').map(() => '..').join('/')}/db`;
}

function hasRailway(content) {
  return RAILWAY_MARKERS.some((m) => content.includes(m));
}

function ensureDotenv(content) {
  if (content.includes("require('dotenv').config()") || content.includes('require("dotenv").config()')) {
    return content;
  }
  const shebang = content.startsWith('#!') ? content.split(/\r?\n/, 1)[0] + '\n' : '';
  const rest = shebang ? content.slice(shebang.length) : content;
  return `${shebang}require('dotenv').config();\n${rest}`;
}

function ensureDbImport(content, dbPath) {
  const importLine = `const db = require('${dbPath}');`;
  if (content.includes(importLine)) return content;
  const dotenvIdx = content.indexOf("require('dotenv').config()");
  if (dotenvIdx !== -1) {
    const lineEnd = content.indexOf('\n', dotenvIdx);
    return `${content.slice(0, lineEnd + 1)}${importLine}\n${content.slice(lineEnd + 1)}`;
  }
  return `${importLine}\n${content}`;
}

function transform(content, dbPath) {
  if (!hasRailway(content)) return null;

  let out = content;

  out = out.replace(/\r\n/g, '\n');

  // Pool blocks pointing to Railway (any shape)
  out = out.replace(
    /const\s+(\w+)\s*=\s*new\s+Pool\s*\(\s*\{[\s\S]*?(?:crossover\.proxy\.rlwy\.net|PddzJpAQYezqknsntSzmCUlQYuYJldcT)[\s\S]*?\}\s*\)\s*;?\s*\n/g,
    ''
  );

  // Client blocks pointing to Railway
  out = out.replace(
    /const\s+(\w+)\s*=\s*new\s+Client\s*\(\s*\{[\s\S]*?(?:crossover\.proxy\.rlwy\.net|PddzJpAQYezqknsntSzmCUlQYuYJldcT)[\s\S]*?\}\s*\)\s*;?\s*\n/g,
    ''
  );

  // connectionString constants with Railway fallback
  out = out.replace(
    /^const\s+\w+\s*=\s*(?:process\.env\.DATABASE_URL\s*\|\|\s*)?['"]postgresql:[^'"]*(?:crossover\.proxy\.rlwy\.net|PddzJpAQYezqknsntSzmCUlQYuYJldcT)[^'"]*['"]\s*;?\s*\n/gm,
    ''
  );

  out = out.replace(
    /^const\s+DB_URL\s*=\s*['"]postgresql:[^'"]*(?:crossover\.proxy\.rlwy\.net|PddzJpAQYezqknsntSzmCUlQYuYJldcT)[^'"]*['"]\s*;?\s*\n/gm,
    ''
  );

  // Inline new Pool({ connectionString }) one-liners left
  out = out.replace(
    /new\s+Pool\s*\(\s*\{[\s\S]*?(?:crossover\.proxy\.rlwy\.net|PddzJpAQYezqknsntSzmCUlQYuYJldcT)[\s\S]*?\}\s*\)/g,
    'db.pool'
  );

  // Remove unused pg imports when safe
  out = out.replace(/const\s*\{\s*Pool\s*(?:,\s*Client\s*)?\}\s*=\s*require\(['"]pg['"]\)\s*;\s*\n/g, '');
  out = out.replace(/const\s*\{\s*Client\s*(?:,\s*Pool\s*)?\}\s*=\s*require\(['"]pg['"]\)\s*;\s*\n/g, '');

  out = ensureDotenv(out);
  out = ensureDbImport(out, dbPath);

  if (!/\bconst\s+pool\s*=/.test(out) && /\bpool\.(query|connect|end)\b/.test(out)) {
    out = out.replace(
      /(const db = require\('[^']+'\);\s*\n)/,
      "$1const pool = db.pool;\n"
    );
  }

  // Common script pattern: client -> shared pool
  if (/\bclient\.query\b/.test(out) && !/\bconst\s+client\s*=/.test(out)) {
    out = out.replace(/\bclient\.query\b/g, 'pool.query');
  }
  out = out.replace(/^\s*await\s+client\.connect\(\)\s*;\s*\n/gm, '');
  out = out.replace(/^\s*await\s+client\.end\(\)\s*;\s*\n/gm, '');
  out = out.replace(/^\s*client\.release\(\)\s*;\s*\n/gm, '');

  // pool.end() on shared pool breaks other modules — only in standalone scripts
  if (!out.includes('module.exports')) {
    out = out.replace(/^\s*await\s+pool\.end\(\)\s*;\s*\n/gm, '');
  }

  if (hasRailway(out)) return null;
  return out;
}

const files = walk(ROOT);
let fixed = 0;
let failed = [];

for (const file of files) {
  if (SKIP_FILES.has(path.basename(file))) continue;
  const original = fs.readFileSync(file, 'utf8');
  if (!hasRailway(original)) continue;

  const updated = transform(original, dbRequirePath(file));
  if (!updated) {
    failed.push(path.relative(ROOT, file));
    continue;
  }

  if (updated !== original) {
    fs.writeFileSync(file, updated.replace(/\n/g, '\n'));
    fixed += 1;
    console.log('fixed', path.relative(ROOT, file));
  }
}

console.log(`\nDone. Fixed ${fixed} file(s).`);
if (failed.length) {
  console.log(`Still contain Railway markers (${failed.length}):`);
  failed.forEach((f) => console.log(' -', f));
  process.exitCode = 1;
}
