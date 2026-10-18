#!/bin/bash
set -e
# ==============================================================================
# Script tạo database xulyxml_db và user xulyxml_user trong kekhaigia-postgres
# Tuân thủ theo mục 9 của Thiet-ke-VPS-final.md
# Chạy script này trên VPS: bash scripts/add-app.sh
# ==============================================================================

BACKUP_ROLE_PASSWORD="${BACKUP_ROLE_PASSWORD:-backup_secret_pass}"
XULYXML_DB_PASSWORD="${XULYXML_DB_PASSWORD:-xulyxml_secure_pass_2026}"

echo ">>> Bắt đầu cấu hình Database xulyxml trên container kekhaigia-postgres..."

docker exec -i kekhaigia-postgres psql -v ON_ERROR_STOP=1 -U kekhaigia -d postgres <<-EOSQL
    -- 1. Đảm bảo role backup_role tồn tại để phục vụ backup tự động lên Google Drive
    DO \$\$ BEGIN
      CREATE ROLE backup_role WITH LOGIN PASSWORD '${BACKUP_ROLE_PASSWORD}';
    EXCEPTION WHEN duplicate_object THEN NULL; END \$\$;

    -- 2. Tạo user cho ứng dụng xulyxml
    DO \$\$ BEGIN
      CREATE USER xulyxml_user WITH PASSWORD '${XULYXML_DB_PASSWORD}';
    EXCEPTION WHEN duplicate_object THEN
      ALTER USER xulyxml_user WITH PASSWORD '${XULYXML_DB_PASSWORD}';
    END \$\$;

    -- 3. Tạo database xulyxml_db do xulyxml_user làm chủ sở hữu
    SELECT 'CREATE DATABASE xulyxml_db OWNER xulyxml_user'
    WHERE NOT EXISTS (SELECT FROM pg_database WHERE datname = 'xulyxml_db')\gexec

    -- 4. Cấp quyền kết nối cho backup_role
    GRANT CONNECT ON DATABASE xulyxml_db TO backup_role;
EOSQL

docker exec -i kekhaigia-postgres psql -v ON_ERROR_STOP=1 -U kekhaigia -d xulyxml_db <<-EOSQL
    -- Cấp quyền SELECT trên các bảng cho backup_role
    GRANT USAGE ON SCHEMA public TO backup_role;
    GRANT SELECT ON ALL TABLES IN SCHEMA public TO backup_role;
    ALTER DEFAULT PRIVILEGES FOR ROLE xulyxml_user IN SCHEMA public GRANT SELECT ON TABLES TO backup_role;
EOSQL

echo ">>> Hoàn tất khởi tạo xulyxml_db và user xulyxml_user thành công!"
