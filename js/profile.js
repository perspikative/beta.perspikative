import {
    getAuth,
    onAuthStateChanged
} from "https://www.gstatic.com/firebasejs/10.12.0/firebase-auth.js";

const auth = getAuth();

const displayName = document.getElementById("displayName");
const email = document.getElementById("email");
const created = document.getElementById("created");
const uid = document.getElementById("uid");

onAuthStateChanged(auth, (user)=>{

    if(!user){

        window.location.href="/login";
        return;

    }

    displayName.textContent =
        user.displayName || "Aucun";

    email.textContent =
        user.email || "Aucun";

    created.textContent =
        new Date(user.metadata.creationTime)
        .toLocaleString("fr-FR");

    uid.textContent =
        user.uid;

});