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

async function buildMalikaWorkbookAsync({ title, excludedTitle, items, excluded }) {
  const ExcelJS = require('exceljs');
  const wb = new ExcelJS.Workbook();
  wb.creator = 'NAIOSH ERP';
  wb.views = [{ rightToLeft: true }];

  const HEADER_FILL = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1F4E79' } };
  const TITLE_FILL = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFFFF00' } };
  const ZEBRA_FILL = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFDDEBF7' } };
  const TOTAL_FILL = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFCE4D6' } };
  const THIN = { style: 'thin', color: { argb: 'FF000000' } };
  const BORDER = { top: THIN, left: THIN, bottom: THIN, right: THIN };
  const moneyFmt = '#,##0.00';

  const exportItems = (items || []).map((it) => toMalikaExportRow(it));
  const ws = wb.addWorksheet('Payroll', { views: [{ rightToLeft: true, state: 'frozen', ySplit: 5 }] });
  ws.getColumn(1).width = 3;
  MALIKA_COLUMNS.forEach((c, i) => { ws.getColumn(i + 2).width = c.width; });

  ws.mergeCells(2, 2, 3, 14);
  const titleCell = ws.getCell(2, 2);
  titleCell.value = title || 'مسير الرواتب';
  titleCell.alignment = { horizontal: 'center', vertical: 'middle', wrapText: true };
  titleCell.font = { bold: true, size: 14, name: 'Arial' };
  titleCell.fill = TITLE_FILL;

  const headerRow = ws.getRow(5);
  MALIKA_COLUMNS.forEach((c, i) => {
    const cell = headerRow.getCell(i + 2);
    cell.value = c.header.trim();
    cell.fill = HEADER_FILL;
    cell.font = { bold: true, color: { argb: 'FFFFFFFF' }, size: 10, name: 'Arial' };
    cell.alignment = { horizontal: 'center', vertical: 'middle', wrapText: true };
    cell.border = BORDER;
  });
  headerRow.height = 28;

  const dataStart = 6;
  exportItems.forEach((it, idx) => {
    const row = ws.getRow(dataStart + idx);
    const zebra = idx % 2 === 1;
    MALIKA_COLUMNS.forEach((c, i) => {
      const cell = row.getCell(i + 2);
      let v = it[c.key];
      if (c.kind === 'money') {
        cell.value = v == null || v === '' ? null : round2(v);
        cell.numFmt = moneyFmt;
        cell.alignment = { horizontal: 'center' };
      } else if (c.key === 'employee_code') {
        cell.value = cellCode(v);
        cell.alignment = { horizontal: 'center' };
      } else {
        cell.value = v == null ? '' : String(v);
        cell.alignment = { horizontal: 'center', wrapText: true };
      }
      cell.border = BORDER;
      cell.font = { size: 10, name: 'Arial' };
      if (zebra) cell.fill = ZEBRA_FILL;
    });
  });

  const totalsRowIdx = dataStart + exportItems.length;
  const totalsRow = ws.getRow(totalsRowIdx);
  totalsRow.getCell(2).value = 'المجموع';
  MALIKA_COLUMNS.forEach((c, i) => {
    const cell = totalsRow.getCell(i + 2);
    cell.fill = TOTAL_FILL;
    cell.font = { bold: true, size: 10, name: 'Arial' };
    cell.border = BORDER;
    cell.alignment = { horizontal: 'center' };
    if (c.total) {
      const colLetter = ws.getColumn(i + 2).letter;
      const end = Math.max(dataStart, totalsRowIdx - 1);
      cell.value = { formula: `SUM(${colLetter}${dataStart}:${colLetter}${end})` };
      cell.numFmt = moneyFmt;
    } else if (i === 0) {
      cell.value = 'المجموع';
    } else {
      cell.value = null;
    }
  });

  if (exportItems.length) {
    ws.autoFilter = {
      from: { row: 5, column: 2 },
      to: { row: totalsRowIdx - 1, column: 14 }
    };
  }

  const eTitle = excludedTitle || String(title || '').replace('مسير الرواتب', 'الموظفين المستبعدين');
  const ews = wb.addWorksheet('Excluded', { views: [{ rightToLeft: true }] });
  ews.getColumn(1).width = 3;
  EXCLUDED_COLUMNS.forEach((c, i) => { ews.getColumn(i + 2).width = c.width; });
  ews.mergeCells(2, 2, 3, 5);
  const eTitleCell = ews.getCell(2, 2);
  eTitleCell.value = eTitle;
  eTitleCell.fill = TITLE_FILL;
  eTitleCell.font = { bold: true, size: 12 };
  eTitleCell.alignment = { horizontal: 'center', vertical: 'middle' };
  EXCLUDED_COLUMNS.forEach((c, i) => {
    const cell = ews.getRow(5).getCell(i + 2);
    cell.value = c.header;
    cell.fill = HEADER_FILL;
    cell.font = { bold: true, color: { argb: 'FFFFFFFF' } };
    cell.border = BORDER;
    cell.alignment = { horizontal: 'center' };
  });
  (excluded || []).forEach((ex, idx) => {
    const row = ews.getRow(6 + idx);
    [cellCode(ex.employee_code), ex.full_name_ar || '', ex.reason || '', ex.added_by || ''].forEach((v, i) => {
      const cell = row.getCell(i + 2);
      cell.value = v;
      cell.border = BORDER;
      if (idx % 2 === 1) cell.fill = ZEBRA_FILL;
    });
  });

  const buf = await wb.xlsx.writeBuffer();
  return Buffer.from(buf);
}

function buildMalikaWorkbook(opts) {
  return buildMalikaWorkbookAsync(opts);
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
  buildMalikaWorkbookAsync,
  buildLandscapePayrollPdf,
  cellCode,
  round2,
  n
};
