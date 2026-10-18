# Thiết kế VPS tiết kiệm nhất — TND Cloud VPS 30 (bản hoàn thiện, dùng lại cho mọi dự án)

VPS thật: `103.139.43.35`, hostname `vps-21416`, Ubuntu 24.04, 2 vCPU / 4GB RAM / 30GB SSD Ceph, user vận hành `dsquan` (root SSH đã tắt). Không mua "Backup nâng cao" của TND → mọi backup/offsite là tự làm. Xem thêm [ssh-access-notes.md](ssh-access-notes.md).

**Hiện trạng vs bản này**: hiện tại Nginx cài thẳng trên host (không phải container), mỗi app build trực tiếp trên VPS (`docker compose up -d --build`), backup chỉ lưu local 7 ngày, chưa có bản sao offsite (xem [04-backup-script.sh](04-backup-script.sh)). Bản thiết kế dưới đây là **chuẩn tiết kiệm nhất để dùng cho dự án MỚI** (container hoá Nginx, build ở GitHub Actions, backup tự đẩy lên Google Drive). Áp dụng nguyên xi cho project mới; với app đang chạy (kekhaigia) có thể giữ nguyên host-Nginx, chỉ cần thêm phần backup→Google Drive ở mục 15 vì đó là chỗ đang thiếu nhất.

**Postgres dùng chung = container đang chạy sẵn**: theo yêu cầu, KHÔNG tạo thêm container Postgres mới cho mỗi dự án. Mọi app (kekhaigia hiện tại + app mới sau này) đều lưu chung trong **container `kekhaigia-postgres` đang chạy** (`postgres:16-alpine`, volume `kekhaigia-pgdata`, xem [docker-compose.yml](../KeKhaiGia/docker-compose.yml) của kekhaigia) — mỗi app vẫn có database + user riêng bên trong, chỉ chung 1 instance Postgres vật lý để tiết kiệm RAM (không phải chung 1 database). Toàn bộ mục 6, 9, 10, 15 bên dưới đã cập nhật theo tên container thật này thay vì service `postgres` chung chung.

---

## 1. Kiến trúc tổng quan

```
Internet
   │
   ├─ Certbot container (egress-network) ──> Let's Encrypt (gia hạn cert, không mở port)
   │
   ▼
Nginx container (host ports 80/443, network: backend-network)
   │  proxy theo subdomain, chỉ Nginx được publish port ra ngoài
   ▼
App containers (network: backend-network + shared-db-network)
   │  mỗi app: 1 database + 1 user riêng, cùng chung 1 instance Postgres
   ▼
kekhaigia-postgres (container ĐÃ CHẠY SẴN, không tạo thêm Postgres mới)
   network: shared-db-network, không route ra Internet, không mở port 5432 ra host

Backup job (network: db-network + egress-network)
   pg_dump từng DB → rclone đẩy lên Google Drive (thư mục riêng của tài khoản admin) → xoá bản local cũ
```

Lý do dùng Google Drive làm nơi backup offsite thay vì S3/B2: **miễn phí** (15GB free, hoặc tận dụng Drive trả phí anh đã có sẵn cho kekhaigia), không tốn thêm chi phí hạ tầng — đúng tinh thần "tiết kiệm nhất". Nhược điểm cần biết: rclone dùng chính tài khoản Google cá nhân của anh (OAuth), **không dùng service account** — bài học từ kekhaigia là service account không có quota lưu trữ riêng nên upload sẽ báo `storageQuotaExceeded`.

Vì Postgres là container **có sẵn** thuộc project `kekhaigia` (compose project riêng, không nằm trong stack mới), các app khác muốn dùng chung nó phải nối qua **1 network Docker external, tạo 1 lần**, rồi cả kekhaigia-postgres lẫn app mới cùng join vào:

```bash
docker network create shared-db-network
```

