const body = document.querySelector("body")
const sidebar = body.querySelector(".sidebar")
const toggle = body.querySelector(".toggle")
const modeSwitch = body.querySelector(".toggle-switch")
const modeText = body.querySelector(".mode-text")
const sidebarStateKey = "sidebarOpen"
const themeStateKey = "darkMode"

const applySidebarState = () => {
    const stored = appStorage.getItem(sidebarStateKey)
    if (stored === null) return
    const shouldBeOpen = stored === "true"
    sidebar.classList.toggle("close", !shouldBeOpen)
}

applySidebarState()

const applyThemeState = () => {
    const stored = appStorage.getItem(themeStateKey)
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
const isAdminUser = Boolean(
    currentUser?.isAdmin
    || currentUser?.isSuperAdmin
    || currentUser?.role === "admin"
    || currentUser?.role === "superadmin"
    || window.DPWH_IS_ADMIN
    || window.DPWH_IS_SUPERADMIN
);
const NOTIF_PREFIX = "dpwh_notifications_";

function normalizePersonName(value) {
    return String(value || "").trim().toLowerCase();
}

function toAllCaps(value) {
    return String(value || "").trim().toUpperCase();
}

function splitNames(value) {
    return String(value || "")
        .split(/[,/;&]+|\band\b/gi)
        .map(part => part.trim())
        .filter(Boolean);
}

function userMatchesName(value) {
    if (!currentUserName) return false;
    const normalizeName = (name) => String(name || "")
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .replace(/[^a-zA-Z0-9\s]/g, " ")
        .toLowerCase()
        .replace(/\s+/g, " ")
        .trim();
    const toTokens = (name) => normalizeName(name)
        .split(" ")
        .filter(token => token.length > 1);

    const target = normalizeName(currentUserName);
    const targetTokens = toTokens(currentUserName);
    const candidates = splitNames(value);

    return candidates.some(name => {
        const candidate = normalizeName(name);
        if (!candidate) return false;
        if (candidate === target) return true;
        if (candidate.includes(target) || target.includes(candidate)) return true;

        const candidateTokens = toTokens(name);
        if (!targetTokens.length || !candidateTokens.length) return false;
        return targetTokens.every(token => candidateTokens.includes(token))
            || candidateTokens.every(token => targetTokens.includes(token));
    });
}

function isUserInCharge(inChargeData) {
    if (isAdminUser) return true;
    if (!currentUserName || !inChargeData) return false;
    return Object.values(inChargeData).some(value => userMatchesName(value));
}

function getRowInCharge(row) {
    if (!row) return {};
    try {
        return row.dataset.inCharge ? JSON.parse(row.dataset.inCharge) : {};
    } catch (err) {
        return {};
    }
}

function getProjectPermissions(inChargeData) {
    const inCharge = isUserInCharge(inChargeData);
    return {
        canView: isAdminUser || inCharge,
        canUpdate: isAdminUser || inCharge,
        canEdit: isAdminUser,
        canDelete: isAdminUser
    };
}

function getNotificationKey() {
    const email = String(currentUser?.email || "guest").trim().toLowerCase();
    return `${NOTIF_PREFIX}${email || "guest"}`;
}

function loadNotifications() {
    const raw = appStorage.getItem(getNotificationKey());
    if (!raw) return [];
    try {
        const parsed = JSON.parse(raw);
        return Array.isArray(parsed) ? parsed : [];
    } catch (err) {
        return [];
    }
}

function saveNotifications(list) {
    appStorage.setItem(getNotificationKey(), JSON.stringify(list));
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
    setTimeout(() => toast.classList.add("show"), 10);
    setTimeout(() => {
        toast.classList.remove("show");
        setTimeout(() => toast.remove(), 300);
    }, 3800);
}

function addNotification(message, meta = {}) {
    const list = loadNotifications();
    list.unshift({
        id: `${Date.now()}-${Math.random().toString(16).slice(2, 8)}`,
        message,
        createdAt: new Date().toISOString(),
        ...meta
    });
    saveNotifications(list.slice(0, 50));
    showToast(message, "success");
}

const engineersStorageKey = "engineersDirectory";
const engineersApiBase = getApiBase();
const engineersApiEndpoint = engineersApiBase ? `${engineersApiBase}/api/engineers` : "";

function escapeHtml(value) {
    return String(value || "")
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#39;");
}

function normalizeEngineerRole(role) {
    const value = String(role || "").trim();
    if (!value) return "";
    const lower = value.toLowerCase();
    if (lower === "project engineer" || lower === "project engineers") return "Project Engineer";
    if (lower === "materials engineer" || lower === "materials engineers") return "Materials Engineer";
    if (lower === "provisional engineer" || lower === "provisional engineers") return "Project Inspector";
    if (lower === "project inspector" || lower === "project inspectors") return "Project Inspector";
    if (lower === "resident engineer" || lower === "resident engineers") return "Resident Engineer";
    if (lower === "qa in-charge" || lower === "qa in charge" || lower === "qa in-charges") return "QA In-Charge";
    if (lower === "contractor materials engineer" || lower === "contractors materials engineer") return "Contractor Materials Engineer";
    if (lower === "contractor's materials engineer" || lower === "contractors materials engineers") return "Contractor Materials Engineer";
    return value;
}

async function syncEngineersDirectory() {
    if (!engineersApiEndpoint) return;
    try {
        const res = await fetch(engineersApiEndpoint);
        if (!res.ok) throw new Error(`Status ${res.status}`);
        const data = await res.json();
        if (Array.isArray(data?.engineers)) {
            appStorage.setItem(engineersStorageKey, JSON.stringify(data.engineers));
        }
    } catch (err) {
        console.warn("Engineer directory sync failed:", err);
    }
}

function getEngineersFromStorage() {
    const raw = appStorage.getItem(engineersStorageKey);
    if (!raw) return [];
    try {
        const parsed = JSON.parse(raw);
        if (!Array.isArray(parsed)) return [];
        return parsed
            .map(item => {
                if (typeof item === "string") {
                    return { name: item, role: "", phone: "", facebook: "", accreditation: "" };
                }
                return {
                    name: item?.name || "",
                    role: item?.role || "",
                    designation: item?.designation || "",
                    phone: item?.phone || "",
                    facebook: item?.facebook || "",
                    accreditation: item?.accreditation || ""
                };
            })
            .map(item => ({
                ...splitDesignationAccreditation(item.designation, item.accreditation),
                name: String(item.name || "").trim(),
                role: normalizeEngineerRole(item.role),
                phone: String(item.phone || "").trim(),
                facebook: String(item.facebook || "").trim()
            }))
            .filter(item => item.name);
    } catch (err) {
        return [];
    }
}

function populateDatalist(listId, names) {
    const listEl = document.getElementById(listId);
    if (!listEl) return;
    const unique = Array.from(new Set(names))
        .sort((a, b) => a.localeCompare(b));
    listEl.innerHTML = unique.map(name => `<option value="${escapeHtml(name)}"></option>`).join("");
}

function populateEngineerDatalists() {
    const engineers = getEngineersFromStorage();
    const lists = {
        projectEngineerList: [],
        materialsEngineerList: [],
        projectInspectorList: [],
        residentEngineerList: [],
        qaInChargeList: [],
        contractorMaterialsEngineerList: []
    };

    engineers.forEach(engineer => {
        const name = engineer.name;
        const role = engineer.role || "Project Engineer";
        switch (role) {
            case "Materials Engineer":
                lists.materialsEngineerList.push(name);
                break;
            case "Project Inspector":
                lists.projectInspectorList.push(name);
                break;
            case "Resident Engineer":
                lists.residentEngineerList.push(name);
                break;
            case "QA In-Charge":
                lists.qaInChargeList.push(name);
                break;
            case "Contractor Materials Engineer":
                lists.contractorMaterialsEngineerList.push(name);
                break;
            default:
                lists.projectEngineerList.push(name);
                break;
        }
    });

    populateDatalist("projectEngineerList", lists.projectEngineerList);
    populateDatalist("materialsEngineerList", lists.materialsEngineerList);
    populateDatalist("projectInspectorList", lists.projectInspectorList);
    populateDatalist("residentEngineerList", lists.residentEngineerList);
    populateDatalist("qaInChargeList", lists.qaInChargeList);
    populateDatalist("contractorMaterialsEngineerList", lists.contractorMaterialsEngineerList);
}

populateEngineerDatalists();

const emptyMark = "\u2014";

function normalizeNameKey(value) {
    return String(value || "").trim().toLowerCase();
}

function splitDesignationAccreditation(designation, accreditation) {
    const rawDesignation = String(designation || "").trim();
    const rawAccreditation = String(accreditation || "").trim();
    if (rawDesignation) return { designation: rawDesignation, accreditation: rawAccreditation };
    const looksLikeAccreditationCode = /^#?[A-Z0-9-]{4,}$/i.test(rawAccreditation);
    return looksLikeAccreditationCode
        ? { designation: "", accreditation: rawAccreditation }
        : { designation: rawAccreditation, accreditation: "" };
}

function findEngineerByName(name, engineers, preferredRole = "") {
    if (!name) return null;
    const key = normalizeNameKey(name);
    const matches = engineers.filter(engineer => normalizeNameKey(engineer.name) === key);
    if (!matches.length) return null;
    const targetRole = normalizeNameKey(preferredRole);
    if (targetRole) {
        const byRole = matches.find(engineer => normalizeNameKey(engineer.role) === targetRole);
        if (byRole) return byRole;
    }
    return matches[0];
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

function renderEngineerDetails(containerId, engineerName, directory, preferredRole = "") {
    const container = document.getElementById(containerId);
    if (!container) return;
    container.innerHTML = "";

    const nameEl = document.createElement("div");
    nameEl.className = "engineer-name";
    const displayName = String(engineerName || "").trim();
    nameEl.textContent = displayName || emptyMark;
    container.appendChild(nameEl);

    if (!displayName) return;

    const engineer = findEngineerByName(displayName, directory || [], preferredRole);

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

    const designation = document.createElement("div");
    designation.className = "engineer-accreditation";
    const desIcon = document.createElement("i");
    desIcon.className = "bx bx-id-card";
    const desText = document.createElement("span");
    desText.textContent = `Designation: ${engineer?.designation || emptyMark}`;
    designation.appendChild(desIcon);
    designation.appendChild(desText);
    meta.appendChild(designation);

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

function applyDetailsPermissions(canEdit) {
    currentDetailsCanEdit = Boolean(canEdit);
    if (addPowDetailsItemBtn) {
        addPowDetailsItemBtn.disabled = !currentDetailsCanEdit;
        addPowDetailsItemBtn.title = currentDetailsCanEdit ? "" : "View only";
    }
    if (openVariationOrderBtn) {
        openVariationOrderBtn.disabled = !currentDetailsCanEdit;
        openVariationOrderBtn.title = currentDetailsCanEdit ? "" : "View only";
    }
}

toggle.addEventListener("click", () => {
    sidebar.classList.toggle("close");
    const isOpen = !sidebar.classList.contains("close")
    appStorage.setItem(sidebarStateKey, String(isOpen))
});

modeSwitch.addEventListener("click", () => {
    body.classList.toggle("dark");
    const isDark = body.classList.contains("dark")
    appStorage.setItem(themeStateKey, String(isDark))
    if (modeText) {
        modeText.innerText = isDark ? "Light Mode" : "Dark Mode"
    }
});

// -------------------------------------------------------------------------------------------------
// MODAL LOGIC
// -------------------------------------------------------------------------------------------------
const modal = document.getElementById("addProjectModal");
const openBtn = document.getElementById("openAddProject");
const closeBtn = document.getElementById("closeAddProject");
const modalTitle = document.getElementById("modalTitle");
const updateModal = document.getElementById("updateProjectModal");
const closeUpdateBtn = document.getElementById("closeUpdateProject");
const cancelUpdateBtn = document.getElementById("cancelUpdateBtn");
const saveUpdateBtn = document.getElementById("saveUpdateBtn");
const updateStatusInput = document.getElementById("updateStatus");
const updateProgressInput = document.getElementById("updateProgress");
const updateDateInput = document.getElementById("updateDate");
let updatingRow = null;
const downloadContractBtn = document.getElementById("downloadContractInfo");
let currentDetailsData = null;
const getDirectionsBtn = document.getElementById("getDirectionsBtn");
const revisedContractAmountInput = document.getElementById("revisedContractAmount");
const revisedContractAmountContainer = document.getElementById("revisedContractAmountContainer");
const toggleRevisedContractAmountBtn = document.getElementById("toggleRevisedContractAmount");
const revisedPowBody = document.getElementById("revisedPowBody");
const addRevisedPowRowBtn = document.getElementById("addRevisedPowRow");
const openVariationOrderBtn = document.getElementById("openVariationOrder");
const toggleRevisedExpirationBtn = document.getElementById("toggleRevisedExpiration");
const revisedExpirationContainer = document.getElementById("revisedExpirationContainer");

const step1 = document.querySelector(".step-1");
const step2 = document.querySelector(".step-2");
const nextBtn = document.getElementById("nextBtn");
const backBtn = document.getElementById("backBtn");
const cancelBtn = document.getElementById("cancelBtn");
const saveBtn = document.getElementById("saveBtn");
const draftStorageKey = "projectDraft";
let isEditMode = false;
let editingRow = null;
let editingContractId = null;
let isSavingProject = false;
let saveProjectToken = 0;
const addPowDetailsItemBtn = document.getElementById("addPowDetailsItem");
const powVariationContainer = document.getElementById("powVariationContainer");
let currentDetailsCanEdit = false;

if (openBtn && !isAdminUser) {
    openBtn.style.display = "none";
}
const draftFieldIds = [
    "contractId",
    "contractDescription",
    "contractor",
    "appropriation",
    "approvedBudgetCost",
    "contractCost",
    "startDate",
    "expirationDate",
    "projectLocation",
    "projectLimits",
    "projectCoordinates",
    "projectEngineer",
    "materialsEngineer",
    "projectInspector",
    "residentEngineer",
    "qaInCharge",
    "contractorMaterialsEngineer"
];

function getDraftFieldValue(id) {
    const el = document.getElementById(id);
    return el ? el.value : "";
}

function setDraftFieldValue(id, value) {
    const el = document.getElementById(id);
    if (!el) return;
    el.value = value === undefined || value === null ? "" : value;
}

function saveDraft() {
    if (!modal) return;
    if (isEditMode) return;
    const data = {
        fields: {},
        category: modalCategoryLabel ? modalCategoryLabel.textContent.trim() : "",
        step: step2.classList.contains("active") ? 2 : 1
    };

    draftFieldIds.forEach(id => {
        data.fields[id] = getDraftFieldValue(id);
    });

    appStorage.setItem(draftStorageKey, JSON.stringify(data));
}

function loadDraft() {
    if (!modal) return;
    const raw = appStorage.getItem(draftStorageKey);
    if (!raw) return;

    let data;
    try {
        data = JSON.parse(raw);
    } catch (err) {
        return;
    }

    if (!data || !data.fields) return;

    draftFieldIds.forEach(id => {
        setDraftFieldValue(id, data.fields[id]);
    });

    if (data.category && modalCategoryLabel && modalCategoryPill) {
        const categoryText = data.category.trim();
        modalCategoryLabel.textContent = categoryText;
        modalCategoryPill.querySelectorAll(".cat-option").forEach(option => {
            const text = option.textContent.trim();
            option.classList.toggle("active", text === categoryText);
        });
    }

    if (data.step === 2) {
        showStep2();
    } else {
        showStep1();
    }
}

function clearDraft() {
    appStorage.removeItem(draftStorageKey);
}

function bindDraftListeners() {
    draftFieldIds.forEach(id => {
        const el = document.getElementById(id);
        if (!el) return;
        el.addEventListener("input", saveDraft);
        el.addEventListener("change", saveDraft);
    });
}

function setModalMode(edit, row = null) {
    isEditMode = edit;
    editingRow = edit ? row : null;
    const strongId = row?.querySelector("strong")?.innerText?.trim() || "";
    editingContractId = edit ? (row?.dataset.contractId || strongId || "") : null;
    if (modal) {
        modal.dataset.mode = edit ? "edit" : "add";
        modal.dataset.powKey = edit ? (row?.dataset.contractId || strongId || "") : "";
    }
    if (modalTitle) {
        modalTitle.textContent = edit ? "Edit Project" : "Add New Project";
    }
    if (saveBtn) {
        saveBtn.textContent = edit ? "Save Changes" : "Save Project";
    }
}

// --------------------
// OPEN MODAL
// --------------------
openBtn?.addEventListener("click", () => {
    if (!isAdminUser) {
        alert("Only the admin can add new projects.");
        return;
    }
    populateEngineerDatalists();
    setModalMode(false);
    resetModal();
    modal.classList.add("open");
    loadDraft();
});

// --------------------
// CLOSE MODAL
// --------------------
closeBtn?.addEventListener("click", closeModal);
cancelBtn?.addEventListener("click", () => {
    if (!isEditMode) {
        clearDraft();
    }
    resetModal();
    closeModal();
});

function closeModal() {
    modal.classList.remove("open");
    setModalMode(false);
}

function openUpdateModal(row) {
    if (!updateModal || !row) return;
    updatingRow = row;
    const data = getRowDataFromRow(row);
    if (updateStatusInput) updateStatusInput.value = data.status || "";
    if (updateProgressInput) updateProgressInput.value = parsePercent(data.accomplishment);
    if (updateDateInput) updateDateInput.value = data.completionDate || "";
    initRevisedExpirationDates(data.revisedExpirationDates || []);
    updateModal.dataset.contractId = normalizeContractId(data.contractId);
    if (revisedContractAmountInput) revisedContractAmountInput.value = data.revisedContractAmount || "";
    if (revisedContractAmountContainer) {
        const hasValue = Boolean(String(data.revisedContractAmount || "").trim());
        revisedContractAmountContainer.classList.toggle("hidden", !hasValue);
    }
    initRevisedPow(data.revisedProgramWorks || []);
    updateModal.classList.add("open");
}

function closeUpdateModal() {
    if (!updateModal) return;
    updateModal.classList.remove("open");
    updatingRow = null;
    if (updateStatusInput) updateStatusInput.value = "";
    if (updateProgressInput) updateProgressInput.value = "";
    if (updateDateInput) updateDateInput.value = "";
    initRevisedExpirationDates([]);
    if (revisedContractAmountInput) revisedContractAmountInput.value = "";
    if (revisedContractAmountContainer) revisedContractAmountContainer.classList.add("hidden");
    updateModal.dataset.contractId = "";
}

// --------------------
// STEP CONTROLS
// --------------------
function showStep1() {
    step1.classList.add("active");
    step2.classList.remove("active");

    backBtn.classList.add("hidden");
    saveBtn.classList.add("hidden");
    nextBtn.classList.remove("hidden");
}

function showStep2() {
    step1.classList.remove("active");
    step2.classList.add("active");

    backBtn.classList.remove("hidden");
    saveBtn.classList.remove("hidden");
    nextBtn.classList.add("hidden");
}

nextBtn?.addEventListener("click", () => {
    if (step1.classList.contains("active")) {
        showStep2();
    }
    saveDraft();
});
backBtn?.addEventListener("click", () => {
    if (step2.classList.contains("active")) {
        showStep1();
    }
    saveDraft();
});

// --------------------
// RESET WIZARD STATE
// --------------------
function resetWizard() {
    // Reset steps
    step1.classList.add("active");
    step2.classList.remove("active");

    // Reset buttons
    backBtn.classList.add("hidden");
    saveBtn.classList.add("hidden");
    nextBtn.classList.remove("hidden");

    // OPTIONAL: clear only Step 2 fields if you want
    step2.querySelectorAll("input").forEach(i => i.value = "");
}

bindDraftListeners();
const contractIdInput = document.getElementById("contractId");
contractIdInput?.addEventListener("input", () => {
    if (!modal) return;
    modal.dataset.powKey = contractIdInput.value || "";
});

function ensurePowForEditing(row) {
    if (!row) return;
    const strongId = row.querySelector("strong")?.innerText?.trim() || "";
    const data = getRowDataFromRow(row);
    const key = normalizeContractId(data.contractId || strongId || editingContractId || "");
    if (!key) return;
    const stored = getProjectPow(key);
    if (stored && stored.length) {
        row.dataset.programWorks = JSON.stringify(stored);
    }
}


function formatQuantity(value) {
    const raw = String(value || "").replace(/,/g, "").trim();
    if (raw === "") return "";
    const num = Number(raw);
    if (Number.isNaN(num)) return value;
    return num.toLocaleString("en-PH", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

revisedPowBody?.addEventListener("blur", (e) => {
    const input = e.target;
    if (!(input instanceof HTMLInputElement)) return;
    if (!input.classList.contains("pow-qty")) return;
    input.value = formatQuantity(input.value);
}, true);

revisedPowBody?.addEventListener("focus", (e) => {
    const input = e.target;
    if (!(input instanceof HTMLInputElement)) return;
    if (!input.classList.contains("pow-qty")) return;
    input.value = input.value.replace(/,/g, "");
}, true);

// --------------------
// ESC CLOSE
// --------------------
document.addEventListener("keydown", (e) => {
    if (e.key === "Escape" && modal.classList.contains("open")) {
        closeModal();
    }
});

closeUpdateBtn?.addEventListener("click", closeUpdateModal);
cancelUpdateBtn?.addEventListener("click", closeUpdateModal);
document.addEventListener("keydown", (e) => {
    if (e.key === "Escape" && updateModal?.classList.contains("open")) {
        closeUpdateModal();
    }
});

saveUpdateBtn?.addEventListener("click", (event) => {
    event.preventDefault();
    event.stopPropagation();
    const contractId = (updateModal?.dataset.contractId || "").trim();
    if (!contractId) {
        alert("Missing contract ID.");
        return;
    }

    const status = updateStatusInput?.value.trim() || "";
    const accomplishment = parsePercent(updateProgressInput?.value || 0);
    const latestDate = updateDateInput?.value || "";
    const revisedExpirationDates = collectRevisedExpirationDates();
    const revisedContractAmount = revisedContractAmountInput?.value.trim() || "";
    const revisedProgramWorks = collectRevisedPow();

    let targetRow = updatingRow || findRowByContractId(contractId);
    if (!targetRow) {
        alert("Unable to find the row to update.");
        return;
    }

    const updatePerms = getProjectPermissions(getRowInCharge(targetRow));
    if (!updatePerms.canUpdate) {
        alert("You don't have permission to update this project.");
        return;
    }

    const rowData = getRowDataFromRow(targetRow);
    rowData.status = status;
    rowData.accomplishment = accomplishment;
    rowData.completionDate = latestDate || rowData.completionDate;
    rowData.revisedExpirationDates = revisedExpirationDates;
    rowData.revisedContractAmount = revisedContractAmount;
    rowData.revisedProgramWorks = revisedProgramWorks;
    setRowDataAttributes(targetRow, rowData);

    targetRow.cells[3].innerHTML = renderProgressPill(accomplishment);
    targetRow.cells[4].textContent = status || "-";
    targetRow.cells[5].textContent = getCompletionDisplay(accomplishment, rowData.completionDate);
    setUpdateOverride(contractId, {
        status,
        accomplishment,
        completionDate: rowData.completionDate,
        remarks: "",
        revisedContractAmount,
        revisedProgramWorks,
        revisedExpirationDates
    });

    if (!updateEndpoint) {
        alert("Backend is not configured. Set your API base URL in config.js.");
        return;
    }

    fetch(`${updateEndpoint}/${encodeURIComponent(contractId)}`, {
        method: "PUT",
        headers: {
            "Content-Type": "application/json"
        },
        body: JSON.stringify({
            contractId,
            status,
            accomplishment,
            completionDate: rowData.completionDate,
            revisedExpirationDates
        })
    })
    .then(response => response.json())
    .then(data => {
        if (!data.success) {
            throw new Error(data.error || "Failed to update project.");
        }
        closeUpdateModal();
    })
    .catch(err => {
        alert(`Error updating project: ${err.message}`);
    });
});



// -------------------------------------------------------------------------------------------------
// CONTRACT COST FORMATTER (PHP + comma + 2 decimals)
// -------------------------------------------------------------------------------------------------
const pesoSign = "\u20B1";
const costInput = document.getElementById("contractCost");

if (costInput) {

    // Allow typing decimals naturally
    costInput.addEventListener("input", () => {
        let value = costInput.value
            .replace(pesoSign, "")
            .replace(/,/g, "")
            .replace(/[^\d.]/g, "");

        // Allow only ONE decimal point
        const parts = value.split(".");
        if (parts.length > 2) {
            value = parts[0] + "." + parts[1];
        }

        // Limit to 2 decimal places (DO NOT auto add)
        if (parts[1]) {
            parts[1] = parts[1].slice(0, 2);
            value = parts.join(".");
        }

        costInput.value = value;
    });

    // Format ONLY when user leaves the field
    costInput.addEventListener("blur", () => {
        let value = costInput.value.trim();
        if (value === "" || isNaN(value)) return;

        costInput.value = `${pesoSign} ${Number(value).toLocaleString("en-PH", {
            minimumFractionDigits: value.includes(".") ? value.split(".")[1].length : 0,
            maximumFractionDigits: 2
        })}`;
    });

    // Clean formatting when focusing again
    costInput.addEventListener("focus", () => {
        costInput.value = costInput.value
            .replace(pesoSign, "")
            .replace(/,/g, "");
    });

}

document.querySelectorAll(".money-input").forEach(input => {
    input.addEventListener("blur", () => {
        let value = input.value.replace(pesoSign, "").replace(/,/g, "").trim();
        if (value === "" || isNaN(value)) return;
        input.value = `${pesoSign} ${Number(value).toLocaleString("en-PH", {
            minimumFractionDigits: 2,
            maximumFractionDigits: 2
        })}`;
    });
});
function getMoneyValue(input) {
    return parseFloat(
        input.value.replace(pesoSign, "").replace(/,/g, "")
    ) || 0;
}

// --------------------------------------------------------------------------------------------------
const tableBody = document.getElementById("contractsTableBody");
const contractsCountEl = document.getElementById("contractsCount");
const apiBase = getApiBase();
const useRemoteStorage = Boolean(apiBase);
const deleteEndpoint = apiBase ? `${apiBase}/api/delete-project` : "";
const updateEndpoint = apiBase ? `${apiBase}/api/update-project` : "";
const updateOverridesKey = "projectUpdates";
const projectMetaKey = "projectMeta";
const projectPowKey = "projectPow";
const variationOrdersKey = "projectVariationOrders";
const powApiEndpoint = apiBase ? `${apiBase}/api/pow` : "";

function normalizeContractId(value) {
    return String(value || "").trim().toUpperCase();
}

function findRowByContractId(contractId) {
    if (!tableBody) return null;
    const target = normalizeContractId(contractId);
    if (!target) return null;
    return Array.from(tableBody.querySelectorAll("tr")).find(tr => {
        const id = tr.dataset.contractId || tr.querySelector("strong")?.innerText?.trim() || "";
        return normalizeContractId(id) === target;
    }) || null;
}

function loadUpdateOverrides() {
    const raw = appStorage.getItem(updateOverridesKey);
    if (!raw) return {};
    try {
        const parsed = JSON.parse(raw);
        return parsed && typeof parsed === "object" ? parsed : {};
    } catch (err) {
        return {};
    }
}

function saveUpdateOverrides(data) {
    appStorage.setItem(updateOverridesKey, JSON.stringify(data));
}

function loadProjectMeta() {
    const raw = appStorage.getItem(projectMetaKey);
    if (!raw) return {};
    try {
        const parsed = JSON.parse(raw);
        return parsed && typeof parsed === "object" ? parsed : {};
    } catch (err) {
        return {};
    }
}

function saveProjectMeta(data) {
    appStorage.setItem(projectMetaKey, JSON.stringify(data));
}

function setProjectMeta(contractId, meta) {
    const key = normalizeContractId(contractId);
    if (!key) return;
    const all = loadProjectMeta();
    all[key] = {
        location: meta.location || "",
        coordinates: meta.coordinates || ""
    };
    saveProjectMeta(all);
}

function getProjectMeta(contractId) {
    const key = normalizeContractId(contractId);
    if (!key) return null;
    const all = loadProjectMeta();
    return all[key] || null;
}

function loadProjectPow() {
    const raw = appStorage.getItem(projectPowKey);
    if (!raw) return {};
    try {
        const parsed = JSON.parse(raw);
        return parsed && typeof parsed === "object" ? parsed : {};
    } catch (err) {
        return {};
    }
}

function saveProjectPow(data) {
    appStorage.setItem(projectPowKey, JSON.stringify(data));
}

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
            const parsed = JSON.parse(value);
            return normalizePowItems(parsed);
        } catch (err) {
            return [];
        }
    }
    return [];
}

function normalizeVariationOrders(value) {
    if (!Array.isArray(value)) return [];
    if (value.length && !Array.isArray(value[0])) {
        const one = normalizePowItems(value);
        return one.length ? [one] : [];
    }
    return value
        .map(items => normalizePowItems(items))
        .filter(items => items.length);
}

function setProjectPowMulti(keys, powItems, options = {}) {
    const syncRemote = options.syncRemote !== false;
    const all = loadProjectPow();
    const items = normalizePowItems(powItems);
    const normalizedKeys = [];
    keys.forEach(rawKey => {
        const key = normalizeContractId(rawKey);
        if (!key) return;
        all[key] = items;
        normalizedKeys.push(key);
    });
    saveProjectPow(all);
    if (syncRemote) {
        normalizedKeys.forEach(key => {
            syncPowToRemote(key).catch(err => console.warn(`POW sync failed for ${key}:`, err));
        });
    }
}

function setProjectPow(contractId, powItems, options = {}) {
    const syncRemote = options.syncRemote !== false;
    const key = normalizeContractId(contractId);
    if (!key) return;
    const all = loadProjectPow();
    all[key] = normalizePowItems(powItems);
    saveProjectPow(all);
    if (syncRemote) {
        syncPowToRemote(key).catch(err => console.warn(`POW sync failed for ${key}:`, err));
    }
}

function getProjectPow(contractId) {
    const key = normalizeContractId(contractId);
    if (!key) return [];
    const all = loadProjectPow();
    return normalizePowItems(all[key]);
}

function loadVariationOrders() {
    const raw = appStorage.getItem(variationOrdersKey);
    if (!raw) return {};
    try {
        const parsed = JSON.parse(raw);
        return parsed && typeof parsed === "object" ? parsed : {};
    } catch (err) {
        return {};
    }
}

function saveVariationOrders(data) {
    appStorage.setItem(variationOrdersKey, JSON.stringify(data));
}

function getVariationOrder(contractId) {
    const key = normalizeContractId(contractId);
    if (!key) return [];
    const all = loadVariationOrders();
    const value = all[key];
    if (Array.isArray(value) && value.length && Array.isArray(value[0])) {
        return value.map(items => normalizePowItems(items));
    }
    if (Array.isArray(value) && value.length && (value[0]?.itemNo || value[0]?.description)) {
        return [normalizePowItems(value)];
    }
    return [];
}

function setVariationOrder(contractId, items, options = {}) {
    const syncRemote = options.syncRemote !== false;
    const key = normalizeContractId(contractId);
    if (!key) return;
    const all = loadVariationOrders();
    if (Array.isArray(items) && items.length && Array.isArray(items[0])) {
        all[key] = items.map(list => normalizePowItems(list));
    } else {
        all[key] = normalizePowItems(items);
    }
    saveVariationOrders(all);
    if (syncRemote) {
        syncPowToRemote(key).catch(err => console.warn(`POW sync failed for ${key}:`, err));
    }
}

async function fetchPowRemote(contractId) {
    const key = normalizeContractId(contractId);
    if (!powApiEndpoint || !key) return null;
    const res = await fetch(`${powApiEndpoint}/${encodeURIComponent(key)}`);
    const data = await res.json().catch(() => ({}));
    if (!res.ok || !data?.success) {
        throw new Error(data?.error || "Failed to load Program of Works.");
    }
    return {
        programWorks: normalizePowItems(data.programWorks),
        variationOrders: normalizeVariationOrders(data.variationOrders || data.variationOrder || []),
        updatedAt: data.updatedAt || ""
    };
}

async function syncPowToRemote(contractId) {
    const key = normalizeContractId(contractId);
    if (!powApiEndpoint || !key) return;
    const payload = {
        programWorks: getProjectPow(key),
        variationOrders: getVariationOrder(key)
    };
    const res = await fetch(`${powApiEndpoint}/${encodeURIComponent(key)}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload)
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok || !data?.success) {
        throw new Error(data?.error || "Failed to save Program of Works.");
    }
}

async function hydratePowFromRemote(contractId) {
    const key = normalizeContractId(contractId);
    if (!powApiEndpoint || !key) return false;
    const remote = await fetchPowRemote(key);
    const remotePow = normalizePowItems(remote?.programWorks);
    const remoteVo = normalizeVariationOrders(remote?.variationOrders);
    const hasRemote = remotePow.length > 0 || remoteVo.length > 0;
    if (!hasRemote) return false;
    setProjectPow(key, remotePow, { syncRemote: false });
    setVariationOrder(key, remoteVo, { syncRemote: false });
    return true;
}

function getOriginalPowForContract(contractId) {
    const key = normalizeContractId(contractId);
    if (!key) return [];
    const row = findRowByContractId(key);
    if (row?.dataset?.programWorks) {
        try {
            const parsed = JSON.parse(row.dataset.programWorks);
            const normalized = normalizePowItems(parsed);
            if (normalized.length) return normalized;
        } catch (err) {
            // ignore
        }
    }
    const stored = getProjectPow(key);
    return stored;
}

function getPowStorageKey() {
    const modalKey = modal?.dataset?.powKey || "";
    const inputId = document.getElementById("contractId")?.value || "";
    const rowId = editingRow?.dataset?.contractId || "";
    const rowStrongId = editingRow?.querySelector("strong")?.innerText?.trim() || "";
    const key = normalizeContractId(modalKey || inputId || rowId || rowStrongId || editingContractId || "");
    return key;
}

function getUpdateOverride(contractId) {
    const key = normalizeContractId(contractId);
    if (!key) return null;
    const all = loadUpdateOverrides();
    return all[key] || null;
}

function setUpdateOverride(contractId, override) {
    const key = normalizeContractId(contractId);
    if (!key) return;
    const all = loadUpdateOverrides();
    all[key] = {
        status: override.status || "",
        accomplishment: parsePercent(override.accomplishment || 0),
        completionDate: override.completionDate || "",
        remarks: override.remarks || "",
        revisedContractAmount: override.revisedContractAmount || "",
        revisedProgramWorks: override.revisedProgramWorks || [],
        revisedExpirationDates: override.revisedExpirationDates || []
    };
    saveUpdateOverrides(all);
}

function removeUpdateOverride(contractId) {
    const key = normalizeContractId(contractId);
    if (!key) return;
    const all = loadUpdateOverrides();
    if (all[key]) {
        delete all[key];
        saveUpdateOverrides(all);
    }
}

function updateContractsCount() {
    if (!contractsCountEl || !tableBody) return;
    const count = tableBody.querySelectorAll("tr").length;
    const label = count === 1 ? "Contract Found" : "Contracts Found";
    contractsCountEl.textContent = `${count.toLocaleString("en-PH")} ${label}`;
}

function setRowDataAttributes(row, data) {
    if (!row || !data) return;
    row.dataset.contractId = data.contractId || "";
    row.dataset.contractDescription = data.contractDescription || "";
    row.dataset.contractor = data.contractor || "";
    row.dataset.category = data.category || "";
    row.dataset.appropriation = data.appropriation || "";
    row.dataset.approvedBudgetCost = data.approvedBudgetCost || "";
    row.dataset.contractCost = data.contractCost || "";
    row.dataset.startDate = data.startDate || "";
    row.dataset.expirationDate = data.expirationDate || "";
    row.dataset.revisedExpirationDates = JSON.stringify(data.revisedExpirationDates || []);
    row.dataset.location = data.location || "";
    row.dataset.limits = data.limits || "";
    row.dataset.coordinates = data.coordinates || "";
    row.dataset.programWorks = JSON.stringify(data.programWorks || []);
    row.dataset.completionDate = data.completionDate || "";
    row.dataset.accomplishment = data.accomplishment || "";
    row.dataset.status = data.status || "";
    row.dataset.revisedContractAmount = data.revisedContractAmount || "";
    row.dataset.revisedProgramWorks = JSON.stringify(data.revisedProgramWorks || []);
    row.dataset.projectEngineer = data.projectEngineer || "";
    row.dataset.materialsEngineer = data.materialsEngineer || "";
    row.dataset.projectInspector = data.projectInspector || "";
    row.dataset.residentEngineer = data.residentEngineer || "";
    row.dataset.qaInCharge = data.qaInCharge || "";
    row.dataset.contractorMaterialsEngineer = data.contractorMaterialsEngineer || "";
}

function getRowDataFromRow(row) {
    const meta = getProjectMeta(row.dataset.contractId || row.querySelector("strong")?.innerText?.trim() || "");
    const pow = getProjectPow(row.dataset.contractId || row.querySelector("strong")?.innerText?.trim() || "");
    let parsedPow = [];
    try {
        parsedPow = row.dataset.programWorks ? JSON.parse(row.dataset.programWorks) : [];
    } catch (err) {
        parsedPow = [];
    }
    return {
        contractId: row.dataset.contractId || row.querySelector("strong")?.innerText?.trim() || "",
        contractDescription: row.dataset.contractDescription || "",
        contractor: row.dataset.contractor || "",
        category: row.dataset.category || "",
        appropriation: row.dataset.appropriation || "",
        approvedBudgetCost: row.dataset.approvedBudgetCost || "",
        contractCost: row.dataset.contractCost || "",
        startDate: row.dataset.startDate || "",
        expirationDate: row.dataset.expirationDate || "",
        revisedExpirationDates: row.dataset.revisedExpirationDates ? JSON.parse(row.dataset.revisedExpirationDates) : [],
        location: row.dataset.location || meta?.location || "",
        limits: row.dataset.limits || "",
        coordinates: row.dataset.coordinates || meta?.coordinates || "",
        programWorks: (Array.isArray(parsedPow) && parsedPow.length) ? parsedPow : pow,
        completionDate: row.dataset.completionDate || "",
        accomplishment: row.dataset.accomplishment || "",
        status: row.dataset.status || "",
        revisedContractAmount: row.dataset.revisedContractAmount || "",
        revisedProgramWorks: row.dataset.revisedProgramWorks ? JSON.parse(row.dataset.revisedProgramWorks) : [],
        projectEngineer: row.dataset.projectEngineer || "",
        materialsEngineer: row.dataset.materialsEngineer || "",
        projectInspector: row.dataset.projectInspector || "",
        residentEngineer: row.dataset.residentEngineer || "",
        qaInCharge: row.dataset.qaInCharge || "",
        contractorMaterialsEngineer: row.dataset.contractorMaterialsEngineer || ""
    };
}

function setCategorySelection(categoryText) {
    if (!modalCategoryLabel || !modalCategoryPill) return;
    const text = (categoryText || "").trim();
    if (!text) return;
    modalCategoryLabel.textContent = text;
    modalCategoryPill.querySelectorAll(".cat-option").forEach(option => {
        const optText = option.textContent.trim();
        option.classList.toggle("active", optText === text);
    });
}

function populateFormFromRow(row) {
    const data = getRowDataFromRow(row);
    const rowStrongId = row?.querySelector("strong")?.innerText?.trim() || "";
    if (modal) {
        modal.dataset.powKey = data.contractId || rowStrongId || "";
    }
    const contractKey = normalizeContractId(data.contractId || rowStrongId || "");
    const storedPow = normalizePowItems(getProjectPow(contractKey));
    const detailsPow = normalizePowItems(currentDetailsData?.programWorks || []);
    const detailsKey = normalizeContractId(currentDetailsData?.contractId || "");
    const targetKey = contractKey;
    if (detailsPow.length && detailsKey && targetKey && detailsKey === targetKey) {
        setProjectPowMulti([targetKey], detailsPow);
        if (row) {
            row.dataset.programWorks = JSON.stringify(detailsPow);
        }
    }
    const freshStoredPow = normalizePowItems(getProjectPow(contractKey));
    setDraftFieldValue("contractId", data.contractId);
    setDraftFieldValue("contractDescription", data.contractDescription);
    setDraftFieldValue("contractor", data.contractor);
    setDraftFieldValue("appropriation", data.appropriation);
    setDraftFieldValue("approvedBudgetCost", data.approvedBudgetCost);
    setDraftFieldValue("contractCost", data.contractCost);
    setDraftFieldValue("startDate", data.startDate);
    setDraftFieldValue("expirationDate", data.expirationDate);
    setDraftFieldValue("projectLocation", data.location);
    setDraftFieldValue("projectLimits", data.limits);
    setDraftFieldValue("projectCoordinates", data.coordinates);
    setDraftFieldValue("projectEngineer", data.projectEngineer);
    setDraftFieldValue("materialsEngineer", data.materialsEngineer);
    setDraftFieldValue("projectInspector", data.projectInspector);
    setDraftFieldValue("residentEngineer", data.residentEngineer);
    setDraftFieldValue("qaInCharge", data.qaInCharge);
    setDraftFieldValue("contractorMaterialsEngineer", data.contractorMaterialsEngineer);
    setCategorySelection(data.category || "All Categories");
    const rowPow = normalizePowItems(data.programWorks || []);
    showStep1();
}

function formatMoneyDisplay(value) {
    const raw = String(value ?? "").replace(/[^\d.-]/g, "");
    const num = Number(raw);
    if (!raw || Number.isNaN(num)) return value || "-";
    return `\u20B1 ${num.toLocaleString("en-PH", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function parsePercent(value) {
    if (value === undefined || value === null) return 0;
    const cleaned = String(value).replace("%", "").trim();
    const num = Number(cleaned);
    if (Number.isNaN(num)) return 0;
    return Math.max(0, Math.min(100, Math.round(num)));
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

function renderActionButtons(perms) {
    const buttons = [];
    if (perms.canUpdate) {
        buttons.push(`
            <button class="report-btn update-btn" type="button">
                <i class='bx bx-refresh'></i> Update
            </button>
        `);
    }
    if (perms.canEdit) {
        buttons.push(`
            <button class="report-btn edit-btn" type="button">
                <i class='bx bx-edit'></i> Edit
            </button>
        `);
    }
    if (perms.canDelete) {
        buttons.push(`
            <button class="report-btn delete-btn" type="button">
                <i class='bx bx-trash'></i> Delete
            </button>
        `);
    }
    return `<div class="report-actions">${buttons.join("")}</div>`;
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

async function deleteProject(contractId) {
    if (!deleteEndpoint) {
        throw new Error("Backend is not configured. Set your API base URL in config.js.");
    }
    const res = await fetch(`${deleteEndpoint}/${encodeURIComponent(contractId)}`, {
        method: "DELETE"
    });

    const json = await res.json().catch(() => ({}));
    if (!res.ok || !json.success) {
        const message = json?.error || "Failed to delete project.";
        throw new Error(message);
    }
}

saveBtn.addEventListener("click", () => {
    if (!isAdminUser) {
        alert("Only the admin can add or edit projects.");
        return;
    }
    if (isSavingProject) return;
    isSavingProject = true;
    if (saveBtn) saveBtn.disabled = true;
    const currentToken = ++saveProjectToken;
    let saveSucceeded = false;

    // STEP 1 DATA
    const contractId = document.getElementById("contractId").value.trim();
    const description = document.getElementById("contractDescription").value.trim();
    const contractor = document.getElementById("contractor").value.trim();
    const category = modalCategoryLabel.textContent || "Uncategorized";
    const isEditing = isEditMode && editingRow;
    const completionDate = isEditing ? (editingRow?.dataset.completionDate || "") : "";
    const cost = getMoneyValue(costInput);
    const appropriation = document.getElementById("appropriation").value.trim();
    const approvedBudgetCost = document.getElementById("approvedBudgetCost")?.value.trim() || "";
    const startDate = document.getElementById("startDate").value;
    const expirationDate = document.getElementById("expirationDate").value;
    const location = document.getElementById("projectLocation")?.value.trim() || "";
    const limits = document.getElementById("projectLimits")?.value.trim() || "";
    const coordinates = document.getElementById("projectCoordinates")?.value.trim() || "";
    const existingMeta = isEditing ? getProjectMeta(editingContractId || contractId) : null;
    const safeLocation = location || existingMeta?.location || editingRow?.dataset.location || "";
    const safeCoordinates = coordinates || existingMeta?.coordinates || editingRow?.dataset.coordinates || "";
    setProjectMeta(contractId, { location: safeLocation, coordinates: safeCoordinates });
    if (isEditing && editingRow) {
        editingRow.dataset.location = safeLocation;
        editingRow.dataset.coordinates = safeCoordinates;
    }

    if (!contractId || !description || !contractor || !cost) {
        alert("Please complete required fields.");
        return;
    }

    // STEP 2 DATA (Project In-Charge)
    const projectEngineer = toAllCaps(document.getElementById("projectEngineer").value);
    const materialsEngineer = toAllCaps(document.getElementById("materialsEngineer").value);
    const projectInspector = toAllCaps(document.getElementById("projectInspector").value);
    const residentEngineer = toAllCaps(document.getElementById("residentEngineer").value);
    const qaInCharge = toAllCaps(document.getElementById("qaInCharge").value);
    const contractorMaterialsEngineer = toAllCaps(document.getElementById("contractorMaterialsEngineer").value);

    const inChargeData = {
        projectEngineer,
        materialsEngineer,
        projectInspector,
        residentEngineer,
        qaInCharge,
        contractorMaterialsEngineer
    };

    const existingPow = isEditing && editingRow ? normalizePowItems(getRowDataFromRow(editingRow).programWorks) : [];
    const programWorks = existingPow.length ? existingPow : normalizePowItems(getProjectPow(contractId));

    // Prepare data to send to server
    const projectData = {
        contractId,
        contractDescription: description,
        contractor,
        category,
        appropriation,
        approvedBudgetCost,
        contractCost: cost,
        startDate,
        expirationDate,
        location: safeLocation,
        limits,
        coordinates: safeCoordinates,
        programWorks,
        completionDate,
        projectEngineer,
        materialsEngineer,
        projectInspector,
        residentEngineer,
        qaInCharge,
        contractorMaterialsEngineer
    };

    if (!apiBase) {
        alert("Backend is not configured. Set your API base URL in config.js.");
        return;
    }

    const endpoint = isEditing
        ? `${updateEndpoint}/${encodeURIComponent(editingContractId || contractId)}`
        : `${apiBase}/api/save-project`;
    const method = isEditing ? 'PUT' : 'POST';

    // Send to server
    fetch(endpoint, {
        method,
        headers: {
            'Content-Type': 'application/json'
        },
        body: JSON.stringify(projectData)
    })
    .then(response => response.json())
    .then(data => {
        if (data.success) {
            saveSucceeded = true;
            alert(isEditing ? 'Project updated successfully!' : 'Project saved successfully to Excel!');

            const existingData = isEditing && editingRow ? getRowDataFromRow(editingRow) : {};
            const rowData = {
                ...existingData,
                contractId,
                contractDescription: description,
                contractor,
                category,
                appropriation,
                approvedBudgetCost,
                contractCost: cost,
                startDate,
                expirationDate,
                location: safeLocation,
                limits,
                coordinates: safeCoordinates,
                revisedExpirationDates: existingData.revisedExpirationDates || [],
                programWorks,
                completionDate,
                accomplishment: existingData.accomplishment || 0,
                status: existingData.status || "",
                remarks: existingData.remarks || "",
                projectEngineer,
                materialsEngineer,
                projectInspector,
                residentEngineer,
                qaInCharge,
                contractorMaterialsEngineer
            };
            setProjectMeta(contractId, { location: safeLocation, coordinates: safeCoordinates });
            setProjectPow(contractId, programWorks);

            if (!isEditing && isUserInCharge(inChargeData)) {
                addNotification(`You were assigned as in-charge for ${contractId} - ${description}.`, {
                    contractId,
                    type: "assignment"
                });
            }

            if (isEditing && editingRow) {
    setRowDataAttributes(editingRow, rowData);
                editingRow.dataset.inCharge = JSON.stringify(inChargeData);
                editingRow.cells[0].innerHTML = `
                  <strong>${contractId}</strong> \u2013 ${description}
                  <div class="contract-category">${category}</div>
                `;
                editingRow.cells[1].textContent = contractor;
                editingRow.cells[2].textContent = formatMoneyDisplay(cost);
                editingRow.cells[3].innerHTML = renderProgressPill(rowData.accomplishment || 0);
                editingRow.cells[4].textContent = rowData.status || "-";
                editingRow.cells[5].textContent = getCompletionDisplay(rowData.accomplishment || 0, rowData.completionDate);
            } else {
                // Add to table for display
                const tr = document.createElement("tr");
                setRowDataAttributes(tr, rowData);
                tr.dataset.inCharge = JSON.stringify(inChargeData);

                const perms = getProjectPermissions(inChargeData);
                tr.innerHTML = `
                  <td>
                    <strong>${contractId}</strong> \u2013 ${description}
                    <div class="contract-category">${category}</div>
                  </td>
                  <td>${contractor}</td>
                    <td>\u20B1 ${cost.toLocaleString("en-PH", { minimumFractionDigits: 2 })}</td>
                    <td>${renderProgressPill(rowData.accomplishment || 0)}</td>
                    <td>${rowData.status || "-"}</td>
                      <td>${getCompletionDisplay(rowData.accomplishment || 0, rowData.completionDate)}</td>
                    <td>${renderActionButtons(perms)}</td>
                  `;

                  tableBody.appendChild(tr);
                  updateContractsCount();
              }
            if (detailsModal?.classList.contains("open") && currentDetailsData) {
                const currentId = normalizeContractId(currentDetailsData.contractId || "");
                const savedId = normalizeContractId(contractId || "");
                if (currentId && currentId === savedId) {
                    currentDetailsData = { ...currentDetailsData, ...rowData };
                    const detailsLocation = document.getElementById("detailsLocation");
                    if (detailsLocation) detailsLocation.innerText = rowData.location || "-";
                    const detailsCoordinates = document.getElementById("detailsCoordinates");
                    if (detailsCoordinates) detailsCoordinates.innerText = rowData.coordinates || "-";
                    const coords = parseCoordinates(rowData.coordinates || "");
                    if (coords) {
                        setMapLocation(coords.lat, coords.lng);
                    }
                }
            }
            modal.classList.remove("open");
            if (!isEditing) {
                clearDraft();
            }
            resetModal();
            setModalMode(false);
        } else {
            alert('Error saving project: ' + data.error);
        }
    })
    .catch(error => {
        console.error('Error:', error);
        if (saveSucceeded || currentToken !== saveProjectToken) return;
        alert("Error connecting to server. Make sure it's running on port 3000");
    })
    .finally(() => {
        if (currentToken === saveProjectToken) {
            isSavingProject = false;
            if (saveBtn) saveBtn.disabled = false;
        }
    });
});


function resetModal() {
    document.querySelectorAll("#addProjectModal input, #addProjectModal select")
        .forEach(el => el.value = "");

    if (modalCategoryLabel && modalCategoryPill) {
        modalCategoryLabel.textContent = "All Categories";
        modalCategoryPill.querySelectorAll(".cat-option").forEach((option, idx) => {
            option.classList.toggle("active", idx === 0);
        });
    }

    showStep1();
}

// Load saved projects from server and populate table
async function fetchProjects() {
        if (!apiBase) {
                updateContractsCount();
                return;
        }
        try {
                const res = await fetch(`${apiBase}/api/get-projects`);
                const json = await res.json();
                if (!json.success) return;

                const projects = json.projects || [];
                const fragment = document.createDocumentFragment();
                projects.forEach(p => {
                        const contractId = p['CONTRACT ID'] || '';
                        const description = p['CONTRACT NAME/LOCATION'] || '';
                        const contractor = p['CONTRACTOR'] || '';
                        const cost = Number(p['CONTRACT AMOUNT']) || 0;
                        const completionDate = p['LATEST DATE UPDATED'] || '';
                        const accomplishment = parsePercent(p['SWA (%) 1ST BILLING'] || 0);
                        const status = p['STATUS OF PROJECT'] || '';
                        const remarks = p['INPUT 1ST BILLING'] || '';
                        const override = getUpdateOverride(contractId);

                        if (!contractId && !description) {
                                return;
                        }

                        const inChargeData = {
                                projectEngineer: p['PROJECT ENGINEER'] || '',
                                materialsEngineer: p['MATERIALS ENGINEER'] || '',
                                projectInspector: p['PROJECT INSPECTOR'] || '',
                                residentEngineer: p['RESIDENT ENGINEER'] || '',
                                qaInCharge: p['QUALITY ASSURANCE IN-CHARGE'] || '',
                                contractorMaterialsEngineer: p['CONTRACTORS MATERIALS ENGINEER'] || ''
                        };
                        const perms = getProjectPermissions(inChargeData);
                        if (!perms.canView) {
                                return;
                        }

                        const tr = document.createElement('tr');
                        const rowData = {
                                contractId,
                                contractDescription: description,
                                contractor,
                                category: p['TYPE OF PROJECT'] || '',
                                appropriation: p['APPROPRIATION'] || '',
                                approvedBudgetCost: p['APPROVED BUDGET COST (ABC)'] || '',
                                contractCost: p['CONTRACT AMOUNT'] || '',
                                startDate: p['START DATE'] || '',
                                expirationDate: p['EXPIRATION DATE'] || '',
                                location: p['LOCATION'] || '',
                                limits: p['LIMITS'] || '',
                                coordinates: '',
                                completionDate,
                                accomplishment,
                                status,
                                remarks,
                                projectEngineer: p['PROJECT ENGINEER'] || '',
                                materialsEngineer: p['MATERIALS ENGINEER'] || '',
                                projectInspector: p['PROJECT INSPECTOR'] || '',
                                residentEngineer: p['RESIDENT ENGINEER'] || '',
                                qaInCharge: p['QUALITY ASSURANCE IN-CHARGE'] || '',
                                contractorMaterialsEngineer: p['CONTRACTORS MATERIALS ENGINEER'] || ''
                        };
                        const meta = getProjectMeta(contractId);
                        if (meta) {
                                rowData.location = rowData.location || meta.location || "";
                                rowData.coordinates = rowData.coordinates || meta.coordinates || "";
                        }
                        if (override) {
                                rowData.status = override.status || rowData.status;
                                rowData.accomplishment = parsePercent(override.accomplishment);
                                rowData.completionDate = override.completionDate || rowData.completionDate;
                                rowData.revisedContractAmount = override.revisedContractAmount || rowData.revisedContractAmount;
                                rowData.revisedExpirationDates = override.revisedExpirationDates || rowData.revisedExpirationDates;
                        }
                        const pow = getProjectPow(contractId);
                        if (pow && pow.length) {
                                rowData.programWorks = pow;
                        }
                        setRowDataAttributes(tr, rowData);
                        tr.dataset.inCharge = JSON.stringify(inChargeData);
                        tr.innerHTML = `
                            <td>
                                <strong>${contractId}</strong> \u2013 ${description}
                                <div class="contract-category">${p['TYPE OF PROJECT'] || ''}</div>
                            </td>
                            <td>${contractor}</td>
                            <td>\u20B1 ${cost.toLocaleString('en-PH', { minimumFractionDigits: 2 })}</td>
                            <td>${renderProgressPill(rowData.accomplishment)}</td>
                            <td>${rowData.status || '-'}</td>
                            <td>${getCompletionDisplay(rowData.accomplishment, rowData.completionDate)}</td>
                            <td>${renderActionButtons(perms)}</td>
                        `;

                        fragment.appendChild(tr);
                });
                tableBody.appendChild(fragment);
                updateContractsCount();
        } catch (err) {
                console.warn('Could not load projects:', err);
                updateContractsCount();
        }
}

// Populate table on initial load
window.addEventListener('DOMContentLoaded', () => {
    syncEngineersDirectory();
    fetchProjects();
});

// Navigation transition handlers (moved from inline HTML)
document.addEventListener('DOMContentLoaded', () => {
  (function () {
    const page = document.querySelector('section') || document.body;
    const current = window.location.pathname.split('/').pop() || 'projects.html';

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

// -------------------------------------------------------------------------------------------------
// MODAL CATEGORY DROPDOWN (OPEN / CLOSE + SELECT)
// -------------------------------------------------------------------------------------------------
const modalCategoryPill = document.getElementById("modalCategoryPill");
const modalCategoryLabel = document.getElementById("modalCategoryLabel");

if (modalCategoryPill) {

    const header = modalCategoryPill.querySelector(".pill-header");
    const options = modalCategoryPill.querySelectorAll(".cat-option");

    // OPEN / CLOSE
    header.addEventListener("click", (e) => {
        e.stopPropagation();

        document.querySelectorAll(".dropdown-pill.open")
            .forEach(p => p !== modalCategoryPill && p.classList.remove("open"));

        modalCategoryPill.classList.toggle("open");
    });

    // SELECT OPTION
    options.forEach(option => {
        option.addEventListener("click", (e) => {
            e.stopPropagation();

            options.forEach(o => o.classList.remove("active"));
            option.classList.add("active");

            modalCategoryLabel.textContent = option.textContent.trim();
            modalCategoryPill.classList.remove("open");
            saveDraft();
        });
    });

}

// CLOSE when clicking outside
document.addEventListener("click", () => {
    modalCategoryPill?.classList.remove("open");
});


// --------------------------------------------------------------------------------------------------
// -----------------------------------------------------
// PROJECT DETAILS MODAL
// -----------------------------------------------------
const detailsModal = document.getElementById("projectDetailsModal");
const closeDetailsBtn = document.getElementById("closeDetailsModal");

// Close
closeDetailsBtn?.addEventListener("click", () => {
    detailsModal.classList.remove("open");
    applyDetailsPermissions(false);
});

// Open when clicking table row (ignore edit/delete buttons)
tableBody.addEventListener("click", async (e) => {
    const updateBtn = e.target.closest(".update-btn");
    if (updateBtn) {
        e.stopPropagation();
        const row = updateBtn.closest("tr");
        if (!row) return;
        const perms = getProjectPermissions(getRowInCharge(row));
        if (!perms.canUpdate) {
            alert("You don't have permission to update this project.");
            return;
        }
        openUpdateModal(row);
        return;
    }

    const editBtn = e.target.closest(".edit-btn");
    if (editBtn) {
        e.stopPropagation();
        const row = editBtn.closest("tr");
        if (!row) return;
        const perms = getProjectPermissions(getRowInCharge(row));
        if (!perms.canEdit) {
            alert("Only the admin can edit project details.");
            return;
        }
        ensurePowForEditing(row);

        clearDraft();
        populateEngineerDatalists();
        setModalMode(true, row);
        resetModal();
        populateFormFromRow(row);
        modal.classList.add("open");
        return;
    }

    const deleteBtn = e.target.closest(".delete-btn");
    if (deleteBtn) {
        e.stopPropagation();
        const row = deleteBtn.closest("tr");
        if (!row) return;
        const perms = getProjectPermissions(getRowInCharge(row));
        if (!perms.canDelete) {
            alert("Only the admin can delete projects.");
            return;
        }
        const contractId =
            row.dataset.contractId ||
            row.querySelector("strong")?.innerText?.trim();

        if (!contractId) {
            alert("Missing contract ID.");
            return;
        }

        const confirmed = confirm(`Delete project ${contractId}?`);
        if (!confirmed) return;

        deleteBtn.disabled = true;
        try {
            await deleteProject(contractId);
            row.remove();
            removeUpdateOverride(contractId);
            updateContractsCount();
        } catch (err) {
            alert(`Error deleting project: ${err.message}`);
        } finally {
            deleteBtn.disabled = false;
        }
        return;
    }

    const row = e.target.closest("tr");
    if (!row) return;
    const rowPerms = getProjectPermissions(getRowInCharge(row));
    applyDetailsPermissions(rowPerms.canUpdate);

    // Extract values
    const title = row.querySelector("strong")?.innerText || "";
    const rawDescription = row.cells[0].innerText.replace(title, "").trim();
    const cleanDescription = rawDescription.replace(/^[\-\u2013]\s*/, "").trim();
    const category = row.querySelector(".contract-category")?.innerText;
    const contractor = row.cells[1].innerText;
    const cost = row.cells[2].innerText;
    const status = row.cells[4].innerText;
    const completion = row.cells[5].innerText;
    currentDetailsData = getRowDataFromRow(row);

    // Populate modal
    document.getElementById("detailsTitle").innerText = `${title} \u2013 ${cleanDescription}`.trim();
    const detailsDescriptionEl = document.getElementById("detailsDescription");
    if (detailsDescriptionEl) {
        const safeDesc = escapeHtml(cleanDescription);
        const safeCat = category ? escapeHtml(category) : "";
        detailsDescriptionEl.innerHTML = safeCat ? `${safeDesc}<br>${safeCat}` : `${safeDesc}`;
    }
    document.getElementById("detailsCategory").innerText = category;
    document.getElementById("detailsContractor").innerText = contractor;
    const detailsCostEl = document.getElementById("detailsCost");
    if (detailsCostEl) {
        const rawCost = String(cost || "").replace(/\s+/g, " ").trim();
        const numericCost = rawCost.replace(/[^0-9.,-]/g, "").trim();
        const safeCost = escapeHtml(numericCost || rawCost);
        detailsCostEl.innerHTML = `<span class="peso-sign">\u20B1</span><span class="peso-amount">${safeCost}</span>`;
    }
    const detailsAppropriation = document.getElementById("detailsAppropriation");
    if (detailsAppropriation) detailsAppropriation.innerText = formatMoneyDisplay(currentDetailsData?.appropriation || "-");
    const detailsContractCost = document.getElementById("detailsContractCost");
    if (detailsContractCost) detailsContractCost.innerText = formatMoneyDisplay(currentDetailsData?.contractCost || cost || "-");
    const detailsApprovedBudgetCost = document.getElementById("detailsApprovedBudgetCost");
    if (detailsApprovedBudgetCost) detailsApprovedBudgetCost.innerText = formatMoneyDisplay(currentDetailsData?.approvedBudgetCost || "-");
    const revisedContractBlock = document.getElementById("detailsRevisedContractCostBlock");
    const detailsRevisedContractCost = document.getElementById("detailsRevisedContractCost");
    const revisedContractAmount = String(currentDetailsData?.revisedContractAmount || "").trim();
    if (revisedContractBlock) revisedContractBlock.classList.toggle("hidden", !revisedContractAmount);
    if (detailsRevisedContractCost) detailsRevisedContractCost.innerText = revisedContractAmount ? formatMoneyDisplay(revisedContractAmount) : "-";
    document.getElementById("detailsCompletion").innerText =
        getCompletionDisplay(row.dataset.accomplishment || completion, row.dataset.completionDate || completion);
    const revisedExpirationBlock = document.getElementById("detailsRevisedExpirationBlock");
    const detailsRevisedExpiration = document.getElementById("detailsRevisedExpiration");
    const revisedDates = Array.isArray(currentDetailsData?.revisedExpirationDates)
        ? currentDetailsData.revisedExpirationDates.filter(Boolean)
        : [];
    const latestRevisedExpiration = revisedDates.length ? revisedDates[revisedDates.length - 1] : "";
    if (revisedExpirationBlock) revisedExpirationBlock.classList.toggle("hidden", !latestRevisedExpiration);
    if (detailsRevisedExpiration) detailsRevisedExpiration.innerText = latestRevisedExpiration ? formatDateLong(latestRevisedExpiration) : "-";
    document.getElementById("detailsStatus").innerText = status || "â€”";
    const startDate = row.dataset.startDate || "-";
    const expirationDate = row.dataset.expirationDate || "-";
    document.getElementById("detailsStart").innerText = formatDateLong(startDate);
    const detailsExpiration = document.getElementById("detailsExpiration");
    if (detailsExpiration) {
        detailsExpiration.innerText = formatDateLong(expirationDate);
    }
    const inCharge = row.dataset.inCharge
        ? JSON.parse(row.dataset.inCharge)
        : {};

    const meta = getProjectMeta(row.dataset.contractId || title);
    if (meta?.location) row.dataset.location = meta.location;
    if (meta?.coordinates) row.dataset.coordinates = meta.coordinates;
    const mergedLocation = row.dataset.location || meta?.location || "";
    const mergedCoordinates = row.dataset.coordinates || meta?.coordinates || "";
    if (currentDetailsData) {
        currentDetailsData.location = mergedLocation || currentDetailsData.location || "";
        currentDetailsData.coordinates = mergedCoordinates || currentDetailsData.coordinates || "";
    }

    const detailsLocation = document.getElementById("detailsLocation");
    if (detailsLocation) {
        detailsLocation.innerText = mergedLocation || mergedCoordinates || "-";
    }
    const detailsLimits = document.getElementById("detailsLimits");
    if (detailsLimits) {
        detailsLimits.innerText = currentDetailsData?.limits || row.dataset.limits || "-";
    }

    const detailsCoordinates = document.getElementById("detailsCoordinates");
    if (detailsCoordinates) {
        detailsCoordinates.innerText = mergedCoordinates || "-";
    }

    const coords = parseCoordinates(mergedCoordinates || "");
    if (coords) {
        setMapLocation(coords.lat, coords.lng);
    }

    // Fill Project In-Charge tab
    const engineerDirectory = getEngineersFromStorage();
    renderEngineerDetails("detailsProjectEngineer", inCharge.projectEngineer, engineerDirectory, "Project Engineer");
    renderEngineerDetails("detailsMaterialsEngineer", inCharge.materialsEngineer, engineerDirectory, "Materials Engineer");
    renderEngineerDetails("detailsProjectInspector", inCharge.projectInspector, engineerDirectory, "Project Inspector");
    renderEngineerDetails("detailsResidentEngineer", inCharge.residentEngineer, engineerDirectory, "Resident Engineer");
    renderEngineerDetails("detailsQaInCharge", inCharge.qaInCharge, engineerDirectory, "QA In-Charge");
    renderEngineerDetails("detailsContractorMaterialsEngineer", inCharge.contractorMaterialsEngineer, engineerDirectory, "Contractor Materials Engineer");

    // Render gallery for this contract before opening modal
    try { renderGallery(title); } catch (err) { console.warn('renderGallery error', err); }

    // Render documents for this contract
    try { renderDocuments(title); } catch (err) { console.warn('renderDocuments error', err); }

    // Hydrate Program of Works from server first (if available)
    const contractKey = row.dataset.contractId || title;
    try {
        await hydratePowFromRemote(contractKey);
    } catch (err) {
        console.warn("Remote POW load failed:", err);
    }

    // Render program of works (fallback to stored POW if dataset is empty)
    try {
        const fallbackPow = getProjectPow(contractKey);
        let pow = (currentDetailsData?.programWorks && currentDetailsData.programWorks.length)
            ? currentDetailsData.programWorks
            : [];
        if (!pow.length) {
            let parsed = [];
            try {
                parsed = row.dataset.programWorks ? JSON.parse(row.dataset.programWorks) : [];
            } catch (err) {
                parsed = [];
            }
            pow = (Array.isArray(parsed) && parsed.length) ? parsed : fallbackPow;
        }
        if ((!row.dataset.programWorks || row.dataset.programWorks === "[]") && pow && pow.length) {
            row.dataset.programWorks = JSON.stringify(pow);
        }
        if (pow && pow.length) {
            setProjectPowMulti([contractKey], pow);
        }
        if (currentDetailsData) currentDetailsData.programWorks = normalizePowItems(pow);
        renderProgramOfWorks(pow || []);
        renderVariationOrders(getVariationOrder(contractKey));
    } catch (err) {
        console.warn('renderProgramOfWorks error', err);
    }

detailsModal.classList.add("open");
});

// Revised Expiration Dates
function initRevisedExpirationDates(dates = []) {
    if (!revisedExpirationContainer) return;
    revisedExpirationContainer.innerHTML = "";
    if (!Array.isArray(dates) || dates.length === 0) {
        revisedExpirationContainer.classList.add("hidden");
        return;
    }
    revisedExpirationContainer.classList.remove("hidden");
    dates.forEach((date, idx) => {
        addRevisedExpirationRow(idx + 1, date);
    });
}

function addRevisedExpirationRow(index, value = "") {
    if (!revisedExpirationContainer) return;
    const wrapper = document.createElement("div");
    wrapper.className = "form-group";
    const label = document.createElement("label");
    label.textContent = `Revised Expiration Date #${index}`;
    const input = document.createElement("input");
    input.type = "date";
    input.value = value || "";
    wrapper.appendChild(label);
    wrapper.appendChild(input);
    revisedExpirationContainer.appendChild(wrapper);
}

function collectRevisedExpirationDates() {
    if (!revisedExpirationContainer) return [];
    return Array.from(revisedExpirationContainer.querySelectorAll("input[type=\"date\"]"))
        .map(i => i.value)
        .filter(Boolean);
}

openVariationOrderBtn?.addEventListener("click", async () => {
    const perms = getProjectPermissions(getRowInCharge(updatingRow));
    if (!perms.canUpdate) {
        alert("You don't have permission to update this project.");
        return;
    }
    const contractId = updateModal?.dataset.contractId
        || updatingRow?.dataset.contractId
        || updatingRow?.querySelector("strong")?.innerText?.trim()
        || "";
    if (!contractId) {
        alert("Missing contract ID.");
        return;
    }
    try {
        await hydratePowFromRemote(contractId);
    } catch (err) {
        console.warn("Remote POW load failed:", err);
    }
    const existing = getVariationOrder(contractId);
    if (!existing.length) {
        const original = getOriginalPowForContract(contractId);
        setVariationOrder(contractId, [original]);
    } else {
        const original = getOriginalPowForContract(contractId);
        const next = [...existing, original];
        setVariationOrder(contractId, next);
    }
    const count = getVariationOrder(contractId).length;
    alert(`Variation Order #${count} added to the Contract Details`);
    if (currentDetailsData && normalizeContractId(currentDetailsData.contractId) === normalizeContractId(contractId)) {
        renderVariationOrders(getVariationOrder(contractId));
    }
});

toggleRevisedExpirationBtn?.addEventListener("click", () => {
    if (!revisedExpirationContainer) return;
    const currentCount = revisedExpirationContainer.querySelectorAll("input[type=\"date\"]").length;
    if (currentCount === 0) {
        revisedExpirationContainer.classList.remove("hidden");
    }
    addRevisedExpirationRow(currentCount + 1, "");
    const inputs = revisedExpirationContainer.querySelectorAll("input[type=\"date\"]");
    inputs[inputs.length - 1]?.focus();
});

toggleRevisedContractAmountBtn?.addEventListener("click", () => {
    if (!revisedContractAmountContainer) return;
    revisedContractAmountContainer.classList.remove("hidden");
    revisedContractAmountInput?.focus();
});

// Revised Program of Works (Update modal)
function createRevisedPowRow(data = {}) {
    if (!revisedPowBody) return;
    const tr = document.createElement("tr");
    tr.innerHTML = `
        <td><input type="text" placeholder="e.g. B.3(1)" value="${data.itemNo || ""}"></td>
        <td><input type="text" placeholder="Description" value="${data.description || ""}"></td>
        <td><input type="text" class="pow-qty" inputmode="decimal" placeholder="0.00" value="${data.quantity || ""}"></td>
        <td><input type="text" placeholder="Unit" value="${data.unit || ""}"></td>
        <td class="pow-actions">
            <button type="button" class="pow-remove" title="Remove item">
                <i class='bx bx-trash'></i>
            </button>
        </td>
    `;
    revisedPowBody.appendChild(tr);
    applyPartRule(tr);
}

function initRevisedPow(data = []) {
    if (!revisedPowBody) return;
    revisedPowBody.innerHTML = "";
    if (Array.isArray(data) && data.length) {
        data.forEach(item => createRevisedPowRow(item));
    } else {
        createRevisedPowRow();
    }
}

function collectRevisedPow() {
    if (!revisedPowBody) return [];
    return Array.from(revisedPowBody.querySelectorAll("tr")).map(row => {
        const inputs = row.querySelectorAll("input");
        return {
            itemNo: inputs[0]?.value.trim() || "",
            description: inputs[1]?.value.trim() || "",
            quantity: inputs[2]?.value.trim() || "",
            unit: inputs[3]?.value.trim() || ""
        };
    }).filter(item => item.itemNo || item.description || item.quantity || item.unit);
}

addRevisedPowRowBtn?.addEventListener("click", () => createRevisedPowRow());

revisedPowBody?.addEventListener("click", (e) => {
    const removeBtn = e.target.closest(".pow-remove");
    if (!removeBtn) return;
    const row = removeBtn.closest("tr");
    if (!row) return;
    row.remove();
    if (revisedPowBody.children.length === 0) {
        createRevisedPowRow();
    }
});

revisedPowBody?.addEventListener("keydown", (e) => {
    const input = e.target;
    if (!(input instanceof HTMLInputElement)) return;
    if (e.key !== "Enter") return;
    e.preventDefault();
    createRevisedPowRow();
    const nextRow = revisedPowBody?.lastElementChild;
    const firstInput = nextRow?.querySelector("input");
    firstInput?.focus();
});

revisedPowBody?.addEventListener("input", (e) => {
    const input = e.target;
    if (!(input instanceof HTMLInputElement)) return;
    if (input.closest("tr")) {
        applyPartRule(input.closest("tr"));
    }
});

function applyPartRule(row) {
    if (!row) return;
    const inputs = row.querySelectorAll("input");
    if (inputs.length < 4) return;
    const itemNo = String(inputs[0].value || "").trim().toUpperCase();
    const isPart = itemNo.startsWith("PART");
    inputs[2].disabled = isPart;
    inputs[3].disabled = isPart;
    if (isPart) {
        inputs[2].value = "";
        inputs[3].value = "";
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

function sanitizeFilename(value) {
    return String(value || "Project Info")
        .replace(/[\\/:*?"<>|]/g, "-")
        .trim();
}

function toDate(value) {
    if (!value) return null;
    const raw = String(value).trim();
    if (!raw) return null;
    if (/^\d{4}-\d{2}-\d{2}$/.test(raw)) return new Date(`${raw}T00:00:00`);
    const parsed = new Date(raw);
    return Number.isNaN(parsed.getTime()) ? null : parsed;
}

function diffDays(start, end) {
    if (!start || !end) return "";
    const ms = end.getTime() - start.getTime();
    return Math.max(0, Math.ceil(ms / (1000 * 60 * 60 * 24)));
}

function buildContractInfoRows(data) {
    const start = toDate(data.startDate);
    const end = toDate(data.expirationDate);
    const duration = start && end ? diffDays(start, end) : "";
    const remaining = end ? diffDays(new Date(), end) : "";

    const formatMoney = (val) => {
        const formatted = formatMoneyDisplay(val);
        return formatted === "-" ? "" : formatted;
    };

    const location = data.location || "";
    const coordinates = data.coordinates || "";

    return [
        ["CONTRACT ID:", data.contractId || ""],
        ["CONTRACT NAME:", data.contractDescription || ""],
        ["LOCATION:", location],
        ["TYPE OF PROJECT:", data.category || ""],
        ["APPROPRIATION:", formatMoney(data.appropriation || "")],
        ["APPROVED BUDGET COST:", formatMoney(data.approvedBudgetCost || "")],
        ["CONTRACT AMOUNT:", formatMoney(data.contractCost || "")],
        ["CONTRACTOR:", data.contractor || ""],
        ["CONTRACT DURATION:", duration ? `${duration}` : ""],
        ["START DATE:", formatDateLong(data.startDate || "")],
        ["EXPIRATION DATE:", formatDateLong(data.expirationDate || "")],
        ["REMAINING DAYS:", remaining ? `${remaining}` : ""],
        ["STATUS OF PROJECT:", data.status || ""],
        ["PROJECT ENGINEER:", data.projectEngineer || ""],
        ["MATERIALS ENGINEER:", data.materialsEngineer || ""],
        ["PROJECT INSPECTOR:", data.projectInspector || ""],
        ["QUALITY ASSURANCE IN-CHARGE:", data.qaInCharge || ""],
        ["RESIDENT ENGINEER:", data.residentEngineer || ""],
        ["CONTRACTORS' MATERIALS ENGINEER:", data.contractorMaterialsEngineer || ""],
        ["LIMITS:", data.limits || ""],
        ["", "", "", ""],
        ["ITEM NO.", "DESCRIPTION", "QUANTITY", "UNIT"]
    ];
}

downloadContractBtn?.addEventListener("click", () => {
    if (!currentDetailsData) return;
    if (!window.XLSX) {
        alert("Excel export library not loaded.");
        return;
    }

    const rows = buildContractInfoRows(currentDetailsData);
    const powItems = currentDetailsData?.programWorks || [];
    if (Array.isArray(powItems) && powItems.length) {
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

    // Auto-size columns A-E based on content
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

    // Bold A1:A21
    for (let r = 0; r < Math.min(21, rows.length); r++) {
        const cellRef = XLSX.utils.encode_cell({ r, c: 0 });
        if (!ws[cellRef]) ws[cellRef] = { t: "s", v: "" };
        ws[cellRef].s = ws[cellRef].s || {};
        ws[cellRef].s.font = { ...(ws[cellRef].s.font || {}), bold: true };
    }
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Original");

    const id = currentDetailsData.contractId || "Project";
    const filename = `${sanitizeFilename(id)} - Project Info.xlsx`;
    XLSX.writeFile(wb, filename);
});

// Render gallery for a contract ID inside the details modal
function loadGalleryPhotos() {
    const raw = appStorage.getItem("galleryPhotos");
    if (!raw) return {};
    try {
        const parsed = JSON.parse(raw);
        return parsed && typeof parsed === "object" ? parsed : {};
    } catch (err) {
        return {};
    }
}

function renderGallery(contractId) {
    const container = document.getElementById('galleryContainer');
    if (!container) return;
    const key = normalizeContractId(contractId);

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

    const all = loadGalleryPhotos();
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

    if (photoModalImage) photoModalImage.src = src || "";
    if (photoId) photoId.textContent = `${currentGalleryContract}-photo-${currentGalleryIndex + 1}`;
    if (photoPurpose) photoPurpose.textContent = "Geotagged Photo";
    if (photoDate) photoDate.textContent = dateText;
    if (photoLocation) photoLocation.textContent = currentGalleryContract || "—";

    if (photoDownloadBtn) {
        const fallbackName = `${currentGalleryContract}-photo-${currentGalleryIndex + 1}.jpg`;
        photoDownloadBtn.href = src || "#";
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
// Close photo modal
function closePhotoModal() {
    const photoModal = document.getElementById('photoModal');
    if (photoModal) photoModal.classList.remove('open');
    currentGalleryItems = [];
    currentGalleryIndex = 0;
    currentGalleryContract = "";
}

// Wire close button and overlay background click (after DOM is ready)
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

// -------------------------------------------------------------------------------------------------
// RENDER DOCUMENTS
// -------------------------------------------------------------------------------------------------
const contractFilesKey = "contractFiles";
const contractFilesDataKey = "contractFilesData";

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

const documentsSectionDocs = {
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

function renderDocuments(contractId) {
    const container = document.getElementById('documentsContainer');
    if (!container) return;

    const key = String(contractId || "").trim().toUpperCase();

    container.innerHTML = '';

    if (!key) {
        container.innerHTML = `<div class="empty-state">No contract selected.</div>`;
        return;
    }

    const renderWithIndex = (index = {}) => {
        container.innerHTML = '';
        Object.entries(documentsSectionDocs).forEach(([section, docs]) => {
            const header = document.createElement('div');
            header.className = 'document-section-title';
            header.textContent = documentsSectionLabels[section] || section;
            container.appendChild(header);

            docs.forEach(doc => {
                const entry = index?.[section]?.[doc] || null;
                const fileName = entry?.fileName || entry?.name || '';
                const item = document.createElement('div');
                item.className = `document-item ${fileName ? 'doc-has-file' : 'doc-missing'}`;

                const safeDoc = escapeHtml(documentDisplayLabels[doc] || doc);
                const safeStatus = escapeHtml(fileName ? `File: ${fileName}` : 'No file uploaded');
                const iconClass = fileName ? 'bx-check-circle' : 'bx-x-circle';

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
                    const btn = document.createElement('button');
                    btn.className = 'document-item-action';
                    btn.innerHTML = '<i class="bx bx-show"></i>';
                    btn.title = 'View document';
                    btn.addEventListener('click', () => {
                        window.open(entry.url, '_blank');
                    });
                    item.appendChild(btn);
                }

                container.appendChild(item);
            });
        });
    };

    if (useRemoteStorage) {
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
                container.innerHTML = `<div class="empty-state">Failed to load documents.</div>`;
            });
        return;
    }

    const files = loadContractFiles();
    const fileData = loadContractFilesData();
    const localIndex = {};
    Object.entries(documentsSectionDocs).forEach(([section, docs]) => {
        if (!localIndex[section]) localIndex[section] = {};
        docs.forEach(doc => {
            const fileKey = getFileKey(`${section}:${doc}`, key);
            const fileName = files[fileKey] || '';
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

// -------------------------------------------------------------------------------------------------
// PROGRAM OF WORKS (DETAILS MODAL)
// -------------------------------------------------------------------------------------------------
function renderPowTable(container, items = []) {
    if (!container) return;

    if (!Array.isArray(items) || items.length === 0) {
        container.innerHTML = `
            <tr>
                <td colspan="5">No program of works added.</td>
            </tr>
        `;
        return;
    }

    container.innerHTML = items.map((row, index) => `
        <tr data-index="${index}">
            <td><span class="pow-item-badge">${row.itemNo || ""}</span></td>
            <td class="pow-description-text">${row.description || ""}</td>
            <td>${row.quantity || ""}</td>
            <td>${row.unit || ""}</td>
            <td class="pow-actions">
                <button type="button" class="pow-action-btn pow-move-btn pow-move-up" title="Move up" ${index === 0 ? "disabled" : ""}>
                    <i class='bx bx-chevron-up'></i>
                </button>
                <button type="button" class="pow-action-btn pow-move-btn pow-move-down" title="Move down" ${index === items.length - 1 ? "disabled" : ""}>
                    <i class='bx bx-chevron-down'></i>
                </button>
                <button type="button" class="pow-action-btn pow-edit-btn" title="Edit">
                    <i class='bx bx-edit'></i>
                </button>
                <button type="button" class="pow-action-btn pow-delete-btn" title="Delete">
                    <i class='bx bx-trash'></i>
                </button>
            </td>
        </tr>
    `).join("");
}

function renderProgramOfWorks(items = []) {
    renderPowTable(powDetailsBody, items);
}

function renderVariationOrders(orders = []) {
    if (!powVariationContainer) return;
    if (!Array.isArray(orders) || orders.length === 0) {
        powVariationContainer.innerHTML = "";
        return;
    }
    powVariationContainer.innerHTML = orders.map((items, idx) => `
        <div class="pow-variation-section" data-vo-index="${idx}">
            <div class="pow-header">
                <div class="pow-subheader">Variation Order #${idx + 1}</div>
                <div class="pow-vo-actions">
                    <button class="btn secondary pow-add-btn pow-add-vo" type="button" data-vo-index="${idx}">
                        <i class='bx bx-plus'></i>
                        Add Item
                    </button>
                    <button class="btn danger pow-delete-vo" type="button" data-vo-index="${idx}">
                        <i class='bx bx-trash'></i>
                        Delete VO
                    </button>
                </div>
            </div>
            <div class="pow-table-wrapper">
                <table class="pow-table pow-details-table">
                    <thead>
                        <tr>
                            <th>Item No.</th>
                            <th>Description</th>
                            <th>Quantity</th>
                            <th>Unit</th>
                            <th></th>
                        </tr>
                    </thead>
                    <tbody data-vo-index="${idx}"></tbody>
                </table>
            </div>
        </div>
    `).join("");

    orders.forEach((items, idx) => {
        const tbody = powVariationContainer.querySelector(`tbody[data-vo-index="${idx}"]`);
        renderPowTable(tbody, items);
    });
}

function persistPowFromDetails(items = []) {
    if (!currentDetailsData?.contractId) return;
    const contractId = currentDetailsData.contractId;
    setProjectPowMulti([contractId], items);
    const row = findRowByContractId(contractId);
    if (row) {
        row.dataset.programWorks = JSON.stringify(items || []);
    }
    currentDetailsData.programWorks = items || [];
}

const powDetailsBody = document.getElementById("powDetailsBody");
function finalizePowDetailsRow(row) {
    if (!row || !currentDetailsData) return;
    const inputs = row.querySelectorAll("input");
    if (!inputs.length) return;
    const updated = {
        itemNo: inputs[0]?.value.trim() || "",
        description: inputs[1]?.value.trim() || "",
        quantity: formatQuantity(inputs[2]?.value.trim() || ""),
        unit: inputs[3]?.value.trim() || ""
    };
    const index = Number(row.dataset.index || row.getAttribute("data-index"));
    const items = Array.isArray(currentDetailsData.programWorks) ? currentDetailsData.programWorks : [];
    if (Number.isNaN(index) || index < 0 || index >= items.length) {
        items.push(updated);
    } else {
        items[index] = updated;
    }
    persistPowFromDetails(items);
    renderProgramOfWorks(items);
}

function swapPowItems(indexA, indexB) {
    if (!currentDetailsData) return false;
    const items = Array.isArray(currentDetailsData.programWorks) ? currentDetailsData.programWorks : [];
    if (indexA < 0 || indexB < 0 || indexA >= items.length || indexB >= items.length) return false;
    const temp = items[indexA];
    items[indexA] = items[indexB];
    items[indexB] = temp;
    persistPowFromDetails(items);
    renderProgramOfWorks(items);
    return true;
}

function addPowDetailsRowAndFocus() {
    if (!powDetailsBody) return;
    if (!currentDetailsData) return;
    if (!currentDetailsCanEdit) {
        alert("You don't have permission to edit this project.");
        return;
    }
    const row = document.createElement("tr");
    row.classList.add("pow-editing");
    row.innerHTML = `
        <td><input type="text" placeholder="e.g. B.3(1)"></td>
        <td><input type="text" placeholder="Description"></td>
        <td><input type="text" class="pow-qty" inputmode="decimal" placeholder="0.00"></td>
        <td><input type="text" placeholder="Unit"></td>
        <td class="pow-actions">
            <button type="button" class="pow-action-btn pow-edit-btn" title="Save">
                <i class='bx bx-check'></i>
            </button>
            <button type="button" class="pow-action-btn pow-delete-btn" title="Delete">
                <i class='bx bx-trash'></i>
            </button>
        </td>
    `;
    row.dataset.index = String((currentDetailsData.programWorks || []).length);
    powDetailsBody.appendChild(row);
    row.querySelector("input")?.focus();
}

powDetailsBody?.addEventListener("click", (e) => {
    const row = e.target.closest("tr");
    if (!row || !currentDetailsData) return;
    if (!currentDetailsCanEdit) {
        return;
    }
    const index = Number(row.dataset.index || row.getAttribute("data-index"));
    const items = Array.isArray(currentDetailsData.programWorks) ? currentDetailsData.programWorks : [];

    const deleteBtn = e.target.closest(".pow-delete-btn");
    if (deleteBtn) {
        if (Number.isNaN(index)) {
            row.remove();
            persistPowFromDetails(items);
            renderProgramOfWorks(items);
            return;
        }
        items.splice(index, 1);
        persistPowFromDetails(items);
        renderProgramOfWorks(items);
        return;
    }

    const moveUpBtn = e.target.closest(".pow-move-up");
    if (moveUpBtn) {
        if (Number.isNaN(index)) return;
        if (swapPowItems(index, index - 1)) {
            const selector = `tr[data-index="${index - 1}"]`;
            powDetailsBody.querySelector(selector)?.scrollIntoView({ block: "nearest" });
        }
        return;
    }

    const moveDownBtn = e.target.closest(".pow-move-down");
    if (moveDownBtn) {
        if (Number.isNaN(index)) return;
        if (swapPowItems(index, index + 1)) {
            const selector = `tr[data-index="${index + 1}"]`;
            powDetailsBody.querySelector(selector)?.scrollIntoView({ block: "nearest" });
        }
        return;
    }

    const editBtn = e.target.closest(".pow-edit-btn");
    if (!editBtn) return;

    if (row.classList.contains("pow-editing")) {
        finalizePowDetailsRow(row);
        return;
    }

    // Enter edit mode
    row.classList.add("pow-editing");
    const item = items[index] || { itemNo: "", description: "", quantity: "", unit: "" };
    row.innerHTML = `
        <td><input type="text" value="${item.itemNo || ""}"></td>
        <td><input type="text" value="${item.description || ""}"></td>
        <td><input type="text" class="pow-qty" inputmode="decimal" value="${item.quantity || ""}"></td>
        <td><input type="text" value="${item.unit || ""}"></td>
        <td class="pow-actions">
            <button type="button" class="pow-action-btn pow-edit-btn" title="Save">
                <i class='bx bx-check'></i>
            </button>
            <button type="button" class="pow-action-btn pow-delete-btn" title="Delete">
                <i class='bx bx-trash'></i>
            </button>
        </td>
    `;
    row.dataset.index = index;
    applyPartRule(row);
});

addPowDetailsItemBtn?.addEventListener("click", () => {
    if (!currentDetailsCanEdit) {
        alert("You don't have permission to edit this project.");
        return;
    }
    addPowDetailsRowAndFocus();
});

powDetailsBody?.addEventListener("keydown", (e) => {
    const input = e.target;
    if (!(input instanceof HTMLInputElement)) return;
    if (!currentDetailsCanEdit) return;
    if (e.altKey && (e.key === "ArrowUp" || e.key === "ArrowDown")) {
        const row = input.closest("tr");
        if (!row) return;
        e.preventDefault();
        const index = Number(row.dataset.index || row.getAttribute("data-index"));
        if (Number.isNaN(index)) return;
        const nextIndex = e.key === "ArrowUp" ? index - 1 : index + 1;
        if (swapPowItems(index, nextIndex)) {
            const selector = `tr[data-index="${nextIndex}"] input`;
            const target = powDetailsBody.querySelector(selector);
            target?.focus();
        }
        return;
    }
    if (e.key !== "Enter") return;
    const row = input.closest("tr");
    if (!row) return;
    e.preventDefault();
    finalizePowDetailsRow(row);
    addPowDetailsRowAndFocus();
});

function getVariationOrdersForCurrent() {
    const contractId = currentDetailsData?.contractId || "";
    return getVariationOrder(contractId);
}

function persistVariationOrdersForCurrent(orders = []) {
    const contractId = currentDetailsData?.contractId || "";
    if (!contractId) return;
    setVariationOrder(contractId, orders);
    renderVariationOrders(orders);
}

function addVariationRowAndFocus(voIndex) {
    if (!powVariationContainer) return;
    if (!currentDetailsData) return;
    const tbody = powVariationContainer.querySelector(`tbody[data-vo-index="${voIndex}"]`);
    if (!tbody) return;
    const row = document.createElement("tr");
    row.classList.add("pow-editing");
    row.innerHTML = `
        <td><input type="text" placeholder="e.g. B.3(1)"></td>
        <td><input type="text" placeholder="Description"></td>
        <td><input type="text" class="pow-qty" inputmode="decimal" placeholder="0.00"></td>
        <td><input type="text" placeholder="Unit"></td>
        <td class="pow-actions">
            <button type="button" class="pow-action-btn pow-edit-btn" title="Save">
                <i class='bx bx-check'></i>
            </button>
            <button type="button" class="pow-action-btn pow-delete-btn" title="Delete">
                <i class='bx bx-trash'></i>
            </button>
        </td>
    `;
    const orders = getVariationOrdersForCurrent();
    row.dataset.index = String((orders[voIndex] || []).length);
    row.dataset.voIndex = String(voIndex);
    tbody.appendChild(row);
    row.querySelector("input")?.focus();
}

function finalizeVariationRow(row) {
    if (!row || !currentDetailsData) return;
    const inputs = row.querySelectorAll("input");
    if (!inputs.length) return;
    const updated = {
        itemNo: inputs[0]?.value.trim() || "",
        description: inputs[1]?.value.trim() || "",
        quantity: formatQuantity(inputs[2]?.value.trim() || ""),
        unit: inputs[3]?.value.trim() || ""
    };
    const index = Number(row.dataset.index || row.getAttribute("data-index"));
    const voIndex = Number(row.dataset.voIndex);
    const orders = getVariationOrdersForCurrent();
    const list = orders[voIndex] || [];
    if (Number.isNaN(index) || index < 0 || index >= list.length) {
        list.push(updated);
    } else {
        list[index] = updated;
    }
    orders[voIndex] = list;
    persistVariationOrdersForCurrent(orders);
}

function swapVariationItems(voIndex, indexA, indexB) {
    const orders = getVariationOrdersForCurrent();
    const list = orders[voIndex] || [];
    if (indexA < 0 || indexB < 0 || indexA >= list.length || indexB >= list.length) return false;
    const temp = list[indexA];
    list[indexA] = list[indexB];
    list[indexB] = temp;
    orders[voIndex] = list;
    persistVariationOrdersForCurrent(orders);
    return true;
}

powVariationContainer?.addEventListener("click", (e) => {
    if (!currentDetailsCanEdit) return;
    const deleteVoBtn = e.target.closest(".pow-delete-vo");
    if (deleteVoBtn) {
        const voIndex = Number(deleteVoBtn.dataset.voIndex);
        if (!Number.isNaN(voIndex)) {
            const section = deleteVoBtn.closest(".pow-variation-section");
            if (section) {
                section.classList.add("vo-removing");
            }
            setTimeout(() => {
                const orders = getVariationOrdersForCurrent();
                orders.splice(voIndex, 1);
                persistVariationOrdersForCurrent(orders);
            }, 200);
        }
        return;
    }

    const addBtn = e.target.closest(".pow-add-vo");
    if (addBtn) {
        const voIndex = Number(addBtn.dataset.voIndex);
        if (!Number.isNaN(voIndex)) addVariationRowAndFocus(voIndex);
        return;
    }

    const row = e.target.closest("tr");
    if (!row || !currentDetailsData) return;
    const index = Number(row.dataset.index || row.getAttribute("data-index"));
    const voIndex = Number(row.dataset.voIndex || row.closest("tbody")?.dataset.voIndex);

    const deleteBtn = e.target.closest(".pow-delete-btn");
    if (deleteBtn) {
        const orders = getVariationOrdersForCurrent();
        const list = orders[voIndex] || [];
        if (!Number.isNaN(index) && index >= 0 && index < list.length) {
            list.splice(index, 1);
        }
        orders[voIndex] = list;
        persistVariationOrdersForCurrent(orders);
        return;
    }

    const moveUpBtn = e.target.closest(".pow-move-up");
    if (moveUpBtn) {
        if (!Number.isNaN(index) && !Number.isNaN(voIndex)) {
            swapVariationItems(voIndex, index, index - 1);
        }
        return;
    }

    const moveDownBtn = e.target.closest(".pow-move-down");
    if (moveDownBtn) {
        if (!Number.isNaN(index) && !Number.isNaN(voIndex)) {
            swapVariationItems(voIndex, index, index + 1);
        }
        return;
    }

    const editBtn = e.target.closest(".pow-edit-btn");
    if (!editBtn) return;

    if (row.classList.contains("pow-editing")) {
        finalizeVariationRow(row);
        return;
    }

    const orders = getVariationOrdersForCurrent();
    const list = orders[voIndex] || [];
    const item = list[index] || { itemNo: "", description: "", quantity: "", unit: "" };
    row.classList.add("pow-editing");
    row.dataset.voIndex = String(voIndex);
    row.innerHTML = `
        <td><input type="text" value="${item.itemNo || ""}"></td>
        <td><input type="text" value="${item.description || ""}"></td>
        <td><input type="text" class="pow-qty" inputmode="decimal" value="${item.quantity || ""}"></td>
        <td><input type="text" value="${item.unit || ""}"></td>
        <td class="pow-actions">
            <button type="button" class="pow-action-btn pow-edit-btn" title="Save">
                <i class='bx bx-check'></i>
            </button>
            <button type="button" class="pow-action-btn pow-delete-btn" title="Delete">
                <i class='bx bx-trash'></i>
            </button>
        </td>
    `;
    row.dataset.index = String(index);
    applyPartRule(row);
});

powVariationContainer?.addEventListener("keydown", (e) => {
    const input = e.target;
    if (!(input instanceof HTMLInputElement)) return;
    if (!currentDetailsCanEdit) return;
    const row = input.closest("tr");
    if (!row) return;
    const index = Number(row.dataset.index || row.getAttribute("data-index"));
    const voIndex = Number(row.dataset.voIndex || row.closest("tbody")?.dataset.voIndex);
    if (e.altKey && (e.key === "ArrowUp" || e.key === "ArrowDown")) {
        e.preventDefault();
        const nextIndex = e.key === "ArrowUp" ? index - 1 : index + 1;
        if (!Number.isNaN(index) && !Number.isNaN(voIndex)) {
            if (swapVariationItems(voIndex, index, nextIndex)) {
                const selector = `tbody[data-vo-index="${voIndex}"] tr[data-index="${nextIndex}"] input`;
                powVariationContainer.querySelector(selector)?.focus();
            }
        }
        return;
    }
    if (e.key !== "Enter") return;
    e.preventDefault();
    finalizeVariationRow(row);
    addVariationRowAndFocus(voIndex);
});


function initProjectMap() {
    if (projectMap) return; // prevent re-initialization

    const projectLat = 11.7731947;
    const projectLng = 124.8856814;

    projectMap = L.map("projectMap").setView([projectLat, projectLng], 16);

    const streetLayer = L.tileLayer(
        "https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png",
        { attribution: "Â© OpenStreetMap contributors" }
    ).addTo(projectMap);

    const satelliteLayer = L.tileLayer(
        "https://{s}.google.com/vt/lyrs=s&x={x}&y={y}&z={z}",
        { subdomains: ["mt0", "mt1", "mt2", "mt3"] }
    );

    L.marker([projectLat, projectLng])
        .addTo(projectMap)
        .bindPopup("Project Location")
        .openPopup();

    // Toggle buttons
    streetBtn.onclick = () => {
        projectMap.removeLayer(satelliteLayer);
        streetLayer.addTo(projectMap);
    };

    satelliteBtn.onclick = () => {
        projectMap.removeLayer(streetLayer);
        satelliteLayer.addTo(projectMap);
    };
}


// --------------------------------------------------------------------------------------------------
// LOCATION DATA
// --------------------------------------------------------------------------------------------------
// DEFAULT COORDINATES (Catbalogan example)
const projectLat = 11.7731947;
const projectLng = 124.8856814;

// INIT MAP
const map = L.map("projectMap").setView([projectLat, projectLng], 16);
let projectMarker = null;

// STREET LAYER
const streetLayer = L.tileLayer(
    "https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png",
    { attribution: "Â© OpenStreetMap contributors" }
);

// SATELLITE LAYER
const satelliteLayer = L.tileLayer(
    "https://{s}.google.com/vt/lyrs=s&x={x}&y={y}&z={z}",
    {
        subdomains: ["mt0", "mt1", "mt2", "mt3"]
    }
);

// DEFAULT
streetLayer.addTo(map);

// MARKER
projectMarker = L.marker([projectLat, projectLng])
    .addTo(map)
    .bindPopup("Project Location")
    .openPopup();

// TOGGLE BUTTONS
const streetBtn = document.getElementById("streetBtn");
const satelliteBtn = document.getElementById("satelliteBtn");

streetBtn.addEventListener("click", () => {
    map.removeLayer(satelliteLayer);
    streetLayer.addTo(map);
    streetBtn.classList.add("active");
    satelliteBtn.classList.remove("active");
});

satelliteBtn.addEventListener("click", () => {
    map.removeLayer(streetLayer);
    satelliteLayer.addTo(map);
    satelliteBtn.classList.add("active");
    streetBtn.classList.remove("active");
});

function setMapLocation(lat, lng) {
    if (!map) return;
    const coords = [lat, lng];
    map.setView(coords, 16);
    if (projectMarker) {
        projectMarker.setLatLng(coords);
    } else {
        projectMarker = L.marker(coords).addTo(map).bindPopup("Project Location");
    }
}

// -----------------------------------------------------
// DETAILS MODAL TAB SWITCHING
// -----------------------------------------------------
const tabButtons = document.querySelectorAll(".tab-btn");
const tabContents = document.querySelectorAll(".modal-tabs .tab-content");

tabButtons.forEach(btn => {
    btn.addEventListener("click", () => {
        const target = btn.dataset.tab;
        const activeBtn = document.querySelector(".tab-btn.active");
        if (activeBtn === btn) return;

        const btnList = Array.from(tabButtons);
        const fromIndex = activeBtn ? btnList.indexOf(activeBtn) : 0;
        const toIndex = btnList.indexOf(btn);
        const direction = toIndex > fromIndex ? "forward" : "backward";

        // Update active button
        tabButtons.forEach(b => b.classList.remove("active"));
        btn.classList.add("active");

        // Show correct tab with slide transition
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

            // Fallback cleanup in case transitionend doesn't fire
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

        // IMPORTANT: Fix Leaflet map when Location tab opens
        if (target === "location" && window.projectMap) {
            setTimeout(() => {
                projectMap.invalidateSize();
            }, 200);
        }
    });
});














