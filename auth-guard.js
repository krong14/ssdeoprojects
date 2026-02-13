const sessionKey = "dpwh_current_user";

function getSession() {
  const fromLocal = appStorage.getItem(sessionKey);
  if (fromLocal) return fromLocal;
  return sessionStorage.getItem(sessionKey);
}

function clearSession() {
  appStorage.removeItem(sessionKey);
  sessionStorage.removeItem(sessionKey);
}

const session = getSession();
if (!session) {
  window.location.href = "index.html";
}

let sessionData = null;
try {
  sessionData = session ? JSON.parse(session) : null;
} catch (err) {
  sessionData = null;
}

const isAdmin = Boolean(sessionData?.isAdmin);
const isSuperAdmin = Boolean(sessionData?.isSuperAdmin || sessionData?.role === "superadmin");
window.DPWH_CURRENT_USER = sessionData || null;
window.DPWH_IS_ADMIN = isAdmin;
window.DPWH_IS_SUPERADMIN = isSuperAdmin;

function normalizeEmail(value) {
  return String(value || "").trim().toLowerCase();
}

function getOfficeFromUsersByEmail(email) {
  const target = normalizeEmail(email);
  if (!target) return "";
  try {
    const raw = appStorage.getItem("dpwh_users");
    const users = raw ? JSON.parse(raw) : [];
    if (!Array.isArray(users)) return "";
    const match = users.find(user => normalizeEmail(user?.email) === target);
    return String(match?.office || "").trim();
  } catch (err) {
    return "";
  }
}

function toSidebarOfficeLabel(office) {
  const raw = String(office || "").trim().replace(/\s+/g, " ");
  if (!raw) return "";
  if (/sub-district engineering office$/i.test(raw)) {
    return raw.replace(/sub-district engineering office$/i, "SDEO").trim();
  }
  if (/district engineering office$/i.test(raw)) {
    return raw.replace(/district engineering office$/i, "DEO").trim();
  }
  if (/engineering office$/i.test(raw)) {
    return raw.replace(/engineering office$/i, "EO").trim();
  }
  return raw;
}

const resolvedOffice = String(sessionData?.office || "").trim() || getOfficeFromUsersByEmail(sessionData?.email || "");
const sidebarOfficeLabel = toSidebarOfficeLabel(resolvedOffice);
if (sidebarOfficeLabel) {
  document.querySelectorAll(".sidebar .header-text .profession").forEach(el => {
    el.textContent = sidebarOfficeLabel;
  });
}

document.querySelectorAll("[data-admin-only]").forEach(el => {
  el.style.display = isAdmin ? "flex" : "none";
});

if (window.location.pathname.endsWith("admin.html") && !isAdmin) {
  window.location.href = "dashboard.html";
}

document.addEventListener("click", (e) => {
  const logoutLink = e.target.closest("[data-logout]");
  if (!logoutLink) return;
  e.preventDefault();
  clearSession();
  window.location.href = "index.html";
});