Sửa `docker-compose.yml` của kekhaigia (thêm network, gỡ bind port host vì không còn cần app khác connect qua `127.0.0.1:5432` nữa — connect thẳng qua tên container trong `shared-db-network` an toàn hơn):
```yaml
services:
  postgres:
    container_name: kekhaigia-postgres
    # ports:                    # xoá / comment dòng "127.0.0.1:5432:5432" — không cần nữa
    networks: [default, shared-db-network]
  app:
    networks: [default, shared-db-network]   # nếu sau này kekhaigia cũng cần gọi app khác

networks:
  shared-db-network:
    external: true
```
Chạy `docker compose up -d` lại trong thư mục kekhaigia — Postgres **không mất data** (volume `kekhaigia-pgdata` giữ nguyên), chỉ recreate container để thêm network.

Mạng Docker cho stack mới (không còn service `postgres` riêng, dùng `shared-db-network` external thay cho `db-network`):
```yaml
networks:
  backend-network:
    driver: bridge
  shared-db-network:
    external: true      # network đã tạo ở trên, chứa kekhaigia-postgres
  egress-network:
    driver: bridge
```
- `nginx`: chỉ `backend-network`
- app containers: `backend-network` + `shared-db-network`, connect Postgres qua host `kekhaigia-postgres` (đúng tên container thật)
- `kekhaigia-postgres`: đã chạy sẵn, chỉ cần join thêm `shared-db-network`, không mở port ra host nữa
- `certbot`: chỉ `egress-network`, cộng volume cert + webroot chung với nginx
- `backup`: `shared-db-network` + `egress-network`, không đụng `backend-network`

---

## 2. Ngân sách RAM (4GB)

Giả định baseline (giống thực tế đang chạy): 1 app Next.js (kekhaigia) + Postgres dùng chung + Nginx. Thêm 1-2 app Next.js/Node nhẹ nữa là vẫn an toàn.

| Thành phần | mem_limit | Ghi chú |
|---|---|---|
| OS + Docker daemon + SSH | ~500MB | không giới hạn bằng container, để hệ thống tự do |
| Nginx | 100M | rất nhẹ |
| Postgres | 512M | `shared_buffers` ~128-160MB, còn lại cache OS |
| App Next.js #1 (kekhaigia) | 400M | |
| App Next.js #2 | 300M | |
| App Python (FastAPI, nếu có) | 300M | |
| Backup job (chạy ngắn, one-shot) | 200M | không chạy thường trực |
| **Tổng container** | **~1.8GB** | ~45% của 4GB, còn nhiều dư cho OS + spike + swap |

Nguyên tắc: tổng `mem_limit` các container không vượt quá ~75-80% RAM (~3.2GB), để dành cho OS/cache/spike. Không tính pool kết nối Postgres theo 100 user đồng thời trực tiếp — phần lớn request HTTP không giữ kết nối DB liên tục.

## 3. Ngân sách đĩa (30GB)

| Mục | Ước tính |
|---|---|
| OS + Docker Engine | ~4-5GB |
| Docker images (Nginx + Postgres + 2-3 app image, đã tối ưu multi-stage <200MB/app) | ~1.5GB |
| Postgres data (vài app nhỏ, text/JSON, vài năm dữ liệu) | ~2-3GB |
| Log container (đã rotate, xem mục log) | ~500MB |
| Backup staging local (trước khi đẩy Drive) | tối đa 2-3GB (giới hạn cứng) |
| **Đã dùng** | **~10-12GB** |
| **Còn trống** | **~18-20GB (60-65%)** — an toàn, trên ngưỡng 20% tối thiểu |

Lệnh theo dõi: `df -h`, `docker system df`, `du -sh /var/lib/docker/*`. Dọn an toàn: `docker image prune -f` (chỉ ảnh dangling, không dùng `docker system prune -a` bừa bãi).

