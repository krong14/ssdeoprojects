const body = document.querySelector("body")
const sidebar = body.querySelector(".sidebar")
const toggle = body.querySelector(".toggle")
const modeSwitch = body.querySelector(".toggle-switch")
const modeText = body.querySelector(".mode-text")
const sidebarStateKey = "sidebarOpen"
const themeStateKey = "darkMode"

toggle.addEventListener("click", () => {
  sidebar.classList.toggle("close");
  const isOpen = !sidebar.classList.contains("close")
  localStorage.setItem(sidebarStateKey, String(isOpen))
});

const applySidebarState = () => {
  const stored = localStorage.getItem(sidebarStateKey)
  if (stored === null) return
  const shouldBeOpen = stored === "true"
  sidebar.classList.toggle("close", !shouldBeOpen)
}

applySidebarState()

const applyThemeState = () => {
  const stored = localStorage.getItem(themeStateKey)
  if (stored === null) return
  const isDark = stored === "true"
  body.classList.toggle("dark", isDark)
  if (modeText) {
    modeText.innerText = isDark ? "Light Mode" : "Dark Mode"
  }
}

applyThemeState()

function getApiBase() {
  const explicit = (window.DPWH_API_BASE || "").trim();
  if (explicit) return explicit.replace(/\/$/, "");
  const host = window.location.hostname;
  const isLocal = host === "localhost" || host === "127.0.0.1";
  return isLocal ? `${window.location.protocol}//${host}:3000` : "";
}

const apiBase = getApiBase();
const useRemoteStorage = Boolean(apiBase);
const SESSION_KEY = "dpwh_current_user";

function getCurrentUser() {
  if (window.DPWH_CURRENT_USER) return window.DPWH_CURRENT_USER;
  const raw = localStorage.getItem(SESSION_KEY) || sessionStorage.getItem(SESSION_KEY);
  if (!raw) return null;
  try {
    return JSON.parse(raw);
  } catch (err) {
    return null;
  }
}

const currentUser = getCurrentUser();
const currentUserName = String(currentUser?.name || "").trim();
const isAdminUser = Boolean(currentUser?.isAdmin);
const NOTIF_PREFIX = "dpwh_notifications_";
const chatApiEndpoint = apiBase ? `${apiBase}/api/chat` : "";

function getNotificationKey() {
  const email = String(currentUser?.email || "guest").trim().toLowerCase();
  return `${NOTIF_PREFIX}${email || "guest"}`;
}

function loadNotifications() {
  const raw = localStorage.getItem(getNotificationKey());
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch (err) {
    return [];
  }
}

function saveNotifications(list) {
  localStorage.setItem(getNotificationKey(), JSON.stringify(list));
}

function formatTimeAgo(value) {
  if (!value) return "";
  const ts = new Date(value).getTime();
  if (Number.isNaN(ts)) return "";
  const diff = Date.now() - ts;
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

function renderNotificationBell() {
  const list = loadNotifications();
  const badge = document.getElementById("notifBadge");
  const panel = document.getElementById("notifPanel");
  const listEl = document.getElementById("notifList");
  if (badge) {
    badge.textContent = list.length;
    badge.style.display = list.length ? "inline-flex" : "none";
  }
  if (!panel || !listEl) return;
  listEl.innerHTML = "";
  if (!list.length) {
    const empty = document.createElement("div");
    empty.className = "notif-empty";
    empty.textContent = "No notifications yet.";
    listEl.appendChild(empty);
    return;
  }
  list.forEach(item => {
    const row = document.createElement("div");
    row.className = "notif-item";
    const title = document.createElement("div");
    title.className = "notif-title";
    title.textContent = item.message || "Notification";
    const time = document.createElement("div");
    time.className = "notif-time";
    time.textContent = formatTimeAgo(item.createdAt);
    row.appendChild(title);
    row.appendChild(time);
    listEl.appendChild(row);
  });
}

function attachNotificationBell() {
  const btn = document.getElementById("notifBtn");
  const panel = document.getElementById("notifPanel");
  const clearBtn = document.getElementById("notifClear");
  if (!btn || !panel) return;
  btn.addEventListener("click", (e) => {
    e.stopPropagation();
    panel.classList.toggle("open");
  });
  clearBtn?.addEventListener("click", () => {
    saveNotifications([]);
    renderNotificationBell();
  });
  document.addEventListener("click", (e) => {
    if (!panel.contains(e.target) && e.target !== btn) {
      panel.classList.remove("open");
    }
  });
  renderNotificationBell();
}

// Chat assistant
function appendChatMessage(text, role = "bot") {
  const body = document.getElementById("chatBody");
  if (!body) return;
  const el = document.createElement("div");
  el.className = `chat-message ${role}`;
  el.textContent = text;
  body.appendChild(el);
  body.scrollTop = body.scrollHeight;
}

async function sendChatMessage(message) {
  if (!message) return;
  appendChatMessage(message, "user");
  const thinkingId = `thinking-${Date.now()}`;
  appendChatMessage("Thinking...", "bot");
  const body = document.getElementById("chatBody");
  const thinkingEl = body?.lastElementChild;

  if (!chatApiEndpoint) {
    if (thinkingEl) thinkingEl.textContent = "Chat server not configured.";
    return;
  }

  try {
    const res = await fetch(chatApiEndpoint, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ message })
    });
    const data = await res.json();
    if (thinkingEl) thinkingEl.remove();
    if (!data.success) {
      appendChatMessage(data.error || "Error from chat server.", "bot");
      return;
    }
    appendChatMessage(data.reply || "No reply.", "bot");
  } catch (err) {
    if (thinkingEl) thinkingEl.remove();
    appendChatMessage("Network error. Please try again.", "bot");
  }
}

function attachChat() {
  const fab = document.getElementById("chatFab");
  const win = document.getElementById("chatWindow");
  const closeBtn = document.getElementById("chatClose");
  const form = document.getElementById("chatForm");
  const input = document.getElementById("chatInput");
  if (!fab || !win || !form || !input) return;

  const toggle = () => win.classList.toggle("open");
  fab.addEventListener("click", toggle);
  closeBtn?.addEventListener("click", () => win.classList.remove("open"));

  form.addEventListener("submit", (e) => {
    e.preventDefault();
    const msg = input.value.trim();
    if (!msg) return;
    input.value = "";
    sendChatMessage(msg);
  });
}

function ensureToastContainer() {
  let container = document.getElementById("toastContainer");
  if (container) return container;
  container = document.createElement("div");
  container.id = "toastContainer";
  container.className = "toast-container";
  document.body.appendChild(container);
  return container;
}

function showToast(message, type = "info") {
  const container = ensureToastContainer();
  const toast = document.createElement("div");
  toast.className = `toast ${type}`;
  toast.textContent = message;
  container.appendChild(toast);
  requestAnimationFrame(() => toast.classList.add("show"));
  setTimeout(() => {
    toast.classList.remove("show");
    setTimeout(() => toast.remove(), 260);
  }, 3200);

  // Also log into notification list
  const list = loadNotifications();
  list.unshift({
    id: `${Date.now()}-${Math.random().toString(16).slice(2, 8)}`,
    message,
    createdAt: new Date().toISOString()
  });
  saveNotifications(list.slice(0, 30));
  renderNotificationBell();
}

function normalizePersonName(value) {
  return String(value || "").trim().toLowerCase();
}

function splitNames(value) {
  return String(value || "")
    .split(/[,/;]+/)
    .map(part => part.trim())
    .filter(Boolean);
}

function userMatchesName(value) {
  if (!currentUserName) return false;
  const target = normalizePersonName(currentUserName);
  const candidates = splitNames(value);
  return candidates.some(name => normalizePersonName(name) === target);
}

function isUserInCharge(inChargeData) {
  if (isAdminUser) return true;
  if (!currentUserName || !inChargeData) return false;
  return Object.values(inChargeData).some(value => userMatchesName(value));
}

modeSwitch.addEventListener("click", () => {
  body.classList.toggle("dark");
  const isDark = body.classList.contains("dark")
  localStorage.setItem(themeStateKey, String(isDark))

  if (modeText) {
    modeText.innerText = isDark ? "Light Mode" : "Dark Mode"
  }
});

