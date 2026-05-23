# Ref. Checker

Ref. Checker is a no-LLM reference verification tool for `.bib` files. It parses BibTeX entries, classifies references, validates them against configured sources, detects duplicates, and serves a web UI for review, correction, and export.

## Features

- Parse `.bib` files into structured metadata
- Classify entries into `paper`, `GitHub`, and `blog`
- Validate papers with configurable search sources:
  - `arxiv`
  - `crossref`
  - `openalex`
  - `serpapi`
  - `scholar-html`
- Validate `GitHub` / `blog` entries through URL reachability
- Detect duplicate references by DOI / arXiv ID / normalized title + year
- Review results in a web UI with Chinese / English toggle
- Export:
  - simplified Excel report
  - JSON report
  - corrected `.bib`

## Project Structure

```text
.
├── backend_api.py           # FastAPI entrypoint
├── bib_ref_checker.py       # BibTeX parsing, search adapters, rule-based matching
├── reference_backend.py     # Job store, async analysis, exports, correction workflow
├── frontend/                # Static frontend
├── requirements.txt         # Python runtime dependencies
├── environment.yml          # Conda environment file
├── Dockerfile               # Container image
├── docker-compose.yml       # One-command deployment
└── .env.example             # Environment variable template
```

## One-Command Deployment

### Option A: Docker Compose

This is the recommended way to let other people install and run the project quickly.

1. Copy the environment template:

```bash
cp .env.example .env
```

2. Start the service:

```bash
docker compose up --build
```

3. Open:

```text
http://127.0.0.1:8000
```

## Local Development

### Option B: Conda

```bash
conda env create -f environment.yml
conda activate ref-check
uvicorn backend_api:app --host 0.0.0.0 --port 8000 --reload
```

### Option C: pip

```bash
python3 -m pip install -r requirements.txt
uvicorn backend_api:app --host 0.0.0.0 --port 8000 --reload
```

## Environment Variables

Copy `.env.example` to `.env` before deployment.

| Variable | Default | Description |
|---|---:|---|
| `APP_PORT` | `8000` | Host port for Docker Compose |
| `REFCHECK_MAX_UPLOAD_BYTES` | `10485760` | Max upload size in bytes |
| `SERPAPI_API_KEY` | empty | Optional SerpApi key |
| `HTTP_PROXY` | empty | Optional outbound proxy |
| `HTTPS_PROXY` | empty | Optional outbound proxy |

Internally, the service also uses:

- `REFCHECK_JOB_STORE_DIR`
- `REFCHECK_CACHE_PATH`

These are already set by `docker-compose.yml`.

## Default Search Source Behavior

The frontend exposes these sources:

- `arxiv`
- `crossref`
- `openalex`
- `serpapi`
- `scholar-html`

Default enabled behavior in the UI:

- enabled: `arxiv`, `crossref`, `openalex`, `serpapi`
- disabled: `scholar-html`

If the user enables only one source, the backend respects that selection and validates papers only with the chosen source(s).

## Web API

Main endpoints:

- `GET /health`
- `GET /api/v1/sources`
- `POST /api/v1/bib/parse`
- `POST /api/v1/jobs`
- `GET /api/v1/jobs`
- `GET /api/v1/jobs/{job_id}`
- `POST /api/v1/jobs/{job_id}/apply-correction`
- `GET /api/v1/jobs/{job_id}/report.json`
- `GET /api/v1/jobs/{job_id}/report.csv`
- `GET /api/v1/jobs/{job_id}/report.xlsx`
- `GET /api/v1/jobs/{job_id}/modified.bib`

## Deployment Notes

- `.job_store/` and cache files are ignored by Git and should not be committed
- Docker Compose persists runtime data in the `refcheck_data` volume
- For GitHub publication, keep only source code, docs, and example data you intentionally want to share

## Quick Commands

If you prefer `make`:

```bash
make install
make dev
make docker-up
```
