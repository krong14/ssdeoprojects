const body = document.querySelector("body");
const sidebar = body.querySelector(".sidebar");
const toggle = body.querySelector(".toggle");
const modeSwitch = body.querySelector(".toggle-switch");
const modeText = body.querySelector(".mode-text");
const sidebarStateKey = "sidebarOpen";
const themeStateKey = "darkMode";

const applySidebarState = () => {
  if (!sidebar) return;
  const stored = appStorage.getItem(sidebarStateKey);
  if (stored === null) return;
  const shouldBeOpen = stored === "true";
  sidebar.classList.toggle("close", !shouldBeOpen);
};

applySidebarState();

const applyThemeState = () => {
  const stored = appStorage.getItem(themeStateKey);
  if (stored === null) return;
  const isDark = stored === "true";
  body.classList.toggle("dark", isDark);
  if (modeText) {
    modeText.innerText = isDark ? "Light Mode" : "Dark Mode";
  }
};

applyThemeState();

function getApiBase() {
  const explicit = (window.DPWH_API_BASE || "").trim();
  if (explicit) return explicit.replace(/\/$/, "");
  const host = window.location.hostname;
  const isLocal = host === "localhost" || host === "127.0.0.1";
  return isLocal ? `${window.location.protocol}//${host}:3000` : "";
}

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