// -------------------------------------------------------------------------------------------------
// DASHBOARD PROJECTS TABLE (SYNC WITH PROJECTS PAGE)
// -------------------------------------------------------------------------------------------------
const tableBody = document.getElementById("contractsTableBody");
const contractsCountEl = document.getElementById("contractsCount");
const totalProjectsCountEl = document.getElementById("totalProjectsCount");
const ongoingProjectsCountEl = document.getElementById("ongoingProjectsCount");
const suspendedProjectsCountEl = document.getElementById("suspendedProjectsCount");
const completedProjectsCountEl = document.getElementById("completedProjectsCount");
const expiredProjectsCountEl = document.getElementById("expiredProjectsCount");
const projectMetaKey = "projectMeta";

function loadProjectMeta() {
  const raw = localStorage.getItem(projectMetaKey);
  if (!raw) return {};
  try {
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === "object" ? parsed : {};
  } catch (err) {
    return {};
  }
}

function getProjectMeta(contractId) {
  const key = String(contractId || "").trim().toUpperCase();
  if (!key) return null;
  const all = loadProjectMeta();
  return all[key] || null;
}

function parsePercent(value) {
  if (value === undefined || value === null) return 0;
  const cleaned = String(value).replace("%", "").trim();
  const num = Number(cleaned);
  if (Number.isNaN(num)) return 0;
  return Math.max(0, Math.min(100, Math.round(num)));
}

