const state = {
  file: null,
  locale: window.localStorage.getItem("bib-checker-locale") || "zh",
  parsedEntries: [],
  parsedPage: 1,
  parsedPageSize: 6,
  parsedCategoryFilter: "ALL",
  reportEntries: [],
  reportFilter: "ALL",
  reportCategoryFilter: "ALL",
  reportSearch: "",
  reportPage: 1,
  reportPageSize: 6,
  duplicates: [],
  sources: [],
  jobs: [],
  currentJobId: "",
  activeMismatchRow: null,
  pollingTimer: null,
  statusState: { key: "status.no_file", vars: {} },
  progressState: { processed: 0, total: 0, progress: 0, message: "" },
};

const I18N = {
  zh: {
    "app.title": "Ref. Checker",
    "brand.subtitle": "History",
    "sidebar.new_session": "＋ 新建会话",
    "sidebar.history": "历史记录",
    "sidebar.empty": "还没有任务记录",
    "topbar.language_toggle": "EN",
    "topbar.sources": "数据源",
    "topbar.api_docs": "API Docs",
    "upload.title": "选择或拖拽 BibTeX 文件",
    "upload.description": "上传后可先解析，再开始验证。",
    "button.parse": "解析",
    "button.run": "开始验证",
    "button.refresh": "刷新",
    "button.json": "JSON",
    "button.excel": "Excel",
    "button.bib": "BIB",
    "button.apply": "应用",
    "tab.parsed": "解析结果",
    "tab.duplicates": "重复文献",
    "tab.report": "验证报告",
    "panel.parsed": "解析结果",
    "panel.duplicates": "重复文献",
    "placeholder.parsed": "解析后这里会显示文献条目。",
    "placeholder.parsed_empty_filter": "当前分类下没有结果。",
    "placeholder.duplicates": "如果检测到重复文献，会在这里展示。",
    "placeholder.report": "运行验证任务后，这里会显示最终报告。",
    "placeholder.report_empty_filter": "当前筛选条件下没有结果。",
    "status.no_file": "尚未选择文件。",
    "status.file_ready": "文件已就绪。请先解析，再查看元数据和重复分组。",
    "status.parsing": "正在解析文献并扫描重复引用...",
    "status.parse_complete": "解析完成。请先检查重复文献，再开始验证。",
    "status.creating_job": "正在创建验证任务...",
    "status.job_created": "任务已创建，正在轮询验证进度...",
    "status.completed": "验证已完成。请检查不匹配项并导出报告。",
    "status.failed": "验证失败。请检查数据源配置后重试。",
    "status.job_running": "任务 {status}，后端仍在验证参考文献。",
    "status.job_label": "{filename} · {status}",
    "status.init_failed": "工作区初始化失败。",
    "status.parsing_failed": "解析失败。请检查文件后重试。",
    "status.job_creation_failed": "创建任务失败。请检查数据源配置。",
    "progress.running": "正在验证...",
    "progress.preparing": "正在准备验证任务...",
    "toast.new_session": "已创建新会话。",
    "toast.no_correction": "当前没有可应用的修正。",
    "toast.empty_recommendation": "推荐 .bib 不能为空。",
    "toast.correction_applied": "已应用修正，修改后的 .bib 可立即导出。",
    "toast.history_refreshed": "已刷新历史记录。",
    "toast.parsed": "已解析 {count} 条文献。",
    "toast.verify_created": "验证任务已创建。",
    "toast.verify_completed": "验证任务已完成。",
    "toast.choose_file": "请先选择一个 .bib 文件。",
    "filter.all": "全部",
    "filter.match": "匹配",
    "filter.mismatch": "不匹配",
    "filter.not_found": "找不到",
    "category.all": "All",
    "category.paper": "论文",
    "category.blog": "博客",
    "category.github": "GitHub",
    "duplicate.groups": "{count} groups",
    "duplicate.keys": "Keys",
    "duplicate.titles": "Titles",
    "search.report.aria": "搜索验证结果",
    "search.report.placeholder": "搜索标题、作者、期刊、Key",
    "pagination.meta": "第 {page} 页，共 {total} 页",
    "pagination.prev": "上一页",
    "pagination.next": "下一页",
    "details.summary": "查看详情",
    "details.category": "类别",
    "details.key": "Key",
    "details.type": "Type",
    "details.doi": "DOI",
    "details.url": "URL",
    "details.source": "Source",
    "details.issues": "Issues",
    "details.reason": "Reason",
    "details.raw_bib": "原始 .bib 引用",
    "details.raw_bib_recommended": "推荐修正后的 .bib",
    "details.evidence": "搜索证据",
    "details.open_reference": "打开正确引用来源",
    "details.mismatch_title": "不匹配修正建议",
    "details.mismatch_subtitle": "查看原始引用、搜索证据与推荐 BibTeX。",
    "details.mismatch_fallback": "不匹配文献",
    "details.suggestion_button": "查看修正建议",
    "details.source_label": "来源",
    "details.title_label": "标题",
    "details.authors_label": "作者",
    "details.year_label": "年份",
    "details.venue_label": "期刊 / Venue",
    "unknown.year": "Unknown Year",
    "unknown.authors": "Unknown Authors",
    "unknown.venue": "Unknown Venue",
    "source.modal_title": "数据源配置",
    "source.modal_desc": "按顺序启用搜索源，并填写需要的 API Key 或代理。",
    "source.enable_all": "全部启用",
    "source.reset_default": "恢复默认",
    "source.toolbar_note": "建议只启用你真正需要的搜索源，这样更快，也更不容易误判。",
    "source.priority": "Priority {index}",
    "source.api_key": "API Key",
    "source.proxy": "Proxy",
    "source.enter_api_key": "Enter API key",
    "source.not_required": "Not required",
    "source.not_supported": "Not supported",
    "source.description.arxiv": "适合 arXiv 优先的学术文献验证。",
    "source.description.serpapi": "稳定性更好的 Google Scholar API wrapper。",
    "source.description.scholar-html": "直接解析 Scholar HTML，建议配合代理并放慢速率。",
    "source.description.crossref": "适合 DOI 驱动的期刊与会议文献。",
    "source.description.openalex": "适合大范围学术元数据补充。",
    "source.description.default": "Configured source.",
    "job.completed": "已完成",
    "job.failed": "失败",
    "job.running": "进行中",
    "job.pending": "等待中",
    "verdict.FOUND_MATCH": "完全匹配",
    "verdict.FOUND_MISMATCH": "部分匹配",
    "verdict.NOT_FOUND": "没有找到",
  },
  en: {
    "app.title": "Ref. Checker",
    "brand.subtitle": "History",
    "sidebar.new_session": "+ New Session",
    "sidebar.history": "History",
    "sidebar.empty": "No jobs yet",
    "topbar.language_toggle": "中文",
    "topbar.sources": "Sources",
    "topbar.api_docs": "API Docs",
    "upload.title": "Choose or drop a BibTeX file",
    "upload.description": "Upload a file, parse it first, then start verification.",
    "button.parse": "Parse",
    "button.run": "Run Verification",
    "button.refresh": "Refresh",
    "button.json": "JSON",
    "button.excel": "Excel",
    "button.bib": "BIB",
    "button.apply": "Apply",
    "tab.parsed": "Parsed",
    "tab.duplicates": "Duplicates",
    "tab.report": "Report",
    "panel.parsed": "Parsed Entries",
    "panel.duplicates": "Duplicate References",
    "placeholder.parsed": "Parsed bibliography entries will appear here.",
    "placeholder.parsed_empty_filter": "No entries under the current category.",
    "placeholder.duplicates": "Detected duplicate references will appear here.",
    "placeholder.report": "Verification results will appear here after the job finishes.",
    "placeholder.report_empty_filter": "No results match the current filters.",
    "status.no_file": "No file selected.",
    "status.file_ready": "File ready. Parse first to review metadata and duplicate groups.",
    "status.parsing": "Parsing bibliography and scanning for duplicate references...",
    "status.parse_complete": "Parse complete. Review duplicates and then run verification.",
    "status.creating_job": "Creating verification job...",
    "status.job_created": "Job created. Polling for verification progress...",
    "status.completed": "Verification completed. Review mismatches and export the report.",
    "status.failed": "Verification failed. Check source configuration and try again.",
    "status.job_running": "Job {status}. The backend is still verifying references.",
    "status.job_label": "{filename} · {status}",
    "status.init_failed": "Failed to initialize the workspace.",
    "status.parsing_failed": "Parsing failed. Please check the file and try again.",
    "status.job_creation_failed": "Job creation failed. Please review the source configuration.",
    "progress.running": "Verifying...",
    "progress.preparing": "Preparing verification...",
    "toast.new_session": "New session created.",
    "toast.no_correction": "No correction is available for this entry.",
    "toast.empty_recommendation": "Recommended .bib content cannot be empty.",
    "toast.correction_applied": "Correction applied. The updated .bib can now be exported.",
    "toast.history_refreshed": "History refreshed.",
    "toast.parsed": "Parsed {count} entries.",
    "toast.verify_created": "Verification job created.",
    "toast.verify_completed": "Verification job completed.",
    "toast.choose_file": "Please choose a .bib file first.",
    "filter.all": "All",
    "filter.match": "Match",
    "filter.mismatch": "Mismatch",
    "filter.not_found": "Not Found",
    "category.all": "All",
    "category.paper": "Paper",
    "category.blog": "Blog",
    "category.github": "GitHub",
    "duplicate.groups": "{count} groups",
    "duplicate.keys": "Keys",
    "duplicate.titles": "Titles",
    "search.report.aria": "Search verification results",
    "search.report.placeholder": "Search title, author, venue, key",
    "pagination.meta": "Page {page} of {total}",
    "pagination.prev": "Previous",
    "pagination.next": "Next",
    "details.summary": "View details",
    "details.category": "Category",
    "details.key": "Key",
    "details.type": "Type",
    "details.doi": "DOI",
    "details.url": "URL",
    "details.source": "Source",
    "details.issues": "Issues",
    "details.reason": "Reason",
    "details.raw_bib": "Original .bib citation",
    "details.raw_bib_recommended": "Recommended corrected .bib",
    "details.evidence": "Search evidence",
    "details.open_reference": "Open source of truth",
    "details.mismatch_title": "Mismatch correction suggestion",
    "details.mismatch_subtitle": "Review the original citation, search evidence, and recommended BibTeX.",
    "details.mismatch_fallback": "Mismatched reference",
    "details.suggestion_button": "View correction suggestion",
    "details.source_label": "Source",
    "details.title_label": "Title",
    "details.authors_label": "Authors",
    "details.year_label": "Year",
    "details.venue_label": "Venue",
    "unknown.year": "Unknown Year",
    "unknown.authors": "Unknown Authors",
    "unknown.venue": "Unknown Venue",
    "source.modal_title": "Source Configuration",
    "source.modal_desc": "Enable search sources in order and fill in any required API keys or proxies.",
    "source.enable_all": "Enable all",
    "source.reset_default": "Reset defaults",
    "source.toolbar_note": "Enable only the sources you actually need for faster runs and fewer false matches.",
    "source.priority": "Priority {index}",
    "source.api_key": "API Key",
    "source.proxy": "Proxy",
    "source.enter_api_key": "Enter API key",
    "source.not_required": "Not required",
    "source.not_supported": "Not supported",
    "source.description.arxiv": "Best for arXiv-first academic verification.",
    "source.description.serpapi": "A more stable Google Scholar API wrapper.",
    "source.description.scholar-html": "Direct Scholar HTML parsing. Use with a proxy and slow request rate.",
    "source.description.crossref": "Best for DOI-driven journal and conference references.",
    "source.description.openalex": "Useful for broad scholarly metadata enrichment.",
    "source.description.default": "Configured source.",
    "job.completed": "completed",
    "job.failed": "failed",
    "job.running": "running",
    "job.pending": "pending",
    "verdict.FOUND_MATCH": "FOUND_MATCH",
    "verdict.FOUND_MISMATCH": "FOUND_MISMATCH",
    "verdict.NOT_FOUND": "NOT_FOUND",
  },
};

