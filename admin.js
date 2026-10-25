(function () {
  const $ = (id) => document.getElementById(id);
  const PAGE_SIZE = 5;
  const titles = { dashboard: "Dashboard", upload: "Upload Results", records: "View Records", settings: "Settings" };
  let all = [];        // [{key, ...record}]
  let filtered = [];
  let page = 1;
  let editingKey = null;

  $("maxMb").textContent = GFA.MAX_PDF_MB;

  function toast(msg, err) {
    const t = $("toast");
    t.textContent = msg;
    t.className = err ? "err" : "";
    clearTimeout(toast._t);
    toast._t = setTimeout(() => t.classList.add("hidden"), 3500);
  }

  /* ---------------- Login ---------------- */
  function enter() {
    $("loginView").classList.add("hidden");
    $("adminView").classList.remove("hidden");
    switchTab("dashboard");
  }
  if (sessionStorage.getItem("gfa_admin") === "1") enter();

  $("loginForm").addEventListener("submit", async (e) => {
    e.preventDefault();
    const user = $("username").value.trim();
    const hash = await sha256($("password").value);
    if (user.toLowerCase() === GFA.ADMIN_USERNAME && hash === GFA.ADMIN_PASSWORD_HASH) {
      sessionStorage.setItem("gfa_admin", "1");
      $("loginErr").classList.add("hidden");
      enter();
    } else {
      $("loginErr").classList.remove("hidden");
    }
  });
  $("forgotBtn").addEventListener("click", () => alert("Please contact the system developer to reset the admin password."));
  $("logoutBtn").addEventListener("click", () => { sessionStorage.removeItem("gfa_admin"); location.reload(); });

  /* ---------------- Tabs ---------------- */
  function switchTab(tab) {
    document.querySelectorAll("[id^=tab-]").forEach((s) => s.classList.toggle("hidden", s.id !== "tab-" + tab));
    document.querySelectorAll(".sidebar .nav[data-tab]").forEach((b) => b.classList.toggle("active", b.dataset.tab === tab));
    $("pageTitle").textContent = titles[tab];
    if (tab === "dashboard" || tab === "records") loadRecords();
    if (tab === "dashboard") loadPayCount();
    if (tab === "settings") loadSettings();
  }
  document.querySelectorAll(".sidebar .nav[data-tab]").forEach((b) => b.addEventListener("click", () => switchTab(b.dataset.tab)));

  /* ---------------- Records ---------------- */
  async function loadRecords() {
    try {
      const data = (await DB.get("results")) || {};
      all = Object.entries(data).map(([key, v]) => ({ key, ...v })).sort((a, b) => (b.uploadedAt || 0) - (a.uploadedAt || 0));
      $("statTotal").textContent = all.length;
      $("statProg").textContent = new Set(all.map((r) => (r.programme || "").trim().toLowerCase()).filter(Boolean)).size;
      applySearch();
    } catch (err) { toast(err.message, true); }
  }
  async function loadPayCount() {
    try { const p = await DB.shallowList("payments"); $("statPay").textContent = p ? Object.keys(p).length : 0; }
    catch (_) { $("statPay").textContent = "0"; }
  }
  function applySearch() {
    const q = $("search").value.trim().toLowerCase();
    filtered = q ? all.filter((r) => r.name.toLowerCase().includes(q) || r.index.toLowerCase().includes(q)) : all.slice();
    page = 1;
    render();
  }
  function render() {
    const pages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
    page = Math.min(page, pages);
    const slice = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);
    $("rows").innerHTML = slice.length
      ? slice.map((r, i) => `
        <tr>
          <td>${(page - 1) * PAGE_SIZE + i + 1}</td>
          <td>${escapeHTML(r.name)}</td>
          <td>${escapeHTML(r.index)}</td>
          <td>${escapeHTML(r.programme || "—")}</td>
          <td><span class="pdf-chip">PDF</span></td>
          <td>
            <button class="btn btn-blue btn-sm" data-act="view" data-key="${escapeHTML(r.key)}">View</button>
            <button class="icon-btn edit" title="Edit" data-act="edit" data-key="${escapeHTML(r.key)}">✎</button>
            <button class="icon-btn del" title="Delete" data-act="del" data-key="${escapeHTML(r.key)}">🗑</button>
          </td>
        </tr>`).join("")
      : `<tr><td colspan="6" style="text-align:center;color:var(--muted);padding:24px">No records found.</td></tr>`;
    $("totalTxt").textContent = "Total Records: " + filtered.length;
    $("pages").innerHTML =
      Array.from({ length: pages }, (_, i) => `<button class="${i + 1 === page ? "on" : ""}" data-page="${i + 1}">${i + 1}</button>`).join("");
  }
  $("searchBtn").addEventListener("click", applySearch);
  $("search").addEventListener("input", applySearch);
  $("pages").addEventListener("click", (e) => { const p = e.target.dataset.page; if (p) { page = +p; render(); } });

  $("rows").addEventListener("click", async (e) => {
    const btn = e.target.closest("button[data-act]");
    if (!btn) return;
    const key = btn.dataset.key;
    const rec = all.find((r) => r.key === key);
    if (btn.dataset.act === "view") {
      try {
        const pdf = await DB.get("pdfs/" + key);
        if (!pdf) return toast("No PDF stored for this record.", true);
        $("vTitle").textContent = rec.name + " – " + rec.index;
        $("vFrame").src = dataURLToBlobURL(pdf.data);
        $("viewModal").classList.remove("hidden");
      } catch (err) { toast(err.message, true); }
    }
    if (btn.dataset.act === "edit") {
      editingKey = key;
      $("edName").value = rec.name; $("edIndex").value = rec.index;
      $("edProg").value = rec.programme || ""; $("edYear").value = rec.year || "";
      $("edFile").value = "";
      $("editModal").classList.remove("hidden");
    }
    if (btn.dataset.act === "del") {
      if (!confirm(`Delete the record for ${rec.name} (${rec.index})? This cannot be undone.`)) return;
      try {
        await Promise.all([DB.del("results/" + key), DB.del("pdfs/" + key)]);
        toast("Record deleted.");
        loadRecords();
      } catch (err) { toast(err.message, true); }
    }
  });
  $("vClose").addEventListener("click", () => { $("viewModal").classList.add("hidden"); $("vFrame").src = "about:blank"; });
  $("edCancel").addEventListener("click", () => $("editModal").classList.add("hidden"));

  $("editForm").addEventListener("submit", async (e) => {
    e.preventDefault();
    const btn = $("edSave"); btn.disabled = true;
    try {
      const name = $("edName").value.trim();
      const index = $("edIndex").value.trim().toUpperCase();
      const newKey = DB.keyFromIndex(index);
      const old = all.find((r) => r.key === editingKey);
      if (newKey !== editingKey && (await DB.get("results/" + newKey))) throw new Error("Another record already uses that index number.");

      let pdfData = null;
      const file = $("edFile").files[0];
      if (file) pdfData = await validatePdf(file);
      else if (newKey !== editingKey) pdfData = (await DB.get("pdfs/" + editingKey)).data;

      const record = { name, index, programme: $("edProg").value.trim(), year: $("edYear").value.trim(), uploadedAt: old.uploadedAt || Date.now(), updatedAt: Date.now() };
      await DB.put("results/" + newKey, record);
      if (pdfData) await DB.put("pdfs/" + newKey, { data: pdfData });
      if (newKey !== editingKey) await Promise.all([DB.del("results/" + editingKey), DB.del("pdfs/" + editingKey)]);

      $("editModal").classList.add("hidden");
      toast("Record updated.");
      loadRecords();
    } catch (err) { toast(err.message, true); }
    finally { btn.disabled = false; }
  });

  /* ---------------- Upload ---------------- */
  async function validatePdf(file) {
    if (file.type !== "application/pdf") throw new Error("Only PDF files are allowed.");
    if (file.size > GFA.MAX_PDF_MB * 1024 * 1024) throw new Error(`PDF must be smaller than ${GFA.MAX_PDF_MB}MB.`);
    return fileToDataURL(file);
  }
  const drop = $("drop"), fileInput = $("upFile");
  drop.addEventListener("click", () => fileInput.click());
  fileInput.addEventListener("change", () => { $("picked").textContent = fileInput.files[0] ? "✔ " + fileInput.files[0].name : ""; });
  ["dragover", "dragenter"].forEach((ev) => drop.addEventListener(ev, (e) => { e.preventDefault(); drop.classList.add("over"); }));
  ["dragleave", "drop"].forEach((ev) => drop.addEventListener(ev, (e) => { e.preventDefault(); drop.classList.remove("over"); }));
  drop.addEventListener("drop", (e) => {
    if (e.dataTransfer.files[0]) { fileInput.files = e.dataTransfer.files; fileInput.dispatchEvent(new Event("change")); }
  });

  $("uploadForm").addEventListener("submit", async (e) => {
    e.preventDefault();
    const btn = $("upBtn");
    const file = fileInput.files[0];
    if (!file) return toast("Please choose a PDF file.", true);
    btn.disabled = true; btn.innerHTML = '<span class="spinner"></span> Uploading…';
    try {
      const data = await validatePdf(file);
      const index = $("upIndex").value.trim().toUpperCase();
      const key = DB.keyFromIndex(index);
      if (await DB.get("results/" + key)) {
        if (!confirm("A record with this index number already exists. Replace it?")) throw new Error("Upload cancelled.");
      }
      await DB.put("pdfs/" + key, { data });
      await DB.put("results/" + key, {
        name: $("upName").value.trim(), index,
        programme: $("upProg").value.trim(), year: $("upYear").value.trim(),
        uploadedAt: Date.now()
      });
      toast("Results uploaded successfully.");
      $("uploadForm").reset(); $("picked").textContent = "";
    } catch (err) { toast(err.message, true); }
    finally { btn.disabled = false; btn.innerHTML = "⬆ Upload Results"; }
  });

  /* ---------------- Settings ---------------- */
  async function loadSettings() {
    try {
      const fee = (await DB.get("settings/fee")) || {};
      $("feeOn").checked = !!fee.enabled;
      $("feeAmt").value = fee.amount || "";
    } catch (err) { toast(err.message, true); }
  }
  $("settingsForm").addEventListener("submit", async (e) => {
    e.preventDefault();
    const enabled = $("feeOn").checked, amount = Number($("feeAmt").value) || 0;
    if (enabled && amount <= 0) return toast("Enter a fee amount greater than 0.", true);
    try { await DB.put("settings/fee", { enabled, amount }); toast("Settings saved."); }
    catch (err) { toast(err.message, true); }
  });
})();
