// ============================= 1. MENU MOBILE =============================

document.addEventListener('DOMContentLoaded', () => {
  const menuToggle = document.getElementById('menuToggle');
  const mobileMenu = document.querySelector('.mobile-menu');
  const menuIcon = document.getElementById('menuIcon');
  const burgerIcon = document.querySelector('.burger-icon');

  if (!menuToggle) {
    return; // Pas de menu sur cette page
  }

  function syncMenuState() {
    const isOpen = menuToggle.checked;

    // Icône burger (menu/fermer)
    if (menuIcon) {
      const currentSrc = menuIcon.getAttribute('src') || menuIcon.src;
      const basePath = currentSrc ? currentSrc.substring(0, currentSrc.lastIndexOf('icons/')) : '';
      menuIcon.src = isOpen ? `${basePath}icons/fermer.svg` : `${basePath}icons/menu.svg`;
    }

    // Blur, scroll lock et état body pour overlay
    document.body.classList.toggle('menu-open', isOpen);
    document.body.style.overflow = isOpen ? 'hidden' : '';
    document.documentElement.style.overflow = isOpen ? 'hidden' : '';

    // Animation menu + accessibilité/interaction des liens
    if (mobileMenu) {
      mobileMenu.classList.toggle('open', isOpen);
      mobileMenu.setAttribute('aria-hidden', isOpen ? 'false' : 'true');

      mobileMenu.querySelectorAll('a').forEach(link => {
        link.tabIndex = isOpen ? 0 : -1;
        link.setAttribute('aria-hidden', isOpen ? 'false' : 'true');
        link.style.opacity = isOpen ? '1' : '0';
        link.style.pointerEvents = isOpen ? 'auto' : 'none';
        link.style.transition = 'opacity 0.35s cubic-bezier(0.4, 0, 0.2, 1)';
      });
    }
  }

  // Checkbox change
  menuToggle.addEventListener('change', syncMenuState);

  // Afficher le bouton menu uniquement tout en haut sur mobile
  let burgerTicking = false;
  const isMobileViewport = () => window.matchMedia('(max-width: 768px)').matches;

  const updateBurgerVisibility = () => {
    if (!burgerIcon) return;

    const atTop = (window.pageYOffset || document.documentElement.scrollTop) <= 0;
    const shouldShow = !isMobileViewport() || atTop;
    burgerIcon.classList.toggle('is-hidden', !shouldShow);
  };

  const handleBurgerScroll = () => {
    if (burgerTicking) return;
    burgerTicking = true;

    requestAnimationFrame(() => {
      updateBurgerVisibility();
      burgerTicking = false;
    });
  };

  window.addEventListener('scroll', handleBurgerScroll, { passive: true });
  window.addEventListener('resize', updateBurgerVisibility);

  // Fermer si lien cliqué
  if (mobileMenu) {
    mobileMenu.querySelectorAll('a').forEach(link => {
      link.addEventListener('click', () => {
        menuToggle.checked = false;
        syncMenuState();
      });
    });
  }

  // Fermer sur clic blur-overlay
  const blurOverlay = document.querySelector('.blur-overlay');
  if (blurOverlay) {
    blurOverlay.addEventListener('click', () => {
      menuToggle.checked = false;
      syncMenuState();
    });
  }

  // Fermer menu avec Échap
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && menuToggle.checked) {
      menuToggle.checked = false;
      syncMenuState();
    }
  });

  // État initial
  syncMenuState();
  updateBurgerVisibility();
});



// ============================= 2. LIGHTBOX POUR LES CRÉATIONS =============================

