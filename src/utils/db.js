const { JSONFilePreset } = require('lowdb/node');
const path = require('path');

// 1. Define the persistent path for Render or Local
const dbPath = process.env.RENDER_DISK_PATH 
    ? path.join(process.env.RENDER_DISK_PATH, 'db.json') 
    : path.join(process.cwd(), 'db.json');

// 2. Helper to get the DB instance with specific defaults
let dbPromise = null; // one shared instance, so concurrent writes don't overwrite each other
const getDb = async () => {
    if (dbPromise) return dbPromise;
    // We set up a global structure so all keys exist in one file
    const globalDefaults = { 
        invoices: [], 
        stats: { total: 0, pending: 0, completed: 0, rejected: 0 },
        customers: [],
        settings: {},
        users: []
    };
    dbPromise = JSONFilePreset(dbPath, globalDefaults).then(async (db) => {
        for (const [k, v] of Object.entries(globalDefaults)) if (db.data[k] === undefined) db.data[k] = v;
        return db;
    });
    return dbPromise;
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

// Never send secrets or user records to the browser
const redactSettings = (s = {}) => {
    const { clientSecret, ...safe } = s;
    return { ...safe, hasClientSecret: !!clientSecret };
};

// 4. Fetch Dashboard Data (explicit fields only; users and secrets are excluded)
const getDashboardData = async () => {
    const db = await getDb();
    const { invoices = [], stats = {}, customers = [], settings = {} } = db.data;
    return { invoices, stats, customers, settings: redactSettings(settings) };
};

// 5. Customer Management
const getCustomers = async () => {
    const db = await getDb();
    return db.data.customers || [];
};

const saveCustomer = async (customer) => {
    const db = await getDb();
    const clip = (v, n) => String(v ?? '').trim().slice(0, n);
    const record = { name: clip(customer.name, 200), tin: clip(customer.tin, 40), email: clip(customer.email, 200), invoices: 0, id: Date.now() };
    await db.update(({ customers }) => { customers.push(record); });
    return record;
};

// 6. Settings Management
const getSettings = async () => {
    const db = await getDb();
    return redactSettings(db.data.settings || {});
};

const saveSettings = async (newSettings) => {
    const db = await getDb();
    // Only known fields are stored; anything else in the request is ignored
    const allowed = ['apiUrl', 'clientId', 'clientSecret', 'mockMode', 'profile', 'invoiceTerms'];
    const clean = Object.fromEntries(Object.entries(newSettings || {}).filter(([k]) => allowed.includes(k)));
    await db.update(({ settings }) => {
        const secret = clean.clientSecret || settings.clientSecret;
        Object.assign(settings, { ...clean, clientSecret: secret });
    });
    return redactSettings(db.data.settings);
};

module.exports = {
    getDb,
    saveInvoice,
    getDashboardData,
    getCustomers,
    saveCustomer,
    getSettings,
    saveSettings
};