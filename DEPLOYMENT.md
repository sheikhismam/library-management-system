# Deployment Guide — Library Management System (LMS)

Single React (Vite) frontend + Django REST backend + MySQL.
The database is **MySQL** (not SQLite). Full-featured demo data can be recreated
with the built-in `seed_data` command.

---

## 1. Architecture (recommended: one public URL)

A single-URL stack is simplest for a client demo:

```
Browser ── https://PUBLIC-DOMAIN/
   │
   ├── /          → React SPA (nginx, with SPA fallback)
   ├── /api/v1/*  → nginx → Django/gunicorn (proxy)
   ├── /media/*   → nginx serves uploaded media from a persistent volume
   └── /static/*  → nginx serves collected Django static
```

This is provided as `docker-compose.yml` (nginx + Django/gunicorn + MySQL 8).
MySQL data and uploaded media live in **named volumes**, so they persist across
redeploys/restarts (important: uploaded book covers, member photos, QR codes
are NOT lost).

### Why not SQLite / other backends
The app is configured for MySQL (`settings.py` `DATABASES`). Do **not** swap the
engine just to deploy — use MySQL. Repro demo data with `seed_data` rather than
up-loading a local dump (clean, idempotent).

---

## 2. Environment variables (required)

### Backend — set these (Django reads them from `backend/.env` or provider env):
| Variable | Example | Required |
|---|---|---|
| `DEBUG` | `False` | yes (must be False in prod) |
| `DJANGO_SECRET_KEY` | long random (see below) | yes |
| `DJANGO_ALLOWED_HOSTS` | `mylibrary.example.com` | yes |
| `DJANGO_CSRF_TRUSTED_ORIGINS` | `https://mylibrary.example.com` | yes (Django admin / session) |
| `DJANGO_CORS_ALLOWED_ORIGINS` | `https://mylibrary.example.com` | when SPA origin != API origin |
| `DB_NAME` | `library_db` | yes |
| `DB_USER` | `library_user` | yes |
| `DB_PASSWORD` | strong value | yes |
| `DB_HOST` | `db` (compose) / provider host | yes |
| `DB_PORT` | `3306` | yes |

Generate a secret key:
```
python -c "from django.core.management.utils import get_random_secret_key; print(get_random_secret_key())"
```

Templates: `backend/.env.example`, `backend/.env.production.example`.

### Frontend — build-time (must be set when the bundle is built):
| Variable | Example | Required |
|---|---|---|
| `VITE_API_URL` | `https://mylibrary.example.com` | **yes** — otherwise the bundle hard-codes `http://127.0.0.1:8000` and will not work publicly |

`VITE_API_URL` is the **base origin** (no trailing slash, no `/api`). All API
calls go to `{VITE_API_URL}/api/v1/...`. For a single-URL deploy set it to the
public site origin. Template: `frontend/.env.production.example`.

> Nothing ever lives in the image file system from the checked-out code; secrets
> are supplied via environment variables only. `.env` files are git-ignored.

---

## 3. Deploy with Docker Compose (simplest single URL)

```bash
# 1. Create a real backend/.env (copy .env.production.example and fill values)
cp backend/.env.production.example backend/.env
#   ... edit backend/.env with real secrets/host ...

# 2. Build (bake the public origin into the SPA)
docker compose build --build-arg VITE_API_URL=https://PUBLIC-DOMAIN frontend
docker compose build backend

# 3. Start
docker compose up -d

# 4. Load demo data (safe, idempotent, creates admin/loginable members)
docker compose exec backend python manage.py seed_data

# 5. Point DNS / set the server IP. Verify:
curl https://PUBLIC-DOMAIN/api/v1/health/
```

First-run data is otherwise applied automatically via `migrate` in the backend
entrypoint; `seed_data` is only needed for demo content.

Direct browser navigation / refresh of `/dashboard`, `/books`, `/members`,
`/circulation`, `/reports`, `/guide`, etc. works because nginx falls back to
`index.html` for any non-`/api`/`/media`/`/static` path (SPA fallback).

---

## 4. Manual alternative (Render / Railway + a static host)

Frontend and backend may live on different hosts. This is acceptable — configure
them and use the resulting URLs:

- **Backend** (Render/Railway): set the env vars from §2, `DEBUG=False`,
  `DB_HOST` = provider DB, run `migrate` then `seed_data`. Ensure the host
  serves `/media/` (use persistent disk or object storage — do NOT rely on an
  ephemeral filesystem) and `/static/` (run `collectstatic`).
- **Frontend** (Netlify/Vercel/Cloudflare Pages): build with
  `VITE_API_URL=https://BACKEND-URL`, and add SPA fallback:
  - Netlify: `_redirects` → `/* /index.html 200`
  - Vercel: `vercel.json` → `{ "rewrites": [{ "source": "/(.*)", "destination": "/index.html" }] }`

Resulting URLs: frontend at `https://FRONTEND-URL`, API at
`https://BACKEND-URL/api/v1/`.

---

## 5. Media & static files
- **Media** (`/media/`): uploaded book covers, member photos, QR codes. On an
  ephemeral filesystem these are lost on redeploy. The Docker stack stores them
  in a **named volume** (persists). On a PaaS, attach persistent disk or object
  storage. QR codes regenerate automatically on save; uploaded images do not.
- **Static** (`/static/`): run `python manage.py collectstatic --noinput`
  (`STATIC_ROOT=backend/staticfiles`). In Docker this is collected at startup.

## 6. Demo / admin logins (created by `seed_data`)
- **Admin:** username `admin`, password `admin123` (superuser). Change it after
  first login via the Change Password feature.
- **Members:** `john.smith@library.local` … `emma.moore@library.local` (8 members,
  `MEM-2026-100` … `MEM-2026-107`) are created for demo circulation flows.

`seed_data.py` (`apps/reports/management/commands/seed_data.py`) is idempotent
and adds books, categories, authors, members, borrowings, fines, reservations,
reviews, and the admin user.

---

## 7. Production verification
```bash
cd backend
python manage.py check
python manage.py check --deploy
python manage.py test
pytest -q
```
```bash
cd frontend
VITE_API_URL=https://PUBLIC-DOMAIN npm run build   # ensures no 127.0.0.1 in bundle
grep -r "127.0.0.1:8000" dist/ && echo "BAD: localhost leaked" || echo "OK"
```
```
