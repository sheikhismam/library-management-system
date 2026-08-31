#!/bin/sh
# ============================================================================
# Railway entrypoint for the single-service LMS container.
# 1. Bake $PORT into the nginx config.
# 2. Ensure media/static directories exist.
# 3. Apply Django migrations.
# 4. Collect static files.
# 5. Start gunicorn (backend) on 127.0.0.1:8000.
# 6. Start nginx in the foreground (serves SPA, proxies /api and /admin).
# ============================================================================
set -e

: "${PORT:=8080}"

echo "==> nginx will listen on port $PORT"
if [ -f /etc/nginx/conf.d/default.conf ]; then
    sed -i "s/__PORT__/$PORT/g" /etc/nginx/conf.d/default.conf
fi

echo "==> Ensuring media/static directories exist"
mkdir -p /app/media /app/staticfiles

echo "==> Applying Django migrations"
python /app/manage.py migrate --noinput

if [ "${RUN_SEED:-0}" = "1" ]; then
    echo "==> Seeding demo data (RUN_SEED=1)"
    python /app/manage.py seed_data
fi

echo "==> Collecting Django static files"
python /app/manage.py collectstatic --noinput

echo "==> Starting gunicorn on 127.0.0.1:8000"
gunicorn library_project.wsgi:application \
    --chdir /app \
    --bind 127.0.0.1:8000 \
    --workers 2 \
    --threads 2 \
    --timeout 60 \
    --access-logfile - \
    --error-logfile - &
GUNICORN_PID=$!

# Give gunicorn a moment to bind before nginx starts proxying to it.
sleep 3

echo "==> Starting nginx (pid=$$)"
nginx -g 'daemon off;'