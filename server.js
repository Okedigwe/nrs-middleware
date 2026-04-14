// ==========================================
// 1. DEPENDENCIES & TOOLING
// ==========================================
const express = require('express');
const nodemailer = require('nodemailer'); 
const nrsClient = require('./src/services/nrs-invoice-client');
const { generateInvoiceQR } = require('./src/utils/qr-generator');
const { parseInput } = require('./src/utils/universal-parser');
const { saveInvoice, getDashboardData } = require('./src/utils/db'); 
require('dotenv').config();

// ==========================================
// 2. APP INITIALISATION
// ==========================================
const app = express();
const PORT = process.env.PORT || 3000;

/**
 * UPDATED: Configuration for Nodemailer via OAuth2
 * This uses Port 443 (HTTPS), which Render cannot block.
 */
const transporter = nodemailer.createTransport({
    service: 'gmail',
    auth: {
        type: 'OAuth2',
        user: process.env.EMAIL_USER,
        clientId: process.env.CLIENT_ID,
        clientSecret: process.env.CLIENT_SECRET,
        refreshToken: process.env.REFRESH_TOKEN
    }
});

// Verify connection on startup
transporter.verify(function (error, success) {
    if (error) {
        console.log("❌ OAuth2 Setup Error: " + error.message);
    } else {
        console.log("✅ API Connection ready - No more timeouts!");
    }
});

app.use(express.text({ type: '*/*', limit: '10mb' })); 
app.use(express.json()); 
app.use(express.static('public'));

// ==========================================
// 3. ROUTES & ENDPOINTS
// ==========================================

app.get('/health', (req, res) => {
    res.status(200).json({ 
        status: 'UP', 
        service: 'NRS Universal Middleware',
        timestamp: new Date().toISOString()
    });
});

app.post('/api/forgot-password', async (req, res) => {
    const { email } = req.body;
    console.log(`Incoming reset request for: ${email}`);

    if (!email) {
        return res.status(400).json({ success: false, message: 'Email is required' });
    }

    const mailOptions = {
        from: `"MSL Portal Support" <${process.env.EMAIL_USER}>`,
        to: email,
        subject: 'MSL Portal | Password Reset Request',
        html: `
            <div style="font-family: Arial, sans-serif; padding: 20px; border: 1px solid #eee; border-radius: 10px;">
                <h2 style="color: #2c3e50;">Password Reset Request</h2>
                <p>Click the button below to proceed to the reset page:</p>
                <div style="text-align: center; margin: 30px 0;">
                    <a href="https://nrs-msl.onrender.com/reset-password.html" 
                       style="background-color: #007bff; color: white; padding: 12px 25px; text-decoration: none; border-radius: 5px;">
                       Reset Password
                    </a>
                </div>
            </div>
        `
    };

    try {
        await transporter.sendMail(mailOptions);
        console.log("✅ Email sent successfully via OAuth2");
        res.status(200).json({ success: true });
    } catch (error) {
        console.error('❌ OAuth2 Send Error:', error.message);
        res.status(500).json({ success: false, error: error.message });
    }
});

// Dashboard Stats Endpoint
app.get('/api/v1/dashboard-stats', async (req, res) => {
    const data = await getDashboardData();
    res.json(data);
});

// Main Universal Endpoint
app.post('/api/v1/send-invoice', async (req, res) => {
    try {
        const contentType = req.headers['content-type'] || 'application/json';
        const normalizedData = await parseInput(req.body, contentType);
        const result = await nrsClient.submitInvoice(normalizedData);
        const qrImage = await generateInvoiceQR(result.irn);

        const savedRecord = await saveInvoice(
            normalizedData, 
            { ...result, qr_base64: qrImage }, 
            result.xml_content 
        );

        res.status(200).json({
            success: true,
            ...savedRecord
        });

    } catch (error) {
        console.error('❌ Middleware Error:', error.message);
        res.status(500).json({
            success: false,
            error: error.message || "An error occurred during processing"
        });
    }
});

const { getCustomers, saveCustomer } = require('./src/utils/db');

app.get('/api/v1/customers', async (req, res) => {
    const customers = await getCustomers();
    res.json(customers);
});

app.post('/api/v1/customers', express.json(), async (req, res) => {
    const customer = await saveCustomer(req.body);
    res.status(201).json(customer);
});

const { getSettings, saveSettings } = require('./src/utils/db');

app.get('/api/v1/settings', async (req, res) => {
    const settings = await getSettings();
    res.json(settings);
});

app.post('/api/v1/settings', express.json(), async (req, res) => {
    const updated = await saveSettings(req.body);
    res.json({ success: true, settings: updated });
});

// ==========================================
// 4. SERVER IGNITION
// ==========================================
app.listen(PORT, () => {
    console.log('--------------------------------------------------');
    console.log(`✅ MSL Universal Middleware is LIVE!`);
    console.log(`🚀 Endpoint: http://localhost:${PORT}/api/v1/send-invoice`);
    console.log(`📡 Accepting: JSON, CSV, and XML`);
    console.log('--------------------------------------------------');
});