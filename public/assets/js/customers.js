document.addEventListener('DOMContentLoaded', refreshCustomerList);

document.getElementById('addCustomerForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    const customer = {
        name: document.getElementById('custName').value,
        tin: document.getElementById('custTin').value,
        email: document.getElementById('custEmail').value
    };

    try {
        const response = await fetch('/api/v1/customers', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(customer)
        });
        
        if (response.ok) {
            location.reload();
        }
    } catch (err) {
        console.error("Failed to save customer", err);
    }
});

async function refreshCustomerList() {
    try {
        const response = await fetch('/api/v1/customers');
        const customers = await response.json();
        const listBody = document.getElementById('customerListBody');
        listBody.innerHTML = '';

        customers.forEach(cust => {
            listBody.innerHTML += `
                <tr>
                    <td><strong>${cust.name}</strong></td>
                    <td>${cust.tin}</td>
                    <td>${cust.email}</td>
                    <td><span class="badge bg-light text-dark">0</span></td>
                    <td>
                        <button class="btn btn-sm btn-outline-danger">Delete</button>
                    </td>
                </tr>
            `;
        });
    } catch (err) {
        console.error("Error loading customers", err);
    }
}