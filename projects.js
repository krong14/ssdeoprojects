const body = document.querySelector("body");
const sidebar = body?.querySelector(".sidebar");
const toggle = body?.querySelector(".toggle");
const modeSwitch = body?.querySelector(".toggle-switch");
const modeText = body?.querySelector(".mode-text");
const sidebarStateKey = "sidebarOpen";
const themeStateKey = "darkMode";

function getApiBase() {
  const explicit = (window.DPWH_API_BASE || "").trim();
  if (explicit) return explicit.replace(/\/$/, "");
  const host = window.location.hostname;
  const isLocal = host === "localhost" || host === "127.0.0.1";
  return isLocal ? `${window.location.protocol}//${host}:3000` : "";
}

const apiBase = getApiBase();
const SESSION_KEY = "dpwh_current_user";
const USERS_KEY = "dpwh_users";
let assignedProjectData = [];
let assignedDocumentsCount = 0;
const DESIGNATION_OPTIONS = [
  "Project Engineer",
  "Project Inspector",
  "Materials Engineer",
  "Materials Inspector"
];

function getCurrentUser() {
  if (window.DPWH_CURRENT_USER) return window.DPWH_CURRENT_USER;
  const raw = appStorage.getItem(SESSION_KEY) || sessionStorage.getItem(SESSION_KEY);
  if (!raw) return null;
  try {
    return JSON.parse(raw);
  } catch (err) {
    return null;
  }
}

const currentUser = getCurrentUser();

function normalizeEmail(value) {
  return String(value || "").trim().toLowerCase();
}

function loadUsers() {
  const raw = appStorage.getItem(USERS_KEY);
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch (err) {
    return [];
  }
}

function getEmployeeCodeForCurrentUser() {
  const sessionCode = String(currentUser?.employeeCode || "").trim();
  if (sessionCode) return sessionCode;
  const email = normalizeEmail(currentUser?.email || "");
  if (!email) return "";
  const user = loadUsers().find(item => normalizeEmail(item?.email || "") === email);
  return String(user?.employeeCode || "").trim();
}

function profileStorageKey() {
  const email = normalizeEmail(currentUser?.email || "guest");
  return `dpwh_profile_${email || "guest"}`;
}

function loadProfileData() {
  const raw = appStorage.getItem(profileStorageKey());
  if (!raw) return {};
  try {
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === "object" ? parsed : {};
  } catch (err) {
    return {};
  }
}

function saveProfileData(data) {
  appStorage.setItem(profileStorageKey(), JSON.stringify(data || {}));
}