**Riêng WAL Postgres** — nguyên nhân phổ biến nhất gây hết đĩa đột ngột trên ổ 30GB:
```bash
docker exec kekhaigia-postgres du -sh /var/lib/postgresql/data/pg_wal
```
```sql
SELECT datname, pg_size_pretty(pg_database_size(datname))
FROM pg_database ORDER BY pg_database_size(datname) DESC;
```
Không tạo replication slot nếu không dùng replication (slot bị bỏ quên là nguyên nhân WAL phình vô hạn). Giữ `max_wal_size` bảo thủ (mục 10). Cảnh báo ở 75% đĩa, hành động dọn ngay ở 80%.

## 4. Số app tối đa VPS này chịu được

Với baseline hiện tại (Nginx + Postgres dùng chung + 1 app đang chạy production), VPS này còn dư chỗ cho **khoảng 4-5 app nhỏ nữa** (Next.js/Node/FastAPI, traffic thấp, ít người dùng đồng thời) trước khi cần nâng cấp RAM. Giới hạn thực tế thường là RAM trước, đĩa sau. Quá 6-7 app cùng lúc nên cân nhắc nâng lên gói VPS RAM cao hơn thay vì cố nhồi thêm.

---

## 5. Cấu trúc thư mục trên VPS

```
/home/dsquan/apps/
├── nginx/
│   ├── conf.d/                # 1 file .conf / app
│   └── certbot/{www,conf}/    # webroot + cert dùng chung
├── postgres/
│   ├── init/                  # script chạy 1 lần lúc tạo volume
│   └── data/                  # volume data (KHÔNG commit)
├── backup/
│   ├── backup.sh
│   └── staging/                # local staging, dọn theo mục 15
├── kekhaigia/app/              # app đang chạy (giữ nguyên, host-nginx)
├── app2/                       # app mới theo template dưới
│   ├── compose.yaml
│   ├── .env                    # git-ignore
│   └── Dockerfile
└── compose.yaml                # file gốc gộp nginx + postgres + apps (nếu dùng 1 project)
```

## 6. `compose.yaml` (mẫu đầy đủ)

```yaml
name: vps-stack

services:
  nginx:
    image: nginx:1.27-alpine
    container_name: nginx
    restart: unless-stopped
    init: true
    ports:
      - "80:80"
      - "443:443"
    volumes:
      - ./nginx/conf.d:/etc/nginx/conf.d:ro
      - ./nginx/certbot/conf:/etc/letsencrypt:ro
      - ./nginx/certbot/www:/var/www/certbot:ro
    networks: [backend-network]
    mem_limit: 100m
    mem_reservation: 64m
    cpus: "0.30"
    pids_limit: 100
    security_opt: ["no-new-privileges:true"]
    logging:
      driver: json-file
      options: { max-size: "10m", max-file: "3" }

  certbot:
    image: certbot/certbot:latest
    container_name: certbot
    restart: "no"
    volumes:
      - ./nginx/certbot/conf:/etc/letsencrypt
      - ./nginx/certbot/www:/var/www/certbot
    networks: [egress-network]

  # Không khai báo service "postgres" ở đây — Postgres dùng chung là container
  # kekhaigia-postgres đã chạy sẵn ở project khác (/home/dsquan/apps/kekhaigia/app),
  # chỉ cần join network shared-db-network (xem mục 1) là app mới connect được
  # qua host "kekhaigia-postgres", không tạo Postgres mới.

  app1:
    image: ${APP1_IMAGE}:${APP1_TAG}
    container_name: app1
    restart: unless-stopped
    init: true
    env_file: [./app1/.env]
    networks: [backend-network, shared-db-network]
    healthcheck:
      test: ["CMD", "wget", "--spider", "-q", "http://localhost:3000"]
      interval: 30s
      timeout: 5s
      retries: 3
    mem_limit: 400m
    mem_reservation: 128m
    cpus: "0.50"
    pids_limit: 150
    deploy:
      resources:
        limits: { memory: 400M, cpus: "0.50" }
    logging:
      driver: json-file
      options: { max-size: "10m", max-file: "3" }

  backup:
    build: ./backup
    container_name: backup
    restart: "no"
    env_file: [./backup/.env]
    volumes:
      - ./backup/staging:/staging
    networks: [shared-db-network, egress-network]
    mem_limit: 200m
    cpus: "0.30"

networks:
  backend-network: { driver: bridge }
  shared-db-network: { external: true }   # chứa kekhaigia-postgres, tạo 1 lần (mục 1)
  egress-network: { driver: bridge }
```
Vì `kekhaigia-postgres` thuộc compose project khác, không dùng được `depends_on: {condition: service_healthy}` xuyên project — app phải tự retry kết nối DB lúc khởi động (exponential backoff), đừng giả định Postgres đã sẵn sàng ngay khi container app start.

