/* Dashboard — stats + recent invoices (requires auth.js) */
(function () {
  "use strict";
  const { esc, naira, api, statusPill, toast } = window.MSL;

  function greet() {
    const h = new Date().getHours();
    const g = h < 12 ? "morning" : h < 17 ? "afternoon" : "evening";
    document.querySelectorAll("[data-greet]").forEach((e) => (e.textContent = g));
    document.querySelectorAll("[data-year]").forEach((e) => (e.textContent = new Date().getFullYear()));
  }

  function countUp(el, to) {
    const n = Number(to) || 0;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches || n < 10) { el.textContent = n.toLocaleString(); return; }
    const start = performance.now(), dur = 700;
    const tick = (t) => { const p = Math.min(1, (t - start) / dur); el.textContent = Math.round(n * (1 - Math.pow(1 - p, 3))).toLocaleString(); if (p < 1) requestAnimationFrame(tick); };
    requestAnimationFrame(tick);
  }

  async function refresh() {
    const body = document.getElementById("invoiceTable");
    try {
      const r = await api("/api/v1/dashboard-stats");
      if (!r.ok) throw new Error("HTTP " + r.status);
      const data = await r.json();
      const s = data.stats || {};
      countUp(document.getElementById("stat-total"), s.total);
      countUp(document.getElementById("stat-pending"), s.pending);
      countUp(document.getElementById("stat-completed"), s.completed);
      countUp(document.getElementById("stat-rejected"), s.rejected);
      if (s.total) document.getElementById("stat-rate").textContent = `${Math.round(((s.completed || 0) / s.total) * 100)}% stamp rate`;
      if (data.settings && data.settings.mockMode) { const b = document.getElementById("envBadge"); if (b) b.hidden = false; }

      const rows = (data.invoices || []).slice(-8).reverse();
      body.innerHTML = rows.length
        ? rows.map((inv) => `
          <tr>
            <td><strong>${esc(inv.invoiceNumber)}</strong></td>
            <td><code>${esc(inv.supplierTin)}</code></td>
            <td class="num">${naira(inv.totalAmount)}</td>
            <td>${statusPill(inv.status)}</td>
            <td class="irn">${esc(inv.nrs_reference || "—")}</td>
          </tr>`).join("")
        : `<tr><td colspan="5" class="empty"><i class="bi bi-inboxes" aria-hidden="true"></i><strong>No invoices yet</strong>Submit your first invoice to see it stamped here.<div class="mt-3"><a class="btn btn-primary btn-sm" href="upload.html">Submit an invoice</a></div></td></tr>`;
    } catch (err) {
      console.error("Dashboard load failed", err);
      body.innerHTML = `<tr><td colspan="5" class="empty"><i class="bi bi-wifi-off" aria-hidden="true"></i><strong>Couldn't load invoices</strong>Check the middleware connection and try again.</td></tr>`;
      toast("Couldn't reach the middleware API.", "err");
    }
  }

  document.addEventListener("msl:ready", () => {
    greet();
    refresh();
    document.getElementById("refreshBtn").addEventListener("click", refresh);
  });
})();
