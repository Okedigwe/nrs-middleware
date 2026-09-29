// ==========================================
// 1. DEPENDENCIES & CONFIG
// ==========================================
require('dotenv').config();
const express = require('express');
const helmet = require('helmet');
const cookieParser = require('cookie-parser');
const nodemailer = require('nodemailer');
const nrsClient = require('./src/services/nrs-invoice-client');
const auth = require('./src/auth');
const { generateInvoiceQR } = require('./src/utils/qr-generator');
const { parseInput } = require('./src/utils/universal-parser');
const { saveInvoice, getDashboardData, getCustomers, saveCustomer, getSettings, saveSettings } = require('./src/utils/db');

const app = express();
const PORT = process.env.PORT || 3000;
app.set('trust proxy', 1); // Render sits behind one proxy: real client IPs + secure cookies
app.disable('x-powered-by');

// ==========================================
// 2. EMAIL (Gmail OAuth2) for password resets
// ==========================================
const mailConfigured = !!(process.env.EMAIL_USER && process.env.CLIENT_ID && process.env.CLIENT_SECRET && process.env.REFRESH_TOKEN);
const transporter = mailConfigured
    ? nodemailer.createTransport({
        host: 'smtp.gmail.com',
        port: 465,
        secure: true, // TLS certificate is verified (the old rejectUnauthorized:false was removed)
        auth: {
            type: 'OAuth2',
            user: process.env.EMAIL_USER,
            clientId: process.env.CLIENT_ID,
            clientSecret: process.env.CLIENT_SECRET,
            refreshToken: process.env.REFRESH_TOKEN
        },
        connectionTimeout: 15000,
        greetingTimeout: 15000,
        socketTimeout: 15000
    })
    : null;
if (transporter) transporter.verify((err) => console.log(err ? `❌ Email setup error: ${err.message}` : '✅ Email ready'));
else console.warn('⚠️  Email not configured: password reset emails are disabled.');

async function sendResetEmail(to, link) {
    if (!transporter) throw new Error('Email not configured');
    await transporter.sendMail({
        from: `"MSL e-Invoicing" <${process.env.EMAIL_USER}>`,
        to,
        subject: 'Reset your MSL e-Invoicing password',
        text: `A password reset was requested for your MSL e-Invoicing account.\n\nSet a new password (link valid for 30 minutes):\n${link}\n\nIf you didn't request this, ignore this email.`,
        html: `<div style="font-family:Arial,sans-serif;padding:24px;border:1px solid #e4e8f0;border-radius:12px;max-width:520px">
            <h2 style="color:#0a1633;margin-top:0">Reset your password</h2>
            <p>A password reset was requested for your <strong>MSL e-Invoicing</strong> account. This link is valid for 30 minutes and can be used once.</p>
            <p style="text-align:center;margin:28px 0"><a href="${link}" style="background:#007cc2;color:#fff;padding:12px 24px;text-decoration:none;border-radius:8px;font-weight:600">Set a new password</a></p>
            <p style="font-size:12px;color:#6b7690">If you didn't request this, you can ignore this email. Your password won't change.</p></div>`
    });
}

// ==========================================
// 3. SECURITY MIDDLEWARE
// ==========================================
app.use(helmet({
    contentSecurityPolicy: {
        directives: {
            defaultSrc: ["'self'"],
            scriptSrc: ["'self'", 'https://www.google.com/recaptcha/', 'https://www.gstatic.com/recaptcha/'],
            frameSrc: ['https://www.google.com/recaptcha/', 'https://recaptcha.google.com/recaptcha/'],
            imgSrc: ["'self'", 'data:', 'https://images.unsplash.com', 'https://microwaresolutions.com'],
            styleSrc: ["'self'", "'unsafe-inline'"],
            fontSrc: ["'self'"],
            connectSrc: ["'self'"],
            objectSrc: ["'none'"],
            frameAncestors: ["'none'"],
            baseUri: ["'self'"],
            formAction: ["'self'"]
        }
    },
    crossOriginEmbedderPolicy: false
}));
app.use(cookieParser());

// Invoices arrive as raw JSON / CSV / XML text; every other route takes JSON.
app.use((req, res, next) =>
    req.path === '/api/v1/send-invoice' ? next() : express.json({ limit: '1mb' })(req, res, next));

// No caching of API responses that contain customer or invoice data
app.use('/api', (req, res, next) => { res.set('Cache-Control', 'no-store'); next(); });

// ==========================================
// 4. ROUTES
// ==========================================
app.get('/health', (req, res) => res.json({ status: 'UP', service: 'NRS Universal Middleware', timestamp: new Date().toISOString() }));

// Login, logout, sessions, password change/reset + protection of every /api/v1 route
auth.mount(app, { sendMail: sendResetEmail });

app.get('/api/v1/dashboard-stats', async (req, res) => res.json(await getDashboardData()));

app.post('/api/v1/send-invoice', express.text({ type: '*/*', limit: '10mb' }), async (req, res) => {
    try {
        const normalizedData = await parseInput(req.body, req.get('content-type') || '');
        const result = await nrsClient.submitInvoice(normalizedData);
        const qrImage = await generateInvoiceQR(result.irn);
        const savedRecord = await saveInvoice(normalizedData, { ...result, qr_base64: qrImage }, result.xml_content);
        res.json({ success: true, ...savedRecord });
    } catch (error) {
        console.error('❌ Middleware Error:', error.message);
        // Parser messages are safe to show; anything else stays in the server log
        const isInputError = /^(Invalid or empty data|Format Conversion Failed)/.test(error.message || '');
        res.status(isInputError ? 400 : 502).json({ success: false, error: isInputError ? error.message : 'Submission failed. Check the invoice data or try again.' });
    }
});

app.get('/api/v1/customers', async (req, res) => res.json(await getCustomers()));
app.post('/api/v1/customers', async (req, res) => {
    const { name, tin, email } = req.body || {};
    if (!name || !tin) return res.status(400).json({ success: false, error: 'Name and Tax ID are required.' });
    res.status(201).json(await saveCustomer({ name, tin, email }));
});

app.get('/api/v1/settings', async (req, res) => res.json(await getSettings()));
app.post('/api/v1/settings', async (req, res) => res.json({ success: true, settings: await saveSettings(req.body) }));

// Static site (index.html is the public landing page; app pages check the session in the browser)
app.use(express.static('public', { extensions: ['html'], dotfiles: 'deny' }));

// JSON 404 for unknown API routes, generic error handler (no stack traces to clients)
app.use('/api', (req, res) => res.status(404).json({ success: false, error: 'Not found' }));
app.use((err, req, res, next) => {
    console.error('Unhandled error:', err.message);
    res.status(err.status || 500).json({ success: false, error: err.status === 413 ? 'Payload too large' : 'Server error' });
});

// ==========================================
// 5. START
// ==========================================
app.listen(PORT, () => {
    console.log(`✅ MSL Universal Middleware is live on port ${PORT}`);
    console.log(nrsClient.clientId ? '📡 NRS: live credentials loaded' : '⚠️  NRS: MOCK MODE (no NRS_CLIENT_ID set)');
});
