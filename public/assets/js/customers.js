/**
 * Customer Directory Logic
 */

let allCustomers = [
    { name: "Global Tech Solutions", tin: "22334455-0001", email: "billing@globaltech.ng", invoices: 12 },
    { name: "Lagos Logistics Ltd", tin: "99887766-0005", email: "accounts@lagoslog.com", invoices: 5 },
    { name: "Merit's Rose Design", tin: "11223344-0009", email: "merit@rosedesign.ng", invoices: 2 }
];

document.addEventListener("DOMContentLoaded", () => {
    renderCustomers(allCustomers);

    // 1. Search Logic
    const searchInput = document.getElementById('searchInput'); // Ensure this ID exists in your HTML
    if (searchInput) {
        searchInput.addEventListener('input', (e) => {
            const term = e.target.value.toLowerCase();
            const filtered = allCustomers.filter(c => 
                c.name.toLowerCase().includes(term) || 
                c.tin.includes(term)
            );
            renderCustomers(filtered);
        });
    }

    // 2. Add Customer Form Logic
    const addForm = document.getElementById('addCustomerForm');
    if (addForm) {
        addForm.addEventListener('submit', function(e) {
            e.preventDefault();
            
            const newCustomer = {
                name: document.getElementById('custName').value,
                tin: document.getElementById('custTin').value,
                email: document.getElementById('custEmail').value,
                invoices: 0
            };

            // Add to our local list
            allCustomers.unshift(newCustomer);
            
            // Refresh table
            renderCustomers(allCustomers);

            // Close Modal & Reset Form
            const modalElement = document.getElementById('customerModal');
            const modal = bootstrap.Modal.getInstance(modalElement);
            modal.hide();
            addForm.reset();

            console.log("New customer added locally:", newCustomer);
            // In the future, add an 'await fetch' here to save to your database
        });
    }
});

// 3. Render Table
function renderCustomers(data) {
    const tbody = document.getElementById('customerListBody');
    if (!tbody) return;

    if (data.length === 0) {
        tbody.innerHTML = '<tr><td colspan="5" class="text-center text-muted">No customers found.</td></tr>';
        return;
    }

    tbody.innerHTML = data.map(c => `
        <tr>
            <td><strong>${c.name}</strong></td>
            <td><code>${c.tin}</code></td>
            <td>${c.email}</td>
            <td><span class="badge bg-light text-dark border">${c.invoices}</span></td>
            <td>
                <button class="btn btn-sm btn-outline-secondary" onclick="editCustomer('${c.tin}')">
                    <i class="bi bi-pencil"></i>
                </button>
            </td>
        </tr>
    `).join('');
}

// Placeholder for edit functionality
function editCustomer(tin) {
    console.log("Edit customer with TIN:", tin);
    // You can implement an edit modal here later
}