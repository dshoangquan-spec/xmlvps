-- ==============================================================================
-- Schema khởi tạo cơ sở dữ liệu PostgreSQL cho dự án Xử lý XML
-- Tương thích hoàn toàn với cấu trúc dữ liệu Firestore trước đây
-- ==============================================================================

-- 1. Bảng Người dùng (Users)
CREATE TABLE IF NOT EXISTS users (
    id VARCHAR(64) PRIMARY KEY,
    username VARCHAR(100) UNIQUE NOT NULL,
    password VARCHAR(255) NOT NULL,
    full_name VARCHAR(255) NOT NULL,
    role VARCHAR(20) NOT NULL DEFAULT 'USER',
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2. Bảng Nhà cung cấp (Suppliers)
CREATE TABLE IF NOT EXISTS suppliers (
    id VARCHAR(64) NOT NULL, -- Mã số thuế
    user_id VARCHAR(64) NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    supplier_code VARCHAR(100) NOT NULL,
    supplier_name VARCHAR(255) NOT NULL,
    PRIMARY KEY (user_id, id)
);

CREATE INDEX IF NOT EXISTS idx_suppliers_user ON suppliers(user_id);

-- 3. Bảng Danh mục dùng chung (Master Catalog)
CREATE TABLE IF NOT EXISTS master_catalog (
    id VARCHAR(64) PRIMARY KEY, -- Mã SP
    product_name VARCHAR(255) NOT NULL,
    active_ingredient TEXT DEFAULT '',
    concentration VARCHAR(255) DEFAULT '',
    registration_number VARCHAR(100) DEFAULT '',
    packaging VARCHAR(255) DEFAULT '',
    unit VARCHAR(50) NOT NULL,
    smallest_unit VARCHAR(50),
    conversion_rate NUMERIC(10,4) DEFAULT 1
);

CREATE INDEX IF NOT EXISTS idx_master_catalog_name ON master_catalog(product_name);

-- 4. Bảng Quy tắc ánh xạ của từng người dùng (Mappings)
CREATE TABLE IF NOT EXISTS mappings (
    id VARCHAR(128) NOT NULL,
    user_id VARCHAR(64) NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    original_code VARCHAR(100) NOT NULL,
    supplier_tax_code VARCHAR(50),
    new_code VARCHAR(100) NOT NULL,
    original_name VARCHAR(255) NOT NULL,
    new_name VARCHAR(255) NOT NULL,
    original_unit VARCHAR(50),
    new_unit VARCHAR(50) NOT NULL,
    conversion_rate NUMERIC(10,4) DEFAULT 1,
    master_catalog_id VARCHAR(64),
    PRIMARY KEY (user_id, id)
);

CREATE INDEX IF NOT EXISTS idx_mappings_user ON mappings(user_id);
CREATE INDEX IF NOT EXISTS idx_mappings_orig_code ON mappings(user_id, original_code);

-- 5. Bảng Quy tắc ánh xạ cộng đồng (Community Mappings)
CREATE TABLE IF NOT EXISTS community_mappings (
    id VARCHAR(128) PRIMARY KEY,
    original_code VARCHAR(100) NOT NULL,
    supplier_tax_code VARCHAR(50),
    new_code VARCHAR(100) NOT NULL,
    new_name VARCHAR(255) NOT NULL,
    new_unit VARCHAR(50) NOT NULL,
    conversion_rate NUMERIC(10,4) DEFAULT 1,
    update_count INT DEFAULT 1,
    master_catalog_id VARCHAR(64)
);

CREATE INDEX IF NOT EXISTS idx_comm_mappings_orig ON community_mappings(original_code);
CREATE INDEX IF NOT EXISTS idx_comm_mappings_supplier ON community_mappings(supplier_tax_code);

-- 6. Bảng Tài khoản nhà thuốc (Pharmacy Accounts)
CREATE TABLE IF NOT EXISTS pharmacy_accounts (
    id VARCHAR(64) PRIMARY KEY,
    user_id VARCHAR(64) NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    pharmacy_name VARCHAR(255) NOT NULL,
    representative VARCHAR(255),
    usage_start_date VARCHAR(20),
    software_fee NUMERIC(15,2) DEFAULT 0,
    software_fee_date VARCHAR(20),
    pm_name VARCHAR(100),
    pm_user VARCHAR(100),
    pm_pass VARCHAR(255),
    invoice_provider_name VARCHAR(100),
    invoice_user VARCHAR(100),
    invoice_pass VARCHAR(255),
    invoice_link TEXT,
    tax_user VARCHAR(100),
    tax_pass VARCHAR(255),
    electronic_tax_user VARCHAR(100),
    electronic_tax_pass VARCHAR(255),
    electronic_tax_link TEXT
);

CREATE INDEX IF NOT EXISTS idx_pharmacy_accounts_user ON pharmacy_accounts(user_id);

-- 7. Bảng Bản ghi thu phí (Fee Records)
CREATE TABLE IF NOT EXISTS fee_records (
    id VARCHAR(64) PRIMARY KEY,
    pharmacy_account_id VARCHAR(64) NOT NULL REFERENCES pharmacy_accounts(id) ON DELETE CASCADE,
    month VARCHAR(10) NOT NULL,
    tax_report_fee NUMERIC(15,2) DEFAULT 0,
    invoice_import_fee NUMERIC(15,2) DEFAULT 0,
    invoice_export_fee NUMERIC(15,2) DEFAULT 0,
    total_fee NUMERIC(15,2) DEFAULT 0,
    is_paid BOOLEAN DEFAULT FALSE
);

CREATE INDEX IF NOT EXISTS idx_fee_records_account ON fee_records(pharmacy_account_id);

-- 8. Bảng Báo cáo thuế (Tax Reports)
CREATE TABLE IF NOT EXISTS tax_reports (
    id VARCHAR(64) PRIMARY KEY,
    pharmacy_account_id VARCHAR(64) NOT NULL REFERENCES pharmacy_accounts(id) ON DELETE CASCADE,
    user_id VARCHAR(64) NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    year INT NOT NULL,
    quarter INT NOT NULL,
    opening_balance NUMERIC(15,2) DEFAULT 0,
    purchase_value NUMERIC(15,2) DEFAULT 0,
    revenue NUMERIC(15,2) DEFAULT 0,
    cost_of_goods NUMERIC(15,2) DEFAULT 0,
    closing_balance NUMERIC(15,2) DEFAULT 0,
    vat_payable NUMERIC(15,2) DEFAULT 0,
    pit_payable NUMERIC(15,2) DEFAULT 0,
    status VARCHAR(20) DEFAULT 'DRAFT',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_tax_reports_user ON tax_reports(user_id);

-- 9. Bảng Phiên nhập dữ liệu (Import Sessions)
CREATE TABLE IF NOT EXISTS import_sessions (
    id VARCHAR(64) PRIMARY KEY,
    user_id VARCHAR(64) NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    import_date TIMESTAMPTZ DEFAULT NOW(),
    file_names JSONB DEFAULT '[]',
    invoice_count INT DEFAULT 0,
    item_count INT DEFAULT 0
);

CREATE INDEX IF NOT EXISTS idx_import_sessions_user ON import_sessions(user_id);

-- 10. Bảng Hóa đơn (Invoices)
CREATE TABLE IF NOT EXISTS invoices (
    id VARCHAR(64) PRIMARY KEY,
    invoice_number VARCHAR(100) NOT NULL,
    unique_identifier VARCHAR(255),
    import_session_id VARCHAR(64) NOT NULL REFERENCES import_sessions(id) ON DELETE CASCADE,
    provider VARCHAR(100) DEFAULT '',
    invoice_date VARCHAR(30) NOT NULL,
    seller_name VARCHAR(255) NOT NULL,
    seller_tax_code VARCHAR(50) NOT NULL,
    seller_address TEXT DEFAULT '',
    buyer_name VARCHAR(255) DEFAULT '',
    file_name VARCHAR(255) DEFAULT '',
    portal_link TEXT,
    access_code VARCHAR(100)
);

CREATE INDEX IF NOT EXISTS idx_invoices_session ON invoices(import_session_id);
CREATE INDEX IF NOT EXISTS idx_invoices_unique ON invoices(unique_identifier);

-- 11. Bảng Chi tiết mặt hàng trong hóa đơn (Invoice Items)
CREATE TABLE IF NOT EXISTS invoice_items (
    id VARCHAR(64) PRIMARY KEY,
    user_id VARCHAR(64) NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    invoice_id VARCHAR(64) NOT NULL REFERENCES invoices(id) ON DELETE CASCADE,
    invoice_date VARCHAR(30) NOT NULL,
    invoice_date_iso VARCHAR(20) NOT NULL,
    seller_name VARCHAR(255) NOT NULL,
    line_number VARCHAR(20) DEFAULT '',
    item_code VARCHAR(100) NOT NULL,
    item_name VARCHAR(255) NOT NULL,
    manufacturer VARCHAR(255),
    unit VARCHAR(50) NOT NULL,
    quantity VARCHAR(50) NOT NULL,
    unit_price VARCHAR(50) NOT NULL,
    total_amount VARCHAR(50) NOT NULL,
    tax_rate VARCHAR(20) NOT NULL,
    lot_number VARCHAR(100),
    expiration_date VARCHAR(30)
);

CREATE INDEX IF NOT EXISTS idx_invoice_items_user ON invoice_items(user_id);
CREATE INDEX IF NOT EXISTS idx_invoice_items_invoice ON invoice_items(invoice_id);
CREATE INDEX IF NOT EXISTS idx_invoice_items_date ON invoice_items(invoice_date_iso);

-- 12. Bảng Phiên bản phần mềm (Versions)
CREATE TABLE IF NOT EXISTS versions (
    id VARCHAR(64) PRIMARY KEY,
    version_number VARCHAR(50) NOT NULL,
    release_date TIMESTAMPTZ DEFAULT NOW(),
    published BOOLEAN DEFAULT FALSE
);

-- 13. Bảng Thay đổi theo phiên bản (Changes)
CREATE TABLE IF NOT EXISTS changes (
    id VARCHAR(64) PRIMARY KEY,
    version_id VARCHAR(64) NOT NULL REFERENCES versions(id) ON DELETE CASCADE,
    type VARCHAR(20) NOT NULL,
    text TEXT NOT NULL,
    admin_only BOOLEAN DEFAULT FALSE,
    "order" INT DEFAULT 0
);

CREATE INDEX IF NOT EXISTS idx_changes_version ON changes(version_id);
