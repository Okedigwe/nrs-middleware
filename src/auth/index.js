/**
 * Authentication for the MSL NRS Middleware.
 *
 * - Users live in db.json (`users`), passwords stored as bcrypt hashes only.
 * - First boot: if no users exist, an admin is created from ADMIN_EMAIL + ADMIN_PASSWORD.
 *   Remove ADMIN_PASSWORD from the environment after the first successful login.
 * - Sessions: signed JWT in an httpOnly, SameSite=Strict, Secure cookie.
 * - ERPs call the API server-to-server with the header  x-api-key: <MIDDLEWARE_API_KEY>.
 */
const crypto = require("crypto");
const jwt = require("jsonwebtoken");
const bcrypt = require("bcryptjs");
const { getDb } = require("../utils/db");

const COOKIE = "msl_session";
const isProd = process.env.NODE_ENV === "production" || !!process.env.RENDER;
const JWT_SECRET = process.env.JWT_SECRET || (isProd ? null : crypto.randomBytes(32).toString("hex"));
if (!JWT_SECRET) throw new Error("JWT_SECRET must be set in production.");

/* ---------- helpers ---------- */
const norm = (e) => String(e || "").trim().toLowerCase();
const publicUser = (u) => ({ email: u.email, name: u.name, role: u.role });
const sha256 = (s) => crypto.createHash("sha256").update(s).digest("hex");
const safeEqual = (a, b) => {
  const x = Buffer.from(String(a)), y = Buffer.from(String(b));
  return x.length === y.length && crypto.timingSafeEqual(x, y);
};
const clientIp = (req) => req.ip || req.socket.remoteAddress || "";

// simple in-memory limiter: max `n` hits per `ms` per key
function limiter(n, ms) {
  const hits = new Map();
  return (key) => {
    const now = Date.now();
    const list = (hits.get(key) || []).filter((t) => now - t < ms);
    list.push(now);
    hits.set(key, list);
    return list.length > n;
  };
}
const loginLimited = limiter(8, 15 * 60 * 1000);
const resetLimited = limiter(5, 60 * 60 * 1000);

async function findUser(email) {
  const db = await getDb();
  return (db.data.users || []).find((u) => u.email === norm(email));
}

async function seedAdmin() {
  const db = await getDb();
  db.data.users ||= [];
  if (db.data.users.length) return;
  const email = norm(process.env.ADMIN_EMAIL);
  const pass = process.env.ADMIN_PASSWORD;
  if (!email || !pass) {
    console.warn("[auth] No users yet. Set ADMIN_EMAIL and ADMIN_PASSWORD to create the first admin.");
    return;
  }
  if (pass.length < 12) throw new Error("ADMIN_PASSWORD must be at least 12 characters.");
  await db.update(({ users }) => {
    users.push({ email, name: process.env.ADMIN_NAME || "Administrator", role: "Administrator", passwordHash: bcrypt.hashSync(pass, 12), createdAt: new Date().toISOString() });
  });
  console.log(`[auth] Admin account created for ${email}. Remove ADMIN_PASSWORD from the environment now.`);
}

async function verifyRecaptcha(token, ip) {
  if (!process.env.RECAPTCHA_SECRET) return true; // not configured
  if (!token) return false;
  try {
    const r = await fetch("https://www.google.com/recaptcha/api/siteverify", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({ secret: process.env.RECAPTCHA_SECRET, response: token, remoteip: ip }),
    });
    return !!(await r.json()).success;
  } catch {
    return false;
  }
}

function issue(res, user, remember) {
  const token = jwt.sign({ sub: user.email, name: user.name, role: user.role, pv: user.passwordChangedAt || "" }, JWT_SECRET, { expiresIn: remember ? "7d" : "8h" });
  res.cookie(COOKIE, token, { httpOnly: true, secure: isProd, sameSite: "strict", path: "/", maxAge: (remember ? 7 * 24 : 8) * 3600 * 1000 });
}

/* ---------- middleware ---------- */
async function requireAuth(req, res, next) {
  const key = req.get("x-api-key");
  if (key && process.env.MIDDLEWARE_API_KEY && safeEqual(key, process.env.MIDDLEWARE_API_KEY)) {
    req.user = { email: "erp-integration", name: "ERP integration", role: "System" };
    return next();
  }
  try {
    const p = jwt.verify(req.cookies?.[COOKIE], JWT_SECRET);
    const u = await findUser(p.sub);
    if (!u || (u.passwordChangedAt || "") !== p.pv) throw new Error("stale session"); // logs out after password change
    req.user = publicUser(u);
    return next();
  } catch {
    return res.status(401).json({ success: false, error: "Unauthorised" });
  }
}

