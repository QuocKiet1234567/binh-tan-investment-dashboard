const STORAGE_KEY = "bt_project_dashboard_data";
const AUTH_KEY = "bt_project_dashboard_auth";
const SYNC_META_KEY = "bt_project_dashboard_sync";
const CONFLICT_BACKUP_KEY = "bt_project_dashboard_conflict_backup";
const SUPABASE_URL = "https://anfttfidxjghbcoyjmhy.supabase.co";
const SUPABASE_KEY = "sb_publishable_AlYPyUMWW26OO1KOWqyH4Q_xNMyzO35";
const REMOTE_STATE_ID = "main";
const SOURCE_FILE_BUCKET = "source-files";

let supabaseClient = null;
let currentSession = null;
let remoteStateUpdatedAt = null;
let remoteSaveQueue = Promise.resolve(true);
let remoteConflictNotified = false;
let reportSaveTimer = null;

const state = {
  projects: [],
  reportText: "",
  files: [],
  importHistory: [],
  auditLog: [],
  reportConfig: {},
  electronicForm: {},
  selectedProjectId: null,
  charts: {
    status: null,
    budget: null
  }
};

const demoProjects = [
  {
    stt: 1,
    name: "Nâng cấp, mở rộng đường số 6 phường Bình Tân, đoạn từ đường Tây Lân đến cuối tuyến",
    budget: 288,
    plan: 145,
    legal: "Đã phê duyệt chủ trương đầu tư và điều chỉnh chủ trương đầu tư",
    progress: "Đã phê duyệt dự án",
    disbursement: "Dự kiến giải ngân 100% kế hoạch vốn",
    difficulty: "",
    solution: "",
    evaluation: "Đảm bảo tiến độ",
    status: "Đảm bảo tiến độ"
  },
  {
    stt: 2,
    name: "Đầu tư công viên, cây xanh phường Bình Hưng Hòa B",
    budget: 141.044,
    plan: 1,
    legal: "Đã phê duyệt chủ trương đầu tư, chưa phê duyệt dự án",
    progress: "Tạm dừng ở bước lập quy hoạch tổng mặt bằng; dự kiến phê duyệt dự án trong quý III/2026",
    disbursement: "Có khả năng chậm giải ngân",
    difficulty: "Cần rà soát, hoàn chỉnh quy hoạch tổng mặt bằng",
    solution: "Tiếp tục tháo gỡ vướng mắc; xem xét điều chỉnh vốn phù hợp",
    evaluation: "Chậm tiến độ",
    status: "Chậm tiến độ"
  }
];

const els = {};
const SIDEBAR_STATE_KEY = "bt_sidebar_collapsed";

document.addEventListener("DOMContentLoaded", async () => {
  cacheElements();
  normalizeStaticLabels();
  restoreSidebarState();
  bindEvents();
  await initSupabase();

  if (currentSession) {
    await restoreState();
    showApp();
  } else {
    restoreStateFromLocal();
    showLogin();
  }
});

function cacheElements() {
  [
    "loginScreen", "appShell", "sidebarToggle", "loginForm", "loginUser", "loginPass", "rememberMe",
    "loginError", "logoutBtn", "pageTitle", "pageSub", "searchInput", "sourceSummary",
    "kpiProjects", "kpiBudget", "kpiPlan", "kpiAlerts", "statusSummary", "budgetSummary", "alertList", "fileInput",
    "chooseFileBtn", "dropZone", "analysisStatus", "analysisLog", "previewRows",
    "projectRows", "clearDataBtn", "addProjectBtn", "exportExcelBtn", "exportWordBtn",
    "reportText", "docStatus", "presentationNotes", "capitalRows", "capitalTotalPlan",
    "capitalSlowCount", "capitalHealthyRate", "periodicSummary", "periodicRows",
    "periodicExportBtn", "settingStorageStatus", "settingProjectCount",
    "settingsExportExcelBtn", "settingsClearBtn", "sheetUrlInput", "syncSheetBtn",
    "settingFileCount", "settingFileSize", "settingImportCount", "settingAuditCount",
    "settingsHealthBadge", "settingDatabaseBadge", "settingStorageDetail", "settingStorageBadge",
    "settingAccountDetail", "settingRoleBadge", "settingLastSync", "settingLocalSync",
    "settingStateId", "settingsTestConnectionBtn", "settingsBackupBtn", "settingsRestoreInput",
    "settingsRestoreBtn", "settingBackupStatus", "settingsRecentActivity",
    "reportTitleInput", "reportPeriodInput", "reportDateInput", "reportRecipientInput",
    "reportProjectCount", "reportTotalBudget", "reportTotalPlan", "reportSelectedCount",
    "reportPreviewTitle", "reportPreviewPeriod", "reportPreviewRecipient",
    "reportPreviewIssues", "reportReadiness", "reportIssueCount", "toggleReportIssuesBtn",
    "sourceHistory", "historySummary"
    , "projectStatusFilter", "projectGroupFilter", "backToProjectsBtn", "detailCode",
    "detailGroup", "detailName", "detailMeta", "detailBudget", "detailStatus",
    "detailLegal", "detailProgressDoc", "detailPlan", "detailDisbursed",
    "detailDisbRate", "detailRemaining", "detailContractValue", "detailProgressRate",
    "detailProgressBar", "detailDifficulty"
  ].forEach((id) => {
    els[id] = document.getElementById(id);
  });
}

function normalizeStaticLabels() {
  const projectsNav = document.querySelector('.nav-item[data-view="projectsView"]');
  if (projectsNav) {
    const icon = projectsNav.querySelector(".icon");
    projectsNav.textContent = "";
    if (icon) projectsNav.append(icon);
    const label = document.createElement("span");
    label.className = "nav-label";
    label.textContent = "Danh mục dự án";
    projectsNav.append(label);
  }

  document.querySelectorAll(".nav-item").forEach((item) => {
    const label = item.querySelector(".nav-label")?.textContent?.trim();
    if (!label) return;
    item.dataset.label = label;
    item.setAttribute("aria-label", label);
  });

  const progressPane = document.getElementById("progressPane");
  const progressLeft = progressPane?.querySelector(".progress-layout > div:first-child");
  if (progressLeft && !document.getElementById("detailPhotoInput")) {
    const photoUpload = document.createElement("div");
    photoUpload.className = "detail-upload-strip compact";
    photoUpload.innerHTML = `
      <div>
        <strong>Ảnh hiện trường</strong>
        <span>Chèn ảnh thi công để báo cáo có minh chứng trực quan.</span>
      </div>
      <input id="detailPhotoInput" type="file" multiple accept="image/*">
      <button id="detailPhotoBtn" class="secondary-btn" type="button">Chèn ảnh</button>
    `;
    progressLeft.append(photoUpload);
  }

  const photoGrid = progressPane?.querySelector(".site-photos");
  if (photoGrid && !photoGrid.id) {
    photoGrid.id = "detailPhotoGrid";
  }
}

function bindEvents() {
  els.sidebarToggle?.addEventListener("click", toggleSidebar);
  els.loginForm.addEventListener("submit", handleLogin);
  els.logoutBtn.addEventListener("click", handleLogout);
  els.chooseFileBtn.addEventListener("click", () => {
    els.fileInput.value = "";
    els.fileInput.click();
  });
  els.fileInput.addEventListener("change", async (event) => {
    await handleFiles([...event.target.files]);
    event.target.value = "";
  });
  els.syncSheetBtn?.addEventListener("click", handleGoogleSheetSync);
  els.searchInput.addEventListener("input", renderProjectsTable);
  els.projectStatusFilter.addEventListener("change", renderProjectsTable);
  els.projectGroupFilter.addEventListener("change", renderProjectsTable);
  els.backToProjectsBtn.addEventListener("click", () => switchView("projectsView"));
  els.clearDataBtn.addEventListener("click", clearData);
  els.addProjectBtn.addEventListener("click", addProject);
  els.exportExcelBtn.addEventListener("click", exportCsv);
  els.exportWordBtn.addEventListener("click", exportWord);
  els.periodicExportBtn.addEventListener("click", exportWord);
  ["reportTitleInput", "reportPeriodInput", "reportDateInput", "reportRecipientInput"].forEach((id) => {
    document.getElementById(id)?.addEventListener("input", updateReportConfiguration);
  });
  els.toggleReportIssuesBtn?.addEventListener("click", toggleAllReportIssues);
  els.periodicRows?.addEventListener("change", handleReportIssueSelection);
  els.periodicRows?.addEventListener("click", handleReportIssueOpen);
  els.settingsExportExcelBtn.addEventListener("click", exportCsv);
  els.settingsClearBtn.addEventListener("click", clearData);
  els.settingsTestConnectionBtn?.addEventListener("click", testSystemConnection);
  els.settingsBackupBtn?.addEventListener("click", exportSystemBackup);
  els.settingsRestoreBtn?.addEventListener("click", () => els.settingsRestoreInput?.click());
  els.settingsRestoreInput?.addEventListener("change", restoreSystemBackup);
  els.reportText.addEventListener("input", () => {
    state.reportText = els.reportText.value;
    persistState();
  });

  document.querySelectorAll(".nav-item").forEach((button) => {
    button.addEventListener("click", () => {
      if (button.dataset.view) switchView(button.dataset.view);
    });
  });

  document.querySelectorAll("[data-jump]").forEach((button) => {
    button.addEventListener("click", () => switchView(button.dataset.jump));
  });

  document.querySelectorAll(".detail-tab").forEach((button) => {
    button.addEventListener("click", () => showDetailTab(button.dataset.tab));
  });

  document.getElementById("detailFileBtn")?.addEventListener("click", () => {
    document.getElementById("detailFileInput")?.click();
  });
  document.getElementById("detailFileInput")?.addEventListener("change", async (event) => {
    await handleProjectAssetFiles([...event.target.files], "attachment");
    event.target.value = "";
  });
  document.getElementById("detailPhotoBtn")?.addEventListener("click", () => {
    document.getElementById("detailPhotoInput")?.click();
  });
  document.getElementById("detailPhotoInput")?.addEventListener("change", async (event) => {
    await handleProjectAssetFiles([...event.target.files], "photo");
    event.target.value = "";
  });
  document.getElementById("editProjectBtn")?.addEventListener("click", openProjectEditModal);
  document.getElementById("projectEditForm")?.addEventListener("submit", saveProjectEdits);
  document.getElementById("closeProjectEditBtn")?.addEventListener("click", closeProjectEditModal);
  document.getElementById("cancelProjectEditBtn")?.addEventListener("click", closeProjectEditModal);
  document.getElementById("projectEditModal")?.addEventListener("click", (event) => {
    if (event.target.id === "projectEditModal") closeProjectEditModal();
  });
  document.addEventListener("keydown", (event) => {
    const modal = document.getElementById("projectEditModal");
    if (event.key === "Escape" && modal && !modal.classList.contains("hidden")) {
      closeProjectEditModal();
    }
  });

  ["dragenter", "dragover"].forEach((name) => {
    els.dropZone.addEventListener(name, (event) => {
      event.preventDefault();
      els.dropZone.classList.add("dragging");
    });
  });

  ["dragleave", "drop"].forEach((name) => {
    els.dropZone.addEventListener(name, (event) => {
      event.preventDefault();
      els.dropZone.classList.remove("dragging");
    });
  });

  els.dropZone.addEventListener("drop", (event) => {
    els.fileInput.value = "";
    handleFiles([...event.dataTransfer.files]);
  });
}

function restoreSidebarState() {
  if (!els.appShell || window.matchMedia("(max-width: 1040px)").matches) return;
  const collapsed = localStorage.getItem(SIDEBAR_STATE_KEY) === "1";
  setSidebarCollapsed(collapsed, false);
}

function toggleSidebar() {
  if (!els.appShell || window.matchMedia("(max-width: 1040px)").matches) return;
  setSidebarCollapsed(!els.appShell.classList.contains("sidebar-collapsed"));
}

function setSidebarCollapsed(collapsed, persist = true) {
  els.appShell?.classList.toggle("sidebar-collapsed", collapsed);
  if (els.sidebarToggle) {
    const action = collapsed ? "Mở rộng" : "Thu gọn";
    els.sidebarToggle.setAttribute("aria-expanded", String(!collapsed));
    els.sidebarToggle.setAttribute("aria-label", `${action} thanh điều hướng`);
    els.sidebarToggle.removeAttribute("title");
  }
  if (persist) localStorage.setItem(SIDEBAR_STATE_KEY, collapsed ? "1" : "0");
  window.setTimeout(() => {
    state.charts.status?.resize();
    state.charts.budget?.resize();
  }, 260);
}

function handleLogin(event) {
  event.preventDefault();
  const user = els.loginUser.value.trim();
  const pass = els.loginPass.value.trim();

  if (!user || !pass) {
    els.loginError.textContent = "Vui lòng nhập tài khoản và mật khẩu.";
    return;
  }

  const payload = JSON.stringify({ user, role: "admin", loginAt: new Date().toISOString() });
  if (els.rememberMe.checked) {
    localStorage.setItem(AUTH_KEY, payload);
  } else {
    sessionStorage.setItem(AUTH_KEY, payload);
  }
  els.loginError.textContent = "";
  showApp();
}

function handleLogout() {
  localStorage.removeItem(AUTH_KEY);
  sessionStorage.removeItem(AUTH_KEY);
  els.loginPass.value = "";
  showLogin();
}

function getSavedAuth() {
  return sessionStorage.getItem(AUTH_KEY) || localStorage.getItem(AUTH_KEY);
}

function showLogin() {
  els.loginScreen.classList.remove("hidden");
  els.appShell.classList.add("hidden");
}

function showApp() {
  els.loginScreen.classList.add("hidden");
  els.appShell.classList.remove("hidden");
  applyPermissionUI();
  renderAll();
}

function switchView(viewId) {
  document.querySelectorAll(".view").forEach((view) => {
    view.classList.toggle("active", view.id === viewId);
  });
  document.querySelectorAll(".nav-item").forEach((item) => {
    item.classList.toggle("active", item.dataset.view === viewId);
  });

  const titleMap = {
    dashboardView: ["Bảng điều khiển tổng quan", ""],
    importView: ["Nhập & phân tích file", "Đọc Excel phụ lục và Word thuyết minh để tạo dữ liệu báo cáo."],
    projectsView: ["Danh mục dự án", "Bảng quản lý chính của toàn bộ dự án."],
    electronicFormView: ["Biểu mẫu điện tử", "Nhập và quản lý biểu mẫu báo cáo trực tiếp theo dạng bảng tính."],
    reportView: ["Báo cáo trình bày", "Tổng hợp nội dung để xếp sử dụng khi thuyết trình."],
    projectDetailView: ["Chi tiết hồ sơ dự án", ""],
    capitalView: ["Kế hoạch vốn", "Theo dõi kế hoạch vốn, giải ngân và điều chỉnh trong kỳ."],
    periodicView: ["Báo cáo & xuất file", "Tổng hợp nội dung phục vụ họp và báo cáo cấp trên."],
    settingsView: ["Cấu hình dữ liệu", "Quản trị dữ liệu, phiên làm việc và thao tác hệ thống."]
  };
  const [title, sub] = titleMap[viewId] || titleMap.dashboardView;
  els.pageTitle.textContent = title;
  els.pageSub.textContent = sub;
}

async function handleFiles(files) {
  if (!files.length) return;

  addLog(`Đã nhận ${files.length} file. Đang phân tích...`);
  els.analysisStatus.textContent = "Đang phân tích";

  const parsedProjects = [];

  for (const file of files) {
    const name = file.name.toLowerCase();
    state.files.push({ name: file.name, size: file.size, importedAt: new Date().toISOString() });

    try {
      if (name.endsWith(".xlsx") || name.endsWith(".xls")) {
        const rows = await readExcel(file);
        const projects = extractProjectsFromRows(rows);
        const source = recordImportHistory({
          type: "Excel",
          name: file.name,
          rowCount: rows.length,
          projectCount: projects.length,
          status: projects.length ? "Đã phân tích" : "Không nhận diện dự án",
          storageStatus: typeof fileRecord !== "undefined" ? fileRecord.storageStatus || "" : "",
          storagePath: typeof fileRecord !== "undefined" ? fileRecord.storagePath || "" : ""
        });
        parsedProjects.push(...markProjectsWithSource(projects, source.id, "Excel"));
        addLog(`Excel "${file.name}": đọc ${rows.length} dòng, nhận diện ${projects.length} dự án.`);
      } else if (name.endsWith(".docx")) {
        const text = await readDocx(file);
        state.reportText = cleanText(text);
        els.reportText.value = state.reportText;
        recordImportHistory({
          type: "Word",
          name: file.name,
          rowCount: Math.round(state.reportText.length / 1000),
          projectCount: 0,
          status: "Đã trích thuyết minh",
          storageStatus: typeof fileRecord !== "undefined" ? fileRecord.storageStatus || "" : "",
          storagePath: typeof fileRecord !== "undefined" ? fileRecord.storagePath || "" : ""
        });
        els.docStatus.textContent = `Đã đọc ${Math.round(state.reportText.length / 1000)}k ký tự từ Word`;
        addLog(`Word "${file.name}": trích xuất ${state.reportText.length.toLocaleString("vi-VN")} ký tự thuyết minh.`);
      } else {
        addLog(`Bỏ qua "${file.name}" vì chưa hỗ trợ định dạng này.`);
      }
    } catch (error) {
      addLog(`Không đọc được "${file.name}": ${error.message || error}`);
    }
  }

  if (parsedProjects.length) {
    state.projects = replaceProjectsFromExcelImport(parsedProjects);
    normalizeProjectNumbers();
  }

  els.analysisStatus.textContent = state.projects.length ? "Đã phân tích xong" : "Chưa có bảng dự án";
  els.fileInput.value = "";
  persistStateLocal();
  await saveRemoteState();
  renderAll();
  switchView("dashboardView");
}

function readExcel(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      try {
        if (!window.XLSX) {
          throw new Error("Thư viện đọc Excel chưa tải xong. Vui lòng refresh trang và thử lại.");
        }

        const workbook = XLSX.read(reader.result, { type: "array" });
        const sheetRows = workbook.SheetNames.map((sheetName) => {
          const sheet = workbook.Sheets[sheetName];
          const rows = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: "" });
          return { sheetName, rows };
        });
        const bestSheet = sheetRows.sort((a, b) => b.rows.length - a.rows.length)[0];
        resolve(bestSheet?.rows || []);
      } catch (error) {
        reject(error);
      }
    };
    reader.onerror = () => reject(reader.error);
    reader.readAsArrayBuffer(file);
  });
}

function readRowsFromCsvText(text) {
  if (!window.XLSX) {
    throw new Error("Thư viện đọc bảng chưa tải xong. Vui lòng refresh trang và thử lại.");
  }

  const workbook = XLSX.read(text, { type: "string" });
  const sheetRows = workbook.SheetNames.map((sheetName) => {
    const sheet = workbook.Sheets[sheetName];
    const rows = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: "" });
    return { sheetName, rows };
  });

  return sheetRows.sort((a, b) => b.rows.length - a.rows.length)[0]?.rows || [];
}

