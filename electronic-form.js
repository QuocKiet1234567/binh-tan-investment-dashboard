const ELECTRONIC_FORM_COLUMNS = [
  { key: "stt", label: "STT", width: 58 },
  { key: "name", label: "Tên dự án", width: 260 },
  { key: "decisionNo", label: "Số QĐ", width: 135 },
  { key: "adjustmentNo", label: "QĐ điều chỉnh", width: 135 },
  { key: "decisionDate", label: "Ngày cấp", width: 105 },
  { key: "decisionAgency", label: "Cơ quan cấp", width: 155 },
  { key: "certificateNo", label: "Số GCN", width: 135 },
  { key: "certificateIssue", label: "Lần cấp", width: 92 },
  { key: "certificateDate", label: "Ngày cấp", width: 105 },
  { key: "certificateAgency", label: "Cơ quan cấp", width: 155 },
  { key: "objective", label: "Mục tiêu", width: 190 },
  { key: "industrialZone", label: "KCN / KKT", width: 115 },
  { key: "budget", label: "Tổng mức đầu tư", width: 135 },
  { key: "progress", label: "Tiến độ", width: 220 },
  { key: "note", label: "Ghi chú", width: 180 }
];

let selectedFormCell = null;
let selectedFormRow = 0;
let formSaveTimer = null;
let electronicFormBound = false;

document.addEventListener("DOMContentLoaded", () => {
  initializeElectronicForm();
});

function initializeElectronicForm() {
  if (electronicFormBound || !document.getElementById("electronicFormTable")) return;
  electronicFormBound = true;
  ensureElectronicFormState();
  bindElectronicFormEvents();
  renderElectronicForm();
}

function ensureElectronicFormState() {
  const today = new Date().toISOString().slice(0, 10);
  state.electronicForm = state.electronicForm && typeof state.electronicForm === "object"
    ? state.electronicForm
    : {};
  const form = state.electronicForm;
  form.investor = form.investor || "Ban Quản lý Dự án Phường Bình Tân";
  form.period = form.period || "Quý II, năm 2026";
  form.preparedBy = form.preparedBy || "";
  form.reportDate = form.reportDate || today;
  form.rows = Array.isArray(form.rows) ? form.rows : [];
  form.cellFormats = form.cellFormats || {};
  form.updatedAt = form.updatedAt || "";
}

function bindElectronicFormEvents() {
  document.querySelector('.nav-item[data-view="electronicFormView"]')?.addEventListener("click", () => {
    ensureElectronicFormState();
    renderElectronicForm();
  });

  document.getElementById("formAddRowBtn")?.addEventListener("click", addElectronicFormRow);
  document.getElementById("formDeleteRowBtn")?.addEventListener("click", deleteElectronicFormRow);
  document.getElementById("formImportProjectsBtn")?.addEventListener("click", importProjectsIntoElectronicForm);
  document.getElementById("formSaveBtn")?.addEventListener("click", () => saveElectronicForm(true));
  document.getElementById("formSyncProjectsBtn")?.addEventListener("click", syncElectronicFormToProjects);
  document.getElementById("formExportBtn")?.addEventListener("click", exportElectronicForm);

  ["formInvestor", "formPeriod", "formPreparedBy", "formReportDate"].forEach((id) => {
    document.getElementById(id)?.addEventListener("input", handleElectronicFormMeta);
  });

  const tbody = document.getElementById("electronicFormRows");
  tbody?.addEventListener("focusin", handleElectronicFormCellFocus);
  tbody?.addEventListener("input", handleElectronicFormCellInput);
  tbody?.addEventListener("paste", handleElectronicFormPaste);
  tbody?.addEventListener("keydown", handleElectronicFormKeydown);
  tbody?.addEventListener("click", (event) => {
    const rowHead = event.target.closest("[data-form-row-head]");
    if (!rowHead) return;
    selectedFormRow = Number(rowHead.dataset.formRowHead);
    renderElectronicForm();
  });

  document.getElementById("formCellValue")?.addEventListener("input", (event) => {
    if (!selectedFormCell) return;
    const { rowIndex, key } = selectedFormCell;
    state.electronicForm.rows[rowIndex][key] = event.target.value;
    const cell = getElectronicFormCell(rowIndex, key);
    if (cell) cell.textContent = event.target.value;
    scheduleElectronicFormSave();
  });

  document.querySelectorAll(".sheet-format-btn").forEach((button) => {
    button.addEventListener("click", () => applyElectronicFormFormat(button.dataset.format));
  });
}