// Navigation transition handlers
document.addEventListener('DOMContentLoaded', () => {
  (function () {
    const page = document.querySelector('section') || document.body;
    const current = window.location.pathname.split('/').pop() || 'documents.html';

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

// Table of contents accordion
document.addEventListener('DOMContentLoaded', () => {
  document.querySelectorAll('.toc-header').forEach(btn => {
    btn.addEventListener('click', () => {
      const section = btn.closest('.toc-section');
      if (!section) return;
      const isOpen = section.classList.toggle('open');
      btn.setAttribute('aria-expanded', isOpen ? 'true' : 'false');
      section.dataset.userOpen = isOpen ? 'true' : 'false';
    });
  });
});

const contractFilesKey = "contractFiles";
const contractFilesDataKey = "contractFilesData";
const compiledDocsKey = "compiledDocsByContractDoc";
const defaultDocStatusText = "Not compiled yet.";
const documentDisplayLabels = {
  Contract: "Contract Aggrement"
};
const apiBase = getApiBase();
const useRemoteStorage = Boolean(apiBase);
const remoteDocCache = new Map();
const SESSION_KEY = "dpwh_current_user";

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
const currentUserName = String(currentUser?.name || "").trim();
const isAdminUser = Boolean(currentUser?.isAdmin);
let allowedContracts = new Set();

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

function setAllowedContracts(list) {
  allowedContracts = new Set(list.map(normalizeContractId));
}

function canModifyContract(contractId) {
  if (isAdminUser) return true;
  return allowedContracts.has(normalizeContractId(contractId));
}

function loadContractFiles() {
  const raw = appStorage.getItem(contractFilesKey);
  if (!raw) return {};
  try {
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === "object" ? parsed : {};
  } catch (err) {
    return {};
  }
}

function saveContractFiles(data) {
  appStorage.setItem(contractFilesKey, JSON.stringify(data));
}

function loadContractFilesData() {
  const raw = appStorage.getItem(contractFilesDataKey);
  if (!raw) return {};
  try {
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === "object" ? parsed : {};
  } catch (err) {
    return {};
  }
}

function saveContractFilesData(data) {
  appStorage.setItem(contractFilesDataKey, JSON.stringify(data));
}

function getFileKey(section, contractId) {
  return `${section}:${String(contractId || "").trim().toUpperCase()}`;
}

function getCompiledKey(section, docName, contractId) {
  return `${String(section || "").trim()}:${String(docName || "").trim()}:${String(contractId || "").trim().toUpperCase()}`;
}

function loadCompiledDocs() {
  const raw = appStorage.getItem(compiledDocsKey);
  if (!raw) return {};
  try {
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === "object" ? parsed : {};
  } catch (err) {
    return {};
  }
}

function saveCompiledDocs(data) {
  appStorage.setItem(compiledDocsKey, JSON.stringify(data || {}));
}

function getCompiledEntry(section, docName, contractId) {
  const store = loadCompiledDocs();
  return store[getCompiledKey(section, docName, contractId)] || null;
}

function setCompiledEntry(section, docName, contractId, payload) {
  const store = loadCompiledDocs();
  store[getCompiledKey(section, docName, contractId)] = payload;
  saveCompiledDocs(store);
}

function removeCompiledEntry(section, docName, contractId) {
  const store = loadCompiledDocs();
  const key = getCompiledKey(section, docName, contractId);
  if (store[key]) {
    delete store[key];
    saveCompiledDocs(store);
  }
}

function normalizeContractId(value) {
  return String(value || "").trim().toUpperCase();
}

function buildDocIndex(list = []) {
  const index = {};
  list.forEach(item => {
    const section = item.section || "";
    const docName = item.docName || "";
    if (!section || !docName) return;
    if (!index[section]) index[section] = {};
    index[section][docName] = item;
  });
  return index;
}

async function fetchRemoteDocuments(contractId) {
  if (!useRemoteStorage) return null;
  const res = await fetch(`${apiBase}/api/documents/${encodeURIComponent(contractId)}`);
  const data = await res.json().catch(() => ({}));
  if (!res.ok || !data.success) {
    throw new Error(data?.error || "Failed to load documents.");
  }
  return data.documents || [];
}

async function ensureRemoteDocIndex(contractId) {
  if (!useRemoteStorage) return null;
  const key = normalizeContractId(contractId);
  if (remoteDocCache.has(key)) return remoteDocCache.get(key);
  const docs = await fetchRemoteDocuments(key);
  const index = buildDocIndex(docs);
  remoteDocCache.set(key, index);
  return index;
}

function applyRemoteDocState(subitem, entry) {
  if (!subitem) return;
  const status = subitem.querySelector(".toc-item-status");
  const actions = subitem.querySelector(".toc-item-actions");
  if (!actions) return;

  if (entry) {
    if (status) status.textContent = `File: ${entry.fileName || entry.name || "Uploaded"}`;
    let viewBtn = actions.querySelector(".toc-item-view");
    if (!viewBtn) {
      viewBtn = document.createElement("button");
      viewBtn.className = "toc-item-view";
      viewBtn.type = "button";
      viewBtn.dataset.doc = entry.docName || "";
      viewBtn.innerHTML = "<i class='bx bx-show'></i> View";
      actions.insertBefore(viewBtn, actions.firstChild);
    }
    viewBtn.dataset.url = entry.url || "";

    let deleteBtn = actions.querySelector(".toc-item-delete");
    if (!deleteBtn) {
      deleteBtn = document.createElement("button");
      deleteBtn.className = "toc-item-delete";
      deleteBtn.type = "button";
      deleteBtn.dataset.doc = entry.docName || "";
      deleteBtn.innerHTML = "<i class='bx bx-trash'></i> Delete";
      actions.appendChild(deleteBtn);
    }
  } else {
    if (status) status.textContent = defaultDocStatusText;
    actions.querySelector(".toc-item-view")?.remove();
    actions.querySelector(".toc-item-delete")?.remove();
  }
}

function applyCompiledState(subitem, section, contract, docName) {
  if (!subitem) return;
  const status = subitem.querySelector(".toc-item-status");
  const compiledInput = subitem.querySelector(".toc-item-compiled input[type=\"checkbox\"]");
  const entry = getCompiledEntry(section, docName, contract);
  const viewBtn = subitem.querySelector(".toc-item-view");
  const hasUploadedFile = Boolean(viewBtn);
  if (compiledInput) compiledInput.checked = Boolean(entry);
  if (!hasUploadedFile && entry && status) {
    const by = String(entry.by || "assigned user").trim();
    status.textContent = `Compiled. Ask ${by} for the file.`;
    status.classList.add("is-compiled");
  } else if (!hasUploadedFile && status) {
    status.textContent = defaultDocStatusText;
    status.classList.remove("is-compiled");
  } else if (status) {
    status.classList.remove("is-compiled");
  }
}

async function refreshPanelRemote(panel) {
  if (!useRemoteStorage || !panel) return;
  const section = panel.dataset.section || "";
  const contract = panel.dataset.contract || "";
  if (!section || !contract) return;

  let index = null;
  try {
    index = await ensureRemoteDocIndex(contract);
  } catch (err) {
    console.warn("Failed to load remote docs:", err);
    return;
  }
  const sectionDocs = index?.[section] || {};
  panel.querySelectorAll(".toc-subitem").forEach(subitem => {
    const docName = subitem.querySelector("input[type=\"file\"]")?.dataset.doc
      || subitem.querySelector(".subitem-title")?.textContent?.trim()
      || "";
    const entry = docName ? sectionDocs[docName] : null;
    applyRemoteDocState(subitem, entry || null);
    applyCompiledState(subitem, section, contract, docName);
  });
}

async function uploadRemoteDocument({ contractId, section, docName, file }) {
  const form = new FormData();
  form.append("contractId", contractId);
  form.append("section", section);
  form.append("docName", docName);
  form.append("file", file);
  const res = await fetch(`${apiBase}/api/upload-document`, {
    method: "POST",
    body: form
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok || !data.success) {
    throw new Error(data?.error || "Upload failed.");
  }
  return data.document;
}

async function deleteRemoteDocument({ contractId, section, docName }) {
  const res = await fetch(`${apiBase}/api/documents`, {
    method: "DELETE",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ contractId, section, docName })
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok || !data.success) {
    throw new Error(data?.error || "Delete failed.");
  }
  return true;
}

// Populate TOC with per-contract files
document.addEventListener('DOMContentLoaded', () => {
  const sections = {
    contracts: document.getElementById('tocContracts'),
    planning: document.getElementById('tocPlanning'),
    construction: document.getElementById('tocConstruction'),
    qa: document.getElementById('tocQa'),
    contractor: document.getElementById('tocContractor')
  };

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

  function renderEmpty(sectionEl) {
    if (!sectionEl) return;
    sectionEl.innerHTML = `<li class="toc-item" data-src="" tabindex="0">No contracts found</li>`;
  }

  function renderContracts(list) {
    Object.entries(sections).forEach(([key, sectionEl]) => {
      if (!sectionEl) return;
      sectionEl.innerHTML = '';
      list.forEach(contract => {
        const li = document.createElement('li');
        li.className = 'toc-item';
        li.innerHTML = `
          <button class="toc-item-toggle" type="button" aria-expanded="false">
            <span>${contract} - ${key === "contracts" ? "Contract File" : key === "planning" ? "Planning File" : key === "construction" ? "Construction File" : key === "qa" ? "Quality Assurance File" : "Contractor's File"}</span>
            <i class='bx bx-chevron-down'></i>
          </button>
          <div class="toc-item-panel" data-section="${key}" data-contract="${contract}">
            <ul class="toc-subitems">
              ${(sectionDocs[key] || []).map(doc => {
                const fileKey = getFileKey(`${key}:${doc}`, contract);
                const fileStore = useRemoteStorage ? {} : loadContractFiles();
                const fileData = useRemoteStorage ? {} : loadContractFilesData();
                const currentFile = useRemoteStorage ? "" : (fileStore[fileKey] || "");
                const hasFileData = useRemoteStorage ? false : Boolean(fileData[fileKey]?.dataUrl);
                const displayDoc = documentDisplayLabels[doc] || doc;
                return `
                  <li class="toc-subitem">
                    <div class="toc-item-info">
                      <div class="subitem-title">${displayDoc}</div>
                      <div class="toc-item-status">${currentFile ? `File: ${currentFile}` : defaultDocStatusText}</div>
                      <label class="toc-item-compiled toc-item-compiled-left" title="Mark as compiled">
                        <input type="checkbox" data-doc="${doc}">
                        <span>Compiled</span>
                      </label>
                    </div>
                    <div class="toc-item-actions">
                      ${hasFileData ? `
                        <button class="toc-item-view" type="button" data-doc="${doc}">
                          <i class='bx bx-show'></i>
                          View
                        </button>
                      ` : ""}
                      <label class="toc-item-upload">
                        <i class='bx bx-upload'></i>
                        Upload File
                        <input type="file" data-doc="${doc}" hidden>
                      </label>
                      ${currentFile ? `
                        <button class="toc-item-delete" type="button" data-doc="${doc}">
                          <i class='bx bx-trash'></i>
                          Delete
                        </button>
                      ` : ""}
                    </div>
                  </li>
                `;
              }).join("")}
            </ul>
          </div>
        `;
        sectionEl.appendChild(li);
      });
      if (!list.length) renderEmpty(sectionEl);
    });
    document.querySelectorAll(".toc-item-panel").forEach(panel => {
      const section = panel.dataset.section || "";
      const contract = panel.dataset.contract || "";
      panel.querySelectorAll(".toc-subitem").forEach(subitem => {
        const doc = subitem.querySelector(".toc-item-compiled input[type=\"checkbox\"]")?.dataset.doc || "";
        if (!doc) return;
        applyCompiledState(subitem, section, contract, doc);
      });
    });
  }

  function openSectionFromDashboard() {
    const target = sessionStorage.getItem("docsSection");
    if (!target) return;
    sessionStorage.removeItem("docsSection");
    const section = document.querySelector(`.toc-section[data-section="${target}"]`);
    if (!section) return;
    section.classList.add("open");
    section.dataset.userOpen = "true";
    const header = section.querySelector(".toc-header");
    header?.setAttribute("aria-expanded", "true");
    section.scrollIntoView({ behavior: "smooth", block: "start" });
  }

document.addEventListener("click", async (e) => {
    const toggle = e.target.closest(".toc-item-toggle");
    if (toggle) {
      const panel = toggle.parentElement?.querySelector(".toc-item-panel");
      const isOpen = panel?.classList.toggle("open");
      toggle.setAttribute("aria-expanded", isOpen ? "true" : "false");
      if (isOpen && panel) {
        refreshPanelRemote(panel);
      }
      return;
    }

    const uploadLabel = e.target.closest(".toc-item-upload");
    if (uploadLabel) {
      // Let the native label/input behavior open the file picker.
      return;
    }

    const viewBtn = e.target.closest(".toc-item-view");
    if (viewBtn) {
      const panel = viewBtn.closest(".toc-item-panel");
      if (!panel) return;
      const section = panel.dataset.section || "";
      const contract = panel.dataset.contract || "";
      const doc = viewBtn.dataset.doc || "";
      if (useRemoteStorage) {
        let url = viewBtn.dataset.url || "";
        if (!url) {
          try {
            const index = await ensureRemoteDocIndex(contract);
            const entry = index?.[section]?.[doc];
            url = entry?.url || "";
            if (url) viewBtn.dataset.url = url;
          } catch (err) {
            console.warn("Failed to load remote document:", err);
          }
        }
        if (url) {
          window.open(url, "_blank");
        } else {
          alert("File URL not found.");
        }
      } else {
        const fileKey = getFileKey(`${section}:${doc}`, contract);
        const fileData = loadContractFilesData();
        const file = fileData[fileKey];
        if (file?.dataUrl) {
          window.open(file.dataUrl, "_blank");
        } else {
          alert("File data not found.");
        }
      }
      return;
    }

    const deleteBtn = e.target.closest(".toc-item-delete");
    if (deleteBtn) {
      const panel = deleteBtn.closest(".toc-item-panel");
      if (!panel) return;
      const section = panel.dataset.section || "";
      const contract = panel.dataset.contract || "";
      if (!canModifyContract(contract)) {
        alert("You don't have permission to modify this project.");
        return;
      }
      const doc = deleteBtn.dataset.doc || "";
      const subitem = deleteBtn.closest(".toc-subitem");
      if (useRemoteStorage) {
        try {
          await deleteRemoteDocument({ contractId: contract, section, docName: doc });
          removeCompiledEntry(section, doc, contract);
          remoteDocCache.delete(normalizeContractId(contract));
          await refreshPanelRemote(panel);
        } catch (err) {
          alert(err.message || "Delete failed.");
        }
      } else {
        const fileKey = getFileKey(`${section}:${doc}`, contract);
        const fileStore = loadContractFiles();
        const fileData = loadContractFilesData();
        if (fileStore[fileKey]) {
          delete fileStore[fileKey];
          saveContractFiles(fileStore);
        }
        if (fileData[fileKey]) {
          delete fileData[fileKey];
          saveContractFilesData(fileData);
        }
        removeCompiledEntry(section, doc, contract);
        const status = subitem?.querySelector(".toc-item-status");
        if (status) status.textContent = defaultDocStatusText;
        const view = subitem?.querySelector(".toc-item-view");
        view?.remove();
        deleteBtn.remove();
        applyCompiledState(subitem, section, contract, doc);
      }
      return;
    }
  });

  document.addEventListener("change", (e) => {
    const compiledInput = e.target.closest(".toc-item-compiled input[type=\"checkbox\"]");
    if (compiledInput) {
      const panel = compiledInput.closest(".toc-item-panel");
      const subitem = compiledInput.closest(".toc-subitem");
      if (!panel || !subitem) return;
      const section = panel.dataset.section || "";
      const contract = panel.dataset.contract || "";
      const doc = compiledInput.dataset.doc || "";
      const by = String(currentUserName || currentUser?.name || "this user").trim();
      if (compiledInput.checked) {
        setCompiledEntry(section, doc, contract, {
          by,
          checkedAt: new Date().toISOString()
        });
      } else {
        removeCompiledEntry(section, doc, contract);
        const hasUploadedFile = Boolean(subitem.querySelector(".toc-item-view"));
        if (!hasUploadedFile) {
          const status = subitem.querySelector(".toc-item-status");
          if (status) {
            status.textContent = defaultDocStatusText;
            status.classList.remove("is-compiled");
          }
        }
      }
      applyCompiledState(subitem, section, contract, doc);
      return;
    }

    const input = e.target.closest(".toc-item-upload input[type=\"file\"]");
    if (!input) return;
    const panel = input.closest(".toc-item-panel");
    if (!panel) return;
    const section = panel.dataset.section || "";
    const contract = panel.dataset.contract || "";
    if (!canModifyContract(contract)) {
      alert("You don't have permission to upload documents for this project.");
      input.value = "";
      return;
    }
    const file = input.files?.[0];
    if (!file) return;
    const doc = input.dataset.doc || "";

    const subitem = input.closest(".toc-subitem");
    const status = subitem?.querySelector(".toc-item-status");
    if (status) status.textContent = "Uploading 0%";

    if (useRemoteStorage) {
      uploadRemoteDocument({
        contractId: contract,
        section,
        docName: doc,
        file
      })
        .then(() => {
          const by = String(currentUserName || currentUser?.name || "this user").trim();
          setCompiledEntry(section, doc, contract, {
            by,
            checkedAt: new Date().toISOString()
          });
          remoteDocCache.delete(normalizeContractId(contract));
          return refreshPanelRemote(panel);
        })
        .catch(err => {
          if (status) status.textContent = err.message || "Upload failed.";
        })
        .finally(() => {
          input.value = "";
        });
      return;
    }

    const fileStore = loadContractFiles();
    const fileData = loadContractFilesData();
    const key = getFileKey(`${section}:${doc}`, contract);
    fileStore[key] = file.name;

    const reader = new FileReader();
    reader.onprogress = (evt) => {
      if (!evt.lengthComputable) return;
      const percent = Math.min(100, Math.round((evt.loaded / evt.total) * 100));
      if (status) status.textContent = `Uploading ${percent}%`;
    };
    reader.onload = () => {
      fileData[key] = {
        name: file.name,
        type: file.type || "",
        dataUrl: reader.result
      };
      saveContractFiles(fileStore);
      saveContractFilesData(fileData);
      const by = String(currentUserName || currentUser?.name || "this user").trim();
      setCompiledEntry(section, doc, contract, {
        by,
        checkedAt: new Date().toISOString()
      });

      if (status) status.textContent = `File: ${file.name}`;
      status?.classList.remove("is-compiled");
      const actions = subitem?.querySelector(".toc-item-actions");
      const existingDelete = actions?.querySelector(".toc-item-delete");
      if (actions && !existingDelete) {
        const btn = document.createElement("button");
        btn.className = "toc-item-delete";
        btn.type = "button";
        btn.dataset.doc = doc;
        btn.innerHTML = "<i class='bx bx-trash'></i> Delete";
        actions.appendChild(btn);
      }
      const existingView = actions?.querySelector(".toc-item-view");
      if (actions && !existingView) {
        const viewBtn = document.createElement("button");
        viewBtn.className = "toc-item-view";
        viewBtn.type = "button";
        viewBtn.dataset.doc = doc;
        viewBtn.innerHTML = "<i class='bx bx-show'></i> View";
        actions?.insertBefore(viewBtn, actions.firstChild);
      }
      applyCompiledState(subitem, section, contract, doc);
    };
    reader.onerror = () => {
      if (status) status.textContent = "Upload failed.";
    };
    reader.readAsDataURL(file);
    input.value = "";
  });

  if (!apiBase) {
    Object.values(sections).forEach(renderEmpty);
    openSectionFromDashboard();
    return;
  }

  fetch(`${apiBase}/api/get-projects`)
    .then(res => res.json())
    .then(data => {
      if (!data.success) throw new Error('Failed');
      const projects = data.projects || [];
      const visibleProjects = isAdminUser ? projects : projects.filter(p => {
        const inCharge = {
          projectEngineer: p["PROJECT ENGINEER"] || "",
          materialsEngineer: p["MATERIALS ENGINEER"] || "",
          projectInspector: p["PROJECT INSPECTOR"] || "",
          residentEngineer: p["RESIDENT ENGINEER"] || "",
          qaInCharge: p["QUALITY ASSURANCE IN-CHARGE"] || "",
          contractorMaterialsEngineer: p["CONTRACTORS MATERIALS ENGINEER"] || ""
        };
        return isUserInCharge(inCharge);
      });
      const contracts = visibleProjects.map(p => String(p['CONTRACT ID'] || '').trim()).filter(Boolean);
      setAllowedContracts(contracts);
      renderContracts(contracts);
      openSectionFromDashboard();
    })
    .catch(() => {
      Object.values(sections).forEach(renderEmpty);
      openSectionFromDashboard();
    });
});

// Table of contents search
document.addEventListener('DOMContentLoaded', () => {
  const search = document.getElementById('tocSearch');
  if (!search) return;

  const sections = Array.from(document.querySelectorAll('.toc-section'));

  sections.forEach(section => {
    if (!section.dataset.userOpen) {
      section.dataset.userOpen = section.classList.contains('open') ? 'true' : 'false';
    }
  });

  function resetToUserState() {
    sections.forEach(section => {
      const isOpen = section.dataset.userOpen === 'true';
      section.classList.toggle('open', isOpen);
      const header = section.querySelector('.toc-header');
      header?.setAttribute('aria-expanded', isOpen ? 'true' : 'false');
      section.querySelectorAll('.toc-items li').forEach(li => {
        li.style.display = '';
      });
    });
  }

  search.addEventListener('input', () => {
    const query = search.value.trim().toLowerCase();
    if (!query) {
      resetToUserState();
      return;
    }

    sections.forEach(section => {
      let matches = 0;
      section.querySelectorAll('.toc-items li').forEach(li => {
        const text = li.textContent.trim().toLowerCase();
        const isMatch = text.includes(query);
        li.style.display = isMatch ? '' : 'none';
        if (isMatch) matches += 1;
      });

      const shouldOpen = matches > 0;
      section.classList.toggle('open', shouldOpen);
      const header = section.querySelector('.toc-header');
      header?.setAttribute('aria-expanded', shouldOpen ? 'true' : 'false');
    });
  });
});
