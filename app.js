const STORAGE_KEY = "bt_project_dashboard_data";
const AUTH_KEY = "bt_project_dashboard_auth";
const SUPABASE_URL = "https://anfttfidxjghbcoyjmhy.supabase.co";
const SUPABASE_KEY = "sb_publishable_AlYPyUMWW26OO1KOWqyH4Q_xNMyzO35";
const REMOTE_STATE_ID = "main";
const SOURCE_FILE_BUCKET = "source-files";

let supabaseClient = null;
let currentSession = null;

const state = {
  projects: [],
  reportText: "",
  files: [],
  importHistory: [],
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

document.addEventListener("DOMContentLoaded", async () => {
  cacheElements();
  normalizeStaticLabels();
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
    "loginScreen", "appShell", "loginForm", "loginUser", "loginPass", "rememberMe",
    "loginError", "logoutBtn", "pageTitle", "pageSub", "searchInput", "sourceSummary",
    "kpiProjects", "kpiBudget", "kpiPlan", "kpiAlerts", "statusSummary", "budgetSummary", "alertList", "fileInput",
    "chooseFileBtn", "dropZone", "analysisStatus", "analysisLog", "previewRows",
    "projectRows", "clearDataBtn", "addProjectBtn", "exportExcelBtn", "exportWordBtn",
    "reportText", "docStatus", "presentationNotes", "capitalRows", "capitalTotalPlan",
    "capitalSlowCount", "capitalHealthyRate", "periodicSummary", "periodicRows",
    "periodicExportBtn", "settingStorageStatus", "settingProjectCount",
    "settingsExportExcelBtn", "settingsClearBtn", "sheetUrlInput", "syncSheetBtn",
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
    projectsNav.append(document.createTextNode("Danh mục dự án"));
  }

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
  els.settingsExportExcelBtn.addEventListener("click", exportCsv);
  els.settingsClearBtn.addEventListener("click", clearData);
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
    state.projects = mergeProjects(parsedProjects);
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
  const nameIndex = findHeaderIndex(header, ["ten du an"]) ?? guessProjectNameIndex(rows, headerIndex + 1) ?? 2;
  const budgetIndex = findHeaderIndex(header, ["tong muc dau tu"]) ?? 3;

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
    const legalIndex = findFirstTextIndex(row, ["phê duyệt", "chủ trương", "pháp lý"], Math.max(5, periodIndex + 1));
    const progressIndex = findFirstTextIndex(row, ["đang", "chậm", "hoàn", "dự kiến", "tạm dừng", "rà soát"], legalIndex + 1);
    const evaluationIndex = findFirstTextIndex(row, ["đảm bảo", "chậm", "không"], progressIndex + 1);

    const project = {
      stt: projects.length + 1,
      name,
      budget: toMoneyNumber(row[budgetIndex]) || toNumber(row[budgetIndex]),
      plan: planCandidates.length ? planCandidates[planCandidates.length - 1] : 0,
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
  const healthyRate = projects.length ? Math.round(((projects.length - alerts.length) / projects.length) * 100) : 0;

  els.kpiProjects.textContent = projects.length;
  els.kpiBudget.textContent = formatNumber(totalBudget);
  els.kpiPlan.textContent = `${healthyRate}%`;
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

function renderCharts() {
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
  const disbRate = deriveDisbursementRate(project);
  const progressRate = deriveProjectRate(project);
  const plan = toNumber(project.plan);
  const disbursed = plan * disbRate / 100;
  const remaining = Math.max(0, plan - disbursed);

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
  els.detailDisbursed.textContent = `${formatNumber(disbursed * 1_000_000_000)} VNĐ`;
  els.detailDisbRate.textContent = `Tỷ lệ: ${disbRate}%`;
  els.detailRemaining.textContent = `${formatNumber(remaining * 1_000_000_000)} VNĐ`;
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

  els.periodicSummary.innerHTML = `
    <strong>Ủy ban nhân dân Phường Bình Tân</strong><br>
    Tổng hợp ${projects.length} dự án đầu tư công, tổng mức đầu tư khoảng <strong>${formatNumber(totalBudget)} tỷ đồng</strong>,
    kế hoạch vốn năm báo cáo khoảng <strong>${formatNumber(totalPlan)} tỷ đồng</strong>.
    Hiện có <strong>${alerts.length}</strong> dự án cần tiếp tục rà soát về tiến độ, pháp lý hoặc khả năng giải ngân.
  `;

  const rows = alerts.length ? alerts : projects.slice(0, 5);
  els.periodicRows.innerHTML = rows.length ? rows.map((project) => `
    <div class="note-card">
      <strong>${escapeHtml(project.name)}</strong>
      <p>${escapeHtml(project.difficulty || project.progress || project.disbursement || "Dự án đang được cập nhật thông tin phục vụ báo cáo định kỳ.")}</p>
    </div>
  `).join("") : `<div class="note-card"><strong>Chưa có dữ liệu</strong><p>Upload phụ lục Excel hoặc nhập dự án để sinh nội dung báo cáo định kỳ.</p></div>`;
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
  const report = buildWordHtml();
  downloadBlob(report, "bao-cao-du-an-binh-tan.doc", "application/msword;charset=utf-8");
}

function buildWordHtml() {
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

  return `
    <html>
    <head>
      <meta charset="UTF-8">
      <style>
        body { font-family: "Times New Roman", serif; font-size: 13pt; }
        h1, h2 { text-align: center; }
        table { width: 100%; border-collapse: collapse; }
        td, th { border: 1px solid #000; padding: 6px; vertical-align: top; }
        th { font-weight: bold; text-align: center; }
      </style>
    </head>
    <body>
      <p><strong>ỦY BAN NHÂN DÂN PHƯỜNG BÌNH TÂN</strong></p>
      <h2>BÁO CÁO</h2>
      <h1>Về tiến độ các dự án đầu tư công trên địa bàn phường Bình Tân</h1>
      <p>${escapeHtml(state.reportText || "Nội dung thuyết minh sẽ được bổ sung từ file Word hoặc nhập trực tiếp trên hệ thống.")}</p>
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
    </body>
    </html>
  `;
}

function clearData() {
  if (!confirm("Xóa toàn bộ dữ liệu đã phân tích trên trình duyệt này?")) return;
  state.projects = [];
  state.reportText = "";
  state.files = [];
  state.importHistory = [];
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
  state.importHistory = state.importHistory.slice(0, 30);
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

function renderCharts() {
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
      .select("data")
      .eq("id", REMOTE_STATE_ID)
      .maybeSingle();

    const localState = readLocalState();
    const remoteState = data?.data;

    if (!error && data) {
      applySavedState(remoteState);
      persistStateLocal();
      return;
    }

    if (!error && !data && hasUsefulState(localState)) {
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
    saved.importHistory?.length
  ));
}

function applySavedState(saved) {
  state.projects = saved.projects || [];
  state.reportText = saved.reportText || "";
  state.files = saved.files || [];
  state.importHistory = saved.importHistory || saved.sourceHistory || [];
  els.reportText.value = state.reportText;
  normalizeProjectNumbers();
}

function persistState() {
  persistStateLocal();
  saveRemoteState();
}

function persistStateLocal() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(getSerializableState()));
}

function getSerializableState() {
  return {
    projects: state.projects,
    reportText: state.reportText,
    files: state.files,
    importHistory: state.importHistory
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
    state.projects = mergeProjects(parsedProjects);
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
  state.files = [];
  state.importHistory = [];
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

function normalizeStaticLabels() {
  const projectsNav = document.querySelector('.nav-item[data-view="projectsView"]');
  if (projectsNav) {
    const icon = projectsNav.querySelector(".icon");
    projectsNav.textContent = "";
    if (icon) projectsNav.append(icon);
    projectsNav.append(document.createTextNode("Danh mục dự án"));
  }

  const progressPane = document.getElementById("progressPane");
  const photoGrid = progressPane?.querySelector(".site-photos");
  if (photoGrid && !photoGrid.id) {
    photoGrid.id = "detailPhotoGrid";
  }

  if (progressPane && !document.getElementById("detailPhotoInput")) {
    const input = document.createElement("input");
    input.id = "detailPhotoInput";
    input.type = "file";
    input.multiple = true;
    input.accept = "image/*";
    input.hidden = true;
    progressPane.append(input);
  }
}

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

function renderCharts() {
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
    state.projects = mergeProjects(parsedProjects);
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
  state.importHistory = state.importHistory.slice(0, 30);
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
    state.projects = mergeProjects(parsedProjects);
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

function renderCharts() {
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
    state.projects = mergeProjects(parsedProjects);
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
    state.projects = mergeProjects(parsedProjects);
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
    return false;
  }

  return true;
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
  const { project, index } = getActiveProjectForAssets();
  if (!project || !files.length) return;

  projectAssetMutationInProgress = true;
  clearTimeout(pendingProjectAssetResetTimer);

  try {
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
  const disbRate = deriveDisbursementRate(project);
  const progressRate = deriveProjectRate(project);
  const plan = toNumber(project.plan);
  const disbursed = plan * disbRate / 100;
  const remaining = Math.max(0, plan - disbursed);

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
  els.detailDisbursed.textContent = `${formatNumber(disbursed * 1_000_000_000)} VNĐ`;
  els.detailDisbRate.textContent = `Tỷ lệ: ${disbRate}%`;
  els.detailRemaining.textContent = `${formatNumber(remaining * 1_000_000_000)} VNĐ`;
  els.detailContractValue.textContent = `${formatNumber(project.budget * 0.78)} tỷ`;
  els.detailProgressRate.textContent = `${progressRate}%`;
  els.detailProgressBar.style.width = `${progressRate}%`;
  els.detailDifficulty.textContent = project.difficulty || project.progress || "Chưa ghi nhận khó khăn lớn.";
  renderProjectAssets(project);
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

  const compactBarValuePlugin = {
    id: "compactBarValuePlugin",
    afterDatasetsDraw(chart) {
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
      labels: top.length ? top.map((project, index) => `${index + 1}`) : ["0"],
      datasets: [{
        label: "Kế hoạch vốn",
        data: top.length ? top.map((project) => toNumber(project.plan)) : [0],
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
          grid: { display: false },
          ticks: { font: { size: 10, weight: "800" } },
          title: { display: true, text: "Thứ tự dự án trong danh sách bên dưới", color: "#64748b", font: { size: 10, weight: "700" } }
        },
        y: {
          beginAtZero: true,
          grace: "18%",
          grid: { color: "#edf2f7" },
          ticks: { font: { size: 10 }, callback: (value) => formatNumber(value) },
          title: { display: true, text: "Tỷ đồng", color: "#64748b", font: { size: 10, weight: "700" } }
        }
      }
    },
    plugins: [compactBarValuePlugin]
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
  const leadProject = top[0];
  els.budgetSummary.innerHTML = `
    <div class="chart-note chart-note-strong"><strong>Top ${top.length || 0} kế hoạch vốn:</strong> ${formatNumber(totalPlannedTop)} tỷ đồng</div>
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
  `;

  els.budgetSummary.querySelectorAll("[data-chart-detail]").forEach((row) => {
    row.addEventListener("click", () => openProjectDetail(Number(row.dataset.chartDetail)));
  });
}