Ghi chú Compose v2 non-Swarm: `deploy.resources.limits` **không** được engine thực thi ngoài Swarm mode — giới hạn thật sự đến từ `mem_limit`/`cpus` ở top-level. Vẫn giữ cả hai khối cho nhất quán/tương lai, nhưng `mem_limit`/`cpus` mới là cái có tác dụng thật.

## 7. `.env.example`

```bash
# Postgres — dùng chung container kekhaigia-postgres đã chạy sẵn, không tạo mới.
# Superuser password lấy từ .env của project kekhaigia (POSTGRES_PASSWORD), không đặt lại ở đây.

# App1
APP1_IMAGE=ghcr.io/OWNER/app1
APP1_TAG=sha-CHANGE_ME
APP1_DB_NAME=app1_db
APP1_DB_USER=app1_user
APP1_DB_PASSWORD=CHANGE_ME
DATABASE_URL=postgresql://app1_user:CHANGE_ME@kekhaigia-postgres:5432/app1_db

# Backup -> Google Drive (xem mục 15 để lấy rclone token)
RCLONE_CONFIG_GDRIVE_TYPE=drive
RCLONE_CONFIG_GDRIVE_TOKEN=CHANGE_ME_JSON_TOKEN
GDRIVE_BACKUP_FOLDER_ID=CHANGE_ME
BACKUP_ROLE_PASSWORD=CHANGE_ME
```

## 8. Nginx server block + Certbot

`nginx/conf.d/app1.conf`:
```nginx
server {
    listen 80;
    server_name app1.example.com;
    location /.well-known/acme-challenge/ { root /var/www/certbot; }
    location / { return 301 https://$host$request_uri; }
}

server {
    listen 443 ssl;
    server_name app1.example.com;

    ssl_certificate     /etc/letsencrypt/live/app1.example.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/app1.example.com/privkey.pem;

    add_header X-Content-Type-Options nosniff;
    add_header X-Frame-Options DENY;
    add_header Referrer-Policy strict-origin-when-cross-origin;
    # HSTS: chỉ bật SAU khi HTTPS đã ổn định lâu dài. KHÔNG bật includeSubDomains/preload
    # mặc định vì khó đảo ngược (preload phải xin gỡ thủ công, mất nhiều tuần).
    # add_header Strict-Transport-Security "max-age=15552000" always;

    location / {
        proxy_pass http://app1:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
```

Script gia hạn `renew-cert.sh` (host, gọi qua systemd timer):
```bash
#!/usr/bin/env bash
set -Eeuo pipefail

docker compose run --rm certbot renew &&
docker compose exec nginx nginx -t &&
docker compose exec nginx nginx -s reload
```
Nếu renew hoặc `nginx -t` fail → script dừng ngay (không reload), trả về non-zero, ghi log hệ thống — cert mới vô nghĩa nếu Nginx không được reload, và reload với config hỏng có thể sập proxy đang chạy.

## 9. Thêm database cho app mới vào Postgres đang chạy sẵn

`kekhaigia-postgres` **đã có data** (database `kekhaigia`) → thư mục `/docker-entrypoint-initdb.d/` không còn tác dụng (chỉ chạy lúc volume rỗng lần đầu, đã qua rồi). Từ giờ mọi app mới dùng **duy nhất 1 script idempotent** `add-app.sh`, chạy trực tiếp vào container đang sống bằng `docker exec`:

