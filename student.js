(function () {
  const $ = (id) => document.getElementById(id);
  const views = ["viewHome", "viewFound", "viewFail"];
  let current = null; // { record, pdf }

  $("yr").textContent = new Date().getFullYear();

  function show(id) {
    views.forEach((v) => $(v).classList.toggle("hidden", v !== id));
    window.scrollTo(0, 0);
  }
  function toast(msg, err) {
    const t = $("toast");
    t.textContent = msg;
    t.className = err ? "err" : "";
    clearTimeout(toast._t);
    toast._t = setTimeout(() => t.classList.add("hidden"), 3500);
  }
  function setBusy(busy) {
    const b = $("checkBtn");
    b.disabled = busy;
    b.innerHTML = busy
      ? '<span class="spinner"></span> Checking…'
      : '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><circle cx="11" cy="11" r="7"/><path d="M21 21l-5-5"/></svg> Check Results';
  }

  // Optional result-checking fee via Paystack (controlled from Admin → Settings)
  function payFee(fee) {
    return new Promise((resolve) => {
      const email = prompt("Enter your email address to pay the results fee (GHS " + fee.amount + "):");
      if (!email || !/^\S+@\S+\.\S+$/.test(email)) { toast("A valid email is required for payment.", true); return resolve(false); }
      if (!window.PaystackPop) { toast("Payment service could not load. Check your connection.", true); return resolve(false); }
      const handler = PaystackPop.setup({
        key: window.GFA.PAYSTACK_PUBLIC_KEY,
        email,
        amount: Math.round(Number(fee.amount) * 100), // pesewas
        currency: window.GFA.CURRENCY,
        ref: "GFA-" + Date.now(),
        callback: (resp) => {
          // Log payment reference for the admin to reconcile
          DB.put("payments/" + resp.reference, { email, amount: fee.amount, at: Date.now(), index: $("indexNo").value.trim() }).catch(() => {});
          resolve(true);
        },
        onClose: () => resolve(false)
      });
      handler.openIframe();
    });
  }

  $("checkForm").addEventListener("submit", async (e) => {
    e.preventDefault();
    const name = $("fullName").value;
    const idx = $("indexNo").value;
    if (!name.trim() || !idx.trim()) return;
    setBusy(true);
    try {
      const key = DB.keyFromIndex(idx);
      const [rec, settings] = await Promise.all([DB.get("results/" + key), DB.get("settings/fee")]);
      if (!rec || DB.normName(rec.name) !== DB.normName(name)) {
        $("failMsg").textContent = "We couldn't find a matching record with the details you entered.";
        return show("viewFail");
      }
      if (settings && settings.enabled && Number(settings.amount) > 0) {
        const paid = await payFee(settings);
        if (!paid) { toast("Payment was not completed.", true); return; }
      }
      const pdf = await DB.get("pdfs/" + key);
      if (!pdf) {
        $("failMsg").textContent = "Your record exists but no results slip has been uploaded yet. Please contact the school.";
        return show("viewFail");
      }
      current = { record: rec, pdf: pdf.data };
      $("rName").textContent = ": " + rec.name;
      $("rIndex").textContent = ": " + rec.index;
      $("rProg").textContent = ": " + (rec.programme || "—");
      $("rYear").textContent = ": " + (rec.year || "—");
      $("slipFrame").src = dataURLToBlobURL(pdf.data);
      show("viewFound");
    } catch (err) {
      toast(err.message || "Something went wrong. Try again.", true);
    } finally {
      setBusy(false);
    }
  });

  $("dlBtn").addEventListener("click", () => {
    if (!current) return;
    const a = document.createElement("a");
    a.href = current.pdf;
    a.download = "Results-" + current.record.index.replace(/\//g, "-") + ".pdf";
    a.click();
  });

  $("printBtn").addEventListener("click", () => {
    const f = $("slipFrame");
    try { f.contentWindow.focus(); f.contentWindow.print(); }
    catch (_) { window.open(dataURLToBlobURL(current.pdf), "_blank"); }
  });

  const reset = () => { $("checkForm").reset(); current = null; $("slipFrame").src = "about:blank"; show("viewHome"); };
  $("backBtn").addEventListener("click", reset);
  $("retryBtn").addEventListener("click", () => show("viewHome"));
  $("contactLink").addEventListener("click", (e) => {
    e.preventDefault();
    document.getElementById("contact").scrollIntoView({ behavior: "smooth" });
  });
})();