/* ---------- routes ---------- */
function mount(app, { sendMail } = {}) {
  seedAdmin().catch((e) => console.error("[auth] seed failed:", e.message));

  app.post("/api/v1/auth/login", async (req, res) => {
    const ip = clientIp(req);
    if (loginLimited(ip)) return res.status(429).json({ success: false, error: "Too many attempts. Try again in 15 minutes." });
    const { email, password, remember, recaptchaToken } = req.body || {};
    if (!(await verifyRecaptcha(recaptchaToken, ip))) return res.status(400).json({ success: false, error: "reCAPTCHA check failed. Please try again." });
    const u = await findUser(email);
    const ok = u && typeof password === "string" && (await bcrypt.compare(password, u.passwordHash));
    if (!ok) return res.status(401).json({ success: false, error: "Incorrect email or password." });
    issue(res, u, !!remember);
    res.json({ success: true });
  });

  app.get("/api/v1/auth/me", requireAuth, (req, res) => res.json(req.user));

  app.post("/api/v1/auth/logout", (req, res) => {
    res.clearCookie(COOKIE, { path: "/" });
    res.json({ success: true });
  });

  app.post("/api/v1/auth/change-password", requireAuth, async (req, res) => {
    const { currentPassword, newPassword } = req.body || {};
    const u = await findUser(req.user.email);
    if (!u || !(await bcrypt.compare(String(currentPassword || ""), u.passwordHash))) return res.status(400).json({ success: false, error: "Current password is incorrect." });
    if (typeof newPassword !== "string" || newPassword.length < 12) return res.status(400).json({ success: false, error: "New password must be at least 12 characters." });
    const db = await getDb();
    const stamp = new Date().toISOString();
    await db.update(({ users }) => {
      const x = users.find((y) => y.email === u.email);
      x.passwordHash = bcrypt.hashSync(newPassword, 12);
      x.passwordChangedAt = stamp;
    });
    issue(res, { ...u, passwordChangedAt: stamp }, false);
    res.json({ success: true });
  });

  // Always answers the same way, so it can't be used to discover which emails have accounts.
  app.post("/api/forgot-password", async (req, res) => {
    const generic = { success: true, message: "If an account exists, a reset link has been sent." };
    const email = norm(req.body?.email);
    if (!email || resetLimited(clientIp(req)) || resetLimited(email)) return res.json(generic);
    const u = await findUser(email);
    if (!u) return res.json(generic);
    const token = crypto.randomBytes(32).toString("hex");
    const db = await getDb();
    await db.update(({ users }) => {
      const x = users.find((y) => y.email === email);
      x.resetHash = sha256(token);
      x.resetExpires = Date.now() + 30 * 60 * 1000;
    });
    const base = (process.env.APP_URL || `${req.protocol}://${req.get("host")}`).replace(/\/+$/, "");
    const link = `${base}/reset-password.html?token=${token}`;
    try {
      if (sendMail) await sendMail(u.email, link);
    } catch (e) {
      console.error("[auth] reset email failed:", e.message);
    }
    res.json(generic);
  });

  app.post("/api/reset-password", async (req, res) => {
    const { token, newPassword } = req.body || {};
    if (typeof newPassword !== "string" || newPassword.length < 12) return res.status(400).json({ success: false, error: "Use at least 12 characters." });
    const hash = sha256(String(token || ""));
    const db = await getDb();
    const u = (db.data.users || []).find((x) => x.resetHash && safeEqual(x.resetHash, hash) && x.resetExpires > Date.now());
    if (!u) return res.status(400).json({ success: false, error: "This reset link is invalid or has expired. Request a new one." });
    await db.update(({ users }) => {
      const x = users.find((y) => y.email === u.email);
      x.passwordHash = bcrypt.hashSync(newPassword, 12);
      x.passwordChangedAt = new Date().toISOString();
      delete x.resetHash;
      delete x.resetExpires;
    });
    res.json({ success: true });
  });

  // Everything else under /api/v1 needs a session or the ERP API key.
  app.use("/api/v1", (req, res, next) => (req.path.startsWith("/auth/") ? next() : requireAuth(req, res, next)));
}

module.exports = { mount, requireAuth };
