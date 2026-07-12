// ===== Réfraction "liquid glass" sur la mobile-nav =====
// Déforme réellement le bord de la barre (comme du vrai verre) via un
// filtre SVG feDisplacementMap appliqué en backdrop-filter, technique
// popularisée par shuding/liquid-glass (https://github.com/shuding/liquid-glass).
//
// Chromium/Edge uniquement (seuls moteurs à supporter backdrop-filter: url()).
// Sur Safari/Firefox, on ne touche à rien : la nav garde le blur classique
// défini en CSS, sans reflet ni contour ajoutés.
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

  if (!supportsGlassFilter()) return;

  const FILTER_ID = 'nav-glass-refraction';
  const BEZEL = 13;      // largeur (px) de la zone de déformation depuis le bord — volontairement fine
  const MAX_SHIFT = 36;  // déplacement max des pixels au bord, en px — le vrai "bombé" du verre

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

  // 1 pile au bord (t = 0), 0 dès qu'on s'enfonce de BEZEL px vers le centre.
  // Courbe resserrée (x^1.6) pour concentrer le "bombé" tout contre le bord
  // plutôt que de l'étaler sur toute la barre (sinon ça ressemble à un zoom).
  function edgeFalloff(t) {
    const x = Math.max(0, Math.min(1, 1 - t / BEZEL));
    return Math.pow(x, 1.6);
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

    const value = `url(#${FILTER_ID}) blur(2px) contrast(1) saturate(1.18)`;
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
})();
