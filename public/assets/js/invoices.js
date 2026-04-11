document.addEventListener('DOMContentLoaded', refreshInvoiceList);

async function refreshInvoiceList() {
    try {
        const response = await fetch('/api/v1/dashboard-stats');
        const data = await response.json();
        const listBody = document.getElementById('invoiceListBody');
        listBody.innerHTML = '';

        data.invoices.forEach(inv => {
            const row = `
                <tr>
                    <td>${new Date(inv.timestamp).toLocaleDateString()}</td>
                    <td><strong>${inv.invoiceNumber}</strong></td>
                    <td>${inv.supplierTin}</td>
                    <td>₦${parseFloat(inv.totalAmount).toLocaleString()}</td>
                    <td><span class="badge ${inv.status === 'COMPLETED' ? 'bg-success' : 'bg-warning'}">${inv.status}</span></td>
                    <td>
                        <button class="btn btn-sm btn-outline-primary" onclick='viewDetails(${JSON.stringify(inv)})'>View</button>
                    </td>
                </tr>
            `;
            listBody.innerHTML += row;
        });
    } catch (err) {
        console.error("Error loading invoices:", err);
    }
}

function viewDetails(inv) {
    document.getElementById('xmlPreview').innerText = "Generating UBL preview..."; // We will refine this
    document.getElementById('modalQr').src = inv.qr_base64;
    
    const myModal = new bootstrap.Modal(document.getElementById('detailsModal'));
    myModal.show();
}