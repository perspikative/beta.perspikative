(function () {
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

      const isScrollable =
        scrollHeight > clientHeight + SCROLL_THRESHOLD;

      container.classList.remove(
        'at-top',
        'at-bottom'
      );


      if (!isScrollable) {

        container.classList.remove('is-scrollable');

        return;
      }


      container.classList.add('is-scrollable');


      const maxScroll =
        scrollHeight - clientHeight;

      if (scrollTop <= SCROLL_THRESHOLD) {

        container.classList.add('at-top');
      }


      if (scrollTop >= maxScroll - SCROLL_THRESHOLD) {

        container.classList.add('at-bottom');
      }
    }


    function scheduleUpdate() {

      /*
       * Si un calcul est déjà prévu pour ce cycle,
       * inutile d'en programmer un deuxième.
       */
      if (updateScheduled) return;


      /*
       * On indique qu'un calcul est en attente.
       */
      updateScheduled = true;


      /*
       * On attend deux frames.
       *
       * Cela laisse au navigateur le temps de :
       *
       * 1. modifier le DOM
       * 2. recalculer les dimensions
       * 3. effectuer le layout
       *
       * avant qu'on lise scrollHeight / clientHeight.
       */
      requestAnimationFrame(() => {

        requestAnimationFrame(() => {

          updateMaskClasses();

        });

      });
    }


    scheduleUpdate();


    /*
     * =====================================================
     * DÉTECTION DU SCROLL
     * =====================================================
     */

    /*
     * Chaque fois que l'utilisateur fait défiler
     * les commentaires, on recalcule la position.
     */
    container.addEventListener(
      'scroll',
      scheduleUpdate,
      {
        passive: true
      }
    );


    /*
     * =====================================================
     * DÉTECTION DES MODIFICATIONS DU CONTENU
     * =====================================================
     */

    /*
     * MutationObserver détecte notamment :
     *
     * - ajout d'un commentaire
     * - suppression d'un commentaire
     * - modification du texte
     * - ajout/suppression d'éléments dans un commentaire
     */
    const contentObserver =
      new MutationObserver(() => {

        scheduleUpdate();

      });


    /*
     * On observe toute la liste et ses descendants.
     */
    contentObserver.observe(container, {

      /*
       * Détecte les éléments ajoutés ou supprimés.
       */
      childList: true,

      /*
       * Observe également les éléments imbriqués.
       */
      subtree: true,

      /*
       * Détecte les changements de texte.
       */
      characterData: true

    });


    /*
     * =====================================================
     * DÉTECTION DES CHANGEMENTS DE DIMENSIONS
     * =====================================================
     */

    /*
     * ResizeObserver est particulièrement important ici.
     *
     * Par exemple :
     *
     * - la lightbox change de taille
     * - un commentaire passe sur plusieurs lignes
     * - un commentaire est supprimé
     * - la fenêtre est redimensionnée
     * - le layout mobile/desktop change
     */
    const resizeObserver =
      new ResizeObserver(() => {

        scheduleUpdate();

      });


    /*
     * On surveille directement la liste.
     */
    resizeObserver.observe(container);


    /*
     * =====================================================
     * NETTOYAGE
     * =====================================================
     */

    return function cleanup() {

      /*
       * Arrête l'écoute du scroll.
       */
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

      setTimeout(
        observeLightbox,
        100
      );

      return;
    }


    let cleanupFade =
      initCommentsFade(commentsList);



    const lightboxObserver =
      new MutationObserver(() => {


        if (cleanupFade) {

          cleanupFade();

        }



        cleanupFade =
          initCommentsFade(commentsList);

      });



    lightboxObserver.observe(
      lightbox,
      {
        attributes: true,
        attributeFilter: ['class']
      }
    );
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