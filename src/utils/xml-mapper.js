const { create } = require('xmlbuilder2');

/**
 * Converts JSON Invoice Data to NRS-Compliant UBL XML
 * @param {Object} data - The raw invoice data from your ERP
 */
const convertToUBLXml = (data) => {
    const root = create({ version: '1.0', encoding: 'UTF-8' })
        .ele('Invoice', {
            'xmlns': 'urn:oasis:names:specification:ubl:schema:xsd:Invoice-2',
            'xmlns:cac': 'urn:oasis:names:specification:ubl:schema:xsd:CommonAggregateComponents-2',
            'xmlns:cbc': 'urn:oasis:names:specification:ubl:schema:xsd:CommonBasicComponents-2'
        })
        .ele('cbc:CustomizationID').txt('urn:cen.eu:en16931:2017#compliant#urn:fdc:peppol.eu:poacc:trns:invoice:3').up()
        .ele('cbc:ID').txt(data.invoiceNumber).up()
        .ele('cbc:IssueDate').txt(data.issueDate).up()
        
        // Supplier Details
        .ele('cac:AccountingSupplierParty')
            .ele('cac:Party')
                .ele('cac:PartyTaxScheme')
                    .ele('cbc:CompanyID').txt(data.supplierTin).up()
                    .ele('cac:TaxScheme').ele('cbc:ID').txt('VAT').up().up()
                .up()
            .up()
        .up()

        // Total Amount
        .ele('cac:LegalMonetaryTotal')
            .ele('cbc:LineExtensionAmount', { currencyID: 'NGN' }).txt(data.totalAmount).up()
            .ele('cbc:TaxExclusiveAmount', { currencyID: 'NGN' }).txt(data.taxExclusiveAmount).up()
            .ele('cbc:PayableAmount', { currencyID: 'NGN' }).txt(data.payableAmount).up()
        .up();

    // Convert to string
    return root.end({ prettyPrint: true });
};

module.exports = { convertToUBLXml };