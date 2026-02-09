const USERS_KEY = "dpwh_users";
const SESSION_KEY = "dpwh_current_user";
const ADMIN_EMAIL = "krong0814@gmail.com";

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
  const payload = {
    email: user.email,
    name: user.name,
    section: user.section,
    isAdmin: normalizeEmail(user.email) === normalizeEmail(ADMIN_EMAIL),
    loginAt: new Date().toISOString()
  };
  const json = JSON.stringify(payload);
  if (remember) {
    localStorage.setItem(SESSION_KEY, json);
    sessionStorage.removeItem(SESSION_KEY);
  } else {
    sessionStorage.setItem(SESSION_KEY, json);
    localStorage.removeItem(SESSION_KEY);
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
    const isAdmin = normalizeEmail(user.email) === normalizeEmail(ADMIN_EMAIL);
    if (!isAdmin) {
      const status = user.status || "pending";
      if (status !== "approved") {
        const msg = status === "blocked"
          ? "Your account was blocked. Please contact the admin."
          : "Your account is pending approval. Please wait for admin approval.";
        setMessage(messageEl, msg);
        return;
      }
    } else if (!user.status || user.status !== "approved") {
      user.status = "approved";
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

    const name = String(nameInput?.value || "").trim();
    const email = normalizeEmail(emailInput?.value);
    const section = String(sectionInput?.value || "").trim();
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

    const isAdmin = normalizeEmail(email) === normalizeEmail(ADMIN_EMAIL);
    const user = {
      name,
      email,
      section,
      password,
      status: isAdmin ? "approved" : "pending",
      createdAt: new Date().toISOString()
    };
    users.push(user);
    saveUsers(users);
    if (isAdmin) {
      storeSession(user, true);
      setMessage(messageEl, "Admin account created. Redirecting...", "success");
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
  const page = document.body.getAttribute("data-page");
  if (page === "login") initLogin();
  if (page === "signup") initSignup();
  if (page === "forgot") initForgot();
});