function t(key, vars = {}) {
  const table = I18N[state.locale] || I18N.zh;
  const template = table[key] ?? I18N.zh[key] ?? key;
  return template.replace(/\{(\w+)\}/g, (_, name) => String(vars[name] ?? ""));
}

const els = {
  bibFile: document.getElementById("bibFile"),
  fileChip: document.getElementById("fileChip"),
  parseButton: document.getElementById("parseButton"),
  runButton: document.getElementById("runButton"),
  refreshJobButton: document.getElementById("refreshJobButton"),
  newSessionButton: document.getElementById("newSessionButton"),
  languageToggleButton: document.getElementById("languageToggleButton"),
  openSourcesButton: document.getElementById("openSourcesButton"),
  enableAllSourcesButton: document.getElementById("enableAllSourcesButton"),
  resetSourcesButton: document.getElementById("resetSourcesButton"),
  sourceToolbarNote: document.getElementById("sourceToolbarNote"),
  apiDocsLink: document.getElementById("apiDocsLink"),
  brandSubtitle: document.getElementById("brandSubtitle"),
  historyLabel: document.getElementById("historyLabel"),
  uploadTitle: document.getElementById("uploadTitle"),
  uploadDescription: document.getElementById("uploadDescription"),
  closeSourcesButton: document.getElementById("closeSourcesButton"),
  sourcesModal: document.getElementById("sourcesModal"),
  mismatchModal: document.getElementById("mismatchModal"),
  mismatchModalBody: document.getElementById("mismatchModalBody"),
  mismatchModalSubtitle: document.getElementById("mismatchModalSubtitle"),
  closeMismatchButton: document.getElementById("closeMismatchButton"),
  applyMismatchButton: document.getElementById("applyMismatchButton"),
  sourceList: document.getElementById("sourceList"),
  historyList: document.getElementById("historyList"),
  statusText: document.getElementById("statusText"),
  progressPanel: document.getElementById("progressPanel"),
  progressLabel: document.getElementById("progressLabel"),
  progressCount: document.getElementById("progressCount"),
  progressBar: document.getElementById("progressBar"),
  entriesTableBody: document.getElementById("entriesTableBody"),
  duplicateList: document.getElementById("duplicateList"),
  reportTableBody: document.getElementById("reportTableBody"),
  parsedCategoryFilters: Array.from(document.querySelectorAll("[data-parsed-filter]")),
  parsedPagination: document.getElementById("parsedPagination"),
  parsedPaginationMeta: document.getElementById("parsedPaginationMeta"),
  parsedPrevButton: document.getElementById("parsedPrevButton"),
  parsedNextButton: document.getElementById("parsedNextButton"),
  reportPagination: document.getElementById("reportPagination"),
  reportPaginationMeta: document.getElementById("reportPaginationMeta"),
  reportPrevButton: document.getElementById("reportPrevButton"),
  reportNextButton: document.getElementById("reportNextButton"),
  duplicateCountPill: document.getElementById("duplicateCountPill"),
  reportToolbar: document.getElementById("reportToolbar"),
  reportFilters: Array.from(document.querySelectorAll(".filter-chip")),
  reportCategoryFilters: Array.from(document.querySelectorAll("[data-report-category-filter]")),
  reportSearchInput: document.getElementById("reportSearchInput"),
  reportSearchSrOnly: document.querySelector(".search-field .sr-only"),
  downloadJsonLink: document.getElementById("downloadJsonLink"),
  downloadXlsxLink: document.getElementById("downloadXlsxLink"),
  downloadBibLink: document.getElementById("downloadBibLink"),
  toast: document.getElementById("toast"),
  parsedPlaceholder: document.getElementById("parsedPlaceholder"),
  duplicatesPlaceholder: document.getElementById("duplicatesPlaceholder"),
  reportPlaceholder: document.getElementById("reportPlaceholder"),
  parsedTableShell: document.getElementById("parsedTableShell"),
  reportTableShell: document.getElementById("reportTableShell"),
  tabButtons: Array.from(document.querySelectorAll(".tab-button")),
  resultPanels: Array.from(document.querySelectorAll(".result-panel")),
  parsedPanelTitle: document.getElementById("parsedPanelTitle"),
  duplicatesPanelTitle: document.getElementById("duplicatesPanelTitle"),
  sourcesModalTitle: document.getElementById("sourcesModalTitle"),
  sourcesModalDescription: document.getElementById("sourcesModalDescription"),
  mismatchModalTitle: document.getElementById("mismatchModalTitle"),
};

