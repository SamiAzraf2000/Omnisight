# OmniSight v2

React 19 / Vite workbench implementing the provided mission-control design, Embla continuous task rail, file upload, statistics, anomaly screening, and Plotly 2D/3D visualization. Desktop fills the viewport; below 900px the workspace scrolls. Keyboard focus, native modal dialogs, and reduced-motion preferences are supported.

## Run the frontend

```sh
npm install
npm run dev
```

Select a task, choose a CSV, JSON, XLSX, or Parquet file (20 MB maximum), and Execute. “Try sample” analyzes a deterministic synthetic dataset. The three controls under the visualization switch between chart, statistics, and brief. The brief includes export of cleaned data. Initial telemetry is synthetic, not connected to a live production cluster. The workspace URI and profile are display content from the supplied specification.

Browser mode is the default, including the hosted static deployment. Uploads stay in browser memory. Statistics run on all rows; plots display up to 10,000 rows. JSON accepts row objects in an array or a `data` array. XLSX uses its first sheet. Missing numeric values use column medians, categorical values use “Unknown,” and exact duplicate rows are removed. Outliers are flagged before imputation using 1.5 × IQR or absolute Z-score > 3. Summaries in browser mode are deterministic statistical briefs, not LLM output. Very wide or large datasets can take time on the browser main thread.

## Optional FastAPI / Gemini / PostgreSQL backend

Requires Python 3.11+:

```sh
python -m venv .venv
# Activate the virtual environment for your shell, then:
pip install -r backend/requirements.txt
# Copy .env.example to .env and set VITE_API_URL=http://127.0.0.1:8000
uvicorn backend.app:app --host 127.0.0.1 --port 8000
```

Start Vite in a second terminal. Restart it after changing environment variables. `POST /api/analyze` accepts multipart fields `file` and `task`, returns the requested status/stats/anomalies/chart_json/ai_summary contract, plus source metadata and cleaned rows. `GET /api/health` checks backend readiness.

Set `DATABASE_URL` to a PostgreSQL SQLAlchemy URL to persist run metadata there. SQLite is the local development default. Uploaded files are buffered in temporary storage and removed after processing. Set `GEMINI_API_KEY` and `GEMINI_MODEL` on the backend to enable the structured JSON brief. Only aggregate profiles and anomaly counts are sent to Gemini, never the uploaded file. If Gemini is not configured or fails, the response explicitly identifies its statistical fallback. Protect the backend with authentication before exposing it publicly; the supplied service is intended for local use. Do not put server secrets in VITE_ variables.

The Sites deployment hosts the frontend only; FastAPI and PostgreSQL require a separate Python-capable host. Configure its HTTPS URL at build time using VITE_API_URL and allow the frontend origin through ALLOWED_ORIGINS.

## Build

```sh
npm run build
```

The deployable frontend is emitted to `dist/`. Source dependencies are locked in `package-lock.json` after installation.

If native build subprocesses are restricted, `node build-portable.mjs` builds the same app with Rollup and Babel in one process. Preview the included build with `python -m http.server 5173 --bind 127.0.0.1 --directory dist`, then open http://127.0.0.1:5173.

Validation performed: portable production build; browser rendering and sample analysis; numeric median imputation, duplicate removal, IQR flags, CSV parsing and all five task outputs; backend Python syntax. The backend's external services require your environment configuration and have not been integration-tested against Gemini or PostgreSQL.