function formatMoneyDisplay(value) {
  const raw = String(value ?? "").replace(/[^\d.-]/g, "");
  const num = Number(raw);
  if (!raw || Number.isNaN(num)) return value || "-";
  return `\u20B1 ${num.toLocaleString("en-PH", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function formatDateLong(value) {
  if (!value) return "-";
  const raw = String(value).trim();
  if (!raw) return "-";
  let dateObj = null;

  if (/^\d{4}-\d{2}-\d{2}$/.test(raw)) {
    dateObj = new Date(`${raw}T00:00:00`);
  } else if (/^\d{2}\/\d{2}\/\d{4}$/.test(raw)) {
    const [mm, dd, yyyy] = raw.split("/").map(num => Number(num));
    dateObj = new Date(yyyy, mm - 1, dd);
  } else {
    const parsed = new Date(raw);
    if (!Number.isNaN(parsed.getTime())) {
      dateObj = parsed;
    }
  }

  if (!dateObj || Number.isNaN(dateObj.getTime())) {
    return raw;
  }

  const months = [
    "January",
    "February",
    "March",
    "April",
    "May",
    "June",
    "July",
    "August",
    "September",
    "October",
    "November",
    "December"
  ];
  const monthName = months[dateObj.getMonth()];
  const day = String(dateObj.getDate()).padStart(2, "0");
  const year = dateObj.getFullYear();
  return `${monthName} ${day}, ${year}`;
}

function getProgressClass(percent) {
  if (percent >= 100) return "success";
  if (percent >= 50) return "warning";
  return "danger";
}

function renderProgressPill(percent) {
  const safe = parsePercent(percent);
  const cls = getProgressClass(safe);
  return `<span class="progress-pill ${cls}">${safe}%</span>`;
}

function getCompletionDisplay(accomplishment, latestDate) {
  const pct = parsePercent(accomplishment);
  if (pct === 100 && latestDate) return formatDateLong(latestDate);
  return "-";
}

function updateContractsCount() {
  if (!contractsCountEl || !tableBody) return;
  const rows = Array.from(tableBody.querySelectorAll("tr"));
  const count = rows.filter(row => row.style.display !== "none").length;
  const label = count === 1 ? "Contract Found" : "Contracts Found";
  contractsCountEl.textContent = `${count} ${label}`;
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
    const [mm, dd, yyyy] = raw.split("/").map(num => Number(num));
    return new Date(yyyy, mm - 1, dd);
  }
  const parsed = new Date(raw);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

function isCompletedStatus(status) {
  const s = String(status || "").toLowerCase();
  return s.includes("complete");
}

function isSuspendedStatus(status) {
  const s = String(status || "").toLowerCase();
  return s.includes("suspend");
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

function updateProjectStats(projects) {
  const list = projects || [];
  const total = list.length;
  let ongoing = 0;
  let suspended = 0;
  let completed = 0;
  let expired = 0;

  list.forEach(p => {
    const status = p["STATUS OF PROJECT"] || "";
    const expiration = p["EXPIRATION DATE"] || "";
    const expiredFlag = isExpiredStatus(status, expiration);
    if (isCompletedStatus(status)) completed += 1;
    if (isSuspendedStatus(status)) suspended += 1;
    if (isOngoingStatus(status) && !expiredFlag) ongoing += 1;
    if (expiredFlag) expired += 1;
  });

  if (totalProjectsCountEl) totalProjectsCountEl.textContent = `${total}`;
  if (ongoingProjectsCountEl) ongoingProjectsCountEl.textContent = `${ongoing}`;
  if (suspendedProjectsCountEl) suspendedProjectsCountEl.textContent = `${suspended}`;
  if (completedProjectsCountEl) completedProjectsCountEl.textContent = `${completed}`;
  if (expiredProjectsCountEl) expiredProjectsCountEl.textContent = `${expired}`;
}

async function fetchProjectsForDashboard() {
  if (!tableBody) return;
  tableBody.innerHTML = "";

  try {
    if (!apiBase) {
      updateProjectStats([]);
      updateDocMonitoringStats([]);
      updateContractsCount();
      return;
    }
    const res = await fetch(`${apiBase}/api/get-projects`);
    const json = await res.json();
    if (!json.success) {
      updateContractsCount();
      return;
    }

    const projects = json.projects || [];
    const validProjects = [];
    projects.forEach(p => {
      const contractId = p["CONTRACT ID"] || "";
      const description = p["CONTRACT NAME/LOCATION"] || "";
      const contractor = p["CONTRACTOR"] || "";
      const cost = p["CONTRACT AMOUNT"] || "";
      const completionDate = p["LATEST DATE UPDATED"] || "";
      const accomplishment = parsePercent(p["SWA (%) 1ST BILLING"] || 0);
      const status = p["STATUS OF PROJECT"] || "";
      const category = p["TYPE OF PROJECT"] || "";
      const startDate = p["START DATE"] || "";
      const expirationDate = p["EXPIRATION DATE"] || "";
      const location = p["LOCATION"] || "";
      const meta = getProjectMeta(contractId);
      const coordinates = meta?.coordinates || "";
      const inCharge = {
        projectEngineer: p["PROJECT ENGINEER"] || "",
        materialsEngineer: p["MATERIALS ENGINEER"] || "",
        projectInspector: p["PROJECT INSPECTOR"] || "",
        residentEngineer: p["RESIDENT ENGINEER"] || "",
        qaInCharge: p["QUALITY ASSURANCE IN-CHARGE"] || "",
        contractorMaterialsEngineer: p["CONTRACTORS MATERIALS ENGINEER"] || ""
      };

      if (!contractId && !description) return;
      if (!isAdminUser && !isUserInCharge(inCharge)) return;
      validProjects.push(p);

      const tr = document.createElement("tr");
      tr.dataset.contractId = contractId;
      tr.dataset.description = description;
      tr.dataset.contractor = contractor;
      tr.dataset.cost = cost;
      tr.dataset.accomplishment = String(accomplishment);
      tr.dataset.status = status;
      tr.dataset.completionDate = completionDate;
      tr.dataset.category = category;
      tr.dataset.startDate = startDate;
      tr.dataset.expirationDate = expirationDate;
      tr.dataset.location = location || meta?.location || "";
      tr.dataset.coordinates = coordinates;
      tr.dataset.inCharge = JSON.stringify(inCharge);
      tr.innerHTML = `
        <td>
          <strong>${contractId}</strong> \u2013 ${description}
          <div class="contract-category">${category}</div>
        </td>
        <td>${contractor}</td>
        <td>${formatMoneyDisplay(cost)}</td>
        <td>${renderProgressPill(accomplishment)}</td>
        <td>${status || "-"}</td>
        <td>${getCompletionDisplay(accomplishment, completionDate)}</td>
        <td>
          <button class="report-btn" type="button" data-contract-id="${contractId}">
            <i class='bx bx-link-external'></i> Open
          </button>
        </td>
      `;

      tableBody.appendChild(tr);
    });
    updateProjectStats(validProjects);
    updateDocMonitoringStats(projects);
    updateContractsCount();
    applyDashboardFilters();
  } catch (err) {
    console.warn("Could not load projects:", err);
    showToast("Could not load projects data.", "error");
    updateProjectStats([]);
    updateDocMonitoringStats([]);
    updateContractsCount();
    applyDashboardFilters();
  }
}

tableBody?.addEventListener("click", (event) => {
  const btn = event.target.closest(".report-btn");
  if (!btn) return;
  window.location.href = "projects.html";
});

window.addEventListener("DOMContentLoaded", () => {
  syncEngineersDirectory();
  attachDocumentsCardHoverLists();
  fetchProjectsForDashboard();
  attachNotificationBell();
  attachChat();
});
document.addEventListener("DOMContentLoaded", () => {
  document.querySelectorAll(".documents-monitoring .doc-item").forEach(item => {
    item.addEventListener("click", () => {
      const section = item.getAttribute("data-doc-section") || "";
      sessionStorage.setItem("docsSection", section);
      window.location.href = "documents.html";
    });
  });
});

document.addEventListener("DOMContentLoaded", () => {
  document.querySelectorAll(".card-grid .card").forEach(card => {
    card.addEventListener("click", () => {
      const filter = card.getAttribute("data-status-filter") || "all";
      sessionStorage.setItem("projectStatusFilter", filter);
      window.location.href = "projects.html";
    });
  });
});

// -------------------------------------------------------------------------------------------------
// DOCUMENTS MONITORING STATS (BASED ON UPLOADED FILES)
// -------------------------------------------------------------------------------------------------
const contractFilesKey = "contractFiles";
const contractFilesDataKey = "contractFilesData";

function loadContractFiles() {
  const raw = localStorage.getItem(contractFilesKey);
  if (!raw) return {};
  try {
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === "object" ? parsed : {};
  } catch (err) {
    return {};
  }
}

function loadContractFilesData() {
  const raw = localStorage.getItem(contractFilesDataKey);
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
const monitoringDocDisplayLabels = {
  Contract: "Contract Aggrement"
};

function getMonitoringDocLabel(docName) {
  return monitoringDocDisplayLabels[docName] || docName;
}

function attachDocumentsCardHoverLists() {
  const cards = document.querySelectorAll(".documents-monitoring .doc-item");
  if (!cards.length) return;

  cards.forEach((card) => {
    card.querySelector(".doc-hover-tooltip")?.remove();

    const isTotal = card.classList.contains("total");
    const section = String(card.getAttribute("data-doc-section") || "").trim();

    const tooltip = document.createElement("div");
    tooltip.className = "doc-hover-tooltip";

    const title = document.createElement("div");
    title.className = "doc-hover-title";

    const list = document.createElement("ul");
    list.className = "doc-hover-list";

    if (isTotal || !section) {
      title.textContent = "Includes Sections";
      ["Contracts", "Planning and Design", "Construction", "Quality Assurance", "Contractor"].forEach((name) => {
        const li = document.createElement("li");
        li.textContent = name;
        list.appendChild(li);
      });
    } else {
      title.textContent = "Required Documents";
      (sectionDocs[section] || []).forEach((docName) => {
        const li = document.createElement("li");
        li.textContent = getMonitoringDocLabel(docName);
        list.appendChild(li);
      });
    }

    tooltip.appendChild(title);
    tooltip.appendChild(list);
    card.appendChild(tooltip);
  });
}

function formatPercent(value) {
  const num = Number(value);
  if (Number.isNaN(num)) return "0%";
  return `${num % 1 === 0 ? num.toFixed(0) : num.toFixed(1)}%`;
}

function updateDocMonitoringStats(projects) {
  if (apiBase) {
    fetch(`${apiBase}/api/documents-summary`)
      .then(res => res.json())
      .then(data => {
        if (!data.success) return;
        const totals = data.totals || {};
        const uploaded = data.uploaded || {};
        const totalAll = data.totalAll || 0;
        const uploadedAll = data.uploadedAll || 0;

        document.querySelectorAll(".documents-monitoring .doc-item").forEach(item => {
          const section = item.getAttribute("data-doc-section") || "";
          const isTotal = item.classList.contains("total");
          const ring = item.querySelector(".doc-ring");
          const ringText = item.querySelector(".doc-ring-text");
          const numEl = item.querySelector(".doc-number");
          const pctEl = item.querySelector(".doc-percent");

          let total = 0;
          let done = 0;

          if (isTotal) {
            total = totalAll;
            done = uploadedAll;
          } else if (section) {
            total = totals[section] || 0;
            done = uploaded[section] || 0;
          }

          const percent = total ? (done / total) * 100 : 0;
          if (numEl) numEl.textContent = total ? `${done}` : "0";
          if (pctEl) pctEl.textContent = formatPercent(percent);
          if (ringText) ringText.textContent = formatPercent(percent);
          if (ring) ring.style.setProperty("--progress", Math.max(0, Math.min(100, percent)).toFixed(1));
        });
      })
      .catch(err => {
        console.warn("Doc summary fetch failed:", err);
        showToast("Document summary failed to load.", "error");
      });
    return;
  }

  const files = loadContractFiles();
  const contracts = (projects || [])
    .map(p => String(p["CONTRACT ID"] || "").trim().toUpperCase())
    .filter(Boolean);

  const totals = {};
  const uploaded = {};
  let totalAll = 0;
  let uploadedAll = 0;

  Object.keys(sectionDocs).forEach(section => {
    const docs = sectionDocs[section] || [];
    const sectionTotal = contracts.length * docs.length;
    let sectionUploaded = 0;
    contracts.forEach(contractId => {
      docs.forEach(doc => {
        const key = `${section}:${doc}:${contractId}`;
        if (files[key]) sectionUploaded += 1;
      });
    });
    totals[section] = sectionTotal;
    uploaded[section] = sectionUploaded;
    totalAll += sectionTotal;
    uploadedAll += sectionUploaded;
  });

  document.querySelectorAll(".documents-monitoring .doc-item").forEach(item => {
    const section = item.getAttribute("data-doc-section") || "";
    const isTotal = item.classList.contains("total");
    const ring = item.querySelector(".doc-ring");
    const ringText = item.querySelector(".doc-ring-text");
    const numEl = item.querySelector(".doc-number");
    const pctEl = item.querySelector(".doc-percent");

    let total = 0;
    let done = 0;

    if (isTotal) {
      total = totalAll;
      done = uploadedAll;
    } else if (section) {
      total = totals[section] || 0;
      done = uploaded[section] || 0;
    }

    const percent = total ? (done / total) * 100 : 0;
    if (numEl) numEl.textContent = total ? `${done}` : "0";
    if (pctEl) pctEl.textContent = formatPercent(percent);
    if (ringText) ringText.textContent = formatPercent(percent);
    if (ring) ring.style.setProperty("--progress", Math.max(0, Math.min(100, percent)).toFixed(1));
  });
}

// -------------------------------------------------------------------------------------------------
// PROJECT DETAILS MODAL (DASHBOARD)
// -------------------------------------------------------------------------------------------------
const detailsModal = document.getElementById("projectDetailsModal");
const closeDetailsBtn = document.getElementById("closeDetailsModal");
const getDirectionsBtn = document.getElementById("getDirectionsBtn");
const downloadContractBtnDash = document.getElementById("downloadContractInfoDash");
let currentDetailsData = null;
let tabButtons = [];
let tabContents = [];

function statusToTag(status) {
  const s = String(status || "").toLowerCase();
  if (s.includes("complete")) return "success";
  if (s.includes("on-going") || s.includes("ongoing")) return "warning";
  if (s.includes("suspend") || s.includes("expire")) return "danger";
  return "warning";
}

function escapeHtml(value) {
  return String(value || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/\"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function formatMoneyDisplay(value) {
  const raw = String(value ?? "").replace(/[^\d.-]/g, "");
  const num = Number(raw);
  if (!raw || Number.isNaN(num)) return value || "-";
  return num.toLocaleString("en-PH", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

const engineersStorageKey = "engineersDirectory";
const engineersApiBase = getApiBase();
const engineersApiEndpoint = engineersApiBase ? `${engineersApiBase}/api/engineers` : "";
const emptyMark = "\u2014";

function normalizeNameKey(value) {
  return String(value || "").trim().toLowerCase();
}

async function syncEngineersDirectory() {
  if (!engineersApiEndpoint) return;
  try {
    const res = await fetch(engineersApiEndpoint);
    if (!res.ok) throw new Error(`Status ${res.status}`);
    const data = await res.json();
    if (Array.isArray(data?.engineers)) {
      localStorage.setItem(engineersStorageKey, JSON.stringify(data.engineers));
    }
  } catch (err) {
    console.warn("Engineer directory sync failed:", err);
  }
}

function getEngineerDirectory() {
  const raw = localStorage.getItem(engineersStorageKey);
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed
      .map(item => {
        if (typeof item === "string") {
          return { name: item, phone: "", facebook: "", accreditation: "" };
        }
        return {
          name: item?.name || "",
          phone: item?.phone || "",
          facebook: item?.facebook || "",
          accreditation: item?.accreditation || ""
        };
      })
      .map(item => ({
        name: String(item.name || "").trim(),
        phone: String(item.phone || "").trim(),
        facebook: String(item.facebook || "").trim(),
        accreditation: String(item.accreditation || "").trim()
      }))
      .filter(item => item.name);
  } catch (err) {
    return [];
  }
}

function findEngineerByName(name, engineers) {
  if (!name) return null;
  const key = normalizeNameKey(name);
  return engineers.find(engineer => normalizeNameKey(engineer.name) === key) || null;
}

function normalizePhoneLink(phone) {
  const cleaned = String(phone || "").replace(/[^\d+]/g, "");
  return cleaned ? `tel:${cleaned}` : "";
}

function normalizeFacebookLink(value) {
  const raw = String(value || "").trim();
  if (!raw) return "";
  if (/^https?:\/\//i.test(raw)) return raw;
  if (raw.startsWith("www.")) return `https://${raw}`;
  if (/facebook\.com|fb\.com/i.test(raw)) return `https://${raw.replace(/^https?:\/\//i, "")}`;
  const handle = raw.replace(/^@/, "");
  return `https://facebook.com/${handle}`;
}

