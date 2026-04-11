/**
 * Auth & UI Management
 * Handles login, session security, and sidebar navigation
 */

document.addEventListener("DOMContentLoaded", function() {
    
    // --- 1. LOGIN FORM LOGIC ---
    const loginForm = document.getElementById('loginForm');
    if (loginForm) {
        loginForm.addEventListener('submit', function(e) {
            e.preventDefault();
            const email = document.getElementById('email').value;
            const password = document.getElementById('password').value;

            if (email === "admin@nrs.com" && password === "admin123") {
                localStorage.setItem('isLoggedIn', 'true');
                localStorage.setItem('userEmail', email);
                window.location.href = 'index.html';
            } else {
                alert("Invalid credentials. Use admin@nrs.com / admin123");
            }
        });
    }

    // --- 2. SECURITY CHECK (Redirect if not logged in) ---
    // We only check if we aren't already on login.html
    const isLoginPage = window.location.pathname.includes('login.html');
    const isLoggedIn = localStorage.getItem('isLoggedIn');

    if (!isLoggedIn && !isLoginPage) {
        window.location.href = 'login.html';
        return; // Stop execution
    }

    // --- 3. AUTO-ACTIVE NAVIGATION ---
    const currentPath = window.location.pathname;
    const navLinks = document.querySelectorAll('.nav-link');

    navLinks.forEach(link => {
        link.classList.remove('active');
        const linkPath = link.getAttribute('href');

        // Logic to match /index.html or just /
        if (currentPath.includes(linkPath) && linkPath !== "#") {
            link.classList.add('active');
        } else if (currentPath === "/" && linkPath === "index.html") {
            link.classList.add('active');
        }
    });

    // --- 4. LOGOUT LOGIC ---
    const logoutBtn = document.getElementById('logoutBtn');
    if (logoutBtn) {
        logoutBtn.addEventListener('click', (e) => {
            e.preventDefault();
            localStorage.clear();
            window.location.href = 'login.html';
        });
    }
});