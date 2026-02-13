const USERS_KEY = "dpwh_users";
const SESSION_KEY = "dpwh_current_user";
const ADMIN_EMAILS_KEY = "dpwh_admin_emails";
const SUPERADMIN_EMAILS = [
  "krong0814@gmail.com"
];
const DEFAULT_MANAGED_ADMIN_EMAILS = [
  "lemuel.malinao@gmail.com",
  "alanpancitojr@gmail.com"
];
const EMPLOYEE_CODE_PREFIX = "DPWH-SSDEO";
const SECTION_CODES = Object.freeze({
  "Planning and Design Section": "PDS",
  "Construction Section": "CONS",
  "Quality Assurance Section": "QAS",
  "Contractor Side": "CTR",
  "Administration": "ADM"
});
const SECTION_ALIASES = Object.freeze({
  "Planning Section": "Planning and Design Section",
  "Planning and Design Section": "Planning and Design Section",
  "Construction Section": "Construction Section",
  "Quality Assurance": "Quality Assurance Section",
  "Quality Assurance Section": "Quality Assurance Section",
  "Contractor Side": "Contractor Side",
  "Administration": "Administration"
});

function isSuperAdminEmail(email) {
  const normalized = normalizeEmail(email);
  return SUPERADMIN_EMAILS.some(admin => normalizeEmail(admin) === normalized);
}

