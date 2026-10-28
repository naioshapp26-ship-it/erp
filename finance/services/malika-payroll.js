'use strict';

/**
 * Malika institutional payroll sheet model (مليكة رواتب.xlsx).
 * Column order is contractual — do not reorder.
 */

const MALIKA_COLUMNS = [
  { key: 'employee_code', header: 'الرقم الوظيفي', kind: 'text', width: 13 },
  { key: 'full_name_ar', header: 'اسم الموظف', kind: 'text', width: 25 },
  { key: 'department', header: 'الادارة/القسم', kind: 'text', width: 18 },
  { key: 'nationality', header: 'الجنسية', kind: 'text', width: 19 },
  { key: 'base_salary', header: 'الراتب الأساسي', kind: 'money', width: 14, total: true },
  { key: 'housing_allowance', header: 'بدل سكن', kind: 'money', width: 11, total: true },
  { key: 'nature_allowance', header: 'بدل طبيعة عمل ', kind: 'money', width: 15, total: true },
  { key: 'transport_allowance', header: 'بدل مواصلات', kind: 'money', width: 14, total: true },
  { key: 'other_allowances', header: 'بدلات اخرى', kind: 'money', width: 12, total: true },
  { key: 'gross_amount', header: 'إجمالي الراتب', kind: 'money', width: 13, total: true },
  { key: 'insurance_amount', header: 'التأمينات الاجتماعية', kind: 'money', width: 18, total: true },
  { key: 'advance_deduction', header: 'استقطاع سلفة', kind: 'money', width: 14, total: true },
  { key: 'net_amount', header: 'صافي المبلغ', kind: 'money', width: 12, total: true }
];

const EXCLUDED_COLUMNS = [
  { key: 'employee_code', header: 'الرقم الوظيفي', width: 13 },
  { key: 'full_name_ar', header: 'اسم الموظف', width: 16 },
  { key: 'reason', header: 'سبب الاستبعاد', width: 31 },
  { key: 'added_by', header: 'اضيف بواسطة', width: 14 }
];

const COUNTRY_PRESETS = {
  SA: {
    label_ar: 'السعودية',
    currency: 'SAR',
    insurance_pct: 9.75,
    insurance_base: 'base_salary',
    insurance_sign: 'negative',
    tax_pct: 0,
    bank_file_format: 'SA_WPS',
    bank_file_note: 'ملف WPS/مدد قابل للضبط — لا يُفترض الامتثال تلقائيًا من نموذج Excel.'
  },
  JO: {
    label_ar: 'الأردن',
    currency: 'JOD',
    insurance_pct: 7.5,
    insurance_base: 'base_salary',
    insurance_sign: 'negative',
    tax_pct: 0,
    bank_file_format: 'JO_BANK',
    bank_file_note: 'ملف بنكي أردني قابل للضبط حسب البنك — لا يُفترض الامتثال من النموذج وحده.'
  },
  CUSTOM: {
    label_ar: 'مخصص',
    currency: 'SAR',
    insurance_pct: 0,
    insurance_base: 'base_salary',
    insurance_sign: 'negative',
    tax_pct: 0,
    bank_file_format: 'NONE',
    bank_file_note: 'بدون ملف بنكي افتراضي.'
  }
};

function n(v) {
  const x = Number(v);
  return Number.isFinite(x) ? x : 0;
}

function round2(v) {
  return Math.round(n(v) * 100) / 100;
}

/** إجمالي الراتب = أساسي + سكن + طبيعة + مواصلات + أخرى (+ إضافي مطوي في الأخرى عند الربط) */
function calcGross(row) {
  return round2(
    n(row.base_salary) +
      n(row.housing_allowance) +
      n(row.nature_allowance) +
      n(row.transport_allowance) +
      n(row.other_allowances)
  );
}

/**
 * Normalize a deduction input to signed negative (Excel-style).
 * Positive UI entry "500" → -500. Already-negative stays negative.
 */
function asSignedDeduction(v) {
  const x = n(v);
  if (x === 0) return 0;
  return x > 0 ? round2(-x) : round2(x);
}

/**
 * صافي المبلغ = إجمالي + التأمينات + السلفة + استقطاعات أخرى بإشاراتها (سالب للاستقطاع).
 * لا تُحسب الاستقطاعات مرتين: نجمع الإشارة فقط ولا نطرح المطلق مرة ثانية.
 */
