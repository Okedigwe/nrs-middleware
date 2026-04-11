const axios = require('axios');
const { v4: uuidv4 } = require('uuid');
const { convertToUBLXml } = require('../utils/xml-mapper'); 
require('dotenv').config();

class NRSInvoiceClient {
    constructor() {
        this.baseUrl = process.env.NRS_BASE_URL;
        this.clientId = process.env.NRS_CLIENT_ID;
        this.clientSecret = process.env.NRS_CLIENT_SECRET;
    }

    async getAuthToken() {
        try {
            const response = await axios.post(`${this.baseUrl}/auth/token`, {
                client_id: this.clientId,
                client_secret: this.clientSecret,
                grant_type: 'client_credentials'
            });
            return response.data.access_token;
        } catch (error) {
            console.error('NRS Auth Error:', error.response?.data || error.message);
            throw new Error('Failed to authenticate with NRS. Check your .env credentials.');
        }
    }

    async submitInvoice(invoiceData) {
        // 1. Convert to XML
        const xmlPayload = convertToUBLXml(invoiceData);
        console.log("--- GENERATED UBL XML PAYLOAD --- \n", xmlPayload);

        // ==========================================
        // MOCK MODE (For Testing)
        // ==========================================
        if (!this.clientId || this.clientId === 'your_client_id_here' || this.clientId === '') {
            console.log("⚠️  RUNNING IN MOCK MODE");
            
            return {
                irn: "NRS-MOCK-" + Math.floor(Math.random() * 1000000),
                status: "COMPLETED",
                qr_code_content: "https://nrs.gov.ng/verify/mock-" + uuidv4(),
                message: "MOCK SUCCESS",
                xml_content: xmlPayload // CRITICAL: Returning the XML for the Database
            };
        }

        // ==========================================
        // ACTUAL API LOGIC
        // ==========================================
        const token = await this.getAuthToken();
        
        try {
            const response = await axios.post(`${this.baseUrl}/invoices`, xmlPayload, {
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'Content-Type': 'application/xml',
                    'X-Request-ID': uuidv4()
                }
            });
            
            // Return the API response PLUS the XML payload for our DB
            return {
                ...response.data,
                xml_content: xmlPayload 
            };
        } catch (error) {
            console.error('NRS Submission Error:', error.response?.data || error.message);
            throw error;
        }
    }
}

module.exports = new NRSInvoiceClient();