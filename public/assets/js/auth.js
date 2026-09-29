/**
 * MSL NRS Middleware — shared auth + app shell
 *
 * SECURITY: credentials are NEVER checked in the browser.
 * Login is verified by the server (POST /api/v1/auth/login), which sets an
 * httpOnly session cookie. Protected pages confirm the session with
 * GET /api/v1/auth/me. See server/auth-routes.example.js.
 */
(function () {
  "use strict";

  const API = {
    login: "/api/v1/auth/login",
    me: "/api/v1/auth/me",
    logout: "/api/v1/auth/logout",
    forgot: "/api/forgot-password",
    health: "/health",
  };
  // reCAPTCHA: the site key only works on the domains registered for it in the
  // Google reCAPTCHA admin console. Everywhere else (localhost, file://, previews)
  // the widget is skipped instead of showing "Invalid domain for site key".
  const RECAPTCHA_SITE_KEY = "6Ld-hrUsAAAAABp77njidOD2bWrIXasrEcmnVqhq";
  const RECAPTCHA_HOSTS = ["nrs-middleware.onrender.com"]; // add your custom domain here too
  const captchaOn = RECAPTCHA_HOSTS.includes(window.location.hostname);
  let captchaId = null;

  const PUBLIC_PAGES = ["/", "/index.html", "/login.html", "/forgot-password.html", "/reset-password.html"];
  const path = window.location.pathname.replace(/\/+$/, "") || "/";
  const isPublic = PUBLIC_PAGES.includes(path);

  /* ---------- helpers (exported on window.MSL) ---------- */
  const esc = (v) =>
    String(v ?? "").replace(/[&<>"'`]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;", "`": "&#96;" }[c]));

  const naira = (n) => {
    const v = Number.parseFloat(n);
    return Number.isFinite(v) ? "₦" + v.toLocaleString("en-NG", { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : "—";
  };

  function toast(message, type = "info") {
    let stack = document.querySelector(".toast-stack");
    if (!stack) {
      stack = document.createElement("div");
      stack.className = "toast-stack";
      stack.setAttribute("role", "status");
      stack.setAttribute("aria-live", "polite");
      document.body.appendChild(stack);
    }
    const icon = { ok: "bi-check-circle-fill", err: "bi-exclamation-octagon-fill", info: "bi-info-circle-fill" }[type] || "bi-info-circle-fill";
    const el = document.createElement("div");
    el.className = `toast-x ${type}`;
    el.innerHTML = `<i class="bi ${icon}" aria-hidden="true"></i><div>${esc(message)}</div>`;
    stack.appendChild(el);
    setTimeout(() => { el.style.opacity = "0"; el.style.transition = "opacity .3s"; }, 4200);
    setTimeout(() => el.remove(), 4600);
  }

  async function api(url, opts = {}) {
    const res = await fetch(url, { credentials: "same-origin", headers: { Accept: "application/json", ...(opts.headers || {}) }, ...opts });
    if (res.status === 401 && !isPublic) { window.location.replace("login.html?next=" + encodeURIComponent(path)); throw new Error("Unauthorised"); }
    return res;
  }

  const statusPill = (status) => {
    const s = String(status || "").toUpperCase();
    if (["COMPLETED", "SUCCESS", "STAMPED", "ACCEPTED"].includes(s)) return `<span class="pill pill-ok">${esc(s)}</span>`;
    if (["PENDING", "QUEUED", "PROCESSING"].includes(s)) return `<span class="pill pill-warn">${esc(s)}</span>`;
    if (["REJECTED", "FAILED", "ERROR"].includes(s)) return `<span class="pill pill-err">${esc(s)}</span>`;
    return `<span class="pill pill-muted">${esc(s || "UNKNOWN")}</span>`;
  };

  function setLoading(btn, on, label) {
    if (!btn) return;
    btn.disabled = on;
    btn.classList.toggle("loading", on);
    const l = btn.querySelector(".lbl");
    if (l && label) l.textContent = label;
  }

  window.MSL = { esc, naira, toast, api, statusPill, setLoading, session: null };

  /* ---------- app shell ---------- */
  async function loadShell(user) {
    const sb = document.getElementById("sidebar-container");
    if (sb) {
      try {
        const r = await fetch("/components/sidebar.html", { credentials: "same-origin" });
        if (r.ok) sb.innerHTML = await r.text();
      } catch (e) { console.error("Sidebar load failed", e); }
      const current = path === "/" ? "dashboard.html" : path.split("/").pop();
      sb.querySelectorAll(".nav-link").forEach((a) => {
        if (a.getAttribute("href") === current) { a.classList.add("active"); a.setAttribute("aria-current", "page"); }
      });
      checkHealth();
    }

    const tb = document.getElementById("topbar");
    if (tb) {
      const name = (user && (user.name || user.email)) || "User";
      const initials = name.split(/[\s@.]+/).filter(Boolean).slice(0, 2).map((p) => p[0].toUpperCase()).join("");
      const title = document.body.dataset.title || document.title.split("|")[0].trim();
      tb.innerHTML = `
        <button class="btn btn-ghost btn-icon menu-toggle" type="button" aria-label="Open navigation" data-sb-toggle><i class="bi bi-list" aria-hidden="true"></i></button>
        <div class="crumbs">Workspace &nbsp;/&nbsp; <strong>${esc(title)}</strong></div>
        <div class="spacer"></div>
        <span class="env-badge" id="envBadge" hidden>Sandbox mode</span>
        <a class="btn btn-ghost btn-icon" href="https://einvoice.nrs.gov.ng/" target="_blank" rel="noopener" title="NRS e-Invoicing portal" aria-label="Open NRS e-Invoicing portal"><i class="bi bi-bank" aria-hidden="true"></i></a>
        <div class="user-chip" title="${esc(user && user.email)}">
          <span class="avatar" aria-hidden="true">${esc(initials || "U")}</span>
          <span class="meta"><b>${esc(name)}</b><small>${esc((user && user.role) || "Administrator")}</small></span>
        </div>`;
    }
    document.querySelectorAll("[data-user-name]").forEach((el) => {
      const first = ((user && (user.name || user.email)) || "").split(/[\s@]/)[0];
      el.textContent = first ? first.charAt(0).toUpperCase() + first.slice(1) : "there";
    });

    document.addEventListener("click", (e) => {
      if (e.target.closest("[data-sb-toggle]")) document.body.classList.toggle("sb-open");
      else if (document.body.classList.contains("sb-open") && !e.target.closest("#sidebar-container")) document.body.classList.remove("sb-open");
      if (e.target.closest("#logoutBtn")) { e.preventDefault(); logout(); }
    });
    document.addEventListener("keydown", (e) => { if (e.key === "Escape") document.body.classList.remove("sb-open"); });
  }

  async function checkHealth() {
    const el = document.getElementById("sbStatus");
    if (!el) return;
    try {
      const r = await fetch(API.health, { cache: "no-store" });
      const j = await r.json();
      const up = r.ok && String(j.status).toUpperCase() === "UP";
      el.classList.toggle("down", !up);
      el.querySelector("span").textContent = up ? "Middleware online" : "Middleware degraded";
    } catch {
      el.classList.add("down");
      el.querySelector("span").textContent = "Middleware unreachable";
    }
  }

  async function logout() {
    try { await fetch(API.logout, { method: "POST", credentials: "same-origin" }); } catch {}
    try { localStorage.removeItem("isLoggedIn"); localStorage.removeItem("userEmail"); } catch {}
    window.location.replace("login.html");
  }

  /* ---------- session guard for protected pages ---------- */
  async function guard() {
    document.documentElement.classList.add("auth-pending");
    try {
      const r = await fetch(API.me, { credentials: "same-origin", cache: "no-store" });
      if (!r.ok) throw new Error("no session");
      const user = await r.json();
      window.MSL.session = user;
      document.documentElement.classList.remove("auth-pending");
      await loadShell(user);
      document.dispatchEvent(new CustomEvent("msl:ready", { detail: user }));
    } catch {
      window.location.replace("login.html?next=" + encodeURIComponent(path));
    }
  }

  /* ---------- login ---------- */
  function initLogin() {
    const form = document.getElementById("loginForm");
    if (!form) return;
    const wrap = document.getElementById("captchaWrap");
    if (captchaOn && wrap) {
      wrap.hidden = false;
      window.mslCaptchaReady = () => { captchaId = window.grecaptcha.render(wrap, { sitekey: RECAPTCHA_SITE_KEY }); };
      const sc = document.createElement("script");
      sc.src = "https://www.google.com/recaptcha/api.js?onload=mslCaptchaReady&render=explicit";
      sc.async = true; sc.defer = true;
      document.head.appendChild(sc);
    }
    const alertBox = document.getElementById("loginAlert");
    const btn = form.querySelector("button[type=submit]");
    const showErr = (msg) => { alertBox.querySelector("span").textContent = msg; alertBox.className = "alert-x err show"; };

    document.querySelectorAll(".toggle-pass").forEach((b) =>
      b.addEventListener("click", () => {
        const input = b.parentElement.querySelector("input");
        const show = input.type === "password";
        input.type = show ? "text" : "password";
        b.setAttribute("aria-label", show ? "Hide password" : "Show password");
        b.innerHTML = `<i class="bi ${show ? "bi-eye-slash" : "bi-eye"}" aria-hidden="true"></i>`;
      })
    );

    form.addEventListener("submit", async (e) => {
      e.preventDefault();
      alertBox.className = "alert-x";
      const email = form.email.value.trim();
      const password = form.password.value;
      const remember = form.remember && form.remember.checked;
      let recaptchaToken = "";
      if (captchaOn && window.grecaptcha && captchaId !== null) {
        recaptchaToken = window.grecaptcha.getResponse(captchaId);
        if (!recaptchaToken) return showErr("Please confirm you're not a robot.");
      }
      setLoading(btn, true, "Signing in…");
      try {
        const r = await fetch(API.login, {
          method: "POST",
          credentials: "same-origin",
          headers: { "Content-Type": "application/json", Accept: "application/json" },
          body: JSON.stringify({ email, password, remember, recaptchaToken }),
        });
        if (r.status === 404) throw new Error("The authentication service isn't deployed yet. Please contact your administrator.");
        const j = await r.json().catch(() => ({}));
        if (!r.ok || j.success === false) throw new Error(j.error || "Incorrect email or password.");
        const next = new URLSearchParams(location.search).get("next");
        window.location.replace(next && next.startsWith("/") && !next.startsWith("//") ? next : "dashboard.html");
      } catch (err) {
        showErr(err.message || "Sign-in failed. Please try again.");
        if (captchaOn && window.grecaptcha && captchaId !== null) try { window.grecaptcha.reset(captchaId); } catch {}
        setLoading(btn, false, "Sign in");
      }
    });
  }

  /* ---------- forgot password ---------- */
  function initForgot() {
    const form = document.getElementById("forgotForm");
    if (!form) return;
    const btn = form.querySelector("button[type=submit]");
    const alertBox = document.getElementById("forgotAlert");
    form.addEventListener("submit", async (e) => {
      e.preventDefault();
      const email = form.resetEmail.value.trim();
      setLoading(btn, true, "Sending…");
      try {
        await fetch(API.forgot, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ email }) });
      } catch {}
      // Same message whether or not the account exists (prevents account enumeration).
      alertBox.querySelector("span").textContent = `If an account exists for ${email}, a reset link is on its way. Check your inbox and spam folder.`;
      alertBox.className = "alert-x ok show";
      form.reset();
      setLoading(btn, false, "Send reset link");
    });
  }

  /* ---------- reset password (from emailed link) ---------- */
  function initReset() {
    const form = document.getElementById("resetForm");
    if (!form) return;
    const btn = form.querySelector("button[type=submit]");
    const alertBox = document.getElementById("resetAlert");
    const token = new URLSearchParams(location.search).get("token") || "";
    const show = (msg, ok) => { alertBox.querySelector("span").textContent = msg; alertBox.className = `alert-x ${ok ? "ok" : "err"} show`; };
    if (!token) { show("This reset link is invalid. Request a new one.", false); btn.disabled = true; return; }
    form.addEventListener("submit", async (e) => {
      e.preventDefault();
      const pw = form.newPassword.value, pw2 = form.confirmPassword.value;
      if (pw.length < 12) return show("Use at least 12 characters.", false);
      if (pw !== pw2) return show("Passwords don't match.", false);
      setLoading(btn, true, "Saving…");
      try {
        const r = await fetch("/api/reset-password", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ token, newPassword: pw }) });
        const j = await r.json().catch(() => ({}));
        if (!r.ok) throw new Error(j.error || "This reset link has expired. Request a new one.");
        show("Password updated. Redirecting to sign in…", true);
        form.reset();
        setTimeout(() => window.location.replace("login.html"), 1800);
      } catch (err) { show(err.message, false); setLoading(btn, false, "Set new password"); }
    });
  }

  /* ---------- boot ---------- */
  document.addEventListener("DOMContentLoaded", () => {
    document.querySelectorAll("[data-year]").forEach((e) => (e.textContent = new Date().getFullYear()));
    try { localStorage.removeItem("isLoggedIn"); } catch {} // retire the old client-side flag
    initLogin();
    initForgot();
    initReset();
    if (!isPublic && document.getElementById("main-content")) guard();
  });
})();