function calcNet(row) {
  const gross = row.gross_amount != null ? n(row.gross_amount) : calcGross(row);
  return round2(
    gross + n(row.insurance_amount) + n(row.advance_deduction) + n(row.other_deductions)
  );
}

function calcDeductionsPositive(row) {
  const ins = n(row.insurance_amount);
  const adv = n(row.advance_deduction);
  const other = n(row.other_deductions);
  return round2(Math.max(0, -ins) + Math.max(0, -adv) + Math.max(0, -other));
}

/** For Malika 13-col export: fold ERP-only other_deductions into استقطاع سلفة. */
function toMalikaExportRow(row) {
  const advanceExport = round2(n(row.advance_deduction) + n(row.other_deductions));
  const mapped = {
    ...row,
    advance_deduction: advanceExport,
    other_deductions: 0
  };
  mapped.gross_amount = row.gross_amount != null ? n(row.gross_amount) : calcGross(mapped);
  mapped.net_amount = round2(mapped.gross_amount + n(mapped.insurance_amount) + advanceExport);
  mapped.deductions_amount = calcDeductionsPositive({
    insurance_amount: mapped.insurance_amount,
    advance_deduction: advanceExport,
    other_deductions: 0
  });
  return mapped;
}

function recomputeRow(input, opts = {}) {
  const row = { ...input };
  const ot = n(opts.overtime_amount || row.overtime_amount || 0);
  const foldOt = opts.ot_fold_into !== 'detail_only';
  if (foldOt && ot) {
    row.other_allowances = round2(n(row.other_allowances) + ot);
  }
  row.overtime_amount = ot;
  row.gross_amount = calcGross(row);
  if (opts.applyInsurancePct != null && opts.applyInsurancePct > 0 && (row.insurance_amount == null || opts.forceInsurance)) {
    const baseKey = opts.insurance_base || 'base_salary';
    const base = n(row[baseKey] != null ? row[baseKey] : row.base_salary);
    const raw = round2((base * n(opts.applyInsurancePct)) / 100);
    const sign = String(opts.insurance_sign || 'negative').toLowerCase() === 'positive' ? 1 : -1;
    row.insurance_amount = round2(sign * raw);
  }
  // Keep signed values as stored; optionally coerce positive UI inputs to negative
  if (opts.forceSignDeductions) {
    if (n(row.insurance_amount) > 0) row.insurance_amount = asSignedDeduction(row.insurance_amount);
    else row.insurance_amount = round2(row.insurance_amount);
    if (n(row.advance_deduction) > 0) row.advance_deduction = asSignedDeduction(row.advance_deduction);
    else row.advance_deduction = round2(row.advance_deduction);
    if (n(row.other_deductions) > 0) row.other_deductions = asSignedDeduction(row.other_deductions);
    else row.other_deductions = round2(row.other_deductions);
  } else {
    row.insurance_amount = round2(row.insurance_amount);
    row.advance_deduction = round2(row.advance_deduction);
    row.other_deductions = round2(row.other_deductions);
  }
  if (opts.legacy_advances != null && row.advance_deduction === 0 && n(opts.legacy_advances) > 0) {
    row.advance_deduction = round2(-Math.abs(n(opts.legacy_advances)));
  }
  row.net_amount = calcNet(row);
  row.deductions_amount = calcDeductionsPositive(row);
  row.allowances = round2(
    n(row.housing_allowance) + n(row.nature_allowance) + n(row.transport_allowance) + n(row.other_allowances)
  );
  row.advances = round2(Math.abs(Math.min(0, n(row.advance_deduction))));
  return row;
}

function formatRunTitle(settings, run) {
  const tpl = settings.payroll_title_template || 'مسير الرواتب لـ {date} - {run_type}';
  const d = run.run_date || run.payroll_date || new Date();
  const dateStr = formatDdMmYyyy(d);
  const runType = run.run_type_label || settings.run_type_label || 'المسير العام';
  return String(tpl)
    .replace(/\{date\}/g, dateStr)
    .replace(/\{run_type\}/g, runType)
    .replace(/\{year\}/g, String(run.period_year || ''))
    .replace(/\{month\}/g, String(run.period_month || '').padStart(2, '0'));
}