document.addEventListener('DOMContentLoaded', () => {
  const lightbox      = document.getElementById('lightbox');
  if (!lightbox) return;

  const lightboxImg   = document.getElementById('lightbox-img');
  const lightboxTitle = document.getElementById('lightbox-title');
  const lightboxDate  = document.getElementById('lightbox-date');
  const lightboxDesc  = document.getElementById('lightbox-desc');
  const lightboxExtra = document.getElementById('lightbox-extra');
  const closeBtn      = document.getElementById('lightbox-close');
  const lbLikeBtn     = document.getElementById('lb-like-btn');
  const lbLikeIcon    = document.getElementById('lb-like-icon');
  const lbShareBtn    = document.getElementById('lb-share-btn');
  const lbCopyBtn     = document.getElementById('lb-copy-btn');
  const lbPrevBtn     = document.getElementById('lb-prev');
  const lbNextBtn     = document.getElementById('lb-next');

  if (!lightboxImg || !lightboxTitle || !lightboxDesc || !closeBtn) {
    console.warn('Lightbox : certains éléments sont manquants.');
    return;
  }

  let currentId = null;

  // ── Index de navigation : trié par numéro de fichier (1.webp → 45.webp) ──
  function getNavItems() {
    const items = Array.from(document.querySelectorAll('.layout-3colonnes .prspk-thumb'));
    return items.sort((a, b) => {
      const numA = parseInt(a.getAttribute('src').match(/(\d+)\.webp/)?.[1] ?? '0', 10);
      const numB = parseInt(b.getAttribute('src').match(/(\d+)\.webp/)?.[1] ?? '0', 10);
      return numA - numB;
    });
  }

  function getCurrentIndex() {
    const items = getNavItems();
    return items.findIndex(img => (img.id || img.src) === currentId);
  }

  function updateNavButtons() {
    if (!lbPrevBtn || !lbNextBtn) return;
    const items = getNavItems();
    const idx = getCurrentIndex();
    lbPrevBtn.disabled = idx <= 0;
    lbNextBtn.disabled = idx >= items.length - 1;
    lbPrevBtn.style.opacity = idx <= 0 ? '0.3' : '1';
    lbNextBtn.style.opacity = idx >= items.length - 1 ? '0.3' : '1';
  }

  // ── LIKES STORE (Firebase Firestore) ────────────────────────────────────
  let userLikes = {}; // Cache local synchronisé en temps réel avec Firebase
  let unsubscribeLikes = null;

  const LikesStore = {
    hasLiked: function(id) {
      return !!userLikes[id];
    },
    toggle: async function(id) {
      const user = window.auth ? window.auth.currentUser : null;
      if (!user) return false;

      const currentStatus = !!userLikes[id];
      const newStatus = !currentStatus;

      // Mise à jour locale immédiate (Optimistic UI) pour éviter toute latence visuelle
      userLikes[id] = newStatus;

      try {
        // Syntaxe modulaire Firebase accessible globalement via window (ou via vos imports)
        const { doc, setDoc } = window.FirebaseFirestore;
        const userDocRef = doc(window.db, 'users', user.uid);

        // On fusionne (merge: true) pour cibler uniquement la clé du dessin dans l'objet likedDrawings
        await setDoc(userDocRef, {
          likedDrawings: {
            [id]: newStatus
          }
        }, { merge: true });

        return newStatus;
      } catch (error) {
        console.error("Erreur lors de la mise à jour du like sur Firestore :", error);
        userLikes[id] = currentStatus; // Annulation du changement local en cas d'échec
        return currentStatus;
      }
    }
  };

  // ── SYNCHRONISATION EN TEMPS RÉEL DE L'ÉTAT DE CONNEXION ET DES LIKES ─────
  if (window.auth) {
    window.auth.onAuthStateChanged((user) => {
      if (user) {
        // L'utilisateur est connecté -> On écoute son document Firestore en temps réel
        const { doc, onSnapshot } = window.FirebaseFirestore;
        const userDocRef = doc(window.db, 'users', user.uid);

        unsubscribeLikes = onSnapshot(userDocRef, (docSnap) => {
          if (docSnap.exists() && docSnap.data().likedDrawings) {
            userLikes = docSnap.data().likedDrawings;
          } else {
            userLikes = {};
          }
          // Si la lightbox est ouverte sur un dessin, on actualise l'icône de son bouton Like
          if (lightbox.classList.contains('active') && currentId) {
            updateLikeUI(currentId);
          }
        }, (error) => {
          console.error("Erreur lors de l'écoute des likes :", error);
        });
      } else {
        // L'utilisateur est déconnecté -> On réinitialise tout
        userLikes = {};
        if (unsubscribeLikes) {
          unsubscribeLikes();
          unsubscribeLikes = null;
        }
        if (lightbox.classList.contains('active') && currentId) {
          updateLikeUI(currentId);
        }
      }
    });
  }

  // ── UI like ──────────────────────────────────────────────────────────────
  function updateLikeUI(id) {
    if (!lbLikeBtn || !lbLikeIcon) return;
    var liked = LikesStore.hasLiked(id);
    lbLikeIcon.src = liked ? '/icons/like-active.svg' : '/icons/like.svg';
    lbLikeBtn.classList.toggle('liked', liked);
  }

  // ── Animation like ───────────────────────────────────────────────────────
  function animateLike(liked) {
    if (!liked || !lbLikeBtn) return;
    lbLikeBtn.classList.remove('like-pop');
    void lbLikeBtn.offsetWidth;
    lbLikeBtn.classList.add('like-pop');
    spawnHearts(lbLikeBtn);
  }

  function spawnHearts(btn) {
    for (var i = 0; i < 6; i++) {
      var heart = document.createElement('span');
      heart.className = 'like-particle';
      heart.textContent = '\u2665';
      var angle = Math.random() * 160 - 80;
      var dist  = 30 + Math.random() * 30;
      heart.style.setProperty('--angle', angle + 'deg');
      heart.style.setProperty('--dist', dist + 'px');
      heart.style.setProperty('--delay', (i * 40) + 'ms');
      btn.appendChild(heart);
      heart.addEventListener('animationend', function() { this.remove(); });
    }
  }

  // ── Fenêtre Pop-up d'invitation à se connecter ───────────────────────────
  function showLoginPopup() {
    let popup = document.getElementById('login-popup');
    if (!popup) {
      popup = document.createElement('div');
      popup.id = 'login-popup';
      popup.className = 'login-popup-modal';
      popup.innerHTML = `
        <div class="login-popup-content">
          <h3>Connexion requise !</h3>
          <p>Tu dois être connecté pour aimer ce dessin et l'associer à ton compte.</p>
          <div class="login-popup-buttons">
            <a href="/profile.html" class="popup-btn btn-login">Se connecter</a>
            <button class="popup-btn btn-close" id="close-login-popup">Plus tard</button>
          </div>
        </div>
      `;
      document.body.appendChild(popup);

      // Fermeture au clic sur le bouton de fermeture ou à l'extérieur
      popup.querySelector('#close-login-popup').addEventListener('click', () => popup.classList.remove('visible'));
      popup.addEventListener('click', (e) => { if (e.target === popup) popup.classList.remove('visible'); });
    }
    popup.classList.add('visible');
  }

  // ── Toast partage ────────────────────────────────────────────────────────
  function showShareToast() {
    var toast = document.getElementById('share-toast');
    if (!toast) {
      toast = document.createElement('div');
      toast.id = 'share-toast';
      toast.className = 'share-toast';
      toast.textContent = 'Lien copié ! 🔗';
      document.body.appendChild(toast);
    }
    toast.classList.add('visible');
    setTimeout(function() { toast.classList.remove('visible'); }, 2500);
  }

  // ── Résolution de la source : image desktop correspondante ───────────────
  function resolveSource(img) {
    if (img.dataset.title) return img;

    if (img.id) {
      var desktop = document.querySelector(
        '.layout-3colonnes .prspk-thumb#' + CSS.escape(img.id)
      );
      if (desktop) return desktop;
    }

    var srcPath = img.getAttribute('src');
    if (srcPath) {
      var match = document.querySelector(
        '.layout-3colonnes .prspk-thumb[src="' + srcPath + '"]'
      );
      if (match) return match;
    }

    return null;
  }

  // ── Transition au changement de lightbox ────────────────────────────────
  function switchImage(callback) {
    const win = lightbox.querySelector('.lightbox-window');
    win.style.transition = 'opacity 0.18s cubic-bezier(0.4, 0, 0.2, 1), transform 0.16s cubic-bezier(0.4, 0, 0.2, 1)';
    win.style.opacity    = '0.7';
    win.style.transform  = 'scale(0.97)';

    setTimeout(() => {
      callback();
      requestAnimationFrame(() => {
        win.style.transition = 'opacity 0.18s cubic-bezier(0.22, 1, 0.36, 1), transform 0.18s cubic-bezier(0.22, 1, 0.36, 1)';
        win.style.opacity    = '1';
        win.style.transform  = 'scale(1)';
      });
    }, 180);
  }

  // ── Remplissage du contenu lightbox ─────────────────────────────────────
  function fillLightbox(source) {
    lightboxImg.src           = source.src;
    lightboxImg.alt           = source.alt || '';
    lightboxTitle.textContent = source.dataset.title || '';
    if (lightboxDate) lightboxDate.textContent = source.dataset.date || '';
    lightboxDesc.innerHTML    = source.dataset.desc || '';

    currentId = source.id || source.src;
    lightbox.dataset.id = currentId;

    if (lbLikeBtn) updateLikeUI(currentId);
    updateNavButtons();

    if (source.id) {
      history.pushState(null, '', '#' + source.id);
    }

    // 🆕 Notifie script-comments.js qu'un dessin est affiché
    document.dispatchEvent(new CustomEvent('prspk:lightbox-opened', {
      detail: { drawingId: currentId }
    }));
  }

  // ── Ouverture de la lightbox ─────────────────────────────────────────────
  function openLightbox(img) {
    var source = resolveSource(img);
    if (!source) return;

    fillLightbox(source);
    lightbox.classList.add('active');
    document.body.style.overflow = 'hidden';
  }

  // ── Navigation prev / next ───────────────────────────────────────────────
  function navigateLightbox(direction) {
    const items = getNavItems();
    const idx = getCurrentIndex();
    const newIdx = idx + direction;
    if (newIdx < 0 || newIdx >= items.length) return;

    switchImage(() => fillLightbox(items[newIdx]));
  }

  if (lbPrevBtn) {
    lbPrevBtn.addEventListener('click', function(e) {
      e.stopPropagation();
      navigateLightbox(-1);
    });
  }

  if (lbNextBtn) {
    lbNextBtn.addEventListener('click', function(e) {
      e.stopPropagation();
      navigateLightbox(1);
    });
  }

  // Écoute les clics sur toutes les images des deux layouts
  document.querySelectorAll(
    '.layout-3colonnes img, .layout-2colonnes img'
  ).forEach(function(img) {
    img.addEventListener('click', function() {
      openLightbox(img);
    });
  });

  // ── Ouverture via hash (depuis la page recherche, par ex.) ───────────────
  var hash = window.location.hash.substring(1);
  if (hash) {
    var targetImg = document.querySelector(
      '.layout-3colonnes .prspk-thumb#' + CSS.escape(hash)
    );
    if (targetImg) openLightbox(targetImg);
  }

  // ── Bouton like ──────────────────────────────────────────────────────────
  if (lbLikeBtn) {
    lbLikeBtn.addEventListener('click', async function() {
      if (!currentId) return;

      // 1. On s'assure que l'utilisateur est connecté
      const currentUser = window.auth ? window.auth.currentUser : null;
      if (!currentUser) {
        showLoginPopup(); // Déconnecté -> On affiche la mini-fenêtre pop-up personnalisée
        return;
      }

      // 2. Connecté -> On bascule le statut dans Firestore
      var liked = await LikesStore.toggle(currentId);
      updateLikeUI(currentId);
      animateLike(liked);
    });
  }

  // ── Bouton copier le lien ────────────────────────────────────────────────
  if (lbCopyBtn) {
    lbCopyBtn.addEventListener('click', function() {
      if (!currentId) return;

      var source = document.getElementById(currentId);
      var copyUrl;

      if (source && source.dataset.page) {
        copyUrl = window.location.origin + source.dataset.page;
      } else {
        copyUrl = window.location.origin + '/portfolio/creations/' + currentId;
      }

      if (navigator.clipboard) {
        navigator.clipboard.writeText(copyUrl).then(function() {
          showShareToast();
        });
      }
    });
  }

  // ── Bouton partager ──────────────────────────────────────────────────────
  if (lbShareBtn) {
    lbShareBtn.addEventListener('click', function() {
      if (!currentId) return;

      const source = document.getElementById(currentId);
      let shareUrl = window.location.origin + '/portfolio/creations#' + currentId;

      if (source && source.dataset.page) {
        shareUrl = window.location.origin + source.dataset.page;
      }

      const textePartage = 'Jette un œil à cette création sur Perspikative !';

      if (navigator.share) {
        navigator.share({
          title: 'Perspikative',
          text: textePartage,
          url: shareUrl
        }).catch(function() {});
      } else if (navigator.clipboard) {
        navigator.clipboard.writeText(textePartage + ' ' + shareUrl).then(function() {
          showShareToast();
        });
      }
    });
  }

  // ── Fermeture ────────────────────────────────────────────────────────────
  function closeLightbox() {
    lightbox.classList.remove('active');
    document.body.style.overflow = '';
  }

  closeBtn.addEventListener('click', closeLightbox);

  lightbox.addEventListener('click', function(e) {
    if (e.target === lightbox) closeLightbox();
  });

  document.addEventListener('keydown', function(e) {
    if (!lightbox.classList.contains('active')) return;
    if (e.key === 'Escape')      closeLightbox();
    if (e.key === 'ArrowLeft')   navigateLightbox(-1);
    if (e.key === 'ArrowRight')  navigateLightbox(1);
  });
});



