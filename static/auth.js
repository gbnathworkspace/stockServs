const API_BASE_URL = window.location.origin;

function showMessage(targetId, message, type = "info") {
    const el = document.getElementById(targetId);
    if (!el) return;
    el.textContent = message;
    el.className = `auth-message ${type}`;
}

function saveToken(data) {
    if (data?.access_token && data?.user) {
        localStorage.setItem("access_token", data.access_token);
        localStorage.setItem("user_email", data.user.email || "");
        window.location.href = "/static/index.html";
    } else {
        showMessage("auth-status", "Unexpected response from server", "error");
    }
}

async function signup(e) {
    e.preventDefault();
    const email = document.getElementById("signup-email").value;
    const password = document.getElementById("signup-password").value;
    const displayName = document.getElementById("signup-name").value;

    showMessage("auth-status", "Signing up...", "info");

    try {
        const res = await fetch(`${API_BASE_URL}/auth/signup`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ email, password, display_name: displayName }),
        });
        const data = await res.json();
        if (!res.ok) {
            throw new Error(data.detail || "Signup failed");
        }
        saveToken(data);
    } catch (err) {
        showMessage("auth-status", err.message, "error");
    }
}

async function login(e) {
    e.preventDefault();
    const email = document.getElementById("login-email").value;
    const password = document.getElementById("login-password").value;

    showMessage("auth-status", "Logging in...", "info");

    try {
        const form = new URLSearchParams();
        form.append("username", email);
        form.append("password", password);

        const res = await fetch(`${API_BASE_URL}/auth/login`, {
            method: "POST",
            headers: { "Content-Type": "application/x-www-form-urlencoded" },
            body: form.toString(),
        });
        const data = await res.json();
        if (!res.ok) {
            throw new Error(data.detail || "Login failed");
        }
        saveToken(data);
    } catch (err) {
        showMessage("auth-status", err.message, "error");
    }
}

function handleGoogleCredential(response) {
    if (!response?.credential) {
        showMessage("auth-status", "Google sign-in failed", "error");
        return;
    }

    fetch(`${API_BASE_URL}/auth/google`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id_token: response.credential }),
    })
        .then(async (res) => {
            const data = await res.json();
            if (!res.ok) {
                throw new Error(data.detail || "Google sign-in failed");
            }
            saveToken(data);
        })
        .catch((err) => showMessage("auth-status", err.message, "error"));
}

function initGoogleButton() {
    const container = document.getElementById("google-signin");
    if (!container) return;

    const storedClientId = localStorage.getItem("GOOGLE_CLIENT_ID");
    const manualInput = document.getElementById("google-client-id");
    const clientId = (manualInput && manualInput.value) || storedClientId;

    if (!clientId || !window.google) {
        container.textContent = "Set Google Client ID to enable Google login";
        container.classList.add("disabled");
        return;
    }

    localStorage.setItem("GOOGLE_CLIENT_ID", clientId);

    google.accounts.id.initialize({
        client_id: clientId,
        callback: handleGoogleCredential,
    });

    google.accounts.id.renderButton(container, {
        theme: "outline",
        size: "large",
        width: 280,
    });
}

document.addEventListener("DOMContentLoaded", () => {
    const signupForm = document.getElementById("signup-form");
    if (signupForm) {
        signupForm.addEventListener("submit", signup);
    }

    const loginForm = document.getElementById("login-form");
    if (loginForm) {
        loginForm.addEventListener("submit", login);
    }

    const setGoogleBtn = document.getElementById("set-google");
    if (setGoogleBtn) {
        setGoogleBtn.addEventListener("click", () => {
            const manualInput = document.getElementById("google-client-id");
            if (manualInput?.value) {
                localStorage.setItem("GOOGLE_CLIENT_ID", manualInput.value);
                showMessage("auth-status", "Saved Google Client ID locally", "info");
                setTimeout(initGoogleButton, 200);
            }
        });
    }

    setTimeout(initGoogleButton, 400);
});
