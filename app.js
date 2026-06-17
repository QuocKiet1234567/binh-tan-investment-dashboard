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
    "settingsExportExcelBtn", "settingsClearBtn"
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
              <span>${escapeHtml(project.status || "Dang cap nhat")}</span>
            </div>
          </div>
        </td>
        <td>
          <div class="capital-money">
            <strong>${formatNumber(project.budget)}</strong>
            <span>Tong muc dau tu</span>
          </div>
        </td>
        <td>
          <div class="capital-money highlight">
            <strong>${formatNumber(project.plan)}</strong>
            <span>${planShare}% tong muc dau tu</span>
          </div>
        </td>
        <td>
          <div class="capital-progress ${stateClass}">
            <div class="capital-progress-head">
              <strong>${disbursementRate}%</strong>
              <span>${escapeHtml(compactSentence(project.disbursement || "Dang cap nhat"))}</span>
            </div>
            <div class="capital-progress-bar">
              <span style="width:${disbursementRate}%"></span>
            </div>
          </div>
        </td>
        <td><span class="project-status ${stateClass}">${escapeHtml(project.evaluation || project.status)}</span></td>
      </tr>
    `;
  }).join("") : `<tr><td colspan="6">Chua co du lieu ke hoach von. Hay nhap du lieu tu file Excel.</td></tr>`;
}

function buildStatusBuckets(projects) {
  const buckets = [
    { key: "good", label: "Dam bao tien do", color: "#2563eb", value: 0 },
    { key: "active", label: "Dang trien khai", color: "#16a34a", value: 0 },
    { key: "done", label: "Hoan thanh", color: "#0f766e", value: 0 },
    { key: "risk", label: "Can xu ly", color: "#dc2626", value: 0 }
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

  if (state.charts.status) state.charts.status.destroy();
  if (state.charts.budget) state.charts.budget.destroy();

  state.charts.status = new Chart(document.getElementById("statusChart"), {
    type: "doughnut",
    data: {
      labels: labels.length ? labels : ["Chua co du lieu"],
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
          subtitle: "du an"
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
              return ` ${item.label}: ${item.raw} du an (${percent}%)`;
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
      labels: top.length ? top.map((project) => shortProjectName(project.name)) : ["Chua co du lieu"],
      datasets: [{
        label: "Ke hoach von",
        data: top.length ? top.map((project) => toNumber(project.plan)) : [0],
        backgroundColor: "#2563eb",
        borderColor: "#1d4ed8",
        borderWidth: 1,
        borderRadius: 6,
        barThickness: 12
      }, {
        label: "Giai ngan uoc tinh",
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
            label: (item) => ` ${item.dataset.label}: ${formatNumber(item.raw)} ty dong`
          }
        }
      },
      scales: {
        x: {
          beginAtZero: true,
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
    }
  });

  els.statusSummary.innerHTML = statusBuckets.map((item) => {
    const percent = state.projects.length ? Math.round((item.value / state.projects.length) * 100) : 0;
    return `
      <div class="chart-stat">
        <span class="chart-dot" style="background:${item.color}"></span>
        <div>
          <strong>${item.value} du an</strong>
          <em>${item.label} ${percent}%</em>
        </div>
      </div>
    `;
  }).join("");

  const totalPlannedTop = top.reduce((sum, project) => sum + toNumber(project.plan), 0);
  const totalDisbursedTop = top.reduce((sum, project) => sum + Math.round(toNumber(project.plan) * deriveDisbursementRate(project) / 100), 0);
  const leadProject = top[0];

  els.budgetSummary.innerHTML = `
    <div class="chart-note"><strong>Top 6 ke hoach von:</strong> ${formatNumber(totalPlannedTop)} ty dong</div>
    <div class="chart-note"><strong>Giai ngan uoc tinh:</strong> ${formatNumber(totalDisbursedTop)} ty dong</div>
    <div class="chart-note"><strong>Du an dung dau:</strong> ${escapeHtml(leadProject ? compactSentence(leadProject.name, 64) : "Dang cap nhat")}</div>
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

  els.loginError.textContent = "Dang dang nhap...";
  const { data, error } = await supabaseClient.auth.signInWithPassword({ email, password });

  if (error) {
    els.loginError.textContent = "Dang nhap khong thanh cong. Kiem tra email/mat khau trong Supabase.";
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
    saved.files?.length
  ));
}

function applySavedState(saved) {
  state.projects = saved.projects || [];
  state.reportText = saved.reportText || "";
  state.files = saved.files || [];
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
    files: state.files
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
    ? `Dang dong bo ${state.projects.length} du an len Supabase.`
    : `Dang luu tam ${state.projects.length} du an tren trinh duyet nay.`;
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
      const uploaded = await uploadSourceFile(file);
      Object.assign(fileRecord, uploaded);
      if (uploaded.storagePath) {
        addLog(`Da luu file goc "${file.name}" len Supabase Storage.`);
      }
    } catch (error) {
      fileRecord.storageError = error.message || String(error);
      addLog(`Chua luu duoc file goc "${file.name}" len Storage: ${fileRecord.storageError}`);
    }

    state.files.push(fileRecord);

    try {
      if (name.endsWith(".xlsx") || name.endsWith(".xls")) {
        const rows = await readExcel(file);
        const projects = extractProjectsFromRows(rows);
        parsedProjects.push(...projects);
        addLog(`Excel "${file.name}": doc ${rows.length} dong, nhan dien ${projects.length} du an.`);
      } else if (name.endsWith(".docx")) {
        const text = await readDocx(file);
        state.reportText = cleanText(text);
        els.reportText.value = state.reportText;
        els.docStatus.textContent = `Da doc ${Math.round(state.reportText.length / 1000)}k ky tu tu Word`;
        addLog(`Word "${file.name}": trich xuat ${state.reportText.length.toLocaleString("vi-VN")} ky tu thuyet minh.`);
      } else {
        addLog(`Bo qua "${file.name}" vi chua ho tro dinh dang nay.`);
      }
    } catch (error) {
      addLog(`Khong doc duoc "${file.name}": ${error.message || error}`);
    }
  }

  if (parsedProjects.length) {
    state.projects = mergeProjects(parsedProjects);
    normalizeProjectNumbers();
  }

  els.analysisStatus.textContent = state.projects.length ? "Da phan tich xong" : "Chua co bang du an";
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
    ? `Supabase dang luu ${state.projects.length} du an va ${storedFiles}/${state.files.length} file goc.`
    : `Dang luu tam ${state.projects.length} du an tren trinh duyet nay.`;
}

async function clearData() {
  if (!confirm("Xoa toan bo du lieu da phan tich? File goc tren Storage van duoc giu lai de doi chieu.")) return;

  state.projects = [];
  state.reportText = "";
  state.files = [];
  els.reportText.value = "";
  els.analysisLog.innerHTML = "";
  els.analysisStatus.textContent = "Chua co du lieu";
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