```bash
#!/bin/bash
set -e
docker exec -i kekhaigia-postgres psql -v ON_ERROR_STOP=1 -U kekhaigia -d postgres <<-EOSQL
    -- backup_role: tạo 1 lần duy nhất (bỏ qua nếu đã có)
    DO \$\$ BEGIN
      CREATE ROLE backup_role WITH LOGIN PASSWORD '${BACKUP_ROLE_PASSWORD}';
    EXCEPTION WHEN duplicate_object THEN NULL; END \$\$;

    CREATE USER app2_user WITH PASSWORD '${APP2_DB_PASSWORD}';
    CREATE DATABASE app2_db OWNER app2_user;
    GRANT CONNECT ON DATABASE app2_db TO backup_role;
EOSQL

docker exec -i kekhaigia-postgres psql -v ON_ERROR_STOP=1 -U kekhaigia -d app2_db <<-EOSQL
    GRANT USAGE ON SCHEMA public TO backup_role;
    GRANT SELECT ON ALL TABLES IN SCHEMA public TO backup_role;
    ALTER DEFAULT PRIVILEGES FOR ROLE app2_user IN SCHEMA public GRANT SELECT ON TABLES TO backup_role;
EOSQL
```
Superuser thật của `kekhaigia-postgres` là user `kekhaigia` (đặt trong `POSTGRES_USER` của compose kekhaigia), không phải `postgres` mặc định — dùng đúng tên này khi chạy script. Cũng nên chạy 1 lần script tương tự để `GRANT CONNECT` + set default-privileges `backup_role` cho chính database `kekhaigia` hiện tại, để mục 15 backup được luôn app gốc.

## 10. `postgresql.conf` (4GB RAM, Ceph SSD)

Để áp dụng, thêm vào service `postgres` trong `docker-compose.yml` của kekhaigia (hiện chưa có `mem_limit` lẫn config tuỳ chỉnh — nên thêm cả hai để Postgres không âm thầm ăn RAM ngoài dự tính khi phải gánh thêm nhiều app):
```yaml
services:
  postgres:
    volumes:
      - kekhaigia-pgdata:/var/lib/postgresql/data
      - ./postgresql.conf:/etc/postgresql/postgresql.conf:ro
    command: ["postgres", "-c", "config_file=/etc/postgresql/postgresql.conf"]
    mem_limit: 512m
    mem_reservation: 256m
    cpus: "0.70"
```
Nội dung `postgresql.conf`:
```ini
max_connections = 50            # đủ cho vài app x 5 kết nối + admin + backup, dư headroom
shared_buffers = 512MB          # ~1/8 RAM tổng, không phải 1/8 của mem_limit container
effective_cache_size = 1536MB   # ước lượng OS cache có thể dùng cho Postgres
work_mem = 8MB                  # THẬN TRỌNG: nhân theo số session x số sort/hash mỗi query,
                                 # dễ vượt RAM nếu để cao — giữ thấp cho OLTP nhỏ
maintenance_work_mem = 128MB
wal_buffers = 16MB
min_wal_size = 512MB
max_wal_size = 1GB              # bảo thủ, tránh WAL ăn hết đĩa 30GB (mục 4)
checkpoint_completion_target = 0.9
random_page_cost = 1.1          # SSD (Ceph-backed, không phải NVMe cục bộ nên không hạ quá thấp)
effective_io_concurrency = 100  # thấp hơn NVMe cục bộ vì là mạng Ceph, không giả định latency cực thấp
default_statistics_target = 100
max_worker_processes = 2        # khớp 2 vCPU của VPS
max_parallel_workers = 2
max_parallel_workers_per_gather = 1
autovacuum_max_workers = 2
autovacuum_work_mem = 64MB
jit = off                       # OLTP nhỏ, không phải truy vấn phân tích nặng — JIT overhead không đáng
```
Không tắt `fsync`/`full_page_writes`/`synchronous_commit` — VPS này không có backup managed, nên độ bền dữ liệu quan trọng hơn tốc độ thô.