function showToast(message, isError = false) {
  els.toast.textContent = message;
  els.toast.style.background = isError ? "rgba(185, 28, 28, 0.95)" : "rgba(11, 18, 32, 0.94)";
  els.toast.classList.add("visible");
  window.clearTimeout(showToast.timer);
  showToast.timer = window.setTimeout(() => {
    els.toast.classList.remove("visible");
  }, 2400);
}

function setStatus(message) {
  els.statusText.textContent = message;
}

function setStatusKey(key, vars = {}) {
  state.statusState = { key, vars };
  setStatus(t(key, vars));
}

function translateJobStatus(status) {
  return t(`job.${status || "pending"}`);
}

function getCategoryLabel(filter) {
  if (filter === "ALL") {
    return t("category.all");
  }
  if (filter === "paper") {
    return t("category.paper");
  }
  if (filter === "blog") {
    return t("category.blog");
  }
  return t("category.github");
}

function getVerdictFilterLabel(filter) {
  if (filter === "FOUND_MATCH") {
    return t("filter.match");
  }
  if (filter === "FOUND_MISMATCH") {
    return t("filter.mismatch");
  }
  if (filter === "NOT_FOUND") {
    return t("filter.not_found");
  }
  return t("filter.all");
}

function getVerdictLabel(verdict) {
  return t(`verdict.${verdict || "NOT_FOUND"}`);
}

function updateProgress(processed = 0, total = 0, progress = 0, message = "") {
  state.progressState = { processed, total, progress, message };
  const show = total > 0 || processed > 0 || progress > 0 || Boolean(message);
  els.progressPanel.classList.toggle("hidden", !show);
  if (!show) {
    els.progressLabel.textContent = t("progress.running");
    els.progressCount.textContent = "0 / 0";
    els.progressBar.style.width = "0%";
    return;
  }
  els.progressLabel.textContent = message || t("progress.running");
  els.progressCount.textContent = `${processed} / ${total}`;
  els.progressBar.style.width = `${Math.max(0, Math.min(100, Math.round(progress * 100)))}%`;
}

function applyLocale() {
  window.localStorage.setItem("bib-checker-locale", state.locale);
  document.documentElement.lang = state.locale === "zh" ? "zh-CN" : "en";
  document.title = t("app.title");
  els.brandSubtitle.textContent = t("brand.subtitle");
  els.newSessionButton.textContent = t("sidebar.new_session");
  els.historyLabel.textContent = t("sidebar.history");
  els.languageToggleButton.textContent = t("topbar.language_toggle");
  els.openSourcesButton.textContent = t("topbar.sources");
  els.apiDocsLink.textContent = t("topbar.api_docs");
  els.uploadTitle.textContent = t("upload.title");
  els.uploadDescription.textContent = t("upload.description");
  els.parseButton.textContent = t("button.parse");
  els.runButton.textContent = t("button.run");
  els.refreshJobButton.textContent = t("button.refresh");
  els.downloadJsonLink.textContent = t("button.json");
  els.downloadXlsxLink.textContent = t("button.excel");
  els.downloadBibLink.textContent = t("button.bib");
  els.parsedPanelTitle.textContent = t("panel.parsed");
  els.duplicatesPanelTitle.textContent = t("panel.duplicates");
  els.tabButtons.forEach((button) => {
    const map = { parsed: "tab.parsed", duplicates: "tab.duplicates", report: "tab.report" };
    button.textContent = t(map[button.dataset.tab] || "tab.parsed");
  });
  els.sourcesModalTitle.textContent = t("source.modal_title");
  els.sourcesModalDescription.textContent = t("source.modal_desc");
  els.enableAllSourcesButton.textContent = t("source.enable_all");
  els.resetSourcesButton.textContent = t("source.reset_default");
  els.sourceToolbarNote.textContent = t("source.toolbar_note");
  els.mismatchModalTitle.textContent = t("details.mismatch_title");
  els.applyMismatchButton.textContent = t("button.apply");
  els.reportSearchSrOnly.textContent = t("search.report.aria");
  els.reportSearchInput.placeholder = t("search.report.placeholder");
  els.parsedPrevButton.textContent = t("pagination.prev");
  els.parsedNextButton.textContent = t("pagination.next");
  els.reportPrevButton.textContent = t("pagination.prev");
  els.reportNextButton.textContent = t("pagination.next");
  els.closeSourcesButton.setAttribute("aria-label", state.locale === "zh" ? "关闭" : "Close");
  els.closeMismatchButton.setAttribute("aria-label", state.locale === "zh" ? "关闭" : "Close");
  if (state.statusState?.key) {
    setStatus(t(state.statusState.key, state.statusState.vars || {}));
  }
  updateProgress(state.progressState.processed, state.progressState.total, state.progressState.progress, state.progressState.message);
  renderHistory();
  renderSources();
  renderEntries(state.parsedEntries);
  renderDuplicates(state.duplicates);
  renderReport(state.reportEntries);
}

