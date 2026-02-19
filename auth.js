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
const PREAPPROVED_USER_EMAILS = [
  "vincecajefe@gmail.com",
  "kindredortillo25@gmail.com",
  "castillovjane@gmail.com"
];
const EMPLOYEE_CODE_PREFIX = "DPWH";
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
const OFFICE_CODE_OVERRIDES = Object.freeze({
  "SAMAR 2ND DISTRICT ENGINEERING OFFICE": "SSDEO"
});
const DPWH_REGIONS = Object.freeze([
  "NCR",
  "CAR",
  "Region I",
  "Region II",
  "Region III",
  "Region IV-A",
  "Region IV-B",
  "Region V",
  "Region VI",
  "NIR",
  "Region VII",
  "Region VIII",
  "Region IX",
  "Region X",
  "Region XI",
  "Region XII",
  "Region XIII"
]);
const DPWH_OFFICES_BY_REGION = Object.freeze({
  "NCR": [
    "Las Pinas-Muntinlupa District Engineering Office",
    "Malabon-Navotas District Engineering Office",
    "Metro Manila 1st District Engineering Office",
    "Metro Manila 2nd District Engineering Office",
    "Metro Manila 3rd District Engineering Office",
    "North Manila District Engineering Office",
    "Quezon City 1st District Engineering Office",
    "Quezon City 2nd District Engineering Office",
    "South Manila District Engineering Office"
  ],
  "CAR": [
    "Abra District Engineering Office",
    "Apayao 1st District Engineering Office",
    "Apayao 2nd District Engineering Office",
    "Baguio City District Engineering Office",
    "Benguet 1st District Engineering Office",
    "Benguet 2nd District Engineering Office",
    "Ifugao 1st District Engineering Office",
    "Ifugao 2nd District Engineering Office",
    "Lower Kalinga District Engineering Office",
    "Mountain Province 1st District Engineering Office",
    "Mountain Province 2nd District Engineering Office",
    "Upper Kalinga District Engineering Office"
  ],
  "Region I": [
    "Ilocos Norte 1st District Engineering Office",
    "Ilocos Norte 2nd District Engineering Office",
    "Ilocos Sur 1st District Engineering Office",
    "Ilocos Sur 2nd District Engineering Office",
    "La Union 1st District Engineering Office",
    "La Union 2nd District Engineering Office",
    "Pangasinan 1st District Engineering Office",
    "Pangasinan 2nd District Engineering Office",
    "Pangasinan 3rd District Engineering Office",
    "Pangasinan 4th District Engineering Office"
  ],
  "Region II": [
    "Batanes District Engineering Office",
    "Cagayan 1st District Engineering Office",
    "Cagayan 2nd District Engineering Office",
    "Cagayan 3rd District Engineering Office",
    "Isabela 1st District Engineering Office",
    "Isabela 2nd District Engineering Office",
    "Isabela 3rd District Engineering Office",
    "Isabela 4th District Engineering Office",
    "Nueva Vizcaya 1st District Engineering Office",
    "Nueva Vizcaya 2nd District Engineering Office",
    "Quirino District Engineering Office"
  ],
  "Region III": [
    "Aurora District Engineering Office",
    "Bataan 1st District Engineering Office",
    "Bataan 2nd District Engineering Office",
    "Bataan 3rd District Engineering Office",
    "Bulacan 1st District Engineering Office",
    "Bulacan 2nd District Engineering Office",
    "Bulacan 3rd District Engineering Office",
    "Nueva Ecija 1st District Engineering Office",
    "Nueva Ecija 2nd District Engineering Office",
    "Pampanga 1st District Engineering Office",
    "Pampanga 2nd District Engineering Office",
    "Pampanga 3rd District Engineering Office",
    "Tarlac 1st District Engineering Office",
    "Tarlac 2nd District Engineering Office",
    "Zambales 1st District Engineering Office",
    "Zambales 2nd District Engineering Office"
  ],
  "Region IV-A": [
    "Batangas 1st District Engineering Office",
    "Batangas 2nd District Engineering Office",
    "Batangas 3rd District Engineering Office",
    "Batangas 4th District Engineering Office",
    "Cavite 1st District Engineering Office",
    "Cavite 2nd District Engineering Office",
    "Cavite 3rd District Engineering Office",
    "Laguna 1st District Engineering Office",
    "Laguna 2nd District Engineering Office",
    "Laguna 3rd District Engineering Office",
    "Quezon 1st District Engineering Office",
    "Quezon 2nd District Engineering Office",
    "Quezon 3rd District Engineering Office",
    "Quezon 4th District Engineering Office",
    "Rizal 1st District Engineering Office",
    "Rizal 2nd District Engineering Office"
  ],
  "Region IV-B": [
    "Marinduque District Engineering Office",
    "Mindoro Occidental District Engineering Office",
    "Mindoro Oriental District Engineering Office",
    "Palawan 1st District Engineering Office",
    "Palawan 2nd District Engineering Office",
    "Palawan 3rd District Engineering Office",
    "Romblon District Engineering Office",
    "Southern Mindoro District Engineering Office"
  ],
  "Region V": [
    "Albay 1st District Engineering Office",
    "Albay 2nd District Engineering Office",
    "Albay 3rd District Engineering Office",
    "Camarines Norte District Engineering Office",
    "Camarines Norte Sub-District Engineering Office",
    "Camarines Sur 1st District Engineering Office",
    "Camarines Sur 2nd District Engineering Office",
    "Camarines Sur 3rd District Engineering Office",
    "Camarines Sur 4th District Engineering Office",
    "Camarines Sur 5th District Engineering Office",
    "Catanduanes District Engineering Office",
    "Masbate 1st District Engineering Office",
    "Masbate 2nd District Engineering Office",
    "Masbate 3rd District Engineering Office",
    "Sorsogon 1st District Engineering Office",
    "Sorsogon 2nd District Engineering Office"
  ],
  "Region VI": [
    "Aklan District Engineering Office",
    "Antique District Engineering Office",
    "Capiz 1st District Engineering Office",
    "Capiz 2nd District Engineering Office",
    "Guimaras District Engineering Office",
    "Iloilo 1st District Engineering Office",
    "Iloilo 2nd District Engineering Office",
    "Iloilo 3rd District Engineering Office",
    "Iloilo 4th District Engineering Office",
    "Iloilo 6th District Engineering Office",
    "Iloilo City District Engineering Office"
  ],
  "NIR": [
    "Bacolod City District Engineering Office",
    "Negros Occidental 1st District Engineering Office",
    "Negros Occidental 2nd District Engineering Office",
    "Negros Occidental 3rd District Engineering Office",
    "Negros Occidental 4th District Engineering Office",
    "Negros Occidental 5th District Engineering Office",
    "Negros Oriental 1st District Engineering Office",
    "Negros Oriental 2nd District Engineering Office",
    "Negros Oriental 3rd District Engineering Office",
    "Siquijor District Engineering Office"
  ],
  "Region VII": [
    "Bohol 1st District Engineering Office",
    "Bohol 2nd District Engineering Office",
    "Bohol 3rd District Engineering Office",
    "Cebu 1st District Engineering Office",
    "Cebu 2nd District Engineering Office",
    "Cebu 3rd District Engineering Office",
    "Cebu 4th District Engineering Office",
    "Cebu 5th District Engineering Office",
    "Cebu 6th District Engineering Office",
    "Cebu 7th District Engineering Office",
    "Cebu City District Engineering Office"
  ],
  "Region VIII": [
    "Biliran District Engineering Office",
    "Eastern Samar District Engineering Office",
    "Leyte 1st District Engineering Office",
    "Leyte 2nd District Engineering Office",
    "Leyte 3rd District Engineering Office",
    "Leyte 4th District Engineering Office",
    "Leyte 5th District Engineering Office",
    "Northern Samar 1st District Engineering Office",
    "Northern Samar 2nd District Engineering Office",
    "Samar 1st District Engineering Office",
    "Samar 2nd District Engineering Office",
    "Southern Leyte 1st District Engineering Office",
    "Southern Leyte 2nd District Engineering Office",
    "Tacloban City District Engineering Office"
  ],
  "Region IX": [
    "Isabela City District Engineering Office",
    "Zamboanga City 1st District Engineering Office",
    "Zamboanga City 2nd District Engineering Office",
    "Zamboanga del Norte 1st District Engineering Office",
    "Zamboanga del Norte 2nd District Engineering Office",
    "Zamboanga del Norte 3rd District Engineering Office",
    "Zamboanga del Norte 4th District Engineering Office",
    "Zamboanga del Sur 1st District Engineering Office",
    "Zamboanga del Sur 2nd District Engineering Office",
    "Zamboanga Sibugay 1st District Engineering Office",
    "Zamboanga Sibugay 2nd District Engineering Office"
  ],
  "Region X": [
    "Bukidnon 1st District Engineering Office",
    "Bukidnon 2nd District Engineering Office",
    "Bukidnon 3rd District Engineering Office",
    "Bukidnon 4th District Engineering Office",
    "Cagayan de Oro City 1st District Engineering Office",
    "Cagayan de Oro City 2nd District Engineering Office",
    "Camiguin District Engineering Office",
    "Iligan City District Engineering Office",
    "Lanao del Norte 1st District Engineering Office",
    "Lanao del Norte 2nd District Engineering Office",
    "Misamis Occidental 1st District Engineering Office",
    "Misamis Occidental 2nd District Engineering Office",
    "Misamis Oriental 1st District Engineering Office",
    "Misamis Oriental 2nd District Engineering Office"
  ],
  "Region XI": [
    "Davao City 2nd District Engineering Office",
    "Davao City 3rd District Engineering Office",
    "Davao City District Engineering Office",
    "Davao de Oro 1st District Engineering Office",
    "Davao de Oro 2nd District Engineering Office",
    "Davao del Norte 2nd District Engineering Office",
    "Davao del Norte District Engineering Office",
    "Davao del Sur District Engineering Office",
    "Davao Occidental District Engineering Office",
    "Davao Oriental 1st District Engineering Office",
    "Davao Oriental 2nd District Engineering Office"
  ],
  "Region XII": [
    "Cotabato 1st District Engineering Office",
    "Cotabato 2nd District Engineering Office",
    "Cotabato 3rd District Engineering Office",
    "Sarangani District Engineering Office",
    "South Cotabato 1st District Engineering Office",
    "South Cotabato 2nd District Engineering Office",
    "Sultan Kudarat 1st District Engineering Office",
    "Sultan Kudarat 2nd District Engineering Office"
  ],
  "Region XIII": [
    "Agusan del Norte District Engineering Office",
    "Agusan del Sur 1st District Engineering Office",
    "Agusan del Sur 2nd District Engineering Office",
    "Butuan City District Engineering Office",
    "Dinagat Islands District Engineering Office",
    "Surigao del Norte 1st District Engineering Office",
    "Surigao del Norte 2nd District Engineering Office",
    "Surigao del Sur 1st District Engineering Office",
    "Surigao del Sur 2nd District Engineering Office"
  ]
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

function normalizeSection(value) {
  const raw = String(value || "").trim();
  return SECTION_ALIASES[raw] || raw;
}

function getSectionCode(section) {
  const normalized = normalizeSection(section);
  return SECTION_CODES[normalized] || "GEN";
}

function normalizeOfficeName(value) {
  return String(value || "")
    .trim()
    .replace(/\s+/g, " ")
    .toUpperCase();
}

function ordinalTokenToLetter(token) {
  const normalized = String(token || "").trim().toUpperCase();
  const map = {
    "1ST": "F",
    "2ND": "S",
    "3RD": "T",
    "4TH": "F",
    "5TH": "F",
    "6TH": "S",
    "7TH": "S",
    "8TH": "E",
    "9TH": "N",
    "10TH": "T"
  };
  return map[normalized] || "";
}

function deriveOfficeCode(office) {
  const normalized = normalizeOfficeName(office);
  if (!normalized) return "GEN";
  if (OFFICE_CODE_OVERRIDES[normalized]) return OFFICE_CODE_OVERRIDES[normalized];

  let base = normalized
    .replace(/\bSUB-DISTRICT ENGINEERING OFFICE\b/g, "")
    .replace(/\bDISTRICT ENGINEERING OFFICE\b/g, "")
    .replace(/\bENGINEERING OFFICE\b/g, "")
    .replace(/\bOFFICE\b/g, "")
    .replace(/\s+/g, " ")
    .trim();

  if (!base) return "GEN";

  const letters = base
    .split(/[\s-]+/)
    .filter(Boolean)
    .map(part => ordinalTokenToLetter(part) || part.replace(/[^A-Z0-9]/g, "").charAt(0))
    .filter(Boolean)
    .join("");

  if (!letters) return "GEN";
  return `${letters}DEO`;
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
  const match = normalized.match(/^DPWH-([A-Z0-9]+)-([A-Z]+)-(\d{4})$/);
  if (!match) return null;
  return {
    officeCode: match[1],
    sectionCode: match[2],
    sequence: Number(match[3])
  };
}

function buildEmployeeCode(officeCode, sectionCode, sequence) {
  const safeOfficeCode = String(officeCode || "GEN").trim().toUpperCase();
  const safeCode = String(sectionCode || "GEN").trim().toUpperCase();
  const safeSequence = Number(sequence) || 0;
  return `${EMPLOYEE_CODE_PREFIX}-${safeOfficeCode}-${safeCode}-${String(safeSequence).padStart(4, "0")}`;
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
      const key = `${parsed.officeCode}::${parsed.sectionCode}`;
      sectionMaxSequence[key] = Math.max(sectionMaxSequence[key] || 0, parsed.sequence);
    }
  });

  list.forEach((user) => {
    const normalizedSection = normalizeSection(user?.section || "");
    if (normalizedSection !== user?.section) {
      user.section = normalizedSection;
      changed = true;
    }
    const derivedOfficeCode = deriveOfficeCode(user?.office || "");
    if (String(user?.officeCode || "") !== derivedOfficeCode) {
      user.officeCode = derivedOfficeCode;
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
    if (!parsedCode || parsedCode.officeCode !== user.officeCode || parsedCode.sectionCode !== getSectionCode(user?.section || "")) {
      const sectionCode = getSectionCode(user?.section || "");
      const sequenceKey = `${user.officeCode}::${sectionCode}`;
      const nextSeq = (sectionMaxSequence[sequenceKey] || 0) + 1;
      sectionMaxSequence[sequenceKey] = nextSeq;
      user.employeeCode = buildEmployeeCode(user.officeCode, sectionCode, nextSeq);
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
        region: "NCR",
        office: "",
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
        userId: generateUserId(),
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

function setSelectOptions(selectEl, values, placeholder) {
  if (!selectEl) return;
  const items = Array.isArray(values) ? values : [];
  const first = `<option value="">${placeholder}</option>`;
  selectEl.innerHTML = first + items.map(item => `<option value="${item}">${item}</option>`).join("");
}

function initRegionOfficeSelectors(regionInput, officeInput) {
  if (!regionInput || !officeInput) return;

  setSelectOptions(regionInput, DPWH_REGIONS, "Select region");
  setSelectOptions(officeInput, [], "Select office");
  officeInput.disabled = true;

  regionInput.addEventListener("change", () => {
    const region = String(regionInput.value || "").trim();
    const offices = DPWH_OFFICES_BY_REGION[region] || [];
    setSelectOptions(officeInput, offices, "Select office");
    officeInput.disabled = offices.length === 0;
  });
}

function storeSession(user, remember) {
  const isSuperAdmin = isSuperAdminEmail(user.email);
  const isAdmin = isSuperAdmin || isAdminEmail(user.email);
  const payload = {
    userId: user.userId || "",
    employeeCode: user.employeeCode || "",
    officeCode: user.officeCode || deriveOfficeCode(user.office || ""),
    email: user.email,
    name: user.name,
    section: user.section,
    region: user.region || "",
    office: user.office || "",
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
    if (!user) {
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
          : "Your account is pending admin approval. Please wait for confirmation.";
        setMessage(messageEl, msg);
        return;
      }
    } else if (!user.status || user.status !== "approved" || (isSuperAdmin && user.role !== "superadmin")) {
      user.status = "approved";
      if (isSuperAdmin) user.role = "superadmin";
      saveUsers(users);
    }

    if (user.password !== password) {
      setMessage(messageEl, "Invalid email or password.");
      return;
    }

    storeSession(user, Boolean(rememberInput?.checked));
    window.location.href = "dashboard.html";
  });
}

function initSignup() {
  const form = document.getElementById("signupForm");
  const nameInput = document.getElementById("signupName");
  const emailInput = document.getElementById("signupEmail");
  const regionInput = document.getElementById("signupRegion");
  const officeInput = document.getElementById("signupOffice");
  const sectionInput = document.getElementById("signupSection");
  const passInput = document.getElementById("signupPassword");
  const confirmInput = document.getElementById("signupConfirm");
  const messageEl = document.getElementById("formMessage");

  initRegionOfficeSelectors(regionInput, officeInput);

  form?.addEventListener("submit", (e) => {
    e.preventDefault();
    clearMessage(messageEl);

    const name = String(nameInput?.value || "").trim().toUpperCase();
    const email = normalizeEmail(emailInput?.value);
    const region = String(regionInput?.value || "").trim();
    const office = String(officeInput?.value || "").trim();
    const section = normalizeSection(sectionInput?.value || "");
    const password = String(passInput?.value || "");
    const confirm = String(confirmInput?.value || "");

    if (!name || !email || !region || !office || !section || !password || !confirm) {
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
    const existingIndex = users.findIndex(u => normalizeEmail(u?.email) === email);
    const existingUser = existingIndex >= 0 ? (users[existingIndex] || {}) : null;
    const isPreApprovedRecord = Boolean(
      existingUser
      && existingUser.preApproved
      && String(existingUser.role || "user").toLowerCase() === "user"
      && String(existingUser.status || "approved").toLowerCase() === "approved"
      && !String(existingUser.password || "").trim()
    );
    if (existingUser && !isPreApprovedRecord) {
      setMessage(messageEl, "An account with this email already exists.");
      return;
    }

    const isSuperAdmin = isSuperAdminEmail(email);
    const isAdmin = isSuperAdmin || isAdminEmail(email);
    const finalStatus = (isPreApprovedRecord || isAdmin) ? "approved" : "pending";
    const user = {
      name,
      email,
      region,
      office,
      section,
      password,
      userId: existingUser?.userId || generateUserId(),
      employeeCode: existingUser?.employeeCode || "",
      role: isSuperAdmin ? "superadmin" : (isAdmin ? "admin" : "user"),
      status: finalStatus,
      preApproved: false,
      createdAt: existingUser?.createdAt || new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };
    if (existingIndex >= 0 && isPreApprovedRecord) {
      users[existingIndex] = { ...existingUser, ...user };
    } else {
      users.push(user);
    }
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
    setMessage(
      messageEl,
      isPreApprovedRecord
        ? "Account setup complete. You can now log in."
        : "Account created. Awaiting admin approval.",
      "success"
    );
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
  ensurePreApprovedUsers();
  const users = loadUsers();
  if (ensureUserIdentifiers(users)) saveUsers(users);
  const page = document.body.getAttribute("data-page");
  if (page === "login") initLogin();
  if (page === "signup") initSignup();
  if (page === "forgot") initForgot();
});