## 11. Dockerfile Next.js (multi-stage)

```dockerfile
FROM node:20-alpine AS deps
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci

FROM node:20-alpine AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN npm run build   # cần output: 'standalone' trong next.config

FROM node:20-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production
COPY --from=builder /app/public ./public
COPY --from=builder /app/.next/standalone ./
COPY --from=builder /app/.next/static ./.next/static
EXPOSE 3000
CMD ["node", "server.js"]
```

## 12. Dockerfile Python (FastAPI, multi-stage)

```dockerfile
FROM python:3.12-slim AS builder
WORKDIR /app
COPY requirements.txt .
RUN pip install --no-cache-dir --user -r requirements.txt

FROM python:3.12-slim AS runner
WORKDIR /app
COPY --from=builder /root/.local /root/.local
COPY . .
ENV PATH=/root/.local/bin:$PATH
EXPOSE 8000
CMD ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "8000", "--workers", "1"]
```
`--workers 1`: chỉ 2 vCPU chia cho toàn bộ app trên VPS, không spawn nhiều worker mặc định.

## 13. GitHub Actions → GHCR

```yaml
name: build-and-push
on:
  push:
    branches: [main]
    tags: ['v*']

permissions:
  contents: read
  packages: write

jobs:
  build:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: docker/setup-buildx-action@v3
      - uses: docker/login-action@v3
        with:
          registry: ghcr.io
          username: ${{ github.actor }}
          password: ${{ secrets.GITHUB_TOKEN }}
      - uses: docker/build-push-action@v6
        with:
          push: true
          tags: ghcr.io/${{ github.repository_owner }}/app1:sha-${{ github.sha }}
          cache-from: type=gha
          cache-to: type=gha,mode=max
```

## 14. Deploy script trên VPS (không build trên VPS)

```bash
#!/usr/bin/env bash
set -Eeuo pipefail
APP=app1
STATE_FILE="/home/dsquan/apps/${APP}/.last-tag"
NEW_TAG="$1"

[ -f "$STATE_FILE" ] && cp "$STATE_FILE" "${STATE_FILE}.prev"
echo "$NEW_TAG" > "$STATE_FILE"

sed -i "s/^APP1_TAG=.*/APP1_TAG=${NEW_TAG}/" .env
docker compose pull app1 &&
docker compose up -d app1 &&
docker compose exec app1 wget --spider -q http://localhost:3000

echo "Deployed ${APP} @ ${NEW_TAG}"
```
Rollback: `NEW_TAG=$(cat .last-tag.prev)` rồi chạy lại script với tag cũ.

## 15. Backup → Google Drive (rclone, không dùng service account)

**Vì sao Google Drive**: miễn phí, anh đã có kinh nghiệm OAuth Drive từ dự án kekhaigia — bài học quan trọng: **service account không có quota lưu trữ riêng, sẽ báo `storageQuotaExceeded`**. Với rclone cũng vậy — phải authorize bằng chính tài khoản Google cá nhân (OAuth user), không phải service account.

**Setup 1 lần** (trên máy có trình duyệt, ví dụ máy Mac của anh):
```bash
rclone config
# n) New remote -> name: gdrive -> type: drive
# client_id/secret: để trống (dùng default) hoặc tạo riêng trong Cloud Console nếu muốn
# scope: 1 (full access) hoặc 2 (chỉ file do rclone tạo, an toàn hơn)
# root_folder_id: ID thư mục backup riêng trên Drive (tạo trước 1 folder "VPS Backups")
# Auto config: y (mở trình duyệt để đăng nhập + cấp quyền)
```
Sau khi xong, `rclone config show gdrive` in ra `token = {...}` — copy JSON này vào biến `RCLONE_CONFIG_GDRIVE_TOKEN` trong `.env` trên VPS (không cần trình duyệt trên VPS).