// ============================= 3. BARRE DE NAVIGATION MOBILE - MASQUAGE AU SCROLL =============================

document.addEventListener('DOMContentLoaded', () => {
  const mobileNav = document.querySelector('.mobile-nav');
  
  // Vérifier si la barre de navigation mobile existe (seulement sur mobile)
  if (!mobileNav) return;
  
  let lastScrollTop = 0;
  let ticking = false;
  const scrollThreshold = 5; // Tolérance très petite pour détecter le bas exact
  
  // Fonction pour gérer le masquage/affichage de la barre
  const handleScroll = () => {
    if (ticking) return;
    
    ticking = true;
    requestAnimationFrame(() => {
      const scrollTop = window.pageYOffset || document.documentElement.scrollTop;
      const windowHeight = window.innerHeight;
      const documentHeight = document.documentElement.scrollHeight;
      const distanceFromBottom = documentHeight - (scrollTop + windowHeight);
      
      // Masquer la barre uniquement quand on arrive tout en bas du footer
      if (distanceFromBottom <= scrollThreshold) {
        mobileNav.classList.add('hide');
      } 
      // Afficher la barre quand on remonte et qu'on n'est plus tout en bas
      else {
        mobileNav.classList.remove('hide');
      }
      
      lastScrollTop = scrollTop <= 0 ? 0 : scrollTop;
      ticking = false;
    });
  };
  
  // Écouter l'événement de scroll avec throttling
  window.addEventListener('scroll', handleScroll, { passive: true });
  
  // Vérifier l'état initial
  handleScroll();
});