function toggleLocale() {
  state.locale = state.locale === "zh" ? "en" : "zh";
  applyLocale();
}

function syncWorkspaceMode() {
  document.body.classList.toggle("has-file", Boolean(state.file || state.currentJobId));
}

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function setFile(file) {
  state.file = file;
  if (!file) {
    syncWorkspaceMode();
    els.fileChip.classList.add("hidden");
    els.fileChip.textContent = "";
    updateProgress(0, 0, 0, "");
    setStatusKey("status.no_file");
    return;
  }
  syncWorkspaceMode();
  els.fileChip.classList.remove("hidden");
  els.fileChip.textContent = `${file.name} · ${(file.size / 1024).toFixed(1)} KB`;
  setStatusKey("status.file_ready");
}

function resetWorkspace() {
  stopPolling();
  closeMismatchModal();
  state.file = null;
  state.parsedEntries = [];
  state.parsedPage = 1;
  state.parsedCategoryFilter = "ALL";
  state.reportEntries = [];
  state.reportFilter = "ALL";
  state.reportCategoryFilter = "ALL";
  state.reportSearch = "";
  state.reportPage = 1;
  state.duplicates = [];
  state.currentJobId = "";
  state.activeMismatchRow = null;
  if (els.bibFile) {
    els.bibFile.value = "";
  }
  els.reportSearchInput.value = "";
  els.reportFilters.forEach((chip) => {
    chip.classList.toggle("active", chip.dataset.filter === "ALL");
  });
  els.reportCategoryFilters.forEach((chip) => {
    chip.classList.toggle("active", chip.dataset.reportCategoryFilter === "ALL");
  });
  els.parsedCategoryFilters.forEach((chip) => {
    chip.classList.toggle("active", chip.dataset.parsedFilter === "ALL");
  });
  syncWorkspaceMode();
  setFile(null);
  renderEntries([]);
  renderDuplicates([]);
  renderReport([]);
  updateDownloadLinks("", false);
  activateTab("parsed");
  renderHistory();
  showToast(t("toast.new_session"));
}

function openSourcesModal() {
  els.sourcesModal.classList.remove("hidden");
}

function closeSourcesModal() {
  els.sourcesModal.classList.add("hidden");
}

function openMismatchModal(row) {
  const details = row.mismatch_details;
  if (!details) {
    return;
  }
  state.activeMismatchRow = row;
  const evidence = details.evidence || {};
  const recommendationUrl = details.recommendation_url || evidence.url || "";
  els.mismatchModalSubtitle.textContent = row.input_title || row.title || row.key || t("details.mismatch_fallback");
  els.mismatchModalBody.innerHTML = `
    <section class="mismatch-section">
      <h3>${escapeHtml(t("details.raw_bib"))}</h3>
      <pre class="bib-code">${formatHighlightedBib(details.highlighted_raw_bib || row.raw_bib || "")}</pre>
    </section>
    <section class="mismatch-section">
      <h3>${escapeHtml(t("details.evidence"))}</h3>
      <div class="paper-detail-grid">
        <div><strong>${escapeHtml(t("details.source_label"))}</strong><span>${escapeHtml(evidence.source || "-")}</span></div>
        <div><strong>${escapeHtml(t("details.title_label"))}</strong><span>${escapeHtml(evidence.title || "-")}</span></div>
        <div><strong>${escapeHtml(t("details.authors_label"))}</strong><span>${escapeHtml((evidence.authors || []).join(", ") || "-")}</span></div>
        <div><strong>${escapeHtml(t("details.year_label"))}</strong><span>${escapeHtml(String(evidence.year || "-"))}</span></div>
        <div><strong>${escapeHtml(t("details.venue_label"))}</strong><span>${escapeHtml(evidence.venue || "-")}</span></div>
        <div><strong>${escapeHtml(t("details.doi"))}</strong><span>${escapeHtml(evidence.doi || "-")}</span></div>
      </div>
      ${
        recommendationUrl
          ? `<p class="mismatch-link"><a href="${escapeHtml(recommendationUrl)}" target="_blank" rel="noreferrer">${escapeHtml(t("details.open_reference"))}</a></p>`
          : ""
      }
    </section>
    <section class="mismatch-section">
      <h3>${escapeHtml(t("details.raw_bib_recommended"))}</h3>
      <textarea class="bib-editor" id="recommendedBibEditor" spellcheck="false">${escapeHtml(details.recommended_bib || "")}</textarea>
    </section>
  `;
  els.mismatchModal.classList.remove("hidden");
}

function closeMismatchModal() {
  state.activeMismatchRow = null;
  els.mismatchModal.classList.add("hidden");
}

function formatHighlightedBib(value) {
  return escapeHtml(value)
    .replaceAll("[[[HIGHLIGHT]]]", '<mark class="bib-highlight">')
    .replaceAll("[[[/HIGHLIGHT]]]", "</mark>");
}

function getCategoryMeta(value) {
  const normalized = value === "github" ? "github" : value === "blog" ? "blog" : value === "web" ? "blog" : "paper";
  const label = getCategoryLabel(normalized);
  return { normalized, label };
}

function getParsedCategoryCounts(entries) {
  const counts = { paper: 0, blog: 0, github: 0 };
  entries.forEach((entry) => {
    const { normalized } = getCategoryMeta(entry.reference_category || entry.record_kind || "paper");
    counts[normalized] += 1;
  });
  return counts;
}

function activateTab(name) {
  els.tabButtons.forEach((button) => {
    button.classList.toggle("active", button.dataset.tab === name);
  });
  els.resultPanels.forEach((panel) => {
    panel.classList.toggle("active", panel.dataset.panel === name);
  });
}

function updateDownloadLinks(jobId, reportReady) {
  const hasJob = Boolean(jobId);
  els.downloadJsonLink.href = reportReady ? `/api/v1/jobs/${jobId}/report.json` : "#";
  els.downloadXlsxLink.href = reportReady ? `/api/v1/jobs/${jobId}/report.xlsx` : "#";
  els.downloadBibLink.href = hasJob ? `/api/v1/jobs/${jobId}/modified.bib` : "#";
  els.downloadJsonLink.classList.toggle("disabled-link", !reportReady);
  els.downloadXlsxLink.classList.toggle("disabled-link", !reportReady);
  els.downloadBibLink.classList.toggle("disabled-link", !hasJob);
}

