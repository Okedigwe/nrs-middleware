document.getElementById('loginForm').addEventListener('submit', function(e) {
    e.preventDefault();
    
    const email = document.getElementById('email').value;
    const password = document.getElementById('password').value;

    // Simple check for development
    if (email === "admin@nrs.com" && password === "admin123") {
        // Save a "session" in local storage
        localStorage.setItem('isLoggedIn', 'true');
        localStorage.setItem('userEmail', email);
        
        // Redirect to dashboard
        window.location.href = 'index.html';
    } else {
        alert("Invalid credentials. Use admin@nrs.com / admin123");
    }
});