function createContactLink({ icon, label, value, href }) {
  const hasValue = Boolean(value);
  const el = document.createElement(hasValue ? "a" : "span");
  el.className = "engineer-link";
  if (!hasValue) el.classList.add("is-empty");
  if (hasValue && href) {
    el.href = href;
    if (/^https?:\/\//i.test(href)) {
      el.target = "_blank";
      el.rel = "noopener noreferrer";
    }
  }

  const iconEl = document.createElement("i");
  iconEl.className = icon;
  el.appendChild(iconEl);

  const text = document.createElement("span");
  text.textContent = `${label}: ${hasValue ? value : emptyMark}`;
  el.appendChild(text);

  return el;
}

function renderEngineerDetails(containerId, engineerName, directory) {
  const container = document.getElementById(containerId);
  if (!container) return;
  container.innerHTML = "";

  const nameEl = document.createElement("div");
  nameEl.className = "engineer-name";
  const displayName = String(engineerName || "").trim();
  nameEl.textContent = displayName || emptyMark;
  container.appendChild(nameEl);

  if (!displayName) return;

  const engineer = findEngineerByName(displayName, directory || []);

  const meta = document.createElement("div");
  meta.className = "engineer-meta";

  const links = document.createElement("div");
  links.className = "engineer-links";
  links.appendChild(createContactLink({
    icon: "bx bx-phone",
    label: "Phone",
    value: engineer?.phone || "",
    href: normalizePhoneLink(engineer?.phone || "")
  }));
  links.appendChild(createContactLink({
    icon: "bx bxl-facebook",
    label: "Facebook",
    value: engineer?.facebook || "",
    href: normalizeFacebookLink(engineer?.facebook || "")
  }));
  meta.appendChild(links);

  const accreditation = document.createElement("div");
  accreditation.className = "engineer-accreditation";
  const accIcon = document.createElement("i");
  accIcon.className = "bx bx-badge-check";
  const accText = document.createElement("span");
  accText.textContent = `Accreditation: ${engineer?.accreditation || emptyMark}`;
  accreditation.appendChild(accIcon);
  accreditation.appendChild(accText);
  meta.appendChild(accreditation);

  container.appendChild(meta);
}

const projectPowKey = "projectPow";
const variationOrdersKey = "projectVariationOrders";

function normalizePowItems(value) {
  if (!value) return [];
  if (Array.isArray(value)) {
    return value.map(item => {
      if (typeof item === "string") {
        return { itemNo: item, description: "", quantity: "", unit: "" };
      }
      return {
        itemNo: item?.itemNo || "",
        description: item?.description || "",
        quantity: item?.quantity || "",
        unit: item?.unit || ""
      };
    }).filter(item => item.itemNo || item.description || item.quantity || item.unit);
  }
  if (typeof value === "string") {
    try {
      return normalizePowItems(JSON.parse(value));
    } catch (err) {
      return [];
    }
  }
  return [];
}

function getProjectPow(contractId) {
  const key = String(contractId || "").trim().toUpperCase();
  if (!key) return [];
  const raw = localStorage.getItem(projectPowKey);
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw);
    return normalizePowItems(parsed?.[key]);
  } catch (err) {
    return [];
  }
}

function getVariationOrders(contractId) {
  const key = String(contractId || "").trim().toUpperCase();
  if (!key) return [];
  const raw = localStorage.getItem(variationOrdersKey);
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw);
    const value = parsed?.[key];
    if (Array.isArray(value) && value.length && Array.isArray(value[0])) {
      return value.map(items => normalizePowItems(items));
    }
    if (Array.isArray(value) && value.length && (value[0]?.itemNo || value[0]?.description)) {
      return [normalizePowItems(value)];
    }
    return [];
  } catch (err) {
    return [];
  }
}

function renderPowTableReadOnly(container, items = []) {
  if (!container) return;
  if (!Array.isArray(items) || items.length === 0) {
    container.innerHTML = `
      <tr>
        <td colspan="4">No program of works added.</td>
      </tr>
    `;
    return;
  }
  container.innerHTML = items.map(row => `
    <tr>
      <td><span class="pow-item-badge">${row.itemNo || ""}</span></td>
      <td class="pow-description-text">${row.description || ""}</td>
      <td>${row.quantity || ""}</td>
      <td>${row.unit || ""}</td>
    </tr>
  `).join("");
}

function renderPowDashboard(contractId) {
  const body = document.getElementById("powDetailsBodyDash");
  const variationContainer = document.getElementById("powVariationContainerDash");
  const original = getProjectPow(contractId);
  renderPowTableReadOnly(body, original);

  const orders = getVariationOrders(contractId);
  if (!variationContainer) return;
  if (!orders.length) {
    variationContainer.innerHTML = "";
    return;
  }
  variationContainer.innerHTML = orders.map((items, idx) => `
    <div class="pow-variation-section">
      <div class="pow-subheader">Variation Order #${idx + 1}</div>
      <div class="pow-table-wrapper">
        <table class="pow-table pow-table-readonly">
          <thead>
            <tr>
              <th>Item No.</th>
              <th>Description</th>
              <th>Quantity</th>
              <th>Unit</th>
            </tr>
          </thead>
          <tbody data-vo-index="${idx}"></tbody>
        </table>
      </div>
    </div>
  `).join("");
  orders.forEach((items, idx) => {
    const tbody = variationContainer.querySelector(`tbody[data-vo-index="${idx}"]`);
    renderPowTableReadOnly(tbody, items);
  });
}

