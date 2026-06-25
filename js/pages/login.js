import { authService } from '../services/AuthService.js';

export function initLoginPage() {
    console.log("Login page initialized");

    const form = document.getElementById("login-form");

    if (!form) {
        console.error("Form login tidak ditemukan");
        return;
    }

    form.addEventListener("submit", async (e) => {
        e.preventDefault();

        const userId = document.getElementById("user-id").value.trim();
        const password = document.getElementById("password").value;

        console.log("Login:", userId);

        try {
            const result = await authService.login(userId, password);

            console.log(result);

        } catch (err) {
            console.error(err);
        }
    });
}
