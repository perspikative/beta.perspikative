import {
    getAuth,
    onAuthStateChanged
} from "https://www.gstatic.com/firebasejs/10.12.0/firebase-auth.js";

const auth = getAuth();

const profilePic = document.getElementById("profilePic");
const displayName = document.getElementById("displayName");
const email = document.getElementById("email");
const created = document.getElementById("created");
const uid = document.getElementById("uid");

onAuthStateChanged(auth, (user)=>{

    if(!user){

        window.location.href="/login";
        return;

    }

    // On récupère directement la photo liée au compte (Google ou ton asset local enregistré à la création)
    // On met la pfp "1.webp" en secours (fallback) uniquement au cas où un vieux compte n'aurait pas de photo.
    profilePic.src = user.photoURL || "/pics/assets/pfp/1.webp";

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