function formatExcludedTitle(settings, run) {
  const tpl = settings.excluded_title_template || 'الموظفين المستبعدين لـ {date} - {run_type}';
  return formatRunTitle({ ...settings, payroll_title_template: tpl }, run);
}

function formatDdMmYyyy(d) {
  const dt = d instanceof Date ? d : new Date(d);
  if (Number.isNaN(dt.getTime())) return String(d || '');
  const dd = String(dt.getUTCDate()).padStart(2, '0');
  const mm = String(dt.getUTCMonth() + 1).padStart(2, '0');
  const yyyy = dt.getUTCFullYear();
  return `${dd}-${mm}-${yyyy}`;
}

function cellCode(code) {
  // Preserve leading zeros as text
  if (code == null) return '';
  return String(code);
}

function parseMalikaWorkbook(buffer) {
  const XLSX = require('xlsx');
  const wb = XLSX.read(buffer, { type: Buffer.isBuffer(buffer) ? 'buffer' : 'base64', cellDates: true, raw: false });
  const payrollName = wb.SheetNames.find((n) => /payroll|رواتب|مسير/i.test(n)) || wb.SheetNames[0];
  const excludedName = wb.SheetNames.find((n) => /excluded|مستبعد/i.test(n));
  const payrollSheet = wb.Sheets[payrollName];
  const rows = [];
  let title = '';
  let headerRow = -1;

  const range = XLSX.utils.decode_range(payrollSheet['!ref'] || 'A1');
  for (let R = range.s.r; R <= range.e.r; R++) {
    const vals = [];
    for (let C = range.s.c; C <= range.e.c; C++) {
      const addr = XLSX.utils.encode_cell({ r: R, c: C });
      const cell = payrollSheet[addr];
      vals.push(cell ? (cell.w != null ? cell.w : cell.v) : '');
    }
    const joined = vals.map((v) => String(v || '').trim()).filter(Boolean);
    if (!title && joined.length && /مسير|رواتب/.test(joined[0])) {
      title = joined[0];
      continue;
    }
    if (joined.some((h) => h === 'الرقم الوظيفي' || h === 'اسم الموظف')) {
      headerRow = R;
      continue;
    }
    if (headerRow < 0) continue;
    const codeIdx = vals.findIndex((v) => String(v).trim() === 'الرقم الوظيفي');
    // After header found, map by absolute Malika order starting at first non-empty col
    const startC = vals.findIndex((v) => String(v || '').trim() !== '');
    if (headerRow === R) continue;
  }

  // Stable parse: find header cells by Arabic labels
  const headerMap = {};
  for (let R = range.s.r; R <= range.e.r; R++) {
    for (let C = range.s.c; C <= range.e.c; C++) {
      const addr = XLSX.utils.encode_cell({ r: R, c: C });
      const cell = payrollSheet[addr];
      const v = cell ? String(cell.v == null ? '' : cell.v).trim() : '';
      const col = MALIKA_COLUMNS.find((c) => c.header.trim() === v || c.header === v);
      if (col) {
        headerMap[col.key] = { r: R, c: C };
        headerRow = R;
      }
    }
    if (Object.keys(headerMap).length >= 10) break;
  }
  if (!Object.keys(headerMap).length) {
    throw new Error('تعذر قراءة صف عناوين كشف الرواتب');
  }
  const dataStart = headerRow + 1;
  for (let R = dataStart; R <= range.e.r; R++) {
    const get = (key) => {
      const loc = headerMap[key];
      if (!loc) return null;
      const addr = XLSX.utils.encode_cell({ r: R, c: loc.c });
      const cell = payrollSheet[addr];
      if (!cell) return null;
      if (cell.t === 's' || typeof cell.v === 'string') return cell.v;
      return cell.v;
    };
    const codeRaw = get('employee_code');
    const name = get('full_name_ar');
    const codeStr = codeRaw == null || codeRaw === '' ? '' : String(codeRaw).trim();
    if (!codeStr && !name) continue;
    if (String(codeStr) === 'المجموع' || String(name || '').includes('المجموع')) continue;
    const money = (key) => {
      const v = get(key);
      if (v == null || v === '') return 0;
      const num = Number(String(v).replace(/,/g, ''));
      return Number.isFinite(num) ? num : 0;
    };
    const base = {
      employee_code: cellCode(codeStr),
      full_name_ar: name == null ? '' : String(name).trim(),
      department: get('department') == null ? '' : String(get('department')).trim(),
      nationality: get('nationality') == null ? '' : String(get('nationality')).trim(),
      base_salary: money('base_salary'),
      housing_allowance: money('housing_allowance'),
      nature_allowance: money('nature_allowance'),
      transport_allowance: money('transport_allowance'),
      other_allowances: money('other_allowances'),
      insurance_amount: money('insurance_amount'),
      advance_deduction: money('advance_deduction')
    };
    // Prefer sheet gross/net when present; still recompute for consistency check
    const sheetGross = money('gross_amount');
    const sheetNet = money('net_amount');
    const computed = recomputeRow(base, { ot_fold_into: 'detail_only' });
    if (sheetGross) computed.gross_amount = sheetGross;
    if (sheetNet) computed.net_amount = sheetNet;
    // Re-derive net from signed formula when sheet net missing
    if (!sheetNet) computed.net_amount = calcNet(computed);
    if (!sheetGross) computed.gross_amount = calcGross(computed);
    computed.deductions_amount = calcDeductionsPositive(computed);
    rows.push(computed);
  }

  const excluded = [];
  if (excludedName) {
    const es = wb.Sheets[excludedName];
    const er = XLSX.utils.decode_range(es['!ref'] || 'A1');
    let eHeader = -1;
    const eMap = {};
    for (let R = er.s.r; R <= er.e.r; R++) {
      for (let C = er.s.c; C <= er.e.c; C++) {
        const addr = XLSX.utils.encode_cell({ r: R, c: C });
        const cell = es[addr];
        const v = cell ? String(cell.v == null ? '' : cell.v).trim() : '';
        if (v === 'الرقم الوظيفي') eMap.code = C;
        if (v === 'اسم الموظف') eMap.name = C;
        if (v === 'سبب الاستبعاد') eMap.reason = C;
        if (v === 'اضيف بواسطة' || v === 'أُضيف بواسطة' || v === 'اضيف بواسطه') eMap.by = C;
        if (Object.keys(eMap).length >= 3) eHeader = R;
      }
      if (eHeader >= 0) break;
    }
    if (eHeader >= 0) {
      for (let R = eHeader + 1; R <= er.e.r; R++) {
        const g = (c) => {
          if (c == null) return '';
          const cell = es[XLSX.utils.encode_cell({ r: R, c })];
          return cell == null || cell.v == null ? '' : String(cell.v).trim();
        };
        const code = g(eMap.code);
        const name = g(eMap.name);
        if (!code && !name) continue;
        excluded.push({
          employee_code: cellCode(code),
          full_name_ar: name,
          reason: g(eMap.reason),
          added_by: g(eMap.by) || null
        });
      }
    }
  }

  return { title, payrollRows: rows, excludedRows: excluded, sheetNames: wb.SheetNames };
}

