#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Rule-based BibTeX reference checker.

No AI / No LLM. The checker parses .bib metadata deterministically, queries
Google Scholar, and validates title, authors, year, venue, DOI/arXiv/URL with
explicit rule scores.

Install:
    pip install -r requirements.txt

Typical production run, Google Scholar only:
    python bib_ref_checker.py --bib main.bib --backend auto --out report.csv --json-out report.json

Google Scholar through SerpApi:
    export SERPAPI_API_KEY="..."
    python bib_ref_checker.py --bib main.bib --backend serpapi --out report.csv

Direct Google Scholar HTML with proxy, slow and fragile:
    python bib_ref_checker.py --bib main.bib --backend scholar-html --proxy http://127.0.0.1:7890 --delay 10
"""

from __future__ import annotations

import argparse
import csv
import hashlib
import html
import json
import os
import random
import re
import sys
import time
import unicodedata
import xml.etree.ElementTree as ET
from dataclasses import asdict, dataclass, field
from difflib import SequenceMatcher
from pathlib import Path
from typing import Any, Dict, Iterable, List, Optional, Tuple
from urllib.parse import quote, urlparse

try:
    import requests
    from bs4 import BeautifulSoup
    from requests.adapters import HTTPAdapter
    from urllib3.util.retry import Retry
except ModuleNotFoundError as exc:  # pragma: no cover - startup guard
    missing = exc.name or "required dependency"
    print(
        f"Missing dependency: {missing}. Install with: pip install -r requirements.txt",
        file=sys.stderr,
    )
    raise SystemExit(2)


ENTRY_START_RE = re.compile(r"@(?P<entry_type>[A-Za-z]+)\s*[{(]\s*(?P<key>[^,\s]+)\s*,", re.MULTILINE)
FIELD_NAME_RE = re.compile(r"[A-Za-z][A-Za-z0-9_-]*")
YEAR_RE = re.compile(r"\b(?:18|19|20|21)\d{2}\b")
DOI_RE = re.compile(r"\b10\.\d{4,9}/[-._;()/:A-Z0-9]+\b", re.IGNORECASE)
ARXIV_RE = re.compile(r"\b(?:arXiv:)?(\d{4}\.\d{4,5})(?:v\d+)?\b", re.IGNORECASE)


@dataclass
class BibEntry:
    entry_type: str
    key: str
    title: str
    authors: List[str]
    year: Optional[int]
    venue: str
    doi: str
    url: str
    arxiv_id: str
    publisher: str
    volume: str
    number: str
    pages: str
    raw_author: str
    fields: Dict[str, str]
    raw: str
    parse_warnings: List[str] = field(default_factory=list)


@dataclass
class SearchResult:
    source: str
    title: str = ""
    authors: List[str] = field(default_factory=list)
    year: Optional[int] = None
    venue: str = ""
    doi: str = ""
    url: str = ""
    arxiv_id: str = ""
    summary: str = ""


@dataclass
class CheckResult:
    key: str
    entry_type: str
    record_kind: str
    input_title: str
    input_year: Optional[int]
    input_authors: str
    input_venue: str
    input_doi: str
    input_url: str
    input_arxiv_id: str
    verdict: str
    exists: bool
    confidence: float
    title_score: float
    title_match: bool
    author_overlap: int
    author_match: bool
    year_delta: Optional[int]
    year_match: bool
    venue_score: float
    venue_match: bool
    doi_match: bool
    arxiv_match: bool
    url_ok: Optional[bool]
    matched_source: str
    matched_title: str
    matched_year: Optional[int]
    matched_authors: str
    matched_venue: str
    matched_doi: str
    matched_url: str
    backend: str
    issues: str
    reason: str


class JsonCache:
    def __init__(self, path: Optional[Path]):
        self.path = path
        self.data: Dict[str, Any] = {}
        if path and path.exists():
            try:
                self.data = json.loads(path.read_text(encoding="utf-8"))
            except json.JSONDecodeError:
                self.data = {}

    def key(self, namespace: str, payload: Dict[str, Any]) -> str:
        raw = json.dumps({"namespace": namespace, **payload}, ensure_ascii=False, sort_keys=True)
        return hashlib.sha256(raw.encode("utf-8")).hexdigest()

    def get(self, namespace: str, payload: Dict[str, Any]) -> Optional[Any]:
        return self.data.get(self.key(namespace, payload))

    def set(self, namespace: str, payload: Dict[str, Any], value: Any) -> None:
        self.data[self.key(namespace, payload)] = value
        if self.path:
            self.path.write_text(json.dumps(self.data, ensure_ascii=False, indent=2), encoding="utf-8")


# -----------------------------
# BibTeX parsing
# -----------------------------


def iter_bib_entries(text: str) -> Iterable[Tuple[str, str, str]]:
    pos = 0
    while True:
        m = ENTRY_START_RE.search(text, pos)
        if not m:
            break
        brace_pos = text.find("{", m.start(), m.end())
        paren_pos = text.find("(", m.start(), m.end())
        candidates = [p for p in (brace_pos, paren_pos) if p >= 0]
        if not candidates:
            pos = m.end()
            continue
        open_pos = min(candidates)
        opener = text[open_pos]
        closer = "}" if opener == "{" else ")"
        depth = 0
        in_quote = False
        escape = False
        end = None

        for i in range(open_pos, len(text)):
            ch = text[i]
            if escape:
                escape = False
                continue
            if ch == "\\":
                escape = True
                continue
            if ch == '"':
                in_quote = not in_quote
                continue
            if in_quote:
                continue
            if ch == opener:
                depth += 1
            elif ch == closer:
                depth -= 1
                if depth == 0:
                    end = i + 1
                    break
        if end is None:
            yield m.group("entry_type"), m.group("key"), text[m.start() :]
            break
        yield m.group("entry_type"), m.group("key"), text[m.start() : end]
        pos = end


def parse_fields(raw_entry: str) -> Dict[str, str]:
    comma = raw_entry.find(",")
    end = len(raw_entry) - 1 if raw_entry.rstrip().endswith(("}", ")")) else len(raw_entry)
    i = comma + 1
    fields: Dict[str, str] = {}

    while i < end:
        while i < end and raw_entry[i] in " \t\r\n,":
            i += 1
        name_match = FIELD_NAME_RE.match(raw_entry, i)
        if not name_match:
            i += 1
            continue
        name = name_match.group(0).lower()
        i = name_match.end()
        while i < end and raw_entry[i].isspace():
            i += 1
        if i >= end or raw_entry[i] != "=":
            continue
        i += 1
        value, i = parse_bib_value(raw_entry, i, end)
        fields[name] = clean_latex_text(value)
    return fields


def parse_bib_value(s: str, i: int, end: int) -> Tuple[str, int]:
    parts: List[str] = []
    while i < end:
        while i < end and s[i].isspace():
            i += 1
        if i >= end:
            break
        if s[i] == "{":
            value, i = scan_balanced(s, i, "{", "}")
        elif s[i] == '"':
            value, i = scan_quoted(s, i)
        else:
            start = i
            while i < end and s[i] not in ",#\n\r}":
                i += 1
            value = s[start:i].strip()
        parts.append(value)
        while i < end and s[i].isspace():
            i += 1
        if i < end and s[i] == "#":
            i += 1
            continue
        break
    while i < end and s[i] not in ",":
        if not s[i].isspace():
            break
        i += 1
    if i < end and s[i] == ",":
        i += 1
    return " ".join(p for p in parts if p), i


def scan_balanced(s: str, start: int, opener: str, closer: str) -> Tuple[str, int]:
    depth = 0
    escape = False
    for i in range(start, len(s)):
        ch = s[i]
        if escape:
            escape = False
            continue
        if ch == "\\":
            escape = True
            continue
        if ch == opener:
            depth += 1
        elif ch == closer:
            depth -= 1
            if depth == 0:
                return s[start + 1 : i], i + 1
    return s[start + 1 :], len(s)


def scan_quoted(s: str, start: int) -> Tuple[str, int]:
    out: List[str] = []
    escape = False
    for i in range(start + 1, len(s)):
        ch = s[i]
        if escape:
            out.append("\\" + ch)
            escape = False
            continue
        if ch == "\\":
            escape = True
            continue
        if ch == '"':
            return "".join(out), i + 1
        out.append(ch)
    return "".join(out), len(s)


LATEX_REPLACEMENTS = {
    r"\&": "&",
    r"\%": "%",
    r"\_": "_",
    r"\#": "#",
    r"---": "-",
    r"--": "-",
    r"\o": "o",
    r"\O": "O",
    r"\aa": "a",
    r"\AA": "A",
    r"\ae": "ae",
    r"\AE": "AE",
    r"\ss": "ss",
}


def clean_latex_text(s: str) -> str:
    if not s:
        return ""
    s = html.unescape(s)
    for old, new in LATEX_REPLACEMENTS.items():
        s = s.replace(old, new)
    s = re.sub(r"\\url\s*\{([^{}]+)\}", r"\1", s)
    s = re.sub(r"\\href\s*\{([^{}]+)\}\s*\{([^{}]+)\}", r"\2", s)
    s = re.sub(r"\\(?:['`^\"~=.]|u|H|r|v)\s*\{?([A-Za-z])\}?", r"\1", s)
    s = re.sub(r"\\c\s*\{?([A-Za-z])\}?", r"\1", s)
    s = re.sub(r"\\[A-Za-z]+\*?(?:\[[^\]]*\])?(?:\{([^{}]*)\})?", lambda m: m.group(1) or "", s)
    s = s.replace("{", "").replace("}", "")
    return re.sub(r"\s+", " ", s).strip()


def split_authors(raw_author: str) -> List[str]:
    if not raw_author:
        return []
    protected = raw_author.replace("{and}", "__AND__")
    parts = re.split(r"\s+and\s+", protected, flags=re.IGNORECASE)
    authors = []
    for part in parts:
        name = clean_latex_text(part.replace("__AND__", "and")).strip(" ,")
        if name and normalize_author_name(name) not in {"", "others"}:
            authors.append(name)
    return authors


def parse_year(value: str) -> Optional[int]:
    m = YEAR_RE.search(value or "")
    return int(m.group(0)) if m else None


def extract_doi(*values: str) -> str:
    for value in values:
        m = DOI_RE.search(value or "")
        if m:
            return m.group(0).rstrip(".,)")
    return ""


def extract_arxiv_id(*values: str) -> str:
    for value in values:
        m = ARXIV_RE.search(value or "")
        if m:
            return m.group(1)
    return ""


def parse_bibtex(text: str) -> List[BibEntry]:
    entries: List[BibEntry] = []
    for entry_type, key, raw in iter_bib_entries(text):
        fields = parse_fields(raw)
        title = fields.get("title", "")
        raw_author = fields.get("author", "")
        venue = fields.get("journal") or fields.get("booktitle") or fields.get("series") or fields.get("publisher", "")
        url = fields.get("url") or fields.get("howpublished", "")
        doi = extract_doi(fields.get("doi", ""), url, fields.get("note", ""))
        arxiv_id = fields.get("eprint", "") or extract_arxiv_id(fields.get("journal", ""), url, fields.get("note", ""))
        warnings = []
        if not title:
            warnings.append("missing_title")
        if not raw_author:
            warnings.append("missing_author")
        if not fields.get("year"):
            warnings.append("missing_year")
        entries.append(
            BibEntry(
                entry_type=entry_type.lower(),
                key=key,
                title=title,
                authors=split_authors(raw_author),
                year=parse_year(fields.get("year", "")),
                venue=venue,
                doi=doi.lower(),
                url=url,
                arxiv_id=arxiv_id,
                publisher=fields.get("publisher", ""),
                volume=fields.get("volume", ""),
                number=fields.get("number", ""),
                pages=fields.get("pages", ""),
                raw_author=raw_author,
                fields=fields,
                raw=raw,
                parse_warnings=warnings,
            )
        )
    return entries


# -----------------------------
# Normalization and scoring
# -----------------------------


def normalize_text(s: str) -> str:
    s = clean_latex_text(s).lower()
    s = unicodedata.normalize("NFKD", s).encode("ascii", "ignore").decode("ascii")
    s = re.sub(r"[^a-z0-9]+", " ", s)
    return re.sub(r"\s+", " ", s).strip()


def normalize_title(s: str) -> str:
    s = normalize_text(s)
    s = re.sub(r"\b(the|a|an)\b", " ", s)
    return re.sub(r"\s+", " ", s).strip()


def similarity(a: str, b: str) -> float:
    a2, b2 = normalize_text(a), normalize_text(b)
    if not a2 or not b2:
        return 0.0
    if a2 == b2:
        return 1.0
    return SequenceMatcher(None, a2, b2).ratio()


def title_similarity(a: str, b: str) -> float:
    a2, b2 = normalize_title(a), normalize_title(b)
    if not a2 or not b2:
        return 0.0
    if a2 == b2:
        return 1.0
    shorter, longer = sorted([a2, b2], key=len)
    if len(shorter) >= 20 and shorter in longer:
        return 0.96
    return SequenceMatcher(None, a2, b2).ratio()


def normalize_author_name(name: str) -> str:
    name = clean_latex_text(name).replace("’", "'").lower()
    name = unicodedata.normalize("NFKD", name).encode("ascii", "ignore").decode("ascii")
    name = re.sub(r"[^a-z\s,.-]", " ", name)
    name = re.sub(r"\s+", " ", name).strip(" ,.-")
    if not name or name in {"others", "et al", "et al."}:
        return ""
    if "," in name:
        last, first = [x.strip() for x in name.split(",", 1)]
        name = f"{first} {last}".strip()
    tokens = [t for t in re.split(r"\s+", name) if t and len(t) > 1]
    return tokens[-1] if tokens else ""


def author_overlap(a_authors: List[str], b_authors: List[str]) -> int:
    a = {normalize_author_name(x) for x in a_authors}
    b = {normalize_author_name(x) for x in b_authors}
    a.discard("")
    b.discard("")
    return len(a & b)


def parse_authors_from_summary(summary: str) -> List[str]:
    if not summary:
        return []
    left = re.split(r"\s+-\s+", summary, maxsplit=1)[0]
    left = re.sub(r"\.{2,}.*$", "", left)
    return [p.strip() for p in re.split(r",| and ", left) if p.strip()][:12]


def reference_category(entry: BibEntry) -> str:
    url = (entry.url or "").lower()
    host = urlparse(url).netloc.lower()
    academic_types = {"article", "inproceedings", "conference", "proceedings", "book", "incollection"}
    blog_types = {"online", "webpage", "blog", "misc"}

    if "github.com" in url or host.endswith("github.com"):
        return "github"
    if entry.doi or entry.arxiv_id or entry.entry_type in academic_types:
        return "paper"
    if url and entry.entry_type in blog_types:
        return "blog"
    if url and host and not any(domain in host for domain in ("doi.org", "arxiv.org")):
        return "blog"
    return "paper"


def record_kind(entry: BibEntry) -> str:
    category = reference_category(entry)
    if category == "paper":
        return "paper"
    if category == "github":
        return "github"
    return "blog"


# -----------------------------
# Network clients
# -----------------------------


class ReferenceSearcher:
    def __init__(self, args: argparse.Namespace):
        self.args = args
        self.cache = JsonCache(Path(args.cache) if args.cache else None)
        self.session = requests.Session()
        retries = Retry(
            total=args.retries,
            connect=args.retries,
            read=args.retries,
            status=args.retries,
            backoff_factor=args.retry_backoff,
            status_forcelist=(408, 425, 429, 500, 502, 503, 504),
            allowed_methods=("GET", "HEAD"),
        )
        adapter = HTTPAdapter(max_retries=retries, pool_connections=8, pool_maxsize=8)
        self.session.mount("http://", adapter)
        self.session.mount("https://", adapter)
        self.session.headers.update(
            {
                "User-Agent": args.user_agent
                or "Mozilla/5.0 (compatible; RuleBasedReferenceChecker/2.0; +https://example.local)",
                "Accept-Language": "en-US,en;q=0.9",
            }
        )
        proxy = args.proxy or os.environ.get("HTTPS_PROXY") or os.environ.get("HTTP_PROXY")
        if proxy:
            self.session.proxies.update({"http": proxy, "https": proxy})

    def search(self, entry: BibEntry) -> List[SearchResult]:
        backend = self.args.backend
        if backend == "auto":
            return self.search_auto(entry)
        if backend == "crossref":
            return self.search_crossref(entry)
        if backend == "openalex":
            return self.search_openalex(entry)
        if backend == "arxiv":
            return self.search_arxiv(entry)
        if backend == "serpapi":
            return self.search_serpapi(entry)
        if backend == "scholar-html":
            return self.search_scholar_html(entry)
        raise ValueError(f"Unsupported backend: {backend}")

    def search_auto(self, entry: BibEntry) -> List[SearchResult]:
        """Production mode: arXiv first, then optional Google Scholar fallback."""
        if entry.arxiv_id:
            arxiv_results = self.search_arxiv(entry)
            if arxiv_results or self.args.no_scholar_fallback:
                return arxiv_results
        if self.args.no_scholar_fallback:
            return []
        if self.args.serpapi_key or os.environ.get("SERPAPI_API_KEY"):
            return self.search_serpapi(entry)
        return self.search_scholar_html(entry)

    def cached_get_json(self, namespace: str, payload: Dict[str, Any], url: str, params: Dict[str, Any]) -> Any:
        cached = self.cache.get(namespace, payload)
        if cached is not None:
            return cached
        r = self.session.get(url, params=params, timeout=self.args.timeout)
        r.raise_for_status()
        data = r.json()
        self.cache.set(namespace, payload, data)
        return data

    def search_crossref(self, entry: BibEntry) -> List[SearchResult]:
        payload = {"doi": entry.doi, "title": entry.title, "year": entry.year}
        results: List[SearchResult] = []
        try:
            if entry.doi:
                data = self.cached_get_json("crossref-doi", payload, f"https://api.crossref.org/works/{quote(entry.doi)}", {})
                items = [data.get("message", {})]
            else:
                params = {"query.bibliographic": entry.title, "rows": self.args.num_results}
                if entry.year:
                    params["filter"] = f"from-pub-date:{entry.year - self.args.year_window},until-pub-date:{entry.year + self.args.year_window}"
                data = self.cached_get_json("crossref-title", payload, "https://api.crossref.org/works", params)
                items = data.get("message", {}).get("items", [])
            for item in items[: self.args.num_results]:
                title = first(item.get("title"))
                authors = [format_crossref_author(a) for a in item.get("author", [])]
                year = crossref_year(item)
                doi = (item.get("DOI") or "").lower()
                venue = first(item.get("container-title")) or first(item.get("short-container-title"))
                url = item.get("URL", "")
                if title:
                    results.append(SearchResult("crossref", title, authors, year, venue, doi, url))
        except Exception as exc:
            if self.args.verbose:
                print(f"Crossref error for {entry.key}: {exc}", file=sys.stderr)
        return results

    def search_openalex(self, entry: BibEntry) -> List[SearchResult]:
        payload = {"doi": entry.doi, "title": entry.title, "year": entry.year}
        try:
            if entry.doi:
                params = {"filter": f"doi:{entry.doi}"}
            else:
                params = {"search": entry.title, "per-page": self.args.num_results}
                if entry.year:
                    params["filter"] = f"from_publication_date:{entry.year - self.args.year_window}-01-01,to_publication_date:{entry.year + self.args.year_window}-12-31"
            data = self.cached_get_json("openalex", payload, "https://api.openalex.org/works", params)
        except Exception as exc:
            if self.args.verbose:
                print(f"OpenAlex error for {entry.key}: {exc}", file=sys.stderr)
            return []
        out: List[SearchResult] = []
        for item in data.get("results", [])[: self.args.num_results]:
            authors = [
                a.get("author", {}).get("display_name", "")
                for a in item.get("authorships", [])
                if a.get("author", {}).get("display_name")
            ]
            doi = (item.get("doi") or "").replace("https://doi.org/", "").lower()
            venue = ((item.get("primary_location") or {}).get("source") or {}).get("display_name", "")
            url = ((item.get("primary_location") or {}).get("landing_page_url") or item.get("id") or "")
            out.append(SearchResult("openalex", item.get("display_name", ""), authors, item.get("publication_year"), venue, doi, url))
        return out

    def search_arxiv(self, entry: BibEntry) -> List[SearchResult]:
        if not entry.arxiv_id and not entry.title:
            return []
        payload = {"arxiv_id": entry.arxiv_id, "title": entry.title}
        cached = self.cache.get("arxiv", payload)
        if cached is not None:
            return [SearchResult(**x) for x in cached]
        if entry.arxiv_id:
            abs_results = self.search_arxiv_abs(entry)
            if abs_results:
                self.cache.set("arxiv", payload, [asdict(x) for x in abs_results])
                return abs_results
        if entry.arxiv_id:
            query = f"id:{entry.arxiv_id}"
        else:
            query = f'ti:"{entry.title}"'
        try:
            r = self.session.get(
                "https://export.arxiv.org/api/query",
                params={"search_query": query, "start": 0, "max_results": self.args.num_results},
                timeout=self.args.timeout,
            )
            r.raise_for_status()
            root = ET.fromstring(r.text)
        except Exception as exc:
            if self.args.verbose:
                print(f"arXiv error for {entry.key}: {exc}", file=sys.stderr)
            return []
        ns = {"a": "http://www.w3.org/2005/Atom"}
        results: List[SearchResult] = []
        for node in root.findall("a:entry", ns):
            title = clean_latex_text(node.findtext("a:title", default="", namespaces=ns))
            authors = [clean_latex_text(a.findtext("a:name", default="", namespaces=ns)) for a in node.findall("a:author", ns)]
            published = node.findtext("a:published", default="", namespaces=ns)
            url = node.findtext("a:id", default="", namespaces=ns)
            arxiv_id = extract_arxiv_id(url)
            results.append(SearchResult("arxiv", title, authors, parse_year(published), "arXiv", "", url, arxiv_id))
        self.cache.set("arxiv", payload, [asdict(x) for x in results])
        return results

    def search_arxiv_abs(self, entry: BibEntry) -> List[SearchResult]:
        payload = {"arxiv_id": entry.arxiv_id}
        cached = self.cache.get("arxiv-abs", payload)
        if cached is not None:
            return [SearchResult(**x) for x in cached]
        try:
            r = self.session.get(f"https://arxiv.org/abs/{entry.arxiv_id}", timeout=self.args.timeout)
            if r.status_code == 404:
                self.cache.set("arxiv-abs", payload, [])
                return []
            r.raise_for_status()
        except Exception as exc:
            if self.args.verbose:
                print(f"arXiv abs error for {entry.key}: {exc}", file=sys.stderr)
            return []
        soup = BeautifulSoup(r.text, "html.parser")
        title_node = soup.select_one("meta[name='citation_title']")
        year_node = soup.select_one("meta[name='citation_date']")
        authors = [m.get("content", "") for m in soup.select("meta[name='citation_author']") if m.get("content")]
        title = clean_latex_text(title_node.get("content", "")) if title_node else ""
        result = SearchResult(
            source="arxiv",
            title=title or entry.title,
            authors=authors,
            year=parse_year(year_node.get("content", "")) if year_node else None,
            venue="arXiv",
            url=f"https://arxiv.org/abs/{entry.arxiv_id}",
            arxiv_id=entry.arxiv_id,
        )
        self.cache.set("arxiv-abs", payload, [asdict(result)])
        return [result]

    def search_serpapi(self, entry: BibEntry) -> List[SearchResult]:
        api_key = self.args.serpapi_key or os.environ.get("SERPAPI_API_KEY")
        if not api_key:
            raise RuntimeError("SerpApi backend needs --serpapi-key or SERPAPI_API_KEY.")
        query = make_scholar_query(entry, include_author=not self.args.no_author_in_query)
        payload = {"query": query, "year": entry.year}
        cached = self.cache.get("serpapi", payload)
        if cached is not None:
            return [SearchResult(**x) for x in cached]
        params: Dict[str, Any] = {
            "engine": "google_scholar",
            "q": query,
            "api_key": api_key,
            "num": self.args.num_results,
            "hl": "en",
            "as_vis": "1",
            "output": "json",
        }
        if entry.year and self.args.year_window >= 0:
            params["as_ylo"] = entry.year - self.args.year_window
            params["as_yhi"] = entry.year + self.args.year_window
        r = self.session.get("https://serpapi.com/search", params=params, timeout=self.args.timeout)
        r.raise_for_status()
        data = r.json()
        if data.get("error"):
            raise RuntimeError(f"SerpApi error: {data['error']}")
        results = []
        for item in data.get("organic_results", [])[: self.args.num_results]:
            pub = item.get("publication_info") or {}
            summary = pub.get("summary", "") or item.get("snippet", "") or ""
            authors = [a.get("name", "") for a in pub.get("authors", []) if a.get("name")] or parse_authors_from_summary(summary)
            results.append(
                SearchResult(
                    source="serpapi",
                    title=clean_latex_text(item.get("title", "")),
                    authors=authors,
                    year=parse_year(summary),
                    venue=parse_venue_from_summary(summary),
                    url=item.get("link", ""),
                    summary=summary,
                )
            )
        self.cache.set("serpapi", payload, [asdict(x) for x in results])
        return results

    def search_scholar_html(self, entry: BibEntry) -> List[SearchResult]:
        query = make_scholar_query(entry, include_author=not self.args.no_author_in_query)
        payload = {"query": query, "year": entry.year}
        cached = self.cache.get("scholar-html", payload)
        if cached is not None:
            return [SearchResult(**x) for x in cached]
        params: Dict[str, Any] = {"q": query, "hl": "en", "num": str(self.args.num_results), "as_vis": "1"}
        if entry.year and self.args.year_window >= 0:
            params["as_ylo"] = str(entry.year - self.args.year_window)
            params["as_yhi"] = str(entry.year + self.args.year_window)
        r = self.session.get("https://scholar.google.com/scholar", params=params, timeout=self.args.timeout)
        text = r.text
        if r.status_code in {429, 503} or "Our systems have detected unusual traffic" in text or "not a robot" in text.lower():
            raise RuntimeError("Google Scholar blocked the request/CAPTCHA detected. Use --backend serpapi or reduce rate.")
        r.raise_for_status()
        soup = BeautifulSoup(text, "html.parser")
        results: List[SearchResult] = []
        for block in soup.select(".gs_ri")[: self.args.num_results]:
            title_node = block.select_one("h3.gs_rt")
            if not title_node:
                continue
            for tag in title_node.select("span"):
                tag.decompose()
            title = clean_latex_text(title_node.get_text(" ", strip=True))
            link_node = title_node.select_one("a")
            summary = block.select_one(".gs_a").get_text(" ", strip=True) if block.select_one(".gs_a") else ""
            results.append(
                SearchResult(
                    "scholar-html",
                    title=title,
                    authors=parse_authors_from_summary(summary),
                    year=parse_year(summary),
                    venue=parse_venue_from_summary(summary),
                    url=link_node.get("href", "") if link_node else "",
                    summary=summary,
                )
            )
        self.cache.set("scholar-html", payload, [asdict(x) for x in results])
        return results

    def check_url(self, url: str) -> Optional[bool]:
        if not url or not url.startswith(("http://", "https://")):
            return None
        payload = {"url": url}
        cached = self.cache.get("url", payload)
        if cached is not None:
            return bool(cached)
        ok = False
        try:
            r = self.session.head(url, allow_redirects=True, timeout=self.args.timeout)
            if r.status_code in {403, 405}:
                r = self.session.get(url, allow_redirects=True, timeout=self.args.timeout, stream=True)
            ok = 200 <= r.status_code < 400
        except Exception:
            ok = False
        self.cache.set("url", payload, ok)
        return ok


def first(value: Any) -> str:
    if isinstance(value, list):
        return clean_latex_text(str(value[0])) if value else ""
    return clean_latex_text(str(value or ""))


def format_crossref_author(author: Dict[str, Any]) -> str:
    given = author.get("given", "")
    family = author.get("family", "")
    return clean_latex_text(f"{given} {family}".strip() or author.get("name", ""))


def crossref_year(item: Dict[str, Any]) -> Optional[int]:
    for key in ("published-print", "published-online", "published", "issued", "created"):
        parts = ((item.get(key) or {}).get("date-parts") or [[]])
        if parts and parts[0]:
            try:
                return int(parts[0][0])
            except (TypeError, ValueError):
                pass
    return None


def make_scholar_query(entry: BibEntry, include_author: bool = True) -> str:
    if include_author and entry.authors:
        surname = normalize_author_name(entry.authors[0])
        if surname:
            return f'"{entry.title}" author:{surname}'
    return f'"{entry.title}"'


def parse_venue_from_summary(summary: str) -> str:
    parts = re.split(r"\s+-\s+", summary or "")
    if len(parts) >= 2:
        return clean_latex_text(parts[1])
    return ""


def dedupe_results(results: List[SearchResult]) -> List[SearchResult]:
    seen = set()
    out = []
    for r in results:
        key = r.doi or r.arxiv_id or normalize_title(r.title)
        if not key or key in seen:
            continue
        seen.add(key)
        out.append(r)
    return out


# -----------------------------
# Validation
# -----------------------------


def decide(entry: BibEntry, candidates: List[SearchResult], backend: str, args: argparse.Namespace, url_ok: Optional[bool]) -> CheckResult:
    kind = record_kind(entry)
    if kind in {"github", "blog"} and not candidates:
        issues = list(entry.parse_warnings)
        if not entry.url:
            issues.append("missing_url")
        if url_ok is False:
            issues.append("url_unreachable")
        verdict = "FOUND_MATCH" if url_ok else "NOT_FOUND"
        label = "GitHub" if kind == "github" else "Blog"
        return empty_result(entry, kind, verdict, bool(url_ok), 1.0 if url_ok else 0.0, backend, url_ok, issues, f"{label} reference checked by URL reachability.")

    best: Optional[SearchResult] = None
    best_score = -1.0
    best_parts = (0.0, 0, None, 0.0, False, False)
    for cand in candidates:
        ts = title_similarity(entry.title, cand.title)
        ov = author_overlap(entry.authors, cand.authors)
        yd = abs(entry.year - cand.year) if entry.year is not None and cand.year is not None else None
        year_score = 0.5 if yd is None else 1.0 if yd == 0 else 0.7 if yd <= args.year_window else 0.0
        author_score = min(1.0, ov / max(1, min(args.author_check_count, len(entry.authors) or 1)))
        venue_score = similarity(entry.venue, cand.venue) if entry.venue and cand.venue else 0.5
        doi_match = bool(entry.doi and cand.doi and entry.doi.lower() == cand.doi.lower())
        arxiv_match = bool(entry.arxiv_id and cand.arxiv_id and entry.arxiv_id == cand.arxiv_id)
        identifier_bonus = 1.0 if doi_match or arxiv_match else 0.0
        score = 0.55 * ts + 0.17 * year_score + 0.13 * author_score + 0.10 * venue_score + 0.05 * identifier_bonus
        if score > best_score:
            best = cand
            best_score = score
            best_parts = (ts, ov, yd, venue_score, doi_match, arxiv_match)

    if best is None:
        return empty_result(entry, kind, "NOT_FOUND", False, 0.0, backend, url_ok, entry.parse_warnings + ["no_search_result"], "No search result returned.")

    ts, ov, yd, venue_score, doi_match, arxiv_match = best_parts
    issues = list(entry.parse_warnings)
    title_match = ts >= args.title_threshold
    year_match = yd is None or yd <= args.year_window
    author_match = (not entry.authors) or (not best.authors) or ov >= args.min_author_overlap
    arxiv_venue_ok = bool(entry.arxiv_id and best.source == "arxiv" and "arxiv" in entry.venue.lower())
    venue_match = (not entry.venue) or (not best.venue) or venue_score >= args.venue_threshold or arxiv_venue_ok

    if not title_match:
        issues.append("title_mismatch")
    if not year_match and yd is not None:
        issues.append("year_mismatch")
    if not author_match and entry.authors and best.authors:
        issues.append("author_mismatch")
    if not venue_match and entry.venue and best.venue:
        issues.append("venue_mismatch")
    if entry.doi and best.doi and not doi_match:
        issues.append("doi_mismatch")
    if entry.arxiv_id and best.arxiv_id and not arxiv_match:
        issues.append("arxiv_mismatch")
    if entry.doi and not doi_match:
        issues.append("doi_unverified")
    if entry.arxiv_id and not arxiv_match:
        issues.append("arxiv_unverified")

    identifier_ok = (not entry.doi or doi_match) and (not entry.arxiv_id or arxiv_match)
    strict = title_match and year_match and author_match and venue_match and identifier_ok
    strong_identifier = doi_match or arxiv_match
    title_found = ts >= args.loose_title_threshold or strong_identifier
    if strict or strong_identifier:
        verdict, exists, reason = "FOUND_MATCH", True, "Title, author, year, venue, and identifier rules passed."
    elif title_found:
        verdict, exists, reason = "FOUND_MISMATCH", True, "A likely matching paper was found, but some metadata fields do not fully match."
    else:
        verdict, exists, reason = "NOT_FOUND", False, "No candidate passes the title threshold."

    return CheckResult(
        key=entry.key,
        entry_type=entry.entry_type,
        record_kind=kind,
        input_title=entry.title,
        input_year=entry.year,
        input_authors="; ".join(entry.authors),
        input_venue=entry.venue,
        input_doi=entry.doi,
        input_url=entry.url,
        input_arxiv_id=entry.arxiv_id,
        verdict=verdict,
        exists=exists,
        confidence=round(max(0.0, min(1.0, best_score)), 4),
        title_score=round(ts, 4),
        author_overlap=ov,
        year_delta=yd,
        venue_score=round(venue_score, 4),
        doi_match=doi_match,
        arxiv_match=arxiv_match,
        url_ok=url_ok,
        matched_source=best.source,
        matched_title=best.title,
        matched_year=best.year,
        matched_authors="; ".join(best.authors[:8]),
        matched_venue=best.venue,
        matched_doi=best.doi,
        matched_url=best.url,
        backend=backend,
        issues=";".join(dict.fromkeys(issues)),
        reason=reason,
        title_match=title_match,
        author_match=author_match,
        year_match=year_match,
        venue_match=venue_match,
    )


def empty_result(
    entry: BibEntry,
    kind: str,
    verdict: str,
    exists: bool,
    confidence: float,
    backend: str,
    url_ok: Optional[bool],
    issues: List[str],
    reason: str,
) -> CheckResult:
    return CheckResult(
        key=entry.key,
        entry_type=entry.entry_type,
        record_kind=kind,
        input_title=entry.title,
        input_year=entry.year,
        input_authors="; ".join(entry.authors),
        input_venue=entry.venue,
        input_doi=entry.doi,
        input_url=entry.url,
        input_arxiv_id=entry.arxiv_id,
        verdict=verdict,
        exists=exists,
        confidence=confidence,
        title_score=0.0,
        title_match=False,
        author_overlap=0,
        author_match=False,
        year_delta=None,
        year_match=False,
        venue_score=0.0,
        venue_match=False,
        doi_match=False,
        arxiv_match=False,
        url_ok=url_ok,
        matched_source="",
        matched_title="",
        matched_year=None,
        matched_authors="",
        matched_venue="",
        matched_doi="",
        matched_url="",
        backend=backend,
        issues=";".join(dict.fromkeys(issues)),
        reason=reason,
    )


# -----------------------------
# CLI and reporting
# -----------------------------


def write_csv(path: Path, rows: List[CheckResult]) -> None:
    if not rows:
        path.write_text("", encoding="utf-8")
        return
    with path.open("w", newline="", encoding="utf-8-sig") as f:
        writer = csv.DictWriter(f, fieldnames=list(asdict(rows[0]).keys()))
        writer.writeheader()
        for row in rows:
            writer.writerow(asdict(row))


def write_json(path: Path, rows: List[CheckResult]) -> None:
    path.write_text(json.dumps([asdict(r) for r in rows], ensure_ascii=False, indent=2), encoding="utf-8")


def build_arg_parser() -> argparse.ArgumentParser:
    p = argparse.ArgumentParser(description="No-AI rule-based BibTeX reference checker.")
    p.add_argument("--bib", required=True, help="Path to .bib file.")
    p.add_argument(
        "--backend",
        choices=["auto", "crossref", "openalex", "arxiv", "serpapi", "scholar-html"],
        default="auto",
        help="Default auto mode checks arXiv IDs first, then falls back to Google Scholar unless disabled.",
    )
    p.add_argument("--out", default="reference_check_report.csv")
    p.add_argument("--json-out", default="")
    p.add_argument("--cache", default=".refcheck_cache.json")
    p.add_argument("--serpapi-key", default="")
    p.add_argument("--proxy", default="", help="Example: http://127.0.0.1:7890")
    p.add_argument("--delay", type=float, default=1.0)
    p.add_argument("--jitter", type=float, default=0.5)
    p.add_argument("--timeout", type=float, default=12.0)
    p.add_argument("--retries", type=int, default=1)
    p.add_argument("--retry-backoff", type=float, default=0.6)
    p.add_argument("--num-results", type=int, default=8)
    p.add_argument("--min-sources", type=int, default=2)
    p.add_argument("--limit", type=int, default=0)
    p.add_argument("--start", type=int, default=0)
    p.add_argument("--year-window", type=int, default=1)
    p.add_argument("--title-threshold", type=float, default=0.92)
    p.add_argument("--loose-title-threshold", type=float, default=0.84)
    p.add_argument("--venue-threshold", type=float, default=0.72)
    p.add_argument("--min-author-overlap", type=int, default=1)
    p.add_argument("--author-check-count", type=int, default=3)
    p.add_argument("--no-author-in-query", action="store_true")
    p.add_argument("--skip-url-check", action="store_true")
    p.add_argument("--no-scholar-fallback", action="store_true", help="In auto mode, do not query Google Scholar after arXiv.")
    p.add_argument("--include-missing-title", action="store_true")
    p.add_argument("--user-agent", default="")
    p.add_argument("--dry-run", action="store_true", help="Only parse .bib and print extracted metadata.")
    p.add_argument("--verbose", action="store_true")
    return p


def main() -> int:
    args = build_arg_parser().parse_args()
    bib_path = Path(args.bib)
    text = bib_path.read_text(encoding="utf-8", errors="replace")
    entries = parse_bibtex(text)
    if not args.include_missing_title:
        entries = [e for e in entries if e.title]
    if args.start:
        entries = entries[args.start :]
    if args.limit > 0:
        entries = entries[: args.limit]

    print(f"Parsed {len(entries)} entries from {bib_path}")
    if args.dry_run:
        for e in entries:
            print(json.dumps(asdict(e), ensure_ascii=False))
        return 0

    searcher = ReferenceSearcher(args)
    rows: List[CheckResult] = []
    for idx, entry in enumerate(entries, 1):
        kind = record_kind(entry)
        print(f"[{idx}/{len(entries)}] {entry.key} ({kind}): {entry.title[:90]}", flush=True)
        try:
            url_ok = None if args.skip_url_check else searcher.check_url(entry.url)
            candidates = [] if kind in {"github", "blog"} else searcher.search(entry)
            result = decide(entry, candidates, args.backend, args, url_ok)
        except Exception as exc:
            result = empty_result(entry, kind, "ERROR", False, 0.0, args.backend, None, entry.parse_warnings + ["runtime_error"], str(exc))
        rows.append(result)
        write_csv(Path(args.out), rows)
        if args.json_out:
            write_json(Path(args.json_out), rows)
        print(
            f"    -> {result.verdict} confidence={result.confidence} "
            f"title={result.title_score} source={result.matched_source or 'n/a'} issues={result.issues or 'none'}",
            flush=True,
        )
        if idx < len(entries):
            time.sleep(max(0.0, args.delay + random.random() * args.jitter))

    summary: Dict[str, int] = {}
    for r in rows:
        summary[r.verdict] = summary.get(r.verdict, 0) + 1
    print(f"Saved CSV: {args.out}")
    if args.json_out:
        print(f"Saved JSON: {args.json_out}")
    print("Summary:", json.dumps(summary, ensure_ascii=False, sort_keys=True))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