async function applyMismatchCorrection() {
  if (!state.currentJobId || !state.activeMismatchRow) {
    showToast(t("toast.no_correction"), true);
    return;
  }
  const editor = document.getElementById("recommendedBibEditor");
  const bibText = editor?.value?.trim() || "";
  if (!bibText) {
    showToast(t("toast.empty_recommendation"), true);
    return;
  }
  els.applyMismatchButton.disabled = true;
  try {
    await fetchJson(`/api/v1/jobs/${state.currentJobId}/apply-correction`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        key: state.activeMismatchRow.key,
        bib_text: bibText,
      }),
    });
    const currentRow = state.activeMismatchRow;
    const target = state.reportEntries.find((row) => row.key === currentRow.key);
    if (target) {
      target.raw_bib = bibText;
      if (target.mismatch_details) {
        target.mismatch_details.recommended_bib = bibText;
      }
    }
    renderReport(state.reportEntries);
    updateDownloadLinks(state.currentJobId, true);
    closeMismatchModal();
    showToast(t("toast.correction_applied"));
  } catch (error) {
    showToast(error.message, true);
  } finally {
    els.applyMismatchButton.disabled = false;
  }
}

function renderHistory() {
  if (!state.jobs.length) {
    els.historyList.innerHTML = `<div class="history-empty">${escapeHtml(t("sidebar.empty"))}</div>`;
    return;
  }
  els.historyList.innerHTML = "";
  state.jobs.forEach((job) => {
    const item = document.createElement("button");
    item.type = "button";
    item.className = `history-item${job.job_id === state.currentJobId ? " active" : ""}`;
    item.innerHTML = `
      <span class="history-title">${escapeHtml(job.filename || "Untitled job")}</span>
      <span class="history-meta">${escapeHtml(translateJobStatus(job.status))} · ${new Date(job.updated_at * 1000).toLocaleString()}</span>
    `;
    item.addEventListener("click", () => {
      loadJob(job.job_id).catch((error) => showToast(error.message, true));
    });
    els.historyList.appendChild(item);
  });
}

function renderSources() {
  els.sourceList.innerHTML = "";
  const descriptionMap = {
    arxiv: t("source.description.arxiv"),
    serpapi: t("source.description.serpapi"),
    "scholar-html": t("source.description.scholar-html"),
    crossref: t("source.description.crossref"),
    openalex: t("source.description.openalex"),
  };

  state.sources.forEach((source, index) => {
    const card = document.createElement("article");
    card.className = `source-card${source.enabled ? " enabled" : ""}`;
    const statusLabel = source.enabled ? (state.locale === "zh" ? "已启用" : "Enabled") : (state.locale === "zh" ? "已停用" : "Disabled");
    const apiTag = source.supports_api_key ? (state.locale === "zh" ? "支持 API Key" : "API Key") : (state.locale === "zh" ? "无需 Key" : "No key");
    const proxyTag = source.supports_proxy ? (state.locale === "zh" ? "支持代理" : "Proxy") : (state.locale === "zh" ? "不支持代理" : "No proxy");
    card.innerHTML = `
      <div class="source-header">
        <div class="source-copy">
          <div class="source-title-row">
            <h3>${source.name}</h3>
            <span class="source-status-pill${source.enabled ? " enabled" : ""}">${statusLabel}</span>
          </div>
          <p class="source-desc">${descriptionMap[source.name] || t("source.description.default")}</p>
          <div class="source-meta-row">
            <p class="source-meta">${escapeHtml(t("source.priority", { index: index + 1 }))}</p>
            <div class="source-tags">
              <span class="source-tag">${apiTag}</span>
              <span class="source-tag">${proxyTag}</span>
            </div>
          </div>
        </div>
        <label class="source-switch" aria-label="${source.name}">
          <input class="source-toggle" type="checkbox" ${source.enabled ? "checked" : ""} data-role="enabled" data-name="${source.name}" />
          <span class="source-switch-ui"></span>
        </label>
      </div>
      <div class="source-list-fields">
        <label class="field">
          <span>${escapeHtml(t("source.api_key"))}</span>
          <input class="text-input" type="text" placeholder="${escapeHtml(source.supports_api_key ? t("source.enter_api_key") : t("source.not_required"))}" value="${source.api_key || ""}" data-role="api_key" data-name="${source.name}" ${source.supports_api_key ? "" : "disabled"} />
        </label>
        <label class="field">
          <span>${escapeHtml(t("source.proxy"))}</span>
          <input class="text-input" type="text" placeholder="${escapeHtml(source.supports_proxy ? "http://host:port" : t("source.not_supported"))}" value="${source.proxy || ""}" data-role="proxy" data-name="${source.name}" ${source.supports_proxy ? "" : "disabled"} />
        </label>
      </div>
    `;
    els.sourceList.appendChild(card);
  });
}

function getDefaultEnabled(name) {
  return name !== "scholar-html";
}

function enableAllSources() {
  state.sources = state.sources.map((source) => ({ ...source, enabled: true }));
  renderSources();
}

function resetSourceDefaults() {
  state.sources = state.sources.map((source) => ({
    ...source,
    enabled: getDefaultEnabled(source.name),
    api_key: "",
    proxy: "",
  }));
  renderSources();
}