// ============================= 4. ANTI CLIQUE GAUCHE =============================

// Bloque clic droit partout
document.addEventListener("contextmenu", e => e.preventDefault());



// ============================= 5. OUVRIR LES HASHS DE LA RECHERCHE POUR LES LIGHTBOXS =============================
// → Intégré directement dans la section 2 (fonction openLightbox + résolution via hash au chargement)



// ============================= 6. GESTION DU MODE SOMBRE =============================

document.addEventListener("DOMContentLoaded", () => {
  const root = document.documentElement;
  const savedTheme = localStorage.getItem("theme");

  // Appliquer le thème partout
  if (savedTheme === "dark") {
    root.setAttribute("data-theme", "dark");
  }

  // Gestion de la toggle (seulement si elle existe)
  const darkToggle = document.getElementById("dark-mode");
  if (!darkToggle) return;

  darkToggle.checked = savedTheme === "dark";

  darkToggle.addEventListener("change", () => {
    if (darkToggle.checked) {
      root.setAttribute("data-theme", "dark");
      localStorage.setItem("theme", "dark");
    } else {
      root.removeAttribute("data-theme");
      localStorage.removeItem("theme");
    }
  });
});



// ============================= 7. FAQ DÉROULANTE =============================

document.addEventListener('DOMContentLoaded', () => {
  const faqQuestions = document.querySelectorAll('.faq-question');

  faqQuestions.forEach(question => {
    question.addEventListener('click', () => {
      const faqItem = question.closest('.faq-item');
      const isActive = faqItem.classList.contains('active');

      // Fermer tous les autres éléments de FAQ
      document.querySelectorAll('.faq-item.active').forEach(item => {
        if (item !== faqItem) {
          item.classList.remove('active');
          const btn = item.querySelector('.faq-question');
          if (btn) {
            btn.setAttribute('aria-expanded', 'false');
          }
        }
      });

      // Basculer l'élément actuel
      if (isActive) {
        faqItem.classList.remove('active');
        question.setAttribute('aria-expanded', 'false');
      } else {
        faqItem.classList.add('active');
        question.setAttribute('aria-expanded', 'true');
      }
    });
  });
});



