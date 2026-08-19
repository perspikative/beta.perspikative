(function() {
  'use strict';

  const SCROLL_THRESHOLD = 2;

  function initCommentsFade(container) {
    if (!container) return;

    let updateScheduled = false;

    function updateMaskClasses() {
      updateScheduled = false;

      const scrollTop = container.scrollTop;
      const scrollHeight = container.scrollHeight;
      const clientHeight = container.clientHeight;

      /*
       * La section est scrollable uniquement si
       * son contenu dépasse réellement sa hauteur visible.
       */
      const isScrollable =
        scrollHeight > clientHeight + SCROLL_THRESHOLD;

      /*
       * On retire toujours les anciens états avant
       * de recalculer.
       */
      container.classList.remove(
        'is-scrollable',
        'at-top',
        'at-bottom'
      );

      /*
       * Pas de scroll possible = aucun masque.
       */
      if (!isScrollable) {
        return;
      }

      /*
       * Le conteneur est réellement scrollable.
       */
      container.classList.add('is-scrollable');

      const maxScroll = scrollHeight - clientHeight;

      /*
       * Tout en haut.
       */
      if (scrollTop <= SCROLL_THRESHOLD) {
        container.classList.add('at-top');
      }

      /*
       * Tout en bas.
       */
      if (scrollTop >= maxScroll - SCROLL_THRESHOLD) {
        container.classList.add('at-bottom');
      }
    }


    /*
     * On attend le prochain frame avant de recalculer.
     * Cela évite de lire scrollHeight/clientHeight
     * alors que le layout est encore en train de changer.
     */
    function scheduleUpdate() {
      if (updateScheduled) return;

      updateScheduled = true;

      requestAnimationFrame(() => {
        requestAnimationFrame(updateMaskClasses);
      });
    }


    /*
     * Première vérification.
     */
    scheduleUpdate();


    /*
     * Mise à jour pendant le scroll.
     */
    container.addEventListener(
      'scroll',
      scheduleUpdate,
      { passive: true }
    );


    /*
     * Surveille les changements de contenu :
     * - ajout d'un commentaire
     * - suppression d'un commentaire
     * - changement de texte
     * - modifications dans les éléments enfants
     */
    const contentObserver = new MutationObserver(() => {
      scheduleUpdate();
    });

    contentObserver.observe(container, {
      childList: true,
      subtree: true,
      characterData: true
    });


    /*
     * Très important :
     * détecte les changements de taille réels du conteneur.
     *
     * Par exemple :
     * - ouverture de la lightbox
     * - changement de taille de fenêtre
     * - changement de taille d'un commentaire
     * - passage d'un état caché à visible
     */
    const resizeObserver = new ResizeObserver(() => {
      scheduleUpdate();
    });

    resizeObserver.observe(container);


    /*
     * Nettoyage.
     */
    return () => {
      container.removeEventListener(
        'scroll',
        scheduleUpdate
      );

      contentObserver.disconnect();
      resizeObserver.disconnect();
    };
  }


  function observeLightbox() {
    const lightbox =
      document.getElementById('lightbox');

    const commentsList =
      document.getElementById('lb-comments-list');


    if (!lightbox || !commentsList) {
      setTimeout(observeLightbox, 100);
      return;
    }


    let cleanupFade =
      initCommentsFade(commentsList);


    /*
     * Quand la lightbox change d'état,
     * on recalcule le système.
     */
    const lightboxObserver = new MutationObserver(() => {
      if (
        lightbox.classList.contains('active') ||
        !lightbox.classList.contains('is-hidden')
      ) {
        if (cleanupFade) {
          cleanupFade();
        }

        cleanupFade =
          initCommentsFade(commentsList);
      }
    });


    lightboxObserver.observe(lightbox, {
      attributes: true,
      attributeFilter: ['class']
    });
  }


  if (document.readyState === 'loading') {
    document.addEventListener(
      'DOMContentLoaded',
      observeLightbox
    );
  } else {
    observeLightbox();
  }


  window.initCommentsFade =
    initCommentsFade;

})();