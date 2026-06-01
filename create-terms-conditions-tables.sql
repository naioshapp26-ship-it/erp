-- Create terms and conditions tables
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
