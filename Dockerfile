FROM python:3.12-slim

WORKDIR /app

RUN sed -i 's|http://deb.debian.org|https://mirrors.aliyun.com|g' /etc/apt/sources.list.d/debian.sources \
    && sed -i 's|http://security.debian.org|https://mirrors.aliyun.com|g' /etc/apt/sources.list.d/debian.sources

RUN apt-get update && apt-get install -y --no-install-recommends \
    ffmpeg \
    libcairo2-dev \
    libpango1.0-dev \
    pkg-config \
    build-essential \
    && rm -rf /var/lib/apt/lists/* \
    && groupadd --gid 10001 mathinsight \
    && useradd --uid 10001 --gid mathinsight --home-dir /app --create-home mathinsight

COPY backend/requirements.txt .
RUN pip install --no-cache-dir -i https://mirrors.aliyun.com/pypi/simple/ -r requirements.txt gunicorn

COPY backend/ .
RUN mkdir -p /app/downloads/.cache /app/data \
    && chown -R mathinsight:mathinsight /app/downloads /app/data /app

ENV FLASK_DEBUG=false \
    PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    HOME=/app \
    XDG_CACHE_HOME=/app/downloads/.cache

USER mathinsight

EXPOSE 5001

HEALTHCHECK --interval=30s --timeout=5s --start-period=30s --retries=3 \
    CMD ["python", "-c", "import urllib.request; urllib.request.urlopen('http://127.0.0.1:5001/api/health', timeout=3)"]

CMD ["gunicorn", "--bind", "0.0.0.0:5001", "--workers", "1", "--timeout", "300", "app:create_app()"]