function createElectronicFormRow(source = {}) {
  return {
    stt: source.stt || "",
    name: source.name || "",
    decisionNo: source.decisionNo || "",
    adjustmentNo: source.adjustmentNo || "",
    decisionDate: source.decisionDate || "",
    decisionAgency: source.decisionAgency || "",
    certificateNo: source.certificateNo || "",
    certificateIssue: source.certificateIssue || "",
    certificateDate: source.certificateDate || "",
    certificateAgency: source.certificateAgency || "",
    objective: source.objective || "",
    industrialZone: source.industrialZone || "",
    budget: source.budget ?? "",
    progress: source.progress || "",
    note: source.note || ""
  };
}

function renderElectronicForm() {
  ensureElectronicFormState();
  const form = state.electronicForm;
  if (!form.rows.length) form.rows.push(createElectronicFormRow({ stt: 1 }));

  setElectronicFormInput("formInvestor", form.investor);
  setElectronicFormInput("formPeriod", form.period);
  setElectronicFormInput("formPreparedBy", form.preparedBy);
  setElectronicFormInput("formReportDate", form.reportDate);
  document.getElementById("formPeriodPreview").textContent = form.period || "Kỳ báo cáo đang cập nhật";
  document.getElementById("formLastSaved").textContent = form.updatedAt
    ? `Lưu lúc ${new Date(form.updatedAt).toLocaleString("vi-VN")}`
    : "Chưa có thay đổi";

  const tbody = document.getElementById("electronicFormRows");
  tbody.innerHTML = form.rows.map((row, rowIndex) => `
    <tr class="${selectedFormRow === rowIndex ? "is-selected" : ""}">
      <th data-form-row-head="${rowIndex}">${rowIndex + 1}</th>
      ${ELECTRONIC_FORM_COLUMNS.map((column, columnIndex) => {
        const format = form.cellFormats[`${rowIndex}:${column.key}`] || {};
        const classes = [
          format.bold ? "is-bold" : "",
          format.align === "center" ? "is-center" : "",
          format.wrap ? "is-wrap" : ""
        ].filter(Boolean).join(" ");
        return `<td
          contenteditable="${canEditProjects() ? "true" : "false"}"
          class="${classes}"
          data-form-row="${rowIndex}"
          data-form-column="${columnIndex}"
          data-form-key="${column.key}"
          style="min-width:${column.width}px"
          spellcheck="false"
        >${escapeHtml(row[column.key] ?? "")}</td>`;
      }).join("")}
    </tr>
  `).join("");

  document.getElementById("formRowSummary").textContent = `${form.rows.length} dòng dữ liệu`;
  updateElectronicFormSaveStatus("saved");
}

function setElectronicFormInput(id, value) {
  const input = document.getElementById(id);
  if (input && document.activeElement !== input) input.value = value || "";
}

function handleElectronicFormMeta(event) {
  const map = {
    formInvestor: "investor",
    formPeriod: "period",
    formPreparedBy: "preparedBy",
    formReportDate: "reportDate"
  };
  state.electronicForm[map[event.target.id]] = event.target.value;
  document.getElementById("formPeriodPreview").textContent = state.electronicForm.period || "Kỳ báo cáo đang cập nhật";
  scheduleElectronicFormSave();
}

