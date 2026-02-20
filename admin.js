const USERS_KEY = "dpwh_users";
const ADMIN_EMAILS_KEY = "dpwh_admin_emails";
const SUPERADMIN_EMAILS = [
  "krong0814@gmail.com"
];
const DEFAULT_MANAGED_ADMIN_EMAILS = [
  "lemuel.malinao@gmail.com",
  "alanpancitojr@gmail.com"
];
const PREAPPROVED_USER_EMAILS = [
  "vincecajefe@gmail.com",
  "kindredortillo25@gmail.com",
  "castillovjane@gmail.com",
  "eucelleturqueza2020@gmail.com",
  "junelmabanag2@gmail.com"
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

const adminEmailInput = document.getElementById("adminEmailInput");
const addAdminEmailBtn = document.getElementById("addAdminEmailBtn");
const adminEmailList = document.getElementById("adminEmailList");
const approvedEmailInput = document.getElementById("approvedEmailInput");
const addApprovedEmailBtn = document.getElementById("addApprovedEmailBtn");

const applySidebarState = () => {
  if (!sidebar) return;
  const stored = appStorage.getItem(sidebarStateKey);
  if (stored === null) return;
  const shouldBeOpen = stored === "true";
  sidebar.classList.toggle("close", !shouldBeOpen);
};

const applyThemeState = () => {
  const stored = appStorage.getItem(themeStateKey);
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
  appStorage.setItem(sidebarStateKey, String(isOpen));
});

modeSwitch?.addEventListener("click", () => {
  body?.classList.toggle("dark");
  const isDark = body?.classList.contains("dark");
  appStorage.setItem(themeStateKey, String(isDark));
  if (modeText) modeText.innerText = isDark ? "Light Mode" : "Dark Mode";
});

function normalizeEmail(value) {
  return String(value || "").trim().toLowerCase();
}

function isValidEmail(email) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

function isSuperAdminEmail(email) {
  const normalized = normalizeEmail(email);
  return SUPERADMIN_EMAILS.some(admin => normalizeEmail(admin) === normalized);
}

function getManagedAdminEmails() {
  const raw = appStorage.getItem(ADMIN_EMAILS_KEY);
  if (!raw) return [...DEFAULT_MANAGED_ADMIN_EMAILS];
  try {
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [...DEFAULT_MANAGED_ADMIN_EMAILS];
    const normalized = parsed
      .map(normalizeEmail)
      .filter(Boolean)
      .filter(email => !isSuperAdminEmail(email));
    return Array.from(new Set(normalized));
  } catch (err) {
    return [...DEFAULT_MANAGED_ADMIN_EMAILS];
  }
}

function saveManagedAdminEmails(list) {
  const normalized = Array.from(new Set(
    (Array.isArray(list) ? list : [])
      .map(normalizeEmail)
      .filter(Boolean)
      .filter(email => !isSuperAdminEmail(email))
  ));
  appStorage.setItem(ADMIN_EMAILS_KEY, JSON.stringify(normalized));
}

function ensureManagedAdminEmails() {
  const raw = appStorage.getItem(ADMIN_EMAILS_KEY);
  if (raw) return;
  saveManagedAdminEmails(DEFAULT_MANAGED_ADMIN_EMAILS);
}

function getAdminEmails() {
  const merged = [
    ...SUPERADMIN_EMAILS.map(normalizeEmail),
    ...getManagedAdminEmails().map(normalizeEmail)
  ].filter(Boolean);
  return Array.from(new Set(merged));
}

function isAdminEmail(email) {
  const normalized = normalizeEmail(email);
  return getAdminEmails().some(admin => normalizeEmail(admin) === normalized);
}

function loadUsers() {
  const raw = appStorage.getItem(USERS_KEY);
  if (!raw) {
    try {
      const localRaw = window.localStorage?.getItem(USERS_KEY);
      if (!localRaw) return [];
      const parsedLocal = JSON.parse(localRaw);
      return Array.isArray(parsedLocal) ? parsedLocal : [];
    } catch (err) {
      return [];
    }
  }
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch (err) {
    return [];
  }
}

function saveUsers(list) {
  appStorage.setItem(USERS_KEY, JSON.stringify(list));
  try {
    window.localStorage?.setItem(USERS_KEY, JSON.stringify(list));
  } catch (err) {
    // Ignore local storage write errors.
  }
}

function ensurePreApprovedUsers() {
  const users = loadUsers();
  const now = new Date().toISOString();
  let changed = false;

  PREAPPROVED_USER_EMAILS.forEach((emailValue) => {
    const email = normalizeEmail(emailValue);
    if (!email || isAdminEmail(email)) return;
    const idx = users.findIndex(u => normalizeEmail(u?.email) === email);
    if (idx === -1) {
      users.push({
        name: "",
        email,
        region: "",
        office: "",
        section: "",
        password: "",
        role: "user",
        status: "approved",
        preApproved: true,
        createdAt: now,
        updatedAt: now
      });
      changed = true;
      return;
    }

    const existing = users[idx] || {};
    const next = {
      ...existing,
      email,
      role: "user",
      status: "approved",
      preApproved: true,
      updatedAt: now
    };
    users[idx] = next;
    changed = true;
  });

  if (changed) saveUsers(users);
}

function syncUserRoleByEmail(email, makeAdmin) {
  const target = normalizeEmail(email);
  const users = loadUsers();
  const idx = users.findIndex(u => normalizeEmail(u?.email) === target);
  if (idx === -1) return;
  const user = users[idx];
  if (isSuperAdminEmail(target)) {
    user.role = "superadmin";
    user.status = "approved";
  } else if (makeAdmin) {
    user.role = "admin";
    user.status = "approved";
  } else if (String(user.role || "").toLowerCase() === "admin") {
    user.role = "user";
  }
  user.updatedAt = new Date().toISOString();
  saveUsers(users);
}

