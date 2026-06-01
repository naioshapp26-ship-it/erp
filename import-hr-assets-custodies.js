require('dotenv').config();
const db = require('./db');

const path = require('path');
const XLSX = require('xlsx');
const entityId = process.env.ENTITY_ID || 'HQ001';
const filePath = process.env.ASSET_EXCEL_PATH || path.join(__dirname, 'ادارة الاصول.xlsx');

const pool = db.pool;
const normalize = (value) => {
  if (value === null || value === undefined) return '';
  return String(value).trim();
};

const toInt = (value) => {
  if (value === null || value === undefined || value === '') return null;
  const num = Number.parseInt(value, 10);
  return Number.isNaN(num) ? null : num;
};

const toDate = (value) => {
  if (!value) return null;
  if (value instanceof Date) return value.toISOString().slice(0, 10);
  const text = String(value).trim();
  return text || null;
};

const loadSheetRows = (workbook, name) => {
  const sheet = workbook.Sheets[name];
  if (!sheet) return [];
  return XLSX.utils.sheet_to_json(sheet, { header: 1, defval: '' });
};

const findRowIndex = (rows, needle) => {
  return rows.findIndex((row) => row.some((cell) => normalize(cell) === needle));
};

const filterDataRows = (rows, startIndex) => {
  if (startIndex < 0) return [];
  return rows.slice(startIndex).filter((row) => row.some((cell) => normalize(cell) !== ''));
};

const upsertCodingSystem = async (items) => {
  const sql = `
    INSERT INTO hr_asset_coding_system
      (code_prefix, name_en, name_ar, category_ar, category_en, example_code, entity_id, updated_at)
    VALUES
      ($1,$2,$3,$4,$5,$6,$7,NOW())
    ON CONFLICT (code_prefix)
    DO UPDATE SET
      name_en = EXCLUDED.name_en,
      name_ar = EXCLUDED.name_ar,
      category_ar = EXCLUDED.category_ar,
      category_en = EXCLUDED.category_en,
      example_code = EXCLUDED.example_code,
      entity_id = EXCLUDED.entity_id,
      updated_at = NOW()
  `;

  for (const item of items) {
    await pool.query(sql, [
      item.code_prefix,
      item.name_en,
      item.name_ar,
      item.category_ar,
      item.category_en,
      item.example_code,
      entityId
    ]);
  }
};

const upsertRegistry = async (items) => {
  const sql = `
    INSERT INTO hr_asset_registry
      (serial_number, asset_name, description, location, status, notes, entity_id, updated_at)
    VALUES
      ($1,$2,$3,$4,$5,$6,$7,NOW())
    ON CONFLICT (serial_number)
    DO UPDATE SET
      asset_name = EXCLUDED.asset_name,
      description = EXCLUDED.description,
      location = EXCLUDED.location,
      status = EXCLUDED.status,
      notes = EXCLUDED.notes,
      entity_id = EXCLUDED.entity_id,
      updated_at = NOW()
  `;

  for (const item of items) {
    await pool.query(sql, [
      item.serial_number,
      item.asset_name,
      item.description,
      item.location,
      item.status,
      item.notes,
      entityId
    ]);
  }
};

const upsertClassifications = async (items) => {
  const sql = `
    INSERT INTO hr_asset_classifications
      (serial_number, item_name_ar, item_name_en, location, status, notes, asset_type_ar, asset_type_en, entity_id, updated_at)
    VALUES
      ($1,$2,$3,$4,$5,$6,$7,$8,$9,NOW())
    ON CONFLICT (serial_number)
    DO UPDATE SET
      item_name_ar = EXCLUDED.item_name_ar,
      item_name_en = EXCLUDED.item_name_en,
      location = EXCLUDED.location,
      status = EXCLUDED.status,
      notes = EXCLUDED.notes,
      asset_type_ar = EXCLUDED.asset_type_ar,
      asset_type_en = EXCLUDED.asset_type_en,
      entity_id = EXCLUDED.entity_id,
      updated_at = NOW()
  `;

  for (const item of items) {
    await pool.query(sql, [
      item.serial_number,
      item.item_name_ar,
      item.item_name_en,
      item.location,
      item.status,
      item.notes,
      item.asset_type_ar,
      item.asset_type_en,
      entityId
    ]);
  }
};

