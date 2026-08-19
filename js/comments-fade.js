(function () {
  'use strict';


  /*
   * =========================================================
   * CONFIGURATION
   * =========================================================
   */

  /*
   * Petite marge de sécurité pour éviter qu'une différence
   * de 1 ou 2 pixels due aux arrondis du navigateur fasse
   * croire que la section est scrollable.
   */
  const SCROLL_THRESHOLD = 2;


  /*
   * =========================================================
   * INITIALISATION DU SYSTÈME
   * =========================================================
   */

  function initCommentsFade(container) {

    /*
     * Si la liste des commentaires n'existe pas,
     * on ne fait rien.
     */
    if (!container) return;


    /*
     * Empêche de lancer plusieurs calculs dans
     * le même cycle de rendu.
     */
    let updateScheduled = false;


    /*
     * =====================================================
     * CALCUL PRINCIPAL
     * =====================================================
     */

    function updateMaskClasses() {

      /*
       * Le calcul programmé est maintenant exécuté.
       */
      updateScheduled = false;


      /*
       * Nombre de pixels actuellement scrollés
       * depuis le haut de la liste.
       */
      const scrollTop = container.scrollTop;


      /*
       * Hauteur TOTALE du contenu de la liste.
       *
       * Elle inclut notamment les commentaires qui
       * sont actuellement en dehors de la zone visible.
       */
      const scrollHeight = container.scrollHeight;


      /*
       * Hauteur réellement visible de la liste.
       */
      const clientHeight = container.clientHeight;


      /*
       * =================================================
       * LA RÈGLE PRINCIPALE
       * =================================================
       *
       * Si le contenu est plus grand que la zone visible,
       * alors la liste est scrollable.
       *
       * Sinon, elle ne l'est pas.
       */
      const isScrollable =
        scrollHeight > clientHeight + SCROLL_THRESHOLD;


      /*
       * On supprime toujours les anciennes classes
       * de position avant de recalculer leur état.
       */
      container.classList.remove(
        'at-top',
        'at-bottom'
      );


      /*
       * =================================================
       * PAS SCROLLABLE
       * =================================================
       */

      if (!isScrollable) {

        /*
         * TRÈS IMPORTANT :
         *
         * On retire complètement la classe qui active
         * le masque CSS.
         *
         * Le CSS correspondant à .is-scrollable
         * n'est donc plus appliqué du tout.
         */
        container.classList.remove('is-scrollable');


        /*
         * On arrête immédiatement la fonction.
         *
         * Aucun fade.
         * Aucun masque.
         * Aucune classe at-top / at-bottom.
         */
        return;
      }


      /*
       * =================================================
       * SCROLLABLE
       * =================================================
       */

      /*
       * La liste est réellement scrollable.
       *
       * On active donc le masque CSS.
       */
      container.classList.add('is-scrollable');


      /*
       * Hauteur maximale du scroll.
       *
       * Exemple :
       *
       * contenu = 1000 px
       * zone visible = 400 px
       *
       * maxScroll = 600 px
       */
      const maxScroll =
        scrollHeight - clientHeight;


      /*
       * =================================================
       * TOUT EN HAUT
       * =================================================
       *
       * Si scrollTop vaut environ 0,
       * aucun contenu n'est au-dessus.
       */
      if (scrollTop <= SCROLL_THRESHOLD) {

        container.classList.add('at-top');
      }


      /*
       * =================================================
       * TOUT EN BAS
       * =================================================
       *
       * Si scrollTop est arrivé à la hauteur maximale,
       * aucun contenu supplémentaire ne se trouve en dessous.
       */
      if (scrollTop >= maxScroll - SCROLL_THRESHOLD) {

        container.classList.add('at-bottom');
      }
    }


    /*
     * =====================================================
     * PROGRAMMATION DU CALCUL
     * =====================================================
     */

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


    /*
     * =====================================================
     * PREMIER CALCUL
     * =====================================================
     */

    /*
     * On ne calcule pas immédiatement.
     *
     * On attend que la lightbox et ses commentaires
     * soient correctement rendus.
     */
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