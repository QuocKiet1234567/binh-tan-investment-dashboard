const STORAGE_KEY = "bt_project_dashboard_data";
const AUTH_KEY = "bt_project_dashboard_auth";

const state = {
  projects: [],
  reportText: "",
  files: [],
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

document.addEventListener("DOMContentLoaded", () => {
  cacheElements();
  bindEvents();
  restoreState();

  if (getSavedAuth()) {
    showApp();
  } else {
    showLogin();
  }
});

function cacheElements() {
  [
    "loginScreen", "appShell", "loginForm", "loginUser", "loginPass", "rememberMe",
    "loginError", "logoutBtn", "pageTitle", "pageSub", "searchInput", "sourceSummary",
    "kpiProjects", "kpiBudget", "kpiPlan", "kpiAlerts", "alertList", "fileInput",
    "chooseFileBtn", "dropZone", "analysisStatus", "analysisLog", "previewRows",
    "projectRows", "clearDataBtn", "addProjectBtn", "exportExcelBtn", "exportWordBtn",
    "reportText", "docStatus", "presentationNotes", "capitalRows", "capitalTotalPlan",
    "capitalSlowCount", "capitalHealthyRate", "periodicSummary", "periodicRows",
    "periodicExportBtn", "settingStorageStatus", "settingProjectCount",
    "settingsExportExcelBtn", "settingsClearBtn"
  ].forEach((id) => {
    els[id] = document.getElementById(id);
  });
}

function bindEvents() {
  els.loginForm.addEventListener("submit", handleLogin);
  els.logoutBtn.addEventListener("click", handleLogout);
  els.chooseFileBtn.addEventListener("click", () => els.fileInput.click());
  els.fileInput.addEventListener("change", (event) => handleFiles([...event.target.files]));
  els.searchInput.addEventListener("input", renderProjectsTable);
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
    importView: ["Nhập dữ liệu", "Upload Word/Excel để hệ thống tự phân tích."],
    projectsView: ["Danh mục dự án", "Chỉnh sửa dữ liệu trước khi xuất báo cáo."],
    reportView: ["Báo cáo trình bày", "Tổng hợp nội dung để xếp sử dụng khi thuyết trình."],
    capitalView: ["Kế hoạch vốn", "Theo dõi kế hoạch vốn, giải ngân và điều chỉnh trong kỳ."],
    periodicView: ["Báo cáo định kỳ", "Tổng hợp nội dung phục vụ họp và báo cáo cấp trên."],
    settingsView: ["Cấu hình hệ thống", "Quản trị dữ liệu, phiên làm việc và thao tác hệ thống."]
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
  persistState();
  renderAll();
  switchView("dashboardView");
}

function readExcel(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const workbook = XLSX.read(reader.result, { type: "array" });
        const sheetName = workbook.SheetNames[0];
        const sheet = workbook.Sheets[sheetName];
        const rows = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: "" });
        resolve(rows);
      } catch (error) {
        reject(error);
      }
    };
    reader.onerror = () => reject(reader.error);
    reader.readAsArrayBuffer(file);
  });
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
  const nameIndex = findHeaderIndex(header, ["ten du an"]) ?? 2;
  const budgetIndex = findHeaderIndex(header, ["tong muc dau tu"]) ?? 3;

  for (let index = Math.max(headerIndex + 1, 0); index < rows.length; index += 1) {
    const row = rows[index];
    const name = stringify(row[nameIndex]).trim();

    if (!isProjectRow(row, name)) continue;

    const numericBand = row.slice(budgetIndex + 1, budgetIndex + 5).map(toNumber).filter((value) => value > 0);
    const periodIndex = row.findIndex((cell) => /\b20\d{2}\b/.test(stringify(cell)));
    const legalIndex = findFirstTextIndex(row, ["phê duyệt", "chủ trương", "pháp lý"], Math.max(5, periodIndex + 1));
    const progressIndex = findFirstTextIndex(row, ["đang", "chậm", "hoàn", "dự kiến", "tạm dừng", "rà soát"], legalIndex + 1);
    const evaluationIndex = findFirstTextIndex(row, ["đảm bảo", "chậm", "không"], progressIndex + 1);

    const project = {
      stt: projects.length + 1,
      name,
      budget: toNumber(row[budgetIndex]),
      plan: numericBand.length ? numericBand[numericBand.length - 1] : 0,
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
  return row.some((cell) => toNumber(cell) > 0);
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
    if (text.length < 4 || toNumber(row[index]) > 0) continue;
    if (normalizedTerms.some((term) => text.includes(term))) return index;
  }
  return Math.max(0, start);
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
  const top = [...state.projects].sort((a, b) => b.budget - a.budget).slice(0, 8);

  if (state.charts.status) state.charts.status.destroy();
  if (state.charts.budget) state.charts.budget.destroy();

  state.charts.status = new Chart(document.getElementById("statusChart"), {
    type: "doughnut",
    data: {
      labels: labels.length ? labels : ["Chưa có dữ liệu"],
      datasets: [{
        data: values.length ? values : [1],
        backgroundColor: ["#2563eb", "#16a34a", "#d97706", "#dc2626", "#64748b"],
        borderWidth: 0
      }]
    },
    options: {
      maintainAspectRatio: false,
      plugins: { legend: { position: "bottom" } },
      cutout: "68%"
    }
  });

  state.charts.budget = new Chart(document.getElementById("budgetChart"), {
    type: "bar",
    data: {
      labels: top.length ? top.map((project) => `D${project.stt}`) : ["Chưa có dữ liệu"],
      datasets: [{
        label: "Tổng mức đầu tư",
        data: top.length ? top.map((project) => project.budget) : [0],
        backgroundColor: "#2563eb",
        borderRadius: 6
      }]
    },
    options: {
      maintainAspectRatio: false,
      plugins: { legend: { display: false } },
      scales: {
        y: { beginAtZero: true, grid: { color: "#edf2f7" } },
        x: { grid: { display: false } }
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
  const rows = state.projects.filter((project) => {
    const content = normalizeText(Object.values(project).join(" "));
    return !keyword || content.includes(keyword);
  });

  els.projectRows.innerHTML = rows.length ? rows.map((project) => `
    <tr data-index="${project.stt - 1}">
      <td>${project.stt}</td>
      <td><textarea data-field="name">${escapeHtml(project.name)}</textarea></td>
      <td><input data-field="budget" type="number" step="0.001" value="${project.budget || 0}"></td>
      <td><input data-field="plan" type="number" step="0.001" value="${project.plan || 0}"></td>
      <td><textarea data-field="progress">${escapeHtml(project.progress)}</textarea></td>
      <td><textarea data-field="difficulty">${escapeHtml(project.difficulty)}</textarea></td>
      <td><textarea data-field="evaluation">${escapeHtml(project.evaluation || project.status)}</textarea></td>
      <td><button class="row-delete" data-delete="${project.stt - 1}">Xóa</button></td>
    </tr>
  `).join("") : `<tr><td colspan="8">Chưa có dữ liệu dự án.</td></tr>`;

  els.projectRows.querySelectorAll("[data-field]").forEach((input) => {
    input.addEventListener("change", handleProjectEdit);
  });
  els.projectRows.querySelectorAll("[data-delete]").forEach((button) => {
    button.addEventListener("click", handleProjectDelete);
  });
}

function handleProjectEdit(event) {
  const row = event.target.closest("tr");
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
    XLSX.utils.book_append_sheet(workbook, worksheet, "Phu luc du an");
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

function formatNumber(value) {
  return toNumber(value).toLocaleString("vi-VN", { maximumFractionDigits: 3 });
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