function buildGoogleSheetCsvUrl(input) {
  const raw = stringify(input).trim();
  if (!raw) throw new Error("Chưa nhập link Google Sheet.");

  const url = new URL(raw);
  const hashParams = new URLSearchParams(url.hash.replace(/^#/, ""));
  const gid = url.searchParams.get("gid") || hashParams.get("gid") || "0";

  if (url.searchParams.get("output") === "csv" || url.searchParams.get("format") === "csv" || url.search.includes("tqx=out:csv")) {
    return url.toString();
  }

  const publishedMatch = url.pathname.match(/\/spreadsheets\/d\/e\/([^/]+)/);
  if (publishedMatch) {
    return `https://docs.google.com/spreadsheets/d/e/${publishedMatch[1]}/pub?output=csv&gid=${encodeURIComponent(gid)}`;
  }

  const sheetMatch = url.pathname.match(/\/spreadsheets\/d\/([^/]+)/);
  if (sheetMatch) {
    return `https://docs.google.com/spreadsheets/d/${sheetMatch[1]}/export?format=csv&gid=${encodeURIComponent(gid)}`;
  }

  if (url.pathname.toLowerCase().endsWith(".csv")) return url.toString();

  throw new Error("Link này chưa nhận diện được. Hãy dùng link Google Sheet public hoặc link CSV.");
}

async function handleGoogleSheetSync() {
  const rawUrl = els.sheetUrlInput?.value.trim();
  if (!rawUrl) {
    addLog("Chưa nhập link Google Sheet.");
    return;
  }

  const button = els.syncSheetBtn;
  const oldText = button?.textContent;

  try {
    if (button) {
      button.disabled = true;
      button.textContent = "Đang đồng bộ...";
    }

    const csvUrl = buildGoogleSheetCsvUrl(rawUrl);
    addLog("Đang lấy dữ liệu từ Google Sheet...");
    const response = await fetch(`/api/google-sheet?url=${encodeURIComponent(csvUrl)}`);
    const text = await response.text();
    if (!response.ok) throw new Error(text || "Không lấy được dữ liệu Google Sheet.");

    const rows = readRowsFromCsvText(text);
    const projects = extractProjectsFromRows(rows);
    if (projects.length) {
      state.projects = mergeProjects(projects);
      normalizeProjectNumbers();
    }

    recordImportHistory({
      type: "Google Sheet",
      name: compactSentence(rawUrl, 92),
      url: rawUrl,
      rowCount: rows.length,
      projectCount: projects.length,
      status: projects.length ? "Đã đồng bộ" : "Không nhận diện dự án",
      storageStatus: "linked"
    });

    addLog(`Google Sheet: đọc ${rows.length} dòng, nhận diện ${projects.length} dự án.`);
    els.analysisStatus.textContent = projects.length ? "Đã đồng bộ Google Sheet" : "Sheet chưa có bảng dự án phù hợp";
    persistState();
    renderAll();
  } catch (error) {
    recordImportHistory({
      type: "Google Sheet",
      name: compactSentence(rawUrl, 92),
      url: rawUrl,
      rowCount: 0,
      projectCount: 0,
      status: "Lỗi đồng bộ",
      error: error.message || String(error)
    });
    addLog(`Không đồng bộ được Google Sheet: ${error.message || error}`);
    persistState();
    renderSourceHistory();
  } finally {
    if (button) {
      button.disabled = false;
      button.textContent = oldText || "Đồng bộ Sheet";
    }
  }
}

async function readDocx(file) {
  const arrayBuffer = await file.arrayBuffer();
  const result = await mammoth.extractRawText({ arrayBuffer });
  return result.value || "";
}

function extractProjectsFromRows(rows) {
  const projects = [];
  let headerIndex = rows.findIndex((row) => row.some((cell) => normalizeText(cell).includes("ten du an")));

  if (headerIndex < 0) {
    headerIndex = rows.findIndex((row) => row.some((cell) => normalizeText(cell).includes("du an")));
  }

  const header = rows[headerIndex] || [];
  const columnHeaders = buildColumnHeaders(rows, headerIndex);
  const nameIndex = findHeaderIndex(header, ["ten du an"]) ?? guessProjectNameIndex(rows, headerIndex + 1) ?? 2;
  const budgetIndex = findColumnHeaderIndex(columnHeaders, ["tong muc dau tu"])
    ?? findHeaderIndex(header, ["tong muc dau tu"])
    ?? 3;
  const totalPlanIndex = findColumnHeaderIndex(columnHeaders, ["tong", "ke hoach", "von", "2026"]);

  for (let index = Math.max(headerIndex + 1, 0); index < rows.length; index += 1) {
    const row = rows[index];
    const name = stringify(row[nameIndex]).trim();

    if (!isProjectRow(row, name)) continue;

    const periodIndex = row.findIndex((cell) => /\b20\d{2}\b/.test(stringify(cell)));
    const planEndIndex = periodIndex > budgetIndex ? periodIndex : budgetIndex + 5;
    const planCandidates = row
      .slice(budgetIndex + 1, planEndIndex)
      .map(toPlanNumber)
      .filter((value) => value > 0);
    const hasTotalPlan = totalPlanIndex != null && stringify(row[totalPlanIndex]) !== "";
    const totalPlan = hasTotalPlan ? toPlanNumber(row[totalPlanIndex]) : 0;
    const legalIndex = findFirstTextIndex(row, ["phê duyệt", "chủ trương", "pháp lý"], Math.max(5, periodIndex + 1));
    const progressIndex = findFirstTextIndex(row, ["đang", "chậm", "hoàn", "dự kiến", "tạm dừng", "rà soát"], legalIndex + 1);
    const evaluationIndex = findFirstTextIndex(row, ["đảm bảo", "chậm", "không"], progressIndex + 1);

    const project = {
      stt: projects.length + 1,
      name,
      budget: toMoneyNumber(row[budgetIndex]) || toNumber(row[budgetIndex]),
      plan: hasTotalPlan ? totalPlan : (planCandidates.length ? planCandidates[planCandidates.length - 1] : 0),
      legal: stringify(row[legalIndex] || ""),
      progress: stringify(row[progressIndex] || ""),
      disbursement: stringify(row[progressIndex + 1] || ""),
      difficulty: stringify(row[progressIndex + 2] || ""),
      solution: stringify(row[progressIndex + 3] || ""),
      evaluation: stringify(row[evaluationIndex] || row[row.length - 1] || ""),
      status: ""
    };

    project.status = deriveStatus(project);
    projects.push(project);
  }

  return projects;
}

function buildColumnHeaders(rows, headerIndex) {
  const start = Math.max(0, headerIndex - 4);
  const end = Math.min(rows.length - 1, headerIndex + 1);
  const columnCount = rows
    .slice(start, end + 1)
    .reduce((maximum, row) => Math.max(maximum, row.length), 0);

  return Array.from({ length: columnCount }, (_, columnIndex) => {
    const parts = [];
    for (let rowIndex = start; rowIndex <= end; rowIndex += 1) {
      const text = stringify(rows[rowIndex]?.[columnIndex]);
      if (text && !parts.includes(text)) parts.push(text);
    }
    return normalizeText(parts.join(" "));
  });
}

function findColumnHeaderIndex(columnHeaders, terms) {
  const normalizedTerms = terms.map(normalizeText);
  const indexes = [];
  columnHeaders.forEach((text, index) => {
    if (normalizedTerms.every((term) => text.includes(term))) indexes.push(index);
  });
  return indexes.length ? indexes[indexes.length - 1] : null;
}

function isProjectRow(row, name) {
  if (!name || name.length < 8) return false;
  const normalized = normalizeText(name);
  if (normalized.includes("tong") || normalized.includes("du an su dung")) return false;
  return row.some((cell) => toMoneyNumber(cell) > 0);
}

function findHeaderIndex(header, terms) {
  const normalizedTerms = terms.map(normalizeText);
  const index = header.findIndex((cell) => {
    const text = normalizeText(cell);
    return normalizedTerms.every((term) => text.includes(term));
  });
  return index >= 0 ? index : null;
}

function findFirstTextIndex(row, terms, start = 0) {
  const normalizedTerms = terms.map(normalizeText);
  for (let index = Math.max(0, start); index < row.length; index += 1) {
    const text = normalizeText(row[index]);
    if (text.length < 4 || toMoneyNumber(row[index]) > 0) continue;
    if (normalizedTerms.some((term) => text.includes(term))) return index;
  }
  return Math.max(0, start);
}

function guessProjectNameIndex(rows, start = 0) {
  const scores = new Map();

  rows.slice(Math.max(0, start), start + 30).forEach((row) => {
    row.forEach((cell, index) => {
      const text = stringify(cell);
      const normalized = normalizeText(text);
      if (text.length >= 14 && !normalized.includes("tong") && !/\b20\d{2}\b/.test(text) && toNumber(text) === 0) {
        scores.set(index, (scores.get(index) || 0) + text.length);
      }
    });
  });

  const best = [...scores.entries()].sort((a, b) => b[1] - a[1])[0];
  return best ? best[0] : null;
}

function deriveStatus(project) {
  const text = normalizeText([
    project.progress,
    project.disbursement,
    project.difficulty,
    project.evaluation
  ].join(" "));

  if (text.includes("cham") || text.includes("vuong") || text.includes("khong bao dam") || text.includes("tam dung")) {
    return "Cần xử lý";
  }
  if (text.includes("hoan thanh")) return "Hoàn thành";
  if (text.includes("dam bao") || text.includes("100")) return "Đảm bảo tiến độ";
  return "Đang triển khai";
}

function mergeProjects(incoming) {
  const map = new Map();
  [...state.projects, ...incoming].forEach((project) => {
    const key = normalizeText(project.name);
    map.set(key, { ...map.get(key), ...project });
  });
  return [...map.values()];
}

function normalizeProjectNumbers() {
  state.projects = state.projects.map((project, index) => ({
    ...project,
    projectId: project.projectId || createProjectId(),
    stt: index + 1,
    plan: sanitizePlanValue(project.plan),
    status: project.status || deriveStatus(project)
  }));
}

function renderAll() {
  renderDashboard();
  renderPreview();
  renderProjectsTable();
  renderReport();
  renderCapitalPlan();
  renderPeriodicReport();
  renderSettings();
  renderSourceHistory();
}

function renderDashboard() {
  const projects = state.projects;
  const totalBudget = sum(projects, "budget");
  const totalPlan = sum(projects, "plan");
  const alerts = getAlertProjects();

  els.kpiProjects.textContent = projects.length;
  els.kpiBudget.textContent = formatNumber(totalBudget);
  els.kpiPlan.textContent = formatNumber(totalPlan);
  els.kpiAlerts.textContent = alerts.length;

  els.sourceSummary.textContent = projects.length
    ? `Đã có ${projects.length} dự án từ ${state.files.length || 1} nguồn dữ liệu.`
    : "Chưa có file phân tích. Upload Excel/Word để bắt đầu.";

  renderAlerts(alerts);
  renderCharts();
}

function renderAlerts(alerts) {
  if (!alerts.length) {
    els.alertList.innerHTML = `<div class="log-line">Chưa phát hiện cảnh báo lớn. Có thể tiếp tục rà soát pháp lý và tiến độ theo kỳ báo cáo.</div>`;
    return;
  }

  els.alertList.innerHTML = alerts.map((project) => `
    <div class="alert-item">
      <strong>${escapeHtml(project.name)}</strong>
      <span>${escapeHtml(project.difficulty || project.progress || project.evaluation || "Cần rà soát thêm thông tin dự án.")}</span>
    </div>
  `).join("");
}

function renderChartsLegacyV1() {
  const statusCounts = countBy(state.projects, "status");
  const labels = Object.keys(statusCounts);
  const values = Object.values(statusCounts);
  const top = [...state.projects].sort((a, b) => b.budget - a.budget).slice(0, 7);

  if (state.charts.status) state.charts.status.destroy();
  if (state.charts.budget) state.charts.budget.destroy();

  state.charts.status = new Chart(document.getElementById("statusChart"), {
    type: "doughnut",
    data: {
      labels: labels.length ? labels : ["Chưa có dữ liệu"],
      datasets: [{
        data: values.length ? values : [1],
        backgroundColor: ["#2563eb", "#16a34a", "#d97706", "#dc2626", "#64748b"],
        borderColor: "#ffffff",
        borderWidth: 4,
        hoverOffset: 5
      }]
    },
    options: {
      maintainAspectRatio: false,
      plugins: {
        legend: {
          position: "bottom",
          labels: { boxWidth: 10, padding: 14, font: { size: 11, weight: "700" } }
        }
      },
      cutout: "72%"
    }
  });

  state.charts.budget = new Chart(document.getElementById("budgetChart"), {
    type: "bar",
    data: {
      labels: top.length ? top.map((project) => shortProjectName(project.name)) : ["Chưa có dữ liệu"],
      datasets: [{
        label: "Tổng mức đầu tư (tỷ đồng)",
        data: top.length ? top.map((project) => project.budget) : [0],
        backgroundColor: "#2563eb",
        borderColor: "#1d4ed8",
        borderWidth: 1,
        borderRadius: 4,
        barThickness: 18
      }]
    },
    options: {
      indexAxis: "y",
      maintainAspectRatio: false,
      plugins: {
        legend: { display: false },
        tooltip: {
          callbacks: {
            title: (items) => top[items[0].dataIndex]?.name || "",
            label: (item) => ` ${formatNumber(item.raw)} tỷ đồng`
          }
        }
      },
      scales: {
        x: {
          beginAtZero: true,
          grid: { color: "#edf2f7" },
          ticks: { font: { size: 10 } }
        },
        y: {
          grid: { display: false },
          ticks: { font: { size: 10, weight: "700" } }
        }
      }
    }
  });
}

function renderPreview() {
  const rows = state.projects.slice(0, 10);
  els.previewRows.innerHTML = rows.length ? rows.map((project) => `
    <tr>
      <td>${project.stt}</td>
      <td><strong>${escapeHtml(project.name)}</strong></td>
      <td>${formatNumber(project.budget)}</td>
      <td>${formatNumber(project.plan)}</td>
      <td>${escapeHtml(project.legal)}</td>
      <td>${escapeHtml(project.progress)}</td>
      <td>${escapeHtml(project.status)}</td>
    </tr>
  `).join("") : `<tr><td colspan="7">Chưa có dữ liệu. Hãy upload file Excel phụ lục dự án.</td></tr>`;
}

function renderProjectsTable() {
  const keyword = normalizeText(els.searchInput.value || "");
  const statusFilter = els.projectStatusFilter.value || "all";
  const groupFilter = els.projectGroupFilter.value || "all";
  const rows = state.projects.filter((project) => {
    const content = normalizeText(Object.values(project).join(" "));
    const status = statusClass(project.status).replace("is-", "");
    const group = deriveProjectGroup(project);
    return (!keyword || content.includes(keyword))
      && (statusFilter === "all" || statusFilter === status)
      && (groupFilter === "all" || groupFilter === group);
  });

  els.projectRows.innerHTML = rows.length ? rows.map((project) => {
    const constructionRate = deriveProjectRate(project);
    const disbRate = deriveDisbursementRate(project);
    const group = deriveProjectGroup(project);
    return `
      <tr>
        <td>
          <div class="master-name">
            <strong>${escapeHtml(project.name)}</strong>
            <span>DA-2026-${String(project.stt).padStart(3, "0")}</span>
          </div>
        </td>
        <td><span class="group-pill">Nhóm ${group}</span></td>
        <td class="money-cell">${formatNumber(project.budget)} tỷ</td>
        <td>${formatNumber(project.plan)} tỷ</td>
        <td>
          <div class="rate-cell"><strong>${disbRate}%</strong><div><span style="width:${disbRate}%"></span></div></div>
        </td>
        <td>
          <div class="rate-cell green"><strong>${constructionRate}%</strong><div><span style="width:${constructionRate}%"></span></div></div>
        </td>
        <td><span class="project-status ${statusClass(project.status)}">${escapeHtml(project.status || "Đang cập nhật")}</span></td>
        <td><button class="detail-action" data-detail="${project.stt - 1}" type="button">Chi tiết</button></td>
      </tr>
    `;
  }).join("") : `
    <tr>
      <td colspan="8">
        <div class="empty-state">
          <strong>Chưa có dữ liệu dự án</strong>
          <span>Vào mục Nhập & phân tích file để upload Excel phụ lục, hoặc bấm Tạo dự án mới.</span>
        </div>
      </td>
    </tr>
  `;

  els.projectRows.querySelectorAll("[data-detail]").forEach((button) => {
    button.addEventListener("click", () => openProjectDetail(Number(button.dataset.detail)));
  });
}

function handleProjectEdit(event) {
  const row = event.target.closest("[data-index]");
  const index = Number(row.dataset.index);
  const field = event.target.dataset.field;
  const value = ["budget", "plan"].includes(field) ? toNumber(event.target.value) : event.target.value;

  state.projects[index][field] = value;
  state.projects[index].status = deriveStatus(state.projects[index]);
  persistState();
  renderAll();
}

function handleProjectDelete(event) {
  const index = Number(event.target.dataset.delete);
  state.projects.splice(index, 1);
  normalizeProjectNumbers();
  persistState();
  renderAll();
}

function openProjectDetail(index) {
  const project = state.projects[index];
  if (!project) return;
  state.selectedProjectId = index;
  renderProjectDetail(project);
  showDetailTab("legalPane");
  switchView("projectDetailView");
}

function renderProjectDetail(project) {
  const index = state.projects.indexOf(project);
  const group = deriveProjectGroup(project);
  const progressRate = deriveProjectRate(project);
  const plan = toNumber(project.plan);
  const budget = toNumber(project.budget);
  const allocationRate = budget > 0 ? plan / budget * 100 : 0;

  els.detailCode.textContent = `DA-2026-${String(index + 1).padStart(3, "0")}`;
  els.detailGroup.textContent = `Nhóm ${group}`;
  els.detailName.textContent = project.name;
  els.detailMeta.textContent = `Phường Bình Tân | Chu kỳ thực hiện: ${project.period || "2026"}`;
  els.detailBudget.textContent = `${formatNumber(project.budget * 1_000_000_000)} VNĐ`;
  els.detailStatus.textContent = project.status || "Đang cập nhật";
  els.detailStatus.className = `project-status ${statusClass(project.status)}`;
  els.detailLegal.textContent = project.legal || "Đang cập nhật hồ sơ pháp lý.";
  els.detailProgressDoc.textContent = project.progress || "Đang cập nhật tiến độ hồ sơ.";
  els.detailPlan.textContent = `${formatNumber(plan * 1_000_000_000)} VNĐ`;
  els.detailDisbursed.textContent = `${formatNumber(budget * 1_000_000_000)} VNĐ`;
  els.detailDisbRate.textContent = "Kế hoạch vốn / tổng mức đầu tư";
  els.detailRemaining.textContent = `${formatNumber(allocationRate)}%`;
  els.detailContractValue.textContent = `${formatNumber(project.budget * 0.78)} tỷ`;
  els.detailProgressRate.textContent = `${progressRate}%`;
  els.detailProgressBar.style.width = `${progressRate}%`;
  renderProjectAssets(project);
  els.detailDifficulty.textContent = project.difficulty || project.progress || "Chưa ghi nhận khó khăn lớn.";
}

function showDetailTab(tabId) {
  document.querySelectorAll(".detail-tab").forEach((button) => {
    button.classList.toggle("active", button.dataset.tab === tabId);
  });
  document.querySelectorAll(".detail-pane").forEach((pane) => {
    pane.classList.toggle("active", pane.id === tabId);
  });
}

function addProject() {
  state.projects.push({
    stt: state.projects.length + 1,
    name: "Dự án mới",
    budget: 0,
    plan: 0,
    legal: "",
    progress: "",
    disbursement: "",
    difficulty: "",
    solution: "",
    evaluation: "Đang cập nhật",
    status: "Đang triển khai"
  });
  persistState();
  renderAll();
}

function renderReport() {
  if (!els.reportText.value && state.reportText) {
    els.reportText.value = state.reportText;
  }

  const alerts = getAlertProjects();
  const totalBudget = sum(state.projects, "budget");
  const totalPlan = sum(state.projects, "plan");

  els.presentationNotes.innerHTML = `
    <div class="note-card">
      <strong>1. Quy mô danh mục</strong>
      <p>Hiện theo dõi ${state.projects.length} dự án, tổng mức đầu tư khoảng ${formatNumber(totalBudget)} tỷ đồng, kế hoạch vốn năm báo cáo khoảng ${formatNumber(totalPlan)} tỷ đồng.</p>
    </div>
    <div class="note-card">
      <strong>2. Tiến độ và giải ngân</strong>
      <p>${state.projects.length ? "Phần lớn dự án được tổng hợp từ phụ lục Excel, cần rà soát thêm các dự án có khả năng chậm giải ngân." : "Chưa có dữ liệu dự án. Upload phụ lục Excel để tự sinh nhận định."}</p>
    </div>
    <div class="note-card">
      <strong>3. Nội dung cần xin ý kiến</strong>
      <p>${alerts.length ? `Có ${alerts.length} dự án cần báo cáo khó khăn, vướng mắc hoặc hướng xử lý.` : "Chưa phát hiện cảnh báo trọng yếu trong dữ liệu hiện tại."}</p>
    </div>
  `;
}

function renderCapitalPlan() {
  const projects = state.projects;
  const alerts = getAlertProjects();
  const healthyRate = projects.length ? Math.round(((projects.length - alerts.length) / projects.length) * 100) : 0;

  els.capitalTotalPlan.textContent = formatNumber(sum(projects, "plan"));
  els.capitalSlowCount.textContent = alerts.length;
  els.capitalHealthyRate.textContent = `${healthyRate}%`;

  els.capitalRows.innerHTML = projects.length ? projects.map((project) => `
    <tr>
      <td>${project.stt}</td>
      <td><strong>${escapeHtml(project.name)}</strong></td>
      <td>${formatNumber(project.budget)}</td>
      <td>${formatNumber(project.plan)}</td>
      <td>${escapeHtml(project.disbursement || "Đang cập nhật")}</td>
      <td>${escapeHtml(project.evaluation || project.status)}</td>
    </tr>
  `).join("") : `<tr><td colspan="6">Chưa có dữ liệu kế hoạch vốn. Hãy nhập dữ liệu từ file Excel.</td></tr>`;
}

function renderPeriodicReport() {
  const projects = state.projects;
  const alerts = getAlertProjects();
  const totalBudget = sum(projects, "budget");
  const totalPlan = sum(projects, "plan");
  const config = ensureReportConfiguration();
  const issues = getReportIssues();
  const selectedIds = new Set(config.selectedProjectIds || []);
  const selectedIssues = issues.filter((item) => selectedIds.has(item.project.projectId));

  syncReportConfigInputs(config);
  els.reportProjectCount.textContent = projects.length;
  els.reportTotalBudget.textContent = formatNumber(totalBudget);
  els.reportTotalPlan.textContent = formatNumber(totalPlan);
  els.reportSelectedCount.textContent = selectedIssues.length;
  els.reportIssueCount.textContent = `${issues.length} vấn đề`;
  els.reportPreviewTitle.textContent = config.title;
  els.reportPreviewPeriod.textContent = config.period;
  els.reportPreviewRecipient.textContent = config.recipient;

  const isReady = Boolean(config.title && config.period && config.reportDate && selectedIssues.length);
  els.reportReadiness.textContent = isReady ? "Sẵn sàng xuất" : "Đang rà soát";
  els.reportReadiness.classList.toggle("is-ready", isReady);
  els.toggleReportIssuesBtn.textContent = issues.length && selectedIssues.length === issues.length
    ? "Bỏ chọn tất cả"
    : "Chọn tất cả";

  els.periodicSummary.innerHTML = `
    Trong <strong>${escapeHtml(config.period)}</strong>, Ban Quản Lý Dự Án Phường Bình Tân đang theo dõi
    <strong>${projects.length} dự án</strong> với tổng mức đầu tư khoảng
    <strong>${formatNumber(totalBudget)} tỷ đồng</strong> và kế hoạch vốn khoảng
    <strong>${formatNumber(totalPlan)} tỷ đồng</strong>. Qua rà soát, có
    <strong>${alerts.length} dự án</strong> cần tập trung xử lý về tiến độ, pháp lý hoặc khả năng giải ngân.
  `;

  els.reportPreviewIssues.innerHTML = selectedIssues.length
    ? selectedIssues.map((item, index) => `
        <div class="report-preview-issue">
          <span>${index + 1}.</span>
          <div><strong>${escapeHtml(item.project.name)}:</strong> ${escapeHtml(item.description)}</div>
        </div>
      `).join("")
    : `<div class="audit-empty">Chưa chọn nội dung trọng tâm đưa vào báo cáo.</div>`;

  els.periodicRows.innerHTML = issues.length
    ? issues.map((item) => {
        const projectIndex = state.projects.indexOf(item.project);
        const checked = selectedIds.has(item.project.projectId);
        return `
          <article class="report-issue-item">
            <input type="checkbox" data-report-select="${escapeHtml(item.project.projectId)}" ${checked ? "checked" : ""} ${canEditProjects() ? "" : "disabled"} aria-label="Chọn dự án đưa vào báo cáo">
            <div class="report-issue-copy">
              <strong>${escapeHtml(item.project.name)}</strong>
              <p>${escapeHtml(item.description)}</p>
              <div class="report-issue-meta">
                <span class="priority-badge ${item.priorityClass}">${escapeHtml(item.priority)}</span>
                <span class="project-status ${statusClass(item.project.status)}">${escapeHtml(item.project.status || "Đang cập nhật")}</span>
              </div>
            </div>
            <button class="report-open-project" data-report-open="${projectIndex}" type="button">Mở hồ sơ</button>
          </article>
        `;
      }).join("")
    : `<div class="audit-empty">Chưa có dữ liệu dự án để chuẩn bị báo cáo.</div>`;
}

function ensureReportConfiguration() {
  state.reportConfig = state.reportConfig || {};
  const today = new Date();
  const defaultPeriod = `Tháng ${today.getMonth() + 1}/${today.getFullYear()}`;
  state.reportConfig.title = state.reportConfig.title || "Báo cáo tiến độ các dự án đầu tư công";
  state.reportConfig.period = state.reportConfig.period || defaultPeriod;
  state.reportConfig.reportDate = state.reportConfig.reportDate || today.toISOString().slice(0, 10);
  state.reportConfig.recipient = state.reportConfig.recipient || "Ủy ban nhân dân Phường Bình Tân";

  if (!Array.isArray(state.reportConfig.selectedProjectIds)) {
    const alerts = getAlertProjects();
    const defaults = alerts.length ? alerts : state.projects.slice(0, 5);
    state.reportConfig.selectedProjectIds = defaults.map((project) => project.projectId);
  }

  return state.reportConfig;
}

function syncReportConfigInputs(config) {
  const values = {
    reportTitleInput: config.title,
    reportPeriodInput: config.period,
    reportDateInput: config.reportDate,
    reportRecipientInput: config.recipient
  };
  Object.entries(values).forEach(([id, value]) => {
    const input = document.getElementById(id);
    if (input && document.activeElement !== input) input.value = value || "";
  });
}

function getReportIssues() {
  return [...state.projects]
    .sort((a, b) => reportPriorityScore(b) - reportPriorityScore(a))
    .slice(0, 15)
    .map((project) => {
      const score = reportPriorityScore(project);
      return {
        project,
        description: project.difficulty || project.progress || project.disbursement || "Dự án đang được cập nhật thông tin phục vụ báo cáo định kỳ.",
        priority: score >= 3 ? "Khẩn" : score >= 2 ? "Cần xử lý" : "Theo dõi",
        priorityClass: score >= 3 ? "is-high" : score >= 2 ? "" : "is-normal"
      };
    });
}

function reportPriorityScore(project) {
  const text = normalizeText([
    project.status,
    project.evaluation,
    project.difficulty,
    project.progress,
    project.disbursement
  ].join(" "));
  if (text.includes("cham") || text.includes("tam dung") || text.includes("khong bao dam")) return 3;
  if (text.includes("vuong") || text.includes("can xu ly") || text.includes("ra soat")) return 2;
  return 1;
}

function updateReportConfiguration() {
  if (!canEditProjects()) return;
  const config = ensureReportConfiguration();
  config.title = els.reportTitleInput.value.trim();
  config.period = els.reportPeriodInput.value.trim();
  config.reportDate = els.reportDateInput.value;
  config.recipient = els.reportRecipientInput.value.trim();
  persistStateLocal();
  clearTimeout(reportSaveTimer);
  reportSaveTimer = setTimeout(() => saveRemoteState(), 600);
  renderPeriodicReport();
}

function handleReportIssueSelection(event) {
  if (!canEditProjects()) return;
  const checkbox = event.target.closest("[data-report-select]");
  if (!checkbox) return;
  const config = ensureReportConfiguration();
  const selected = new Set(config.selectedProjectIds || []);
  if (checkbox.checked) selected.add(checkbox.dataset.reportSelect);
  else selected.delete(checkbox.dataset.reportSelect);
  config.selectedProjectIds = [...selected];
  persistState();
  renderPeriodicReport();
}

function toggleAllReportIssues() {
  if (!canEditProjects()) return;
  const config = ensureReportConfiguration();
  const issueIds = getReportIssues().map((item) => item.project.projectId);
  const selected = new Set(config.selectedProjectIds || []);
  config.selectedProjectIds = issueIds.length && issueIds.every((id) => selected.has(id)) ? [] : issueIds;
  persistState();
  renderPeriodicReport();
}

function handleReportIssueOpen(event) {
  const button = event.target.closest("[data-report-open]");
  if (!button) return;
  openProjectDetail(Number(button.dataset.reportOpen));
}

function renderSettings() {
  els.settingProjectCount.textContent = state.projects.length;
  els.settingStorageStatus.textContent = state.projects.length
    ? `Đã lưu ${state.projects.length} dự án trên trình duyệt này.`
    : "Chưa có dữ liệu cục bộ.";
}

function exportCsv() {
  const headers = ["STT", "Tên dự án", "Tổng mức đầu tư", "Kế hoạch vốn", "Pháp lý", "Tiến độ", "Khả năng giải ngân", "Khó khăn", "Phương hướng xử lý", "Đánh giá"];
  const rows = state.projects.map((p) => [
    p.stt, p.name, p.budget, p.plan, p.legal, p.progress, p.disbursement, p.difficulty, p.solution, p.evaluation || p.status
  ]);

  if (window.XLSX) {
    const worksheet = XLSX.utils.aoa_to_sheet([headers, ...rows]);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "Phụ lục dự án");
    XLSX.writeFile(workbook, "phu-luc-du-an-binh-tan.xlsx");
    return;
  }

  const csv = [headers, ...rows].map((row) => row.map(csvCell).join(",")).join("\n");
  downloadBlob("\ufeff" + csv, "phu-luc-du-an-binh-tan.csv", "text/csv;charset=utf-8");
}

function exportWord() {
  const config = ensureReportConfiguration();
  const report = buildWordHtml();
  const datePart = config.reportDate || new Date().toISOString().slice(0, 10);
  downloadBlob(report, `bao-cao-du-an-binh-tan-${datePart}.doc`, "application/msword;charset=utf-8");
}

function buildWordHtml() {
  const config = ensureReportConfiguration();
  const selectedIds = new Set(config.selectedProjectIds || []);
  const selectedIssues = getReportIssues().filter((item) => selectedIds.has(item.project.projectId));
  const totalBudget = sum(state.projects, "budget");
  const totalPlan = sum(state.projects, "plan");
  const rows = state.projects.map((p) => `
    <tr>
      <td>${p.stt}</td>
      <td>${escapeHtml(p.name)}</td>
      <td>${formatNumber(p.budget)}</td>
      <td>${formatNumber(p.plan)}</td>
      <td>${escapeHtml(p.progress)}</td>
      <td>${escapeHtml(p.difficulty)}</td>
      <td>${escapeHtml(p.evaluation || p.status)}</td>
    </tr>
  `).join("");
  const issueRows = selectedIssues.length
    ? selectedIssues.map((item, index) => `
        <p><strong>${index + 1}. ${escapeHtml(item.project.name)}</strong><br>
        ${escapeHtml(item.description)}</p>
      `).join("")
    : "<p>Chưa lựa chọn nội dung trọng tâm.</p>";

  return `
    <html>
    <head>
      <meta charset="UTF-8">
      <style>
        body { font-family: "Times New Roman", serif; font-size: 13pt; }
        h1, h2 { text-align: center; }
        h1 { font-size: 16pt; }
        h2 { font-size: 14pt; }
        .meta { text-align: right; font-style: italic; }
        .summary { text-align: justify; line-height: 1.5; }
        .signature { margin-top: 40px; width: 100%; }
        .signature td { border: 0; text-align: center; }
        table { width: 100%; border-collapse: collapse; }
        td, th { border: 1px solid #000; padding: 6px; vertical-align: top; }
        th { font-weight: bold; text-align: center; }
      </style>
    </head>
    <body>
      <p><strong>BAN QUẢN LÝ DỰ ÁN PHƯỜNG BÌNH TÂN</strong></p>
      <p class="meta">${escapeHtml(config.period)} - Ngày ${escapeHtml(formatReportDate(config.reportDate))}</p>
      <h2>BÁO CÁO</h2>
      <h1>${escapeHtml(config.title)}</h1>
      <p class="summary">Trong ${escapeHtml(config.period)}, Ban Quản Lý Dự Án Phường Bình Tân đang theo dõi
      <strong>${state.projects.length} dự án</strong>, tổng mức đầu tư khoảng <strong>${formatNumber(totalBudget)} tỷ đồng</strong>
      và kế hoạch vốn khoảng <strong>${formatNumber(totalPlan)} tỷ đồng</strong>.</p>
      <p class="summary">${escapeHtml(state.reportText || "Nội dung thuyết minh đang được tiếp tục rà soát, cập nhật theo hồ sơ dự án.")}</p>
      <h2>NỘI DUNG CẦN TẬP TRUNG CHỈ ĐẠO</h2>
      ${issueRows}
      <h2>PHỤ LỤC DỰ ÁN</h2>
      <table>
        <thead>
          <tr>
            <th>STT</th>
            <th>Tên dự án</th>
            <th>TMĐT</th>
            <th>Kế hoạch vốn</th>
            <th>Tiến độ</th>
            <th>Khó khăn</th>
            <th>Đánh giá</th>
          </tr>
        </thead>
        <tbody>${rows}</tbody>
      </table>
      <table class="signature">
        <tr>
          <td style="text-align:left">Nơi nhận:<br><strong>${escapeHtml(config.recipient)}</strong></td>
          <td><strong>NGƯỜI LẬP BÁO CÁO</strong><br><em>(Ký, ghi rõ họ tên)</em></td>
        </tr>
      </table>
    </body>
    </html>
  `;
}

function formatReportDate(value) {
  if (!value) return new Date().toLocaleDateString("vi-VN");
  const [year, month, day] = value.split("-");
  return `${day}/${month}/${year}`;
}

function clearData() {
  if (!confirm("Xóa toàn bộ dữ liệu đã phân tích trên trình duyệt này?")) return;
  state.projects = [];
  state.reportText = "";
  state.importHistory = [];
  state.auditLog = [];
  state.reportConfig = {};
  els.reportText.value = "";
  els.analysisLog.innerHTML = "";
  els.analysisStatus.textContent = "Chưa có dữ liệu";
  els.docStatus.textContent = "Chưa upload Word";
  persistState();
  renderAll();
}

function restoreState() {
  const saved = localStorage.getItem(STORAGE_KEY);
  if (!saved) {
    state.projects = demoProjects;
    normalizeProjectNumbers();
    persistState();
    return;
  }

  try {
    const parsed = JSON.parse(saved);
    state.projects = parsed.projects || [];
    state.reportText = parsed.reportText || "";
    state.files = parsed.files || [];
    els.reportText.value = state.reportText;
    normalizeProjectNumbers();
    persistState();
  } catch {
    state.projects = demoProjects;
  }
}

function persistState() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify({
    projects: state.projects,
    reportText: state.reportText,
    files: state.files
  }));
}