function renderEntries(entries) {
  els.entriesTableBody.innerHTML = "";
  const counts = getParsedCategoryCounts(entries);
  els.parsedCategoryFilters.forEach((chip) => {
    const filter = chip.dataset.parsedFilter || "ALL";
    const count = filter === "ALL" ? entries.length : counts[filter] || 0;
    const label = getCategoryLabel(filter);
    chip.textContent = `${label} ${count}`;
    chip.classList.toggle("active", state.parsedCategoryFilter === filter);
  });

  const filteredEntries = entries.filter((entry) => {
    if (state.parsedCategoryFilter === "ALL") {
      return true;
    }
    const { normalized } = getCategoryMeta(entry.reference_category || entry.record_kind || "paper");
    return normalized === state.parsedCategoryFilter;
  });

  if (!entries.length) {
    els.parsedPlaceholder.classList.remove("hidden");
    els.parsedTableShell.classList.add("hidden");
    els.parsedPagination.classList.add("hidden");
    return;
  }
  if (!filteredEntries.length) {
    els.parsedPlaceholder.textContent = t("placeholder.parsed_empty_filter");
    els.parsedPlaceholder.classList.remove("hidden");
    els.parsedTableShell.classList.add("hidden");
    els.parsedPagination.classList.add("hidden");
    return;
  }
  els.parsedPlaceholder.textContent = t("placeholder.parsed");
  els.parsedPlaceholder.classList.add("hidden");
  els.parsedTableShell.classList.remove("hidden");
  const totalPages = Math.max(1, Math.ceil(filteredEntries.length / state.parsedPageSize));
  state.parsedPage = Math.min(Math.max(1, state.parsedPage), totalPages);
  const start = (state.parsedPage - 1) * state.parsedPageSize;
  const end = start + state.parsedPageSize;
  filteredEntries.slice(start, end).forEach((entry) => {
    const card = document.createElement("article");
    card.className = "paper-row";
    const { normalized: category, label: categoryLabel } = getCategoryMeta(entry.reference_category || entry.record_kind || "paper");
    card.innerHTML = `
      <div class="paper-row-head">
        <div class="paper-row-title-block">
          <span class="type-badge type-${escapeHtml(category)}">${escapeHtml(categoryLabel)}</span>
          <h4 class="paper-title">${escapeHtml(entry.title || entry.key || "")}</h4>
        </div>
        <span class="meta-chip">${escapeHtml(String(entry.year || t("unknown.year")))}</span>
      </div>
      <p class="paper-authors">${escapeHtml((entry.authors || []).join(", ") || t("unknown.authors"))}</p>
      <p class="paper-venue">${escapeHtml(entry.venue || t("unknown.venue"))}</p>
      <details class="paper-details">
        <summary>${escapeHtml(t("details.summary"))}</summary>
        <div class="paper-detail-grid">
          <div><strong>${escapeHtml(t("details.category"))}</strong><span>${escapeHtml(categoryLabel)}</span></div>
          <div><strong>${escapeHtml(t("details.key"))}</strong><span>${escapeHtml(entry.key || "")}</span></div>
          <div><strong>${escapeHtml(t("details.type"))}</strong><span>${escapeHtml(entry.entry_type || "")}</span></div>
          <div><strong>${escapeHtml(t("details.doi"))}</strong><span>${escapeHtml(entry.doi || "-")}</span></div>
          <div><strong>${escapeHtml(t("details.url"))}</strong><span>${escapeHtml(entry.url || "-")}</span></div>
        </div>
        <div class="bib-quote">
          <strong>${escapeHtml(t("details.raw_bib"))}</strong>
          <pre>${escapeHtml(entry.raw || "")}</pre>
        </div>
      </details>
    `;
    els.entriesTableBody.appendChild(card);
  });
  els.parsedPagination.classList.remove("hidden");
  els.parsedPaginationMeta.textContent = t("pagination.meta", { page: state.parsedPage, total: totalPages });
  els.parsedPrevButton.disabled = state.parsedPage <= 1;
  els.parsedNextButton.disabled = state.parsedPage >= totalPages;
}

function renderDuplicates(groups) {
  els.duplicateCountPill.textContent = t("duplicate.groups", { count: groups.length });
  if (!groups.length) {
    els.duplicatesPlaceholder.classList.remove("hidden");
    els.duplicateList.classList.add("hidden");
    els.duplicateList.innerHTML = "";
    return;
  }
  els.duplicatesPlaceholder.classList.add("hidden");
  els.duplicateList.classList.remove("hidden");
  els.duplicateList.innerHTML = "";
  groups.forEach((group) => {
    const block = document.createElement("article");
    block.className = "duplicate-card";
    block.innerHTML = `
      <h4>${escapeHtml(group.duplicate_type)} · ${escapeHtml(group.value)}</h4>
      <p><strong>${escapeHtml(t("duplicate.keys"))}:</strong> ${escapeHtml((group.keys || []).join(", "))}</p>
      <p><strong>${escapeHtml(t("duplicate.titles"))}:</strong> ${escapeHtml((group.titles || []).join(" | "))}</p>
    `;
    els.duplicateList.appendChild(block);
  });
}

function verdictClass(verdict) {
  if (verdict === "FOUND_MATCH") {
    return "verdict-match";
  }
  if (verdict === "FOUND_MISMATCH") {
    return "verdict-mismatch";
  }
  return "verdict-missing";
}

function renderReport(entries) {
  state.reportEntries = entries;
  updateReportFilterLabels(entries);
  updateReportCategoryFilterLabels(entries);
  els.reportTableBody.innerHTML = "";
  const filteredEntries = getFilteredReportEntries(entries);
  if (!entries.length) {
    els.reportToolbar.classList.add("hidden");
    els.reportPlaceholder.classList.remove("hidden");
    els.reportTableShell.classList.add("hidden");
    els.reportPagination.classList.add("hidden");
    return;
  }
  els.reportToolbar.classList.remove("hidden");
  if (!filteredEntries.length) {
    els.reportPlaceholder.textContent = "当前筛选条件下没有结果。";
    els.reportPlaceholder.classList.remove("hidden");
    els.reportTableShell.classList.add("hidden");
    els.reportPagination.classList.add("hidden");
    return;
  }
  els.reportPlaceholder.textContent = "运行验证任务后，这里会显示最终报告。";
  els.reportPlaceholder.classList.add("hidden");
  els.reportTableShell.classList.remove("hidden");
  const totalPages = Math.max(1, Math.ceil(filteredEntries.length / state.reportPageSize));
  state.reportPage = Math.min(Math.max(1, state.reportPage), totalPages);
  const start = (state.reportPage - 1) * state.reportPageSize;
  const end = start + state.reportPageSize;
  filteredEntries.slice(start, end).forEach((row) => {
    const card = document.createElement("article");
    card.className = "paper-row";
    const source = row.checked_source || row.source || "";
    const authors = Array.isArray(row.input_authors_list) ? row.input_authors_list.join(", ") : row.input_authors || "";
    const { normalized: category, label: categoryLabel } = getCategoryMeta(row.reference_category || row.record_kind || "paper");
    const mismatchAction =
      row.verdict === "FOUND_MISMATCH" && row.mismatch_details
        ? `<button class="detail-link-button" type="button" data-mismatch-key="${escapeHtml(row.key || "")}">${escapeHtml(t("details.suggestion_button"))}</button>`
        : "";
    card.innerHTML = `
      <div class="paper-row-head">
        <div class="paper-row-title-block">
          <span class="verdict-badge ${verdictClass(row.verdict)}">${escapeHtml(getVerdictLabel(row.verdict || ""))}</span>
          <span class="type-badge type-${escapeHtml(category)}">${escapeHtml(categoryLabel)}</span>
        </div>
        <span class="meta-chip">${escapeHtml(String(row.input_year || row.year || t("unknown.year")))}</span>
      </div>
      <p class="report-card-title">${escapeHtml(row.input_title || row.title || row.key || "")}</p>
      <p class="paper-authors">${escapeHtml(authors || t("unknown.authors"))}</p>
      <p class="paper-venue">${escapeHtml(row.input_venue || row.venue || t("unknown.venue"))}</p>
      <details class="paper-details">
        <summary>${escapeHtml(t("details.summary"))}</summary>
        <div class="paper-detail-grid">
          <div><strong>${escapeHtml(t("details.category"))}</strong><span>${escapeHtml(categoryLabel)}</span></div>
          <div><strong>${escapeHtml(t("details.key"))}</strong><span>${escapeHtml(row.key || "")}</span></div>
          <div><strong>${escapeHtml(t("details.source"))}</strong><span>${escapeHtml(source || "-")}</span></div>
          <div><strong>${escapeHtml(t("details.issues"))}</strong><span>${escapeHtml(row.issues || "-")}</span></div>
          <div><strong>${escapeHtml(t("details.reason"))}</strong><span>${escapeHtml(row.reason || "-")}</span></div>
        </div>
        <div class="bib-quote">
          <strong>${escapeHtml(t("details.raw_bib"))}</strong>
          <pre>${escapeHtml(row.raw_bib || "")}</pre>
        </div>
        ${mismatchAction ? `<div class="mismatch-action-row">${mismatchAction}</div>` : ""}
      </details>
    `;
    els.reportTableBody.appendChild(card);
    if (row.verdict === "FOUND_MISMATCH" && row.mismatch_details) {
      const button = card.querySelector("[data-mismatch-key]");
      button?.addEventListener("click", () => openMismatchModal(row));
    }
  });
  els.reportPagination.classList.remove("hidden");
  els.reportPaginationMeta.textContent = t("pagination.meta", { page: state.reportPage, total: totalPages });
  els.reportPrevButton.disabled = state.reportPage <= 1;
  els.reportNextButton.disabled = state.reportPage >= totalPages;
}