function handleElectronicFormCellFocus(event) {
  const cell = event.target.closest("[data-form-key]");
  if (!cell) return;
  selectElectronicFormCell(cell);
}

function selectElectronicFormCell(cell) {
  document.querySelectorAll(".electronic-sheet td.is-active").forEach((item) => item.classList.remove("is-active"));
  cell.classList.add("is-active");
  const rowIndex = Number(cell.dataset.formRow);
  const columnIndex = Number(cell.dataset.formColumn);
  selectedFormRow = rowIndex;
  selectedFormCell = { rowIndex, columnIndex, key: cell.dataset.formKey };
  document.getElementById("formCellAddress").textContent = `${columnLabel(columnIndex)}${rowIndex + 1}`;
  document.getElementById("formCellValue").value = cell.textContent || "";
}

function handleElectronicFormCellInput(event) {
  const cell = event.target.closest("[data-form-key]");
  if (!cell) return;
  const rowIndex = Number(cell.dataset.formRow);
  state.electronicForm.rows[rowIndex][cell.dataset.formKey] = cell.textContent.replace(/\u00a0/g, " ").trim();
  if (selectedFormCell?.rowIndex === rowIndex && selectedFormCell?.key === cell.dataset.formKey) {
    document.getElementById("formCellValue").value = cell.textContent;
  }
  scheduleElectronicFormSave();
}

function handleElectronicFormPaste(event) {
  const startCell = event.target.closest("[data-form-key]");
  const text = event.clipboardData?.getData("text/plain");
  if (!startCell || !text || (!text.includes("\t") && !text.includes("\n"))) return;
  event.preventDefault();

  const startRow = Number(startCell.dataset.formRow);
  const startColumn = Number(startCell.dataset.formColumn);
  const pastedRows = text.replace(/\r/g, "").split("\n").filter((line, index, rows) => line || index < rows.length - 1);

  pastedRows.forEach((line, rowOffset) => {
    const targetRowIndex = startRow + rowOffset;
    while (state.electronicForm.rows.length <= targetRowIndex) {
      state.electronicForm.rows.push(createElectronicFormRow());
    }
    line.split("\t").forEach((value, columnOffset) => {
      const column = ELECTRONIC_FORM_COLUMNS[startColumn + columnOffset];
      if (column) state.electronicForm.rows[targetRowIndex][column.key] = value.trim();
    });
  });

  normalizeElectronicFormStt();
  renderElectronicForm();
  scheduleElectronicFormSave();
}

function handleElectronicFormKeydown(event) {
  const cell = event.target.closest("[data-form-key]");
  if (!cell) return;
  if (event.key === "Enter" && !event.shiftKey) {
    event.preventDefault();
    focusElectronicFormCell(Number(cell.dataset.formRow) + 1, Number(cell.dataset.formColumn));
  }
  if (event.key === "Tab") {
    event.preventDefault();
    const direction = event.shiftKey ? -1 : 1;
    let rowIndex = Number(cell.dataset.formRow);
    let columnIndex = Number(cell.dataset.formColumn) + direction;
    if (columnIndex >= ELECTRONIC_FORM_COLUMNS.length) {
      columnIndex = 0;
      rowIndex += 1;
    } else if (columnIndex < 0) {
      columnIndex = ELECTRONIC_FORM_COLUMNS.length - 1;
      rowIndex = Math.max(0, rowIndex - 1);
    }
    focusElectronicFormCell(rowIndex, columnIndex);
  }
}

function focusElectronicFormCell(rowIndex, columnIndex) {
  while (state.electronicForm.rows.length <= rowIndex) {
    state.electronicForm.rows.push(createElectronicFormRow());
    renderElectronicForm();
  }
  const key = ELECTRONIC_FORM_COLUMNS[columnIndex]?.key;
  getElectronicFormCell(rowIndex, key)?.focus();
}

