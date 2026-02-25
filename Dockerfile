# ─────────────────────────────────────────────────────────
# Stage 1 – Build the React/Vite frontend
# ─────────────────────────────────────────────────────────
FROM node:20-alpine AS frontend-builder

WORKDIR /app/Frontend

# Build-time env injection (base path and API URL for hosted environments)
ARG BASE_PATH=""
ARG VITE_API_BASE_URL=""

# Install dependencies
COPY Frontend/package*.json ./
RUN npm ci

# Copy source and build
COPY Frontend/ ./

# Write env vars to .env file so Vite picks them up at build time
# This overwrites the default .env from the repo
RUN echo "VITE_API_BASE_URL=${VITE_API_BASE_URL}" > .env && \
    echo "VITE_BASE_PATH=${BASE_PATH}" >> .env && \
    cat .env

RUN npm run build


# ─────────────────────────────────────────────────────────
# Stage 2 – Python backend + bundled frontend
# ─────────────────────────────────────────────────────────
FROM python:3.11-slim

# System dependencies (tesseract for pytesseract, poppler for pdfplumber)
RUN apt-get update && apt-get install -y --no-install-recommends \
    tesseract-ocr \
    poppler-utils \
    libpq-dev \
    gcc \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Install Python dependencies
COPY Backend/requirements.txt ./
RUN pip install --no-cache-dir -r requirements.txt

# Copy backend source
COPY Backend/ ./Backend/

# Copy built frontend into expected path
COPY --from=frontend-builder /app/Frontend/dist ./Frontend/dist

# Set env defaults (overridden at runtime via --env-file or -e flags)
ENV PYTHONUNBUFFERED=1 \
    SERVE_FRONTEND=1 \
    API_HOST=0.0.0.0 \
    API_PORT=8000

WORKDIR /app/Backend

EXPOSE 8000

CMD ["python", "api_server.py"]
