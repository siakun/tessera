# Stage 1: React 빌드
FROM node:22-slim AS frontend
ARG COMMIT_SHA=unknown
WORKDIR /frontend
COPY frontend/package*.json ./
RUN npm ci
COPY frontend/ ./
RUN COMMIT_SHA=${COMMIT_SHA} npx vite build --outDir /frontend/dist

# Stage 2: Python 런타임
FROM python:3.12-slim
WORKDIR /app
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt
COPY backend/ ./backend/
# React 빌드 결과물 덮어쓰기
COPY --from=frontend /frontend/dist/ ./backend/static/
EXPOSE 8000
CMD ["uvicorn", "backend.main:app", "--host", "0.0.0.0", "--port", "8000"]