function getAlertProjects() {
  return state.projects.filter((project) => project.status === "Cần xử lý" || normalizeText(project.evaluation).includes("cham"));
}

function addLog(message) {
  const line = document.createElement("div");
  line.className = "log-line";
  line.textContent = message;
  els.analysisLog.prepend(line);
}

function sum(items, field) {
  return items.reduce((total, item) => total + toNumber(item[field]), 0);
}

function countBy(items, field) {
  return items.reduce((acc, item) => {
    const key = item[field] || "Đang cập nhật";
    acc[key] = (acc[key] || 0) + 1;
    return acc;
  }, {});
}

function stringify(value) {
  return value == null ? "" : String(value).replace(/\s+/g, " ").trim();
}

function cleanText(value) {
  return stringify(value).replace(/\n{3,}/g, "\n\n");
}

function toNumber(value) {
  if (typeof value === "number") return Number.isFinite(value) ? value : 0;
  const text = stringify(value).replace(",", ".");
  const match = text.match(/-?\d+(\.\d+)?/);
  return match ? Number(match[0]) : 0;
}

function toMoneyNumber(value) {
  if (typeof value === "number") return Number.isFinite(value) ? value : 0;

  let raw = stringify(value);
  if (!raw) return 0;

  const normalized = normalizeText(raw);
  const hasMoneyUnit = ["ty", "trieu", "dong", "vnd"].some((unit) => normalized.includes(unit));
  if (/\b20\d{2}\b/.test(raw) && !hasMoneyUnit) return 0;
  if (/[%/]/.test(raw)) return 0;
  if (/[a-zA-ZÀ-ỹ]/.test(raw) && !hasMoneyUnit) return 0;

  raw = raw.replace(/\b20\d{2}\b/g, "");
  if (hasMoneyUnit) {
    raw = raw.replace(/[^\d.,\s-]/g, "");
  }

  if (!/^-?\s*[\d.,\s]+$/.test(raw)) return 0;

  const compact = raw.replace(/\s/g, "");
  let parsedText = compact;

  if (compact.includes(",") && compact.includes(".")) {
    parsedText = compact.lastIndexOf(",") > compact.lastIndexOf(".")
      ? compact.replace(/\./g, "").replace(",", ".")
      : compact.replace(/,/g, "");
  } else if (compact.includes(",")) {
    parsedText = compact.replace(",", ".");
  } else if (/^-?\d{1,3}(\.\d{3})+$/.test(compact)) {
    parsedText = compact.replace(/\./g, "");
  }

  const number = Number(parsedText);
  return Number.isFinite(number) ? number : 0;
}

function toPlanNumber(value) {
  const number = toMoneyNumber(value);
  return isLikelyYearValue(number) ? 0 : number;
}

function sanitizePlanValue(value) {
  const number = toNumber(value);
  return isLikelyYearValue(number) ? 0 : number;
}

function isLikelyYearValue(value) {
  return Number.isInteger(value) && value >= 1900 && value <= 2100;
}

function formatNumber(value) {
  return toNumber(value).toLocaleString("vi-VN", { maximumFractionDigits: 3 });
}

function formatDateTimeLabel(value) {
  if (!value) return "Đang cập nhật";
  return new Date(value).toLocaleString("vi-VN", {
    hour: "2-digit",
    minute: "2-digit",
    day: "2-digit",
    month: "2-digit",
    year: "numeric"
  });
}

function deriveProjectRate(project) {
  const text = normalizeText([project.progress, project.disbursement, project.evaluation, project.status].join(" "));
  if (text.includes("100") || text.includes("dam bao") || text.includes("hoan thanh")) return 90;
  if (text.includes("cham") || text.includes("tam dung") || text.includes("khong bao dam")) return 35;
  if (text.includes("phe duyet") || text.includes("dang")) return 65;
  return 50;
}

function deriveDisbursementRate(project) {
  const text = normalizeText([project.disbursement, project.evaluation, project.progress].join(" "));
  const percentMatch = text.match(/(\d{1,3})\s*%/);
  if (percentMatch) return Math.max(0, Math.min(100, Number(percentMatch[1])));
  if (text.includes("100") || text.includes("dam bao") || text.includes("du kien giai ngan")) return 100;
  if (text.includes("cham") || text.includes("khong bao dam") || text.includes("vuong")) return 35;
  if (project.plan && project.budget) {
    return Math.max(5, Math.min(100, Math.round((toNumber(project.plan) / Math.max(toNumber(project.budget), 1)) * 100)));
  }
  return deriveProjectRate(project);
}

function deriveProjectGroup(project) {
  const budget = toNumber(project.budget);
  if (budget >= 500) return "A";
  if (budget >= 100) return "B";
  return "C";
}

function statusClass(status) {
  const text = normalizeText(status);
  if (text.includes("cham") || text.includes("xu ly")) return "is-risk";
  if (text.includes("hoan thanh") || text.includes("dam bao")) return "is-good";
  return "is-active";
}

function shortProjectName(value) {
  const text = stringify(value)
    .replace(/^Nâng cấp,\s*/i, "")
    .replace(/^Xây dựng mới\s*/i, "")
    .replace(/^Đầu tư\s*/i, "")
    .replace(/^Cải tạo\s*/i, "");
  return text.length > 34 ? text.slice(0, 31).trim() + "..." : text;
}

function normalizeText(value) {
  return stringify(value)
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/đ/g, "d");
}

function escapeHtml(value) {
  return stringify(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function csvCell(value) {
  return `"${stringify(value).replace(/"/g, '""')}"`;
}

function downloadBlob(content, filename, type) {
  const blob = new Blob([content], { type });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  anchor.click();
  URL.revokeObjectURL(url);
}

function compactSentence(value, maxLength = 54) {
  const text = stringify(value);
  return text.length > maxLength ? `${text.slice(0, maxLength - 1).trim()}...` : text;
}

function recordImportHistory(entry) {
  state.importHistory = Array.isArray(state.importHistory) ? state.importHistory : [];
  state.importHistory.unshift({
    id: `${Date.now()}-${Math.random().toString(16).slice(2)}`,
    importedAt: new Date().toISOString(),
    type: entry.type || "Nguồn dữ liệu",
    name: entry.name || "Chưa đặt tên",
    url: entry.url || "",
    rowCount: Number(entry.rowCount) || 0,
    projectCount: Number(entry.projectCount) || 0,
    status: entry.status || "Đã ghi nhận",
    storageStatus: entry.storageStatus || "",
    storagePath: entry.storagePath || "",
    error: entry.error || ""
  });
}

function renderSourceHistory() {
  if (!els.sourceHistory || !els.historySummary) return;

  const rows = Array.isArray(state.importHistory) ? state.importHistory : [];
  els.historySummary.textContent = rows.length
    ? `${rows.length} lần thêm dữ liệu gần nhất`
    : "Chưa có lịch sử";

  if (!rows.length) {
    els.sourceHistory.innerHTML = `
      <div class="history-empty">
        <strong>Chưa có nguồn dữ liệu nào</strong>
        <span>Upload Excel/Word hoặc đồng bộ Google Sheet để hệ thống ghi lại lịch sử.</span>
      </div>
    `;
    return;
  }

  els.sourceHistory.innerHTML = rows.map((item) => {
    const isError = normalizeText(item.status).includes("loi") || item.error;
    const statusClassName = isError ? "is-error" : "is-ok";
    const sourceLink = item.url
      ? `<a href="${escapeHtml(item.url)}" target="_blank" rel="noreferrer">Mở nguồn</a>`
      : "";

    return `
      <div class="history-item">
        <div class="history-type">${escapeHtml(item.type)}</div>
        <div class="history-main">
          <strong>${escapeHtml(item.name)}</strong>
          <span>${formatDateTimeLabel(item.importedAt)} · ${formatNumber(item.rowCount)} dòng · ${formatNumber(item.projectCount)} dự án</span>
          ${item.error ? `<em>${escapeHtml(item.error)}</em>` : ""}
        </div>
        <div class="history-actions">
          <span class="history-status ${statusClassName}">${escapeHtml(item.status)}</span>
          ${sourceLink}
        </div>
      </div>
    `;
  }).join("");
}

function renderCapitalPlan() {
  const projects = state.projects;
  const alerts = getAlertProjects();
  const healthyRate = projects.length ? Math.round(((projects.length - alerts.length) / projects.length) * 100) : 0;

  els.capitalTotalPlan.textContent = formatNumber(sum(projects, "plan"));
  els.capitalSlowCount.textContent = alerts.length;
  els.capitalHealthyRate.textContent = `${healthyRate}%`;

  els.capitalRows.innerHTML = projects.length ? projects.map((project) => {
    const disbursementRate = deriveDisbursementRate(project);
    const planShare = Math.min(100, Math.round((toNumber(project.plan) / Math.max(toNumber(project.budget), 1)) * 100)) || 0;
    const stateClass = statusClass(project.evaluation || project.status);

    return `
      <tr>
        <td><span class="capital-stt">${project.stt}</span></td>
        <td>
          <div class="capital-project">
            <strong>${escapeHtml(project.name)}</strong>
            <div class="capital-project-meta">
              <span class="group-pill">Nhom ${deriveProjectGroup(project)}</span>
              <span>${escapeHtml(project.status || "Đang cập nhật")}</span>
            </div>
          </div>
        </td>
        <td>
          <div class="capital-money">
            <strong>${formatNumber(project.budget)}</strong>
            <span>Tổng mức đầu tư</span>
          </div>
        </td>
        <td>
          <div class="capital-money highlight">
            <strong>${formatNumber(project.plan)}</strong>
            <span>${planShare}% tổng mức đầu tư</span>
          </div>
        </td>
        <td>
          <div class="capital-progress ${stateClass}">
            <div class="capital-progress-head">
              <strong>${disbursementRate}%</strong>
              <span>${escapeHtml(compactSentence(project.disbursement || "Đang cập nhật"))}</span>
            </div>
            <div class="capital-progress-bar">
              <span style="width:${disbursementRate}%"></span>
            </div>
          </div>
        </td>
        <td><span class="project-status ${stateClass}">${escapeHtml(project.evaluation || project.status)}</span></td>
      </tr>
    `;
  }).join("") : `<tr><td colspan="6">Chưa có dữ liệu kế hoạch vốn. Hãy nhập dữ liệu từ file Excel.</td></tr>`;
}

function buildStatusBuckets(projects) {
  const buckets = [
    { key: "good", label: "Đảm bảo tiến độ", color: "#2563eb", value: 0 },
    { key: "active", label: "Đang triển khai", color: "#16a34a", value: 0 },
    { key: "done", label: "Hoàn thành", color: "#0f766e", value: 0 },
    { key: "risk", label: "Cần xử lý", color: "#dc2626", value: 0 }
  ];

  projects.forEach((project) => {
    const text = normalizeText([project.status, project.evaluation, project.progress].join(" "));
    if (text.includes("hoan thanh")) {
      buckets[2].value += 1;
    } else if (text.includes("cham") || text.includes("xu ly") || text.includes("vuong") || text.includes("khong bao dam")) {
      buckets[3].value += 1;
    } else if (text.includes("dam bao")) {
      buckets[0].value += 1;
    } else {
      buckets[1].value += 1;
    }
  });

  return buckets.filter((item) => item.value > 0);
}

function renderChartsLegacyV2() {
  const statusBuckets = buildStatusBuckets(state.projects);
  const labels = statusBuckets.map((item) => item.label);
  const values = statusBuckets.map((item) => item.value);
  const colors = statusBuckets.map((item) => item.color);
  const top = [...state.projects]
    .sort((a, b) => toNumber(b.plan) - toNumber(a.plan))
    .slice(0, 6);

  const centerTextPlugin = {
    id: "centerTextPlugin",
    afterDraw(chart, args, options) {
      if (!options || !chart?.getDatasetMeta(0)?.data?.length) return;
      const { ctx } = chart;
      const point = chart.getDatasetMeta(0).data[0];
      if (!point) return;

      ctx.save();
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillStyle = "#0f172a";
      ctx.font = "800 28px Inter, system-ui, sans-serif";
      ctx.fillText(options.title || "", point.x, point.y - 10);
      ctx.fillStyle = "#64748b";
      ctx.font = "700 12px Inter, system-ui, sans-serif";
      ctx.fillText(options.subtitle || "", point.x, point.y + 16);
      ctx.restore();
    }
  };

  const barValuePlugin = {
    id: "barValuePlugin",
    afterDatasetsDraw(chart) {
      const { ctx } = chart;
      ctx.save();
      ctx.textAlign = "left";
      ctx.textBaseline = "middle";
      ctx.fillStyle = "#334155";
      ctx.font = "800 10px Inter, system-ui, sans-serif";

      chart.data.datasets.forEach((dataset, datasetIndex) => {
        chart.getDatasetMeta(datasetIndex).data.forEach((bar, index) => {
          const value = dataset.data[index];
          if (!value) return;
          ctx.fillText(`${formatNumber(value)} tỷ`, bar.x + 6, bar.y);
        });
      });

      ctx.restore();
    }
  };

  if (state.charts.status) state.charts.status.destroy();
  if (state.charts.budget) state.charts.budget.destroy();

  state.charts.status = new Chart(document.getElementById("statusChart"), {
    type: "doughnut",
    data: {
      labels: labels.length ? labels : ["Chưa có dữ liệu"],
      datasets: [{
        data: values.length ? values : [1],
        backgroundColor: colors.length ? colors : ["#cbd5e1"],
        borderColor: "#ffffff",
        borderWidth: 5,
        hoverOffset: 6
      }]
    },
    options: {
      maintainAspectRatio: false,
      plugins: {
        centerTextPlugin: {
          title: `${state.projects.length}`,
          subtitle: "dự án"
        },
        legend: {
          position: "bottom",
          labels: { boxWidth: 10, padding: 14, font: { size: 11, weight: "700" } }
        },
        tooltip: {
          callbacks: {
            label: (item) => {
              const total = values.reduce((sum, value) => sum + value, 0) || 1;
              const percent = Math.round((item.raw / total) * 100);
              return ` ${item.label}: ${item.raw} dự án (${percent}%)`;
            }
          }
        }
      },
      cutout: "70%"
    },
    plugins: [centerTextPlugin]
  });

  state.charts.budget = new Chart(document.getElementById("budgetChart"), {
    type: "bar",
    data: {
      labels: top.length ? top.map((project, index) => `${index + 1}. ${compactSentence(project.name, 28)}`) : ["Chưa có dữ liệu"],
      datasets: [{
        label: "Kế hoạch vốn",
        data: top.length ? top.map((project) => toNumber(project.plan)) : [0],
        backgroundColor: "#2563eb",
        borderColor: "#1d4ed8",
        borderWidth: 1,
        borderRadius: 6,
        barThickness: 12
      }, {
        label: "Giải ngân ước tính",
        data: top.length ? top.map((project) => Math.round(toNumber(project.plan) * deriveDisbursementRate(project) / 100)) : [0],
        backgroundColor: "#93c5fd",
        borderColor: "#60a5fa",
        borderWidth: 1,
        borderRadius: 6,
        barThickness: 12
      }]
    },
    options: {
      indexAxis: "y",
      maintainAspectRatio: false,
      plugins: {
        legend: {
          display: true,
          position: "top",
          align: "start",
          labels: { boxWidth: 10, boxHeight: 10, usePointStyle: true, pointStyle: "rectRounded", padding: 16, font: { size: 11, weight: "700" } }
        },
        tooltip: {
          callbacks: {
            title: (items) => top[items[0].dataIndex]?.name || "",
            label: (item) => ` ${item.dataset.label}: ${formatNumber(item.raw)} tỷ đồng`
          }
        }
      },
      layout: {
        padding: { right: 52 }
      },
      scales: {
        x: {
          beginAtZero: true,
          grace: "14%",
          grid: { color: "#edf2f7" },
          ticks: {
            font: { size: 10 },
            callback: (value) => formatNumber(value)
          }
        },
        y: {
          grid: { display: false },
          ticks: { font: { size: 10, weight: "700" } }
        }
      }
    },
    plugins: [barValuePlugin]
  });

  els.statusSummary.innerHTML = statusBuckets.map((item) => {
    const percent = state.projects.length ? Math.round((item.value / state.projects.length) * 100) : 0;
    return `
      <div class="chart-stat">
        <span class="chart-dot" style="background:${item.color}"></span>
        <div>
          <strong>${item.value} dự án</strong>
          <em>${item.label}: ${percent}%</em>
        </div>
      </div>
    `;
  }).join("");

  const totalPlannedTop = top.reduce((sum, project) => sum + toNumber(project.plan), 0);
  const totalDisbursedTop = top.reduce((sum, project) => sum + Math.round(toNumber(project.plan) * deriveDisbursementRate(project) / 100), 0);
  const leadProject = top[0];

  els.budgetSummary.innerHTML = `
    <div class="chart-note chart-note-strong"><strong>Tổng kế hoạch vốn top 6:</strong> ${formatNumber(totalPlannedTop)} tỷ đồng</div>
    <div class="chart-note chart-note-strong"><strong>Giải ngân ước tính:</strong> ${formatNumber(totalDisbursedTop)} tỷ đồng</div>
    <div class="chart-project-list">
      ${top.map((project, index) => {
        const plan = toNumber(project.plan);
        const disbursed = Math.round(plan * deriveDisbursementRate(project) / 100);
        return `
          <div class="chart-project-row">
            <span>${index + 1}</span>
            <strong>${escapeHtml(compactSentence(project.name, 58))}</strong>
            <em>Kế hoạch ${formatNumber(plan)} tỷ · Giải ngân ${formatNumber(disbursed)} tỷ</em>
          </div>
        `;
      }).join("")}
    </div>
    <div class="chart-note"><strong>Dự án dẫn đầu:</strong> ${escapeHtml(leadProject ? compactSentence(leadProject.name, 72) : "Đang cập nhật")}</div>
  `;
}

async function initSupabase() {
  if (!window.supabase?.createClient) {
    console.warn("Supabase client is not available.");
    return;
  }

  supabaseClient = window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY, {
    auth: {
      persistSession: true,
      autoRefreshToken: true
    }
  });

  const { data } = await supabaseClient.auth.getSession();
  currentSession = data.session;
}

async function handleLogin(event) {
  event.preventDefault();
  const email = els.loginUser.value.trim();
  const password = els.loginPass.value.trim();

  if (!email || !password) {
    els.loginError.textContent = "Vui long nhap email va mat khau.";
    return;
  }

  if (!supabaseClient) {
    els.loginError.textContent = "Chua ket noi duoc Supabase. Kiem tra internet roi thu lai.";
    return;
  }

  els.loginError.textContent = "Đang đăng nhập...";
  const { data, error } = await supabaseClient.auth.signInWithPassword({ email, password });

  if (error) {
    els.loginError.textContent = "Đăng nhập không thành công. Kiểm tra email/mật khẩu trong Supabase.";
    return;
  }

  currentSession = data.session;
  remoteStateUpdatedAt = null;
  remoteConflictNotified = false;
  localStorage.setItem(AUTH_KEY, JSON.stringify({ user: email, role: "admin", loginAt: new Date().toISOString() }));
  await restoreState();
  els.loginError.textContent = "";
  showApp();
}

async function handleLogout() {
  if (supabaseClient) {
    await supabaseClient.auth.signOut();
  }

  currentSession = null;
  remoteStateUpdatedAt = null;
  remoteConflictNotified = false;
  remoteSaveQueue = Promise.resolve(true);
  localStorage.removeItem(AUTH_KEY);
  sessionStorage.removeItem(AUTH_KEY);
  els.loginPass.value = "";
  showLogin();
}

function getSavedAuth() {
  return currentSession || localStorage.getItem(AUTH_KEY) || sessionStorage.getItem(AUTH_KEY);
}

async function restoreState() {
  if (supabaseClient && currentSession) {
    const { data, error } = await supabaseClient
      .from("dashboard_state")
      .select("data, updated_at")
      .eq("id", REMOTE_STATE_ID)
      .maybeSingle();

    const localState = readLocalState();
    const syncMeta = readSyncMeta();
    const remoteState = data?.data;

    if (!error && data) {
      remoteStateUpdatedAt = data.updated_at || null;
      remoteConflictNotified = false;

      if (syncMeta?.pending && hasUsefulState(localState)) {
        if (!syncMeta.baseUpdatedAt || syncMeta.baseUpdatedAt === remoteStateUpdatedAt) {
          applySavedState(localState);
          const recovered = await saveRemoteState();
          if (recovered) return;
          return;
        } else {
          localStorage.setItem(CONFLICT_BACKUP_KEY, JSON.stringify({
            savedAt: new Date().toISOString(),
            baseUpdatedAt: syncMeta.baseUpdatedAt,
            remoteUpdatedAt: remoteStateUpdatedAt,
            data: localState
          }));
          alert("Có dữ liệu chưa đồng bộ trên trình duyệt nhưng Supabase đã có bản mới hơn. Hệ thống ưu tiên bản trên Supabase và đã giữ một bản sao xung đột trong trình duyệt để tránh mất dữ liệu.");
        }
      }

      applySavedState(remoteState);
      persistStateLocal(false);
      return;
    }

    if (!error && !data && hasUsefulState(localState)) {
      remoteStateUpdatedAt = null;
      applySavedState(localState);
      await saveRemoteState();
      return;
    }

    console.warn("Could not load Supabase state, falling back to local cache.", error);
  }

  restoreStateFromLocal();
}

function restoreStateFromLocal() {
  const saved = readLocalState();
  if (!saved) {
    state.projects = [];
    state.reportText = "";
    state.files = [];
    state.importHistory = [];
    state.auditLog = [];
    state.reportConfig = {};
    normalizeProjectNumbers();
    return;
  }

  applySavedState(saved);
}

function readLocalState() {
  const saved = localStorage.getItem(STORAGE_KEY);
  if (!saved) return null;

  try {
    return JSON.parse(saved);
  } catch {
    return null;
  }
}

function hasUsefulState(saved) {
  return Boolean(saved && (
    saved.projects?.length ||
    saved.reportText ||
    saved.files?.length ||
    saved.importHistory?.length ||
    saved.auditLog?.length
  ));
}

function applySavedState(saved) {
  state.projects = saved.projects || [];
  state.reportText = saved.reportText || "";
  state.files = saved.files || [];
  state.importHistory = saved.importHistory || saved.sourceHistory || [];
  state.auditLog = saved.auditLog || [];
  state.reportConfig = saved.reportConfig || {};
  state.electronicForm = saved.electronicForm || {};
  els.reportText.value = state.reportText;
  normalizeProjectNumbers();
}

function persistState() {
  persistStateLocal();
  saveRemoteState();
}

function persistStateLocal(markPending = true) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(getSerializableState()));
  localStorage.setItem(SYNC_META_KEY, JSON.stringify({
    pending: markPending,
    baseUpdatedAt: remoteStateUpdatedAt,
    changedAt: new Date().toISOString()
  }));
}

