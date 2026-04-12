/**
 * Invoice Management Logic
 */

let allInvoices = []; // Global store for filtering

document.addEventListener('DOMContentLoaded', () => {
    refreshInvoiceList();

    // Attach search listener
    const searchInput = document.getElementById('searchInput');
    if (searchInput) {
        searchInput.addEventListener('input', handleSearch);
    }
});

async function refreshInvoiceList() {
    try {
        const response = await fetch('/api/v1/dashboard-stats');
        if (!response.ok) throw new Error("Failed to fetch data");
        
        const data = await response.json();
        
        // Store globally so the search function can access it
        allInvoices = data.invoices || []; 
        
        renderTable(allInvoices);
    } catch (err) {
        console.error("Error loading invoices:", err);
        const listBody = document.getElementById('invoiceListBody');
        if (listBody) listBody.innerHTML = '<tr><td colspan="6" class="text-center text-danger">Failed to load invoices.</td></tr>';
    }
}

function renderTable(data) {
    const listBody = document.getElementById('invoiceListBody');
    if (!listBody) return;

    if (data.length === 0) {
        listBody.innerHTML = '<tr><td colspan="6" class="text-center">No matching invoices found.</td></tr>';
        return;
    }

    // Map all rows at once for better performance
    const rows = data.map(inv => `
        <tr>
            <td>${new Date(inv.timestamp).toLocaleDateString()}</td>
            <td><strong>${inv.invoiceNumber}</strong></td>
            <td>${inv.supplierTin}</td>
            <td>₦${parseFloat(inv.totalAmount).toLocaleString()}</td>
            <td><span class="badge ${getStatusClass(inv.status)}">${inv.status}</span></td>
            <td>
                <button class="btn btn-sm btn-outline-primary" onclick="viewDetails('${inv.invoiceNumber}')">
                    <i class="bi bi-eye"></i> View
                </button>
            </td>
        </tr>
    `).join('');

    listBody.innerHTML = rows;
}

function handleSearch(e) {
    const term = e.target.value.toLowerCase();
    const filtered = allInvoices.filter(inv => 
        inv.invoiceNumber.toLowerCase().includes(term) || 
        inv.supplierTin.toLowerCase().includes(term)
    );
    renderTable(filtered);
}

function getStatusClass(status) {
    const s = status.toUpperCase();
    if (s === 'COMPLETED' || s === 'SUCCESS') return 'bg-success';
    if (s === 'PENDING') return 'bg-warning text-dark';
    if (s === 'REJECTED' || s === 'FAILED') return 'bg-danger';
    return 'bg-secondary';
}

function viewDetails(invNum) {
    // Find the invoice in our local array
    const inv = allInvoices.find(i => i.invoiceNumber === invNum);
    if (!inv) return;

    // Populate Modal
    document.getElementById('xmlPreview').innerText = inv.ubl_xml || "No XML data available.";
    
    const qrImg = document.getElementById('modalQr');
    if (inv.qr_base64) {
        // If it's a base64 string, ensure it has the prefix
        qrImg.src = inv.qr_base64.startsWith('data:') ? inv.qr_base64 : `data:image/png;base64,${inv.qr_base64}`;
        qrImg.style.display = "block";
    } else {
        qrImg.style.display = "none";
    }
    
    const myModal = new bootstrap.Modal(document.getElementById('detailsModal'));
    myModal.show();
}