function isAdminEmail(email) {
  const normalized = normalizeEmail(email);
  return getAdminEmails().some(admin => normalizeEmail(admin) === normalized);
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

function saveUsers(list) {
  appStorage.setItem(USERS_KEY, JSON.stringify(list));
}

function normalizeSection(value) {
  const raw = String(value || "").trim();
  return SECTION_ALIASES[raw] || raw;
}

function getSectionCode(section) {
  const normalized = normalizeSection(section);
  return SECTION_CODES[normalized] || "GEN";
}

function generateUserId() {
  try {
    if (window.crypto?.randomUUID) {
      return `usr_${window.crypto.randomUUID()}`;
    }
  } catch (err) {
    // Fallback below.
  }
  return `usr_${Date.now().toString(36)}${Math.random().toString(36).slice(2, 10)}`;
}

function parseEmployeeCode(code) {
  const normalized = String(code || "").trim().toUpperCase();
  const match = normalized.match(/^DPWH-SSDEO-([A-Z]+)-(\d{4})$/);
  if (!match) return null;
  return {
    sectionCode: match[1],
    sequence: Number(match[2])
  };
}

function buildEmployeeCode(sectionCode, sequence) {
  const safeCode = String(sectionCode || "GEN").trim().toUpperCase();
  const safeSequence = Number(sequence) || 0;
  return `${EMPLOYEE_CODE_PREFIX}-${safeCode}-${String(safeSequence).padStart(4, "0")}`;
}

function ensureUserIdentifiers(users) {
  const list = Array.isArray(users) ? users : [];
  let changed = false;
  const usedUserIds = new Set();
  const sectionMaxSequence = {};

  list.forEach((user) => {
    const currentId = String(user?.userId || "").trim();
    if (currentId) usedUserIds.add(currentId);
    const parsed = parseEmployeeCode(user?.employeeCode);
    if (parsed && parsed.sequence > 0) {
      const key = parsed.sectionCode;
      sectionMaxSequence[key] = Math.max(sectionMaxSequence[key] || 0, parsed.sequence);
    }
  });

  list.forEach((user) => {
    const normalizedSection = normalizeSection(user?.section || "");
    if (normalizedSection !== user?.section) {
      user.section = normalizedSection;
      changed = true;
    }

    const existingId = String(user?.userId || "").trim();
    if (!existingId || usedUserIds.has(existingId) && list.filter(item => String(item?.userId || "").trim() === existingId).length > 1) {
      let nextId = "";
      do {
        nextId = generateUserId();
      } while (usedUserIds.has(nextId));
      user.userId = nextId;
      usedUserIds.add(nextId);
      changed = true;
    }

    const parsedCode = parseEmployeeCode(user?.employeeCode);
    if (!parsedCode) {
      const code = getSectionCode(user?.section || "");
      const nextSeq = (sectionMaxSequence[code] || 0) + 1;
      sectionMaxSequence[code] = nextSeq;
      user.employeeCode = buildEmployeeCode(code, nextSeq);
      changed = true;
    }
  });

  return changed;
}

function ensureSuperAdminUser() {
  const users = loadUsers();
  const now = new Date().toISOString();
  let changed = false;

  SUPERADMIN_EMAILS.forEach((email) => {
    const normalizedEmail = normalizeEmail(email);
    const idx = users.findIndex(u => normalizeEmail(u?.email) === normalizedEmail);
    if (idx === -1) {
      users.push({
        name: "Super Admin",
        email: normalizedEmail,
        section: "Administration",
        password: "",
        status: "approved",
        role: "superadmin",
        userId: generateUserId(),
        createdAt: now,
        updatedAt: now
      });
      changed = true;
      return;
    }

    const existing = users[idx] || {};
    const nextRole = "superadmin";
    const nextStatus = "approved";
    if (existing.role !== nextRole || existing.status !== nextStatus) {
      users[idx] = {
        ...existing,
        email: normalizedEmail,
        role: nextRole,
        status: nextStatus,
        updatedAt: now
      };
      changed = true;
    }
  });

  if (ensureUserIdentifiers(users)) changed = true;
  if (changed) saveUsers(users);
}

function setMessage(el, msg, type = "error") {
  if (!el) return;
  el.textContent = msg;
  el.classList.remove("error", "success", "show");
  el.classList.add(type, "show");
}

function clearMessage(el) {
  if (!el) return;
  el.textContent = "";
  el.classList.remove("error", "success", "show");
}

function normalizeEmail(value) {
  return String(value || "").trim().toLowerCase();
}

function storeSession(user, remember) {
  const isSuperAdmin = isSuperAdminEmail(user.email);
  const isAdmin = isSuperAdmin || isAdminEmail(user.email);
  const payload = {
    userId: user.userId || "",
    employeeCode: user.employeeCode || "",
    email: user.email,
    name: user.name,
    section: user.section,
    sectionCode: getSectionCode(user.section),
    role: isSuperAdmin ? "superadmin" : (isAdmin ? "admin" : "user"),
    isAdmin,
    isSuperAdmin,
    loginAt: new Date().toISOString()
  };
  const json = JSON.stringify(payload);
  if (remember) {
    appStorage.setItem(SESSION_KEY, json);
    sessionStorage.removeItem(SESSION_KEY);
  } else {
    sessionStorage.setItem(SESSION_KEY, json);
    appStorage.removeItem(SESSION_KEY);
  }
}

function initLogin() {
  const form = document.getElementById("loginForm");
  const emailInput = document.getElementById("loginEmail");
  const passInput = document.getElementById("loginPassword");
  const rememberInput = document.getElementById("rememberMe");
  const messageEl = document.getElementById("formMessage");

  form?.addEventListener("submit", (e) => {
    e.preventDefault();
    clearMessage(messageEl);

    const email = normalizeEmail(emailInput?.value);
    const password = String(passInput?.value || "");
    if (!email || !password) {
      setMessage(messageEl, "Please enter your email and password.");
      return;
    }

    const users = loadUsers();
    const user = users.find(u => normalizeEmail(u.email) === email);
    if (!user || user.password !== password) {
      setMessage(messageEl, "Invalid email or password.");
      return;
    }
    const isSuperAdmin = isSuperAdminEmail(user.email);
    const isAdmin = isSuperAdmin || isAdminEmail(user.email);
    if (!isAdmin) {
      const status = user.status || "pending";
      if (status !== "approved") {
        const msg = status === "blocked"
          ? "Your account was blocked. Please contact the admin."
          : "Your account is pending approval. Please wait for admin approval.";
        setMessage(messageEl, msg);
        return;
      }
    } else if (!user.status || user.status !== "approved" || (isSuperAdmin && user.role !== "superadmin")) {
      user.status = "approved";
      if (isSuperAdmin) user.role = "superadmin";
      saveUsers(users);
    }

    storeSession(user, Boolean(rememberInput?.checked));
    window.location.href = "dashboard.html";
  });
}

function initSignup() {
  const form = document.getElementById("signupForm");
  const nameInput = document.getElementById("signupName");
  const emailInput = document.getElementById("signupEmail");
  const sectionInput = document.getElementById("signupSection");
  const passInput = document.getElementById("signupPassword");
  const confirmInput = document.getElementById("signupConfirm");
  const messageEl = document.getElementById("formMessage");

  form?.addEventListener("submit", (e) => {
    e.preventDefault();
    clearMessage(messageEl);

    const name = String(nameInput?.value || "").trim().toUpperCase();
    const email = normalizeEmail(emailInput?.value);
    const section = normalizeSection(sectionInput?.value || "");
    const password = String(passInput?.value || "");
    const confirm = String(confirmInput?.value || "");

    if (!name || !email || !section || !password || !confirm) {
      setMessage(messageEl, "Please complete all required fields.");
      return;
    }
    if (password.length < 6) {
      setMessage(messageEl, "Password must be at least 6 characters.");
      return;
    }
    if (password !== confirm) {
      setMessage(messageEl, "Passwords do not match.");
      return;
    }

    const users = loadUsers();
    const exists = users.some(u => normalizeEmail(u.email) === email);
    if (exists) {
      setMessage(messageEl, "An account with this email already exists.");
      return;
    }

    const isSuperAdmin = isSuperAdminEmail(email);
    const isAdmin = isSuperAdmin || isAdminEmail(email);
    const user = {
      name,
      email,
      section,
      password,
      userId: generateUserId(),
      employeeCode: "",
      role: isSuperAdmin ? "superadmin" : (isAdmin ? "admin" : "user"),
      status: isAdmin ? "approved" : "pending",
      createdAt: new Date().toISOString()
    };
    users.push(user);
    ensureUserIdentifiers(users);
    saveUsers(users);
    if (isAdmin) {
      storeSession(user, true);
      setMessage(
        messageEl,
        isSuperAdmin ? "Superadmin account created. Redirecting..." : "Admin account created. Redirecting...",
        "success"
      );
      setTimeout(() => {
        window.location.href = "dashboard.html";
      }, 800);
      return;
    }
    setMessage(messageEl, "Account created. Awaiting admin approval.", "success");
    setTimeout(() => {
      window.location.href = "index.html";
    }, 900);
  });
}

function initForgot() {
  const form = document.getElementById("resetForm");
  const emailInput = document.getElementById("resetEmail");
  const passInput = document.getElementById("resetPassword");
  const confirmInput = document.getElementById("resetConfirm");
  const messageEl = document.getElementById("formMessage");

  form?.addEventListener("submit", (e) => {
    e.preventDefault();
    clearMessage(messageEl);

    const email = normalizeEmail(emailInput?.value);
    const password = String(passInput?.value || "");
    const confirm = String(confirmInput?.value || "");

    if (!email || !password || !confirm) {
      setMessage(messageEl, "Please fill in all fields.");
      return;
    }
    if (password.length < 6) {
      setMessage(messageEl, "Password must be at least 6 characters.");
      return;
    }
    if (password !== confirm) {
      setMessage(messageEl, "Passwords do not match.");
      return;
    }

    const users = loadUsers();
    const idx = users.findIndex(u => normalizeEmail(u.email) === email);
    if (idx === -1) {
      setMessage(messageEl, "No account found for that email.");
      return;
    }
    users[idx].password = password;
    users[idx].updatedAt = new Date().toISOString();
    saveUsers(users);
    setMessage(messageEl, "Password updated. You can login now.", "success");
    setTimeout(() => {
      window.location.href = "index.html";
    }, 800);
  });
}

document.addEventListener("DOMContentLoaded", () => {
  ensureManagedAdminEmails();
  ensureSuperAdminUser();
  const users = loadUsers();
  if (ensureUserIdentifiers(users)) saveUsers(users);
  const page = document.body.getAttribute("data-page");
  if (page === "login") initLogin();
  if (page === "signup") initSignup();
  if (page === "forgot") initForgot();
});



