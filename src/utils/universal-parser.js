const { parse } = require('csv-parse/sync');
const xml2js = require('xml2js');

/**
 * Universal Parser: Converts any input into a clean JS Object
 * Context: Prevents "Char: i" errors by checking string patterns first.
 */
async function parseInput(rawData, contentType) {
    if (!rawData || typeof rawData !== 'string' || rawData.trim() === "") {
        throw new Error("Invalid or empty data received");
    }

    const trimmedData = rawData.trim();

    try {
        // 1. FORCE JSON CHECK
        if (trimmedData.startsWith('{') || trimmedData.startsWith('[')) {
            console.log("📊 Parser: Detected JSON format");
            return JSON.parse(trimmedData);
        }

        // 2. FORCE XML CHECK 
        // We only run this if it looks like XML to avoid the "Char: i" error
        if (trimmedData.startsWith('<')) {
            console.log("📊 Parser: Detected XML format");
            const parser = new xml2js.Parser({ explicitArray: false });
            const result = await parser.parseStringPromise(trimmedData);
            return result;
        }

        // 3. FALLBACK TO CSV
        // If it's not JSON and not XML, we treat it as CSV
        console.log("📊 Parser: Falling back to CSV detection");
        const records = parse(trimmedData, {
            columns: true, 
            skip_empty_lines: true,
            trim: true,
            cast: true // Automatically converts numbers
        });

        if (records.length === 0) throw new Error("CSV is empty or malformed");
        return records[0];

    } catch (err) {
        console.error("❌ Parser Error Detail:", err.message);
        throw new Error(`Format Conversion Failed: ${err.message}`);
    }
}

module.exports = { parseInput };