function toDate(value) {
  if (!value) return null;
  const raw = String(value).trim();
  if (!raw) return null;
  if (/^\d{4}-\d{2}-\d{2}$/.test(raw)) return new Date(`${raw}T00:00:00`);
  const parsed = new Date(raw);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

function formatDateLong(value) {
  if (!value) return "-";
  const raw = String(value).trim();
  if (!raw) return "-";
  let dateObj = null;
  if (/^\d{4}-\d{2}-\d{2}$/.test(raw)) {
    dateObj = new Date(`${raw}T00:00:00`);
  } else if (/^\d{2}\/\d{2}\/\d{4}$/.test(raw)) {
    const [mm, dd, yyyy] = raw.split("/").map(num => Number(num));
    dateObj = new Date(yyyy, mm - 1, dd);
  } else {
    const parsed = new Date(raw);
    if (!Number.isNaN(parsed.getTime())) {
      dateObj = parsed;
    }
  }
  if (!dateObj || Number.isNaN(dateObj.getTime())) {
    return raw;
  }
  const months = [
    "January", "February", "March", "April", "May", "June",
    "July", "August", "September", "October", "November", "December"
  ];
  return `${months[dateObj.getMonth()]} ${String(dateObj.getDate()).padStart(2, "0")}, ${dateObj.getFullYear()}`;
}

function getRemainingDays(expirationDate) {
  const end = toDate(expirationDate);
  if (!end) return "";
  const now = new Date();
  const diff = end.getTime() - now.getTime();
  return Math.max(0, Math.ceil(diff / (1000 * 60 * 60 * 24)));
}

function buildContractInfoRows(data = {}) {
  return [
    ["CONTRACT ID:", data.contractId || ""],
    ["CONTRACT NAME:", data.contractDescription || ""],
    ["LOCATION:", data.location || ""],
    ["TYPE OF PROJECT:", data.category || ""],
    ["APPROPRIATION:", data.appropriation || ""],
    ["APPROVED BUDGET COST:", data.approvedBudgetCost || ""],
    ["CONTRACT AMOUNT:", data.contractCost || ""],
    ["CONTRACTOR:", data.contractor || ""],
    ["CONTRACT DURATION:", ""],
    ["START DATE:", formatDateLong(data.startDate || "")],
    ["EXPIRATION DATE:", formatDateLong(data.expirationDate || "")],
    ["REMAINING DAYS:", getRemainingDays(data.expirationDate) || ""],
    ["STATUS OF PROJECT:", data.status || ""],
    ["PROJECT ENGINEER:", data.projectEngineer || ""],
    ["MATERIALS ENGINEER:", data.materialsEngineer || ""],
    ["PROJECT INSPECTOR:", data.projectInspector || ""],
    ["QUALITY ASSURANCE IN-CHARGE:", data.qaInCharge || ""],
    ["RESIDENT ENGINEER:", data.residentEngineer || ""],
    ["CONTRACTORS' MATERIALS ENGINEER:", data.contractorMaterialsEngineer || ""],
    ["LIMITS:", ""],
    ["", "", "", ""],
    ["ITEM NO.", "DESCRIPTION", "QUANTITY", "UNIT"]
  ];
}

downloadContractBtnDash?.addEventListener("click", () => {
  if (!currentDetailsData) return;
  if (!window.XLSX) {
    alert("Excel export library not loaded.");
    return;
  }
  const rows = buildContractInfoRows(currentDetailsData);
  const powItems = getProjectPow(currentDetailsData.contractId || "");
  if (powItems.length) {
    powItems.forEach(item => {
      rows.push([
        item.itemNo || "",
        item.description || "",
        item.quantity || "",
        item.unit || ""
      ]);
    });
  }
  const ws = XLSX.utils.aoa_to_sheet(rows);

  const maxCols = 5;
  const colWidths = Array.from({ length: maxCols }, () => 0);
  rows.forEach(row => {
    for (let c = 0; c < maxCols; c++) {
      const val = row?.[c] ?? "";
      const len = String(val).length;
      if (len > colWidths[c]) colWidths[c] = len;
    }
  });
  ws["!cols"] = colWidths.map(len => ({ wch: Math.min(Math.max(len + 2, 12), 60) }));

  for (let r = 0; r < Math.min(21, rows.length); r++) {
    const cellRef = XLSX.utils.encode_cell({ r, c: 0 });
    if (!ws[cellRef]) ws[cellRef] = { t: "s", v: "" };
    ws[cellRef].s = ws[cellRef].s || {};
    ws[cellRef].s.font = { ...(ws[cellRef].s.font || {}), bold: true };
  }

  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "Original");
  const id = currentDetailsData.contractId || "Project";
  const filename = `${id} - Project Info.xlsx`;
  XLSX.writeFile(wb, filename);
});

function openDetailsModal(row) {
  if (!detailsModal || !row) return;

  const contractId = row.dataset.contractId || "";
  const description = row.dataset.description || "";
  const contractor = row.dataset.contractor || "-";
  const cost = row.dataset.cost || "-";
  const accomplishment = row.dataset.accomplishment || "0";
  const status = row.dataset.status || "-";
  const completionDate = row.dataset.completionDate || "";
  const category = row.dataset.category || "-";
  const startDate = row.dataset.startDate || "";
  const expirationDate = row.dataset.expirationDate || "";
  const location = row.dataset.location || "";
  const coordinates = row.dataset.coordinates || "";
  const inCharge = row.dataset.inCharge ? JSON.parse(row.dataset.inCharge) : {};
  currentDetailsData = {
    contractId,
    contractDescription: description,
    contractor,
    category,
    appropriation: row.dataset.appropriation || "",
    approvedBudgetCost: row.dataset.approvedBudgetCost || "",
    contractCost: cost,
    startDate,
    expirationDate,
    status,
    completionDate,
    projectEngineer: inCharge.projectEngineer || "",
    materialsEngineer: inCharge.materialsEngineer || "",
    projectInspector: inCharge.projectInspector || "",
    residentEngineer: inCharge.residentEngineer || "",
    qaInCharge: inCharge.qaInCharge || "",
    contractorMaterialsEngineer: inCharge.contractorMaterialsEngineer || "",
    location,
    coordinates
  };

  const cleanDescription = String(description || "").replace(/^[\-\u2013]\s*/, "").trim();
  document.getElementById("detailsTitle").innerText = `${contractId} \u2013 ${cleanDescription}`.trim();
  const detailsDescriptionEl = document.getElementById("detailsDescription");
  if (detailsDescriptionEl) {
    const safeDesc = escapeHtml(cleanDescription);
    const safeCat = category ? escapeHtml(category) : "";
    detailsDescriptionEl.innerHTML = safeCat ? `${safeDesc}<br>${safeCat}` : `${safeDesc}`;
  }
  document.getElementById("detailsCategory").innerText = category || "-";
  document.getElementById("detailsContractor").innerText = contractor || "-";
  const detailsCostEl = document.getElementById("detailsCost");
  if (detailsCostEl) {
    const formatted = formatMoneyDisplay(cost || "");
    const safeCost = escapeHtml(formatted);
    detailsCostEl.innerHTML = `<span class="peso-sign">\u20B1</span><span class="peso-amount">${safeCost}</span>`;
  }
  document.getElementById("detailsCompletion").innerText =
    getCompletionDisplay(accomplishment, completionDate);

  const statusEl = document.getElementById("detailsStatus");
  if (statusEl) {
    statusEl.innerText = status || "â€”";
    statusEl.classList.remove("success", "warning", "danger");
    statusEl.classList.add(statusToTag(status));
  }

  document.getElementById("detailsStart").innerText = formatDateLong(startDate);
  document.getElementById("detailsExpiration").innerText = formatDateLong(expirationDate);
  const detailsLocation = document.getElementById("detailsLocation");
  if (detailsLocation) detailsLocation.innerText = location || "-";
  const detailsCoordinates = document.getElementById("detailsCoordinates");
  if (detailsCoordinates) detailsCoordinates.innerText = coordinates || "-";

  const coords = parseCoordinates(coordinates);

  const engineerDirectory = getEngineerDirectory();
  renderEngineerDetails("detailsProjectEngineer", inCharge.projectEngineer, engineerDirectory);
  renderEngineerDetails("detailsMaterialsEngineer", inCharge.materialsEngineer, engineerDirectory);
  renderEngineerDetails("detailsProjectInspector", inCharge.projectInspector, engineerDirectory);
  renderEngineerDetails("detailsResidentEngineer", inCharge.residentEngineer, engineerDirectory);
  renderEngineerDetails("detailsQaInCharge", inCharge.qaInCharge, engineerDirectory);
  renderEngineerDetails("detailsContractorMaterialsEngineer", inCharge.contractorMaterialsEngineer, engineerDirectory);

  renderGallery(contractId);
  renderDocuments(contractId);
  renderPowDashboard(contractId);

  initProjectMap();
  if (coords) {
    setMapLocation(coords.lat, coords.lng);
  }

  // Reset to first tab
  tabButtons.forEach((b, idx) => b.classList.toggle("active", idx === 0));
  tabContents.forEach((content, idx) => {
    content.classList.toggle("active", idx === 0);
    content.classList.remove("enter-from-left", "enter-from-right", "leave-to-left", "leave-to-right");
  });

  detailsModal.classList.add("open");
}

function closeDetailsModal() {
  detailsModal?.classList.remove("open");
}

closeDetailsBtn?.addEventListener("click", closeDetailsModal);
detailsModal?.addEventListener("click", (e) => {
  if (e.target === detailsModal) closeDetailsModal();
});
document.addEventListener("keydown", (e) => {
  if (e.key === "Escape" && detailsModal?.classList.contains("open")) {
    closeDetailsModal();
  }
});

tableBody?.addEventListener("click", (event) => {
  const reportBtn = event.target.closest(".report-btn");
  if (reportBtn) return;
  const row = event.target.closest("tr");
  if (!row) return;
  openDetailsModal(row);
});

// Tab switching (same behavior as projects page)
tabButtons = Array.from(document.querySelectorAll(".tab-btn"));
tabContents = Array.from(document.querySelectorAll(".modal-tabs .tab-content"));

