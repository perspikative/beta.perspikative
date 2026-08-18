/**
 * 💫 Gestion du fade dynamique au scroll pour la liste des commentaires
 * 
 * Détecte si l'utilisateur est en haut/bas de la liste et met à jour
 * les classes CSS correspondantes pour afficher/masquer les fades.
 */

(function() {
  'use strict';

  // Seuil en pixels : au-delà duquel on considère qu'on n'est plus "en haut" ou "en bas"
  const SCROLL_THRESHOLD = 5;

  /**
   * Initialise le système de fade au scroll
   * À appeler une fois que le DOM est chargé et la lightbox ouverte
   */
  function initCommentsFade(container) {
    if (!container) return;

    // Fonction qui met à jour les classes selon la position du scroll
    function updateMaskClasses() {
      const scrollTop = container.scrollTop;
      const scrollHeight = container.scrollHeight;
      const clientHeight = container.clientHeight;
      const scrollBottom = scrollHeight - clientHeight - scrollTop;

      // Réinitialiser les classes
      container.classList.remove('at-top', 'at-bottom');

      // Ajouter les classes selon la position
      if (scrollTop <= SCROLL_THRESHOLD) {
        container.classList.add('at-top');
      }

      if (scrollBottom <= SCROLL_THRESHOLD) {
        container.classList.add('at-bottom');
      }
    }

    // Appeler une première fois au chargement (au cas où il n'y ait pas assez de contenu)
    // Utiliser requestAnimationFrame pour s'assurer que le DOM est stable
    requestAnimationFrame(updateMaskClasses);

    // Ajouter l'écouteur de scroll
    container.addEventListener('scroll', updateMaskClasses, { passive: true });

    // Retourner une fonction pour nettoyer les écouteurs (optionnel)
    return () => {
      container.removeEventListener('scroll', updateMaskClasses);
    };
  }

  /**
   * Observe les changements du lightbox et initialise le fade quand il s'ouvre
   * Cette approche est nécessaire car la lightbox peut être créée dynamiquement
   */
  function observeLightbox() {
    const lightbox = document.getElementById('lightbox');
    const commentsList = document.getElementById('lb-comments-list');

    if (!lightbox || !commentsList) {
      // Si les éléments n'existent pas encore, réessayer dans 100ms
      setTimeout(observeLightbox, 100);
      return;
    }

    // Initialiser le fade dès le départ (au cas où la lightbox serait déjà visible)
    let cleanupFade = initCommentsFade(commentsList);

    // Observer l'ouverture/fermeture de la lightbox
    const observer = new MutationObserver((mutations) => {
      mutations.forEach((mutation) => {
        if (mutation.type === 'attributes' && mutation.attributeName === 'class') {
          // Quand la lightbox s'ouvre, on réinitialise le fade
          if (lightbox.classList.contains('active') || !lightbox.classList.contains('is-hidden')) {
            // Nettoyer les anciens écouteurs si nécessaire
            if (cleanupFade) cleanupFade();
            
            // Réinitialiser avec les nouveaux commentaires
            cleanupFade = initCommentsFade(commentsList);
          }
        }
      });
    });

    observer.observe(lightbox, { attributes: true });

    // S'assurer que le fade est actif au scroll des commentaires, peu importe l'état
    commentsList.addEventListener('scroll', () => {
      // Le fade se met à jour automatiquement grâce à l'écouteur dans initCommentsFade
    }, { passive: true });
  }

  // Attendre que le DOM soit complètement chargé
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', observeLightbox);
  } else {
    // Le DOM est déjà chargé
    observeLightbox();
  }

  // Exposer la fonction globalement au cas où on en aurait besoin ailleurs
  window.initCommentsFade = initCommentsFade;
})();
