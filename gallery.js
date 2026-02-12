const body = document.querySelector("body");
const sidebar = body.querySelector(".sidebar");
const toggle = body.querySelector(".toggle");
const modeSwitch = body.querySelector(".toggle-switch");
const modeText = body.querySelector(".mode-text");
const sidebarStateKey = "sidebarOpen";
const themeStateKey = "darkMode";
const galleryGrid = document.getElementById("galleryGrid");
const recentGrid = document.getElementById("recentGrid");
const gallerySearch = document.getElementById("gallerySearch");
const photosStorageKey = "galleryPhotos";
const previewModal = document.getElementById("photoPreviewModal");
const previewImage = document.getElementById("photoPreviewImage");
const closePreviewBtn = document.getElementById("closePhotoPreview");
const prevPhotoBtn = document.getElementById("prevPhotoBtn");
const nextPhotoBtn = document.getElementById("nextPhotoBtn");
const photoInfoId = document.getElementById("photoInfoId");
const photoInfoPurpose = document.getElementById("photoInfoPurpose");
const photoInfoDate = document.getElementById("photoInfoDate");
const photoInfoLocation = document.getElementById("photoInfoLocation");
const photoInfoDownload = document.getElementById("photoInfoDownload");
let currentPreviewList = [];
let currentPreviewIndex = 0;
let currentPreviewContract = "";

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

const apiBase = getApiBase();
const useRemoteStorage = Boolean(apiBase);
const remoteGalleryCache = new Map();
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
const galleryPermissions = new Map();

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