function updateReportFilterLabels(entries) {
  const counts = {
    ALL: entries.length,
    FOUND_MATCH: 0,
    FOUND_MISMATCH: 0,
    NOT_FOUND: 0,
  };
  entries.forEach((row) => {
    if (counts[row.verdict] !== undefined) {
      counts[row.verdict] += 1;
    }
  });
  els.reportFilters.forEach((button) => {
    const filter = button.dataset.filter || "ALL";
    button.textContent = `${getVerdictFilterLabel(filter)} ${counts[filter] ?? 0}`;
  });
}

function updateReportCategoryFilterLabels(entries) {
  const counts = { ALL: entries.length, paper: 0, blog: 0, github: 0 };
  entries.forEach((row) => {
    const { normalized } = getCategoryMeta(row.reference_category || row.record_kind || "paper");
    counts[normalized] += 1;
  });
  els.reportCategoryFilters.forEach((button) => {
    const filter = button.dataset.reportCategoryFilter || "ALL";
    const label = getCategoryLabel(filter);
    button.textContent = `${label} ${counts[filter] ?? 0}`;
    button.classList.toggle("active", state.reportCategoryFilter === filter);
  });
}

function getFilteredReportEntries(entries) {
  const query = state.reportSearch.trim().toLowerCase();
  return entries.filter((row) => {
    const matchesVerdict = state.reportFilter === "ALL" || row.verdict === state.reportFilter;
    const matchesCategory =
      state.reportCategoryFilter === "ALL" ||
      getCategoryMeta(row.reference_category || row.record_kind || "paper").normalized === state.reportCategoryFilter;
    if (!matchesVerdict || !matchesCategory) {
      return false;
    }
    if (!query) {
      return true;
    }
    const authors = Array.isArray(row.input_authors_list) ? row.input_authors_list.join(" ") : row.input_authors || "";
    const haystack = [
      row.input_title,
      row.title,
      authors,
      row.input_venue,
      row.venue,
      row.key,
    ]
      .filter(Boolean)
      .join(" ")
      .toLowerCase();
    return haystack.includes(query);
  });
}

async function fetchJson(url, options = {}) {
  const response = await fetch(url, options);
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(payload.detail || payload.message || `Request failed: ${response.status}`);
  }
  return payload;
}

async function loadSources() {
  const payload = await fetchJson("/api/v1/sources");
  state.sources = (payload.sources || []).map((source) => ({
    ...source,
    enabled: getDefaultEnabled(source.name),
    api_key: "",
    proxy: "",
  }));
  renderSources();
}

async function loadJobs() {
  const payload = await fetchJson("/api/v1/jobs");
  state.jobs = payload.jobs || [];
  renderHistory();
}

function collectSourceConfig() {
  const fields = els.sourceList.querySelectorAll("[data-name]");
  const sourceMap = new Map(state.sources.map((source) => [source.name, { ...source }]));
  fields.forEach((field) => {
    const { name, role } = field.dataset;
    const source = sourceMap.get(name);
    if (!source) {
      return;
    }
    if (role === "enabled") {
      source.enabled = field.checked;
    } else if (role === "api_key") {
      source.api_key = field.value.trim();
    } else if (role === "proxy") {
      source.proxy = field.value.trim();
    }
  });
  return Array.from(sourceMap.values()).map((source) => ({
    name: source.name,
    enabled: source.enabled,
    api_key: source.api_key,
    proxy: source.proxy,
  }));
}

async function parseBib() {
  if (!state.file) {
    showToast(t("toast.choose_file"), true);
    return;
  }
  setStatusKey("status.parsing");
  const form = new FormData();
  form.append("file", state.file);
  const payload = await fetchJson("/api/v1/bib/parse", {
    method: "POST",
    body: form,
  });
  state.parsedEntries = payload.entries || [];
  state.parsedPage = 1;
  state.duplicates = payload.duplicates || [];
  updateProgress(0, 0, 0, "");
  renderEntries(state.parsedEntries);
  renderDuplicates(state.duplicates);
  renderReport([]);
  activateTab("parsed");
  showToast(t("toast.parsed", { count: payload.entry_count || 0 }));
  setStatusKey("status.parse_complete");
}

function buildOptionsPayload() {
  return {
    source_order: collectSourceConfig(),
  };
}

function stopPolling() {
  if (state.pollingTimer) {
    window.clearInterval(state.pollingTimer);
    state.pollingTimer = null;
  }
}

async function loadJob(jobId) {
  const payload = await fetchJson(`/api/v1/jobs/${jobId}`);
  state.currentJobId = payload.job_id;
  state.parsedEntries = payload.parsed_entries || [];
  state.parsedPage = 1;
  syncWorkspaceMode();
  state.reportPage = 1;
  updateProgress(payload.processed_entries || 0, payload.total_entries || 0, payload.progress || 0, payload.progress_message || "");
  renderHistory();
  renderEntries(state.parsedEntries);
  renderDuplicates(payload.duplicates || payload.result?.duplicates || []);
  renderReport(payload.result?.entries || []);
  updateDownloadLinks(payload.job_id, payload.status === "completed");
  setStatusKey("status.job_label", { filename: payload.filename, status: translateJobStatus(payload.status) });
  activateTab(payload.status === "completed" ? "report" : "duplicates");
}

