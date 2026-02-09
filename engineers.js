const body = document.querySelector("body");
const sidebar = body.querySelector(".sidebar");
const toggle = body.querySelector(".toggle");
const modeSwitch = body.querySelector(".toggle-switch");
const modeText = body.querySelector(".mode-text");
const sidebarStateKey = "sidebarOpen";
const themeStateKey = "darkMode";

const applySidebarState = () => {
  if (!sidebar) return;
  const stored = localStorage.getItem(sidebarStateKey);
  if (stored === null) return;
  const shouldBeOpen = stored === "true";
  sidebar.classList.toggle("close", !shouldBeOpen);
};

applySidebarState();

const applyThemeState = () => {
  const stored = localStorage.getItem(themeStateKey);
  if (stored === null) return;
  const isDark = stored === "true";
  body.classList.toggle("dark", isDark);
  if (modeText) {
    modeText.innerText = isDark ? "Light Mode" : "Dark Mode";
  }
};

applyThemeState();

toggle?.addEventListener("click", () => {
  sidebar.classList.toggle("close");
  const isOpen = !sidebar.classList.contains("close");
  localStorage.setItem(sidebarStateKey, String(isOpen));
});

modeSwitch?.addEventListener("click", () => {
  body.classList.toggle("dark");
  const isDark = body.classList.contains("dark");
  localStorage.setItem(themeStateKey, String(isDark));
  if (modeText) {
    modeText.innerText = isDark ? "Light Mode" : "Dark Mode";
  }
});

