/* Manual invoice submission (requires auth.js) */
(function () {
  "use strict";
  const { esc, api, toast, setLoading } = window.MSL;
  const MAX = 5 * 1024 * 1024;
  const OK_EXT = ["json", "csv", "xml"];

  document.addEventListener("msl:ready", () => {
    document.querySelectorAll("[data-year]").forEach((e) => (e.textContent = new Date().getFullYear()));
    const input = document.getElementById("fileInput");
    const zone = document.getElementById("dropZone");
    const info = document.getElementById("fileInfo");
    const log = document.getElementById("logContainer");
    const btn = document.getElementById("processBtn");
    let file = null;

    const addLog = (msg, type = "") => {
      const t = new Date().toLocaleTimeString("en-GB");
      log.insertAdjacentHTML("beforeend", `<div class="${type}"><span class="t">${t}</span>${esc(msg)}</div>`);
      log.scrollTop = log.scrollHeight;
    };

    const pick = (f) => {
      if (!f) return;
      const ext = f.name.split(".").pop().toLowerCase();
      if (!OK_EXT.includes(ext)) { addLog(`Rejected ${f.name}: unsupported format (.${ext}).`, "e"); return toast("Use a .json, .csv or .xml file.", "err"); }
      if (f.size > MAX) { addLog(`Rejected ${f.name}: file exceeds 5 MB.`, "e"); return toast("File is larger than 5 MB.", "err"); }
      file = f;
      document.getElementById("fileName").textContent = f.name;
      document.getElementById("fileMeta").textContent = `${ext.toUpperCase()} · ${(f.size / 1024).toFixed(1)} KB`;
      info.classList.remove("d-none");
      addLog(`File selected: ${f.name} (${(f.size / 1024).toFixed(1)} KB)`, "i");
    };

    zone.addEventListener("click", () => input.click());
    zone.addEventListener("keydown", (e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); input.click(); } });
    input.addEventListener("change", (e) => pick(e.target.files[0]));
    ["dragenter", "dragover"].forEach((ev) => zone.addEventListener(ev, (e) => { e.preventDefault(); zone.classList.add("drag"); }));
    ["dragleave", "drop"].forEach((ev) => zone.addEventListener(ev, (e) => { e.preventDefault(); zone.classList.remove("drag"); }));
    zone.addEventListener("drop", (e) => pick(e.dataTransfer.files[0]));
    document.getElementById("clearBtn").addEventListener("click", () => { file = null; input.value = ""; info.classList.add("d-none"); addLog("File cleared."); });

    btn.addEventListener("click", async () => {
      if (!file) return;
      setLoading(btn, true, "Sending…");
      addLog("Reading file…");
      try {
        const content = await file.text();
        addLog("Validating and transmitting to NRS via middleware…", "i");
        const r = await api("/api/v1/send-invoice", { method: "POST", headers: { "Content-Type": "text/plain" }, body: content });
        const result = await r.json().catch(() => ({}));
        if (r.ok && result.success) {
          addLog(`Stamped ✓  NRS reference: ${result.nrs_reference || "n/a"}`);
          addLog("QR code generated. Opening the dashboard…");
          toast("Invoice accepted and stamped by NRS.", "ok");
          setTimeout(() => (window.location.href = "dashboard.html"), 1800);
        } else {
          addLog(`Error: ${result.error || "Submission rejected (HTTP " + r.status + ")"}`, "e");
          toast("Submission failed. See the log for details.", "err");
          setLoading(btn, false, "Validate & send to NRS");
        }
      } catch (err) {
        addLog(`Network error: ${err.message}`, "e");
        setLoading(btn, false, "Validate & send to NRS");
      }
    });
  });
})();