const upsertTypeSummary = async (items) => {
  const sql = `
    INSERT INTO hr_asset_type_summary
      (asset_type_ar, asset_type_en, total_count, entity_id, updated_at)
    VALUES
      ($1,$2,$3,$4,NOW())
    ON CONFLICT (asset_type_ar, asset_type_en, entity_id)
    DO UPDATE SET
      total_count = EXCLUDED.total_count,
      updated_at = NOW()
  `;

  for (const item of items) {
    await pool.query(sql, [
      item.asset_type_ar,
      item.asset_type_en,
      item.total_count,
      entityId
    ]);
  }
};

const upsertWarehouse = async (items) => {
  const sql = `
    INSERT INTO hr_asset_warehouse
      (serial_number_ar, serial_number_en, asset_code_ar, asset_code_en,
       asset_name_ar, asset_name_en, quantity, condition_ar, condition_en,
       entry_date, reason_ar, reason_en, entity_id, updated_at)
    VALUES
      ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,NOW())
    ON CONFLICT (serial_number_ar)
    DO UPDATE SET
      serial_number_en = EXCLUDED.serial_number_en,
      asset_code_ar = EXCLUDED.asset_code_ar,
      asset_code_en = EXCLUDED.asset_code_en,
      asset_name_ar = EXCLUDED.asset_name_ar,
      asset_name_en = EXCLUDED.asset_name_en,
      quantity = EXCLUDED.quantity,
      condition_ar = EXCLUDED.condition_ar,
      condition_en = EXCLUDED.condition_en,
      entry_date = EXCLUDED.entry_date,
      reason_ar = EXCLUDED.reason_ar,
      reason_en = EXCLUDED.reason_en,
      entity_id = EXCLUDED.entity_id,
      updated_at = NOW()
  `;

  for (const item of items) {
    await pool.query(sql, [
      item.serial_number_ar,
      item.serial_number_en,
      item.asset_code_ar,
      item.asset_code_en,
      item.asset_name_ar,
      item.asset_name_en,
      item.quantity,
      item.condition_ar,
      item.condition_en,
      item.entry_date,
      item.reason_ar,
      item.reason_en,
      entityId
    ]);
  }
};

const parseCodingSystem = (rows) => {
  return rows
    .filter((row) => normalize(row[0]).startsWith('P-'))
    .map((row) => ({
      code_prefix: normalize(row[0]),
      name_en: normalize(row[1]),
      name_ar: '',
      category_ar: normalize(row[2]),
      category_en: normalize(row[3]),
      example_code: normalize(row[4])
    }))
    .filter((row) => row.code_prefix);
};

const parseRegistry = (rows) => {
  const headerIndex = findRowIndex(rows, 'الرقم التسلسلي الكامل');
  const dataRows = filterDataRows(rows, headerIndex + 1);
  return dataRows
    .map((row) => ({
      serial_number: normalize(row[0]),
      asset_name: normalize(row[1]),
      description: normalize(row[2]),
      location: normalize(row[3]),
      status: normalize(row[4]),
      notes: normalize(row[5])
    }))
    .filter((row) => row.serial_number);
};

