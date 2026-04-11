// Security Check: Redirect to login if not authenticated

  if (localStorage.getItem('isLoggedIn') !== 'true') {
    window.location.href = 'login.html';
}

// Function to handle logout
function logout() {
    localStorage.removeItem('isLoggedIn');
    localStorage.removeItem('userEmail');
    window.location.href = 'login.html';
}

// Initialise Dashboard Data
document.addEventListener('DOMContentLoaded', () => {
    console.log("Dashboard Loaded for:", localStorage.getItem('userEmail'));
    // We will build the data fetching logic here in the next step
});





document.addEventListener('DOMContentLoaded', async () => {
    if (localStorage.getItem('isLoggedIn') !== 'true') {
        window.location.href = 'login.html';
        return;
    }

    await refreshDashboard();
});

async function refreshDashboard() {
    try {
        const response = await fetch('/api/v1/dashboard-stats');
        const data = await response.json();

        // Update Stats Cards
        document.getElementById('stat-total').innerText = data.stats.total || 0;
        document.getElementById('stat-completed').innerText = data.stats.completed || 0;
        document.getElementById('stat-pending').innerText = data.stats.pending || 0;
        document.getElementById('stat-rejected').innerText = data.stats.rejected || 0;

        // Populate Table
        const tableBody = document.getElementById('invoiceTable');
        tableBody.innerHTML = ''; // Clear old data

        data.invoices.forEach(inv => {
            const row = `
                <tr>
                    <td>${inv.invoiceNumber}</td>
                    <td>${inv.supplierTin}</td>
                    <td>₦${parseFloat(inv.totalAmount).toLocaleString()}</td>
                    <td><span class="badge ${getStatusClass(inv.status)}">${inv.status}</span></td>
                    <td><small class="text-muted">${inv.nrs_reference}</small></td>
                </tr>
            `;
            tableBody.innerHTML += row;
        });
    } catch (err) {
        console.error("Failed to load dashboard data", err);
    }
}

function getStatusClass(status) {
    if (status === 'COMPLETED') return 'bg-success';
    if (status === 'PENDING') return 'bg-warning text-dark';
    return 'bg-danger';
}