function updateCurrentSessionRole(email, makeAdmin) {
  const target = normalizeEmail(email);
  const update = (raw) => {
    if (!raw) return null;
    try {
      const session = JSON.parse(raw);
      if (normalizeEmail(session?.email) !== target) return raw;
      const isSuperAdmin = Boolean(session?.isSuperAdmin || isSuperAdminEmail(target));
      const isAdmin = isSuperAdmin || Boolean(makeAdmin);
      const role = isSuperAdmin ? "superadmin" : (isAdmin ? "admin" : "user");
      return JSON.stringify({ ...session, isAdmin, isSuperAdmin, role });
    } catch (err) {
      return raw;
    }
  };

  const local = appStorage.getItem("dpwh_current_user");
  const nextLocal = update(local);
  if (nextLocal !== null && nextLocal !== local) appStorage.setItem("dpwh_current_user", nextLocal);

  const session = sessionStorage.getItem("dpwh_current_user");
  const nextSession = update(session);
  if (nextSession !== null && nextSession !== session) sessionStorage.setItem("dpwh_current_user", nextSession);
}

function updateUserStatus(email, status) {
  if (isSuperAdminEmail(email)) return;
  const users = loadUsers();
  const idx = users.findIndex(u => normalizeEmail(u.email) === normalizeEmail(email));
  if (idx === -1) return;
  users[idx].status = status;
  users[idx].updatedAt = new Date().toISOString();
  saveUsers(users);
  renderUsers();
}

function deleteUser(email) {
  if (isSuperAdminEmail(email)) return;
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

function renderAdminEmails() {
  if (!adminEmailList) return;
  adminEmailList.innerHTML = "";
  const list = getAdminEmails().slice().sort();
  if (!list.length) {
    const empty = document.createElement("div");
    empty.className = "admin-empty";
    empty.textContent = "No admin emails yet.";
    adminEmailList.appendChild(empty);
    return;
  }

  list.forEach((emailValue) => {
    const isSuper = isSuperAdminEmail(emailValue);
    const item = document.createElement("div");
    item.className = "admin-item";

    const info = document.createElement("div");
    const title = document.createElement("h4");
    title.textContent = emailValue;
    const subtitle = document.createElement("p");
    subtitle.textContent = isSuper ? "Superadmin (fixed)" : "Admin email";
    info.appendChild(title);
    info.appendChild(subtitle);
    item.appendChild(info);

    const actions = document.createElement("div");
    actions.className = "admin-actions";
    if (!isSuper) {
      const removeBtn = document.createElement("button");
      removeBtn.className = "admin-btn secondary";
      removeBtn.textContent = "Remove";
      removeBtn.addEventListener("click", () => {
        const managed = getManagedAdminEmails().filter(e => normalizeEmail(e) !== normalizeEmail(emailValue));
        saveManagedAdminEmails(managed);
        syncUserRoleByEmail(emailValue, false);
        updateCurrentSessionRole(emailValue, false);
        renderAdminEmails();
        renderUsers();
      });
      actions.appendChild(removeBtn);
    }
    item.appendChild(actions);
    adminEmailList.appendChild(item);
  });
}

function addAdminEmail() {
  const email = normalizeEmail(adminEmailInput?.value);
  if (!email) {
    alert("Please enter an email.");
    return;
  }
  if (!isValidEmail(email)) {
    alert("Please enter a valid email.");
    return;
  }
  if (isSuperAdminEmail(email)) {
    alert("This email is already a fixed superadmin.");
    return;
  }
  const managed = getManagedAdminEmails();
  if (managed.includes(email)) {
    alert("This email is already in the admin list.");
    return;
  }

  managed.push(email);
  saveManagedAdminEmails(managed);
  syncUserRoleByEmail(email, true);
  updateCurrentSessionRole(email, true);
  if (adminEmailInput) adminEmailInput.value = "";
  renderAdminEmails();
  renderUsers();
}

function addApprovedEmail() {
  const email = normalizeEmail(approvedEmailInput?.value);
  if (!email) {
    alert("Please enter an email.");
    return;
  }
  if (!isValidEmail(email)) {
    alert("Please enter a valid email.");
    return;
  }
  if (isAdminEmail(email)) {
    alert("This email is an admin/superadmin email.");
    return;
  }

  const users = loadUsers();
  const idx = users.findIndex(u => normalizeEmail(u?.email) === email);
  if (idx >= 0) {
    const user = users[idx] || {};
    users[idx] = {
      ...user,
      email,
      role: "user",
      status: "approved",
      preApproved: true,
      updatedAt: new Date().toISOString()
    };
  } else {
    const now = new Date().toISOString();
    users.push({
      name: "",
      email,
      region: "",
      office: "",
      section: "",
      password: "",
      role: "user",
      status: "approved",
      preApproved: true,
      createdAt: now,
      updatedAt: now
    });
  }

  saveUsers(users);
  if (approvedEmailInput) approvedEmailInput.value = "";
  renderUsers();
}

document.addEventListener("DOMContentLoaded", () => {
  ensureManagedAdminEmails();
  ensurePreApprovedUsers();
  renderAdminEmails();
  renderUsers();
  addAdminEmailBtn?.addEventListener("click", addAdminEmail);
  addApprovedEmailBtn?.addEventListener("click", addApprovedEmail);
  adminEmailInput?.addEventListener("keydown", (event) => {
    if (event.key === "Enter") {
      event.preventDefault();
      addAdminEmail();
    }
  });
  approvedEmailInput?.addEventListener("keydown", (event) => {
    if (event.key === "Enter") {
      event.preventDefault();
      addApprovedEmail();
    }
  });
});
