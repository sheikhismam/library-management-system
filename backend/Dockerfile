# Backend image: Django + gunicorn
FROM python:3.12-slim

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1

WORKDIR /app

# System deps needed by Pillow / reportlab / mysqlclient at runtime
RUN apt-get update \
    && apt-get install -y --no-install-recommends \
        libjpeg62-turbo \
        zlib1g \
    && rm -rf /var/lib/apt/lists/*

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY . .

# gunicorn runs the WSGI app (library_project.wsgi.application)
# collectstatic writes into the shared staticfiles volume served by nginx.
EXPOSE 8000
CMD ["sh", "-c", "python manage.py collectstatic --noinput && python manage.py migrate && gunicorn library_project.wsgi:application --bind 0.0.0.0:8000 --workers 3"]
