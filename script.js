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


// ============================= 2. LIGHTBOX - VERSION CORRIGÉE =============================
// On déclare les variables en dehors pour qu'elles soient accessibles partout
let openLightbox; 

document.addEventListener('DOMContentLoaded', () => {
  const lightbox = document.getElementById('lightbox');
  if (!lightbox) return;

  const lightboxImg = document.getElementById('lightbox-img');
  const lightboxTitle = document.getElementById('lightbox-title');
  const lightboxDate = document.getElementById('lightbox-date');
  const lightboxDesc = document.getElementById('lightbox-desc');
  const closeBtn = document.getElementById('lightbox-close');

  // FONCTION UNIVERSELLE D'OUVERTURE
  openLightbox = function(imgElement) {
    if (!imgElement) return;
    
    lightboxImg.src = imgElement.src;
    lightboxImg.alt = imgElement.alt || '';
    lightboxTitle.textContent = imgElement.dataset.title || '';
    if (lightboxDate) lightboxDate.textContent = imgElement.dataset.date || '';
    if (lightboxDesc) lightboxDesc.innerHTML = imgElement.dataset.desc || '';

    lightbox.classList.add('active');
    document.body.style.overflow = 'hidden';
    
    // Met à jour l'URL si l'image a un ID
    if (imgElement.id) {
      history.pushState(null, '', `#${imgElement.id}`);
    }
  };

  // Fermeture (inchangée)
  closeBtn.addEventListener('click', () => {
    lightbox.classList.remove('active');
    document.body.style.overflow = '';
  });

  lightbox.addEventListener('click', (e) => {
    if (e.target === lightbox) {
      lightbox.classList.remove('active');
      document.body.style.overflow = '';
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



// ============================= 5. GESTION DU CLIC ET DU HASH =============================

document.addEventListener('DOMContentLoaded', () => {
  
  // 1. Gérer le Hash au chargement (ex: site.fr/#creation1)
  const hash = window.location.hash.substring(1);
  if (hash) {
    // Petit délai pour laisser le temps aux images de charger en local
    setTimeout(() => {
      const targetImg = document.getElementById(hash);
      if (targetImg && typeof openLightbox === 'function') {
        openLightbox(targetImg);
      }
    }, 500);
  }

  // 2. Gérer le clic sur TOUTES les images (Délégation d'événement)
  document.addEventListener('click', (e) => {
    const clickedImg = e.target.closest('.prspk-thumb');
    if (!clickedImg) return;

    // Si c'est l'image de la grille principale (elle a un titre)
    if (clickedImg.dataset.title) {
      openLightbox(clickedImg);
    } 
    // Si c'est l'image "simplifiée" (2 colonnes), on cherche sa version riche
    else {
      const id = clickedImg.id;
      const sourceImg = document.querySelector(`.layout-3colonnes .prspk-thumb#${CSS.escape(id)}`);
      if (sourceImg) {
        openLightbox(sourceImg);
      } else {
        // Au cas où, on ouvre quand même la version cliquée
        openLightbox(clickedImg);
      }
    }
  });
});



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