function readSyncMeta() {
  try {
    return JSON.parse(localStorage.getItem(SYNC_META_KEY) || "null");
  } catch {
    return null;
  }
}

function markLocalStateSynced(updatedAt) {
  localStorage.setItem(SYNC_META_KEY, JSON.stringify({
    pending: false,
    baseUpdatedAt: updatedAt || null,
    changedAt: new Date().toISOString()
  }));
}

function getSerializableState() {
  return {
    projects: state.projects,
    reportText: state.reportText,
    files: state.files,
    importHistory: state.importHistory,
    auditLog: state.auditLog,
    reportConfig: state.reportConfig,
    electronicForm: state.electronicForm
  };
}

async function saveRemoteState() {
  if (!supabaseClient || !currentSession) return;

  const { error } = await supabaseClient
    .from("dashboard_state")
    .upsert({
      id: REMOTE_STATE_ID,
      data: getSerializableState(),
      updated_at: new Date().toISOString(),
      updated_by: currentSession.user.id
    }, { onConflict: "id" });

  if (error) {
    console.warn("Could not save dashboard state to Supabase.", error);
  }
}

function renderSettings() {
  els.settingProjectCount.textContent = state.projects.length;
  els.settingStorageStatus.textContent = currentSession
    ? `Đang đồng bộ ${state.projects.length} dự án lên Supabase.`
    : `Đang lưu tạm ${state.projects.length} dự án trên trình duyệt này.`;
}

async function handleFiles(files) {
  if (!files.length) return;

  addLog(`Đã nhận ${files.length} file. Đang phân tích và lưu file gốc...`);
  els.analysisStatus.textContent = "Đang phân tích";

  const parsedProjects = [];

  for (const file of files) {
    const name = file.name.toLowerCase();
    const fileRecord = {
      name: file.name,
      size: file.size,
      type: file.type || "",
      importedAt: new Date().toISOString()
    };

    try {
      const uploaded = await uploadSourceFile(file);
      Object.assign(fileRecord, uploaded);
      if (uploaded.storagePath) {
        addLog(`Đã lưu file gốc "${file.name}" lên Supabase Storage.`);
      }
    } catch (error) {
      fileRecord.storageError = error.message || String(error);
      addLog(`Chưa lưu được file gốc "${file.name}" lên Storage: ${fileRecord.storageError}`);
    }

    state.files.push(fileRecord);

    try {
      if (name.endsWith(".xlsx") || name.endsWith(".xls")) {
        const rows = await readExcel(file);
        const projects = extractProjectsFromRows(rows);
        parsedProjects.push(...projects);
        addLog(`Excel "${file.name}": đọc ${rows.length} dòng, nhận diện ${projects.length} dự án.`);
      } else if (name.endsWith(".docx")) {
        const text = await readDocx(file);
        state.reportText = cleanText(text);
        els.reportText.value = state.reportText;
        els.docStatus.textContent = `Đã đọc ${Math.round(state.reportText.length / 1000)}k ký tự từ Word`;
        addLog(`Word "${file.name}": trích xuất ${state.reportText.length.toLocaleString("vi-VN")} ký tự thuyết minh.`);
      } else {
        addLog(`Bỏ qua "${file.name}" vì chưa hỗ trợ định dạng này.`);
      }
    } catch (error) {
      addLog(`Không đọc được "${file.name}": ${error.message || error}`);
    }
  }

  if (parsedProjects.length) {
    state.projects = replaceProjectsFromExcelImport(parsedProjects);
    normalizeProjectNumbers();
  }

  els.analysisStatus.textContent = state.projects.length ? "Đã phân tích xong" : "Chưa có bảng dự án";
  els.fileInput.value = "";
  persistState();
  renderAll();
  switchView("dashboardView");
}

async function uploadSourceFile(file) {
  if (!supabaseClient || !currentSession) {
    return { storageBucket: null, storagePath: null, storageStatus: "local-only" };
  }

  const date = new Date().toISOString().slice(0, 10);
  const path = `${currentSession.user.id}/${date}/${Date.now()}-${safeStorageFileName(file.name)}`;
  const { data, error } = await supabaseClient.storage
    .from(SOURCE_FILE_BUCKET)
    .upload(path, file, {
      cacheControl: "3600",
      upsert: false,
      contentType: file.type || "application/octet-stream"
    });

  if (error) throw error;

  return {
    storageBucket: SOURCE_FILE_BUCKET,
    storagePath: data.path,
    storageStatus: "stored"
  };
}

function safeStorageFileName(name) {
  const fallback = "source-file";
  return stringify(name)
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-zA-Z0-9._-]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 140) || fallback;
}

function renderSettings() {
  const storedFiles = state.files.filter((file) => file.storagePath).length;
  els.settingProjectCount.textContent = state.projects.length;
  els.settingStorageStatus.textContent = currentSession
    ? `Supabase đang lưu ${state.projects.length} dự án và ${storedFiles}/${state.files.length} file gốc.`
    : `Đang lưu tạm ${state.projects.length} dự án trên trình duyệt này.`;
}

async function clearData() {
  if (!confirm("Xóa toàn bộ dữ liệu đã phân tích? File gốc trên Storage vẫn được giữ lại để đối chiếu.")) return;

  state.projects = [];
  state.reportText = "";
  state.importHistory = [];
  state.auditLog = [];
  state.reportConfig = {};
  els.reportText.value = "";
  els.analysisLog.innerHTML = "";
  els.analysisStatus.textContent = "Chưa có dữ liệu";
  els.docStatus.textContent = "Chua upload Word";
  persistStateLocal();
  await saveRemoteState();
  renderAll();
}

async function syncStateFromRemote() {
  if (!currentSession || document.hidden) return;
  await restoreState();
  renderAll();
}

window.addEventListener("focus", syncStateFromRemote);

async function handleProjectAssetFiles(files, kind) {
  const project = state.projects[state.selectedProjectId];
  if (!project || !files.length) return;

  const collection = kind === "photo" ? "photos" : "attachments";
  project[collection] = project[collection] || [];

  for (const file of files) {
    try {
      const uploaded = await uploadProjectAsset(file, project, kind);
      project[collection].push({
        name: file.name,
        size: file.size,
        type: file.type || "",
        uploadedAt: new Date().toISOString(),
        ...uploaded
      });
    } catch (error) {
      project[collection].push({
        name: file.name,
        size: file.size,
        type: file.type || "",
        uploadedAt: new Date().toISOString(),
        storageError: error.message || String(error)
      });
    }
  }

  persistState();
  renderProjectDetail(project);
}

async function uploadProjectAsset(file, project, kind) {
  if (!supabaseClient || !currentSession) {
    return { storageBucket: null, storagePath: null, storageStatus: "local-only" };
  }

  const projectCode = `DA-${String(project.stt || state.selectedProjectId + 1).padStart(3, "0")}`;
  const folder = kind === "photo" ? "photos" : "attachments";
  const path = `${currentSession.user.id}/projects/${projectCode}/${folder}/${Date.now()}-${safeStorageFileName(file.name)}`;
  const { data, error } = await supabaseClient.storage
    .from(SOURCE_FILE_BUCKET)
    .upload(path, file, {
      cacheControl: "3600",
      upsert: false,
      contentType: file.type || "application/octet-stream"
    });

  if (error) throw error;

  return {
    storageBucket: SOURCE_FILE_BUCKET,
    storagePath: data.path,
    storageStatus: "stored"
  };
}

async function renderProjectAssets(project) {
  await renderProjectAttachments(project);
  await renderProjectPhotos(project);
}

async function renderProjectAttachments(project) {
  const list = document.getElementById("detailAttachmentList");
  if (!list) return;

  const attachments = project.attachments || [];
  if (!attachments.length) {
    list.innerHTML = `
    <div class="attachment-empty">
      <strong>Chưa có file đính kèm</strong>
      <span>Chèn PDF, Word hoặc Excel để hoàn thiện hồ sơ pháp lý của dự án.</span>
    </div>
  `;
    return;
  }

  const rows = await Promise.all(attachments.map(async (file) => {
    const url = await getStoragePreviewUrl(file.storagePath);
    return `
      <div class="attachment-item">
        <span class="attachment-icon">${assetFileLabel(file)}</span>
        <div>
          <strong>${escapeHtml(file.name)}</strong>
          <em>${formatFileSize(file.size)} · ${formatDateLabel(file.uploadedAt)}${file.storagePath ? " · Đã lưu Storage" : " · Chưa lưu Storage"}</em>
        </div>
        ${url ? `<a class="attachment-open" href="${url}" target="_blank" rel="noreferrer">Mở file</a>` : ""}
      </div>
    `;
  }));

  list.innerHTML = rows.join("");
}

async function renderProjectPhotos(project) {
  const grid = document.getElementById("detailPhotoGrid");
  if (!grid) return;

  const photos = project.photos || [];
  if (!photos.length) {
    grid.innerHTML = `<div>Ảnh thi công 1</div><div>Ảnh thi công 2</div>`;
    return;
  }

  const html = await Promise.all(photos.map(async (photo) => {
    const url = await getStoragePreviewUrl(photo.storagePath);
    return `
      <figure class="site-photo-card">
        ${url ? `<img src="${url}" alt="${escapeHtml(photo.name)}">` : `<div>${escapeHtml(photo.name)}</div>`}
        <figcaption>${escapeHtml(compactSentence(photo.name, 38))}</figcaption>
      </figure>
    `;
  }));

  grid.innerHTML = html.join("");
}

async function getStoragePreviewUrl(path) {
  if (!path || !supabaseClient) return "";

  const { data, error } = await supabaseClient.storage
    .from(SOURCE_FILE_BUCKET)
    .createSignedUrl(path, 60 * 30);

  return error ? "" : data.signedUrl;
}

function assetFileLabel(file) {
  const name = normalizeText(file.name);
  if (name.endsWith(".pdf")) return "PDF";
  if (name.endsWith(".doc") || name.endsWith(".docx")) return "DOC";
  if (name.endsWith(".xls") || name.endsWith(".xlsx")) return "XLS";
  return "FILE";
}

function formatFileSize(size) {
  const value = Number(size) || 0;
  if (value >= 1024 * 1024) return `${(value / 1024 / 1024).toFixed(1)} MB`;
  if (value >= 1024) return `${Math.round(value / 1024)} KB`;
  return `${value} B`;
}

async function renderProjectAttachments(project) {
  const list = document.getElementById("detailAttachmentList");
  if (!list) return;

  const attachments = project.attachments || [];
  if (!attachments.length) {
    list.innerHTML = `
      <div class="attachment-empty">
        <strong>Chưa có file đính kèm</strong>
        <span>Chèn PDF, Word hoặc Excel để hoàn thiện hồ sơ pháp lý của dự án.</span>
      </div>
    `;
    return;
  }

  const rows = await Promise.all(attachments.map(async (file, index) => {
    const url = await getStoragePreviewUrl(file.storagePath);
    return `
      <div class="attachment-item">
        <span class="attachment-icon">${assetFileLabel(file)}</span>
        <div>
          <strong>${escapeHtml(file.name)}</strong>
          <em>${formatFileSize(file.size)} - ${formatDateLabel(file.uploadedAt)}${file.storagePath ? " - Đã lưu Storage" : " - Chưa lưu Storage"}</em>
        </div>
        <div class="asset-actions">
          ${url ? `<a class="attachment-open" href="${url}" target="_blank" rel="noreferrer">Mở file</a>` : ""}
          <button class="asset-delete" data-asset-kind="attachment" data-asset-index="${index}" type="button">Xóa</button>
        </div>
      </div>
    `;
  }));

  list.innerHTML = rows.join("");
  list.querySelectorAll(".asset-delete").forEach((button) => {
    button.addEventListener("click", handleProjectAssetDelete);
  });
}

async function renderProjectPhotos(project) {
  const grid = document.getElementById("detailPhotoGrid");
  if (!grid) return;

  const photos = project.photos || [];
  if (!photos.length) {
    grid.innerHTML = `<div>Ảnh thi công 1</div><div>Ảnh thi công 2</div>`;
    return;
  }

  const html = await Promise.all(photos.map(async (photo, index) => {
    const url = await getStoragePreviewUrl(photo.storagePath);
    return `
      <figure class="site-photo-card">
        <button class="asset-delete photo-delete" data-asset-kind="photo" data-asset-index="${index}" type="button">Xóa</button>
        ${url ? `<img src="${url}" alt="${escapeHtml(photo.name)}">` : `<div>${escapeHtml(photo.name)}</div>`}
        <figcaption>${escapeHtml(compactSentence(photo.name, 38))}</figcaption>
      </figure>
    `;
  }));

  grid.innerHTML = html.join("");
  grid.querySelectorAll(".asset-delete").forEach((button) => {
    button.addEventListener("click", handleProjectAssetDelete);
  });
}

async function handleProjectAssetDelete(event) {
  event.preventDefault();
  const kind = event.currentTarget.dataset.assetKind;
  const index = Number(event.currentTarget.dataset.assetIndex);
  const project = state.projects[state.selectedProjectId];
  const collection = kind === "photo" ? "photos" : "attachments";
  const asset = project?.[collection]?.[index];

  if (!project || !asset) return;
  if (!confirm(`Xóa "${asset.name}" khỏi hồ sơ dự án?`)) return;

  if (asset.storagePath && supabaseClient && currentSession) {
    const { error } = await supabaseClient.storage
      .from(SOURCE_FILE_BUCKET)
      .remove([asset.storagePath]);

    if (error) {
      alert(`Không xóa được file trên Storage: ${error.message}`);
      return;
    }
  }

  project[collection].splice(index, 1);
  persistState();
  renderProjectDetail(project);
}

let pendingProjectAssetSlot = null;

function getProjectDocumentSlots(project) {
  return [
    {
      title: "Quyết định phê duyệt chủ trương đầu tư",
      description: project?.legal || "Đang cập nhật hồ sơ pháp lý của dự án."
    },
    {
      title: "Quyết định phê duyệt dự án/dự toán",
      description: project?.progress || "Đang cập nhật quyết định, dự toán và các phụ lục liên quan."
    }
  ];
}

function findAttachmentSlotIndex(attachments, slot) {
  const exactIndex = attachments.findIndex((file) => Number(file.docSlot) === slot);
  if (exactIndex >= 0) return exactIndex;

  const hasSlottedFiles = attachments.some((file) => file.docSlot !== undefined && file.docSlot !== null);
  if (!hasSlottedFiles && attachments[slot]) return slot;
  return -1;
}

async function renderProjectAttachments(project) {
  const list = document.getElementById("detailAttachmentList");
  const documentList = document.querySelector("#legalPane .document-list");
  if (list) list.innerHTML = "";
  if (!documentList) return;

  const attachments = project.attachments || [];
  const rows = await Promise.all(getProjectDocumentSlots(project).map(async (doc, slot) => {
    const assetIndex = findAttachmentSlotIndex(attachments, slot);
    const file = assetIndex >= 0 ? attachments[assetIndex] : null;
    const url = file ? await getStoragePreviewUrl(file.storagePath) : "";
    const badge = file ? assetFileLabel(file) : "PDF";
    const meta = file
      ? `${escapeHtml(file.name)} - ${formatFileSize(file.size)} - ${formatDateLabel(file.uploadedAt)}`
      : escapeHtml(doc.description);

    return `
      <div class="document-row">
        <span class="document-file-badge">${badge}</span>
        <div class="document-copy">
          <strong>${escapeHtml(doc.title)}</strong>
          <span>${meta}</span>
        </div>
        <div class="document-row-actions">
          ${url ? `<a class="document-open" href="${url}" target="_blank" rel="noreferrer">${badge === "PDF" ? "Xem PDF" : "Mở file"}</a>` : `<button class="document-open is-disabled" type="button" disabled>Xem PDF</button>`}
          <button class="document-upload-btn" data-doc-slot="${slot}" type="button">${file ? "Thay file" : "Chèn file"}</button>
          ${file ? `<button class="asset-delete" data-asset-kind="attachment" data-asset-index="${assetIndex}" type="button">Xóa</button>` : ""}
        </div>
      </div>
    `;
  }));

  documentList.innerHTML = rows.join("");
  documentList.querySelectorAll(".document-upload-btn").forEach((button) => {
    button.addEventListener("click", () => {
      const input = document.getElementById("detailFileInput");
      if (!input) return;
      pendingProjectAssetSlot = { kind: "attachment", slot: Number(button.dataset.docSlot) };
      input.value = "";
      input.click();
    });
  });
  documentList.querySelectorAll(".asset-delete").forEach((button) => {
    button.addEventListener("click", handleProjectAssetDelete);
  });
}

async function renderProjectPhotos(project) {
  const grid = document.getElementById("detailPhotoGrid");
  if (!grid) return;

  const photos = project.photos || [];
  const rows = await Promise.all([0, 1].map(async (slot) => {
    const photo = photos[slot] || null;
    if (!photo) {
      return `
        <button class="site-photo-empty site-photo-upload" data-photo-slot="${slot}" type="button">
          <strong>Ảnh thi công ${slot + 1}</strong>
          <span>Chèn ảnh hiện trường</span>
        </button>
      `;
    }

    const url = await getStoragePreviewUrl(photo.storagePath);
    return `
      <figure class="site-photo-card">
        <div class="site-photo-tools">
          <button class="photo-replace site-photo-upload" data-photo-slot="${slot}" type="button">Thay ảnh</button>
          <button class="asset-delete photo-delete" data-asset-kind="photo" data-asset-index="${slot}" type="button">Xóa</button>
        </div>
        ${url ? `<img src="${url}" alt="${escapeHtml(photo.name)}">` : `<div>${escapeHtml(photo.name)}</div>`}
        <figcaption>Ảnh thi công ${slot + 1}: ${escapeHtml(compactSentence(photo.name, 34))}</figcaption>
      </figure>
    `;
  }));

  grid.innerHTML = rows.join("");
  grid.querySelectorAll(".site-photo-upload").forEach((button) => {
    button.addEventListener("click", () => {
      const input = document.getElementById("detailPhotoInput");
      if (!input) return;
      pendingProjectAssetSlot = { kind: "photo", slot: Number(button.dataset.photoSlot) };
      input.value = "";
      input.click();
    });
  });
  grid.querySelectorAll(".asset-delete").forEach((button) => {
    button.addEventListener("click", handleProjectAssetDelete);
  });
}

