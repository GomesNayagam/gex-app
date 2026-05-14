#!/usr/bin/env bash
# start.sh — launch backend and frontend concurrently
set -e

echo "🚀 Starting GEX Dashboard..."

# Backend (run from repo root so 'backend' package is importable)
(
  cd "$(dirname "$0")"
  echo "→ Starting FastAPI on :8000"
  uv run uvicorn backend.main:app --reload --port 8000
) &

# Frontend
(
  cd "$(dirname "$0")/frontend"
  echo "→ Installing frontend deps..."
  npm install --silent
  echo "→ Starting React on :3000"
  npm run dev
) &

wait
