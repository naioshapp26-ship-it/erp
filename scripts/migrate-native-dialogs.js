#!/usr/bin/env node
'use strict';

const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const SKIP_DIRS = new Set(['node_modules', '.git', 'vendor', 'dist', 'coverage', 'uploads', 'archives']);
const report = [];

function walk(dir, out = []) {
  for (const name of fs.readdirSync(dir)) {
    if (SKIP_DIRS.has(name)) continue;
    const full = path.join(dir, name);
    let st;
    try { st = fs.statSync(full); } catch { continue; }
    if (st.isDirectory()) walk(full, out);
    else if (/\.(html|js)$/.test(name) && !name.endsWith('.min.js')) out.push(full);
  }
  return out;
}

function shouldTouch(rel) {
  if (rel === path.join('public', 'erp-dialogs.js')) return false;
  if (rel.includes(`${path.sep}test-`) || rel.startsWith('test')) return false;
  if (rel.endsWith('.sql')) return false;
  // first-party app surfaces
  return (
    rel.startsWith('finance' + path.sep) ||
    rel.startsWith('public' + path.sep) ||
    rel.endsWith('.html') ||
    ['script.js'].includes(path.basename(rel))
  );
}

function transform(source) {
  let out = source;
  const before = out;

  // Skip local API definitions named confirm/prompt/alert inside record-actions-like modules
  // by temporarily protecting "function confirm(" etc.
  const protectedBlocks = [];
  out = out.replace(/\bfunction\s+(confirm|prompt|alert)\s*\(/g, (m) => {
    const token = `__ERP_FN_${protectedBlocks.length}__`;
    protectedBlocks.push(m);
    return token;
  });
  out = out.replace(/\b(confirm|prompt|alert)\s*\(\s*message\s*\)\s*\{/g, (m) => {
    // method shorthand confirm(message) {
    const token = `__ERP_METHOD_${protectedBlocks.length}__`;
    protectedBlocks.push(m);
    return token;
  });

  out = out.replace(/\bwindow\.prompt\s*\(/g, 'await window.ErpDialog.prompt(');
  out = out.replace(/\bwindow\.confirm\s*\(/g, 'await window.ErpDialog.confirm(');
  out = out.replace(/\bwindow\.alert\s*\(/g, 'window.ErpDialog.toast(');

  out = out.replace(/(^|[^\.\w$])prompt\s*\(/gm, '$1await window.ErpDialog.prompt(');
  out = out.replace(/(^|[^\.\w$])confirm\s*\(/gm, '$1await window.ErpDialog.confirm(');
  out = out.replace(/(^|[^\.\w$])alert\s*\(/gm, '$1window.ErpDialog.toast(');

  out = out.replace(/await\s+await\s+/g, 'await ');

  protectedBlocks.forEach((original, i) => {
    out = out.replace(`__ERP_FN_${i}__`, original);
    out = out.replace(`__ERP_METHOD_${i}__`, original);
  });

  if (out === before) return null;

  // Make click/submit handlers async when they gained await
  out = out.replace(/(\.onclick\s*=\s*)(?!async\b)(\([^)]*\)\s*=>)/g, '$1async $2');
  out = out.replace(/(\.onclick\s*=\s*)(?!async\b)(function\s*\()/g, '$1async $2');
  out = out.replace(/addEventListener\(\s*(['"](?:click|submit)['"])\s*,\s*(?!async\b)(function\s*\()/g, 'addEventListener($1, async $2');
  out = out.replace(/addEventListener\(\s*(['"](?:click|submit)['"])\s*,\s*(?!async\b)(\([^)]*\)\s*=>)/g, 'addEventListener($1, async $2');

  // async function declarations that contain await ErpDialog
  out = out.replace(
    /(^|\n)([ \t]*)(?!async\b)function(\s+[A-Za-z_$][\w$]*\s*\([^)]*\)\s*\{)/gm,
    (match, nl, indent, rest, offset) => {
      const window = out.slice(offset, offset + match.length + 1800);
      if (!/await\s+window\.ErpDialog\.(confirm|prompt)/.test(window)) return match;
      return `${nl}${indent}async function${rest}`;
    }
  );

  return out;
}

const files = walk(ROOT).filter((f) => shouldTouch(path.relative(ROOT, f)));
for (const file of files) {
  const rel = path.relative(ROOT, file);
  const source = fs.readFileSync(file, 'utf8');
  if (!/\b(window\.)?(alert|confirm|prompt)\s*\(/.test(source)) continue;
  const next = transform(source);
  if (!next) continue;
  fs.writeFileSync(file, next);
  report.push(rel);
}

fs.mkdirSync('/opt/cursor/artifacts', { recursive: true });
fs.writeFileSync('/opt/cursor/artifacts/erp-dialogs-migration-list.txt', report.join('\n') + '\n');
console.log(`Migrated ${report.length} files`);
report.forEach((f) => console.log(' -', f));