const parseClassifications = (rows) => {
  const headerIndex = findRowIndex(rows, 'الرقم التسلسلي');
  const typeRow = rows
    .slice(0, headerIndex)
    .reverse()
    .find((row) => normalize(row[0]).includes('-'));
  const typeParts = normalize(typeRow ? typeRow[0] : '').split('-');
  const assetTypeAr = normalize(typeParts[0]);
  const assetTypeEn = normalize(typeParts.slice(1).join('-'));
  const dataRows = filterDataRows(rows, headerIndex + 1);
  return dataRows
    .map((row) => ({
      serial_number: normalize(row[0]),
      item_name_ar: normalize(row[1]),
      item_name_en: normalize(row[2]),
      location: normalize(row[3]),
      status: normalize(row[4]),
      notes: normalize(row[5]),
      asset_type_ar: assetTypeAr || null,
      asset_type_en: assetTypeEn || null
    }))
    .filter((row) => row.serial_number);
};

const parseTypeSummary = (rows) => {
  const headerIndex = rows.findIndex((row) => normalize(row[7]) === 'نوع الأصل' || normalize(row[8]) === 'Asset Type');
  const dataRows = filterDataRows(rows, headerIndex + 1);
  return dataRows
    .map((row) => ({
      asset_type_ar: normalize(row[7]),
      asset_type_en: normalize(row[8]),
      total_count: toInt(row[9]) || 0
    }))
    .filter((row) => row.asset_type_ar || row.asset_type_en);
};

const parseWarehouse = (rows) => {
  const headerIndex = findRowIndex(rows, 'الرقم التسلسلي');
  const dataRows = filterDataRows(rows, headerIndex + 1);
  return dataRows
    .map((row) => ({
      serial_number_ar: normalize(row[0]),
      serial_number_en: normalize(row[1]),
      asset_code_ar: normalize(row[2]),
      asset_code_en: normalize(row[3]),
      asset_name_ar: normalize(row[4]),
      asset_name_en: normalize(row[5]),
      quantity: toInt(row[6]),
      condition_ar: normalize(row[8]),
      condition_en: normalize(row[9]),
      entry_date: toDate(row[10]),
      reason_ar: normalize(row[12]),
      reason_en: normalize(row[13])
    }))
    .filter((row) => row.serial_number_ar);
};

const run = async () => {
  try {
    await pool.query(`
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
      CREATE INDEX IF NOT EXISTS idx_hr_asset_registry_entity ON hr_asset_registry(entity_id);
      CREATE INDEX IF NOT EXISTS idx_hr_asset_classifications_entity ON hr_asset_classifications(entity_id);
      CREATE INDEX IF NOT EXISTS idx_hr_asset_warehouse_entity ON hr_asset_warehouse(entity_id);
      CREATE INDEX IF NOT EXISTS idx_hr_asset_coding_entity ON hr_asset_coding_system(entity_id);
      CREATE INDEX IF NOT EXISTS idx_hr_asset_type_summary_entity ON hr_asset_type_summary(entity_id);
    `);

    const workbook = XLSX.readFile(filePath, { cellDates: true });

    const codingRows = loadSheetRows(workbook, 'نظام الترقيم');
    const registryRows = loadSheetRows(workbook, 'السجل الرئيسي للأصول');
    const classificationRows = loadSheetRows(workbook, 'تصنيف الأصول');
    const warehouseRows = loadSheetRows(workbook, 'المستودع');

    const codingItems = parseCodingSystem(codingRows);
    const registryItems = parseRegistry(registryRows);
    const classificationItems = parseClassifications(classificationRows);
    const typeSummaryItems = parseTypeSummary(classificationRows);
    const warehouseItems = parseWarehouse(warehouseRows);

    await upsertCodingSystem(codingItems);
    await upsertRegistry(registryItems);
    await upsertClassifications(classificationItems);
    await upsertTypeSummary(typeSummaryItems);
    await upsertWarehouse(warehouseItems);

    console.log('✅ HR assets import completed');
    console.log({
      coding: codingItems.length,
      registry: registryItems.length,
      classifications: classificationItems.length,
      typeSummary: typeSummaryItems.length,
      warehouse: warehouseItems.length
    });
  } catch (error) {
    console.error('❌ HR assets import failed:', error.message);
    process.exitCode = 1;
  } finally {
  }
};

run();
