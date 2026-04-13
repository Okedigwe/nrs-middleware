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

    // --- 2. LOGIN FORM LOGIC (Updated with reCAPTCHA) ---
    const loginForm = document.getElementById('loginForm');
    if (loginForm) {
        loginForm.addEventListener('submit', function(e) {
            e.preventDefault();

            // Check reCAPTCHA status
            const recaptchaResponse = grecaptcha.getResponse();
            if (recaptchaResponse.length === 0) {
                alert("Please complete the reCAPTCHA.");
                return;
            }

            const email = document.getElementById('email').value;
            const password = document.getElementById('password').value;

            // Basic auth check
            if (email === "support@microwaresolutions.com" && password === "Microware12345") {
                localStorage.setItem('isLoggedIn', 'true');
                localStorage.setItem('userEmail', email);
                window.location.href = 'index.html';
            } else {
                alert("Invalid credentials. Please contact your administrator if you need access.");
                grecaptcha.reset(); // Reset captcha on failed attempt
            }
        });
    }

    // --- 2b. FORGOT PASSWORD LOGIC (Updated to talk to Backend) ---
    const forgotForm = document.getElementById('forgotForm');
    if (forgotForm) {
        forgotForm.addEventListener('submit', async function(e) {
            e.preventDefault();
            const email = document.getElementById('resetEmail').value;
            const submitBtn = forgotForm.querySelector('button');
            
            // Disable button and show loading state
            submitBtn.disabled = true;
            submitBtn.innerText = "Sending...";

            try {
                const response = await fetch('/api/forgot-password', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ email: email })
                });

                const result = await response.json();

                if (response.ok && result.success) {
                    alert(`A password reset link has been sent to: ${email}`);
                    window.location.href = 'login.html';
                } else {
                    alert("Failed to send email. Please ensure your email is correct or try again later.");
                    submitBtn.disabled = false;
                    submitBtn.innerText = "Send Reset Link";
                }
            } catch (err) {
                console.error("Forgot Password Error:", err);
                alert("Connection failed. Please check your network.");
                submitBtn.disabled = false;
                submitBtn.innerText = "Send Reset Link";
            }
        });
    }

    // --- 3. SECURITY CHECK (Updated to allow forgot-password.html) ---
    const path = window.location.pathname;
    const isLoggedIn = localStorage.getItem('isLoggedIn');
    
    // Public pages that don't require a login
    const isPublicPage = path.includes('login.html') || 
                         path.includes('forgot-password.html') || 
                         path === '/' || 
                         path === '';

    // If not logged in and trying to access a protected page
    if (!isLoggedIn && !isPublicPage) {
        window.location.href = 'login.html';
        return; 
    }

    // --- 4. LOGOUT LOGIC ---
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

            if (currentPath.endsWith(linkPath) && linkPath !== "#") {
                link.classList.add('active');
            } 
            else if ((currentPath === "/" || currentPath.endsWith('index.html')) && linkPath === "index.html") {
                link.classList.add('active');
            }
        });
    }
});