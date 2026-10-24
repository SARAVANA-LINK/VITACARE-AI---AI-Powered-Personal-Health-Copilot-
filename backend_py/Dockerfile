# ==============================================================================
# Multi-Stage Production Dockerfile for VitaCare AI FastAPI Backend
# ==============================================================================

FROM python:3.13-slim AS builder

WORKDIR /build

RUN apt-get update && apt-get install -y --no-install-recommends \
    build-essential \
    libpq-dev \
    curl \
    && rm -rf /var/lib/apt/lists/*

COPY requirements.txt .
RUN pip install --no-cache-dir --user -r requirements.txt

# Final Runtime Image
FROM python:3.13-slim AS runner

WORKDIR /app

# Install runtime dependencies for PostgreSQL and healthchecks
RUN apt-get update && apt-get install -y --no-install-recommends \
    libpq5 \
    curl \
    && rm -rf /var/lib/apt/lists/*

# Copy installed Python packages from builder
COPY --from=builder /root/.local /root/.local
ENV PATH=/root/.local/bin:$PATH

# Create non-privileged service user
RUN groupadd -g 1001 vitacare && \
    useradd -u 1001 -g vitacare -s /bin/bash -m vitacare

# Copy application source code
COPY --chown=vitacare:vitacare . .

# Create uploads directory with correct permissions
RUN mkdir -p /app/uploads && chown -R vitacare:vitacare /app/uploads

USER vitacare

EXPOSE 8000

HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
    CMD curl -f http://localhost:8000/health || exit 1

CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000", "--workers", "4"]
