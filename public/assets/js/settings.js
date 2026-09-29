/* Settings (requires auth.js) */
(function () {
  "use strict";
  const { api, toast, setLoading } = window.MSL;
  const $ = (id) => document.getElementById(id);
  const PROFILE = ["profName", "profTax", "profEmail", "profAddr1", "profCity", "profState", "profPostal"];

  async function load() {
    try {
      const r = await api("/api/v1/settings");
      if (!r.ok) return;
      const s = await r.json();
      $("apiUrl").value = s.apiUrl || "";
      $("clientId").value = s.clientId || "";
      $("mockMode").checked = !!s.mockMode;
      if (s.apiUrl && s.clientId) { const p = $("connPill"); p.className = "pill pill-ok"; p.textContent = s.mockMode ? "Sandbox" : "Configured"; }
      const prof = s.profile || {};
      PROFILE.forEach((k) => { if (prof[k] != null) $(k).value = prof[k]; });
      if (s.invoiceTerms) $("invoiceTerms").value = s.invoiceTerms;
    } catch (e) { console.warn("Settings load failed", e); }
  }

  async function save(payload, btn, label) {
    setLoading(btn, true, "Saving…");
    try {
      const r = await api("/api/v1/settings", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) });
      if (!r.ok) throw new Error("HTTP " + r.status);
      toast("Settings saved.", "ok");
      return true;
    } catch (e) {
      toast("Couldn't save settings. Please try again.", "err");
      return false;
    } finally { setLoading(btn, false, label); }
  }

  document.addEventListener("msl:ready", () => {
    document.querySelectorAll("[data-year]").forEach((e) => (e.textContent = new Date().getFullYear()));
    load();

    $("settingsForm").addEventListener("submit", async (e) => {
      e.preventDefault();
      const payload = { apiUrl: $("apiUrl").value.trim(), clientId: $("clientId").value.trim(), mockMode: $("mockMode").checked };
      if ($("clientSecret").value) payload.clientSecret = $("clientSecret").value; // only send when changed
      if (await save(payload, e.submitter || e.target.querySelector("button"), "Save API settings")) $("clientSecret").value = "";
    });

    $("profileForm").addEventListener("submit", (e) => {
      e.preventDefault();
      const profile = {}; PROFILE.forEach((k) => (profile[k] = $(k).value.trim()));
      save({ profile }, e.target.querySelector("button"), "Update profile");
    });

    $("saveTerms").addEventListener("click", (e) => save({ invoiceTerms: $("invoiceTerms").value }, e.currentTarget, "Save terms"));

    $("passwordForm").addEventListener("submit", async (e) => {
      e.preventDefault();
      const btn = e.target.querySelector("button");
      if ($("newPass").value !== $("confirmPass").value) return toast("New passwords don't match.", "err");
      setLoading(btn, true, "Updating…");
      try {
        const r = await api("/api/v1/auth/change-password", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ currentPassword: $("curPass").value, newPassword: $("newPass").value }) });
        const j = await r.json().catch(() => ({}));
        if (!r.ok) throw new Error(j.error || "Password update failed.");
        toast("Password updated.", "ok");
        e.target.reset();
      } catch (err) { toast(err.message, "err"); }
      finally { setLoading(btn, false, "Update password"); }
    });
  });
})();
