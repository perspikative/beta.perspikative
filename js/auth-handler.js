// =============================================================================
// AUTH HANDLER — PERSPIKATIVE
// Gestionnaire d'actions e-mail personnalisé Firebase, pour la page /auth.
// Respecte le pattern officiel :
// https://firebase.google.com/docs/auth/custom-email-handler
//
// Firebase ajoute ces paramètres à l'URL du lien envoyé par mail :
//   ?mode=resetPassword|recoverEmail|verifyEmail
//   &oobCode=XXXX          (code à usage unique)
//   &apiKey=XXXX           (fourni pour info, on utilise directement notre config)
//   &continueUrl=XXXX      (optionnel)
//   &lang=fr               (optionnel)
//
// Cette page doit être renseignée comme "URL d'action personnalisée" dans
// Firebase Console > Authentication > Templates, pour que resetPassword,
// recoverEmail et verifyEmail pointent tous les trois ici.
// =============================================================================

import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-app.js";
import {
  getAuth,
  verifyPasswordResetCode,
  confirmPasswordReset,
  checkActionCode,
  applyActionCode,
  sendPasswordResetEmail
} from "https://www.gstatic.com/firebasejs/10.12.0/firebase-auth.js";

// ─── CONFIG (identique au reste du site) ───
const firebaseConfig = {
  apiKey: "AIzaSyBudMYu4rtSL7GrsX3OMtT8klbBX7h4iTE",
  authDomain: "perspikative-app.firebaseapp.com",
  projectId: "perspikative-app",
  storageBucket: "perspikative-app.firebasestorage.app",
  messagingSenderId: "411164951584",
  appId: "1:411164951584:web:d340b95c22d95668c86845"
};

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);

// ─── PETITS HELPERS DOM ───

function getParameterByName(name) {
  const url = new URL(window.location.href);
  return url.searchParams.get(name);
}

function $(id) {
  return document.getElementById(id);
}

// Affiche une seule "view" à la fois parmi toutes les .view de la card
function showView(id) {
  document.querySelectorAll(".view").forEach((el) => {
    el.classList.toggle("visible", el.id === id);
  });
}

function showError(el, msg) {
  el.textContent = msg;
  el.classList.add("visible");
}

function clearError(el) {
  el.classList.remove("visible");
  el.textContent = "";
}

function setLoading(btn, on) {
  btn.classList.toggle("loading", on);
  btn.disabled = on;
}

// Applique la langue de l'utilisateur (paramètre lang de l'URL) au SDK Auth,
// pour que les éventuels messages/e-mails générés depuis cette page (ex :
// renvoi d'un mail de réinitialisation) restent dans la bonne langue.
function applyLangFromUrl() {
  const lang = getParameterByName("lang");
  if (lang) {
    auth.languageCode = lang;
  } else {
    auth.useDeviceLanguage();
  }
}

// Traduit les codes d'erreur Firebase les plus courants en messages FR,
// dans le même esprit que login.html.
function firebaseErrMsg(code) {
  const map = {
    "auth/expired-action-code": "Ce lien a expiré. Refais une demande depuis le site.",
    "auth/invalid-action-code": "Ce lien n'est plus valide. Il a peut-être déjà été utilisé.",
    "auth/user-disabled": "Ce compte a été désactivé.",
    "auth/user-not-found": "Aucun compte associé à ce lien n'a été trouvé.",
    "auth/weak-password": "Mot de passe trop faible (6 caractères min.).",
    "auth/invalid-api-key": "Lien invalide (clé de configuration obsolète). Réessaie depuis le site.",
    "auth/network-request-failed": "Problème de connexion. Vérifie ton réseau et réessaie."
  };
  return map[code] || "Une erreur est survenue. Réessaie plus tard.";
}

// Message d'erreur affiché sur l'écran d'erreur générique (view-error)
function showFatalError(code) {
  $("errorMessage").textContent = firebaseErrMsg(code);
  showView("view-error");
}

// ─── TOGGLE AFFICHAGE MOT DE PASSE ───

document.addEventListener("DOMContentLoaded", () => {
  document.querySelectorAll(".pwd-toggle").forEach((btn) => {
    btn.addEventListener("click", () => {
      const input = $(btn.dataset.target);
      const isText = input.type === "text";
      input.type = isText ? "password" : "text";

      const eyeId = btn.dataset.target === "new-pwd" ? "eye-new-pwd" : "eye-confirm-pwd";
      const svg = $(eyeId);
      svg.innerHTML = isText
        ? '<path d="M1 12s4-7 11-7 11 7 11 7-4 7-11 7S1 12 1 12z"/><circle cx="12" cy="12" r="3"/>'
        : '<path d="M17.9 17.9A10.9 10.9 0 0 1 12 19c-7 0-11-7-11-7a18.8 18.8 0 0 1 5.1-6.1M9.9 4.2A10.2 10.2 0 0 1 12 4c7 0 11 7 11 7a18.8 18.8 0 0 1-2.2 3.1M1 1l22 22"/><circle cx="12" cy="12" r="3"/>';
    });
  });
});

// =============================================================================
// MODE : resetPassword
// Vérifie le code (verifyPasswordResetCode), affiche le formulaire, puis
// confirme (confirmPasswordReset) une fois le nouveau mot de passe saisi.
// =============================================================================