`backup/backup.sh` — lặp qua **mọi database** trong `kekhaigia-postgres` (database gốc `kekhaigia` + mọi app thêm sau này), một Postgres duy nhất nên 1 script backup dùng chung cho tất cả:
```bash
#!/usr/bin/env bash
set -Eeuo pipefail
DATE=$(date +%Y-%m-%d)
STAGING=/staging
PGHOST=kekhaigia-postgres
DBS=(kekhaigia app2_db)   # thêm tên DB app mới vào đây khi tạo (mục 9)
MAX_STAGING_MB=2500        # ~2.5GB trần cứng cho staging local

mkdir -p "$STAGING"

# 1. Dừng lại nếu đĩa VPS < 20% trống (tie-in với mục 3)
FREE_PCT=$(df --output=pcent /home | tail -1 | tr -dc '0-9')
if [ "$FREE_PCT" -gt 80 ]; then
  echo "Đĩa đầy >80%, dừng backup mới, ưu tiên đẩy offsite + dọn." >&2
  exit 1
fi

for DB in "${DBS[@]}"; do
  # 2. pg_dump bằng backup_role (chỉ SELECT), custom format (đã nén sẵn), tuần tự từng DB
  PGPASSWORD="$BACKUP_ROLE_PASSWORD" pg_dump \
    --host="$PGHOST" --username=backup_role --format=custom \
    --file="${STAGING}/${DB}_${DATE}.dump" "$DB"

  # 3. Đẩy lên Google Drive rồi verify tồn tại trước khi xoá local
  rclone copy "${STAGING}/${DB}_${DATE}.dump" "gdrive:VPS-Backups/${DB}/" --config=/dev/null
  rclone lsf "gdrive:VPS-Backups/${DB}/${DB}_${DATE}.dump" --config=/dev/null | grep -q "${DB}_${DATE}.dump"
done

# 4. Xoá bản local cũ hơn 7 ngày, và ép staging không vượt trần dung lượng
find "$STAGING" -type f -mtime +7 -delete
while [ "$(du -sm "$STAGING" | cut -f1)" -gt "$MAX_STAGING_MB" ]; do
  oldest=$(ls -t "$STAGING" | tail -1)
  rm -f "${STAGING:?}/${oldest}"
done

echo "Backup ${DATE} xong cho: ${DBS[*]} — đã lên Google Drive."
```
Container `backup` phải join `shared-db-network` (mục 1) để `--host=kekhaigia-postgres` phân giải được — không cần join `backend-network`.
Không dùng superuser cho backup, chỉ `backup_role` (quyền SELECT-only, tạo ở mục 9). Chạy tuần tự từng DB, không chạy song song nhiều `pg_dump` cùng lúc để không đội RAM/CPU.

**Lịch chạy — systemd timer trên host** (không dùng container cron thường trực, tốn RAM vô ích):
`/etc/systemd/system/vps-backup.service`:
```ini
[Unit]
Description=VPS backup to Google Drive
[Service]
Type=oneshot
WorkingDirectory=/home/dsquan/apps
ExecStart=/usr/bin/docker compose run --rm backup
```
`/etc/systemd/system/vps-backup.timer`:
```ini
[Unit]
Description=Chạy backup hàng ngày 2h sáng
[Timer]
OnCalendar=*-*-* 02:00:00
Persistent=true
[Timer]
```
```bash
sudo systemctl enable --now vps-backup.timer
journalctl -u vps-backup.service --since today   # xem log/kết quả
```

**Ước tính chi phí**: vài trăm KB - vài MB mỗi dump (text/JSON nhỏ) → cả tháng cộng dồn dưới 1GB, nằm gọn trong 15GB free của Google Drive, **$0/tháng**.

## 16. Restore + kiểm tra định kỳ