// ============================= 8. LOADER PERSPIKATIVE =============================

document.addEventListener("DOMContentLoaded", () => {
  const loader = document.getElementById("site-loader");

  if (!loader) return;

  const hasSeenLoader = sessionStorage.getItem("perspikative-loader");

  if (hasSeenLoader) {
    loader.style.display = "none";
  } else {
    sessionStorage.setItem("perspikative-loader", "true");
  }
});



// ============================= 9. BOUTON FLOTTANT DE RECHERCHE - MASQUAGE AU SCROLL =============================

document.addEventListener('DOMContentLoaded', () => {
  const searchBtn = document.querySelector('.search-float-btn');
  
  // Vérifier si le bouton existe
  if (!searchBtn) return;
  
  let lastScrollTop = 0;
  let ticking = false;
  const scrollThreshold = 5; // Tolérance très petite pour détecter le bas exact
  
  // Fonction pour gérer le masquage/affichage du bouton
  const handleScroll = () => {
    if (ticking) return;
    
    ticking = true;
    requestAnimationFrame(() => {
      const scrollTop = window.pageYOffset || document.documentElement.scrollTop;
      const windowHeight = window.innerHeight;
      const documentHeight = document.documentElement.scrollHeight;
      const distanceFromBottom = documentHeight - (scrollTop + windowHeight);
      
      // Masquer le bouton uniquement quand on arrive tout en bas
      if (distanceFromBottom <= scrollThreshold) {
        searchBtn.classList.add('hide');
      } 
      // Afficher le bouton quand on remonte et qu'on n'est plus tout en bas
      else {
        searchBtn.classList.remove('hide');
      }
      
      lastScrollTop = scrollTop <= 0 ? 0 : scrollTop;
      ticking = false;
    });
  };
  
  // Écouter l'événement de scroll avec throttling
  window.addEventListener('scroll', handleScroll, { passive: true });
  
  // Vérifier l'état initial
  handleScroll();
});