// Navigation transition handlers
document.addEventListener("DOMContentLoaded", () => {
  (function () {
    const page = document.querySelector("section") || document.body;
    const current = window.location.pathname.split("/").pop() || "engineers.html";

    document.querySelectorAll(".menu-links .nav-link").forEach(li => {
      const a = li.querySelector("a");
      if (!a) return;
      const href = a.getAttribute("href");
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

    document.querySelectorAll(".menu-links a[href$=\".html\"]").forEach(a => {
      a.addEventListener("click", (ev) => {
        const href = a.getAttribute("href");
        if (!href) return;
        const target = href.split("/").pop();
        if (target === current) return;

        ev.preventDefault();
        page.classList.add("page-exit");
        sessionStorage.setItem("pageTransition", "sidebar");
        setTimeout(() => window.location.href = href, 310);
      });
    });
  })();
});

// Engineer directory
const engineersStorageKey = "engineersDirectory";
const nameInput = document.getElementById("engineerName");
const roleInput = document.getElementById("engineerRole");
const phoneInput = document.getElementById("engineerPhone");
const facebookInput = document.getElementById("engineerFacebook");
const accreditationInput = document.getElementById("engineerAccreditation");
const addBtn = document.getElementById("addEngineerBtn");
const listEl = document.getElementById("engineerList");
const countEl = document.getElementById("engineerCount");

function normalizeName(name) {
  return String(name || "").trim();
}

function normalizeRole(role) {
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

function loadEngineers() {
  const raw = localStorage.getItem(engineersStorageKey);
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed
      .map(item => {
        if (typeof item === "string") return { name: item, role: "" };
        return {
          name: item?.name || "",
          role: item?.role || "",
          phone: item?.phone || "",
          facebook: item?.facebook || "",
          accreditation: item?.accreditation || ""
        };
      })
      .map(item => ({
        name: normalizeName(item.name),
        role: normalizeRole(item.role),
        phone: String(item.phone || "").trim(),
        facebook: String(item.facebook || "").trim(),
        accreditation: String(item.accreditation || "").trim()
      }))
      .filter(item => normalizeName(item.name));
  } catch (err) {
    return [];
  }
}

function saveEngineers(list) {
  localStorage.setItem(engineersStorageKey, JSON.stringify(list));
}

function updateCount(count) {
  if (!countEl) return;
  const label = count === 1 ? "Engineer" : "Engineers";
  countEl.textContent = `${count} ${label}`;
}

const roleGroups = [
  { key: "Project Engineer", label: "Project Engineers" },
  { key: "Materials Engineer", label: "Materials Engineers" },
  { key: "Project Inspector", label: "Project Inspectors" },
  { key: "Resident Engineer", label: "Resident Engineers" },
  { key: "QA In-Charge", label: "QA In-Charge" },
  { key: "Contractor Materials Engineer", label: "Contractors Materials Engineers" }
];

function renderEngineers() {
  if (!listEl) return;
  listEl.innerHTML = "";
  const engineers = loadEngineers();
  const normalized = engineers.map(item => ({
    name: item.name,
    role: normalizeRole(item.role) || "",
    phone: item.phone || "",
    facebook: item.facebook || "",
    accreditation: item.accreditation || ""
  }));
  updateCount(normalized.length);

  if (normalized.length === 0) {
    const empty = document.createElement("div");
    empty.className = "engineer-item";
    const meta = document.createElement("div");
    meta.className = "engineer-meta";
    const title = document.createElement("strong");
    title.textContent = "No engineers yet";
    const hint = document.createElement("span");
    hint.textContent = "Add a name to populate the dropdowns.";
    meta.appendChild(title);
    meta.appendChild(hint);
    empty.appendChild(meta);
    listEl.appendChild(empty);
    return;
  }

  roleGroups.forEach(group => {
    const groupWrap = document.createElement("div");
    groupWrap.className = "engineer-group";

    const header = document.createElement("div");
    header.className = "engineer-group-header";

    const title = document.createElement("h4");
    title.textContent = group.label;

    const groupItems = normalized
      .filter(item => (item.role || "Project Engineer") === group.key)
      .sort((a, b) => a.name.localeCompare(b.name));

    const count = document.createElement("span");
    count.className = "engineer-group-count";
    count.textContent = `${groupItems.length}`;

    header.appendChild(title);
    header.appendChild(count);
    groupWrap.appendChild(header);

    const list = document.createElement("div");
    list.className = "engineer-group-list";

    if (groupItems.length === 0) {
      const empty = document.createElement("div");
      empty.className = "engineer-empty";
      empty.textContent = "No engineers yet.";
      list.appendChild(empty);
    } else {
      groupItems.forEach(engineer => {
        const item = document.createElement("div");
        item.className = "engineer-item";

        const meta = document.createElement("div");
        meta.className = "engineer-meta";

        const name = document.createElement("strong");
        name.textContent = engineer.name;
        meta.appendChild(name);

        const accreditation = document.createElement("div");
        accreditation.className = "engineer-accreditation";
        const accLabel = document.createElement("span");
        accLabel.textContent = engineer.accreditation
          ? `Accreditation: ${engineer.accreditation}`
          : "Accreditation: Not set";
        accreditation.appendChild(accLabel);
        if (!engineer.accreditation) {
          const accAdd = document.createElement("button");
          accAdd.type = "button";
          accAdd.className = "inline-add";
          accAdd.textContent = "Add";
          accAdd.addEventListener("click", () => {
            const value = prompt("Enter accreditation number:");
            if (!value) return;
            const updated = loadEngineers().map(entry => {
              if (entry.name !== engineer.name) return entry;
              return { ...entry, accreditation: String(value).trim() };
            });
            saveEngineers(updated);
            renderEngineers();
          });
          accreditation.appendChild(accAdd);
        }
        meta.appendChild(accreditation);

        const removeBtn = document.createElement("button");
        removeBtn.className = "engineer-action";
        removeBtn.type = "button";
        removeBtn.textContent = "Remove";
        removeBtn.addEventListener("click", () => {
          const updated = loadEngineers().filter(entry => entry.name !== engineer.name);
          saveEngineers(updated);
          renderEngineers();
        });

        const contact = document.createElement("div");
        contact.className = "engineer-contacts";

        const phoneWrap = document.createElement("div");
        phoneWrap.className = "contact-icon";
        phoneWrap.setAttribute("data-label", "Phone");
        const phoneBtn = document.createElement("button");
        phoneBtn.type = "button";
        phoneBtn.setAttribute("aria-label", "Phone number");
        phoneBtn.innerHTML = "<i class='bx bx-phone'></i>";
        const phoneTip = document.createElement("div");
        phoneTip.className = "contact-tooltip";
        const phoneTitle = document.createElement("div");
        phoneTitle.className = "tooltip-title";
        phoneTitle.textContent = "Phone";
        const phoneValue = document.createElement("div");
        phoneValue.className = "tooltip-value";
        phoneValue.textContent = engineer.phone ? engineer.phone : "Not set";
        const phoneCopy = document.createElement("button");
        phoneCopy.type = "button";
        phoneCopy.className = "tooltip-copy";
        phoneCopy.textContent = "Copy";
        if (!engineer.phone) phoneCopy.disabled = true;
        const phoneAdd = document.createElement("button");
        phoneAdd.type = "button";
        phoneAdd.className = "tooltip-add";
        phoneAdd.textContent = "Add";
        const phoneActions = document.createElement("div");
        phoneActions.className = "tooltip-actions";
        phoneActions.appendChild(phoneCopy);
        phoneActions.appendChild(phoneAdd);
        phoneTip.appendChild(phoneTitle);
        phoneTip.appendChild(phoneValue);
        phoneTip.appendChild(phoneActions);
        phoneWrap.appendChild(phoneBtn);
        phoneWrap.appendChild(phoneTip);

        const facebookWrap = document.createElement("div");
        facebookWrap.className = "contact-icon";
        facebookWrap.setAttribute("data-label", "Facebook");
        const facebookBtn = document.createElement("button");
        facebookBtn.type = "button";
        facebookBtn.setAttribute("aria-label", "Facebook profile");
        facebookBtn.innerHTML = "<i class='bx bxl-facebook'></i>";
        const facebookTip = document.createElement("div");
        facebookTip.className = "contact-tooltip";
        const facebookTitle = document.createElement("div");
        facebookTitle.className = "tooltip-title";
        facebookTitle.textContent = "Facebook";
        const facebookValue = document.createElement("div");
        facebookValue.className = "tooltip-value";
        facebookValue.textContent = engineer.facebook ? engineer.facebook : "Not set";
        const facebookCopy = document.createElement("button");
        facebookCopy.type = "button";
        facebookCopy.className = "tooltip-copy";
        facebookCopy.textContent = "Copy";
        if (!engineer.facebook) facebookCopy.disabled = true;
        const facebookAdd = document.createElement("button");
        facebookAdd.type = "button";
        facebookAdd.className = "tooltip-add";
        facebookAdd.textContent = "Add";
        const facebookActions = document.createElement("div");
        facebookActions.className = "tooltip-actions";
        facebookActions.appendChild(facebookCopy);
        facebookActions.appendChild(facebookAdd);
        facebookTip.appendChild(facebookTitle);
        facebookTip.appendChild(facebookValue);
        facebookTip.appendChild(facebookActions);
        facebookWrap.appendChild(facebookBtn);
        facebookWrap.appendChild(facebookTip);

        const setupCopy = (wrap, value) => {
          const copyBtn = wrap.querySelector(".tooltip-copy");
          if (!copyBtn || !value) return;
          copyBtn.addEventListener("click", async () => {
            try {
              await navigator.clipboard.writeText(value);
              copyBtn.textContent = "Copied";
              copyBtn.classList.add("copied");
              setTimeout(() => {
                copyBtn.textContent = "Copy";
                copyBtn.classList.remove("copied");
              }, 1200);
            } catch (err) {
              copyBtn.textContent = "Failed";
              setTimeout(() => {
                copyBtn.textContent = "Copy";
              }, 1200);
            }
          });
        };

        const setupAdd = (wrap, label, key) => {
          const addBtn = wrap.querySelector(".tooltip-add");
          if (!addBtn) return;
          addBtn.addEventListener("click", () => {
            const value = prompt(`Enter ${label}:`);
            if (!value) return;
            const updated = loadEngineers().map(entry => {
              if (entry.name !== engineer.name) return entry;
              return { ...entry, [key]: String(value).trim() };
            });
            saveEngineers(updated);
            renderEngineers();
          });
        };

        setupCopy(phoneWrap, engineer.phone);
        setupCopy(facebookWrap, engineer.facebook);
        setupAdd(phoneWrap, "phone number", "phone");
        setupAdd(facebookWrap, "Facebook profile", "facebook");

        contact.appendChild(phoneWrap);
        contact.appendChild(facebookWrap);

        const actions = document.createElement("div");
        actions.className = "engineer-actions";
        actions.appendChild(contact);
        actions.appendChild(removeBtn);

        item.appendChild(meta);
        item.appendChild(actions);
        list.appendChild(item);
      });
    }

    groupWrap.appendChild(list);
    listEl.appendChild(groupWrap);
  });
}

function addEngineer() {
  const name = normalizeName(nameInput?.value);
  if (!name) {
    alert("Please enter an engineer name.");
    return;
  }
  const role = normalizeRole(roleInput?.value);
  if (!role) {
    alert("Please select a role.");
    return;
  }
  const phone = String(phoneInput?.value || "").trim();
  const facebook = String(facebookInput?.value || "").trim();
  const accreditation = String(accreditationInput?.value || "").trim();
  const list = loadEngineers();
  const existingIndex = list.findIndex(item => item.name.toLowerCase() === name.toLowerCase());

  if (existingIndex >= 0) {
    list[existingIndex].role = role || list[existingIndex].role;
    if (phone) list[existingIndex].phone = phone;
    if (facebook) list[existingIndex].facebook = facebook;
    if (accreditation) list[existingIndex].accreditation = accreditation;
  } else {
    list.push({ name, role, phone, facebook, accreditation });
  }

  saveEngineers(list);
  if (nameInput) nameInput.value = "";
  if (roleInput) roleInput.value = "";
  if (phoneInput) phoneInput.value = "";
  if (facebookInput) facebookInput.value = "";
  if (accreditationInput) accreditationInput.value = "";
  renderEngineers();
}

addBtn?.addEventListener("click", addEngineer);
nameInput?.addEventListener("keydown", (event) => {
  if (event.key === "Enter") {
    event.preventDefault();
    addEngineer();
  }
});

renderEngineers();
