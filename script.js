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

  if (!lightboxImg || !lightboxTitle || !lightboxDesc || !closeBtn) {
    console.warn('Lightbox : certains éléments sont manquants.');
    return;
  }

  let currentId = null;

  // ── LIKES STORE (localStorage) ──────────────────────────────────────────
  const LikesStore = {
    _key: 'prspk_likes',
    _data: function() {
      try { return JSON.parse(localStorage.getItem(this._key)) || {}; }
      catch(e) { return {}; }
    },
    _save: function(data) {
      localStorage.setItem(this._key, JSON.stringify(data));
    },
    hasLiked: function(id) {
      return !!this._data()[id];
    },
    toggle: function(id) {
      var data = this._data();
      data[id] = !data[id];
      this._save(data);
      return data[id];
    }
  };

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
  // Pour une image mobile (avec ou sans data-title), retrouve l'image
  // de référence dans la layout-3colonnes via l'id ou le src.
  function resolveSource(img) {
    // Cas 1 : l'image a ses propres data-title → elle est sa propre source
    if (img.dataset.title) return img;

    // Cas 2 : elle a un id → on cherche l'équivalent dans la version desktop
    if (img.id) {
      var desktop = document.querySelector(
        '.layout-3colonnes .prspk-thumb#' + CSS.escape(img.id)
      );
      if (desktop) return desktop;
    }

    // Cas 3 : pas d'id mais un src → on cherche par src dans la version desktop
    var srcPath = img.getAttribute('src');
    if (srcPath) {
      var match = document.querySelector(
        '.layout-3colonnes .prspk-thumb[src="' + srcPath + '"]'
      );
      if (match) return match;
    }

    return null;
  }

  // ── Ouverture de la lightbox ─────────────────────────────────────────────
  function openLightbox(img) {
    var source = resolveSource(img);
    if (!source) return;

    lightboxImg.src           = source.src;
    lightboxImg.alt           = source.alt || '';
    lightboxTitle.textContent = source.dataset.title || '';
    if (lightboxDate) lightboxDate.textContent = source.dataset.date || '';
    lightboxDesc.innerHTML    = source.dataset.desc || '';

    currentId = source.id || source.src;
    lightbox.dataset.id = currentId;

    if (lbLikeBtn) updateLikeUI(currentId);

    lightbox.classList.add('active');
    document.body.style.overflow = 'hidden';

    if (source.id) {
      history.pushState(null, '', '#' + source.id);
    }
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
    lbLikeBtn.addEventListener('click', function() {
      if (!currentId) return;
      var liked = LikesStore.toggle(currentId);
      updateLikeUI(currentId);
      animateLike(liked);
    });
  }

  // ── Bouton partager (Version Corrigée) ───────────────────────────────────
  if (lbShareBtn) {
    lbShareBtn.addEventListener('click', function() {
      if (!currentId) return;

      // On récupère l'image source pour voir s'il y a une page dédiée
      const source = document.getElementById(currentId);
      let shareUrl = window.location.origin + '/portfolio/creations#' + currentId;

      // Si l'image a un attribut data-page (ex: /portfolio/creations/kayous-diner)
      if (source && source.dataset.page) {
        shareUrl = window.location.origin + source.dataset.page;
      }

      const textePartage = 'Jette un œil à cette création sur Perspikative !';

      if (navigator.share) {
        // En séparant texte et url, WhatsApp ne doublera plus le lien
        navigator.share({ 
          title: 'Perspikative', 
          text: textePartage, 
          url: shareUrl 
        }).catch(function() {});
      } else if (navigator.clipboard) {
        // Pour PC : on copie le texte + l'espace + l'URL
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
    if (e.key === 'Escape' && lightbox.classList.contains('active')) {
      closeLightbox();
    }
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
document.addEventListener('mousemove', (e) => {
  const mouseX = (e.clientX - window.innerWidth / 2);
  const mouseY = (e.clientY - window.innerHeight / 2);


  // On sélectionne toutes les images de décor
  const images = document.querySelectorAll('.p-img');


  images.forEach((img) => {
    // On définit la force de l'effet selon la classe ou le z-index
    // Plus le chiffre est petit, plus l'image fuit loin
    let intensity = 0.02;

    if (img.classList.contains('pos-1')) intensity = 0.04;
    if (img.classList.contains('pos-3')) intensity = 0.006; // Fond lointain
    if (img.classList.contains('cat-mascot')) intensity = 0.07; // Premier plan

    // Calcul du mouvement inversé (-)
    const x = mouseX * -intensity;
    const y = mouseY * -intensity;

    img.style.transform = `translate3d(${x}px, ${y}px, 0)`;
  });
});



document.addEventListener('DOMContentLoaded', () => {
  const images = document.querySelectorAll('.p-img');

  // On stocke la rotation initiale de chaque image pour ne pas la perdre
  const imgData = Array.from(images).map(img => {
    const style = window.getComputedStyle(img);
    const matrix = new WebKitCSSMatrix(style.transform);
    const angle = Math.round(Math.atan2(matrix.b, matrix.a) * (180/Math.PI));

    // On définit l'intensité selon le z-index
    const z = parseInt(style.zIndex);
    let intensity = 0.04;
    if (z < 5) intensity = 0.006; // Fond
    if (z > 10) intensity = 0.07; // Premier plan

    return { el: img, rot: angle, speed: intensity };
  });

  window.addEventListener('mousemove', (e) => {
    const mouseX = (e.clientX - window.innerWidth / 2);
    const mouseY = (e.clientY - window.innerHeight / 2);

    imgData.forEach(item => {

      // Mouvement opposé (-)
      const x = mouseX * -item.speed;
      const y = mouseY * -item.speed;

      item.el.style.transform = `translate3d(${x}px, ${y}px, 0) rotate(${item.rot}deg)`;
    });
  });
});



document.addEventListener('DOMContentLoaded', () => {
  const images = document.querySelectorAll('.p-img');

  // Pré-calcul des intensités pour éviter de lire le DOM à chaque mouvement
  const imgData = Array.from(images).map(img => {
    let intensity = 0.03; // Défaut

    // Intensité basée sur ton setup
    if (img.classList.contains('pos-1')) intensity = 0.05;
    if (img.classList.contains('pos-3')) intensity = 0.006;
    if (img.classList.contains('cat-mascot')) intensity = 0.08;
    if (img.classList.contains('pos-8')) intensity = 0.06;

    return { el: img, speed: intensity };
  });

  window.addEventListener('mousemove', (e) => {
    // Uniquement sur Desktop (on check la largeur)
    if (window.innerWidth > 768) {
      const mouseX = (e.clientX - window.innerWidth / 2);
      const mouseY = (e.clientY - window.innerHeight / 2);

      imgData.forEach(item => {
        const x = mouseX * -item.speed;
        const y = mouseY * -item.speed;
        // On utilise translate3d pour la performance GPU
        item.el.style.transform = `translate3d(${x}px, ${y}px, 0)`;
      });
    }
  });
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

// ============================= FIN DU SCRIPT =============================
