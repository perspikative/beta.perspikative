/* Réfraction "liquid glass" sur la mobile-nav =====
// Déforme réellement le bord de la barre (comme du vrai verre) via un
// filtre SVG feDisplacementMap appliqué en backdrop-filter, technique
// popularisée par shuding/liquid-glass (https://github.com/shuding/liquid-glass).
//
// -- Chromium/Edge : backdrop-filter: url(#svg-filter) natif (branche existante).
// -- Safari/iOS : WebKit ne supporte PAS backdrop-filter: url(). On simule donc
//    une vraie réfraction en capturant le fond avec html2canvas puis en
//    redessinant ce fond distordu pixel par pixel dans un <canvas> placé
//    derrière la nav. Recapture throttlée pendant le scroll (~120ms).
//
// Nécessite /vendor/html2canvas.min.js chargé AVANT ce script (voir balise
// <script> à ajouter dans le HTML, cf. instructions livrées séparément).
*/
(function () {
  'use strict';

  const nav = document.querySelector('.mobile-nav');
  if (!nav) return;

  function supportsGlassFilter() {
    try {
      return (
        (window.CSS && CSS.supports && CSS.supports('backdrop-filter', 'url(#a)')) ||
        (window.CSS && CSS.supports && CSS.supports('-webkit-backdrop-filter', 'url(#a)'))
      );
    } catch (e) {
      return false;
    }
  }

  const FILTER_ID = 'nav-glass-refraction';
  const BEZEL = 13;      // largeur (px) de la zone de déformation depuis le bord — volontairement fine
  const MAX_SHIFT = 26;  // déplacement max des pixels au bord, en px — le vrai "bombé" du verre

  // 1 pile au bord (t = 0), 0 dès qu'on s'enfonce de BEZEL px vers le centre.
  // Courbe resserrée (x^1.6) pour concentrer le "bombé" tout contre le bord
  // plutôt que de l'étaler sur toute la barre (sinon ça ressemble à un zoom).
  function edgeFalloff(t) {
    const x = Math.max(0, Math.min(1, 1 - t / BEZEL));
    return Math.pow(x, 1.6);
  }

  // ==========================================================================
  // BRANCHE CHROMIUM/EDGE — backdrop-filter: url(#svg) natif (code existant,
  // inchangé).
  // ==========================================================================
  function initChromiumGlass() {
    let svg, feImage, feDisplacementMap, filterEl, canvas, ctx;
    let currentWidth = 0;
    let currentHeight = 0;

    function buildSvg() {
      svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
      svg.setAttribute('width', '0');
      svg.setAttribute('height', '0');
      svg.style.cssText = 'position:absolute;width:0;height:0;overflow:hidden;pointer-events:none;';

      const defs = document.createElementNS('http://www.w3.org/2000/svg', 'defs');
      filterEl = document.createElementNS('http://www.w3.org/2000/svg', 'filter');
      filterEl.setAttribute('id', FILTER_ID);
      filterEl.setAttribute('filterUnits', 'userSpaceOnUse');
      filterEl.setAttribute('colorInterpolationFilters', 'sRGB');
      filterEl.setAttribute('x', '0');
      filterEl.setAttribute('y', '0');

      feImage = document.createElementNS('http://www.w3.org/2000/svg', 'feImage');
      feImage.setAttribute('result', 'displacement_map');

      feDisplacementMap = document.createElementNS('http://www.w3.org/2000/svg', 'feDisplacementMap');
      feDisplacementMap.setAttribute('in', 'SourceGraphic');
      feDisplacementMap.setAttribute('in2', 'displacement_map');
      feDisplacementMap.setAttribute('xChannelSelector', 'R');
      feDisplacementMap.setAttribute('yChannelSelector', 'G');

      filterEl.appendChild(feImage);
      filterEl.appendChild(feDisplacementMap);
      defs.appendChild(filterEl);
      svg.appendChild(defs);
      document.body.appendChild(svg);

      canvas = document.createElement('canvas');
      ctx = canvas.getContext('2d');
    }

    function buildDisplacementMap(w, h) {
      const pad = Math.ceil(MAX_SHIFT) + 2; // marge pour ne pas échantillonner hors zone capturée
      const fullW = w + pad * 2;
      const fullH = h + pad * 2;

      canvas.width = fullW;
      canvas.height = fullH;

      const halfW = w / 2;
      const halfH = h / 2;
      const radius = halfH; // pilule complète : bords entièrement arrondis
      const spine = Math.max(0, halfW - radius);

      const shiftsX = new Float32Array(fullW * fullH);
      const shiftsY = new Float32Array(fullW * fullH);
      let maxShift = 0.0001;

      for (let y = 0; y < h; y++) {
        const py = y - halfH;
        for (let x = 0; x < w; x++) {
          const px = x - halfW;
          const cx = Math.max(-spine, Math.min(spine, px));
          const dx = px - cx;
          const dy = py;
          const dist = Math.hypot(dx, dy);
          const distToEdge = radius - dist; // > 0 à l'intérieur de la pilule

          let bulge = 0;
          if (distToEdge > 0 && distToEdge < BEZEL) {
            bulge = edgeFalloff(distToEdge);
          }

          const len = dist || 1;
          const shiftX = bulge > 0 ? (dx / len) * bulge * MAX_SHIFT : 0;
          const shiftY = bulge > 0 ? (dy / len) * bulge * MAX_SHIFT : 0;

          const i = (y + pad) * fullW + (x + pad);
          shiftsX[i] = shiftX;
          shiftsY[i] = shiftY;
          if (Math.abs(shiftX) > maxShift) maxShift = Math.abs(shiftX);
          if (Math.abs(shiftY) > maxShift) maxShift = Math.abs(shiftY);
        }
      }

      const data = new Uint8ClampedArray(fullW * fullH * 4);
      for (let i = 0; i < fullW * fullH; i++) {
        const r = shiftsX[i] / maxShift / 2 + 0.5;
        const g = shiftsY[i] / maxShift / 2 + 0.5;
        data[i * 4] = r * 255;
        data[i * 4 + 1] = g * 255;
        data[i * 4 + 2] = 128;
        data[i * 4 + 3] = 255;
      }

      ctx.putImageData(new ImageData(data, fullW, fullH), 0, 0);

      feImage.setAttributeNS('http://www.w3.org/1999/xlink', 'href', canvas.toDataURL());
      feImage.setAttribute('x', String(-pad));
      feImage.setAttribute('y', String(-pad));
      feImage.setAttribute('width', fullW);
      feImage.setAttribute('height', fullH);
      feDisplacementMap.setAttribute('scale', maxShift.toString());
      filterEl.setAttribute('x', String(-pad));
      filterEl.setAttribute('y', String(-pad));
      filterEl.setAttribute('width', fullW);
      filterEl.setAttribute('height', fullH);
    }

    function applyFilter() {
      const rect = nav.getBoundingClientRect();
      const w = Math.round(rect.width);
      const h = Math.round(rect.height);
      if (!w || !h || (w === currentWidth && h === currentHeight)) return;
      currentWidth = w;
      currentHeight = h;

      buildDisplacementMap(w, h);

      const value = `url(#${FILTER_ID}) blur(2px) contrast(1.01) saturate(1.18)`;
      nav.style.backdropFilter = value;
      nav.style.webkitBackdropFilter = value;
    }

    buildSvg();
    applyFilter();

    let resizeTimeout;
    window.addEventListener('resize', () => {
      clearTimeout(resizeTimeout);
      resizeTimeout = setTimeout(applyFilter, 150);
    });
  }

  // ==========================================================================
  // BRANCHE iOS/SAFARI (WebKit) — capture réelle du fond via html2canvas +
  // distorsion pixel par pixel redessinée dans un <canvas> derrière la nav.
  // ==========================================================================
  function isWebKitNoUrlFilter() {
    // WebKit (Safari desktop + tous les navigateurs iOS, y compris Chrome iOS
    // qui embarque WebKit) n'accepte pas backdrop-filter: url(). On détecte
    // ce cas précis : -webkit-backdrop-filter existe mais url() n'est pas
    // supporté en tant que valeur de backdrop-filter.
    try {
      const hasWebkitBackdrop =
        window.CSS && CSS.supports && CSS.supports('-webkit-backdrop-filter', 'blur(1px)');
      const urlBackdropWorks = supportsGlassFilter();
      return !!hasWebkitBackdrop && !urlBackdropWorks;
    } catch (e) {
      return false;
    }
  }

  function initWebKitGlass() {
    if (typeof window.html2canvas !== 'function') {
      // Lib absente : on abandonne proprement, la nav garde le blur CSS
      // classique déjà défini dans le stylesheet (fallback silencieux).
      console.warn('[liquid-glass] html2canvas introuvable — fallback blur CSS classique sur iOS.');
      return;
    }

    const DPR = Math.min(window.devicePixelRatio || 1, 2); // cap à 2x pour la perf mobile
    const RECAPTURE_THROTTLE_MS = 120;

    // Canvas de sortie, visible, calé pile derrière la nav.
    const outputCanvas = document.createElement('canvas');
    outputCanvas.setAttribute('aria-hidden', 'true');
    outputCanvas.style.cssText = `
      position: absolute;
      inset: 0;
      width: 100%;
      height: 100%;
      display: block;
      pointer-events: none;
      z-index: -1;
    `;
    const outCtx = outputCanvas.getContext('2d');

    // Force la nav à être positionnée pour que le canvas -1 s'y ancre bien,
    // et à masquer son propre débordement pour respecter la forme (pilule).
    const navComputed = window.getComputedStyle(nav);
    if (navComputed.position === 'static') {
      nav.style.position = 'relative';
    }
    nav.style.overflow = nav.style.overflow || 'hidden';
    nav.insertBefore(outputCanvas, nav.firstChild);

    // Sur WebKit on retire tout backdrop-filter url() résiduel : on gère la
    // réfraction nous-mêmes via le canvas, mais on garde un léger blur CSS
    // sur le reste de la nav pour les éléments qui ne sont pas capturés
    // (icônes, texte) — cohérent avec le rendu Chromium.
    nav.style.backdropFilter = 'none';
    nav.style.webkitBackdropFilter = 'none';

    let rafPending = false;
    let lastCaptureTime = 0;
    let capturing = false;
    let currentW = 0;
    let currentH = 0;

    function distortAndDraw(sourceCanvas, w, h) {
      // sourceCanvas contient le fond capturé à la taille (w*DPR, h*DPR).
      outputCanvas.width = Math.round(w * DPR);
      outputCanvas.height = Math.round(h * DPR);

      const srcCtx = sourceCanvas.getContext('2d');
      const srcData = srcCtx.getImageData(0, 0, sourceCanvas.width, sourceCanvas.height);
      const dstData = outCtx.createImageData(outputCanvas.width, outputCanvas.height);

      const sw = sourceCanvas.width;
      const sh = sourceCanvas.height;
      const halfW = sw / 2;
      const halfH = sh / 2;
      const radius = halfH;
      const spine = Math.max(0, halfW - radius);
      const bezelPx = BEZEL * DPR;
      const maxShiftPx = MAX_SHIFT * DPR;

      const src = srcData.data;
      const dst = dstData.data;

      for (let y = 0; y < sh; y++) {
        const py = y - halfH;
        for (let x = 0; x < sw; x++) {
          const px = x - halfW;
          const cx = Math.max(-spine, Math.min(spine, px));
          const dx = px - cx;
          const dy = py;
          const dist = Math.hypot(dx, dy);
          const distToEdge = radius - dist;

          let sampleX = x;
          let sampleY = y;

          if (distToEdge > 0 && distToEdge < bezelPx) {
            const t = Math.max(0, Math.min(1, 1 - distToEdge / bezelPx));
            const bulge = Math.pow(t, 1.6);
            const len = dist || 1;
            // On échantillonne "vers l'intérieur" (direction inversée) pour
            // simuler la loupe/bombé du bord du verre qui ramène la lumière
            // du centre vers le bord — même comportement visuel que la
            // branche Chromium (feDisplacementMap avec ce même signe).
            sampleX = x - (dx / len) * bulge * maxShiftPx;
            sampleY = y - (dy / len) * bulge * maxShiftPx;
          }

          sampleX = Math.max(0, Math.min(sw - 1, Math.round(sampleX)));
          sampleY = Math.max(0, Math.min(sh - 1, Math.round(sampleY)));

          const srcIdx = (sampleY * sw + sampleX) * 4;
          const dstIdx = (y * sw + x) * 4;
          dst[dstIdx] = src[srcIdx];
          dst[dstIdx + 1] = src[srcIdx + 1];
          dst[dstIdx + 2] = src[srcIdx + 2];
          dst[dstIdx + 3] = src[srcIdx + 3];
        }
      }

      outCtx.putImageData(dstData, 0, 0);

      // Léger flou + contraste/saturation en post-traitement pour matcher
      // l'esthétique de la branche Chromium (blur(2px) contrast(1.01) saturate(1.18)).
      outCtx.filter = 'blur(1.5px) saturate(1.18) contrast(1.01)';
      outCtx.drawImage(outputCanvas, 0, 0);
      outCtx.filter = 'none';
    }

    function capture() {
      if (capturing) return;
      const rect = nav.getBoundingClientRect();
      const w = Math.round(rect.width);
      const h = Math.round(rect.height);
      if (!w || !h) return;
      currentW = w;
      currentH = h;
      capturing = true;

      // On cache temporairement notre propre canvas de sortie pour ne pas se
      // capturer soi-même en boucle, puis on capture uniquement la zone du
      // document qui se trouve sous la nav.
      outputCanvas.style.visibility = 'hidden';

      window
        .html2canvas(document.body, {
          x: rect.left + window.scrollX,
          y: rect.top + window.scrollY,
          width: w,
          height: h,
          scale: DPR,
          backgroundColor: null,
          logging: false,
          ignoreElements: (el) => el === nav || nav.contains(el),
        })
        .then((sourceCanvas) => {
          distortAndDraw(sourceCanvas, w, h);
        })
        .catch((err) => {
          console.warn('[liquid-glass] capture html2canvas échouée, fallback blur CSS.', err);
          nav.style.webkitBackdropFilter = 'blur(18px) saturate(1.18)';
        })
        .finally(() => {
          outputCanvas.style.visibility = 'visible';
          capturing = false;
        });
    }

    function requestCapture(force) {
      const now = performance.now();
      if (!force && now - lastCaptureTime < RECAPTURE_THROTTLE_MS) {
        if (!rafPending) {
          rafPending = true;
          requestAnimationFrame(() => {
            rafPending = false;
            requestCapture(false);
          });
        }
        return;
      }
      lastCaptureTime = now;
      capture();
    }

    // Throttle ~120ms pendant le scroll, cf. préférence utilisateur.
    let scrollTimer = null;
    window.addEventListener(
      'scroll',
      () => {
        if (scrollTimer) return;
        scrollTimer = setTimeout(() => {
          scrollTimer = null;
          requestCapture(false);
        }, RECAPTURE_THROTTLE_MS);
      },
      { passive: true }
    );

    window.addEventListener('resize', () => requestCapture(true));

    // Capture initiale.
    requestCapture(true);
  }

  // ==========================================================================
  // Sélection de la branche selon le moteur de rendu.
  // ==========================================================================
  if (supportsGlassFilter()) {
    initChromiumGlass();
  } else if (isWebKitNoUrlFilter()) {
    initWebKitGlass();
  }
  // Autres navigateurs (ex: Firefox) : on ne touche à rien, blur CSS classique.
})();
