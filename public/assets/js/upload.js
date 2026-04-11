const fileInput = document.getElementById('fileInput');
const dropZone = document.getElementById('dropZone');
const logContainer = document.getElementById('logContainer');
const processBtn = document.getElementById('processBtn');


// Helper to log messages to the UI console
function addLog(message, type = 'info') {
    const time = new Date().toLocaleTimeString();
    const color = type === 'error' ? 'text-danger' : 'text-success';
    logContainer.innerHTML += `<div class="${color}">[${time}] ${message}</div>`;
    logContainer.scrollTop = logContainer.scrollHeight;
}

fileInput.addEventListener('change', function(e) {
    const file = e.target.files[0];
    if (file) {
        document.getElementById('fileInfo').classList.remove('d-none');
        document.getElementById('fileName').innerText = file.name;
        addLog(`File selected: ${file.name}`);
    }
});

processBtn.addEventListener('click', async () => {

    const file = fileInput.files[0];
    if (!file) return;

    addLog(`Reading file content...`);
    const reader = new FileReader();

    reader.onload = async function(e) {
        const content = e.target.result;
        const contentType = file.type || 'text/plain'; // Detect if JSON/CSV/XML

        addLog(`Sending to NRS Middleware...`);

        try {
                            // Inside upload.js -> processBtn.addEventListener
const response = await fetch('/api/v1/send-invoice', {
    method: 'POST',
    headers: { 'Content-Type': 'text/plain' }, // Use text/plain to let the backend detect format
    body: content
            });

            const result = await response.json();

            if (result.success) {
                addLog(`Success! NRS Reference: ${result.nrs_reference}`);
                addLog(`QR Code generated. Updating Dashboard...`);
                
                // Optional: Redirect to dashboard after 2 seconds
                setTimeout(() => window.location.href = 'index.html', 2000);
            } else {
                addLog(`Error: ${result.error}`, 'error');
            }
        } catch (err) {
            addLog(`Network Error: ${err.message}`, 'error');
        }
    };

    reader.readAsText(file);
});