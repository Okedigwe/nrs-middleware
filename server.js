// ==========================================
// 1. DEPENDENCIES & TOOLING
// ==========================================
const express = require('express');
const nrsClient = require('./src/services/nrs-invoice-client');
const { generateInvoiceQR } = require('./src/utils/qr-generator');
const { parseInput } = require('./src/utils/universal-parser');
const { saveInvoice, getDashboardData } = require('./src/utils/db'); // Database helpers
require('dotenv').config();

// ==========================================
// 2. APP INITIALISATION
// ==========================================
const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.text({ type: '*/*', limit: '10mb' })); 
app.use(express.static('public'));

// ==========================================
// 3. ROUTES & ENDPOINTS
// ==========================================

// Health Check
app.get('/health', (req, res) => {
    res.status(200).json({ 
        status: 'UP', 
        service: 'NRS Universal Middleware',
        timestamp: new Date().toISOString()
    });
});

// Dashboard Stats Endpoint
app.get('/api/v1/dashboard-stats', async (req, res) => {
    const data = await getDashboardData();
    res.json(data);
});

// Main Universal Endpoint (Unified & Updated to save XML)
app.post('/api/v1/send-invoice', async (req, res) => {
    try {
        const contentType = req.headers['content-type'] || 'application/json';
        
        // 1. Normalize input
        const normalizedData = await parseInput(req.body, contentType);

        // 2. Submit to NRS and get result
        const result = await nrsClient.submitInvoice(normalizedData);
        
        // 3. Generate QR Code
        const qrImage = await generateInvoiceQR(result.irn);

        /**
         * UPDATED STEP: Save to Database
         * We pass 'result.xml_content' so it can be viewed on the Invoices page later.
         */
        const savedRecord = await saveInvoice(
            normalizedData, 
            { ...result, qr_base64: qrImage }, 
            result.xml_content // The XML string generated during submission
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


// ADD THESE ROUTES TO server.js (Before app.listen)

const { getCustomers, saveCustomer } = require('./src/utils/db');

app.get('/api/v1/customers', async (req, res) => {
    const customers = await getCustomers();
    res.json(customers);
});

app.post('/api/v1/customers', express.json(), async (req, res) => {
    const customer = await saveCustomer(req.body);
    res.status(201).json(customer);
});

// ADD TO server.js (Before app.listen)
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
    console.log(`✅ NRS Universal Middleware is LIVE!`);
    console.log(`🚀 Endpoint: http://localhost:${PORT}/api/v1/send-invoice`);
    console.log(`📡 Accepting: JSON, CSV, and XML`);
    console.log('--------------------------------------------------');
});