Restore 1 database:
```bash
docker compose exec -T postgres pg_restore -U postgres -d app1_db --clean --if-exists < app1_db_2026-08-08.dump
```
Hoặc tải từ Drive trước: `rclone copy gdrive:VPS-Backups/app1_db/app1_db_2026-08-08.dump .`

**Test restore định kỳ (bắt buộc, không chỉ tin backup là đúng)**: mỗi tháng 1 lần, tạo DB tạm `app1_db_test`, restore bản backup mới nhất vào đó, chạy vài query đối chiếu số dòng/số bản ghi với DB thật, rồi `DROP DATABASE app1_db_test`. Ghi kết quả vào 1 file log ngắn (`restore-test.log`) để biết lần cuối test là khi nào.

## 17. Swap 4GB

```bash
swapon --show   # kiểm tra đã có swap chưa, tránh tạo trùng
sudo fallocate -l 4G /swapfile
sudo chmod 600 /swapfile
sudo mkswap /swapfile
sudo swapon /swapfile
grep -q '/swapfile' /etc/fstab || echo '/swapfile none swap sw 0 0' | sudo tee -a /etc/fstab
sudo sysctl vm.swappiness=10
sudo sysctl vm.vfs_cache_pressure=50
echo 'vm.swappiness=10' | sudo tee -a /etc/sysctl.conf
echo 'vm.vfs_cache_pressure=50' | sudo tee -a /etc/sysctl.conf
free -h
```
VPS này là Ceph (mạng), không phải NVMe cục bộ → swap nặng sẽ chậm hơn/tốn IO hơn bình thường. Coi swap là lưới an toàn cho spike ngắn, không phải bộ nhớ vận hành thường xuyên — nếu swap dùng liên tục nghĩa là đã đến lúc giảm app hoặc nâng RAM.

## 18. Lệnh theo dõi & xử lý sự cố

```bash
docker compose ps
docker compose logs --tail=200 <service>
docker stats
docker system df
df -h
free -h
journalctl -u vps-backup.service --since today
```

## 19. Checklist chống OOM

- [ ] Mọi container thường trực có `mem_limit`
- [ ] Tổng `mem_limit` ≤ 75-80% RAM (mục 2)
- [ ] Swap 4GB đã bật (mục 17)
- [ ] `work_mem` Postgres giữ thấp (8MB), không tăng bừa
- [ ] Mỗi app giới hạn số worker/thread (Next.js mặc định nhẹ, Python `--workers 1`)
- [ ] Backup không chạy song song với giờ cao điểm

## 20. Checklist bảo mật

- [ ] Root SSH tắt, chỉ vào bằng `dsquan` + SSH key (đã làm)
- [ ] UFW chỉ mở SSH + 80/443 (đã làm)
- [ ] Postgres không publish port ra host, không route Internet (`db-network internal: true`)
- [ ] Mỗi app 1 DB user riêng, không dùng superuser trong connection string app
- [ ] Backup dùng `backup_role` chỉ SELECT, không phải superuser
- [ ] Secrets nằm trong `.env` git-ignore, không hard-code trong compose/git
- [ ] `security_opt: no-new-privileges` + drop capability không cần thiết
- [ ] HSTS: chỉ bật sau khi HTTPS ổn định lâu dài, không bật `includeSubDomains`/`preload` mặc định

## 21. Nếu VPS gần hết RAM/đĩa — thứ tự giảm tải

1. Dọn image/log thừa (`docker image prune -f`, kiểm tra log rotation đang hoạt động)
2. Giảm `work_mem`/`max_connections` Postgres nếu đang cao hơn khuyến nghị
3. Tạm dừng app ít quan trọng nhất / traffic thấp nhất trước
4. Giảm staging backup local, đẩy offsite thường xuyên hơn thay vì giữ nhiều bản
5. Nếu vẫn không đủ và đã có 5+ app production thật sự cần chạy đồng thời → nâng cấp gói VPS (RAM trước, đĩa sau), không cố nhồi thêm trên gói 4GB này
