(function() {
  'use strict';

  const SCROLL_THRESHOLD = 5;


  function initCommentsFade(container) {
    if (!container) return;

    function updateMaskClasses() {
      const scrollTop = container.scrollTop;
      const scrollHeight = container.scrollHeight;
      const clientHeight = container.clientHeight;
      const scrollBottom = scrollHeight - clientHeight - scrollTop;

      container.classList.remove('at-top', 'at-bottom');

      if (scrollTop <= SCROLL_THRESHOLD) {
        container.classList.add('at-top');
      }

      if (scrollBottom <= SCROLL_THRESHOLD) {
        container.classList.add('at-bottom');
      }
    }

    updateMaskClasses();

    requestAnimationFrame(updateMaskClasses);

    requestAnimationFrame(() => {
      requestAnimationFrame(updateMaskClasses);
    });

    container.addEventListener('scroll', updateMaskClasses, {
      passive: true
    });


    const contentObserver = new MutationObserver(() => {
      requestAnimationFrame(() => {
        requestAnimationFrame(updateMaskClasses);
      });
    });

    contentObserver.observe(container, {
      childList: true,
      subtree: false
    });


    return () => {
      container.removeEventListener('scroll', updateMaskClasses);
      contentObserver.disconnect();
    };
  }


  function observeLightbox() {
    const lightbox = document.getElementById('lightbox');
    const commentsList = document.getElementById('lb-comments-list');

    if (!lightbox || !commentsList) {
      setTimeout(observeLightbox, 100);
      return;
    }

    let cleanupFade = initCommentsFade(commentsList);


    const observer = new MutationObserver((mutations) => {
      mutations.forEach((mutation) => {
        if (
          mutation.type === 'attributes' &&
          mutation.attributeName === 'class'
        ) {
          if (
            lightbox.classList.contains('active') ||
            !lightbox.classList.contains('is-hidden')
          ) {
            if (cleanupFade) cleanupFade();

            cleanupFade = initCommentsFade(commentsList);
          }
        }
      });
    });

    observer.observe(lightbox, {
      attributes: true
    });


    commentsList.addEventListener('scroll', () => {
    }, {
      passive: true
    });
  }


  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', observeLightbox);
  } else {
    // Le DOM est déjà chargé
    observeLightbox();
  }


  window.initCommentsFade = initCommentsFade;
})();