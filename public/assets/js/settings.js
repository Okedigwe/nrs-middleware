document.addEventListener('DOMContentLoaded', async () => {
    try {
        const response = await fetch('/api/v1/settings');
        const settings = await response.json();

        // Populate the form
        document.getElementById('apiUrl').value = settings.apiUrl || '';
        document.getElementById('clientId').value = settings.clientId || '';
        document.getElementById('mockMode').checked = settings.mockMode || false;
    } catch (err) {
        console.error("Failed to load settings");
    }
});

document.getElementById('settingsForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    
    const settings = {
        apiUrl: document.getElementById('apiUrl').value,
        clientId: document.getElementById('clientId').value,
        clientSecret: document.getElementById('clientSecret').value,
        mockMode: document.getElementById('mockMode').checked
    };

    const response = await fetch('/api/v1/settings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(settings)
    });

    if (response.ok) {
        alert("Settings updated successfully! The system will now use these credentials.");
    }
});