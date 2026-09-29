/* Customer directory (requires auth.js + bootstrap bundle) */
(function () {
  "use strict";
  const { esc, api, toast } = window.MSL;
  let all = [];

  function render(list) {
    const body = document.getElementById("customerListBody");
    document.getElementById("custCount").textContent = `${all.length} customer${all.length === 1 ? "" : "s"}`;
    if (!list.length) {
      body.innerHTML = `<tr><td colspan="5" class="empty"><i class="bi bi-buildings" aria-hidden="true"></i><strong>${all.length ? "No matches" : "No customers yet"}</strong>${all.length ? "Try another name or Tax ID." : "Add the buyers you invoice most often."}</td></tr>`;
      return;
    }
    body.innerHTML = list.map((c) => {
      const initials = String(c.name || "?").split(/\s+/).slice(0, 2).map((w) => w[0] || "").join("").toUpperCase();
      return `<tr>
        <td><div class="d-flex align-items-center gap-2"><span class="avatar d-inline-grid" style="width:32px;height:32px;border-radius:9px;place-items:center;background:var(--msl-blue-50);color:var(--msl-blue);font:600 .74rem/1 var(--font-display)">${esc(initials)}</span><strong>${esc(c.name)}</strong></div></td>
        <td><code>${esc(c.tin)}</code></td>
        <td>${esc(c.email)}</td>
        <td class="num">${esc(c.invoices ?? 0)}</td>
        <td class="text-end"><button class="btn btn-sm btn-ghost" type="button" aria-label="Edit ${esc(c.name)}" disabled title="Editing coming soon"><i class="bi bi-pencil" aria-hidden="true"></i></button></td>
      </tr>`;
    }).join("");
  }

  async function load() {
    try {
      const r = await api("/api/v1/dashboard-stats");
      const data = r.ok ? await r.json() : {};
      all = Array.isArray(data.customers) ? data.customers : [];
    } catch { all = []; }
    render(all);
  }

  document.addEventListener("msl:ready", () => {
    document.querySelectorAll("[data-year]").forEach((e) => (e.textContent = new Date().getFullYear()));
    load();
    document.getElementById("searchInput").addEventListener("input", (e) => {
      const t = e.target.value.trim().toLowerCase();
      render(all.filter((c) => String(c.name).toLowerCase().includes(t) || String(c.tin).toLowerCase().includes(t)));
    });
    document.getElementById("addCustomerForm").addEventListener("submit", async (e) => {
      e.preventDefault();
      const c = { name: custName.value.trim(), tin: custTin.value.trim(), email: custEmail.value.trim(), invoices: 0 };
      let saved = false;
      try {
        const r = await api("/api/v1/customers", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(c) });
        saved = r.ok;
      } catch {}
      all.unshift(c);
      render(all);
      bootstrap.Modal.getInstance(document.getElementById("customerModal")).hide();
      e.target.reset();
      toast(saved ? "Customer saved." : "Customer added for this session (server save endpoint not available yet).", saved ? "ok" : "info");
    });
  });
})();
