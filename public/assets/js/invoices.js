/* Invoice register (requires auth.js + bootstrap bundle) */
(function () {
  "use strict";
  const { esc, naira, api, statusPill, toast } = window.MSL;
  let all = [];
  let filter = "ALL";
  let term = "";

  const norm = (s) => {
    const u = String(s || "").toUpperCase();
    if (["COMPLETED", "SUCCESS", "STAMPED", "ACCEPTED"].includes(u)) return "COMPLETED";
    if (["REJECTED", "FAILED", "ERROR"].includes(u)) return "REJECTED";
    if (["PENDING", "QUEUED", "PROCESSING"].includes(u)) return "PENDING";
    return u;
  };
  const fmtDate = (t) => { const d = new Date(t); return isNaN(d) ? "—" : d.toLocaleDateString("en-NG", { day: "2-digit", month: "short", year: "numeric" }); };

  function render() {
    const body = document.getElementById("invoiceListBody");
    const rows = all.filter((inv) =>
      (filter === "ALL" || norm(inv.status) === filter) &&
      (!term || String(inv.invoiceNumber || "").toLowerCase().includes(term) || String(inv.supplierTin || "").toLowerCase().includes(term))
    );
    if (!rows.length) {
      body.innerHTML = `<tr><td colspan="6" class="empty"><i class="bi bi-search" aria-hidden="true"></i><strong>${all.length ? "No matching invoices" : "No invoices yet"}</strong>${all.length ? "Try a different search or filter." : "Submitted invoices will appear here."}</td></tr>`;
      return;
    }
    body.innerHTML = rows.map((inv, i) => `
      <tr>
        <td>${esc(fmtDate(inv.timestamp))}</td>
        <td><strong>${esc(inv.invoiceNumber)}</strong></td>
        <td><code>${esc(inv.supplierTin)}</code></td>
        <td class="num">${naira(inv.totalAmount)}</td>
        <td>${statusPill(inv.status)}</td>
        <td class="text-end"><button class="btn btn-sm btn-outline-primary" type="button" data-view="${all.indexOf(inv)}"><i class="bi bi-eye me-1" aria-hidden="true"></i>View</button></td>
      </tr>`).join("");
  }

  async function refresh() {
    try {
      const r = await api("/api/v1/dashboard-stats");
      if (!r.ok) throw new Error("HTTP " + r.status);
      const data = await r.json();
      all = (data.invoices || []).slice().reverse();
      render();
    } catch (e) {
      console.error(e);
      document.getElementById("invoiceListBody").innerHTML = `<tr><td colspan="6" class="empty"><i class="bi bi-wifi-off" aria-hidden="true"></i><strong>Couldn't load invoices</strong>Check the middleware connection and try again.</td></tr>`;
    }
  }

  function view(idx) {
    const inv = all[idx];
    if (!inv) return;
    document.getElementById("detailsTitle").textContent = `Invoice ${inv.invoiceNumber || ""}`;
    document.getElementById("detailsSub").textContent = fmtDate(inv.timestamp);
    document.getElementById("xmlPreview").textContent = inv.ubl_xml || inv.xml_content || "No XML payload stored for this invoice.";
    const qr = document.getElementById("modalQr");
    if (inv.qr_base64) {
      qr.src = String(inv.qr_base64).startsWith("data:image/") ? inv.qr_base64 : `data:image/png;base64,${inv.qr_base64}`;
      qr.parentElement.style.display = "";
    } else qr.parentElement.style.display = "none";
    document.getElementById("detailsKv").innerHTML = `
      <dt>Status</dt><dd>${statusPill(inv.status)}</dd>
      <dt>Amount</dt><dd>${naira(inv.totalAmount)}</dd>
      <dt>Supplier Tax ID</dt><dd class="mono">${esc(inv.supplierTin || "—")}</dd>
      <dt>NRS reference</dt><dd class="mono">${esc(inv.nrs_reference || "—")}</dd>`;
    bootstrap.Modal.getOrCreateInstance(document.getElementById("detailsModal")).show();
  }

  function exportCsv() {
    if (!all.length) return toast("Nothing to export yet.", "info");
    const cols = ["timestamp", "invoiceNumber", "supplierTin", "totalAmount", "status", "nrs_reference"];
    const q = (v) => `"${String(v ?? "").replace(/"/g, '""')}"`;
    const csv = [cols.join(","), ...all.map((r) => cols.map((c) => q(r[c])).join(","))].join("\n");
    const a = document.createElement("a");
    a.href = URL.createObjectURL(new Blob([csv], { type: "text/csv" }));
    a.download = `nrs-invoices-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(a.href);
  }

  document.addEventListener("msl:ready", () => {
    document.querySelectorAll("[data-year]").forEach((e) => (e.textContent = new Date().getFullYear()));
    refresh();
    document.getElementById("refreshBtn").addEventListener("click", refresh);
    document.getElementById("exportBtn").addEventListener("click", exportCsv);
    document.getElementById("printBtn").addEventListener("click", () => window.print());
    document.getElementById("searchInput").addEventListener("input", (e) => { term = e.target.value.trim().toLowerCase(); render(); });
    document.getElementById("statusFilter").addEventListener("click", (e) => {
      const b = e.target.closest("button[data-f]"); if (!b) return;
      filter = b.dataset.f;
      e.currentTarget.querySelectorAll("button").forEach((x) => x.classList.toggle("active", x === b));
      render();
    });
    document.getElementById("invoiceListBody").addEventListener("click", (e) => { const b = e.target.closest("[data-view]"); if (b) view(Number(b.dataset.view)); });
    document.getElementById("copyXml").addEventListener("click", async () => {
      try { await navigator.clipboard.writeText(document.getElementById("xmlPreview").textContent); toast("XML copied to clipboard.", "ok"); } catch { toast("Copy failed.", "err"); }
    });
  });
})();
