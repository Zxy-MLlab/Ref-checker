from __future__ import annotations

import os
import threading
from dataclasses import asdict
from typing import Any, Dict, List, Optional

from pathlib import Path

from fastapi import Body, FastAPI, File, Form, HTTPException, UploadFile
from fastapi.responses import FileResponse, Response
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel, Field, ValidationError

from reference_backend import (
    AnalysisConfig,
    JobStore,
    SUPPORTED_SOURCES,
    apply_bib_correction,
    build_source_options,
    detect_duplicates,
    load_entries_from_bib_text,
    run_job,
    serialize_bib_entry,
    serialize_config,
)

DEFAULT_JOB_STORE_DIR = os.environ.get("REFCHECK_JOB_STORE_DIR", ".job_store")
DEFAULT_CACHE_PATH = os.environ.get("REFCHECK_CACHE_PATH", ".api_refcheck_cache.json")
MAX_UPLOAD_BYTES = int(os.environ.get("REFCHECK_MAX_UPLOAD_BYTES", str(10 * 1024 * 1024)))

app = FastAPI(title="Ref. Checker API", version="0.1.0")
JOB_STORE = JobStore(DEFAULT_JOB_STORE_DIR)
FRONTEND_DIR = Path(__file__).resolve().parent / "frontend"


class SourceOptionPayload(BaseModel):
    name: str = Field(description="arxiv, serpapi, scholar-html, crossref, openalex")
    enabled: bool = True
    api_key: str = ""
    proxy: str = ""
    extra: Dict[str, Any] = Field(default_factory=dict)


class AnalyzeOptionsPayload(BaseModel):
    source_order: List[SourceOptionPayload] = Field(default_factory=list)
    delay: float = 2.0
    jitter: float = 1.0
    timeout: float = 15.0
    retries: int = 0
    retry_backoff: float = 0.5
    num_results: int = 8
    year_window: int = 1
    title_threshold: float = 0.92
    loose_title_threshold: float = 0.84
    venue_threshold: float = 0.72
    min_author_overlap: int = 1
    author_check_count: int = 3
    no_author_in_query: bool = False
    skip_url_check: bool = False
    cache_path: str = DEFAULT_CACHE_PATH
    include_missing_title: bool = False
    verbose: bool = False


class ApplyCorrectionPayload(BaseModel):
    key: str
    bib_text: str


def parse_options(options_json: Optional[str]) -> AnalyzeOptionsPayload:
    if not options_json:
        return AnalyzeOptionsPayload()
    try:
        return AnalyzeOptionsPayload.model_validate_json(options_json)
    except ValidationError as exc:
        raise HTTPException(status_code=422, detail=exc.errors()) from exc


def build_config(payload: AnalyzeOptionsPayload) -> AnalysisConfig:
    try:
        return AnalysisConfig(
            source_order=build_source_options([item.model_dump() for item in payload.source_order]),
            delay=payload.delay,
            jitter=payload.jitter,
            timeout=payload.timeout,
            retries=payload.retries,
            retry_backoff=payload.retry_backoff,
            num_results=payload.num_results,
            year_window=payload.year_window,
            title_threshold=payload.title_threshold,
            loose_title_threshold=payload.loose_title_threshold,
            venue_threshold=payload.venue_threshold,
            min_author_overlap=payload.min_author_overlap,
            author_check_count=payload.author_check_count,
            no_author_in_query=payload.no_author_in_query,
            skip_url_check=payload.skip_url_check,
            cache_path=payload.cache_path,
            include_missing_title=payload.include_missing_title,
            verbose=payload.verbose,
        )
    except ValueError as exc:
        raise HTTPException(status_code=422, detail=str(exc)) from exc


async def read_bib_upload(file: UploadFile) -> str:
    if not file.filename or not file.filename.endswith(".bib"):
        raise HTTPException(status_code=400, detail="Only .bib files are supported.")
    raw = await file.read()
    if len(raw) > MAX_UPLOAD_BYTES:
        raise HTTPException(status_code=413, detail="Uploaded .bib file is too large.")
    return raw.decode("utf-8", errors="replace")


@app.get("/health")
def health() -> Dict[str, str]:
    return {"status": "ok"}


@app.get("/", include_in_schema=False)
def index() -> FileResponse:
    return FileResponse(FRONTEND_DIR / "index.html")


@app.get("/api/v1/sources")
def list_sources() -> Dict[str, Any]:
    return {
        "sources": [
            {
                "name": name,
                "supports_api_key": name == "serpapi",
                "supports_proxy": name in {"serpapi", "scholar-html"},
            }
            for name in sorted(SUPPORTED_SOURCES)
        ]
    }


@app.post("/api/v1/bib/parse")
async def parse_bib(
    file: UploadFile = File(...),
) -> Dict[str, Any]:
    text = await read_bib_upload(file)
    entries = load_entries_from_bib_text(text, include_missing_title=True)
    duplicates = detect_duplicates(entries)
    return {
        "filename": file.filename,
        "entry_count": len(entries),
        "entries": [serialize_bib_entry(entry) for entry in entries],
        "duplicates": [asdict(group) for group in duplicates],
    }


