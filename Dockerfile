# ============================================================================
# Railway single-service image:
#   nginx (serves React SPA, static, media; proxies /api and /admin)
#   + Django/gunicorn (backend)
# ONE Railway service, ONE public HTTPS URL. No app code changes.
# ============================================================================

# --- Stage 1: build the React/Vite SPA ----------------------------------
FROM node:22-alpine AS frontend-build
WORKDIR /app/frontend
COPY frontend/package*.json ./
RUN npm ci
COPY frontend/ .
ARG VITE_API_URL=http://localhost
ENV VITE_API_URL=$VITE_API_URL
RUN npm run build

# --- Stage 2: runtime (Python + nginx + backend) ------------------------
FROM python:3.12-slim
ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1

RUN apt-get update \
    && apt-get install -y --no-install-recommends nginx procps \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

COPY backend/requirements.txt /app/requirements.txt
RUN pip install --no-cache-dir -r /app/requirements.txt

# Backend source (manage.py lands at /app/manage.py)
COPY backend/ /app/

# Built SPA -> nginx webroot
COPY --from=frontend-build /app/frontend/dist/ /usr/share/nginx/html/

# nginx config (__PORT__ placeholder is filled by the entrypoint)
COPY deploy/nginx.conf /etc/nginx/conf.d/default.conf
COPY deploy/railway-entrypoint.sh /railway-entrypoint.sh
RUN chmod +x /railway-entrypoint.sh

# Railway routes to this port (overridden by the $PORT env var at runtime)
EXPOSE 8080
CMD ["/railway-entrypoint.sh"]