function handleResetPassword(actionCode, continueUrl) {
  verifyPasswordResetCode(auth, actionCode)
    .then((accountEmail) => {
      // Code valide : on affiche le formulaire avec l'e-mail du compte en rappel
      if (accountEmail) {
        $("resetAccountEmail").textContent = accountEmail;
        $("resetAccountRecap").style.display = "flex";
      }
      showView("view-reset-form");

      const form = $("resetPasswordForm");
      const errorEl = $("resetPasswordError");

      form.addEventListener("submit", (e) => {
        e.preventDefault();
        clearError(errorEl);

        const newPassword = $("new-pwd").value;
        const confirmPassword = $("confirm-pwd").value;
        const btn = form.querySelector(".btn-primary");

        if (newPassword.length < 6) {
          showError(errorEl, "Le mot de passe doit faire au moins 6 caractères.");
          return;
        }
        if (newPassword !== confirmPassword) {
          showError(errorEl, "Les deux mots de passe ne correspondent pas.");
          return;
        }

        setLoading(btn, true);

        confirmPasswordReset(auth, actionCode, newPassword)
          .then(() => {
            // Mot de passe mis à jour : on affiche l'écran de succès.
            // Si un continueUrl a été fourni (ex: lien de retour vers l'app),
            // on l'utilise pour le bouton, sinon on retombe sur /login2026.
            const successLink = document.querySelector("#view-reset-success .btn-secondary");
            if (continueUrl) {
              successLink.href = continueUrl;
            }
            showView("view-reset-success");
          })
          .catch((err) => {
            setLoading(btn, false);
            // Le code peut avoir expiré entre l'affichage du formulaire et
            // l'envoi, ou le nouveau mot de passe être jugé trop faible.
            showError(errorEl, firebaseErrMsg(err.code));
          });
      });
    })
    .catch((err) => {
      // Code invalide ou expiré : on ne peut même pas afficher le formulaire.
      showFatalError(err.code);
    });
}

// =============================================================================
// MODE : recoverEmail
// Vérifie le code (checkActionCode) pour récupérer l'ancienne adresse, restaure
// l'e-mail (applyActionCode), puis propose une réinitialisation du mot de
// passe par sécurité (au cas où le compte aurait été compromis).
// =============================================================================

function handleRecoverEmail(actionCode) {
  let restoredEmail = null;

  checkActionCode(auth, actionCode)
    .then((info) => {
      restoredEmail = info["data"]["email"];
      return applyActionCode(auth, actionCode);
    })
    .then(() => {
      // L'adresse e-mail du compte a été restaurée à restoredEmail.
      $("recoveredEmail").textContent = restoredEmail;
      showView("view-recover-success");

      const resetBtn = $("recoverResetBtn");
      const resetError = $("recoverResetError");

      resetBtn.addEventListener("click", () => {
        clearError(resetError);
        resetBtn.disabled = true;

        sendPasswordResetEmail(auth, restoredEmail)
          .then(() => {
            $("recoverResetSentEmail").textContent = restoredEmail;
            showView("view-recover-reset-sent");
          })
          .catch(() => {
            resetBtn.disabled = false;
            showError(resetError, "Impossible d'envoyer le mail de réinitialisation pour le moment, réessaie plus tard.");
          });
      });
    })
    .catch((err) => {
      // Code invalide ou expiré.
      showFatalError(err.code);
    });
}

// =============================================================================
// MODE : verifyEmail
// Récupère d'abord l'e-mail du compte via checkActionCode (même pattern que
// handleRecoverEmail), applique le code, puis renvoie vers /login2026 avec
// l'e-mail en query param pour que l'utilisateur n'ait plus qu'à saisir son
// mot de passe et enchaîner sur l'étape "compléter le profil".
// =============================================================================

function handleVerifyEmail(actionCode, continueUrl) {
  let verifiedEmail = null;

  checkActionCode(auth, actionCode)
    .then((info) => {
      verifiedEmail = info && info["data"] ? info["data"]["email"] : null;
      return applyActionCode(auth, actionCode);
    })
    .then(() => {
      // Adresse e-mail vérifiée. On construit toujours l'URL de retour
      // nous-mêmes (avec verified=1 + l'e-mail), même si un continueUrl a
      // été fourni : c'est ce lien vers /login2026 qui permet d'enchaîner
      // sur l'étape "compléter le profil" côté client.
      const target = new URL("https://perspikative.com/login");
      target.searchParams.set("verified", "1");
      if (verifiedEmail) {
        target.searchParams.set("email", verifiedEmail);
      }
      const redirectUrl = target.toString();

      const successLink = $("verifyContinueBtn");
      if (successLink) {
        successLink.href = redirectUrl;
      }
      showView("view-verify-success");

      // Redirection automatique après un court délai : l'utilisateur n'a
      // pas besoin de cliquer, mais garde le bouton comme filet de sécurité
      // si la redirection auto est bloquée (ex: certains clients mail webview).
      setTimeout(() => {
        window.location.href = redirectUrl;
      }, 1800);
    })
    .catch((err) => {
      // Code invalide ou expiré : on invite l'utilisateur à redemander un
      // e-mail de vérification (depuis la page de connexion / son profil).
      showFatalError(err.code);
    });
}

// =============================================================================
// POINT D'ENTRÉE
// =============================================================================

document.addEventListener("DOMContentLoaded", () => {
  applyLangFromUrl();

  const mode = getParameterByName("mode");
  const actionCode = getParameterByName("oobCode");
  const continueUrl = getParameterByName("continueUrl");

  if (!actionCode) {
    showFatalError("auth/invalid-action-code");
    return;
  }

  switch (mode) {
    case "resetPassword":
      $("loadingTitle").textContent = "Vérification du lien…";
      handleResetPassword(actionCode, continueUrl);
      break;

    case "recoverEmail":
      $("loadingTitle").textContent = "Restauration de ton adresse e-mail…";
      handleRecoverEmail(actionCode);
      break;

    case "verifyEmail":
      $("loadingTitle").textContent = "Vérification de ton adresse e-mail…";
      handleVerifyEmail(actionCode, continueUrl);
      break;

    default:
      // Mode absent ou non reconnu.
      showFatalError("auth/invalid-action-code");
  }
});