// ============================= 10. ANIMATION D'APPARITION DU FOOTER =============================

const observer = new IntersectionObserver((entries) => {
  entries.forEach(entry => {
    // Si le footer est visible à au moins 10% dans l'écran
    if (entry.isIntersecting) {
      entry.target.classList.add('is-visible');
    }
  });
}, { threshold: 0.1 }); // Se déclenche quand 10% du footer apparaît

observer.observe(document.querySelector('footer'));



// ============================= 11. PARALLAX SUR LES IMAGES DE L'ACCUEIL =============================
// Intensités calées sur les vrais z-index CSS :
//   z-index 20  (pos-8)  → bouge le plus   (devant)
//   z-index 14  (pos-2)  → …
//   z-index 12  (pos-6)  → …
//   z-index 10  (pos-3)  → …
//   z-index  7  (pos-4)  → …
//   z-index  6  (pos-7)  → …
//   z-index -20 (pos-1, pos-5) → bouge le moins (fond)
//
// Chaque image garde sa rotation CSS via getComputedStyle.
// Lerp par image pour des vitesses de réponse différentes selon le calque.

document.addEventListener('DOMContentLoaded', () => {
  if (window.innerWidth <= 768) return;

  // Déplacement max en px selon z-index (devant = plus grand)
  const DEPTH = {
    'pos-8': 40,   // z 20  — tout devant
    'pos-2': 30,   // z 14
    'pos-6': 26,   // z 12
    'pos-3': 22,   // z 10
    'pos-4': 16,   // z  7
    'pos-7': 14,   // z  6
    'pos-1':  4,   // z -20 — fond
    'pos-5':  4,   // z -20 — fond
  };

  // Vitesse de lerp par calque : les images de devant suivent plus vite
  const SMOOTH = {
    'pos-8': 0.10,
    'pos-2': 0.09,
    'pos-6': 0.08,
    'pos-3': 0.07,
    'pos-4': 0.06,
    'pos-7': 0.055,
    'pos-1': 0.04,
    'pos-5': 0.04,
  };

  const imgData = Array.from(document.querySelectorAll('.p-img')).map(img => {
    const posClass = [...img.classList].find(c => c.startsWith('pos-'));
    const maxDist  = posClass ? (DEPTH[posClass]  ?? 12)   : 12;
    const smooth   = posClass ? (SMOOTH[posClass] ?? 0.06) : 0.06;

    // Lire la rotation initiale depuis le CSS (transform ou rotate)
    const computed = window.getComputedStyle(img);
    const matrix   = new DOMMatrix(computed.transform);
    const rot      = Math.atan2(matrix.b, matrix.a) * (180 / Math.PI);

    return { el: img, maxDist, smooth, rot, cx: 0, cy: 0 };
  });

  let targetX = 0, targetY = 0;

  const lerp = (a, b, t) => a + (b - a) * t;

  function animate() {
    imgData.forEach(item => {
      item.cx = lerp(item.cx, targetX, item.smooth);
      item.cy = lerp(item.cy, targetY, item.smooth);

      const x = item.cx * -item.maxDist;
      const y = item.cy * -item.maxDist;

      item.el.style.transform = `translate3d(${x}px, ${y}px, 0) rotate(${item.rot}deg)`;
    });

    requestAnimationFrame(animate);
  }

  window.addEventListener('mousemove', (e) => {
    // Normalise entre -1 et 1
    targetX = (e.clientX - window.innerWidth  / 2) / (window.innerWidth  / 2);
    targetY = (e.clientY - window.innerHeight / 2) / (window.innerHeight / 2);
  }, { passive: true });

  document.addEventListener('mouseleave', () => { targetX = 0; targetY = 0; });

  requestAnimationFrame(animate);
});



