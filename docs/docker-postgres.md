# Docker PostgreSQL (Local)

## 1) Siapkan env

- Buat file `.env.docker` lalu isi `POSTGRES_DB`, `POSTGRES_USER`, `POSTGRES_PASSWORD` (atau gunakan yang sudah ada).
- Pastikan `.env` aplikasi memakai `DATABASE_URL` yang sesuai.

## 2) Jalankan database

```bash
docker compose --env-file .env.docker up -d
```

Jika muncul error konflik nama container, pastikan `docker-compose.yml` tidak memaksa `container_name` atau hapus container lama terlebih dulu.

Cek container:

```bash
docker ps
```

## 3) Apply schema Prisma

```bash
npx prisma migrate dev
```

Atau jika hanya ingin menjalankan migrasi yang sudah ada (tanpa membuat migration baru):

```bash
npx prisma migrate deploy
```

## 4) Migrasi data dari DB lama (opsional)

Backup (dari database lama):

```bash
pg_dump -Fc -h localhost -U postgres sarakan_app > backup.dump
```

Restore (ke postgres docker):

```bash
pg_restore -h localhost -U postgres -d sarakan_app backup.dump
```
