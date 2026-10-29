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
  const moneyFmt = '# ##0.00';

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
  const blankZeroKeys = new Set(['nature_allowance', 'other_allowances', 'insurance_amount', 'advance_deduction']);
  exportItems.forEach((it, idx) => {
    const row = ws.getRow(dataStart + idx);
    const zebra = idx % 2 === 1;
    MALIKA_COLUMNS.forEach((c, i) => {
      const cell = row.getCell(i + 2);
      let v = it[c.key];
      if (c.kind === 'money') {
        const num = v == null || v === '' ? null : round2(v);
        cell.value = (num === 0 && blankZeroKeys.has(c.key)) ? null : num;
        cell.numFmt = moneyFmt;
        cell.alignment = { horizontal: 'center' };
        if (c.key === 'gross_amount' || c.key === 'net_amount') {
          cell.fill = zebra
            ? { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFBDD7EE' } }
            : { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFDEEBF7' } };
        }
      } else if (c.key === 'employee_code') {
        cell.value = cellCode(v);
        cell.alignment = { horizontal: 'center' };
      } else {
        cell.value = v == null ? '' : String(v);
        cell.alignment = { horizontal: 'center', wrapText: true };
      }
      cell.border = BORDER;
      cell.font = { size: 10, name: 'Arial' };
      if (zebra && !(c.key === 'gross_amount' || c.key === 'net_amount')) cell.fill = ZEBRA_FILL;
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

/** Client Excel-style money: 6 500,00 with optional blank zeros */
function formatMoneyEu(v, { blankZero = false } = {}) {
  if (v == null || v === '') return '';
  const x = round2(v);
  if (blankZero && x === 0) return '';
  const neg = x < 0;
  const abs = Math.abs(x);
  const [intPart, dec] = abs.toFixed(2).split('.');
  const grouped = intPart.replace(/\B(?=(\d{3})+(?!\d))/g, ' ');
  return `${neg ? '-' : ''}${grouped},${dec}`;
}

function escapeHtml(s) {
  return String(s == null ? '' : s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function buildPayrollSheetHtml({ title, items, excluded, footer }) {
  const exportItems = (items || []).map((it) => toMalikaExportRow(it));
  const blankKeys = new Set(['nature_allowance', 'other_allowances', 'insurance_amount', 'advance_deduction']);
  const moneyCell = (key, v) => {
    const txt = formatMoneyEu(v, { blankZero: blankKeys.has(key) });
    const neg = n(v) < 0;
    const hi = key === 'gross_amount' || key === 'net_amount';
    return `<td class="num${neg ? ' neg' : ''}${hi ? ' hi' : ''}">${escapeHtml(txt)}</td>`;
  };
  const sum = (key) => round2(exportItems.reduce((s, it) => s + n(it[key]), 0));
  const rowsHtml = exportItems.map((it, idx) => {
    const zebra = idx % 2 === 1 ? ' class="zebra"' : '';
    return `<tr${zebra}>
      <td class="code">${escapeHtml(cellCode(it.employee_code))}</td>
      <td class="name">${escapeHtml(it.full_name_ar || '')}</td>
      <td>${escapeHtml(it.department || '')}</td>
      <td>${escapeHtml(it.nationality || '')}</td>
      ${moneyCell('base_salary', it.base_salary)}
      ${moneyCell('housing_allowance', it.housing_allowance)}
      ${moneyCell('nature_allowance', it.nature_allowance)}
      ${moneyCell('transport_allowance', it.transport_allowance)}
      ${moneyCell('other_allowances', it.other_allowances)}
      ${moneyCell('gross_amount', it.gross_amount)}
      ${moneyCell('insurance_amount', it.insurance_amount)}
      ${moneyCell('advance_deduction', it.advance_deduction)}
      ${moneyCell('net_amount', it.net_amount)}
    </tr>`;
  }).join('');
  const totalsHtml = `<tr class="totals">
    <td>المجموع</td><td></td><td></td><td></td>
    ${moneyCell('base_salary', sum('base_salary'))}
    ${moneyCell('housing_allowance', sum('housing_allowance'))}
    ${moneyCell('nature_allowance', sum('nature_allowance'))}
    ${moneyCell('transport_allowance', sum('transport_allowance'))}
    ${moneyCell('other_allowances', sum('other_allowances'))}
    ${moneyCell('gross_amount', sum('gross_amount'))}
    ${moneyCell('insurance_amount', sum('insurance_amount'))}
    ${moneyCell('advance_deduction', sum('advance_deduction'))}
    ${moneyCell('net_amount', sum('net_amount'))}
  </tr>`;
  const excl = (excluded || []).map((ex) =>
    `<tr><td class="code">${escapeHtml(cellCode(ex.employee_code))}</td>
     <td>${escapeHtml(ex.full_name_ar || '')}</td>
     <td>${escapeHtml(ex.reason || '')}</td>
     <td>${escapeHtml(ex.added_by || '')}</td></tr>`
  ).join('');
  return `<!DOCTYPE html><html lang="ar" dir="rtl"><head><meta charset="UTF-8">
<title>${escapeHtml(title || 'مسير الرواتب')}</title>
<style>
  @font-face{font-family:'NotoNaskh';src:url('file:///usr/share/fonts/truetype/noto/NotoNaskhArabic-Regular.ttf');font-weight:400}
  @font-face{font-family:'NotoNaskh';src:url('file:///usr/share/fonts/truetype/noto/NotoNaskhArabic-Bold.ttf');font-weight:700}
  *{box-sizing:border-box}
  body{margin:12px;font-family:'NotoNaskh','Noto Naskh Arabic',Tahoma,sans-serif;direction:rtl;color:#111}
  .sheet{border:1px solid #1f2937;width:100%}
  .title{background:#FFFF00;text-align:center;font-weight:700;font-size:16px;padding:10px;border-bottom:1px solid #1f2937}
  table{width:100%;border-collapse:collapse;font-size:10px}
  th,td{border:1px solid #334155;padding:5px 6px;text-align:center;vertical-align:middle}
  thead th{background:#1F4E79;color:#fff;font-weight:700}
  tr.zebra td{background:#DDEBF7}
  tr.totals td{background:#FCE4D6;font-weight:700}
  td.num{font-variant-numeric:tabular-nums;direction:ltr;unicode-bidi:bidi-override}
  td.neg{color:#b91c1c;font-weight:700}
  td.hi{background:#DEEBF7}
  tr.totals td.hi{background:#F8CBAD}
  td.code{font-family:ui-monospace,Consolas,monospace;font-weight:700}
  td.name{text-align:right;white-space:nowrap}
  h2{font-size:13px;margin:18px 0 6px}
  .footer{margin-top:10px;font-size:10px;color:#475569}
</style></head><body>
  <div class="sheet">
    <div class="title">${escapeHtml(title || 'مسير الرواتب')}</div>
    <table>
      <thead><tr>${MALIKA_COLUMNS.map((c) => `<th>${escapeHtml(c.header.trim())}</th>`).join('')}</tr></thead>
      <tbody>${rowsHtml}</tbody>
      <tfoot>${totalsHtml}</tfoot>
    </table>
  </div>
  ${(excluded || []).length ? `<h2>الموظفون المستبعدون</h2>
  <table><thead><tr>${EXCLUDED_COLUMNS.map((c) => `<th>${escapeHtml(c.header)}</th>`).join('')}</tr></thead>
  <tbody>${excl || '<tr><td colspan="4">لا مستبعدين</td></tr>'}</tbody></table>` : ''}
  ${footer ? `<div class="footer">${escapeHtml(footer)}</div>` : ''}
</body></html>`;
}

async function buildLandscapePayrollPdfAsync({ title, items, excluded, footer }) {
  const puppeteer = require('puppeteer-core');
  const chrome = process.env.CHROME_PATH || '/usr/local/bin/google-chrome';
  const html = buildPayrollSheetHtml({ title, items, excluded, footer });
  const browser = await puppeteer.launch({
    executablePath: chrome,
    headless: 'new',
    args: ['--no-sandbox', '--disable-gpu', '--font-render-hinting=none']
  });
  try {
    const page = await browser.newPage();
    await page.setContent(html, { waitUntil: 'networkidle0' });
    const pdf = await page.pdf({
      landscape: true,
      format: 'A4',
      printBackground: true,
      margin: { top: '8mm', bottom: '8mm', left: '6mm', right: '6mm' },
      preferCSSPageSize: false
    });
    return Buffer.from(pdf);
  } finally {
    await browser.close();
  }
}

function buildLandscapePayrollPdf(opts) {
  return buildLandscapePayrollPdfAsync(opts);
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
  buildLandscapePayrollPdfAsync,
  buildPayrollSheetHtml,
  formatMoneyEu,
  cellCode,
  round2,
  n
};
