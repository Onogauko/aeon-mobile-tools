export function initLoginPage() {

    console.log("STEP 1");

    const form = document.getElementById("login-form");

    console.log("FORM =", form);

    if (!form) {
        alert("FORM TIDAK DITEMUKAN");
        return;
    }

    form.addEventListener("submit", function(e){

        e.preventDefault();

        alert("LOGIN DIKLIK");

        console.log("SUBMIT");
    });

}
