const sessionKey = "dpwh_current_user";

function getSession() {
  const fromLocal = localStorage.getItem(sessionKey);
  if (fromLocal) return fromLocal;
  return sessionStorage.getItem(sessionKey);
}

function clearSession() {
  localStorage.removeItem(sessionKey);
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
window.DPWH_CURRENT_USER = sessionData || null;
window.DPWH_IS_ADMIN = isAdmin;

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