tabButtons.forEach(btn => {
  btn.addEventListener("click", () => {
    const target = btn.dataset.tab;
    const activeBtn = document.querySelector(".tab-btn.active");
    if (activeBtn === btn) return;

    const btnList = Array.from(tabButtons);
    const fromIndex = activeBtn ? btnList.indexOf(activeBtn) : 0;
    const toIndex = btnList.indexOf(btn);
    const direction = toIndex > fromIndex ? "forward" : "backward";

    tabButtons.forEach(b => b.classList.remove("active"));
    btn.classList.add("active");

    const prevTab = document.querySelector(".modal-tabs .tab-content.active");
    const activeTab = document.getElementById(`tab-${target}`);

    if (prevTab && prevTab !== activeTab) {
      const leaveClass = direction === "forward" ? "leave-to-left" : "leave-to-right";
      prevTab.classList.remove("enter-from-left", "enter-from-right", "leave-to-left", "leave-to-right");
      prevTab.classList.add(leaveClass);

      const onEnd = (e) => {
        if (e.target !== prevTab) return;
        prevTab.classList.remove("active", leaveClass);
        prevTab.removeEventListener("transitionend", onEnd);
      };
      prevTab.addEventListener("transitionend", onEnd);

      setTimeout(() => {
        prevTab.classList.remove("active", leaveClass);
      }, 260);
    }

    const enterClass = direction === "forward" ? "enter-from-right" : "enter-from-left";
    activeTab.classList.remove("enter-from-left", "enter-from-right", "leave-to-left", "leave-to-right");
    activeTab.classList.add("active", enterClass);
    requestAnimationFrame(() => {
      activeTab.classList.remove(enterClass);
    });

    if (target === "location" && projectMap) {
      setTimeout(() => {
        projectMap.invalidateSize();
      }, 200);
    }
  });
});

// Simple placeholders for gallery/documents in dashboard modal
function renderGallery(contractId) {
  const container = document.getElementById('galleryContainer');
  if (!container) return;
  const key = String(contractId || "").trim().toUpperCase();

  container.innerHTML = '';

  const group = document.createElement('div');
  group.className = 'gallery-group';

  const header = document.createElement('div');
  header.className = 'gallery-group-header';
  header.innerHTML = `<strong>${key}</strong> <span class="photo-count">Loading...</span>`;
  group.appendChild(header);

  const photos = document.createElement('div');
  photos.className = 'gallery-photos';
  photos.innerHTML = `<div class="empty-state">Loading photos...</div>`;
  group.appendChild(photos);
  container.appendChild(group);

  const renderItems = (items = []) => {
    header.innerHTML = `<strong>${key}</strong> <span class="photo-count">${items.length} photos</span>`;
    photos.innerHTML = '';
    if (!items.length) {
      photos.innerHTML = `<div class="empty-state">No photos uploaded.</div>`;
      return;
    }
    items.forEach((item, index) => {
      const imgWrap = document.createElement('div');
      imgWrap.className = 'gallery-photo';

      const overlay = document.createElement('div');
      overlay.className = 'overlay';
      overlay.innerHTML = `
        <div class="zoom-icon">+</div>
        <div class="view-text">VIEW DETAILS</div>
      `;

      const img = document.createElement('img');
      img.src = item.dataUrl || "";
      img.alt = `${key} photo`;

      imgWrap.appendChild(img);
      imgWrap.appendChild(overlay);

      imgWrap.addEventListener('click', () => openPhotoModalAt(index, items, key));
      photos.appendChild(imgWrap);
    });
  };

  if (useRemoteStorage) {
    fetch(`${apiBase}/api/gallery/${encodeURIComponent(key)}`)
      .then(res => res.json())
      .then(data => {
        const items = (data?.photos || []).map(item => ({
          name: item.name || item.fileName || "",
          date: item.date || item.updatedAt || "",
          dataUrl: item.url || item.dataUrl || ""
        }));
        renderItems(items);
      })
      .catch(() => {
        photos.innerHTML = `<div class="empty-state">Failed to load photos.</div>`;
      });
    return;
  }

  const raw = localStorage.getItem('galleryPhotos');
  const all = raw ? JSON.parse(raw) : {};
  const items = Array.isArray(all[key]) ? all[key] : [];
  renderItems(items);
}

let currentGalleryItems = [];
let currentGalleryIndex = 0;
let currentGalleryContract = "";

function updatePhotoModal() {
  if (!currentGalleryItems.length) return;
  const item = currentGalleryItems[currentGalleryIndex] || {};
  const photoModalImage = document.getElementById('photoModalImage');
  const photoId = document.getElementById('photoId');
  const photoPurpose = document.getElementById('photoPurpose');
  const photoDate = document.getElementById('photoDate');
  const photoLocation = document.getElementById('photoLocation');
  const photoDownloadBtn = document.getElementById('photoDownloadBtn');

  const src = item.dataUrl || item.url || "";
  const name = item.name || item.fileName || "";
  const dateValue = item.date || item.updatedAt || "";
  const dateObj = dateValue ? new Date(dateValue) : null;
  const dateText = dateObj && !Number.isNaN(dateObj.getTime())
    ? dateObj.toLocaleDateString("en-PH")
    : "—";

  if (photoModalImage) photoModalImage.src = src || '';
  if (photoId) photoId.textContent = `${currentGalleryContract}-photo-${currentGalleryIndex + 1}`;
  if (photoPurpose) photoPurpose.textContent = 'Geotagged Photo';
  if (photoDate) photoDate.textContent = dateText;
  if (photoLocation) photoLocation.textContent = currentGalleryContract || '—';
  if (photoDownloadBtn) {
    const fallbackName = `${currentGalleryContract}-photo-${currentGalleryIndex + 1}.jpg`;
    photoDownloadBtn.href = src || '#';
    photoDownloadBtn.setAttribute('download', name || fallbackName);
  }
}

function showGalleryPhoto(index) {
  if (!currentGalleryItems.length) return;
  const total = currentGalleryItems.length;
  currentGalleryIndex = (index + total) % total;
  updatePhotoModal();
}

function openPhotoModalAt(index, items, contractKey) {
  currentGalleryItems = Array.isArray(items) ? items : [];
  currentGalleryContract = String(contractKey || "").trim().toUpperCase();
  if (!currentGalleryItems.length) return;
  const total = currentGalleryItems.length;
  currentGalleryIndex = Math.max(0, Math.min(index, total - 1));
  updatePhotoModal();
  const photoModal = document.getElementById('photoModal');
  photoModal?.classList.add('open');
}
function getFileKey(section, contractId) {
  return `${section}:${String(contractId || "").trim().toUpperCase()}`;
}

const documentsSectionLabels = {
  contracts: "Contracts",
  planning: "Planning and Design",
  construction: "Construction",
  qa: "Quality Assurance",
  contractor: "Contractor"
};
const documentDisplayLabels = {
  Contract: "Contract Aggrement"
};
const documentsTotalProgressEl = document.getElementById("documentsTotalProgress");

function hasUploadedDocument(entry) {
  if (!entry) return false;
  return Boolean(entry.fileName || entry.name || entry.url);
}

function setDocumentsTotalProgress(done, total) {
  if (!documentsTotalProgressEl) return;
  if (!Number.isFinite(done) || !Number.isFinite(total) || total <= 0) {
    documentsTotalProgressEl.textContent = "Total Documents Uploaded: 0% (0/0)";
    return;
  }
  const percent = (done / total) * 100;
  documentsTotalProgressEl.textContent =
    `Total Documents Uploaded: ${formatPercent(percent)} (${done}/${total})`;
}