function getElectronicFormCell(rowIndex, key) {
  return document.querySelector(`[data-form-row="${rowIndex}"][data-form-key="${key}"]`);
}

function addElectronicFormRow() {
  if (!canEditProjects()) return;
  state.electronicForm.rows.push(createElectronicFormRow({ stt: state.electronicForm.rows.length + 1 }));
  selectedFormRow = state.electronicForm.rows.length - 1;
  renderElectronicForm();
  scheduleElectronicFormSave();
  getElectronicFormCell(selectedFormRow, "name")?.focus();
}

function deleteElectronicFormRow() {
  if (!canEditProjects() || !state.electronicForm.rows.length) return;
  const row = state.electronicForm.rows[selectedFormRow];
  if (row?.name && !confirm(`Xóa dòng dự án "${row.name}"?`)) return;
  state.electronicForm.rows.splice(selectedFormRow, 1);
  selectedFormRow = Math.max(0, selectedFormRow - 1);
  normalizeElectronicFormStt();
  renderElectronicForm();
  scheduleElectronicFormSave();
}

function importProjectsIntoElectronicForm() {
  if (!state.projects.length) {
    alert("Danh mục dự án hiện chưa có dữ liệu.");
    return;
  }
  if (state.electronicForm.rows.some((row) => row.name) && !confirm("Nạp danh mục hiện tại sẽ thay thế các dòng trong biểu mẫu. Tiếp tục?")) return;
  state.electronicForm.rows = state.projects.map((project, index) => createElectronicFormRow({
    stt: index + 1,
    name: project.name,
    decisionNo: project.decisionNo || "",
    decisionAgency: project.decisionAgency || "",
    objective: project.objective || "",
    budget: project.budget,
    progress: project.progress,
    note: project.difficulty || project.solution || ""
  }));
  selectedFormRow = 0;
  renderElectronicForm();
  scheduleElectronicFormSave();
}

async function syncElectronicFormToProjects() {
  if (!canEditProjects()) return;
  const validRows = state.electronicForm.rows.filter((row) => String(row.name || "").trim());
  if (!validRows.length) {
    alert("Biểu mẫu chưa có dòng dự án hợp lệ.");
    return;
  }
  if (!confirm(`Đồng bộ ${validRows.length} dòng vào danh mục dự án? Dự án trùng tên sẽ được cập nhật.`)) return;

  const incoming = validRows.map((row, index) => ({
    projectId: createProjectId(),
    stt: index + 1,
    name: String(row.name).trim(),
    budget: toNumber(row.budget),
    plan: 0,
    legal: [row.decisionNo, row.adjustmentNo, row.certificateNo].filter(Boolean).join(" · "),
    progress: row.progress || "",
    disbursement: "",
    difficulty: row.note || "",
    solution: "",
    evaluation: "Đang cập nhật",
    status: "Đang triển khai",
    objective: row.objective || "",
    decisionNo: row.decisionNo || "",
    decisionAgency: row.decisionAgency || "",
    sourceType: "Biểu mẫu điện tử"
  }));

  state.projects = mergeProjects(incoming);
  normalizeProjectNumbers();
  state.auditLog = Array.isArray(state.auditLog) ? state.auditLog : [];
  state.auditLog.unshift({
    id: globalThis.crypto?.randomUUID?.() || `${Date.now()}-form`,
    action: "Đồng bộ biểu mẫu điện tử",
    changedAt: new Date().toISOString(),
    userEmail: currentSession?.user?.email || "Tài khoản quản trị",
    changes: [{ field: "projects", label: "Số dự án", before: "", after: validRows.length }]
  });
  await saveElectronicForm(false);
  renderAll();
  alert(`Đã đồng bộ ${validRows.length} dự án vào danh mục.`);
}

function normalizeElectronicFormStt() {
  state.electronicForm.rows.forEach((row, index) => {
    row.stt = index + 1;
  });
}

