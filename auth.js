// auth.js — Supabase Auth integration (real backend, no localStorage passwords)

const SUPABASE_URL = 'https://ccsoemmzlbsdsawikvya.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImNjc29lbW16bGJzZHNhd2lrdnlhIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzEzMzI1MzYsImV4cCI6MjA4NjkwODUzNn0.drc7-Yck4DZOs2kiyNe9Kqv2zk3sjjsi48vj8FqvcYU';

// Initialize Supabase client — FIXED: use global 'supabase' (lowercase)
const supabase = supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// Helper function (unchanged)
function getVal(id) {
    const el = document.getElementById(id);
    return el ? el.value.trim() : '';
}

// REGISTER – improved version (unchanged from your last)
async function registerUser() {
    const btn = document.getElementById("registerBtn");
    if (!btn) return;

    const name  = getVal("name");
    const email = getVal("email");
    const pass  = getVal("password");

    if (!name || !email || !pass) {
        alert("Please fill in all fields");
        return;
    }

    if (!email.includes("@") || email.indexOf(".") === -1) {
        alert("Please enter a valid email address");
        return;
    }

    if (pass.length < 6) {
        alert("Password must be at least 6 characters long");
        return;
    }

    // Disable button & show loading
    btn.disabled = true;
    btn.textContent = "Creating account...";

    try {
        const { data, error } = await supabase.auth.signUp({
            email: email,
            password: pass,
            options: {
                data: { full_name: name }
            }
        });

        if (error) throw error;

        if (!data.session) {
            // Email confirmation required
            alert("Account created!\n\nPlease check your email (including spam) and click the confirmation link.");
            window.location.href = "login.html";
        } else {
            // Instant login (confirmation disabled in dashboard)
            alert("Account created and logged in!");
            window.location.href = "dashboard.html";
        }
    } catch (err) {
        console.error("Signup failed:", err);
        alert(err.message || "Something went wrong. Please try again.");
    } finally {
        // Re-enable button
        btn.disabled = false;
        btn.textContent = "Register";
    }
}

// ... (the rest of your file remains exactly the same: loginUser, checkLogin, showUser, logout, onAuthStateChange)