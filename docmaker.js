const body = document.querySelector("body");
const sidebar = body.querySelector(".sidebar");
const toggle = body.querySelector(".toggle");
const modeSwitch = body.querySelector(".toggle-switch");
const modeText = body.querySelector(".mode-text");
const sidebarStateKey = "sidebarOpen";
const themeStateKey = "darkMode";
const TEMPLATE_STORE_KEY = "docMakerQaTemplatesV1";
const projectSearchInput = document.getElementById("projectSearch");
const projectCountEl = document.getElementById("projectCount");
const templateListEl = document.getElementById("templateList");
const projectsContainerEl = document.getElementById("projectsContainer");

const qaTemplateDefs = [
  { id: "qcp", label: "Quality Control Program", suffix: "QCP" },
  { id: "workchart", label: "Workchart", suffix: "WORKCHART" },
  { id: "summaryTest", label: "Summary of Test", suffix: "SUMMARY OF TEST" },
  { id: "cqca", label: "CQCA", suffix: "CQCA" },
  { id: "statusFieldLab", label: "Status of Field and Laboratory Test", suffix: "STATUS OF FIELD AND LABORATORY TEST" },
  { id: "statusTest", label: "Status Of Test", suffix: "STATUS OF TEST" },
  { id: "summaryField", label: "Summary of Field Test", suffix: "SUMMARY OF FIELD TEST" },
  { id: "materialsInspection", label: "Materials Inspection Report", suffix: "MATERIALS INSPECTION REPORT" },
  { id: "concreteWorks", label: "Report on Concrete Works", suffix: "REPORT ON CONCRETE WORKS" }
];
const bundledTemplates = {
  qcp: {
    fileName: "QCP.xlsx",
    url: "docsmaker/QCP.xlsx",
    mimeType: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
  }
};

let allProjects = [];
let templateStore = loadTemplateStore();

function getApiBase() {
  const explicit = (window.DPWH_API_BASE || "").trim();
  if (explicit) return explicit.replace(/\/$/, "");
  const host = window.location.hostname;
  const isLocal = host === "localhost" || host === "127.0.0.1";
  return isLocal ? `${window.location.protocol}//${host}:3000` : "";
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
  body.classList.toggle("dark", isDark);
  if (modeText) {
    modeText.innerText = isDark ? "Light Mode" : "Dark Mode";
  }
}

function safeJsonParse(raw, fallback) {
  try {
    return JSON.parse(raw);
  } catch (err) {
    return fallback;
  }
}

