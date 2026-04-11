const QRCode = require('qrcode');

/**
 * Generates a Base64 QR Code image from a string.
 * @param {string} text - The content to encode (usually the IRN or NRS URL)
 */
const generateInvoiceQR = async (text) => {
    try {
        // Generates a Data URL (Base64) which can be easily embedded in HTML or PDFs
        const qrBase64 = await QRCode.toDataURL(text, {
            errorCorrectionLevel: 'H', // High correction for better scannability on printed receipts
            margin: 1,
            color: {
                dark: '#000000',
                light: '#FFFFFF'
            }
        });
        return qrBase64;
    } catch (err) {
        console.error('QR Generation Error:', err);
        throw new Error('Failed to generate QR code');
    }
};

module.exports = { generateInvoiceQR };