function canManageContract(contractId) {
  if (isAdminUser) return true;
  const key = normalizeContractId(contractId);
  return galleryPermissions.get(key) === true;
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

function loadGalleryPhotos() {
  const raw = appStorage.getItem(photosStorageKey);
  if (!raw) return {};
  try {
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === "object" ? parsed : {};
  } catch (err) {
    return {};
  }
}

function saveGalleryPhotos(data) {
  appStorage.setItem(photosStorageKey, JSON.stringify(data));
}

function normalizeContractId(value) {
  return String(value || "").trim().toUpperCase();
}

async function fetchRemoteGallery(contractId) {
  if (!useRemoteStorage) return [];
  const res = await fetch(`${apiBase}/api/gallery/${encodeURIComponent(contractId)}`);
  const data = await res.json().catch(() => ({}));
  if (!res.ok || !data.success) {
    throw new Error(data?.error || "Failed to load gallery.");
  }
  return data.photos || [];
}

async function ensureRemoteGallery(contractId) {
  if (!useRemoteStorage) return [];
  const key = normalizeContractId(contractId);
  if (remoteGalleryCache.has(key)) return remoteGalleryCache.get(key);
  const photos = await fetchRemoteGallery(key);
  const normalized = (photos || []).map(item => ({
    name: item.name || item.fileName || "",
    date: item.date || item.updatedAt || "",
    dataUrl: item.url || item.dataUrl || "",
    key: item.key || ""
  }));
  remoteGalleryCache.set(key, normalized);
  return normalized;
}

async function uploadRemoteGallery(contractId, files) {
  const form = new FormData();
  form.append("contractId", contractId);
  Array.from(files || []).forEach(file => form.append("files", file));
  const res = await fetch(`${apiBase}/api/upload-gallery`, {
    method: "POST",
    body: form
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok || !data.success) {
    throw new Error(data?.error || "Upload failed.");
  }
  return data.photos || [];
}

async function deleteRemoteGallery(contractId) {
  const res = await fetch(`${apiBase}/api/gallery/${encodeURIComponent(contractId)}`, {
    method: "DELETE"
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok || !data.success) {
    throw new Error(data?.error || "Delete failed.");
  }
  return true;
}

function addPhotosForContract(contractId, files) {
  if (!contractId || !files?.length) return;
  if (!canManageContract(contractId)) {
    alert("You don't have permission to upload photos for this project.");
    return;
  }
  if (useRemoteStorage) {
    const key = normalizeContractId(contractId);
    uploadRemoteGallery(key, files)
      .then(() => {
        remoteGalleryCache.delete(key);
        renderGalleryAlbums();
      })
      .catch(err => {
        alert(err.message || "Upload failed.");
      });
    return;
  }
  const all = loadGalleryPhotos();
  const key = normalizeContractId(contractId);
  const list = Array.isArray(all[key]) ? all[key] : [];
  const now = new Date().toISOString();
  const readers = Array.from(files).map(file => new Promise((resolve) => {
    const reader = new FileReader();
    reader.onload = () => resolve({ name: file.name, date: now, dataUrl: reader.result });
    reader.onerror = () => resolve({ name: file.name, date: now, dataUrl: "" });
    reader.readAsDataURL(file);
  }));
  Promise.all(readers).then(items => {
    items.forEach(item => list.push(item));
    all[key] = list;
    saveGalleryPhotos(all);
    renderGalleryAlbums();
  });
}

function renderAlbum(contractId, description, canManage = true) {
  if (!galleryGrid) return;
  const key = normalizeContractId(contractId);
  const card = document.createElement("div");
  card.className = "gallery-card";
  const actionsHtml = canManage ? `
          <label class="album-upload-btn">
            <i class='bx bx-upload'></i>
            Upload
            <input type="file" accept="image/*" multiple hidden>
          </label>
          <button class="album-delete-btn" type="button" data-contract="${key}">
            <i class='bx bx-trash'></i>
            Delete
          </button>
  ` : `
          <span class="album-readonly">View only</span>
  `;
  card.innerHTML = `
    <div class="gallery-info">
      <div class="album-header">
        <div class="album-title">${key} - Geotagged Photos</div>
        <div class="album-actions">
          ${actionsHtml}
        </div>
      </div>
      <div class="gallery-thumb">Loading photos...</div>
      <div class="album-meta">${description ? `Project: ${description}` : "Ready for uploads"}</div>
      <div class="album-photos"></div>
    </div>
  `;
  galleryGrid.appendChild(card);

  const bindUpload = () => {
    const input = card.querySelector("input[type=\"file\"]");
    input?.addEventListener("change", (e) => {
      const files = e.target.files;
      addPhotosForContract(key, files);
      e.target.value = "";
    });
  };

  bindUpload();

  const loadItems = useRemoteStorage
    ? ensureRemoteGallery(key)
    : Promise.resolve((() => {
      const photos = loadGalleryPhotos();
      return Array.isArray(photos[key]) ? photos[key] : [];
    })());

  loadItems
    .then(items => {
      const preview = items.find(p => p.dataUrl) || null;
      const thumb = card.querySelector(".gallery-thumb");
      const meta = card.querySelector(".album-meta");
      const photosEl = card.querySelector(".album-photos");
      if (thumb) {
        thumb.className = `gallery-thumb${preview ? " has-image" : ""}`;
        thumb.innerHTML = preview
          ? `<img src="${preview.dataUrl}" alt="Preview" data-contract="${key}" data-index="${items.indexOf(preview)}">`
          : (items.length ? `${items.length} Photos` : "No Photos Yet");
      }
      if (meta) meta.textContent = description ? `Project: ${description}` : "Ready for uploads";
      if (photosEl) {
        photosEl.innerHTML = items.slice(0, 6).map((item, idx) => item.dataUrl
          ? `<img class="album-photo-thumb" src="${item.dataUrl}" alt="${item.name}" data-contract="${key}" data-index="${idx}">`
          : `<span class="album-photo-chip">${item.name}</span>`
        ).join("");
      }
    })
    .catch(err => {
      const thumb = card.querySelector(".gallery-thumb");
      if (thumb) thumb.textContent = "Failed to load photos.";
      console.warn("Failed to load gallery:", err);
    });
}

function openPreview(contractId, index) {
  const key = normalizeContractId(contractId);
  const list = useRemoteStorage
    ? (remoteGalleryCache.get(key) || [])
    : (Array.isArray(loadGalleryPhotos()[key]) ? loadGalleryPhotos()[key] : []);
  currentPreviewList = list.filter(item => item.dataUrl);
  if (!currentPreviewList.length) return;
  currentPreviewContract = key;
  currentPreviewIndex = Math.max(0, Math.min(index, currentPreviewList.length - 1));
  setPreviewInfo();
  previewModal?.classList.add("open");
}

function closePreview() {
  previewModal?.classList.remove("open");
}

function showPreviewIndex(index) {
  if (!currentPreviewList.length) return;
  currentPreviewIndex = (index + currentPreviewList.length) % currentPreviewList.length;
  setPreviewInfo();
}

function setPreviewInfo() {
  const item = currentPreviewList[currentPreviewIndex];
  if (!item) return;
  previewImage.src = item.dataUrl || "";
  if (photoInfoId) photoInfoId.textContent = `${currentPreviewContract}-photo-${currentPreviewIndex + 1}`;
  if (photoInfoPurpose) photoInfoPurpose.textContent = "Geotagged Photo";
  if (photoInfoDate) {
    const date = item.date ? new Date(item.date) : null;
    photoInfoDate.textContent = date && !Number.isNaN(date.getTime())
      ? date.toLocaleDateString("en-PH")
      : "—";
  }
  if (photoInfoLocation) photoInfoLocation.textContent = currentPreviewContract || "—";
  if (photoInfoDownload) {
    photoInfoDownload.href = item.dataUrl || "#";
    photoInfoDownload.download = item.name || `${currentPreviewContract}-photo-${currentPreviewIndex + 1}.jpg`;
  }
}

galleryGrid?.addEventListener("click", (e) => {
  const deleteBtn = e.target.closest(".album-delete-btn");
  if (deleteBtn) {
    const contractId = deleteBtn.dataset.contract;
    if (!contractId) return;
    if (!canManageContract(contractId)) {
      alert("You don't have permission to delete photos for this project.");
      return;
    }
    const confirmed = confirm(`Delete all photos for ${contractId}?`);
    if (!confirmed) return;
    if (useRemoteStorage) {
      deleteRemoteGallery(contractId)
        .then(() => {
          remoteGalleryCache.delete(normalizeContractId(contractId));
          renderGalleryAlbums();
        })
        .catch(err => alert(err.message || "Delete failed."));
    } else {
      const all = loadGalleryPhotos();
      delete all[String(contractId).trim().toUpperCase()];
      saveGalleryPhotos(all);
      renderGalleryAlbums();
    }
    return;
  }
  const img = e.target.closest(".album-photo-thumb, .gallery-thumb.has-image img");
  if (!img) return;
  const contractId = img.dataset.contract;
  const index = Number(img.dataset.index || 0);
  openPreview(contractId, Number.isNaN(index) ? 0 : index);
});

closePreviewBtn?.addEventListener("click", closePreview);
previewModal?.addEventListener("click", (e) => {
  if (e.target === previewModal) closePreview();
});
document.addEventListener("keydown", (e) => {
  if (e.key === "Escape" && previewModal?.classList.contains("open")) {
    closePreview();
  }
  if (!previewModal?.classList.contains("open")) return;
  if (e.key === "ArrowRight") showPreviewIndex(currentPreviewIndex + 1);
  if (e.key === "ArrowLeft") showPreviewIndex(currentPreviewIndex - 1);
});

prevPhotoBtn?.addEventListener("click", () => showPreviewIndex(currentPreviewIndex - 1));
nextPhotoBtn?.addEventListener("click", () => showPreviewIndex(currentPreviewIndex + 1));

function renderRecentUploads(filterText = "") {
  if (!recentGrid) return;
  const entries = [];

  if (useRemoteStorage) {
    remoteGalleryCache.forEach((list, contractId) => {
      (list || []).forEach(item => {
        entries.push({
          contractId,
          name: item.name,
          date: item.date,
          dataUrl: item.dataUrl || ""
        });
      });
    });
  } else {
    const photos = loadGalleryPhotos();
    Object.keys(photos).forEach(contractId => {
      const list = Array.isArray(photos[contractId]) ? photos[contractId] : [];
      list.forEach(item => {
        entries.push({
          contractId,
          name: item.name,
          date: item.date,
          dataUrl: item.dataUrl || ""
        });
      });
    });
  }
  entries.sort((a, b) => new Date(b.date || 0) - new Date(a.date || 0));

  const filtered = filterText
    ? entries.filter(e => `${e.contractId} ${e.name || ""}`.toLowerCase().includes(filterText))
    : entries;

  recentGrid.innerHTML = "";
  if (!filtered.length) {
    recentGrid.innerHTML = `<div class="empty-state">No recent uploads.</div>`;
    return;
  }

  filtered.slice(0, 4).forEach(item => {
    const card = document.createElement("div");
    card.className = "gallery-card";
    const date = item.date ? new Date(item.date) : null;
    const dateText = date && !Number.isNaN(date.getTime()) ? date.toLocaleDateString("en-PH") : "";
    card.innerHTML = `
      <div class="gallery-thumb${item.dataUrl ? " has-image" : ""}">
        ${item.dataUrl ? `<img src="${item.dataUrl}" alt="Preview">` : "No Preview"}
      </div>
      <div class="gallery-info">
        <h4>${item.contractId} - ${item.name || "Photo"}</h4>
        <p>${dateText || "—"}</p>
      </div>
    `;
    card.addEventListener("click", () => {
      openPreview(item.contractId, 0);
    });
    recentGrid.appendChild(card);
  });
}

async function renderGalleryAlbums() {
  if (!galleryGrid) return;
  galleryGrid.innerHTML = "";
  galleryPermissions.clear();
  const search = String(gallerySearch?.value || "").trim().toLowerCase();
  if (!apiBase) {
    renderRecentUploads(search);
    renderPreviewAlbums();
    return;
  }
  try {
    const res = await fetch(`${apiBase}/api/get-projects`);
    const json = await res.json();
    if (!json.success) return;
    const projects = json.projects || [];
    const filtered = projects.filter(p => {
      const contractId = p["CONTRACT ID"] || "";
      const description = p["CONTRACT NAME/LOCATION"] || "";
      if (!contractId) return false;
      if (search && !`${contractId} ${description}`.toLowerCase().includes(search)) return false;
      if (!isAdminUser) {
        const inCharge = {
          projectEngineer: p["PROJECT ENGINEER"] || "",
          materialsEngineer: p["MATERIALS ENGINEER"] || "",
          projectInspector: p["PROJECT INSPECTOR"] || "",
          residentEngineer: p["RESIDENT ENGINEER"] || "",
          qaInCharge: p["QUALITY ASSURANCE IN-CHARGE"] || "",
          contractorMaterialsEngineer: p["CONTRACTORS MATERIALS ENGINEER"] || ""
        };
        if (!isUserInCharge(inCharge)) return false;
      }
      return true;
    });

    if (useRemoteStorage && filtered.length) {
      await Promise.all(filtered.map(p => ensureRemoteGallery(p["CONTRACT ID"] || "")));
    }

    renderRecentUploads(search);
    if (!projects.length) {
      renderPreviewAlbums();
      return;
    }
    filtered.forEach(p => {
      const contractId = p["CONTRACT ID"] || "";
      const description = p["CONTRACT NAME/LOCATION"] || "";
      if (!contractId) return;
      const inCharge = {
        projectEngineer: p["PROJECT ENGINEER"] || "",
        materialsEngineer: p["MATERIALS ENGINEER"] || "",
        projectInspector: p["PROJECT INSPECTOR"] || "",
        residentEngineer: p["RESIDENT ENGINEER"] || "",
        qaInCharge: p["QUALITY ASSURANCE IN-CHARGE"] || "",
        contractorMaterialsEngineer: p["CONTRACTORS MATERIALS ENGINEER"] || ""
      };
      const canManage = isAdminUser || isUserInCharge(inCharge);
      galleryPermissions.set(normalizeContractId(contractId), canManage);
      renderAlbum(contractId, description, canManage);
    });
  } catch (err) {
    console.warn("Failed to load projects for gallery:", err);
    renderRecentUploads(String(gallerySearch?.value || "").trim().toLowerCase());
    renderPreviewAlbums();
  }
}

function renderPreviewAlbums() {
  if (!galleryGrid) return;
  const previews = [
    { id: "25IK0003", desc: "Access Road from Sition Wespal, Brgy. Guirang to Brgy. San Fernando" },
    { id: "25IK0039", desc: "Widening of Bridge - Tabucan Bridge" },
    { id: "25IK0041", desc: "Clearing and Grubbing" }
  ];
  previews.forEach(item => renderAlbum(item.id, item.desc));
}

// Navigation transition handlers
document.addEventListener('DOMContentLoaded', () => {
  (function () {
    const page = document.querySelector('section') || document.body;
    const current = window.location.pathname.split('/').pop() || 'gallery.html';

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
  renderGalleryAlbums();
  gallerySearch?.addEventListener("input", () => {
    renderGalleryAlbums();
  });
});