async function refreshJob() {
  if (!state.currentJobId) {
    await loadJobs();
    showToast(t("toast.history_refreshed"));
    return;
  }
  const payload = await fetchJson(`/api/v1/jobs/${state.currentJobId}`);
  state.parsedEntries = payload.parsed_entries || state.parsedEntries;
  state.parsedPage = 1;
  state.reportPage = 1;
  updateProgress(payload.processed_entries || 0, payload.total_entries || 0, payload.progress || 0, payload.progress_message || "");
  renderEntries(state.parsedEntries);
  renderDuplicates(payload.duplicates || payload.result?.duplicates || []);
  renderReport(payload.result?.entries || []);
  updateDownloadLinks(payload.job_id, payload.status === "completed");
  await loadJobs();
  if (payload.status === "completed") {
    stopPolling();
    activateTab("report");
    showToast(t("toast.verify_completed"));
    setStatusKey("status.completed");
  } else if (payload.status === "failed") {
    stopPolling();
    showToast(payload.error || t("status.failed"), true);
    setStatusKey("status.failed");
  } else {
    setStatusKey("status.job_running", { status: translateJobStatus(payload.status) });
  }
}

async function createJob() {
  if (!state.file) {
    showToast(t("toast.choose_file"), true);
    return;
  }
  const form = new FormData();
  form.append("file", state.file);
  form.append("options_json", JSON.stringify(buildOptionsPayload()));
  setStatusKey("status.creating_job");
  const payload = await fetchJson("/api/v1/jobs", {
    method: "POST",
    body: form,
  });
  state.currentJobId = payload.job_id;
  syncWorkspaceMode();
  state.reportPage = 1;
  updateProgress(0, 0, 0, t("progress.preparing"));
  updateDownloadLinks(payload.job_id, false);
  stopPolling();
  await loadJobs();
  state.pollingTimer = window.setInterval(() => {
    refreshJob().catch((error) => {
      stopPolling();
      showToast(error.message, true);
    });
  }, 2500);
  showToast(t("toast.verify_created"));
  setStatusKey("status.job_created");
}

function setupUploadInteractions() {
  const uploadCard = document.querySelector(".upload-card");
  if (!uploadCard) {
    return;
  }
  ["dragenter", "dragover"].forEach((eventName) => {
    uploadCard.addEventListener(eventName, (event) => {
      event.preventDefault();
      uploadCard.classList.add("dragover");
    });
  });
  ["dragleave", "drop"].forEach((eventName) => {
    uploadCard.addEventListener(eventName, (event) => {
      event.preventDefault();
      uploadCard.classList.remove("dragover");
    });
  });
  uploadCard.addEventListener("drop", (event) => {
    const [file] = event.dataTransfer.files || [];
    if (file) {
      setFile(file);
    }
  });
}

function wireEvents() {
  els.bibFile.addEventListener("change", (event) => {
    const [file] = event.target.files || [];
    setFile(file || null);
  });
  els.parseButton.addEventListener("click", () => {
    parseBib().catch((error) => {
      showToast(error.message, true);
      setStatusKey("status.parsing_failed");
    });
  });
  els.runButton.addEventListener("click", () => {
    createJob().catch((error) => {
      showToast(error.message, true);
      setStatusKey("status.job_creation_failed");
    });
  });
  els.refreshJobButton.addEventListener("click", () => {
    refreshJob().catch((error) => showToast(error.message, true));
  });
  els.newSessionButton.addEventListener("click", resetWorkspace);
  els.languageToggleButton.addEventListener("click", toggleLocale);
  els.parsedPrevButton.addEventListener("click", () => {
    if (state.parsedPage > 1) {
      state.parsedPage -= 1;
      renderEntries(state.parsedEntries);
    }
  });
  els.parsedNextButton.addEventListener("click", () => {
    const filteredCount = state.parsedEntries.filter((entry) => {
      if (state.parsedCategoryFilter === "ALL") {
        return true;
      }
      return getCategoryMeta(entry.reference_category || entry.record_kind || "paper").normalized === state.parsedCategoryFilter;
    }).length;
    const totalPages = Math.max(1, Math.ceil(filteredCount / state.parsedPageSize));
    if (state.parsedPage < totalPages) {
      state.parsedPage += 1;
      renderEntries(state.parsedEntries);
    }
  });
  els.parsedCategoryFilters.forEach((button) => {
    button.addEventListener("click", () => {
      state.parsedCategoryFilter = button.dataset.parsedFilter || "ALL";
      state.parsedPage = 1;
      renderEntries(state.parsedEntries);
    });
  });
  els.reportPrevButton.addEventListener("click", () => {
    if (state.reportPage > 1) {
      state.reportPage -= 1;
      renderReport(state.reportEntries);
    }
  });
  els.reportNextButton.addEventListener("click", () => {
    const totalPages = Math.max(1, Math.ceil(getFilteredReportEntries(state.reportEntries).length / state.reportPageSize));
    if (state.reportPage < totalPages) {
      state.reportPage += 1;
      renderReport(state.reportEntries);
    }
  });
  els.reportFilters.forEach((button) => {
    button.addEventListener("click", () => {
      state.reportFilter = button.dataset.filter || "ALL";
      state.reportPage = 1;
      els.reportFilters.forEach((chip) => chip.classList.toggle("active", chip === button));
      renderReport(state.reportEntries);
    });
  });
  els.reportCategoryFilters.forEach((button) => {
    button.addEventListener("click", () => {
      state.reportCategoryFilter = button.dataset.reportCategoryFilter || "ALL";
      state.reportPage = 1;
      renderReport(state.reportEntries);
    });
  });
  els.reportSearchInput.addEventListener("input", (event) => {
    state.reportSearch = event.target.value || "";
    state.reportPage = 1;
    renderReport(state.reportEntries);
  });
  els.openSourcesButton.addEventListener("click", openSourcesModal);
  els.enableAllSourcesButton.addEventListener("click", enableAllSources);
  els.resetSourcesButton.addEventListener("click", resetSourceDefaults);
  els.closeSourcesButton.addEventListener("click", closeSourcesModal);
  els.closeMismatchButton.addEventListener("click", closeMismatchModal);
  els.applyMismatchButton.addEventListener("click", () => {
    applyMismatchCorrection().catch((error) => showToast(error.message, true));
  });
  els.sourcesModal.addEventListener("click", (event) => {
    if (event.target === els.sourcesModal) {
      closeSourcesModal();
    }
  });
  els.mismatchModal.addEventListener("click", (event) => {
    if (event.target === els.mismatchModal) {
      closeMismatchModal();
    }
  });
  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape") {
      closeSourcesModal();
      closeMismatchModal();
    }
  });
  els.tabButtons.forEach((button) => {
    button.addEventListener("click", () => activateTab(button.dataset.tab));
  });
}

async function init() {
  setupUploadInteractions();
  wireEvents();
  activateTab("parsed");
  applyLocale();
  await Promise.all([loadSources(), loadJobs()]);
}

init().catch((error) => {
  showToast(error.message, true);
  setStatusKey("status.init_failed");
});