function sanitizeFilenamePart(value) {
  return String(value || "")
    .trim()
    .replace(/[\\/:*?"<>|]/g, "")
    .replace(/\s+/g, " ")
    .slice(0, 120);
}

function loadTemplateStore() {
  const raw = appStorage.getItem(TEMPLATE_STORE_KEY);
  if (!raw) return {};
  const parsed = safeJsonParse(raw, {});
  return parsed && typeof parsed === "object" ? parsed : {};
}

function saveTemplateStore() {
  appStorage.setItem(TEMPLATE_STORE_KEY, JSON.stringify(templateStore));
}

function getProjectId(project) {
  return String(project?.["CONTRACT ID"] || "").trim();
}

function getProjectName(project) {
  return String(project?.["CONTRACT NAME/LOCATION"] || "").trim();
}

function getFileExtension(entry) {
  if (entry?.url) {
    const lowerUrl = String(entry.url).toLowerCase();
    if (lowerUrl.endsWith(".xlsm")) return "xlsm";
    if (lowerUrl.endsWith(".xls")) return "xls";
    return "xlsx";
  }
  const fileName = String(entry?.fileName || "").toLowerCase();
  if (fileName.endsWith(".xlsm")) return "xlsm";
  if (fileName.endsWith(".xls")) return "xls";
  return "xlsx";
}

async function fetchBundledTemplateBlob(entry) {
  const res = await fetch(entry.url);
  if (!res.ok) throw new Error("Bundled template not found.");
  const arrayBuffer = await res.arrayBuffer();
  return new Blob([arrayBuffer], { type: entry.mimeType || "application/octet-stream" });
}

function dataUrlToBlob(dataUrl) {
  const parts = String(dataUrl || "").split(",");
  if (parts.length < 2) return null;
  const mimeMatch = parts[0].match(/data:([^;]+);base64/);
  const mime = mimeMatch ? mimeMatch[1] : "application/octet-stream";
  const binary = atob(parts[1]);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i += 1) {
    bytes[i] = binary.charCodeAt(i);
  }
  return new Blob([bytes], { type: mime });
}

function triggerDownload(blob, filename) {
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  setTimeout(() => URL.revokeObjectURL(url), 800);
}

async function downloadGeneratedQcp(projectId) {
  const apiBase = getApiBase();
  const res = await fetch(`${apiBase}/api/docmaker/qcp/${encodeURIComponent(projectId)}`);
  if (!res.ok) {
    throw new Error("QCP generation failed.");
  }
  const blob = await res.blob();
  const safeProjectId = sanitizeFilenamePart(projectId || "PROJECT");
  triggerDownload(blob, `${safeProjectId} - QCP.xlsx`);
}

function formatTemplateStatus(entry) {
  if (!entry || !entry.fileName) return "No template uploaded";
  return `Template: ${entry.fileName}`;
}

function renderTemplateUploads() {
  if (!templateListEl) return;
  templateListEl.innerHTML = "";

  qaTemplateDefs.forEach(def => {
    const entry = templateStore[def.id] || null;
    const bundled = bundledTemplates[def.id] || null;
    const item = document.createElement("div");
    item.className = "template-item";

    const head = document.createElement("div");
    head.className = "template-head";

    const title = document.createElement("span");
    title.className = "template-title";
    title.textContent = def.label;

    const status = document.createElement("span");
    status.className = "template-status";
    status.textContent = entry
      ? formatTemplateStatus(entry)
      : bundled
        ? `Default template: ${bundled.fileName} (docsmaker/)`
        : "No template uploaded";
    status.id = `tpl-status-${def.id}`;

    head.appendChild(title);
    head.appendChild(status);

    const actions = document.createElement("div");
    actions.className = "template-actions";

    const uploadLabel = document.createElement("label");
    uploadLabel.className = "template-upload";
    uploadLabel.innerHTML = "<i class='bx bx-upload'></i> Upload Format";

    const fileInput = document.createElement("input");
    fileInput.type = "file";
    fileInput.accept = ".xlsx,.xlsm,.xls";
    fileInput.dataset.templateId = def.id;
    uploadLabel.appendChild(fileInput);

    const clearBtn = document.createElement("button");
    clearBtn.className = "template-clear";
    clearBtn.type = "button";
    clearBtn.textContent = "Clear";
    clearBtn.dataset.templateId = def.id;
    clearBtn.disabled = !entry;

    actions.appendChild(uploadLabel);
    actions.appendChild(clearBtn);

    item.appendChild(head);
    item.appendChild(actions);
    templateListEl.appendChild(item);
  });
}

function getFilteredProjects() {
  const q = String(projectSearchInput?.value || "").trim().toLowerCase();
  if (!q) return allProjects.slice();
  return allProjects.filter(project => {
    const id = getProjectId(project).toLowerCase();
    const name = getProjectName(project).toLowerCase();
    return id.includes(q) || name.includes(q);
  });
}

function createProjectCard(project) {
  const projectId = getProjectId(project);
  const projectName = getProjectName(project);

  const card = document.createElement("div");
  card.className = "project-card";

  const title = document.createElement("div");
  title.className = "project-title";
  title.innerHTML = `
    <span class="project-id">${escapeHtml(projectId || "NO ID")}</span>
    <span class="project-name">${escapeHtml(projectName || "Unnamed Project")}</span>
  `;

  const docGrid = document.createElement("div");
  docGrid.className = "doc-grid";

  qaTemplateDefs.forEach(def => {
    const row = document.createElement("div");
    row.className = "doc-row";
    const template = templateStore[def.id] || null;
    const bundled = bundledTemplates[def.id] || null;
    const activeTemplate = template || bundled || null;
    const canDownload = Boolean(
      (activeTemplate?.dataUrl && activeTemplate?.fileName) ||
      activeTemplate?.url
    );

    const docName = document.createElement("span");
    docName.className = "doc-name";
    docName.textContent = def.label;

    const downloadBtn = document.createElement("button");
    downloadBtn.type = "button";
    downloadBtn.className = "doc-download";
    downloadBtn.textContent = canDownload ? "Download" : "No format";
    downloadBtn.disabled = !canDownload;

    downloadBtn.addEventListener("click", () => {
      const selected = templateStore[def.id] || bundledTemplates[def.id] || null;
      if (!selected) return;

      if (def.id === "qcp") {
        downloadGeneratedQcp(projectId).catch(() => {
          alert("Failed to generate QCP file for this project.");
        });
        return;
      }

      const ext = getFileExtension(selected);
      const cleanProjectId = sanitizeFilenamePart(projectId || "PROJECT");
      const cleanSuffix = sanitizeFilenamePart(def.suffix || def.label || "DOCUMENT");
      const filename = `${cleanProjectId} - ${cleanSuffix}.${ext}`;

      if (selected.dataUrl) {
        const blob = dataUrlToBlob(selected.dataUrl);
        if (!blob) return;
        triggerDownload(blob, filename);
        return;
      }

      if (selected.url) {
        fetchBundledTemplateBlob(selected)
          .then(blob => triggerDownload(blob, filename))
          .catch(() => {});
      }
    });

    row.appendChild(docName);
    row.appendChild(downloadBtn);
    docGrid.appendChild(row);
  });

  card.appendChild(title);
  card.appendChild(docGrid);
  return card;
}

function renderProjects() {
  if (!projectsContainerEl) return;
  const filtered = getFilteredProjects();
  projectsContainerEl.innerHTML = "";

  if (!filtered.length) {
    projectsContainerEl.innerHTML = `<div class="empty-state">No saved projects found.</div>`;
  } else {
    filtered.forEach(project => {
      projectsContainerEl.appendChild(createProjectCard(project));
    });
  }

  if (projectCountEl) {
    projectCountEl.textContent = `${filtered.length} project${filtered.length === 1 ? "" : "s"}`;
  }
}

function escapeHtml(value) {
  return String(value || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

async function loadProjects() {
  const apiBase = getApiBase();
  projectsContainerEl.innerHTML = `<div class="empty-state">Loading projects...</div>`;
  try {
    const res = await fetch(`${apiBase}/api/get-projects`);
    const data = await res.json().catch(() => ({}));
    if (!res.ok || !data.success) {
      throw new Error(data?.error || "Failed to load projects.");
    }
    allProjects = (data.projects || []).filter(item => getProjectId(item));
    renderProjects();
  } catch (err) {
    projectsContainerEl.innerHTML = `<div class="empty-state">Failed to load saved projects.</div>`;
  }
}

function bindTemplateEvents() {
  templateListEl?.addEventListener("change", event => {
    const input = event.target;
    if (!(input instanceof HTMLInputElement)) return;
    if (input.type !== "file") return;
    const templateId = String(input.dataset.templateId || "");
    const def = qaTemplateDefs.find(item => item.id === templateId);
    if (!def) return;
    const file = input.files && input.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = () => {
      templateStore[templateId] = {
        fileName: file.name,
        mimeType: file.type || "application/octet-stream",
        dataUrl: String(reader.result || ""),
        updatedAt: new Date().toISOString()
      };
      saveTemplateStore();
      renderTemplateUploads();
      renderProjects();
    };
    reader.readAsDataURL(file);
  });

  templateListEl?.addEventListener("click", event => {
    const target = event.target;
    if (!(target instanceof HTMLElement)) return;
    const clearBtn = target.closest(".template-clear");
    if (!(clearBtn instanceof HTMLButtonElement)) return;
    const templateId = String(clearBtn.dataset.templateId || "");
    if (!templateId) return;
    delete templateStore[templateId];
    saveTemplateStore();
    renderTemplateUploads();
    renderProjects();
  });
}

function bindSidebarAndTheme() {
  toggle?.addEventListener("click", () => {
    sidebar.classList.toggle("close");
    const isOpen = !sidebar.classList.contains("close");
    appStorage.setItem(sidebarStateKey, String(isOpen));
  });

  modeSwitch?.addEventListener("click", () => {
    body.classList.toggle("dark");
    const isDark = body.classList.contains("dark");
    appStorage.setItem(themeStateKey, String(isDark));
    modeText.innerText = isDark ? "Light Mode" : "Dark Mode";
  });
}

function bindNavigationTransitions() {
  const page = document.querySelector("section") || document.body;
  const current = window.location.pathname.split("/").pop() || "docmaker.html";

  document.querySelectorAll(".menu-links .nav-link").forEach(li => {
    const anchor = li.querySelector("a");
    if (!anchor) return;
    const href = anchor.getAttribute("href");
    if (!href || href === "#") return;
    if (href.split("/").pop() === current) {
      document.querySelectorAll(".menu-links .nav-link").forEach(x => x.classList.remove("active"));
      li.classList.add("active");
    }
  });

  const t = sessionStorage.getItem("pageTransition");
  if (t === "sidebar") {
    page.classList.add("page-enter");
    sessionStorage.removeItem("pageTransition");
  }

  document.querySelectorAll(".menu-links a[href$='.html']").forEach(anchor => {
    anchor.addEventListener("click", event => {
      const href = anchor.getAttribute("href");
      if (!href) return;
      const target = href.split("/").pop();
      if (target === current) return;
      event.preventDefault();
      page.classList.add("page-exit");
      sessionStorage.setItem("pageTransition", "sidebar");
      setTimeout(() => {
        window.location.href = href;
      }, 310);
    });
  });
}

applySidebarState();
applyThemeState();

document.addEventListener("DOMContentLoaded", () => {
  bindSidebarAndTheme();
  bindNavigationTransitions();
  renderTemplateUploads();
  bindTemplateEvents();
  loadProjects();
  projectSearchInput?.addEventListener("input", renderProjects);
});