function renderDocuments(contractId) {
  const container = document.getElementById("documentsContainer");
  if (!container) return;

  const key = String(contractId || "").trim().toUpperCase();
  container.innerHTML = "";

  if (!key) {
    setDocumentsTotalProgress(0, 0);
    container.innerHTML = `<div class="empty-state">No contract selected.</div>`;
    return;
  }

  const renderWithIndex = (index = {}) => {
    container.innerHTML = "";
    let totalDocs = 0;
    let uploadedDocs = 0;

    Object.entries(sectionDocs).forEach(([section, docs]) => {
      const sectionTotal = docs.length;
      let sectionUploaded = 0;

      docs.forEach(doc => {
        const entry = index?.[section]?.[doc] || null;
        if (hasUploadedDocument(entry)) sectionUploaded += 1;
      });

      const sectionPercent = sectionTotal ? (sectionUploaded / sectionTotal) * 100 : 0;
      totalDocs += sectionTotal;
      uploadedDocs += sectionUploaded;

      const header = document.createElement("div");
      header.className = "document-section-title";
      header.innerHTML = `
        <span class="document-section-name">${escapeHtml(documentsSectionLabels[section] || section)}</span>
        <span class="document-section-progress">${formatPercent(sectionPercent)} (${sectionUploaded}/${sectionTotal})</span>
      `;
      container.appendChild(header);

      docs.forEach(doc => {
        const entry = index?.[section]?.[doc] || null;
        const fileName = entry?.fileName || entry?.name || "";
        const isUploaded = hasUploadedDocument(entry);
        const item = document.createElement("div");
        item.className = `document-item ${isUploaded ? "doc-has-file" : "doc-missing"}`;

        const safeDoc = escapeHtml(documentDisplayLabels[doc] || doc);
        const statusText = fileName
          ? `File: ${fileName}`
          : (isUploaded ? "Uploaded file" : "No file uploaded");
        const safeStatus = escapeHtml(statusText);
        const iconClass = isUploaded ? "bx-check-circle" : "bx-x-circle";

        item.innerHTML = `
          <div class="document-item-left">
            <i class='bx ${iconClass} document-icon'></i>
            <div class="document-info">
              <h5>${safeDoc}</h5>
              <p>${safeStatus}</p>
            </div>
          </div>
        `;

        if (entry?.url) {
          const btn = document.createElement("button");
          btn.className = "document-item-action";
          btn.innerHTML = '<i class="bx bx-show"></i>';
          btn.title = "View document";
          btn.addEventListener("click", () => {
            window.open(entry.url, "_blank");
          });
          item.appendChild(btn);
        }

        container.appendChild(item);
      });
    });

    setDocumentsTotalProgress(uploadedDocs, totalDocs);
  };

  if (useRemoteStorage) {
    if (documentsTotalProgressEl) {
      documentsTotalProgressEl.textContent = "Total Documents Uploaded: Loading...";
    }
    container.innerHTML = `<div class="empty-state">Loading documents...</div>`;
    fetch(`${apiBase}/api/documents/${encodeURIComponent(key)}`)
      .then(res => res.json())
      .then(data => {
        const index = {};
        (data?.documents || []).forEach(item => {
          if (!item.section || !item.docName) return;
          if (!index[item.section]) index[item.section] = {};
          index[item.section][item.docName] = item;
        });
        renderWithIndex(index);
      })
      .catch(() => {
        setDocumentsTotalProgress(0, 0);
        container.innerHTML = `<div class="empty-state">Failed to load documents.</div>`;
      });
    return;
  }

  const files = loadContractFiles();
  const fileData = loadContractFilesData();
  const localIndex = {};
  Object.entries(sectionDocs).forEach(([section, docs]) => {
    if (!localIndex[section]) localIndex[section] = {};
    docs.forEach(doc => {
      const fileKey = getFileKey(`${section}:${doc}`, key);
      const fileName = files[fileKey] || "";
      const data = fileData[fileKey];
      if (fileName || data?.dataUrl) {
        localIndex[section][doc] = {
          fileName,
          name: fileName,
          url: data?.dataUrl || ""
        };
      }
    });
  });
  renderWithIndex(localIndex);
}

function parseCoordinates(value) {
  const raw = String(value || "").trim();
  if (!raw) return null;
  const match = raw.match(/(-?\d+(?:\.\d+)?)[,\s]+(-?\d+(?:\.\d+)?)/);
  if (!match) return null;
  const lat = Number(match[1]);
  const lng = Number(match[2]);
  if (Number.isNaN(lat) || Number.isNaN(lng)) return null;
  return { lat, lng };
}

function openDirections(lat, lng, fallbackQuery) {
  const url = lat !== null && lng !== null
    ? `https://www.google.com/maps?q=${lat},${lng}`
    : `https://www.google.com/maps?q=${encodeURIComponent(fallbackQuery || "")}`;
  window.open(url, "_blank");
}

// Leaflet map (same as projects page)
let projectMap = null;
let streetLayer = null;
let satelliteLayer = null;
let projectMarker = null;

function initProjectMap() {
  const mapEl = document.getElementById("projectMap");
  if (!mapEl || !window.L) return;
  if (projectMap) return;

  const projectLat = 11.7731947;
  const projectLng = 124.8856814;

  projectMap = L.map("projectMap").setView([projectLat, projectLng], 16);

  streetLayer = L.tileLayer(
    "https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png",
    { attribution: "Â© OpenStreetMap contributors" }
  ).addTo(projectMap);

  satelliteLayer = L.tileLayer(
    "https://{s}.google.com/vt/lyrs=s&x={x}&y={y}&z={z}",
    { subdomains: ["mt0", "mt1", "mt2", "mt3"] }
  );

  projectMarker = L.marker([projectLat, projectLng])
    .addTo(projectMap)
    .bindPopup("Project Location")
    .openPopup();

  const streetBtn = document.getElementById("streetBtn");
  const satelliteBtn = document.getElementById("satelliteBtn");

  streetBtn?.addEventListener("click", () => {
    if (!projectMap) return;
    projectMap.removeLayer(satelliteLayer);
    streetLayer.addTo(projectMap);
    streetBtn.classList.add("active");
    satelliteBtn?.classList.remove("active");
  });

  satelliteBtn?.addEventListener("click", () => {
    if (!projectMap) return;
    projectMap.removeLayer(streetLayer);
    satelliteLayer.addTo(projectMap);
    satelliteBtn.classList.add("active");
    streetBtn?.classList.remove("active");
  });
}

function setMapLocation(lat, lng) {
  if (!projectMap) return;
  const coords = [lat, lng];
  projectMap.setView(coords, 16);
  if (projectMarker) {
    projectMarker.setLatLng(coords);
  } else {
    projectMarker = L.marker(coords).addTo(projectMap).bindPopup("Project Location");
  }
}

getDirectionsBtn?.addEventListener("click", () => {
  if (!currentDetailsData) return;
  const coords = parseCoordinates(currentDetailsData.coordinates || "");
  if (coords) {
    openDirections(coords.lat, coords.lng, "");
    return;
  }
  const fallback = currentDetailsData.location || currentDetailsData.contractDescription || "";
  if (!fallback) return;
  openDirections(null, null, fallback);
});
//---------------------------------------------------------------------------------------------------
// HANDLE DROPDOWN PILLS (ONLY ONE OPEN)
const dropdownPills = document.querySelectorAll(".dropdown-pill");

dropdownPills.forEach(pill => {
  const header = pill.querySelector(".pill-header");

  header.addEventListener("click", (e) => {
    e.stopPropagation();

    dropdownPills.forEach(p => {
      if (p !== pill) p.classList.remove("open");
    });

    pill.classList.toggle("open");
  });
});

// Prevent dropdown click from closing
document.querySelectorAll(".category-dropdown, .year-dropdown").forEach(menu => {
  menu.addEventListener("click", e => e.stopPropagation());
});

// Close all on outside click
document.addEventListener("click", () => {
  dropdownPills.forEach(p => p.classList.remove("open"));
});



//---------------------------------------------------------------------------------------------------
// CATEGORY PILL DROPDOWN
const categoryPill = document.getElementById("categoryPill");
const categoryLabel = document.getElementById("categoryLabel");
const categoryOptions = categoryPill.querySelectorAll(".cat-option");


// Select category
categoryOptions.forEach(option => {
  option.addEventListener("click", (e) => {
    e.stopPropagation();

    categoryOptions.forEach(o => o.classList.remove("active"));
    option.classList.add("active");

    categoryLabel.textContent = option.textContent.trim();
    categoryPill.classList.remove("open");
    applyDashboardFilters();
  });
});


//---------------------------------------------------------------------------------------------------
// YEAR DROPDOWN
const yearPill = document.getElementById("yearPill");
const yearHeader = yearPill.querySelector(".pill-header");
const yearLabel = document.getElementById("yearLabel");
const yearOptions = yearPill.querySelectorAll(".year-option");


yearOptions.forEach(option => {
  option.addEventListener("click", (e) => {
    e.stopPropagation();
    yearOptions.forEach(o => o.classList.remove("active"));
    option.classList.add("active");
    yearLabel.textContent = option.textContent;
    yearPill.classList.remove("open");
    applyDashboardFilters();
  });
});
//---------------------------------------------------------------------------------------------------
// PROJECT ENGINEER DROPDOWN
const engineerPill = document.getElementById("engineerPill");
const engineerLabel = document.getElementById("engineerLabel");
const engineerOptions = engineerPill.querySelectorAll(".engineer-option");

