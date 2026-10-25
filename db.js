// ===== Firebase Realtime Database helper (REST) =====
(function () {
  const base = () => window.GFA.DB_URL;

  async function req(method, path, body) {
    const res = await fetch(`${base()}/${path}.json`, {
      method,
      headers: body !== undefined ? { "Content-Type": "application/json" } : undefined,
      body: body !== undefined ? JSON.stringify(body) : undefined
    });
    if (!res.ok) {
      const msg = res.status === 401 || res.status === 403
        ? "Permission denied. Check your Firebase Realtime Database rules."
        : `Database error (${res.status})`;
      throw new Error(msg);
    }
    return res.json();
  }

  // "GFA/2025/0012" -> "GFA_2025_0012" (Firebase keys can't contain / . # $ [ ])
  const keyFromIndex = (idx) => idx.trim().toUpperCase().replace(/[\/.#$\[\]\s]+/g, "_");
  const normName = (n) => n.trim().toLowerCase().replace(/\s+/g, " ");

  window.DB = {
    keyFromIndex,
    normName,
    get: (p) => req("GET", p),
    put: (p, v) => req("PUT", p, v),
    patch: (p, v) => req("PATCH", p, v),
    del: (p) => req("DELETE", p),
    shallowList: async (p) => {
      const res = await fetch(`${base()}/${p}.json?shallow=true`);
      return res.ok ? res.json() : null;
    }
  };

  window.sha256 = async (text) => {
    const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(text));
    return [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, "0")).join("");
  };

  window.fileToDataURL = (file) =>
    new Promise((resolve, reject) => {
      const r = new FileReader();
      r.onload = () => resolve(r.result);
      r.onerror = () => reject(new Error("Could not read file"));
      r.readAsDataURL(file);
    });

  window.dataURLToBlobURL = (dataUrl) => {
    const [head, b64] = dataUrl.split(",");
    const mime = head.match(/:(.*?);/)[1];
    const bin = atob(b64);
    const arr = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) arr[i] = bin.charCodeAt(i);
    return URL.createObjectURL(new Blob([arr], { type: mime }));
  };

  window.escapeHTML = (s) =>
    String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
})();
