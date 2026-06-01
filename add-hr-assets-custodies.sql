-- HR Assets & Custodies tables

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
