(function () {
  "use strict";

  function getApiBase() {
    var explicit = String(window.DPWH_API_BASE || "").trim();
    if (explicit) return explicit.replace(/\/$/, "");
    var host = window.location.hostname;
    var isLocal = host === "localhost" || host === "127.0.0.1";
    return isLocal ? window.location.protocol + "//" + host + ":3000" : "";
  }

  var apiBase = getApiBase();
  var data = Object.create(null);

  function safeString(value) {
    return String(value == null ? "" : value);
  }

  function safeKey(key) {
    return String(key == null ? "" : key);
  }

  function parseRemoteData(value) {
    if (!value || typeof value !== "object" || Array.isArray(value)) return Object.create(null);
    var out = Object.create(null);
    Object.keys(value).forEach(function (k) {
      var key = safeKey(k).trim();
      if (!key) return;
      out[key] = safeString(value[k]);
    });
    return out;
  }

  function loadInitialData() {
    try {
      var xhr = new XMLHttpRequest();
      xhr.open("GET", apiBase + "/api/client-storage", false);
      xhr.send(null);
      if (xhr.status >= 200 && xhr.status < 300) {
        var json = JSON.parse(xhr.responseText || "{}");
        data = parseRemoteData(json && json.data);
      }
    } catch (err) {
      data = Object.create(null);
    }
  }

  function sendRequest(method, path, body) {
    try {
      var xhr = new XMLHttpRequest();
      xhr.open(method, apiBase + path, false);
      if (body !== undefined) {
        xhr.setRequestHeader("Content-Type", "application/json");
        xhr.send(JSON.stringify(body));
      } else {
        xhr.send(null);
      }
    } catch (err) {
      // Ignore transport failures so UI remains responsive.
    }
  }

  function getLength() {
    return Object.keys(data).length;
  }

  var appStorage = {
    getItem: function (key) {
      var k = safeKey(key);
      return Object.prototype.hasOwnProperty.call(data, k) ? data[k] : null;
    },
    setItem: function (key, value) {
      var k = safeKey(key);
      if (!k) return;
      var v = safeString(value);
      data[k] = v;
      sendRequest("PUT", "/api/client-storage/item", { key: k, value: v });
    },
    removeItem: function (key) {
      var k = safeKey(key);
      if (!k) return;
      if (!Object.prototype.hasOwnProperty.call(data, k)) return;
      delete data[k];
      sendRequest("DELETE", "/api/client-storage/item/" + encodeURIComponent(k));
    },
    clear: function () {
      data = Object.create(null);
      sendRequest("DELETE", "/api/client-storage");
    },
    key: function (index) {
      var i = Number(index);
      if (!Number.isInteger(i) || i < 0) return null;
      var keys = Object.keys(data);
      return i >= keys.length ? null : keys[i];
    }
  };

  Object.defineProperty(appStorage, "length", {
    configurable: false,
    enumerable: true,
    get: getLength
  });

  loadInitialData();
  window.appStorage = appStorage;
})();
