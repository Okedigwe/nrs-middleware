const { JSONFilePreset } = require('lowdb/node');
const path = require('path');

// 1. Define the persistent path for Render or Local
const dbPath = process.env.RENDER_DISK_PATH 
    ? path.join(process.env.RENDER_DISK_PATH, 'db.json') 
    : path.join(process.cwd(), 'db.json');

// 2. Helper to get the DB instance with specific defaults
const getDb = async (key, defaultStructure) => {
    // We set up a global structure so all keys exist in one file
    const globalDefaults = { 
        invoices: [], 
        stats: { total: 0, pending: 0, completed: 0, rejected: 0 },
        customers: [],
        settings: {}
    };
    return await JSONFilePreset(dbPath, globalDefaults);
};

// 3. Save Invoice Logic
const saveInvoice = async (invoiceData, nrsResult, xmlString) => {
    const db = await getDb();

    const newRecord = {
        ...invoiceData,
        nrs_reference: nrsResult.irn,
        qr_base64: nrsResult.qr_base64,
        xml_content: xmlString,
        status: nrsResult.status || 'COMPLETED',
        timestamp: new Date().toISOString()
    };

    await db.update(({ invoices, stats }) => {
        invoices.unshift(newRecord);
        stats.total++;
        if (newRecord.status === 'COMPLETED') stats.completed++;
        else if (newRecord.status === 'REJECTED') stats.rejected++;
        else stats.pending++;
    });

    return newRecord;
};

// 4. Fetch Dashboard Data
const getDashboardData = async () => {
    const db = await getDb();
    return db.data;
};

// 5. Customer Management
const getCustomers = async () => {
    const db = await getDb();
    return db.data.customers || [];
};

const saveCustomer = async (customer) => {
    const db = await getDb();
    await db.update(({ customers }) => {
        customers.push({ ...customer, id: Date.now() });
    });
    return customer;
};

// 6. Settings Management
const getSettings = async () => {
    const db = await getDb();
    return db.data.settings || {};
};

const saveSettings = async (newSettings) => {
    const db = await getDb();
    await db.update(({ settings }) => {
        const secret = newSettings.clientSecret || settings.clientSecret;
        Object.assign(settings, { ...newSettings, clientSecret: secret });
    });
    return db.data.settings;
};

module.exports = {
    saveInvoice,
    getDashboardData,
    getCustomers,
    saveCustomer,
    getSettings,
    saveSettings
};