async function handleProjectAssetFiles(files, kind) {
  const project = state.projects[state.selectedProjectId];
  if (!project || !files.length) return;

  const collectionName = kind === "photo" ? "photos" : "attachments";
  project[collectionName] = project[collectionName] || [];
  const collection = project[collectionName];
  const selectedSlot = pendingProjectAssetSlot?.kind === kind ? pendingProjectAssetSlot.slot : null;
  pendingProjectAssetSlot = null;

  for (const file of files) {
    const record = {
      name: file.name,
      size: file.size,
      type: file.type || "",
      uploadedAt: new Date().toISOString()
    };

    try {
      Object.assign(record, await uploadProjectAsset(file, project, kind));
    } catch (error) {
      record.storageError = error.message || String(error);
    }

    if (Number.isInteger(selectedSlot)) {
      if (kind === "photo") {
        if (collection[selectedSlot]) await removeStoredAsset(collection[selectedSlot]);
        collection[selectedSlot] = record;
      } else {
        record.docSlot = selectedSlot;
        let targetIndex = collection.findIndex((item) => Number(item.docSlot) === selectedSlot);
        if (targetIndex < 0 && !collection.some((item) => item.docSlot !== undefined && item.docSlot !== null) && collection[selectedSlot]) {
          targetIndex = selectedSlot;
        }
        if (targetIndex >= 0) {
          await removeStoredAsset(collection[targetIndex]);
          collection[targetIndex] = record;
        } else {
          collection.push(record);
        }
      }
    } else {
      collection.push(record);
    }
  }

  persistState();
  renderProjectDetail(project);
}

async function removeStoredAsset(asset) {
  if (!asset?.storagePath || !supabaseClient || !currentSession) return;
  await supabaseClient.storage.from(SOURCE_FILE_BUCKET).remove([asset.storagePath]);
}

function formatDateLabel(value) {
  if (!value) return "Đang cập nhật";
  return new Date(value).toLocaleDateString("vi-VN");
}

function chartLabelLines(text, limit = 20) {
  const words = String(text || "Đang cập nhật").split(/\s+/).filter(Boolean);
  const lines = [];
  let line = "";

  words.forEach((word) => {
    const next = line ? `${line} ${word}` : word;
    if (next.length > limit && line) {
      lines.push(line);
      line = word;
    } else {
      line = next;
    }
  });

  if (line) lines.push(line);
  return lines.slice(0, 3);
}

function openPhotoLightbox(url, title) {
  if (!url) return;
  let lightbox = document.getElementById("photoLightbox");
  if (!lightbox) {
    lightbox = document.createElement("div");
    lightbox.id = "photoLightbox";
    lightbox.className = "photo-lightbox hidden";
    lightbox.innerHTML = `
      <div class="photo-lightbox-inner">
        <div class="photo-lightbox-head">
          <strong class="photo-lightbox-title"></strong>
          <button class="photo-lightbox-close" type="button">Đóng</button>
        </div>
        <img alt="">
      </div>
    `;
    document.body.append(lightbox);
    lightbox.addEventListener("click", (event) => {
      if (event.target === lightbox || event.target.classList.contains("photo-lightbox-close")) {
        lightbox.classList.add("hidden");
      }
    });
  }

  lightbox.querySelector("img").src = url;
  lightbox.querySelector("img").alt = title || "Ảnh hiện trường";
  lightbox.querySelector(".photo-lightbox-title").textContent = title || "Ảnh hiện trường";
  lightbox.classList.remove("hidden");
}

async function renderProjectPhotos(project) {
  const grid = document.getElementById("detailPhotoGrid");
  if (!grid) return;

  project.photos = Array.isArray(project.photos) ? project.photos : [];
  const photos = project.photos;
  const rows = await Promise.all([0, 1].map(async (slot) => {
    const slottedIndex = photos.findIndex((photo) => Number(photo?.photoSlot) === slot);
    const photoIndex = slottedIndex >= 0 ? slottedIndex : slot;
    const photo = photos[photoIndex] || null;

    if (!photo) {
      return `
        <button class="site-photo-empty site-photo-upload" data-photo-slot="${slot}" type="button">
          <strong>Ảnh thi công ${slot + 1}</strong>
          <span>Chèn ảnh hiện trường</span>
        </button>
      `;
    }

    const url = await getStoragePreviewUrl(photo.storagePath);
    const title = `Ảnh thi công ${slot + 1}: ${photo.name || "hiện trường"}`;
    return `
      <figure class="site-photo-card">
        <div class="site-photo-tools">
          ${url ? `<button class="asset-view photo-view" data-photo-url="${url}" data-photo-title="${escapeHtml(title)}" type="button">Xem ảnh</button>` : ""}
          <button class="photo-replace site-photo-upload" data-photo-slot="${slot}" type="button">Thay ảnh</button>
          <button class="asset-delete photo-delete" data-asset-kind="photo" data-asset-index="${photoIndex}" type="button">Xóa</button>
        </div>
        ${url ? `<img src="${url}" alt="${escapeHtml(title)}">` : `<div>${escapeHtml(photo.name || "Ảnh hiện trường")}</div>`}
        <figcaption>${escapeHtml(title)}</figcaption>
      </figure>
    `;
  }));

  grid.innerHTML = rows.join("");
  grid.querySelectorAll(".site-photo-upload").forEach((button) => {
    button.addEventListener("click", () => {
      const input = document.getElementById("detailPhotoInput");
      if (!input) return;
      pendingProjectAssetSlot = { kind: "photo", slot: Number(button.dataset.photoSlot) };
      input.value = "";
      input.click();
    });
  });
  grid.querySelectorAll(".photo-view").forEach((button) => {
    button.addEventListener("click", () => openPhotoLightbox(button.dataset.photoUrl, button.dataset.photoTitle));
  });
  grid.querySelectorAll(".asset-delete").forEach((button) => {
    button.addEventListener("click", handleProjectAssetDelete);
  });
}

async function renderProjectAttachments(project) {
  const list = document.getElementById("detailAttachmentList");
  const documentList = document.querySelector("#legalPane .document-list");
  if (list) list.innerHTML = "";
  if (!documentList) return;

  const attachments = project.attachments || [];
  const rows = await Promise.all(getProjectDocumentSlots(project).map(async (doc, slot) => {
    const assetIndex = findAttachmentSlotIndex(attachments, slot);
    const file = assetIndex >= 0 ? attachments[assetIndex] : null;
    const url = file ? await getStoragePreviewUrl(file.storagePath) : "";
    const badge = file ? assetFileLabel(file) : "PDF";
    const meta = file
      ? `${escapeHtml(file.name)} - ${formatFileSize(file.size)} - ${formatDateLabel(file.uploadedAt)}`
      : escapeHtml(doc.description);
    const viewLabel = badge === "PDF" ? "Xem PDF" : "Mở file";

    return `
      <div class="document-row">
        <span class="document-file-badge">${badge}</span>
        <div class="document-copy">
          <strong>${escapeHtml(doc.title)}</strong>
          <span>${meta}</span>
        </div>
        <div class="document-row-actions">
          ${url ? `<a class="document-open asset-view" href="${url}" target="_blank" rel="noreferrer">${viewLabel}</a>` : `<button class="document-open is-disabled" type="button" disabled>${file ? "Chưa lưu" : "Xem PDF"}</button>`}
          <button class="document-upload-btn" data-doc-slot="${slot}" type="button">${file ? "Thay file" : "Chèn file"}</button>
          ${file ? `<button class="asset-delete" data-asset-kind="attachment" data-asset-index="${assetIndex}" type="button">Xóa</button>` : ""}
        </div>
      </div>
    `;
  }));

  documentList.innerHTML = rows.join("");
  documentList.querySelectorAll(".document-upload-btn").forEach((button) => {
    button.addEventListener("click", () => {
      const input = document.getElementById("detailFileInput");
      if (!input) return;
      pendingProjectAssetSlot = { kind: "attachment", slot: Number(button.dataset.docSlot) };
      input.value = "";
      input.click();
    });
  });
  documentList.querySelectorAll(".asset-delete").forEach((button) => {
    button.addEventListener("click", handleProjectAssetDelete);
  });
}

async function handleProjectAssetFiles(files, kind) {
  const project = state.projects[state.selectedProjectId];
  if (!project || !files.length) return;

  const collectionName = kind === "photo" ? "photos" : "attachments";
  project[collectionName] = Array.isArray(project[collectionName]) ? project[collectionName] : [];
  const collection = project[collectionName];
  const selectedSlot = pendingProjectAssetSlot?.kind === kind ? pendingProjectAssetSlot.slot : null;
  pendingProjectAssetSlot = null;

  for (const file of files) {
    const record = {
      name: file.name,
      size: file.size,
      type: file.type || "",
      uploadedAt: new Date().toISOString()
    };

    try {
      Object.assign(record, await uploadProjectAsset(file, project, kind));
    } catch (error) {
      record.storageError = error.message || String(error);
    }

    if (Number.isInteger(selectedSlot)) {
      if (kind === "photo") {
        record.photoSlot = selectedSlot;
        let targetIndex = collection.findIndex((item) => Number(item?.photoSlot) === selectedSlot);
        if (targetIndex < 0 && collection[selectedSlot]) targetIndex = selectedSlot;
        if (targetIndex >= 0) {
          await removeStoredAsset(collection[targetIndex]);
          collection[targetIndex] = record;
        } else {
          collection[selectedSlot] = record;
        }
      } else {
        record.docSlot = selectedSlot;
        let targetIndex = collection.findIndex((item) => Number(item?.docSlot) === selectedSlot);
        if (targetIndex < 0 && !collection.some((item) => item?.docSlot !== undefined && item?.docSlot !== null) && collection[selectedSlot]) {
          targetIndex = selectedSlot;
        }
        if (targetIndex >= 0) {
          await removeStoredAsset(collection[targetIndex]);
          collection[targetIndex] = record;
        } else {
          collection.push(record);
        }
      }
    } else {
      collection.push(record);
    }
  }

  persistStateLocal();
  await saveRemoteState();
  renderProjectDetail(project);
}

async function handleProjectAssetDelete(event) {
  event.preventDefault();
  const kind = event.currentTarget.dataset.assetKind;
  const index = Number(event.currentTarget.dataset.assetIndex);
  const project = state.projects[state.selectedProjectId];
  const collection = kind === "photo" ? "photos" : "attachments";
  const asset = project?.[collection]?.[index];

  if (!project || !asset) return;
  if (!confirm(`Xóa "${asset.name}" khỏi hồ sơ dự án?`)) return;

  await removeStoredAsset(asset);
  project[collection].splice(index, 1);
  persistStateLocal();
  await saveRemoteState();
  renderProjectDetail(project);
}

function showDetailTab(tabId) {
  document.querySelectorAll(".detail-tab").forEach((button) => {
    button.classList.toggle("active", button.dataset.tab === tabId);
  });
  document.querySelectorAll(".detail-pane").forEach((pane) => {
    pane.classList.toggle("active", pane.id === tabId);
  });

  const project = state.projects[state.selectedProjectId];
  if (project && (tabId === "progressPane" || tabId === "legalPane")) {
    renderProjectAssets(project);
  }
}

function renderChartsLegacyV3() {
  const statusBuckets = buildStatusBuckets(state.projects);
  const labels = statusBuckets.map((item) => item.label);
  const values = statusBuckets.map((item) => item.value);
  const colors = statusBuckets.map((item) => item.color);
  const top = [...state.projects]
    .sort((a, b) => toNumber(b.plan) - toNumber(a.plan))
    .slice(0, 6);

  const centerTextPlugin = {
    id: "centerTextPlugin",
    afterDraw(chart, args, options) {
      if (!options || !chart?.getDatasetMeta(0)?.data?.length) return;
      const { ctx } = chart;
      const point = chart.getDatasetMeta(0).data[0];
      if (!point) return;
      ctx.save();
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillStyle = "#0f172a";
      ctx.font = "800 28px Inter, system-ui, sans-serif";
      ctx.fillText(options.title || "", point.x, point.y - 10);
      ctx.fillStyle = "#64748b";
      ctx.font = "700 12px Inter, system-ui, sans-serif";
      ctx.fillText(options.subtitle || "", point.x, point.y + 16);
      ctx.restore();
    }
  };

  const verticalBarValuePlugin = {
    id: "verticalBarValuePlugin",
    afterDatasetsDraw(chart) {
      const { ctx } = chart;
      ctx.save();
      ctx.textAlign = "center";
      ctx.textBaseline = "bottom";
      ctx.fillStyle = "#0f172a";
      ctx.font = "800 10px Inter, system-ui, sans-serif";
      chart.data.datasets.forEach((dataset, datasetIndex) => {
        chart.getDatasetMeta(datasetIndex).data.forEach((bar, index) => {
          const value = dataset.data[index];
          if (!value || !bar) return;
          ctx.fillText(`${formatNumber(value)} tỷ`, bar.x, bar.y - 6);
        });
      });
      ctx.restore();
    }
  };

  if (state.charts.status) state.charts.status.destroy();
  if (state.charts.budget) state.charts.budget.destroy();

  state.charts.status = new Chart(document.getElementById("statusChart"), {
    type: "doughnut",
    data: {
      labels: labels.length ? labels : ["Chưa có dữ liệu"],
      datasets: [{
        data: values.length ? values : [1],
        backgroundColor: colors.length ? colors : ["#cbd5e1"],
        borderColor: "#ffffff",
        borderWidth: 5,
        hoverOffset: 6
      }]
    },
    options: {
      maintainAspectRatio: false,
      plugins: {
        centerTextPlugin: { title: `${state.projects.length}`, subtitle: "dự án" },
        legend: {
          position: "bottom",
          labels: { boxWidth: 10, padding: 14, font: { size: 11, weight: "700" } }
        },
        tooltip: {
          callbacks: {
            label: (item) => {
              const total = values.reduce((sum, value) => sum + value, 0) || 1;
              const percent = Math.round((item.raw / total) * 100);
              return ` ${item.label}: ${item.raw} dự án (${percent}%)`;
            }
          }
        }
      },
      cutout: "70%"
    },
    plugins: [centerTextPlugin]
  });

  state.charts.budget = new Chart(document.getElementById("budgetChart"), {
    type: "bar",
    data: {
      labels: top.length ? top.map((project, index) => [`${index + 1}.`, ...chartLabelLines(project.name, 18)]) : ["Chưa có dữ liệu"],
      datasets: [{
        label: "Kế hoạch vốn",
        data: top.length ? top.map((project) => toNumber(project.plan)) : [0],
        backgroundColor: "#2563eb",
        borderColor: "#1d4ed8",
        borderWidth: 1,
        borderRadius: 8,
        maxBarThickness: 34
      }, {
        label: "Giải ngân ước tính",
        data: top.length ? top.map((project) => Math.round(toNumber(project.plan) * deriveDisbursementRate(project) / 100)) : [0],
        backgroundColor: "#93c5fd",
        borderColor: "#60a5fa",
        borderWidth: 1,
        borderRadius: 8,
        maxBarThickness: 34
      }]
    },
    options: {
      maintainAspectRatio: false,
      onClick: (event, elements) => {
        const item = elements?.[0];
        if (!item || !top[item.index]) return;
        openProjectDetail(state.projects.indexOf(top[item.index]));
      },
      plugins: {
        legend: {
          display: true,
          position: "top",
          align: "start",
          labels: { boxWidth: 10, boxHeight: 10, usePointStyle: true, pointStyle: "rectRounded", padding: 12, font: { size: 11, weight: "700" } }
        },
        tooltip: {
          callbacks: {
            title: (items) => top[items[0].dataIndex]?.name || "",
            label: (item) => ` ${item.dataset.label}: ${formatNumber(item.raw)} tỷ đồng`,
            afterBody: () => "Bấm cột để mở chi tiết dự án"
          }
        }
      },
      layout: { padding: { top: 8, right: 8 } },
      scales: {
        x: {
          grid: { display: false },
          ticks: { font: { size: 10, weight: "700" }, maxRotation: 0, minRotation: 0 }
        },
        y: {
          beginAtZero: true,
          grace: "18%",
          grid: { color: "#edf2f7" },
          ticks: { font: { size: 10 }, callback: (value) => formatNumber(value) }
        }
      }
    },
    plugins: [verticalBarValuePlugin]
  });

  els.statusSummary.innerHTML = statusBuckets.map((item) => {
    const percent = state.projects.length ? Math.round((item.value / state.projects.length) * 100) : 0;
    return `
      <div class="chart-stat">
        <span class="chart-dot" style="background:${item.color}"></span>
        <div>
          <strong>${item.value} dự án</strong>
          <em>${item.label}: ${percent}%</em>
        </div>
      </div>
    `;
  }).join("");

  const totalPlannedTop = top.reduce((sum, project) => sum + toNumber(project.plan), 0);
  const totalDisbursedTop = top.reduce((sum, project) => sum + Math.round(toNumber(project.plan) * deriveDisbursementRate(project) / 100), 0);
  const leadProject = top[0];

  els.budgetSummary.innerHTML = `
    <div class="chart-note chart-note-strong"><strong>Tổng kế hoạch vốn top 6:</strong> ${formatNumber(totalPlannedTop)} tỷ đồng</div>
    <div class="chart-note chart-note-strong"><strong>Giải ngân ước tính:</strong> ${formatNumber(totalDisbursedTop)} tỷ đồng</div>
    <div class="chart-project-list">
      ${top.map((project, index) => {
        const plan = toNumber(project.plan);
        const disbursed = Math.round(plan * deriveDisbursementRate(project) / 100);
        const projectIndex = state.projects.indexOf(project);
        return `
          <div class="chart-project-row" data-chart-detail="${projectIndex}">
            <span>${index + 1}</span>
            <strong title="${escapeHtml(project.name)}">${escapeHtml(compactSentence(project.name, 58))}</strong>
            <em>Kế hoạch ${formatNumber(plan)} tỷ - Giải ngân ${formatNumber(disbursed)} tỷ</em>
            <button type="button">Chi tiết</button>
          </div>
        `;
      }).join("")}
    </div>
    <div class="chart-note"><strong>Dự án dẫn đầu:</strong> ${escapeHtml(leadProject ? compactSentence(leadProject.name, 72) : "Đang cập nhật")}</div>
  `;

  els.budgetSummary.querySelectorAll("[data-chart-detail]").forEach((row) => {
    row.addEventListener("click", () => openProjectDetail(Number(row.dataset.chartDetail)));
  });
}

