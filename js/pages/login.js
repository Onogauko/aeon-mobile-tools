form.addEventListener("submit", async (e) => {

    e.preventDefault();

    const userId = document.getElementById("user-id").value.trim();
    const password = document.getElementById("password").value;

    console.log("START LOGIN");

    const result = await authService.login(userId, password);

    console.log("LOGIN RESULT =", result);

});
