/**
 * Auth & UI Management
 * Handles login, session security, and dynamic sidebar loading
 */

document.addEventListener("DOMContentLoaded", async function() {
    
    // --- 1. SIDEBAR LOADER ---
    const sidebarContainer = document.getElementById('sidebar-container');
    if (sidebarContainer) {
        try {
            // Using a leading slash / ensures it always looks at the root folder
            const response = await fetch('/components/sidebar.html'); 
            if (response.ok) {
                const html = await response.text();
                sidebarContainer.innerHTML = html;
                
                // Add a small delay to ensure the DOM has painted the links
                setTimeout(highlightActiveLink, 10);
            }
        } catch (err) {
            console.error("Sidebar load failed:", err);
        }
    }

    // --- 2. LOGIN FORM LOGIC ---
    const loginForm = document.getElementById('loginForm');
    if (loginForm) {
        loginForm.addEventListener('submit', function(e) {
            e.preventDefault();
            const email = document.getElementById('email').value;
            const password = document.getElementById('password').value;

            // Basic auth check
            if (email === "support@msl.com" && password === "Microware12345") {
                localStorage.setItem('isLoggedIn', 'true');
                localStorage.setItem('userEmail', email);
                window.location.href = 'index.html';
            } else {
                alert("Invalid credentials.  Please contact your administrator if you need access, further attempts may lock you out.");
            }
        });
    }

    // --- 3. SECURITY CHECK ---
    const path = window.location.pathname;
    const isLoginPage = path.includes('login.html') || path === '/' || path === '';
    const isLoggedIn = localStorage.getItem('isLoggedIn');

    // If not logged in and trying to access a protected page
    if (!isLoggedIn && !path.includes('login.html')) {
        window.location.href = 'login.html';
        return; 
    }

    // --- 4. LOGOUT LOGIC ---
    // Improved click detection for the logout button and its icon
    document.addEventListener('click', (e) => {
        const logoutBtn = e.target.closest('#logoutBtn');
        if (logoutBtn) {
            e.preventDefault();
            localStorage.clear();
            window.location.href = 'login.html';
        }
    });

    // Helper Function for Navigation Highlighting
    function highlightActiveLink() {
        const currentPath = window.location.pathname;
        const navLinks = document.querySelectorAll('.nav-link');

        navLinks.forEach(link => {
            link.classList.remove('active');
            const linkPath = link.getAttribute('href');

            // Logic to check if the current URL matches the link's destination
            if (currentPath.endsWith(linkPath) && linkPath !== "#") {
                link.classList.add('active');
            } 
            // Special case for root/index
            else if ((currentPath === "/" || currentPath.endsWith('index.html')) && linkPath === "index.html") {
                link.classList.add('active');
            }
        });
    }
});