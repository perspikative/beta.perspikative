import {
    getAuth,
    onAuthStateChanged
} from "https://www.gstatic.com/firebasejs/10.12.0/firebase-auth.js";

const auth = getAuth();

const profilePic = document.getElementById("profilePic");
const displayName = document.getElementById("displayName");
const email = document.getElementById("email");

onAuthStateChanged(auth, (user) => {

    if (!user) {
        window.location.href = "/login";
        return;
    }

    profilePic.src = user.photoURL || "/pics/assets/pfp/1.webp";
    displayName.textContent = user.displayName || "Utilisateur";
    email.textContent = user.email || "";

});