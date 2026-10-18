# Hệ thống Xử lý Hóa đơn XML (Phiên bản PostgreSQL / VPS Docker)

Hệ thống xử lý hóa đơn XML điện tử ngành dược, hỗ trợ tự động giải nén ZIP, trích xuất số lô / hạn dùng, đối chiếu bảng kê và quản lý danh mục ánh xạ thông minh.

Được thiết kế và tối ưu riêng cho **VPS TND Cloud** (2 vCPU / 4GB RAM / 30GB SSD Ceph) theo chuẩn tài liệu `Thiet-ke-VPS-final.md`.

---

## 🏗️ Kiến trúc Hệ thống

- **Frontend & Backend**: Next.js 16 (App Router, Turbopack, Standalone Output).
- **Cơ sở dữ liệu**: PostgreSQL 16 (Dùng chung container `kekhaigia-postgres` qua Docker network `shared-db-network`, cấp database `xulyxml_db` và user `xulyxml_user` riêng biệt để tiết kiệm RAM).
- **Web Server & SSL**: Nginx reverse proxy + Certbot tự động cấp chứng chỉ HTTPS (Let's Encrypt).
- **Bộ nhớ giới hạn (Resource Limits)**: Container app được giới hạn `mem_limit: 400m`, CPU: `0.50` an toàn cho VPS 4GB.
- **Sao lưu tự động (Offsite Backup)**: Tích hợp vào script backup chung của VPS, hàng ngày `pg_dump` tự động nén và đẩy lên Google Drive.

---

## 🚀 Hướng dẫn Triển khai trên VPS (Từng bước chi tiết)

### Bước 1: SSH vào VPS
```bash
ssh dsquan@103.139.43.35
```

### Bước 2: Clone repository vào thư mục apps
```bash
mkdir -p /home/dsquan/apps/xulyxml
cd /home/dsquan/apps/xulyxml
git clone https://github.com/dshoangquan-spec/xmlvps.git .
```

### Bước 3: Khởi tạo Database và User trên container Postgres có sẵn
Chạy script tự động đã chuẩn bị sẵn theo mục 9 của `Thiet-ke-VPS-final.md`:
```bash
bash scripts/add-app.sh
```
*Script sẽ tự động tạo user `xulyxml_user`, database `xulyxml_db` và phân quyền cho role `backup_role`.*

### Bước 4: Khởi tạo Cấu trúc bảng & Nạp dữ liệu cũ từ Firestore
```bash
# 1. Tạo cấu trúc bảng (schema)
docker exec -i kekhaigia-postgres psql -U xulyxml_user -d xulyxml_db < scripts/init-schema.sql

# 2. Nạp toàn bộ 72,268 bản ghi dữ liệu đã trích xuất từ Firestore
docker exec -i kekhaigia-postgres psql -U xulyxml_user -d xulyxml_db < scripts/firestore-data.sql
```

### Bước 5: Cấu hình biến môi trường
Tạo file `.env`:
```bash
cp .env.example .env
```
Nội dung file `.env`:
```env
DATABASE_URL=postgresql://xulyxml_user:xulyxml_secure_pass_2026@kekhaigia-postgres:5432/xulyxml_db
GOOGLE_GENAI_API_KEY=
```

### Bước 6: Cấu hình Nginx & Cấp chứng chỉ SSL (HTTPS)
1. Copy cấu hình Nginx mẫu:
```bash
cp nginx/xulyxml.conf /home/dsquan/apps/nginx/conf.d/
```
*(Mở file `/home/dsquan/apps/nginx/conf.d/xulyxml.conf` và sửa `xml.tndcloud.com` thành tên miền / subdomain thực tế của anh).*

2. Cấp chứng chỉ SSL qua Certbot container:
```bash
cd /home/dsquan/apps
docker compose run --rm certbot certonly --webroot -w /var/www/certbot -d your-domain.com
docker compose exec nginx nginx -t
docker compose exec nginx nginx -s reload
```

### Bước 7: Khởi chạy ứng dụng
Quay lại thư mục app và khởi chạy container:
```bash
cd /home/dsquan/apps/xulyxml
docker compose up -d --build
```

Kiểm tra trạng thái container:
```bash
docker compose ps
docker compose logs -f app
```

---

## 🛠️ Các thư mục và file quan trọng

| Tệp / Thư mục | Chức năng |
|---|---|
| `compose.yaml` | Cấu hình Docker compose tối ưu RAM (400MB) và nối mạng `backend-network`, `shared-db-network` |
| `Dockerfile` | Multi-stage build cho Next.js 16 standalone, giảm dung lượng image < 180MB |
| `nginx/xulyxml.conf` | File cấu hình Nginx reverse proxy bảo mật HTTPS |
| `scripts/add-app.sh` | Script tạo DB và User cho app mới trong `kekhaigia-postgres` |
| `scripts/init-schema.sql` | Cấu trúc bảng và chỉ mục tối ưu cho PostgreSQL |
| `scripts/firestore-data.sql` | 72,268 bản ghi dữ liệu Firestore sẵn sàng restore |
| `scripts/export-firestore-to-sql.js` | Công cụ tự động xuất Firestore sang PostgreSQL |
| `src/lib/db.ts` | Module kết nối và truy vấn PostgreSQL hiệu năng cao |

---

## 📦 Sao lưu & Phục hồi (Backup & Restore)

- **Backup tự động**: Database `xulyxml_db` nằm chung instance `kekhaigia-postgres`, do đó script `backup/backup.sh` của VPS sẽ tự động nhận diện và đẩy bản sao lưu nén lên Google Drive hàng đêm.
- **Restore thủ công khi cần**:
```bash
docker exec -i kekhaigia-postgres psql -U xulyxml_user -d xulyxml_db < backup_file.sql
```