function applyElectronicFormFormat(format) {
  if (!selectedFormCell || !canEditProjects()) return;
  const id = `${selectedFormCell.rowIndex}:${selectedFormCell.key}`;
  const current = state.electronicForm.cellFormats[id] || {};
  if (format === "bold") current.bold = !current.bold;
  if (format === "align-left") current.align = "left";
  if (format === "align-center") current.align = "center";
  if (format === "wrap") current.wrap = !current.wrap;
  state.electronicForm.cellFormats[id] = current;
  renderElectronicForm();
  getElectronicFormCell(selectedFormCell.rowIndex, selectedFormCell.key)?.focus();
  scheduleElectronicFormSave();
}

function scheduleElectronicFormSave() {
  updateElectronicFormSaveStatus("pending");
  clearTimeout(formSaveTimer);
  formSaveTimer = setTimeout(() => saveElectronicForm(false), 800);
}

async function saveElectronicForm(showMessage) {
  state.electronicForm.updatedAt = new Date().toISOString();
  persistStateLocal();
  await saveRemoteState();
  updateElectronicFormSaveStatus("saved");
  document.getElementById("formLastSaved").textContent = `Lưu lúc ${new Date(state.electronicForm.updatedAt).toLocaleString("vi-VN")}`;
  if (showMessage) {
    alert(currentSession
      ? "Đã lưu biểu mẫu trên trình duyệt và gửi đồng bộ lên Supabase."
      : "Đã lưu biểu mẫu trên trình duyệt. Đăng nhập Supabase để đồng bộ dữ liệu tập trung.");
  }
}

function updateElectronicFormSaveStatus(status) {
  const element = document.getElementById("formSaveState");
  if (!element) return;
  element.classList.toggle("is-pending", status === "pending");
  element.innerHTML = status === "pending" ? "<i></i> Đang chờ lưu" : "<i></i> Đã lưu";
}

function exportElectronicForm() {
  if (!window.XLSX) {
    alert("Thư viện xuất Excel chưa sẵn sàng.");
    return;
  }
  const form = state.electronicForm;
  const title = ["THÔNG TIN DỰ ÁN ĐẦU TƯ", ...Array(14).fill("")];
  const meta = [`Đơn vị: ${form.investor}`, `Kỳ báo cáo: ${form.period}`, `Người lập: ${form.preparedBy}`, `Ngày: ${form.reportDate}`];
  const groupHeader = ["STT", "Tên dự án", "QUYẾT ĐỊNH CHỦ TRƯƠNG ĐẦU TƯ", "", "", "", "GIẤY CHỨNG NHẬN ĐĂNG KÝ ĐẦU TƯ", "", "", "", "Mục tiêu", "KCN / KKT", "Tổng mức đầu tư", "Tiến độ", "Ghi chú"];
  const headers = ELECTRONIC_FORM_COLUMNS.map((column) => column.label);
  const rows = form.rows.map((row) => ELECTRONIC_FORM_COLUMNS.map((column) => row[column.key] ?? ""));
  const worksheet = XLSX.utils.aoa_to_sheet([title, meta, [], groupHeader, headers, ...rows]);
  worksheet["!merges"] = [
    XLSX.utils.decode_range("A1:O1"),
    XLSX.utils.decode_range("C4:F4"),
    XLSX.utils.decode_range("G4:J4")
  ];
  worksheet["!cols"] = ELECTRONIC_FORM_COLUMNS.map((column) => ({ wpx: column.width }));
  worksheet["!freeze"] = { xSplit: 2, ySplit: 5 };
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, "Thông tin dự án");
  XLSX.writeFile(workbook, `bieu-mau-du-an-${form.reportDate || "bao-cao"}.xlsx`);
}

function columnLabel(index) {
  let value = index + 1;
  let label = "";
  while (value > 0) {
    value -= 1;
    label = String.fromCharCode(65 + (value % 26)) + label;
    value = Math.floor(value / 26);
  }
  return label;
}
