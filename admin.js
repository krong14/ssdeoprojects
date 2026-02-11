const USERS_KEY = "dpwh_users";
const ADMIN_EMAILS = [
  "krong0814@gmail.com",
  "lemuel.malinao@gmail.com",
  "alanpancitojr@gmail.com"
];
const body = document.querySelector("body");
const sidebar = body?.querySelector(".sidebar");
const toggle = body?.querySelector(".toggle");
const modeSwitch = body?.querySelector(".toggle-switch");
const modeText = body?.querySelector(".mode-text");
const sidebarStateKey = "sidebarOpen";
const themeStateKey = "darkMode";

const pendingList = document.getElementById("pendingList");
const approvedList = document.getElementById("approvedList");
const blockedList = document.getElementById("blockedList");
const pendingCount = document.getElementById("pendingCount");
const approvedCount = document.getElementById("approvedCount");
const blockedCount = document.getElementById("blockedCount");
const totalCount = document.getElementById("totalCount");

const applySidebarState = () => {
  if (!sidebar) return;
  const stored = localStorage.getItem(sidebarStateKey);
  if (stored === null) return;
  const shouldBeOpen = stored === "true";
  sidebar.classList.toggle("close", !shouldBeOpen);
};

const applyThemeState = () => {
  const stored = localStorage.getItem(themeStateKey);
  if (stored === null) return;
  const isDark = stored === "true";
  body?.classList.toggle("dark", isDark);
  if (modeText) modeText.innerText = isDark ? "Light Mode" : "Dark Mode";
};

applySidebarState();
applyThemeState();

toggle?.addEventListener("click", () => {
  sidebar?.classList.toggle("close");
  const isOpen = sidebar ? !sidebar.classList.contains("close") : true;
  localStorage.setItem(sidebarStateKey, String(isOpen));
});

modeSwitch?.addEventListener("click", () => {
  body?.classList.toggle("dark");
  const isDark = body?.classList.contains("dark");
  localStorage.setItem(themeStateKey, String(isDark));
  if (modeText) modeText.innerText = isDark ? "Light Mode" : "Dark Mode";
});

function normalizeEmail(value) {
  return String(value || "").trim().toLowerCase();
}

function isAdminEmail(email) {
  const normalized = normalizeEmail(email);
  return ADMIN_EMAILS.some(admin => normalizeEmail(admin) === normalized);
}

function loadUsers() {
  const raw = localStorage.getItem(USERS_KEY);
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch (err) {
    return [];
  }
}

function saveUsers(list) {
  localStorage.setItem(USERS_KEY, JSON.stringify(list));
}

function updateUserStatus(email, status) {
  const users = loadUsers();
  const idx = users.findIndex(u => normalizeEmail(u.email) === normalizeEmail(email));
  if (idx === -1) return;
  users[idx].status = status;
  users[idx].updatedAt = new Date().toISOString();
  saveUsers(users);
  renderUsers();
}

function deleteUser(email) {
  const users = loadUsers();
  const filtered = users.filter(u => normalizeEmail(u.email) !== normalizeEmail(email));
  saveUsers(filtered);
  renderUsers();
}

function createUserCard(user, status) {
  const card = document.createElement("div");
  card.className = "admin-item";

  const info = document.createElement("div");
  const title = document.createElement("h4");
  title.textContent = user.name || "Unnamed User";
  const email = document.createElement("p");
  email.textContent = user.email || "";
  info.appendChild(title);
  info.appendChild(email);

  const meta = document.createElement("div");
  meta.className = "admin-item-meta";

  const section = document.createElement("span");
  section.className = "admin-tag";
  section.textContent = user.section || "No section";
  meta.appendChild(section);

  const statusTag = document.createElement("span");
  statusTag.className = "admin-tag";
  statusTag.textContent = status.toUpperCase();
  meta.appendChild(statusTag);

  info.appendChild(meta);

  const actions = document.createElement("div");
  actions.className = "admin-actions";

  if (status === "pending") {
    const approve = document.createElement("button");
    approve.className = "admin-btn approve";
    approve.textContent = "Approve";
    approve.addEventListener("click", () => updateUserStatus(user.email, "approved"));
    actions.appendChild(approve);

    const block = document.createElement("button");
    block.className = "admin-btn block";
    block.textContent = "Block";
    block.addEventListener("click", () => updateUserStatus(user.email, "blocked"));
    actions.appendChild(block);
  }

  if (status === "approved") {
    const revoke = document.createElement("button");
    revoke.className = "admin-btn secondary";
    revoke.textContent = "Revoke";
    revoke.addEventListener("click", () => updateUserStatus(user.email, "pending"));
    actions.appendChild(revoke);

    const block = document.createElement("button");
    block.className = "admin-btn block";
    block.textContent = "Block";
    block.addEventListener("click", () => updateUserStatus(user.email, "blocked"));
    actions.appendChild(block);
  }

  if (status === "blocked") {
    const approve = document.createElement("button");
    approve.className = "admin-btn approve";
    approve.textContent = "Approve";
    approve.addEventListener("click", () => updateUserStatus(user.email, "approved"));
    actions.appendChild(approve);

    const remove = document.createElement("button");
    remove.className = "admin-btn secondary";
    remove.textContent = "Delete";
    remove.addEventListener("click", () => deleteUser(user.email));
    actions.appendChild(remove);
  }

  card.appendChild(info);
  card.appendChild(actions);
  return card;
}

function renderSection(listEl, users, emptyText) {
  if (!listEl) return;
  listEl.innerHTML = "";
  if (!users.length) {
    const empty = document.createElement("div");
    empty.className = "admin-empty";
    empty.textContent = emptyText;
    listEl.appendChild(empty);
    return;
  }
  users.forEach(user => {
    const status = user.status || "pending";
    listEl.appendChild(createUserCard(user, status));
  });
}

function renderUsers() {
  const users = loadUsers().filter(u => !isAdminEmail(u.email));
  const normalized = users.map(u => ({
    ...u,
    status: u.status || "pending"
  }));

  const pending = normalized.filter(u => u.status === "pending");
  const approved = normalized.filter(u => u.status === "approved");
  const blocked = normalized.filter(u => u.status === "blocked");

  if (pendingCount) pendingCount.textContent = pending.length;
  if (approvedCount) approvedCount.textContent = approved.length;
  if (blockedCount) blockedCount.textContent = blocked.length;
  if (totalCount) totalCount.textContent = normalized.length;

  renderSection(pendingList, pending, "No pending signups.");
  renderSection(approvedList, approved, "No approved users yet.");
  renderSection(blockedList, blocked, "No blocked users.");
}

document.addEventListener("DOMContentLoaded", renderUsers);