function buildMalikaWorkbook({ title, excludedTitle, items, excluded, settings }) {
  const XLSX = require('xlsx');
  const wb = XLSX.utils.book_new();

  // Payroll sheet — mirror Excel layout starting at B2 (row1 empty)
  const aoa = [];
  const titleRow = [null, title];
  for (let i = 0; i < 12; i++) titleRow.push(title);
  aoa.push([]); // Excel R1 empty
  aoa.push(titleRow); // R2
  aoa.push(titleRow.slice()); // R3
  aoa.push([]); // R4 blank
  aoa.push([null, ...MALIKA_COLUMNS.map((c) => c.header)]); // R5 headers

  const dataStartExcelRow = 6; // first data row
  items.forEach((it) => {
    aoa.push([
      null,
      cellCode(it.employee_code),
      it.full_name_ar || '',
      it.department || '',
      it.nationality || '',
      n(it.base_salary) || null,
      n(it.housing_allowance) || null,
      n(it.nature_allowance) || null,
      n(it.transport_allowance) || null,
      n(it.other_allowances) || null,
      n(it.gross_amount) || null,
      n(it.insurance_amount) || null,
      n(it.advance_deduction) || null,
      n(it.net_amount) || null
    ]);
  });

  // Client file: SUM(F5:F33) spans header through last data row (not totals)
  const sumStart = 5;
  const sumEnd = items.length ? dataStartExcelRow + items.length - 1 : sumStart;
  aoa.push([null, 'المجموع', null, null, null, null, null, null, null, null, null, null, null, null]);

  const ws = XLSX.utils.aoa_to_sheet(aoa, { cellDates: false });
  // 0-based: R1 empty=0 … header=4, data=5.., totals=5+items.length
  const totalsR = 4 + items.length + 1;
  const moneyCols = [
    { c: 5, letter: 'F' },
    { c: 6, letter: 'G' },
    { c: 7, letter: 'H' },
    { c: 8, letter: 'I' },
    { c: 9, letter: 'J' },
    { c: 10, letter: 'K' },
    { c: 11, letter: 'L' },
    { c: 12, letter: 'M' },
    { c: 13, letter: 'N' }
  ];
  moneyCols.forEach(({ c, letter }) => {
    const addr = XLSX.utils.encode_cell({ r: totalsR, c });
    const key = MALIKA_COLUMNS[c - 1].key;
    const sum = items.reduce((s, it) => s + n(it[key]), 0);
    ws[addr] = { t: 'n', f: `SUM(${letter}${sumStart}:${letter}${sumEnd})`, v: round2(sum), w: String(round2(sum)) };
  });
  ws['!ref'] = XLSX.utils.encode_range({ s: { r: 0, c: 0 }, e: { r: totalsR, c: 13 } });
  ws['!merges'] = [{ s: { c: 1, r: 1 }, e: { c: 13, r: 2 } }];
  ws['!cols'] = [{ wch: 3 }, ...MALIKA_COLUMNS.map((c) => ({ wch: c.width }))];
  ws['!dir'] = 'rtl';
  XLSX.utils.book_append_sheet(wb, ws, 'Payroll');

  const eTitle = excludedTitle || title.replace('مسير الرواتب', 'الموظفين المستبعدين');
  const eAoa = [];
  const eTitleRow = [null, eTitle, eTitle, eTitle, eTitle];
  eAoa.push([]);
  eAoa.push(eTitleRow);
  eAoa.push(eTitleRow.slice());
  eAoa.push([]);
  eAoa.push([null, ...EXCLUDED_COLUMNS.map((c) => c.header)]);
  (excluded || []).forEach((ex) => {
    eAoa.push([
      null,
      cellCode(ex.employee_code),
      ex.full_name_ar || '',
      ex.reason || '',
      ex.added_by || ''
    ]);
  });
  const ews = XLSX.utils.aoa_to_sheet(eAoa);
  ews['!merges'] = [{ s: { c: 1, r: 1 }, e: { c: 4, r: 2 } }];
  ews['!cols'] = [{ wch: 3 }, ...EXCLUDED_COLUMNS.map((c) => ({ wch: c.width }))];
  ews['!dir'] = 'rtl';
  XLSX.utils.book_append_sheet(wb, ews, 'Excluded');

  const buf = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx', cellStyles: true });
  return buf;
}