// ============================= 12. ANIMATION FONDU AU SCROLL - GRILLE MASONRY =============================

document.addEventListener('DOMContentLoaded', () => {
  const imgs = document.querySelectorAll('.layout-3colonnes img');
  if (!imgs.length) return;

  const isMobile = window.matchMedia('(max-width: 768px)').matches;

  const LAYOUT_DELAY = 1000;
  const ANIM_DURATION = 400;
  const STAGGER = 55;

  // 1) Rendre toutes les images invisibles immédiatement
  imgs.forEach(img => {
    img.style.opacity = '0';
    img.style.transform = 'translateY(10px)';
    img.style.transition = 'none';
    img.dataset.revealed = 'false';
  });

  // 2) Après le délai layout, activer le système de scroll
  setTimeout(() => {
    const reveal = (img, delay) => {
      img.style.transition = `opacity ${ANIM_DURATION}ms ease ${delay}ms,
                              transform ${ANIM_DURATION}ms ease ${delay}ms`;
      img.style.opacity = '1';
      img.style.transform = 'translateY(0)';
      img.dataset.revealed = 'true';
    };

    // 3) Révéler d'abord les images déjà dans le viewport
    let initialIndex = 0;
    imgs.forEach(img => {
      const rect = img.getBoundingClientRect();
      const inView = rect.top < window.innerHeight && rect.bottom > 0;
      if (inView) {
        reveal(img, initialIndex * STAGGER);
        initialIndex++;
      }
    });

    // 4) Observer les images hors viewport — rootMargin à 0 sur mobile pour ne pas rater d'images
    const observer = new IntersectionObserver((entries) => {
      const appearing = entries.filter(e => e.isIntersecting && e.target.dataset.revealed === 'false');
      appearing.forEach((entry, i) => {
        reveal(entry.target, i * STAGGER);
        observer.unobserve(entry.target);
      });
    }, {
      threshold: 0.05,
      rootMargin: isMobile ? '0px' : '0px 0px -20px 0px'
    });

    imgs.forEach(img => {
      if (img.dataset.revealed === 'false') {
        observer.observe(img);
      }
    });

  }, LAYOUT_DELAY);
});


// ============================= 13. SERVICE WORKER =============================

if ('serviceWorker' in navigator) {

  navigator.serviceWorker.register('/sw.js')
    .then((registration) => {

      registration.update();

      setInterval(() => {
        registration.update();
      }, 60000);

    });

  navigator.serviceWorker.addEventListener(
    'controllerchange',
    () => {
      window.location.reload();
    }
  );
}

// ============================= FIN DU SCRIPT =============================