@app.post("/api/v1/jobs")
async def create_job(
    file: UploadFile = File(...),
    options_json: str = Form(default=""),
) -> Dict[str, Any]:
    options = parse_options(options_json)
    config = build_config(options)
    text = await read_bib_upload(file)
    job = JOB_STORE.create(file.filename, config, text)
    worker = threading.Thread(target=run_job, args=(JOB_STORE, job.job_id, text), daemon=True)
    worker.start()
    return {
        "job_id": job.job_id,
        "status": job.status,
        "filename": job.filename,
        "config": serialize_config(config),
    }


@app.get("/api/v1/jobs")
def list_jobs() -> Dict[str, Any]:
    jobs = JOB_STORE.list()
    return {
        "jobs": [
            {
                "job_id": job.job_id,
                "filename": job.filename,
                "status": job.status,
                "created_at": job.created_at,
                "updated_at": job.updated_at,
                "has_result": job.output is not None,
                "total_entries": job.total_entries,
                "processed_entries": job.processed_entries,
                "progress": job.progress,
                "progress_message": job.progress_message,
            }
            for job in jobs
        ]
    }


@app.get("/api/v1/jobs/{job_id}")
def get_job(job_id: str) -> Dict[str, Any]:
    job = JOB_STORE.get(job_id)
    if not job:
        raise HTTPException(status_code=404, detail="Job not found.")
    parsed_entries: List[Dict[str, Any]] = []
    duplicate_groups: List[Dict[str, Any]] = []
    try:
        original_text = JOB_STORE.read_original_bib(job_id)
        parsed = load_entries_from_bib_text(original_text, include_missing_title=True)
        parsed_entries = [serialize_bib_entry(entry) for entry in parsed]
        duplicate_groups = [asdict(x) for x in detect_duplicates(parsed)]
    except FileNotFoundError:
        parsed_entries = []
        duplicate_groups = []
    return {
        "job_id": job.job_id,
        "filename": job.filename,
        "status": job.status,
        "created_at": job.created_at,
        "updated_at": job.updated_at,
        "error": job.error,
        "total_entries": job.total_entries,
        "processed_entries": job.processed_entries,
        "progress": job.progress,
        "progress_message": job.progress_message,
        "config": serialize_config(job.config),
        "parsed_entries": parsed_entries,
        "duplicates": duplicate_groups,
        "result": None
        if job.output is None
        else {
            "summary": asdict(job.output.summary),
            "duplicates": [asdict(x) for x in job.output.duplicates],
            "entries": job.output.entries,
        },
    }


@app.post("/api/v1/jobs/{job_id}/apply-correction")
def apply_correction(job_id: str, payload: ApplyCorrectionPayload = Body(...)) -> Dict[str, Any]:
    job = JOB_STORE.get(job_id)
    if not job:
        raise HTTPException(status_code=404, detail="Job not found.")
    try:
        apply_bib_correction(JOB_STORE, job_id, payload.key, payload.bib_text)
    except KeyError as exc:
        raise HTTPException(status_code=404, detail=f"Bib entry not found: {payload.key}") from exc
    return {"ok": True, "job_id": job_id, "key": payload.key}


@app.get("/api/v1/jobs/{job_id}/report.json")
def download_json(job_id: str) -> Response:
    job = JOB_STORE.get(job_id)
    if not job or job.output is None:
        raise HTTPException(status_code=404, detail="Completed job not found.")
    return Response(job.output.to_json_bytes(), media_type="application/json")


@app.get("/api/v1/jobs/{job_id}/report.csv")
def download_csv(job_id: str) -> Response:
    job = JOB_STORE.get(job_id)
    if not job or job.output is None:
        raise HTTPException(status_code=404, detail="Completed job not found.")
    return Response(
        job.output.to_csv_bytes(),
        media_type="text/csv; charset=utf-8",
        headers={"Content-Disposition": f'attachment; filename="{job_id}.csv"'},
    )


@app.get("/api/v1/jobs/{job_id}/report.xlsx")
def download_xlsx(job_id: str) -> Response:
    job = JOB_STORE.get(job_id)
    if not job or job.output is None:
        raise HTTPException(status_code=404, detail="Completed job not found.")
    return Response(
        job.output.to_xlsx_bytes(),
        media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        headers={"Content-Disposition": f'attachment; filename="{job_id}.xlsx"'},
    )


@app.get("/api/v1/jobs/{job_id}/modified.bib")
def download_modified_bib(job_id: str) -> Response:
    job = JOB_STORE.get(job_id)
    if not job:
        raise HTTPException(status_code=404, detail="Job not found.")
    try:
        content = JOB_STORE.read_modified_bib(job_id)
    except FileNotFoundError as exc:
        raise HTTPException(status_code=404, detail="Modified bib not found.") from exc
    return Response(
        content.encode("utf-8"),
        media_type="application/x-bibtex; charset=utf-8",
        headers={"Content-Disposition": f'attachment; filename="{job.filename or job_id}.modified.bib"'},
    )


app.mount("/assets", StaticFiles(directory=FRONTEND_DIR), name="frontend-assets")