function buildLandscapePayrollPdf({ title, items, excluded, footer }) {
  // Wide landscape A4-ish page; Helvetica can't render Arabic well — emit UTF-16BE hex strings via Identity
  // Fallback: use simple Latin transliteration labels + numeric columns for machine-readable PDF,
  // plus Arabic in UTF-16 for viewers that support it via /F1 Helvetica won't work for Arabic.
  // Emit a wide table with column headers as Unicode escaped in content stream using hex strings.
  const pageW = 1400;
  const pageH = 842;
  const margin = 24;
  const headers = MALIKA_COLUMNS.map((c) => c.header.trim());
  const colW = [70, 160, 110, 100, 70, 55, 70, 65, 60, 70, 85, 70, 70];
  const lines = [];
  const esc = (s) => {
    // PDF literal string escape for ASCII; for Arabic use UTF-16BE hex
    const str = String(s == null ? '' : s);
    const hasNonAscii = /[^\x00-\x7F]/.test(str);
    if (!hasNonAscii) return `(${str.replace(/\\/g, '\\\\').replace(/\(/g, '\\(').replace(/\)/g, '\\)')})`;
    let hex = 'FEFF';
    for (let i = 0; i < str.length; i++) {
      hex += str.charCodeAt(i).toString(16).toUpperCase().padStart(4, '0');
    }
    return `<${hex}>`;
  };

  let y = pageH - margin - 20;
  lines.push('BT', '/F1 12 Tf', `${margin} ${y} Td`, `${esc(title)} Tj`, 'ET');
  y -= 28;
  // header
  let x = margin;
  lines.push('BT', '/F1 7 Tf');
  headers.forEach((h, i) => {
    lines.push(`1 0 0 1 ${x} ${y} Tm`, `${esc(h)} Tj`);
    x += colW[i];
  });
  lines.push('ET');
  y -= 14;
  items.forEach((it) => {
    if (y < 60) return;
    const vals = MALIKA_COLUMNS.map((c) => {
      const v = it[c.key];
      if (c.kind === 'money') return v == null || v === '' ? '' : String(round2(v));
      return v == null ? '' : String(v);
    });
    x = margin;
    lines.push('BT', '/F1 7 Tf');
    vals.forEach((v, i) => {
      lines.push(`1 0 0 1 ${x} ${y} Tm`, `${esc(v)} Tj`);
      x += colW[i];
    });
    lines.push('ET');
    y -= 12;
  });
  // totals
  y -= 8;
  const totals = MALIKA_COLUMNS.map((c) => {
    if (!c.total) return c.key === 'employee_code' ? 'المجموع' : '';
    return String(round2(items.reduce((s, it) => s + n(it[c.key]), 0)));
  });
  x = margin;
  lines.push('BT', '/F1 8 Tf');
  totals.forEach((v, i) => {
    lines.push(`1 0 0 1 ${x} ${y} Tm`, `${esc(v)} Tj`);
    x += colW[i];
  });
  lines.push('ET');
  if (footer) {
    y -= 24;
    lines.push('BT', '/F1 8 Tf', `${margin} ${y} Td`, `${esc(footer)} Tj`, 'ET');
  }
  if (excluded && excluded.length) {
    y -= 30;
    lines.push('BT', '/F1 10 Tf', `${margin} ${y} Td`, `${esc('الموظفون المستبعدون')} Tj`, 'ET');
    y -= 14;
    excluded.forEach((ex) => {
      if (y < 40) return;
      const row = `${ex.employee_code || ''} | ${ex.full_name_ar || ''} | ${ex.reason || ''} | ${ex.added_by || ''}`;
      lines.push('BT', '/F1 7 Tf', `${margin} ${y} Td`, `${esc(row)} Tj`, 'ET');
      y -= 12;
    });
  }

  const stream = lines.join('\n');
  const objs = [];
  objs.push('1 0 obj<< /Type /Catalog /Pages 2 0 R >>endobj\n');
  objs.push('2 0 obj<< /Type /Pages /Kids [3 0 R] /Count 1 >>endobj\n');
  objs.push(
    `3 0 obj<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${pageW} ${pageH}] /Contents 4 0 R /Resources<< /Font<< /F1 5 0 R >> >> >>endobj\n`
  );
  objs.push(`4 0 obj<< /Length ${Buffer.byteLength(stream, 'utf8')} >>stream\n${stream}\nendstream\nendobj\n`);
  // Use a font that accepts Unicode hex strings poorly; still emit for layout width proof
  objs.push('5 0 obj<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>endobj\n');
  let pdf = '%PDF-1.4\n';
  const offsets = [0];
  objs.forEach((o) => {
    offsets.push(Buffer.byteLength(pdf, 'utf8'));
    pdf += o;
  });
  const xref = Buffer.byteLength(pdf, 'utf8');
  pdf += `xref\n0 ${objs.length + 1}\n`;
  pdf += '0000000000 65535 f \n';
  for (let i = 1; i < offsets.length; i++) {
    pdf += `${String(offsets[i]).padStart(10, '0')} 00000 n \n`;
  }
  pdf += `trailer<< /Size ${objs.length + 1} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF`;
  return Buffer.from(pdf, 'utf8');
}

function countryPreset(code) {
  const key = String(code || 'CUSTOM').toUpperCase();
  return COUNTRY_PRESETS[key] || COUNTRY_PRESETS.CUSTOM;
}

module.exports = {
  MALIKA_COLUMNS,
  EXCLUDED_COLUMNS,
  COUNTRY_PRESETS,
  countryPreset,
  calcGross,
  calcNet,
  calcDeductionsPositive,
  recomputeRow,
  toMalikaExportRow,
  asSignedDeduction,
  formatRunTitle,
  formatExcludedTitle,
  formatDdMmYyyy,
  parseMalikaWorkbook,
  buildMalikaWorkbook,
  buildLandscapePayrollPdf,
  cellCode,
  round2,
  n
};