function createProjectId() {
  if (globalThis.crypto?.randomUUID) return globalThis.crypto.randomUUID();
  return `project-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function getCurrentUserRole() {
  return currentSession?.user?.app_metadata?.role
    || currentSession?.user?.user_metadata?.role
    || "admin";
}

function canEditProjects() {
  return ["admin", "editor"].includes(String(getCurrentUserRole()).toLowerCase());
}

function applyPermissionUI() {
  const editable = canEditProjects();
  [
    "addProjectBtn",
    "chooseFileBtn",
    "syncSheetBtn",
    "clearDataBtn",
    "settingsClearBtn",
    "settingsRestoreBtn",
    "formAddRowBtn",
    "formDeleteRowBtn",
    "formSaveBtn",
    "formSyncProjectsBtn",
    "detailFileBtn",
    "detailPhotoBtn"
  ].forEach((id) => {
    const element = document.getElementById(id);
    if (element) element.hidden = !editable;
  });
  ["reportTitleInput", "reportPeriodInput", "reportDateInput", "reportRecipientInput"].forEach((id) => {
    const input = document.getElementById(id);
    if (input) input.disabled = !editable;
  });
  if (els.toggleReportIssuesBtn) els.toggleReportIssuesBtn.hidden = !editable;
  updateProjectEditPermission();
}

function updateProjectEditPermission() {
  const button = document.getElementById("editProjectBtn");
  if (!button) return;
  button.hidden = !canEditProjects();
}

function getSelectedProject() {
  const index = Number(state.selectedProjectId);
  if (!Number.isInteger(index)) return null;
  return state.projects[index] || null;
}

function openProjectEditModal() {
  if (!canEditProjects()) {
    alert("Tài khoản hiện tại chỉ có quyền xem.");
    return;
  }

  const project = getSelectedProject();
  const modal = document.getElementById("projectEditModal");
  if (!project || !modal) return;

  project.projectId = project.projectId || createProjectId();
  document.getElementById("editProjectName").value = project.name || "";
  document.getElementById("editProjectPeriod").value = project.period || "2026";
  document.getElementById("editProjectBudget").value = project.budget ?? "";
  document.getElementById("editProjectPlan").value = project.plan ?? "";
  const statusSelect = document.getElementById("editProjectStatus");
  const currentStatus = project.status || "Đang triển khai";
  if (![...statusSelect.options].some((option) => option.value === currentStatus)) {
    statusSelect.add(new Option(currentStatus, currentStatus));
  }
  statusSelect.value = currentStatus;
  document.getElementById("editProjectLegal").value = project.legal || "";
  document.getElementById("editProjectProgress").value = project.progress || "";
  document.getElementById("editProjectDisbursement").value = project.disbursement || "";
  document.getElementById("editProjectDifficulty").value = project.difficulty || "";
  document.getElementById("editProjectSolution").value = project.solution || "";
  modal.classList.remove("hidden");
  document.body.style.overflow = "hidden";
  document.getElementById("editProjectName").focus();
}

function closeProjectEditModal() {
  document.getElementById("projectEditModal")?.classList.add("hidden");
  document.body.style.overflow = "";
}

async function saveProjectEdits(event) {
  event.preventDefault();
  if (!canEditProjects()) return;

  const project = getSelectedProject();
  if (!project) return;

  const fields = {
    name: document.getElementById("editProjectName").value.trim(),
    period: document.getElementById("editProjectPeriod").value.trim(),
    budget: toNumber(document.getElementById("editProjectBudget").value),
    plan: toNumber(document.getElementById("editProjectPlan").value),
    status: document.getElementById("editProjectStatus").value,
    legal: document.getElementById("editProjectLegal").value.trim(),
    progress: document.getElementById("editProjectProgress").value.trim(),
    disbursement: document.getElementById("editProjectDisbursement").value.trim(),
    difficulty: document.getElementById("editProjectDifficulty").value.trim(),
    solution: document.getElementById("editProjectSolution").value.trim()
  };

  if (!fields.name) {
    alert("Tên dự án không được để trống.");
    return;
  }

  const labels = {
    name: "Tên dự án",
    period: "Chu kỳ thực hiện",
    budget: "Tổng mức đầu tư",
    plan: "Kế hoạch vốn",
    status: "Trạng thái",
    legal: "Hồ sơ pháp lý",
    progress: "Tiến độ thực hiện",
    disbursement: "Tình hình giải ngân",
    difficulty: "Khó khăn, vướng mắc",
    solution: "Giải pháp, kiến nghị"
  };
  const changes = Object.entries(fields)
    .filter(([key, value]) => stringify(project[key]) !== stringify(value))
    .map(([key, value]) => ({
      field: key,
      label: labels[key],
      before: project[key] ?? "",
      after: value
    }));

  if (!changes.length) {
    closeProjectEditModal();
    return;
  }

  Object.assign(project, fields, {
    projectId: project.projectId || createProjectId(),
    updatedAt: new Date().toISOString(),
    updatedBy: currentSession?.user?.email || "Tài khoản quản trị"
  });

  state.auditLog = Array.isArray(state.auditLog) ? state.auditLog : [];
  state.auditLog.unshift({
    id: globalThis.crypto?.randomUUID?.() || `${Date.now()}-${Math.random().toString(16).slice(2)}`,
    projectId: project.projectId,
    action: "Cập nhật dự án",
    changedAt: project.updatedAt,
    userId: currentSession?.user?.id || "",
    userEmail: project.updatedBy,
    changes
  });

  normalizeProjectNumbers();
  persistStateLocal();
  const saved = await saveRemoteState();
  renderAll();
  renderProjectDetail(project);
  closeProjectEditModal();

  if (!saved) {
    alert("Thay đổi đang được giữ trên trình duyệt nhưng chưa đồng bộ lên Supabase. Kiểm tra mạng hoặc tải lại để xử lý xung đột.");
  }
}

function renderProjectAudit(project) {
  const list = document.getElementById("projectAuditList");
  const count = document.getElementById("projectAuditCount");
  const updated = document.getElementById("detailUpdated");
  if (!list || !count || !project) return;

  const rows = (state.auditLog || [])
    .filter((entry) => entry.projectId === project.projectId)
    .sort((a, b) => new Date(b.changedAt) - new Date(a.changedAt));

  count.textContent = `${rows.length} cập nhật`;
  if (updated) {
    const latest = rows[0];
    updated.textContent = latest
      ? `Cập nhật gần nhất: ${formatDateTimeLabel(latest.changedAt)} bởi ${latest.userEmail || "Tài khoản quản trị"}`
      : "Chưa có cập nhật thủ công";
  }
  if (!rows.length) {
    list.innerHTML = `<div class="audit-empty">Chưa có thay đổi thủ công nào được ghi nhận cho dự án này.</div>`;
    return;
  }

  list.innerHTML = rows.map((entry) => {
    const initials = String(entry.userEmail || "QT")
      .split(/[\s@._-]+/)
      .filter(Boolean)
      .slice(0, 2)
      .map((part) => part[0]?.toUpperCase())
      .join("") || "QT";
    return `
      <article class="audit-item">
        <div class="audit-avatar">${escapeHtml(initials)}</div>
        <div>
          <div class="audit-meta">
            <div>
              <strong>${escapeHtml(entry.action || "Cập nhật dự án")}</strong>
              <span>${escapeHtml(entry.userEmail || "Tài khoản quản trị")}</span>
            </div>
            <time datetime="${escapeHtml(entry.changedAt)}">${escapeHtml(formatDateTimeLabel(entry.changedAt))}</time>
          </div>
          <div class="audit-changes">
            ${(entry.changes || []).map((change) => `
              <div class="audit-change">
                <b>${escapeHtml(change.label || change.field)}:</b>
                ${escapeHtml(compactAuditValue(change.before))} → ${escapeHtml(compactAuditValue(change.after))}
              </div>
            `).join("")}
          </div>
        </div>
      </article>
    `;
  }).join("");
}

function compactAuditValue(value) {
  const text = stringify(value).trim() || "Chưa có";
  return text.length > 180 ? `${text.slice(0, 177)}...` : text;
}

function renderSettings() {
  if (!els.settingProjectCount) return;

  const allFiles = collectAllStoredFiles();
  const storedFiles = allFiles.filter((file) => file.storagePath);
  const totalFileSize = allFiles.reduce((total, file) => total + (Number(file.size) || 0), 0);
  const syncMeta = readSyncMeta();
  const connected = Boolean(supabaseClient && currentSession);
  const pending = Boolean(syncMeta?.pending);
  const role = getCurrentUserRole();
  const email = currentSession?.user?.email || "Chưa đăng nhập Supabase";

  els.settingProjectCount.textContent = state.projects.length;
  els.settingFileCount.textContent = storedFiles.length;
  els.settingFileSize.textContent = formatFileSize(totalFileSize);
  els.settingImportCount.textContent = (state.importHistory || []).length;
  els.settingAuditCount.textContent = (state.auditLog || []).length;
  els.settingStorageStatus.textContent = connected
    ? `${state.projects.length} dự án đang được lưu trong bảng dashboard_state.`
    : "Chưa có phiên Supabase; dữ liệu hiện chỉ có trong bộ nhớ trình duyệt.";
  els.settingStorageDetail.textContent = `${storedFiles.length}/${allFiles.length} file đã có đường dẫn Storage, tổng dung lượng ghi nhận ${formatFileSize(totalFileSize)}.`;
  els.settingAccountDetail.textContent = connected
    ? `${email} đang đăng nhập bằng Supabase Authentication.`
    : "Chưa xác định được tài khoản đăng nhập.";
  els.settingRoleBadge.textContent = String(role).toUpperCase();
  els.settingLastSync.textContent = remoteStateUpdatedAt
    ? formatDateTimeLabel(remoteStateUpdatedAt)
    : "Chưa ghi nhận";
  els.settingLocalSync.textContent = pending ? "Có thay đổi chờ đồng bộ" : "Đã đồng bộ";
  els.settingStateId.textContent = REMOTE_STATE_ID;

  setStatusBadge(els.settingsHealthBadge, connected && !pending ? "Hoạt động tốt" : pending ? "Chờ đồng bộ" : "Ngoại tuyến", connected && !pending ? "ok" : pending ? "warning" : "error");
  setStatusBadge(els.settingDatabaseBadge, connected ? "Đã kết nối" : "Mất kết nối", connected ? "ok" : "error");
  setStatusBadge(els.settingStorageBadge, storedFiles.length === allFiles.length ? "Đã lưu" : "Cần rà soát", storedFiles.length === allFiles.length ? "ok" : "warning");

  renderSettingsActivity();
}

function collectAllStoredFiles() {
  const files = [...(state.files || [])];
  (state.projects || []).forEach((project) => {
    files.push(...(project.attachments || []), ...(project.photos || []));
  });
  return files.filter(Boolean);
}

function setStatusBadge(element, text, stateName) {
  if (!element) return;
  element.textContent = text;
  element.classList.toggle("is-warning", stateName === "warning");
  element.classList.toggle("is-error", stateName === "error");
}

function renderSettingsActivity() {
  if (!els.settingsRecentActivity) return;
  const imports = (state.importHistory || []).map((item) => ({
    type: item.type || "Nhập dữ liệu",
    title: item.name || "Nguồn dữ liệu",
    date: item.importedAt
  }));
  const audits = (state.auditLog || []).map((item) => ({
    type: item.action || "Cập nhật",
    title: item.userEmail || "Tài khoản quản trị",
    date: item.changedAt
  }));
  const rows = [...imports, ...audits]
    .filter((item) => item.date)
    .sort((a, b) => new Date(b.date) - new Date(a.date))
    .slice(0, 6);

  els.settingsRecentActivity.innerHTML = rows.length
    ? rows.map((item) => `
        <article class="settings-activity-item">
          <span>${escapeHtml(item.type)}</span>
          <strong title="${escapeHtml(item.title)}">${escapeHtml(item.title)}</strong>
          <time datetime="${escapeHtml(item.date)}">${escapeHtml(formatDateTimeLabel(item.date))}</time>
        </article>
      `).join("")
    : `<div class="audit-empty">Chưa có hoạt động dữ liệu nào được ghi nhận.</div>`;
}

async function testSystemConnection() {
  const button = els.settingsTestConnectionBtn;
  if (!button) return;
  const previousText = button.textContent;
  button.disabled = true;
  button.textContent = "Đang kiểm tra...";

  try {
    if (!supabaseClient || !currentSession) throw new Error("Chưa có phiên đăng nhập Supabase.");
    const startedAt = performance.now();
    const { error } = await supabaseClient
      .from("dashboard_state")
      .select("updated_at")
      .eq("id", REMOTE_STATE_ID)
      .maybeSingle();
    if (error) throw error;
    const latency = Math.round(performance.now() - startedAt);
    setStatusBadge(els.settingsHealthBadge, `Kết nối tốt · ${latency} ms`, "ok");
    setStatusBadge(els.settingDatabaseBadge, "Đã kết nối", "ok");
    button.textContent = "Kết nối ổn định";
  } catch (error) {
    setStatusBadge(els.settingsHealthBadge, "Kiểm tra thất bại", "error");
    setStatusBadge(els.settingDatabaseBadge, "Lỗi kết nối", "error");
    alert(`Không kiểm tra được Supabase: ${error.message || error}`);
    button.textContent = "Thử lại kết nối";
  } finally {
    setTimeout(() => {
      button.disabled = false;
      button.textContent = previousText;
    }, 1800);
  }
}

function exportSystemBackup() {
  const backup = {
    schema: "binh-tan-investment-dashboard-backup",
    version: 1,
    exportedAt: new Date().toISOString(),
    exportedBy: currentSession?.user?.email || "",
    remoteStateId: REMOTE_STATE_ID,
    data: getSerializableState()
  };
  const date = backup.exportedAt.slice(0, 10);
  downloadBlob(
    JSON.stringify(backup, null, 2),
    `sao-luu-du-lieu-binh-tan-${date}.json`,
    "application/json;charset=utf-8"
  );
  if (els.settingBackupStatus) {
    els.settingBackupStatus.textContent = `${formatDateTimeLabel(backup.exportedAt)} · ${formatFileSize(new Blob([JSON.stringify(backup)]).size)}`;
  }
}

async function restoreSystemBackup(event) {
  const file = event.target.files?.[0];
  event.target.value = "";
  if (!file) return;
  if (!canEditProjects()) {
    alert("Tài khoản hiện tại chỉ có quyền xem.");
    return;
  }

  try {
    const parsed = JSON.parse(await file.text());
    if (parsed.schema !== "binh-tan-investment-dashboard-backup" || !parsed.data || !Array.isArray(parsed.data.projects)) {
      throw new Error("File không đúng định dạng sao lưu của hệ thống.");
    }
    if (!confirm(`Phục hồi ${parsed.data.projects.length} dự án từ bản sao ngày ${formatDateTimeLabel(parsed.exportedAt)}? Dữ liệu hiện tại sẽ được thay thế.`)) return;

    applySavedState(parsed.data);
    state.reportConfig = parsed.data.reportConfig || {};
    state.auditLog = parsed.data.auditLog || [];
    persistStateLocal();
    const saved = await saveRemoteState();
    renderAll();
    if (!saved) throw new Error("Đã phục hồi trên trình duyệt nhưng chưa đồng bộ được Supabase.");
    alert("Phục hồi dữ liệu thành công.");
  } catch (error) {
    alert(`Không thể phục hồi bản sao: ${error.message || error}`);
  }
}

async function clearData() {
  if (!canEditProjects()) {
    alert("Tài khoản hiện tại chỉ có quyền xem.");
    return;
  }

  const confirmation = prompt(
    `Thao tác này sẽ xóa ${state.projects.length} dự án, lịch sử nhập liệu, nhật ký cập nhật và cấu hình báo cáo. File gốc trên Storage vẫn được giữ lại.\n\nNhập XOA để xác nhận:`
  );
  if (confirmation !== "XOA") return;

  state.projects = [];
  state.reportText = "";
  state.files = [];
  state.importHistory = [];
  state.auditLog = [];
  state.reportConfig = {};
  state.selectedProjectId = null;
  els.reportText.value = "";
  els.analysisLog.innerHTML = "";
  els.analysisStatus.textContent = "Chưa có dữ liệu";
  els.docStatus.textContent = "Chưa upload Word";
  persistStateLocal();
  const saved = await saveRemoteState();
  renderAll();
  switchView("settingsView");
  alert(saved ? "Đã xóa dữ liệu hệ thống. File gốc trên Storage vẫn được giữ lại." : "Đã xóa dữ liệu trên trình duyệt nhưng chưa đồng bộ được Supabase.");
}

function appendProjectAudit(project, action, changes) {
  if (!project) return;
  project.projectId = project.projectId || createProjectId();
  const changedAt = new Date().toISOString();
  project.updatedAt = changedAt;
  project.updatedBy = currentSession?.user?.email || "Tài khoản quản trị";
  state.auditLog = Array.isArray(state.auditLog) ? state.auditLog : [];
  state.auditLog.unshift({
    id: globalThis.crypto?.randomUUID?.() || `${Date.now()}-${Math.random().toString(16).slice(2)}`,
    projectId: project.projectId,
    action,
    changedAt,
    userId: currentSession?.user?.id || "",
    userEmail: project.updatedBy,
    changes
  });
}

function addProject() {
  if (!canEditProjects()) {
    alert("Tài khoản hiện tại chỉ có quyền xem.");
    return;
  }

  const project = {
    projectId: createProjectId(),
    stt: state.projects.length + 1,
    name: "Dự án mới",
    period: "2026",
    budget: 0,
    plan: 0,
    legal: "",
    progress: "",
    disbursement: "",
    difficulty: "",
    solution: "",
    evaluation: "Đang cập nhật",
    status: "Đang triển khai"
  };
  state.projects.push(project);
  state.auditLog = Array.isArray(state.auditLog) ? state.auditLog : [];
  state.auditLog.unshift({
    id: globalThis.crypto?.randomUUID?.() || `${Date.now()}-${Math.random().toString(16).slice(2)}`,
    projectId: project.projectId,
    action: "Tạo dự án",
    changedAt: new Date().toISOString(),
    userId: currentSession?.user?.id || "",
    userEmail: currentSession?.user?.email || "Tài khoản quản trị",
    changes: [{ field: "name", label: "Dự án", before: "", after: project.name }]
  });
  persistState();
  renderAll();
  openProjectDetail(state.projects.length - 1);
  openProjectEditModal();
}

async function handleFiles(files) {
  if (!files.length) return;

  addLog(`Da nhan ${files.length} file. Dang phan tich va luu file goc...`);
  els.analysisStatus.textContent = "Dang phan tich";

  const parsedProjects = [];

  for (const file of files) {
    const name = file.name.toLowerCase();
    const fileRecord = {
      name: file.name,
      size: file.size,
      type: file.type || "",
      importedAt: new Date().toISOString()
    };

    try {
      Object.assign(fileRecord, await uploadSourceFile(file));
      if (fileRecord.storagePath) addLog(`Da luu file goc "${file.name}" len Supabase Storage.`);
    } catch (error) {
      fileRecord.storageError = error.message || String(error);
      addLog(`Chua luu duoc file goc "${file.name}" len Storage: ${fileRecord.storageError}`);
    }

    state.files.push(fileRecord);

    try {
      if (name.endsWith(".xlsx") || name.endsWith(".xls")) {
        const rows = await readExcel(file);
        const projects = extractProjectsFromRows(rows);
        const source = recordImportHistory({
          type: "Excel",
          name: file.name,
          rowCount: rows.length,
          projectCount: projects.length,
          status: projects.length ? "Da phan tich" : "Khong nhan dien du an",
          storageStatus: fileRecord.storageStatus || "",
          storagePath: fileRecord.storagePath || ""
        });
        parsedProjects.push(...markProjectsWithSource(projects, source.id, "Excel"));
        addLog(`Excel "${file.name}": doc ${rows.length} dong, nhan dien ${projects.length} du an.`);
      } else if (name.endsWith(".docx")) {
        const text = await readDocx(file);
        state.reportText = cleanText(text);
        els.reportText.value = state.reportText;
        els.docStatus.textContent = `Da doc ${Math.round(state.reportText.length / 1000)}k ky tu tu Word`;
        recordImportHistory({
          type: "Word",
          name: file.name,
          rowCount: Math.round(state.reportText.length / 1000),
          projectCount: 0,
          status: "Da trich thuyet minh",
          storageStatus: fileRecord.storageStatus || "",
          storagePath: fileRecord.storagePath || ""
        });
        addLog(`Word "${file.name}": trich xuat ${state.reportText.length.toLocaleString("vi-VN")} ky tu thuyet minh.`);
      } else {
        addLog(`Bo qua "${file.name}" vi chua ho tro dinh dang nay.`);
      }
    } catch (error) {
      recordImportHistory({
        type: name.endsWith(".docx") ? "Word" : "File",
        name: file.name,
        rowCount: 0,
        projectCount: 0,
        status: "Loi phan tich",
        storageStatus: fileRecord.storageStatus || "",
        storagePath: fileRecord.storagePath || "",
        error: error.message || String(error)
      });
      addLog(`Khong doc duoc "${file.name}": ${error.message || error}`);
    }
  }

  if (parsedProjects.length) {
    state.projects = replaceProjectsFromExcelImport(parsedProjects);
    normalizeProjectNumbers();
  }

  els.analysisStatus.textContent = state.projects.length ? "Da phan tich xong" : "Chua co bang du an";
  els.fileInput.value = "";
  persistStateLocal();
  await saveRemoteState();
  renderAll();
  switchView("dashboardView");
}

async function deleteImportHistory(id) {
  const index = state.importHistory.findIndex((item) => item.id === id);
  const item = state.importHistory[index];
  if (index < 0 || !item) return;

  const trackedCount = state.projects.filter((project) => project.sourceIds?.includes(id)).length;
  const hasAnyTrackedProject = state.projects.some((project) => Array.isArray(project.sourceIds) && project.sourceIds.length);
  const shouldFallbackRemoveAllProjects = !trackedCount && !hasAnyTrackedProject && item.projectCount > 0 && state.projects.length;
  const hasStoredFile = Boolean(item.storagePath);
  const message = trackedCount
    ? `Xoa nguon "${item.name}" va ${trackedCount} du an nhap tu nguon nay?`
    : shouldFallbackRemoveAllProjects
      ? `Nguon "${item.name}" duoc nhap bang ban cu nen chua co ma nguon rieng. Xoa lich su va go toan bo ${state.projects.length} du an dang hien thi khoi dashboard?`
      : `Xoa lich su "${item.name}"?`;

  if (!confirm(message)) return;

  if (hasStoredFile) {
    await removeStoredAsset(item);
    state.files = state.files.filter((file) => file.storagePath !== item.storagePath);
  }

  if (trackedCount) {
    state.projects = state.projects
      .map((project) => {
        if (!Array.isArray(project.sourceIds)) return project;
        return {
          ...project,
          sourceIds: project.sourceIds.filter((sourceId) => sourceId !== id)
        };
      })
      .filter((project) => !Array.isArray(project.sourceIds) || project.sourceIds.length);
    normalizeProjectNumbers();
  } else if (shouldFallbackRemoveAllProjects) {
    state.projects = [];
  }

  state.importHistory.splice(index, 1);
  persistStateLocal();
  await saveRemoteState();
  renderAll();

  const activeView = document.querySelector(".view.active")?.id;
  if (activeView === "projectDetailView" && !state.projects[state.selectedProjectId]) {
    switchView("dashboardView");
  }
}

function createImportRecord(entry) {
  return {
    id: entry.id || `${Date.now()}-${Math.random().toString(16).slice(2)}`,
    importedAt: entry.importedAt || new Date().toISOString(),
    type: entry.type || "Nguồn dữ liệu",
    name: entry.name || "Chưa đặt tên",
    url: entry.url || "",
    rowCount: Number(entry.rowCount) || 0,
    projectCount: Number(entry.projectCount) || 0,
    status: entry.status || "Đã ghi nhận",
    storageStatus: entry.storageStatus || "",
    storagePath: entry.storagePath || "",
    error: entry.error || ""
  };
}

function recordImportHistory(entry) {
  state.importHistory = Array.isArray(state.importHistory) ? state.importHistory : [];
  const record = createImportRecord(entry);
  state.importHistory.unshift(record);
  return record;
}

function markProjectsWithSource(projects, sourceId, sourceType) {
  return projects.map((project) => ({
    ...project,
    sourceIds: Array.from(new Set([...(project.sourceIds || []), sourceId])),
    sourceType: sourceType || project.sourceType || ""
  }));
}

function mergeProjects(incoming) {
  const map = new Map();
  [...state.projects, ...incoming].forEach((project) => {
    const key = normalizeText(project.name);
    const existing = map.get(key) || {};
    map.set(key, {
      ...existing,
      ...project,
      sourceIds: Array.from(new Set([...(existing.sourceIds || []), ...(project.sourceIds || [])]))
    });
  });
  return [...map.values()];
}

function replaceProjectsFromExcelImport(incoming) {
  const existingByName = new Map(
    state.projects.map((project) => [normalizeText(project.name), project])
  );
  const importedByName = new Map();

  incoming.forEach((project) => {
    const key = normalizeText(project.name);
    if (!key) return;
    const existing = existingByName.get(key) || {};
    const previousImported = importedByName.get(key) || {};
    importedByName.set(key, {
      ...existing,
      ...previousImported,
      ...project,
      projectId: existing.projectId || previousImported.projectId || project.projectId || createProjectId(),
      attachments: existing.attachments || previousImported.attachments || project.attachments || [],
      photos: existing.photos || previousImported.photos || project.photos || []
    });
  });

  return [...importedByName.values()];
}

async function handleGoogleSheetSync() {
  const rawUrl = els.sheetUrlInput?.value.trim();
  if (!rawUrl) {
    addLog("Chưa nhập link Google Sheet.");
    return;
  }

  const button = els.syncSheetBtn;
  const oldText = button?.textContent;

  try {
    if (button) {
      button.disabled = true;
      button.textContent = "Đang đồng bộ...";
    }

    const csvUrl = buildGoogleSheetCsvUrl(rawUrl);
    addLog("Đang lấy dữ liệu từ Google Sheet...");
    const response = await fetch(`/api/google-sheet?url=${encodeURIComponent(csvUrl)}`);
    const text = await response.text();
    if (!response.ok) throw new Error(text || "Không lấy được dữ liệu Google Sheet.");

    const rows = readRowsFromCsvText(text);
    const projects = extractProjectsFromRows(rows);
    const source = recordImportHistory({
      type: "Google Sheet",
      name: compactSentence(rawUrl, 92),
      url: rawUrl,
      rowCount: rows.length,
      projectCount: projects.length,
      status: projects.length ? "Đã đồng bộ" : "Không nhận diện dự án",
      storageStatus: "linked"
    });

    if (projects.length) {
      state.projects = mergeProjects(markProjectsWithSource(projects, source.id, "Google Sheet"));
      normalizeProjectNumbers();
    }

    addLog(`Google Sheet: đọc ${rows.length} dòng, nhận diện ${projects.length} dự án.`);
    els.analysisStatus.textContent = projects.length ? "Đã đồng bộ Google Sheet" : "Sheet chưa có bảng dự án phù hợp";
    persistStateLocal();
    await saveRemoteState();
    renderAll();
    switchView("dashboardView");
  } catch (error) {
    recordImportHistory({
      type: "Google Sheet",
      name: compactSentence(rawUrl, 92),
      url: rawUrl,
      rowCount: 0,
      projectCount: 0,
      status: "Lỗi đồng bộ",
      error: error.message || String(error)
    });
    addLog(`Không đồng bộ được Google Sheet: ${error.message || error}`);
    persistStateLocal();
    await saveRemoteState();
    renderAll();
  } finally {
    if (button) {
      button.disabled = false;
      button.textContent = oldText || "Đồng bộ Sheet";
    }
  }
}

async function handleFiles(files) {
  if (!files.length) return;

  addLog(`Đã nhận ${files.length} file. Đang phân tích và lưu file gốc...`);
  els.analysisStatus.textContent = "Đang phân tích";

  const parsedProjects = [];

  for (const file of files) {
    const name = file.name.toLowerCase();
    const fileRecord = {
      name: file.name,
      size: file.size,
      type: file.type || "",
      importedAt: new Date().toISOString()
    };

    try {
      Object.assign(fileRecord, await uploadSourceFile(file));
      if (fileRecord.storagePath) addLog(`Đã lưu file gốc "${file.name}" lên Supabase Storage.`);
    } catch (error) {
      fileRecord.storageError = error.message || String(error);
      addLog(`Chưa lưu được file gốc "${file.name}" lên Storage: ${fileRecord.storageError}`);
    }

    state.files.push(fileRecord);

    try {
      if (name.endsWith(".xlsx") || name.endsWith(".xls")) {
        const rows = await readExcel(file);
        const projects = extractProjectsFromRows(rows);
        const source = recordImportHistory({
          type: "Excel",
          name: file.name,
          rowCount: rows.length,
          projectCount: projects.length,
          status: projects.length ? "Đã phân tích" : "Không nhận diện dự án",
          storageStatus: fileRecord.storageStatus || "",
          storagePath: fileRecord.storagePath || ""
        });
        parsedProjects.push(...markProjectsWithSource(projects, source.id, "Excel"));
        addLog(`Excel "${file.name}": đọc ${rows.length} dòng, nhận diện ${projects.length} dự án.`);
      } else if (name.endsWith(".docx")) {
        const text = await readDocx(file);
        state.reportText = cleanText(text);
        els.reportText.value = state.reportText;
        els.docStatus.textContent = `Đã đọc ${Math.round(state.reportText.length / 1000)}k ký tự từ Word`;
        recordImportHistory({
          type: "Word",
          name: file.name,
          rowCount: Math.round(state.reportText.length / 1000),
          projectCount: 0,
          status: "Đã trích thuyết minh",
          storageStatus: fileRecord.storageStatus || "",
          storagePath: fileRecord.storagePath || ""
        });
        addLog(`Word "${file.name}": trích xuất ${state.reportText.length.toLocaleString("vi-VN")} ký tự thuyết minh.`);
      } else {
        addLog(`Bỏ qua "${file.name}" vì chưa hỗ trợ định dạng này.`);
      }
    } catch (error) {
      recordImportHistory({
        type: name.endsWith(".docx") ? "Word" : "File",
        name: file.name,
        rowCount: 0,
        projectCount: 0,
        status: "Lỗi phân tích",
        storageStatus: fileRecord.storageStatus || "",
        storagePath: fileRecord.storagePath || "",
        error: error.message || String(error)
      });
      addLog(`Không đọc được "${file.name}": ${error.message || error}`);
    }
  }

  if (parsedProjects.length) {
    state.projects = replaceProjectsFromExcelImport(parsedProjects);
    normalizeProjectNumbers();
  }

  els.analysisStatus.textContent = state.projects.length ? "Đã phân tích xong" : "Chưa có bảng dự án";
  els.fileInput.value = "";
  persistState();
  renderAll();
  switchView("dashboardView");
}

function renderSourceHistory() {
  if (!els.sourceHistory || !els.historySummary) return;

  const rows = Array.isArray(state.importHistory) ? state.importHistory : [];
  els.historySummary.textContent = rows.length
    ? `${rows.length} lần thêm dữ liệu gần nhất`
    : "Chưa có lịch sử";

  if (!rows.length) {
    els.sourceHistory.innerHTML = `
      <div class="history-empty">
        <strong>Chưa có nguồn dữ liệu nào</strong>
        <span>Upload Excel/Word hoặc đồng bộ Google Sheet để hệ thống ghi lại lịch sử.</span>
      </div>
    `;
    return;
  }

  els.sourceHistory.innerHTML = rows.map((item) => {
    const isError = normalizeText(item.status).includes("loi") || item.error;
    const statusClassName = isError ? "is-error" : "is-ok";
    const sourceLink = item.url
      ? `<a href="${escapeHtml(item.url)}" target="_blank" rel="noreferrer">Mở nguồn</a>`
      : "";

    return `
      <div class="history-item">
        <div class="history-type">${escapeHtml(item.type)}</div>
        <div class="history-main">
          <strong>${escapeHtml(item.name)}</strong>
          <span>${formatDateTimeLabel(item.importedAt)} · ${formatNumber(item.rowCount)} dòng · ${formatNumber(item.projectCount)} dự án</span>
          ${item.error ? `<em>${escapeHtml(item.error)}</em>` : ""}
        </div>
        <div class="history-actions">
          <span class="history-status ${statusClassName}">${escapeHtml(item.status)}</span>
          ${sourceLink}
          <button class="history-delete" data-history-delete="${escapeHtml(item.id)}" type="button">Xóa</button>
        </div>
      </div>
    `;
  }).join("");

  els.sourceHistory.querySelectorAll("[data-history-delete]").forEach((button) => {
    button.addEventListener("click", () => deleteImportHistory(button.dataset.historyDelete));
  });
}

async function deleteImportHistory(id) {
  const index = state.importHistory.findIndex((item) => item.id === id);
  const item = state.importHistory[index];
  if (index < 0 || !item) return;

  const trackedCount = state.projects.filter((project) => project.sourceIds?.includes(id)).length;
  const hasAnyTrackedProject = state.projects.some((project) => Array.isArray(project.sourceIds) && project.sourceIds.length);
  const shouldFallbackRemoveAllProjects = !trackedCount && !hasAnyTrackedProject && item.projectCount > 0 && state.projects.length;
  const hasStoredFile = Boolean(item.storagePath);
  const message = trackedCount
    ? `Xóa nguồn "${item.name}" và ${trackedCount} dự án nhập từ nguồn này?`
    : shouldFallbackRemoveAllProjects
      ? `Nguồn "${item.name}" được nhập bằng bản cũ nên chưa có mã nguồn riêng. Xóa lịch sử và gỡ toàn bộ ${state.projects.length} dự án đang hiển thị khỏi dashboard?`
      : `Xóa lịch sử "${item.name}"?`;
  if (!confirm(message)) return;

  if (hasStoredFile) {
    await removeStoredAsset(item);
    state.files = state.files.filter((file) => file.storagePath !== item.storagePath);
  }

  if (trackedCount) {
    state.projects = state.projects
      .map((project) => {
        if (!Array.isArray(project.sourceIds)) return project;
        return {
          ...project,
          sourceIds: project.sourceIds.filter((sourceId) => sourceId !== id)
        };
      })
      .filter((project) => !Array.isArray(project.sourceIds) || project.sourceIds.length);
    normalizeProjectNumbers();
  } else if (shouldFallbackRemoveAllProjects) {
    state.projects = [];
  }

  state.importHistory.splice(index, 1);
  persistStateLocal();
  await saveRemoteState();
  renderAll();

  const activeView = document.querySelector(".view.active")?.id;
  if (activeView === "projectDetailView" && !state.projects[state.selectedProjectId]) {
    switchView("dashboardView");
  }
}

function renderSourceHistory() {
  if (!els.sourceHistory || !els.historySummary) return;

  const rows = Array.isArray(state.importHistory) ? state.importHistory : [];
  els.historySummary.textContent = rows.length
    ? `${rows.length} lần thêm dữ liệu gần nhất`
    : "Chưa có lịch sử";

  if (!rows.length) {
    els.sourceHistory.innerHTML = `
      <div class="history-empty">
        <strong>Chưa có nguồn dữ liệu nào</strong>
        <span>Upload Excel/Word hoặc đồng bộ Google Sheet để hệ thống ghi lại lịch sử.</span>
      </div>
    `;
    return;
  }

  els.sourceHistory.innerHTML = rows.map((item) => {
    const isError = normalizeText(item.status).includes("loi") || item.error;
    const statusClassName = isError ? "is-error" : "is-ok";
    const sourceLink = item.url
      ? `<a href="${escapeHtml(item.url)}" target="_blank" rel="noreferrer">Mở nguồn</a>`
      : "";

    return `
      <div class="history-item">
        <div class="history-type">${escapeHtml(item.type)}</div>
        <div class="history-main">
          <strong>${escapeHtml(item.name)}</strong>
          <span>${formatDateTimeLabel(item.importedAt)} · ${formatNumber(item.rowCount)} dòng · ${formatNumber(item.projectCount)} dự án</span>
          ${item.error ? `<em>${escapeHtml(item.error)}</em>` : ""}
        </div>
        <div class="history-actions">
          <span class="history-status ${statusClassName}">${escapeHtml(item.status)}</span>
          ${sourceLink}
          <button class="history-delete" data-history-delete="${escapeHtml(item.id)}" type="button">Xóa</button>
        </div>
      </div>
    `;
  }).join("");

  els.sourceHistory.querySelectorAll("[data-history-delete]").forEach((button) => {
    button.addEventListener("click", () => deleteImportHistory(button.dataset.historyDelete));
  });
}

async function deleteImportHistory(id) {
  const index = state.importHistory.findIndex((item) => item.id === id);
  const item = state.importHistory[index];
  if (index < 0 || !item) return;

  const hasStoredFile = Boolean(item.storagePath);
  const message = hasStoredFile
    ? `Xóa lịch sử "${item.name}" và file gốc đã lưu trên Storage? Dữ liệu dự án đã nhập sẽ không tự hoàn tác.`
    : `Xóa lịch sử "${item.name}"? Dữ liệu dự án đã nhập sẽ không tự hoàn tác.`;
  if (!confirm(message)) return;

  if (hasStoredFile) {
    await removeStoredAsset(item);
    state.files = state.files.filter((file) => file.storagePath !== item.storagePath);
  }

  state.importHistory.splice(index, 1);
  persistStateLocal();
  await saveRemoteState();
  renderSourceHistory();
  renderSettings();
}

async function deleteImportHistory(id) {
  const index = state.importHistory.findIndex((item) => item.id === id);
  const item = state.importHistory[index];
  if (index < 0 || !item) return;

  const trackedCount = state.projects.filter((project) => project.sourceIds?.includes(id)).length;
  const hasAnyTrackedProject = state.projects.some((project) => Array.isArray(project.sourceIds) && project.sourceIds.length);
  const shouldFallbackRemoveAllProjects = !trackedCount && !hasAnyTrackedProject && item.projectCount > 0 && state.projects.length;
  const hasStoredFile = Boolean(item.storagePath);
  const message = trackedCount
    ? `Xoa nguon "${item.name}" va ${trackedCount} du an nhap tu nguon nay?`
    : shouldFallbackRemoveAllProjects
      ? `Nguon "${item.name}" duoc nhap bang ban cu nen chua co ma nguon rieng. Xoa lich su va go toan bo ${state.projects.length} du an dang hien thi khoi dashboard?`
      : `Xoa lich su "${item.name}"?`;

  if (!confirm(message)) return;

  if (hasStoredFile) {
    await removeStoredAsset(item);
    state.files = state.files.filter((file) => file.storagePath !== item.storagePath);
  }

  if (trackedCount) {
    state.projects = state.projects
      .map((project) => {
        if (!Array.isArray(project.sourceIds)) return project;
        return {
          ...project,
          sourceIds: project.sourceIds.filter((sourceId) => sourceId !== id)
        };
      })
      .filter((project) => !Array.isArray(project.sourceIds) || project.sourceIds.length);
    normalizeProjectNumbers();
  } else if (shouldFallbackRemoveAllProjects) {
    state.projects = [];
  }

  state.importHistory.splice(index, 1);
  persistStateLocal();
  await saveRemoteState();
  renderAll();

  const activeView = document.querySelector(".view.active")?.id;
  if (activeView === "projectDetailView" && !state.projects[state.selectedProjectId]) {
    switchView("dashboardView");
  }
}

function renderChartsLegacyV4() {
  const hasProjects = state.projects.length > 0;
  const statusBuckets = buildStatusBuckets(state.projects);
  const labels = statusBuckets.map((item) => item.label);
  const values = statusBuckets.map((item) => item.value);
  const colors = statusBuckets.map((item) => item.color);
  const top = [...state.projects]
    .sort((a, b) => toNumber(b.plan) - toNumber(a.plan))
    .slice(0, 10);

  const centerTextPlugin = {
    id: "centerTextPlugin",
    afterDraw(chart, args, options) {
      if (!options || !chart?.getDatasetMeta(0)?.data?.length) return;
      const { ctx } = chart;
      const point = chart.getDatasetMeta(0).data[0];
      if (!point) return;
      ctx.save();
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillStyle = "#0f172a";
      ctx.font = "800 28px Inter, system-ui, sans-serif";
      ctx.fillText(options.title || "", point.x, point.y - 10);
      ctx.fillStyle = "#64748b";
      ctx.font = "700 12px Inter, system-ui, sans-serif";
      ctx.fillText(options.subtitle || "", point.x, point.y + 16);
      ctx.restore();
    }
  };

  const emptyChartPlugin = {
    id: "emptyChartPlugin",
    afterDraw(chart, args, options) {
      if (!options?.show) return;
      const { ctx, chartArea } = chart;
      ctx.save();
      ctx.textAlign = "center";
      ctx.fillStyle = "#64748b";
      ctx.font = "800 13px Inter, system-ui, sans-serif";
      ctx.fillText("Chưa có dữ liệu kế hoạch vốn", (chartArea.left + chartArea.right) / 2, (chartArea.top + chartArea.bottom) / 2 - 6);
      ctx.fillStyle = "#94a3b8";
      ctx.font = "700 11px Inter, system-ui, sans-serif";
      ctx.fillText("Upload Excel hoặc đồng bộ Google Sheet để hiển thị biểu đồ", (chartArea.left + chartArea.right) / 2, (chartArea.top + chartArea.bottom) / 2 + 14);
      ctx.restore();
    }
  };

  const compactBarValuePlugin = {
    id: "compactBarValuePlugin",
    afterDatasetsDraw(chart) {
      if (!top.length) return;
      const { ctx } = chart;
      ctx.save();
      ctx.textAlign = "center";
      ctx.textBaseline = "bottom";
      ctx.fillStyle = "#0f172a";
      ctx.font = "800 9px Inter, system-ui, sans-serif";
      chart.getDatasetMeta(0).data.forEach((bar, index) => {
        const value = chart.data.datasets[0].data[index];
        if (!value || !bar || bar.y < 18) return;
        ctx.fillText(`${formatNumber(value)}`, bar.x, bar.y - 5);
      });
      ctx.restore();
    }
  };

  if (state.charts.status) state.charts.status.destroy();
  if (state.charts.budget) state.charts.budget.destroy();

  state.charts.status = new Chart(document.getElementById("statusChart"), {
    type: "doughnut",
    data: {
      labels: labels.length ? labels : ["Chưa có dữ liệu"],
      datasets: [{
        data: values.length ? values : [1],
        backgroundColor: colors.length ? colors : ["#cbd5e1"],
        borderColor: "#ffffff",
        borderWidth: 5,
        hoverOffset: 6
      }]
    },
    options: {
      maintainAspectRatio: false,
      plugins: {
        centerTextPlugin: { title: `${state.projects.length}`, subtitle: "dự án" },
        legend: {
          position: "bottom",
          labels: { boxWidth: 10, padding: 14, font: { size: 11, weight: "700" } }
        },
        tooltip: {
          callbacks: {
            label: (item) => {
              const total = values.reduce((sum, value) => sum + value, 0) || 1;
              const percent = Math.round((item.raw / total) * 100);
              return ` ${item.label}: ${item.raw} dự án (${percent}%)`;
            }
          }
        }
      },
      cutout: "70%"
    },
    plugins: [centerTextPlugin]
  });

  state.charts.budget = new Chart(document.getElementById("budgetChart"), {
    type: "bar",
    data: {
      labels: top.length ? top.map((project, index) => `${index + 1}`) : [],
      datasets: [{
        label: "Kế hoạch vốn",
        data: top.length ? top.map((project) => toNumber(project.plan)) : [],
        backgroundColor: "#2563eb",
        borderColor: "#1d4ed8",
        borderWidth: 1,
        borderRadius: 7,
        maxBarThickness: 22
      }]
    },
    options: {
      maintainAspectRatio: false,
      onClick: (event, elements) => {
        const item = elements?.[0];
        if (!item || !top[item.index]) return;
        openProjectDetail(state.projects.indexOf(top[item.index]));
      },
      plugins: {
        legend: { display: false },
        emptyChartPlugin: { show: !top.length },
        tooltip: {
          callbacks: {
            title: (items) => top[items[0].dataIndex]?.name || "",
            label: (item) => ` Kế hoạch vốn: ${formatNumber(item.raw)} tỷ đồng`,
            afterBody: () => "Bấm cột để mở chi tiết dự án"
          }
        }
      },
      layout: { padding: { top: 14, right: 8 } },
      scales: {
        x: {
          display: hasProjects,
          grid: { display: false },
          ticks: { font: { size: 10, weight: "800" } },
          title: { display: hasProjects, text: "Thứ tự dự án trong danh sách bên dưới", color: "#64748b", font: { size: 10, weight: "700" } }
        },
        y: {
          display: hasProjects,
          beginAtZero: true,
          grace: "18%",
          grid: { color: "#edf2f7" },
          ticks: { font: { size: 10 }, callback: (value) => formatNumber(value) },
          title: { display: hasProjects, text: "Tỷ đồng", color: "#64748b", font: { size: 10, weight: "700" } }
        }
      }
    },
    plugins: [compactBarValuePlugin, emptyChartPlugin]
  });

  els.statusSummary.innerHTML = statusBuckets.map((item) => {
    const percent = state.projects.length ? Math.round((item.value / state.projects.length) * 100) : 0;
    return `
      <div class="chart-stat">
        <span class="chart-dot" style="background:${item.color}"></span>
        <div>
          <strong>${item.value} dự án</strong>
          <em>${item.label}: ${percent}%</em>
        </div>
      </div>
    `;
  }).join("") || `
    <div class="chart-note"><strong>Chưa có dữ liệu</strong> Upload Excel hoặc đồng bộ Google Sheet để phân loại dự án.</div>
  `;

  const totalPlannedTop = top.reduce((sum, project) => sum + toNumber(project.plan), 0);
  const leadProject = top[0];
  els.budgetSummary.innerHTML = top.length ? `
    <div class="chart-note chart-note-strong"><strong>Top ${top.length} kế hoạch vốn:</strong> ${formatNumber(totalPlannedTop)} tỷ đồng</div>
    <div class="chart-project-list">
      ${top.map((project, index) => {
        const plan = toNumber(project.plan);
        const projectIndex = state.projects.indexOf(project);
        return `
          <div class="chart-project-row" data-chart-detail="${projectIndex}">
            <span>${index + 1}</span>
            <strong title="${escapeHtml(project.name)}">${escapeHtml(compactSentence(project.name, 64))}</strong>
            <em>${formatNumber(plan)} tỷ</em>
            <button type="button">Mở</button>
          </div>
        `;
      }).join("")}
    </div>
    <div class="chart-note"><strong>Dự án dẫn đầu:</strong> ${escapeHtml(leadProject ? compactSentence(leadProject.name, 76) : "Đang cập nhật")}</div>
  ` : `
    <div class="chart-note"><strong>Chưa có danh sách dự án</strong> Dữ liệu sẽ xuất hiện tại đây sau khi nhập Excel hoặc Google Sheet.</div>
  `;

  els.budgetSummary.querySelectorAll("[data-chart-detail]").forEach((row) => {
    row.addEventListener("click", () => openProjectDetail(Number(row.dataset.chartDetail)));
  });
}

async function handleFiles(files) {
  if (!files.length) return;

  addLog(`Đã nhận ${files.length} file. Đang phân tích và lưu file gốc...`);
  els.analysisStatus.textContent = "Đang phân tích";

  const parsedProjects = [];

  for (const file of files) {
    const name = file.name.toLowerCase();
    const fileRecord = {
      name: file.name,
      size: file.size,
      type: file.type || "",
      importedAt: new Date().toISOString()
    };

    try {
      Object.assign(fileRecord, await uploadSourceFile(file));
      if (fileRecord.storagePath) addLog(`Đã lưu file gốc "${file.name}" lên Supabase Storage.`);
    } catch (error) {
      fileRecord.storageError = error.message || String(error);
      addLog(`Chưa lưu được file gốc "${file.name}" lên Storage: ${fileRecord.storageError}`);
    }

    state.files.push(fileRecord);

    try {
      if (name.endsWith(".xlsx") || name.endsWith(".xls")) {
        const rows = await readExcel(file);
        const projects = extractProjectsFromRows(rows);
        parsedProjects.push(...projects);
        recordImportHistory({
          type: "Excel",
          name: file.name,
          rowCount: rows.length,
          projectCount: projects.length,
          status: projects.length ? "Đã phân tích" : "Không nhận diện dự án",
          storageStatus: typeof fileRecord !== "undefined" ? fileRecord.storageStatus || "" : "",
          storagePath: typeof fileRecord !== "undefined" ? fileRecord.storagePath || "" : ""
        });
        addLog(`Excel "${file.name}": đọc ${rows.length} dòng, nhận diện ${projects.length} dự án.`);
      } else if (name.endsWith(".docx")) {
        const text = await readDocx(file);
        state.reportText = cleanText(text);
        els.reportText.value = state.reportText;
        els.docStatus.textContent = `Đã đọc ${Math.round(state.reportText.length / 1000)}k ký tự từ Word`;
        recordImportHistory({
          type: "Word",
          name: file.name,
          rowCount: Math.round(state.reportText.length / 1000),
          projectCount: 0,
          status: "Đã trích thuyết minh",
          storageStatus: typeof fileRecord !== "undefined" ? fileRecord.storageStatus || "" : "",
          storagePath: typeof fileRecord !== "undefined" ? fileRecord.storagePath || "" : ""
        });
        addLog(`Word "${file.name}": trích xuất ${state.reportText.length.toLocaleString("vi-VN")} ký tự thuyết minh.`);
      } else {
        addLog(`Bỏ qua "${file.name}" vì chưa hỗ trợ định dạng này.`);
      }
    } catch (error) {
      recordImportHistory({
        type: name.endsWith(".docx") ? "Word" : "File",
        name: file.name,
        rowCount: 0,
        projectCount: 0,
        status: "Lỗi phân tích",
        storageStatus: typeof fileRecord !== "undefined" ? fileRecord.storageStatus || "" : "",
        storagePath: typeof fileRecord !== "undefined" ? fileRecord.storagePath || "" : "",
        error: error.message || String(error)
      });
      addLog(`Không đọc được "${file.name}": ${error.message || error}`);
    }
  }

  if (parsedProjects.length) {
    state.projects = replaceProjectsFromExcelImport(parsedProjects);
    normalizeProjectNumbers();
  }

  els.analysisStatus.textContent = state.projects.length ? "Đã phân tích xong" : "Chưa có bảng dự án";
  els.fileInput.value = "";
  persistState();
  renderAll();
  switchView("dashboardView");
}

async function handleFiles(files) {
  if (!files.length) return;

  addLog(`Da nhan ${files.length} file. Dang phan tich va luu file goc...`);
  els.analysisStatus.textContent = "Dang phan tich";

  const parsedProjects = [];

  for (const file of files) {
    const name = file.name.toLowerCase();
    const fileRecord = {
      name: file.name,
      size: file.size,
      type: file.type || "",
      importedAt: new Date().toISOString()
    };

    try {
      Object.assign(fileRecord, await uploadSourceFile(file));
      if (fileRecord.storagePath) addLog(`Da luu file goc "${file.name}" len Supabase Storage.`);
    } catch (error) {
      fileRecord.storageError = error.message || String(error);
      addLog(`Chua luu duoc file goc "${file.name}" len Storage: ${fileRecord.storageError}`);
    }

    state.files.push(fileRecord);

    try {
      if (name.endsWith(".xlsx") || name.endsWith(".xls")) {
        const rows = await readExcel(file);
        const projects = extractProjectsFromRows(rows);
        const source = recordImportHistory({
          type: "Excel",
          name: file.name,
          rowCount: rows.length,
          projectCount: projects.length,
          status: projects.length ? "Da phan tich" : "Khong nhan dien du an",
          storageStatus: fileRecord.storageStatus || "",
          storagePath: fileRecord.storagePath || ""
        });
        parsedProjects.push(...markProjectsWithSource(projects, source.id, "Excel"));
        addLog(`Excel "${file.name}": doc ${rows.length} dong, nhan dien ${projects.length} du an.`);
      } else if (name.endsWith(".docx")) {
        const text = await readDocx(file);
        state.reportText = cleanText(text);
        els.reportText.value = state.reportText;
        els.docStatus.textContent = `Da doc ${Math.round(state.reportText.length / 1000)}k ky tu tu Word`;
        recordImportHistory({
          type: "Word",
          name: file.name,
          rowCount: Math.round(state.reportText.length / 1000),
          projectCount: 0,
          status: "Da trich thuyet minh",
          storageStatus: fileRecord.storageStatus || "",
          storagePath: fileRecord.storagePath || ""
        });
        addLog(`Word "${file.name}": trich xuat ${state.reportText.length.toLocaleString("vi-VN")} ky tu thuyet minh.`);
      } else {
        addLog(`Bo qua "${file.name}" vi chua ho tro dinh dang nay.`);
      }
    } catch (error) {
      recordImportHistory({
        type: name.endsWith(".docx") ? "Word" : "File",
        name: file.name,
        rowCount: 0,
        projectCount: 0,
        status: "Loi phan tich",
        storageStatus: fileRecord.storageStatus || "",
        storagePath: fileRecord.storagePath || "",
        error: error.message || String(error)
      });
      addLog(`Khong doc duoc "${file.name}": ${error.message || error}`);
    }
  }

  if (parsedProjects.length) {
    state.projects = replaceProjectsFromExcelImport(parsedProjects);
    normalizeProjectNumbers();
  }

  els.analysisStatus.textContent = state.projects.length ? "Da phan tich xong" : "Chua co bang du an";
  els.fileInput.value = "";
  persistStateLocal();
  await saveRemoteState();
  renderAll();
  switchView("dashboardView");
}

let projectAssetMutationInProgress = false;
let pendingProjectAssetResetTimer = null;

async function syncStateFromRemote() {
  if (!currentSession || document.hidden) return;

  if (projectAssetMutationInProgress || pendingProjectAssetSlot) {
    clearTimeout(pendingProjectAssetResetTimer);
    pendingProjectAssetResetTimer = setTimeout(() => {
      if (!projectAssetMutationInProgress) pendingProjectAssetSlot = null;
    }, 1800);
    return;
  }

  await restoreState();
  renderAll();
}

async function saveRemoteState() {
  if (!supabaseClient || !currentSession) return false;

  const snapshotJson = JSON.stringify(getSerializableState());
  const snapshot = JSON.parse(snapshotJson);
  const userId = currentSession.user.id;

  remoteSaveQueue = remoteSaveQueue
    .catch(() => false)
    .then(async () => {
      const nextUpdatedAt = new Date().toISOString();
      let query;

      if (remoteStateUpdatedAt) {
        query = supabaseClient
          .from("dashboard_state")
          .update({
            data: snapshot,
            updated_at: nextUpdatedAt,
            updated_by: userId
          })
          .eq("id", REMOTE_STATE_ID)
          .eq("updated_at", remoteStateUpdatedAt)
          .select("updated_at")
          .maybeSingle();
      } else {
        query = supabaseClient
          .from("dashboard_state")
          .insert({
            id: REMOTE_STATE_ID,
            data: snapshot,
            updated_at: nextUpdatedAt,
            updated_by: userId
          })
          .select("updated_at")
          .maybeSingle();
      }

      const { data, error } = await query;

      if (error) {
        if (error.code === "23505") {
          notifyRemoteConflict();
        } else {
          console.warn("Could not save dashboard state to Supabase.", error);
        }
        return false;
      }

      if (!data) {
        notifyRemoteConflict();
        return false;
      }

      remoteStateUpdatedAt = data.updated_at || nextUpdatedAt;
      remoteConflictNotified = false;
      if (JSON.stringify(getSerializableState()) === snapshotJson) {
        markLocalStateSynced(remoteStateUpdatedAt);
      }
      return true;
    });

  return remoteSaveQueue;
}

function notifyRemoteConflict() {
  if (remoteConflictNotified) return;
  remoteConflictNotified = true;
  alert("Dữ liệu trên Supabase vừa được thay đổi từ tab hoặc thiết bị khác. Hệ thống đã dừng ghi đè để bảo vệ dữ liệu. Hãy tải lại trang trước khi tiếp tục chỉnh sửa.");
}

function getActiveProjectForAssets() {
  const selectedIndex = Number(state.selectedProjectId);
  const byIndex = Number.isInteger(selectedIndex) ? state.projects[selectedIndex] : null;
  if (byIndex) return { project: byIndex, index: selectedIndex };
  return { project: null, index: -1 };
}

function getProjectStorageCode(project, index = -1) {
  const number = project?.stt || (index >= 0 ? index + 1 : 1);
  return `DA-${String(number).padStart(3, "0")}`;
}

async function handleProjectAssetFiles(files, kind) {
  if (!canEditProjects()) {
    alert("Tài khoản hiện tại chỉ có quyền xem.");
    return;
  }
  const { project, index } = getActiveProjectForAssets();
  if (!project || !files.length) return;

  projectAssetMutationInProgress = true;
  clearTimeout(pendingProjectAssetResetTimer);

  try {
    const collectionName = kind === "photo" ? "photos" : "attachments";
    project[collectionName] = Array.isArray(project[collectionName]) ? project[collectionName] : [];
    const collection = project[collectionName];
    const uploadedNames = [];
    const selectedSlot = pendingProjectAssetSlot?.kind === kind ? pendingProjectAssetSlot.slot : null;
    pendingProjectAssetSlot = null;

    for (const file of files) {
      const record = {
        name: file.name,
        size: file.size,
        type: file.type || "",
        uploadedAt: new Date().toISOString()
      };
      uploadedNames.push(file.name);

      try {
        Object.assign(record, await uploadProjectAsset(file, project, kind));
      } catch (error) {
        record.storageError = error.message || String(error);
      }

      if (Number.isInteger(selectedSlot)) {
        if (kind === "photo") {
          record.photoSlot = selectedSlot;
          let targetIndex = collection.findIndex((item) => Number(item?.photoSlot) === selectedSlot);
          if (targetIndex < 0 && collection[selectedSlot]) targetIndex = selectedSlot;
          if (targetIndex >= 0) {
            await removeStoredAsset(collection[targetIndex]);
            collection[targetIndex] = record;
          } else {
            collection[selectedSlot] = record;
          }
        } else {
          record.docSlot = selectedSlot;
          let targetIndex = collection.findIndex((item) => Number(item?.docSlot) === selectedSlot);
          if (targetIndex < 0 && !collection.some((item) => item?.docSlot !== undefined && item?.docSlot !== null) && collection[selectedSlot]) {
            targetIndex = selectedSlot;
          }
          if (targetIndex >= 0) {
            await removeStoredAsset(collection[targetIndex]);
            collection[targetIndex] = record;
          } else {
            collection.push(record);
          }
        }
      } else {
        collection.push(record);
      }
    }

    appendProjectAudit(project, kind === "photo" ? "Cập nhật ảnh hiện trường" : "Cập nhật hồ sơ đính kèm", [{
      field: collectionName,
      label: kind === "photo" ? "Ảnh hiện trường" : "File hồ sơ",
      before: "",
      after: uploadedNames.join(", ")
    }]);
    persistStateLocal();
    const saved = await saveRemoteState();
    if (!saved && currentSession) {
      alert("File đã tải lên Storage nhưng chưa lưu được danh sách vào Supabase. Kiểm tra mạng rồi thử lại.");
    }

    renderProjectDetail(project);
  } finally {
    projectAssetMutationInProgress = false;
  }
}

async function handleProjectAssetDelete(event) {
  event.preventDefault();
  if (!canEditProjects()) {
    alert("Tài khoản hiện tại chỉ có quyền xem.");
    return;
  }
  const kind = event.currentTarget.dataset.assetKind;
  const index = Number(event.currentTarget.dataset.assetIndex);
  const { project } = getActiveProjectForAssets();
  const collection = kind === "photo" ? "photos" : "attachments";
  const asset = project?.[collection]?.[index];

  if (!project || !asset) return;
  if (!confirm(`Xóa "${asset.name}" khỏi hồ sơ dự án?`)) return;

  projectAssetMutationInProgress = true;
  try {
    await removeStoredAsset(asset);
    project[collection].splice(index, 1);
    appendProjectAudit(project, kind === "photo" ? "Xóa ảnh hiện trường" : "Xóa file hồ sơ", [{
      field: collection,
      label: kind === "photo" ? "Ảnh hiện trường" : "File hồ sơ",
      before: asset.name,
      after: "Đã xóa"
    }]);
    persistStateLocal();
    await saveRemoteState();
    renderProjectDetail(project);
  } finally {
    projectAssetMutationInProgress = false;
  }
}

async function renderProjectAssets(project) {
  await ensureProjectAssetsFromStorage(project);
  await renderProjectAttachments(project);
  await renderProjectPhotos(project);
}

async function ensureProjectAssetsFromStorage(project) {
  if (!project || !supabaseClient || !currentSession) return;
  const index = state.projects.indexOf(project);
  const projectCode = getProjectStorageCode(project, index);
  const base = `${currentSession.user.id}/projects/${projectCode}`;
  let recovered = false;

  if (!Array.isArray(project.photos) || !project.photos.length) {
    const photos = await listStoredProjectAssets(`${base}/photos`, "photo");
    if (photos.length) {
      project.photos = photos.slice(0, 2).map((photo, slot) => ({ ...photo, photoSlot: slot }));
      recovered = true;
    }
  }

  if (!Array.isArray(project.attachments) || !project.attachments.length) {
    const attachments = await listStoredProjectAssets(`${base}/attachments`, "attachment");
    if (attachments.length) {
      project.attachments = attachments.slice(0, 2).map((file, slot) => ({ ...file, docSlot: slot }));
      recovered = true;
    }
  }

  if (recovered) {
    persistStateLocal();
    await saveRemoteState();
  }
}

async function listStoredProjectAssets(path, kind) {
  const { data, error } = await supabaseClient.storage
    .from(SOURCE_FILE_BUCKET)
    .list(path, { limit: 20, sortBy: { column: "created_at", order: "asc" } });

  if (error || !Array.isArray(data)) return [];

  return data
    .filter((item) => item.name && !item.id?.startsWith("."))
    .map((item) => ({
      name: item.name.replace(/^\d+-/, ""),
      size: item.metadata?.size || 0,
      type: item.metadata?.mimetype || "",
      uploadedAt: item.created_at || item.updated_at || new Date().toISOString(),
      storageBucket: SOURCE_FILE_BUCKET,
      storagePath: `${path}/${item.name}`,
      storageStatus: "stored",
      recoveredFromStorage: true,
      assetKind: kind
    }));
}

function renderProjectDetail(project) {
  let index = state.projects.indexOf(project);
  if (index < 0 && Number.isInteger(Number(state.selectedProjectId))) {
    index = Number(state.selectedProjectId);
    project = state.projects[index] || project;
  }

  const safeIndex = Math.max(0, index);
  const group = deriveProjectGroup(project);
  const progressRate = deriveProjectRate(project);
  const plan = toNumber(project.plan);
  const budget = toNumber(project.budget);
  const allocationRate = budget > 0 ? plan / budget * 100 : 0;

  els.detailCode.textContent = `DA-2026-${String(safeIndex + 1).padStart(3, "0")}`;
  els.detailGroup.textContent = `Nhóm ${group}`;
  els.detailName.textContent = project.name;
  els.detailMeta.textContent = `Phường Bình Tân | Chu kỳ thực hiện: ${project.period || "2026"}`;
  els.detailBudget.textContent = `${formatNumber(project.budget * 1_000_000_000)} VNĐ`;
  els.detailStatus.textContent = project.status || "Đang cập nhật";
  els.detailStatus.className = `project-status ${statusClass(project.status)}`;
  els.detailLegal.textContent = project.legal || "Đang cập nhật hồ sơ pháp lý.";
  els.detailProgressDoc.textContent = project.progress || "Đang cập nhật tiến độ hồ sơ.";
  els.detailPlan.textContent = `${formatNumber(plan * 1_000_000_000)} VNĐ`;
  els.detailDisbursed.textContent = `${formatNumber(budget * 1_000_000_000)} VNĐ`;
  els.detailDisbRate.textContent = "Kế hoạch vốn / tổng mức đầu tư";
  els.detailRemaining.textContent = `${formatNumber(allocationRate)}%`;
  els.detailContractValue.textContent = `${formatNumber(project.budget * 0.78)} tỷ`;
  els.detailProgressRate.textContent = `${progressRate}%`;
  els.detailProgressBar.style.width = `${progressRate}%`;
  els.detailDifficulty.textContent = project.difficulty || project.progress || "Chưa ghi nhận khó khăn lớn.";
  renderProjectAssets(project);
  renderProjectAudit(project);
  updateProjectEditPermission();
}

async function renderProjectPhotos(project) {
  const grid = document.getElementById("detailPhotoGrid");
  if (!grid) return;

  project.photos = Array.isArray(project.photos) ? project.photos : [];
  const photos = project.photos;
  const rows = await Promise.all([0, 1].map(async (slot) => {
    const slottedIndex = photos.findIndex((photo) => Number(photo?.photoSlot) === slot);
    const photoIndex = slottedIndex >= 0 ? slottedIndex : slot;
    const photo = photos[photoIndex] || null;

    if (!photo) {
      return `
        <button class="site-photo-empty site-photo-upload" data-photo-slot="${slot}" type="button">
          <strong>Ảnh thi công ${slot + 1}</strong>
          <span>Chèn ảnh hiện trường</span>
        </button>
      `;
    }

    const url = await getStoragePreviewUrl(photo.storagePath);
    const title = `Ảnh thi công ${slot + 1}`;
    const fileName = photo.name || "Ảnh hiện trường";
    return `
      <figure class="site-photo-card">
        <div class="site-photo-frame">
          ${url ? `<img src="${url}" alt="${escapeHtml(title)}">` : `<div>${escapeHtml(fileName)}</div>`}
        </div>
        <figcaption class="site-photo-footer">
          <span class="site-photo-caption">
            <strong>${escapeHtml(title)}</strong>
            <span>${escapeHtml(compactSentence(fileName, 36))}</span>
          </span>
          <span class="site-photo-tools">
            ${url ? `<button class="asset-view photo-view" data-photo-url="${url}" data-photo-title="${escapeHtml(`${title}: ${fileName}`)}" type="button">Xem</button>` : ""}
            <button class="photo-replace site-photo-upload" data-photo-slot="${slot}" type="button">Thay</button>
            <button class="asset-delete photo-delete" data-asset-kind="photo" data-asset-index="${photoIndex}" type="button">Xóa</button>
          </span>
        </figcaption>
      </figure>
    `;
  }));

  grid.innerHTML = rows.join("");
  grid.querySelectorAll(".site-photo-upload").forEach((button) => {
    button.addEventListener("click", () => {
      const input = document.getElementById("detailPhotoInput");
      if (!input) return;
      pendingProjectAssetSlot = { kind: "photo", slot: Number(button.dataset.photoSlot) };
      input.value = "";
      input.click();
    });
  });
  grid.querySelectorAll(".photo-view").forEach((button) => {
    button.addEventListener("click", () => openPhotoLightbox(button.dataset.photoUrl, button.dataset.photoTitle));
  });
  grid.querySelectorAll(".asset-delete").forEach((button) => {
    button.addEventListener("click", handleProjectAssetDelete);
  });
}

function renderCharts() {
  const statusBuckets = buildStatusBuckets(state.projects);
  const labels = statusBuckets.map((item) => item.label);
  const values = statusBuckets.map((item) => item.value);
  const colors = statusBuckets.map((item) => item.color);
  const top = [...state.projects]
    .filter((project) => toNumber(project.plan) > 0)
    .sort((a, b) => toNumber(b.plan) - toNumber(a.plan))
    .slice(0, 6);
  const budgetValues = top.map((project) => toNumber(project.budget));
  const plannedValues = top.map((project) => toNumber(project.plan));

  const centerTextPlugin = {
    id: "centerTextPlugin",
    afterDraw(chart, args, options) {
      if (!options || !chart?.getDatasetMeta(0)?.data?.length) return;
      const { ctx } = chart;
      const point = chart.getDatasetMeta(0).data[0];
      if (!point) return;
      ctx.save();
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillStyle = "#0f172a";
      ctx.font = "800 28px Inter, system-ui, sans-serif";
      ctx.fillText(options.title || "", point.x, point.y - 10);
      ctx.fillStyle = "#64748b";
      ctx.font = "700 12px Inter, system-ui, sans-serif";
      ctx.fillText(options.subtitle || "", point.x, point.y + 16);
      ctx.restore();
    }
  };

  const emptyCapitalChartPlugin = {
    id: "emptyCapitalChartPlugin",
    afterDraw(chart, args, options) {
      if (!options?.show || !chart.chartArea) return;
      const { ctx, chartArea } = chart;
      const centerX = (chartArea.left + chartArea.right) / 2;
      const centerY = (chartArea.top + chartArea.bottom) / 2;
      ctx.save();
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillStyle = "#475569";
      ctx.font = "800 13px Inter, system-ui, sans-serif";
      ctx.fillText("Chưa có dữ liệu kế hoạch vốn", centerX, centerY - 8);
      ctx.fillStyle = "#94a3b8";
      ctx.font = "600 11px Inter, system-ui, sans-serif";
      ctx.fillText("Nhập Excel hoặc đồng bộ Google Sheet để hiển thị biểu đồ", centerX, centerY + 14);
      ctx.restore();
    }
  };

  const capitalValuePlugin = {
    id: "capitalValuePlugin",
    afterDatasetsDraw(chart) {
      if (!top.length || !chart.chartArea) return;
      const { ctx } = chart;
      ctx.save();
      ctx.textBaseline = "middle";
      ctx.textAlign = "left";
      chart.data.datasets.forEach((dataset, datasetIndex) => {
        const bars = chart.getDatasetMeta(datasetIndex)?.data || [];
        const values = datasetIndex === 0 ? budgetValues : plannedValues;
        ctx.font = `${datasetIndex === 0 ? "800" : "700"} 10px Inter, system-ui, sans-serif`;
        ctx.fillStyle = datasetIndex === 0 ? "#1e3a8a" : "#2563eb";
        bars.forEach((bar, index) => {
          if (!bar || !values[index]) return;
          ctx.fillText(`${formatNumber(values[index])} tỷ`, bar.x + 6, bar.y);
        });
      });
      ctx.restore();
    }
  };

  if (state.charts.status) state.charts.status.destroy();
  if (state.charts.budget) state.charts.budget.destroy();

  state.charts.status = new Chart(document.getElementById("statusChart"), {
    type: "doughnut",
    data: {
      labels: labels.length ? labels : ["Chưa có dữ liệu"],
      datasets: [{
        data: values.length ? values : [1],
        backgroundColor: colors.length ? colors : ["#cbd5e1"],
        borderColor: "#ffffff",
        borderWidth: 5,
        hoverOffset: 6
      }]
    },
    options: {
      maintainAspectRatio: false,
      plugins: {
        centerTextPlugin: { title: `${state.projects.length}`, subtitle: "dự án" },
        legend: {
          position: "bottom",
          labels: { boxWidth: 10, padding: 14, font: { size: 11, weight: "700" } }
        },
        tooltip: {
          callbacks: {
            label: (item) => {
              const total = values.reduce((sum, value) => sum + value, 0) || 1;
              const percent = Math.round((item.raw / total) * 100);
              return ` ${item.label}: ${item.raw} dự án (${percent}%)`;
            }
          }
        }
      },
      cutout: "70%"
    },
    plugins: [centerTextPlugin]
  });

  state.charts.budget = new Chart(document.getElementById("budgetChart"), {
    type: "bar",
    data: {
      labels: top.map((project) => compactSentence(project.name, 34)),
      datasets: [{
        label: "Tổng mức đầu tư",
        data: budgetValues,
        backgroundColor: "#1e3a8a",
        borderColor: "#172554",
        borderWidth: 0,
        borderRadius: 7,
        borderSkipped: false,
        minBarLength: 3,
        maxBarThickness: 15
      }, {
        label: "Kế hoạch vốn",
        data: plannedValues,
        backgroundColor: "#60a5fa",
        borderColor: "#3b82f6",
        borderWidth: 0,
        borderRadius: 7,
        borderSkipped: false,
        minBarLength: 8,
        maxBarThickness: 15
      }]
    },
    options: {
      indexAxis: "y",
      maintainAspectRatio: false,
      interaction: { mode: "nearest", axis: "y", intersect: false },
      onClick: (event, elements) => {
        const item = elements?.[0];
        if (!item || !top[item.index]) return;
        openProjectDetail(state.projects.indexOf(top[item.index]));
      },
      plugins: {
        legend: {
          display: top.length > 0,
          position: "top",
          align: "start",
          labels: {
            boxWidth: 9,
            boxHeight: 9,
            usePointStyle: true,
            pointStyle: "rectRounded",
            padding: 18,
            color: "#475569",
            font: { size: 11, weight: "700" }
          }
        },
        emptyCapitalChartPlugin: { show: !top.length },
        tooltip: {
          backgroundColor: "#0f172a",
          padding: 12,
          titleFont: { size: 12, weight: "800" },
          bodyFont: { size: 11, weight: "600" },
          callbacks: {
            title: (items) => top[items[0].dataIndex]?.name || "",
            label: (item) => ` ${item.dataset.label}: ${formatNumber(item.raw)} tỷ đồng`,
            afterBody: (items) => {
              const index = items[0]?.dataIndex;
              if (index == null || !budgetValues[index]) return "";
              return `Kế hoạch vốn / tổng mức đầu tư: ${formatNumber(plannedValues[index] / budgetValues[index] * 100)}%`;
            },
            footer: () => "Bấm thanh để mở chi tiết dự án"
          }
        }
      },
      layout: { padding: { top: 2, right: 82, bottom: 4 } },
      scales: {
        x: {
          display: top.length > 0,
          beginAtZero: true,
          grace: "20%",
          grid: { color: "rgba(148, 163, 184, .18)", drawBorder: false },
          border: { display: false },
          ticks: {
            color: "#64748b",
            font: { size: 10, weight: "600" },
            callback: (value) => `${formatNumber(value)} tỷ`
          }
        },
        y: {
          display: top.length > 0,
          grid: { display: false },
          border: { display: false },
          ticks: {
            color: "#334155",
            autoSkip: false,
            crossAlign: "far",
            font: { size: 10, weight: "700" },
            padding: 8
          }
        }
      }
    },
    plugins: [capitalValuePlugin, emptyCapitalChartPlugin]
  });

  els.statusSummary.innerHTML = statusBuckets.map((item) => {
    const percent = state.projects.length ? Math.round((item.value / state.projects.length) * 100) : 0;
    return `
      <div class="chart-stat">
        <span class="chart-dot" style="background:${item.color}"></span>
        <div>
          <strong>${item.value} dự án</strong>
          <em>${item.label}: ${percent}%</em>
        </div>
      </div>
    `;
  }).join("");

  const leadProject = top[0];
  els.budgetSummary.innerHTML = top.length ? `
    <button class="capital-lead-project" data-chart-detail="${state.projects.indexOf(leadProject)}" type="button">
      <span>Dự án có kế hoạch vốn lớn nhất</span>
      <strong>${escapeHtml(compactSentence(leadProject.name, 88))}</strong>
      <em>${formatNumber(toNumber(leadProject.plan))} tỷ đồng · Mở chi tiết →</em>
    </button>
  ` : `
    <div class="capital-summary-empty">
      <strong>Chưa có danh sách vốn để tổng hợp</strong>
      <span>Dữ liệu sẽ tự động xuất hiện sau khi nhập file nguồn.</span>
    </div>
  `;

  els.budgetSummary.querySelector("[data-chart-detail]")?.addEventListener("click", (event) => {
    openProjectDetail(Number(event.currentTarget.dataset.chartDetail));
  });
}