engineerOptions.forEach(option => {
  option.addEventListener("click", (e) => {
    e.stopPropagation();

    engineerOptions.forEach(o => o.classList.remove("active"));
    option.classList.add("active");

    engineerLabel.textContent = option.textContent;
    engineerPill.classList.remove("open");
    applyDashboardFilters();
  });
});

//---------------------------------------------------------------------------------------------------
// MATERIALS ENGINEER DROPDOWN
const materialsPill = document.getElementById("materialsPill");
const materialsLabel = document.getElementById("materialsLabel");
const materialsOptions = materialsPill.querySelectorAll(".materials-option");

materialsOptions.forEach(option => {
  option.addEventListener("click", (e) => {
    e.stopPropagation();
    
    materialsOptions.forEach(o => o.classList.remove("active"));
    option.classList.add("active");
    
    materialsLabel.textContent = option.textContent;
    materialsPill.classList.remove("open");
    applyDashboardFilters();
  });
});

//---------------------------------------------------------------------------------------------------
// CONTRACTOR DROPDOWN
const contractorPill = document.getElementById("contractorPill");
const contractorLabel = document.getElementById("contractorLabel");
const contractorOptions = contractorPill.querySelectorAll(".contractor-option");

contractorOptions.forEach(option => {
  option.addEventListener("click", (e) => {
    e.stopPropagation();

    contractorOptions.forEach(o => o.classList.remove("active"));
    option.classList.add("active");

    contractorLabel.textContent = option.textContent;
    contractorPill.classList.remove("open");
    applyDashboardFilters();
  });
});

//---------------------------------------------------------------------------------------------------
// FILTER APPLICATION
const filterSearchInput = document.querySelector(".project-filter-bar .filter-search input");

function normalizeFilterText(value) {
  return String(value || "").trim().toLowerCase();
}

function normalizeUnknown(value) {
  const trimmed = String(value || "").trim();
  return trimmed ? trimmed : "UNKNOWN";
}

function getActiveFilterText(selector) {
  const el = document.querySelector(selector);
  return el ? el.textContent.trim() : "";
}

function isAllSelection(value) {
  return normalizeFilterText(value).startsWith("all");
}

function getInChargeFromRow(row) {
  if (!row) return {};
  try {
    return row.dataset.inCharge ? JSON.parse(row.dataset.inCharge) : {};
  } catch (err) {
    return {};
  }
}

function getRowYearCandidates(row) {
  const years = new Set();
  const startYear = parseDateValue(row.dataset.startDate || "")?.getFullYear();
  const expYear = parseDateValue(row.dataset.expirationDate || "")?.getFullYear();
  const completionYear = parseDateValue(row.dataset.completionDate || "")?.getFullYear();
  if (startYear) years.add(String(startYear));
  if (expYear) years.add(String(expYear));
  if (completionYear) years.add(String(completionYear));

  const contractId = String(row.dataset.contractId || "").trim();
  const idMatch = contractId.match(/^(\d{2})/);
  if (idMatch) {
    years.add(String(2000 + Number(idMatch[1])));
  }

  return Array.from(years);
}

function applyDashboardFilters() {
  if (!tableBody) return;

  const searchTerm = normalizeFilterText(filterSearchInput?.value || "");
  const categoryFilter = getActiveFilterText("#categoryPill .cat-option.active");
  const yearFilter = getActiveFilterText("#yearPill .year-option.active");
  const engineerFilter = getActiveFilterText("#engineerPill .engineer-option.active");
  const materialsFilter = getActiveFilterText("#materialsPill .materials-option.active");
  const contractorFilter = getActiveFilterText("#contractorPill .contractor-option.active");

  const rows = Array.from(tableBody.querySelectorAll("tr"));
  rows.forEach(row => {
    const inCharge = getInChargeFromRow(row);
    const rowCategory = normalizeUnknown(row.dataset.category || "");
    const rowContractor = normalizeUnknown(row.dataset.contractor || "");
    const rowEngineer = normalizeUnknown(inCharge.projectEngineer || "");
    const rowMaterials = normalizeUnknown(inCharge.materialsEngineer || "");
    const rowLocation = row.dataset.location || "";
    const rowDescription = row.dataset.description || "";
    const rowId = row.dataset.contractId || "";

    const matchesCategory = isAllSelection(categoryFilter)
      || normalizeFilterText(rowCategory).includes(normalizeFilterText(categoryFilter));

    const matchesYear = isAllSelection(yearFilter)
      || getRowYearCandidates(row).includes(String(yearFilter).trim());

    const matchesEngineer = isAllSelection(engineerFilter)
      || normalizeFilterText(rowEngineer).includes(normalizeFilterText(engineerFilter));

    const matchesMaterials = isAllSelection(materialsFilter)
      || normalizeFilterText(rowMaterials).includes(normalizeFilterText(materialsFilter));

    const matchesContractor = isAllSelection(contractorFilter)
      || normalizeFilterText(rowContractor).includes(normalizeFilterText(contractorFilter));

    const haystack = [
      rowId,
      rowDescription,
      rowContractor,
      rowCategory,
      rowLocation,
      row.dataset.startDate || "",
      row.dataset.expirationDate || "",
      row.dataset.completionDate || "",
      rowEngineer,
      rowMaterials,
      ...getRowYearCandidates(row)
    ].join(" ");

    const matchesSearch = !searchTerm || normalizeFilterText(haystack).includes(searchTerm);
    const isVisible = matchesSearch && matchesCategory && matchesYear
      && matchesEngineer && matchesMaterials && matchesContractor;

    row.style.display = isVisible ? "" : "none";
  });

  updateContractsCount();
}

filterSearchInput?.addEventListener("input", applyDashboardFilters);

// Navigation transition handlers (moved from inline HTML)
document.addEventListener('DOMContentLoaded', () => {
  (function () {
    const page = document.querySelector('section') || document.body;
    const current = window.location.pathname.split('/').pop() || 'dashboard.html';

    // Active link highlighting
    document.querySelectorAll('.menu-links .nav-link').forEach(li => {
      const a = li.querySelector('a');
      if (!a) return;
      const href = a.getAttribute('href');
      if (!href || href === '#') return;
      if (href.split('/').pop() === current) {
        document.querySelectorAll('.menu-links .nav-link').forEach(x => x.classList.remove('active'));
        li.classList.add('active');
      }
    });

    // Entry animation based on previous page
    const t = sessionStorage.getItem('pageTransition');
    if (t === 'sidebar') {
      page.classList.add('page-enter');
      sessionStorage.removeItem('pageTransition');
    }

    // Intercept sidebar links and animate exit before navigating
    document.querySelectorAll('.menu-links a[href$=".html"]').forEach(a => {
      a.addEventListener('click', (ev) => {
        const href = a.getAttribute('href');
        if (!href) return;
        const target = href.split('/').pop();
        if (target === current) return;

        ev.preventDefault();
        page.classList.add('page-exit');
        sessionStorage.setItem('pageTransition', 'sidebar');
        setTimeout(() => window.location.href = href, 310);
      });
    });
  })();
});













function closePhotoModal() {
  const photoModal = document.getElementById('photoModal');
  if (photoModal) photoModal.classList.remove('open');
  currentGalleryItems = [];
  currentGalleryIndex = 0;
  currentGalleryContract = "";
}

document.addEventListener('DOMContentLoaded', () => {
  const closePhotoModalBtn = document.getElementById('closePhotoModal');
  const photoModalEl = document.getElementById('photoModal');
  const prevPhotoBtn = document.getElementById('photoPrevBtn');
  const nextPhotoBtn = document.getElementById('photoNextBtn');

  closePhotoModalBtn?.addEventListener('click', closePhotoModal);
  prevPhotoBtn?.addEventListener('click', () => showGalleryPhoto(currentGalleryIndex - 1));
  nextPhotoBtn?.addEventListener('click', () => showGalleryPhoto(currentGalleryIndex + 1));

  photoModalEl?.addEventListener('click', (e) => {
    if (e.target === photoModalEl) {
      closePhotoModal();
    }
  });

  document.addEventListener('keydown', (e) => {
    if (!photoModalEl?.classList.contains('open')) return;
    if (e.key === 'Escape') closePhotoModal();
    if (e.key === 'ArrowLeft') showGalleryPhoto(currentGalleryIndex - 1);
    if (e.key === 'ArrowRight') showGalleryPhoto(currentGalleryIndex + 1);
  });
});