function escapeHtml(value) {
  return String(value || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function normalizeDesignationEntry(entry) {
  if (!entry || typeof entry !== "object") return null;
  const designation = String(entry.designation || entry.role || "").trim();
  const accreditationNo = String(entry.accreditationNo || entry.accreditation || "").trim();
  if (!designation) return null;
  return { designation, accreditationNo };
}

function getLegacyDesignation(data) {
  const selected = String(data?.roleOption || "").trim();
  if (selected) return selected;
  const roles = data?.roles;
  if (!roles || typeof roles !== "object") return "";
  if (roles.projectEngineer) return "Project Engineer";
  if (roles.projectInspector) return "Project Inspector";
  if (roles.materialsEngineer) return "Materials Engineer";
  if (roles.materialsInspector) return "Materials Inspector";
  return "";
}

function getDesignationList() {
  const data = loadProfileData();
  const rawList = Array.isArray(data.designations) ? data.designations : [];
  const list = rawList
    .map(normalizeDesignationEntry)
    .filter(Boolean);

  if (list.length) return list;

  const legacy = getLegacyDesignation(data);
  if (!legacy) return [];
  const migrated = [{ designation: legacy, accreditationNo: "" }];
  data.designations = migrated;
  delete data.roleOption;
  delete data.roles;
  saveProfileData(data);
  return migrated;
}

function setDesignationList(list) {
  const safe = Array.isArray(list)
    ? list.map(normalizeDesignationEntry).filter(Boolean)
    : [];
  const data = loadProfileData();
  data.designations = safe;
  delete data.roleOption;
  delete data.roles;
  saveProfileData(data);
}

function updateDesignationMetric(count) {
  const metricRoles = document.getElementById("metricRoles");
  if (metricRoles) metricRoles.textContent = String(count || 0);
}

function setMetricValue(id, value) {
  const el = document.getElementById(id);
  if (!el) return;
  el.textContent = String(value || 0);
}

function formatPercent(value) {
  const num = Number(value);
  if (!Number.isFinite(num)) return "0%";
  const safe = Math.max(0, Math.min(100, num));
  return `${safe % 1 === 0 ? safe.toFixed(0) : safe.toFixed(1)}%`;
}

function parseDateValue(value) {
  if (!value) return null;
  const raw = String(value).trim();
  if (!raw || raw === "-") return null;
  if (/^\d{4}-\d{2}-\d{2}$/.test(raw)) {
    const [y, m, d] = raw.split("-").map(Number);
    return new Date(y, m - 1, d);
  }
  if (/^\d{2}\/\d{2}\/\d{4}$/.test(raw)) {
    const [mm, dd, yyyy] = raw.split("/").map(Number);
    return new Date(yyyy, mm - 1, dd);
  }
  const parsed = new Date(raw);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

function isCompletedStatus(status) {
  return String(status || "").toLowerCase().includes("complete");
}

function isSuspendedStatus(status) {
  return String(status || "").toLowerCase().includes("suspend");
}

function isOngoingStatus(status) {
  const s = String(status || "").toLowerCase();
  return s.includes("on-going") || s.includes("ongoing");
}

function isExpiredStatus(status, expirationDate) {
  if (isCompletedStatus(status) || isSuspendedStatus(status)) return false;
  const s = String(status || "").toLowerCase();
  if (s.includes("expire")) return true;
  const exp = parseDateValue(expirationDate);
  if (!exp) return false;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  exp.setHours(0, 0, 0, 0);
  return exp < today;
}

function loadContractFiles() {
  const raw = appStorage.getItem("contractFiles");
  if (!raw) return {};
  try {
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === "object" ? parsed : {};
  } catch (err) {
    return {};
  }
}

const sectionDocs = {
  contracts: [
    "Project Designation Order",
    "Contractor's Materials Engineer",
    "Contract",
    "Notice to Proceed"
  ],
  planning: [
    "Original Plan",
    "As-Staked Plan",
    "As-Built Plan",
    "Original Program of Works",
    "Revised Program of Works",
    "Bill of Quantities",
    "Detailed Unit Price Analysis"
  ],
  construction: [
    "Project Billings",
    "Statement of Work Accomplished",
    "Engineers Certificate",
    "Pouring Permits",
    "Contract Time Suspension Report",
    "Contract Time Extension Report",
    "Contract Weather Report",
    "Punchlist"
  ],
  qa: [
    "Certificate of Quality Control Assurance (CQCA MONTHLY) (QCA-02)",
    "Certificate of Quality Control Assurance (CQCA WEEKLY) (QCA-03)",
    "Status of Field and Laboratory Test (QCA-04)",
    "Status of Test (QCA-05)",
    "Summary of Field Test (QCA-06)",
    "Materials Inspection Report (QCA-07)",
    "Report on Concrete Works (QCA-08)",
    "Site Instructions (Letter to Construction)",
    "Test Reports and Worksheets (Per Billing)"
  ],
  contractor: [
    "Bar Chart",
    "Back-Up Computation",
    "Design Mix and Trial Mix Results",
    "Accreditation of Batching Plant",
    "Job Control Forms",
    "Quality Control Program (QCA-01)"
  ]
};

async function updateDocumentsMetric(projects) {
  const matchedProjects = Array.isArray(projects) ? projects : [];
  const contractIds = matchedProjects
    .map(project => String(project["CONTRACT ID"] || "").trim().toUpperCase())
    .filter(Boolean);

  if (!contractIds.length) {
    assignedDocumentsCount = 0;
    setMetricValue("metricDocuments", "0%");
    setMetricValue("metricDocumentsMeta", "0/0 uploaded");
    return;
  }

  const docsPerProject = Object.values(sectionDocs)
    .reduce((sum, docs) => sum + (Array.isArray(docs) ? docs.length : 0), 0);
  const totalExpected = contractIds.length * docsPerProject;

  if (apiBase) {
    try {
      const results = await Promise.all(contractIds.map(async (contractId) => {
        const res = await fetch(`${apiBase}/api/documents/${encodeURIComponent(contractId)}`);
        const data = await res.json();
        const docs = Array.isArray(data?.documents) ? data.documents : [];
        return docs.length;
      }));
      assignedDocumentsCount = results.reduce((sum, count) => sum + count, 0);
      const percent = totalExpected ? (assignedDocumentsCount / totalExpected) * 100 : 0;
      setMetricValue("metricDocuments", formatPercent(percent));
      setMetricValue("metricDocumentsMeta", `${assignedDocumentsCount}/${totalExpected} uploaded`);
      return;
    } catch (err) {
      // Fall through to localStorage fallback below.
    }
  }

  const files = loadContractFiles();
  let count = 0;
  contractIds.forEach((contractId) => {
    Object.entries(sectionDocs).forEach(([section, docs]) => {
      docs.forEach((doc) => {
        const key = `${section}:${doc}:${contractId}`;
        if (files[key]) count += 1;
      });
    });
  });
  assignedDocumentsCount = count;
  const percent = totalExpected ? (assignedDocumentsCount / totalExpected) * 100 : 0;
  setMetricValue("metricDocuments", formatPercent(percent));
  setMetricValue("metricDocumentsMeta", `${assignedDocumentsCount}/${totalExpected} uploaded`);
}

function updateAssignedStats(matchedEntries) {
  const entries = Array.isArray(matchedEntries) ? matchedEntries : [];
  let ongoing = 0;
  let suspended = 0;
  let completed = 0;
  let expired = 0;

  entries.forEach(({ project }) => {
    const status = project?.["STATUS OF PROJECT"] || "";
    const expirationDate = project?.["EXPIRATION DATE"] || "";
    const expiredFlag = isExpiredStatus(status, expirationDate);
    if (isCompletedStatus(status)) completed += 1;
    if (isSuspendedStatus(status)) suspended += 1;
    if (isOngoingStatus(status) && !expiredFlag) ongoing += 1;
    if (expiredFlag) expired += 1;
  });

  setMetricValue("metricAssigned", entries.length);
  setMetricValue("metricOngoing", ongoing);
  setMetricValue("metricSuspended", suspended);
  setMetricValue("metricCompleted", completed);
  setMetricValue("metricExpired", expired);
}

function renderDesignationTable() {
  const tableBody = document.getElementById("roleTableBody");
  if (!tableBody) return;
  const list = getDesignationList();
  updateDesignationMetric(list.length);

  if (!list.length) {
    tableBody.innerHTML = `<div class="role-empty">No designations added yet.</div>`;
    return;
  }

  tableBody.innerHTML = list.map((entry, index) => `
    <div class="role-row" data-index="${index}">
      <div class="role-cell role-cell-title">${escapeHtml(entry.designation)}</div>
      <div class="role-cell">${escapeHtml(entry.accreditationNo || "N/A")}</div>
      <div class="role-cell">
        <div class="role-actions">
          <button type="button" class="role-btn edit" data-role-action="edit" data-index="${index}" title="Edit designation" aria-label="Edit designation">
            <i class='bx bx-pencil'></i>
          </button>
          <button type="button" class="role-btn delete" data-role-action="delete" data-index="${index}" title="Delete designation" aria-label="Delete designation">
            <i class='bx bx-trash'></i>
          </button>
        </div>
      </div>
    </div>
  `).join("");
}

function applySidebarState() {
  if (!sidebar) return;
  const stored = appStorage.getItem(sidebarStateKey);
  if (stored === null) return;
  const shouldBeOpen = stored === "true";
  sidebar.classList.toggle("close", !shouldBeOpen);
}

function applyThemeState() {
  const stored = appStorage.getItem(themeStateKey);
  if (stored === null) return;
  const isDark = stored === "true";
  body?.classList.toggle("dark", isDark);
  if (modeText) modeText.innerText = isDark ? "Light Mode" : "Dark Mode";
}

toggle?.addEventListener("click", () => {
  sidebar?.classList.toggle("close");
  const isOpen = sidebar ? !sidebar.classList.contains("close") : true;
  appStorage.setItem(sidebarStateKey, String(isOpen));
});

modeSwitch?.addEventListener("click", () => {
  body?.classList.toggle("dark");
  const isDark = body?.classList.contains("dark");
  appStorage.setItem(themeStateKey, String(isDark));
  if (modeText) modeText.innerText = isDark ? "Light Mode" : "Dark Mode";
});

function splitNames(value) {
  return String(value || "")
    .split(/[,/;&]+|\band\b/gi)
    .map(part => part.trim())
    .filter(Boolean);
}

function normalizeName(value) {
  return String(value || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-zA-Z0-9\s]/g, " ")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();
}

function toSignificantNameTokens(value) {
  return normalizeName(value)
    .split(" ")
    .filter(token => token.length > 1);
}

function userMatchesName(value) {
  const userName = String(currentUser?.name || "").trim();
  if (!userName) return false;
  const target = normalizeName(userName);
  const targetTokens = toSignificantNameTokens(userName);
  return splitNames(value).some(name => {
    const candidate = normalizeName(name);
    if (!candidate) return false;
    if (candidate === target) return true;
    if (candidate.includes(target) || target.includes(candidate)) return true;
    const candidateTokens = toSignificantNameTokens(name);
    if (!targetTokens.length || !candidateTokens.length) return false;
    return targetTokens.every(token => candidateTokens.includes(token))
      || candidateTokens.every(token => targetTokens.includes(token));
  });
}

function getMatchedRoles(project) {
  const roles = [];
  if (userMatchesName(project["PROJECT ENGINEER"])) roles.push("Project Engineer");
  if (userMatchesName(project["PROJECT INSPECTOR"])) roles.push("Project Inspector");
  if (userMatchesName(project["MATERIALS ENGINEER"])) roles.push("Materials Engineer");
  if (userMatchesName(project["RESIDENT ENGINEER"])) roles.push("Resident Engineer");
  if (userMatchesName(project["QUALITY ASSURANCE IN-CHARGE"])) roles.push("QA In-Charge");
  if (userMatchesName(project["CONTRACTORS MATERIALS ENGINEER"])) roles.push("Contractor's Materials Engineer");
  return roles;
}

function renderAssignedProjects(projects, searchTerm = "") {
  const listEl = document.getElementById("assignedList");
  const countEl = document.getElementById("assignedCount");
  if (!listEl || !countEl) return;

  const matched = (projects || []).map(project => ({
    project,
    roles: getMatchedRoles(project)
  })).filter(entry => entry.roles.length > 0);

  const search = String(searchTerm || "").trim().toLowerCase();
  const filtered = matched.filter(({ project }) => {
    if (!search) return true;
    const haystack = [
      project["CONTRACT ID"] || "",
      project["CONTRACT NAME/LOCATION"] || "",
      project["CONTRACTOR"] || ""
    ].join(" ").toLowerCase();
    return haystack.includes(search);
  });

  countEl.textContent = `${filtered.length} assigned`;
  updateAssignedStats(matched);
  listEl.innerHTML = "";

  if (!filtered.length) {
    listEl.innerHTML = `<div class="assigned-empty">No matching assigned projects found.</div>`;
    return;
  }

  filtered.forEach(({ project, roles }) => {
    const contractId = String(project["CONTRACT ID"] || "").trim();
    const name = String(project["CONTRACT NAME/LOCATION"] || "").trim();
    const contractor = String(project["CONTRACTOR"] || "").trim();
    const status = String(project["STATUS OF PROJECT"] || "").trim() || "No status";
    const category = String(project["TYPE OF PROJECT"] || "").trim() || "No category";
    const item = document.createElement("div");
    item.className = "assigned-item";
    item.innerHTML = `
      <h4>${contractId || "No ID"} - ${name || "Unnamed project"}</h4>
      <p>${contractor || "No contractor info"}</p>
      <div class="assigned-meta">
        <span>${status}</span>
        <span>${category}</span>
      </div>
      <div class="assigned-roles">
        ${roles.map(role => `<span class="assigned-role">${role}</span>`).join("")}
      </div>
    `;
    listEl.appendChild(item);
  });
}

async function loadAssignedProjects() {
  const listEl = document.getElementById("assignedList");
  if (!listEl) return;
  if (!apiBase) {
    listEl.innerHTML = `<div class="assigned-empty">Project server is not configured.</div>`;
    updateAssignedStats([]);
    return;
  }
  try {
    const res = await fetch(`${apiBase}/api/get-projects`);
    const data = await res.json();
    if (!data.success) throw new Error("Failed to load projects.");
    assignedProjectData = Array.isArray(data.projects) ? data.projects : [];
    const matchedProjects = assignedProjectData.filter(project => getMatchedRoles(project).length > 0);
    await updateDocumentsMetric(matchedProjects);
    const searchValue = document.getElementById("assignedSearch")?.value || "";
    renderAssignedProjects(assignedProjectData, searchValue);
  } catch (err) {
    listEl.innerHTML = `<div class="assigned-empty">Failed to load assigned projects.</div>`;
    updateAssignedStats([]);
  }
}

function renderProfile() {
  const name = String(currentUser?.name || "User").trim() || "User";
  const email = String(currentUser?.email || "-").trim() || "-";
  const employeeCode = getEmployeeCodeForCurrentUser() || "-";
  const role = currentUser?.isSuperAdmin
    ? "Superadmin"
    : (currentUser?.isAdmin ? "Admin" : "User");
  const initial = name.charAt(0).toUpperCase() || "U";
  const designationList = getDesignationList();

  const nameEl = document.getElementById("profileName");
  const emailEl = document.getElementById("profileEmail");
  const employeeCodeEl = document.getElementById("profileEmployeeCode");
  const roleEl = document.getElementById("profileRole");
  const photoEl = document.getElementById("profilePhoto");

  if (nameEl) nameEl.textContent = name;
  if (emailEl) emailEl.textContent = email;
  if (employeeCodeEl) employeeCodeEl.textContent = employeeCode;
  if (roleEl) roleEl.textContent = role;
  if (photoEl) {
    photoEl.textContent = initial;
    photoEl.style.backgroundImage = "";
    photoEl.classList.remove("has-image");
  }
  updateDesignationMetric(designationList.length);
  renderDesignationTable();
}

function attachProfileHandlers() {
  const assignedSearch = document.getElementById("assignedSearch");
  const roleSelect = document.getElementById("roleOption");
  const roleAccreditationInput = document.getElementById("roleAccreditation");
  const addRoleBtn = document.getElementById("addRoleBtn");
  const roleTableBody = document.getElementById("roleTableBody");

  addRoleBtn?.addEventListener("click", () => {
    const designation = String(roleSelect?.value || "").trim();
    const accreditationNo = String(roleAccreditationInput?.value || "").trim();
    if (!designation || !DESIGNATION_OPTIONS.includes(designation)) return;

    const list = getDesignationList();
    list.push({ designation, accreditationNo });
    setDesignationList(list);
    renderDesignationTable();

    if (roleSelect) roleSelect.value = "";
    if (roleAccreditationInput) roleAccreditationInput.value = "";
  });

  roleTableBody?.addEventListener("click", (event) => {
    const actionBtn = event.target.closest("[data-role-action]");
    if (!actionBtn) return;
    const action = actionBtn.getAttribute("data-role-action");
    const index = Number(actionBtn.getAttribute("data-index"));
    if (!Number.isFinite(index)) return;

    const list = getDesignationList();
    if (!list[index]) return;

    if (action === "delete") {
      list.splice(index, 1);
      setDesignationList(list);
      renderDesignationTable();
      return;
    }

    if (action === "edit") {
      if (roleSelect) roleSelect.value = list[index].designation || "";
      if (roleAccreditationInput) roleAccreditationInput.value = list[index].accreditationNo || "";
      list.splice(index, 1);
      setDesignationList(list);
      renderDesignationTable();
    }
  });

  assignedSearch?.addEventListener("input", () => {
    renderAssignedProjects(assignedProjectData, assignedSearch.value);
  });
}

document.addEventListener("DOMContentLoaded", () => {
  applySidebarState();
  applyThemeState();
  renderProfile();
  attachProfileHandlers();
  loadAssignedProjects();
});
