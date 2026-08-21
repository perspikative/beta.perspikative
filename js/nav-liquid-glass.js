// ===== Réfraction "liquid glass" réutilisable =====
// Déforme réellement le bord d'un élément (comme du vrai verre) via un
// filtre SVG feDisplacementMap appliqué en backdrop-filter, technique
// popularisée par shuding/liquid-glass (https://github.com/shuding/liquid-glass).
//
// Chromium/Edge uniquement (seuls moteurs à supporter backdrop-filter: url()).
// Sur Safari/Firefox, on ne touche à rien : l'élément garde son blur
// classique défini en CSS, sans reflet ni contour ajoutés.
//
// Générique : n'importe quel élément (pilule, cercle, rectangle arrondi...)
// peut recevoir l'effet en l'ajoutant au tableau LIQUID_GLASS_TARGETS
// tout en bas de ce fichier.
(function () {
  'use strict';

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

  // Un seul <svg> caché partagé par tous les filtres.
  let sharedSvg = null;
  function getSharedSvgDefs() {
    if (sharedSvg) return sharedSvg;
    sharedSvg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    sharedSvg.setAttribute('width', '0');
    sharedSvg.setAttribute('height', '0');
    sharedSvg.style.cssText = 'position:absolute;width:0;height:0;overflow:hidden;pointer-events:none;';
    const defs = document.createElementNS('http://www.w3.org/2000/svg', 'defs');
    sharedSvg.appendChild(defs);
    document.body.appendChild(sharedSvg);
    return sharedSvg;
  }

  // 1 pile au bord (t = 0), 0 dès qu'on s'enfonce de `bezel` px vers le centre.
  // Courbe resserrée (x^1.6) pour concentrer le "bombé" tout contre le bord
  // plutôt que de l'étaler sur tout l'élément (sinon ça ressemble à un zoom).
  function edgeFalloff(t, bezel) {
    const x = Math.max(0, Math.min(1, 1 - t / bezel));
    return Math.pow(x, 1.6);
  }

  // Retourne le vecteur perpendiculaire { dist, dx, dy } entre un point (px, py)
  // relatif au centre et le point le plus proche sur "l'épine" de la forme.
  // C'est ce vecteur (dx, dy) — et non le vecteur depuis le centre — qui donne
  // la bonne direction de déplacement le long des bords arrondis.
  // shape: 'pill'   -> pilule (bords latéraux complètement arrondis, comme la nav)
  //        'circle' -> cercle parfait (comme le bouton flottant, épine = un point)
  //        'rect'   -> rectangle à coins arrondis (radius fourni)
  function makeVectorFn(shape, w, h, radius) {
    const halfW = w / 2;
    const halfH = h / 2;

    if (shape === 'circle') {
      return function (px, py) {
        return { dist: Math.hypot(px, py), dx: px, dy: py };
      };
    }

    if (shape === 'pill') {
      const r = halfH; // pilule : rayon = moitié de la hauteur
      const spine = Math.max(0, halfW - r);
      return function (px, py) {
        const cx = Math.max(-spine, Math.min(spine, px));
        const dx = px - cx;
        const dy = py;
        return { dist: Math.hypot(dx, dy), dx, dy };
      };
    }

    // 'rect' à coins arrondis
    const r = Math.min(radius, halfW, halfH);
    const spineX = Math.max(0, halfW - r);
    const spineY = Math.max(0, halfH - r);
    return function (px, py) {
      const cx = Math.max(-spineX, Math.min(spineX, px));
      const cy = Math.max(-spineY, Math.min(spineY, py));
      const dx = px - cx;
      const dy = py - cy;
      return { dist: Math.hypot(dx, dy), dx, dy };
    };
  }

  function edgeRadius(shape, w, h, radius) {
    if (shape === 'circle') return Math.min(w, h) / 2;
    if (shape === 'pill') return h / 2;
    return Math.min(radius, w / 2, h / 2);
  }

  function LiquidGlass(el, opts) {
    this.el = el;
    this.shape = opts.shape || 'pill';
    this.bezel = opts.bezel || 13;       // largeur (px) de la zone de déformation depuis le bord
    this.maxShift = opts.maxShift || 26; // déplacement max des pixels au bord, en px
    this.blur = opts.blur != null ? opts.blur : 2; // flou (px) appliqué en plus de la réfraction
    this.rectRadius = opts.rectRadius || 0; // utilisé seulement si shape === 'rect'
    this.filterId = 'liquid-glass-' + (opts.id || Math.random().toString(36).slice(2));
    this.currentWidth = 0;
    this.currentHeight = 0;

    this._buildFilter();
    this._applyFilter = this._applyFilter.bind(this);
    this._applyFilter();

    // Recalcule quand l'élément change de taille (resize fenêtre, hover, contenu dynamique...)
    if (window.ResizeObserver) {
      this._ro = new ResizeObserver(() => this._applyFilter());
      this._ro.observe(this.el);
    } else {
      window.addEventListener('resize', () => {
        clearTimeout(this._resizeTimeout);
        this._resizeTimeout = setTimeout(this._applyFilter, 150);
      });
    }
  }

  LiquidGlass.prototype._buildFilter = function () {
    const svg = getSharedSvgDefs();
    const defs = svg.querySelector('defs');

    this.filterEl = document.createElementNS('http://www.w3.org/2000/svg', 'filter');
    this.filterEl.setAttribute('id', this.filterId);
    this.filterEl.setAttribute('filterUnits', 'userSpaceOnUse');
    this.filterEl.setAttribute('colorInterpolationFilters', 'sRGB');
    this.filterEl.setAttribute('x', '0');
    this.filterEl.setAttribute('y', '0');

    this.feImage = document.createElementNS('http://www.w3.org/2000/svg', 'feImage');
    this.feImage.setAttribute('result', 'displacement_map');
    // Sans ça, le navigateur peut recadrer/centrer l'image selon son ratio
    // au lieu de la mapper pixel pour pixel sur x/y/width/height -> décalage visuel.
    this.feImage.setAttribute('preserveAspectRatio', 'none');

    this.feDisplacementMap = document.createElementNS('http://www.w3.org/2000/svg', 'feDisplacementMap');
    this.feDisplacementMap.setAttribute('in', 'SourceGraphic');
    this.feDisplacementMap.setAttribute('in2', 'displacement_map');
    this.feDisplacementMap.setAttribute('xChannelSelector', 'R');
    this.feDisplacementMap.setAttribute('yChannelSelector', 'G');

    this.filterEl.appendChild(this.feImage);
    this.filterEl.appendChild(this.feDisplacementMap);
    defs.appendChild(this.filterEl);

    this.canvas = document.createElement('canvas');
    this.ctx = this.canvas.getContext('2d');
  };

  LiquidGlass.prototype._buildDisplacementMap = function (w, h) {
    const pad = Math.ceil(this.maxShift) + 2; // marge pour ne pas échantillonner hors zone capturée
    const fullW = w + pad * 2;
    const fullH = h + pad * 2;

    this.canvas.width = fullW;
    this.canvas.height = fullH;

    const halfW = w / 2;
    const halfH = h / 2;
    const vectorFn = makeVectorFn(this.shape, w, h, this.rectRadius);
    const edgeR = edgeRadius(this.shape, w, h, this.rectRadius);
    const bezel = this.bezel;
    const maxShiftCfg = this.maxShift;

    const shiftsX = new Float32Array(fullW * fullH);
    const shiftsY = new Float32Array(fullW * fullH);
    let maxShift = 0.0001;

    for (let y = 0; y < h; y++) {
      const py = y - halfH;
      for (let x = 0; x < w; x++) {
        const px = x - halfW;
        const v = vectorFn(px, py);
        const dist = v.dist;
        const distToEdge = edgeR - dist; // > 0 à l'intérieur de la forme

        let bulge = 0;
        if (distToEdge > 0 && distToEdge < bezel) {
          bulge = edgeFalloff(distToEdge, bezel);
        }

        const len = dist || 1;
        const shiftX = bulge > 0 ? (v.dx / len) * bulge * maxShiftCfg : 0;
        const shiftY = bulge > 0 ? (v.dy / len) * bulge * maxShiftCfg : 0;

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

    this.ctx.putImageData(new ImageData(data, fullW, fullH), 0, 0);

    this.feImage.setAttributeNS('http://www.w3.org/1999/xlink', 'href', this.canvas.toDataURL());
    this.feImage.setAttribute('x', String(-pad));
    this.feImage.setAttribute('y', String(-pad));
    this.feImage.setAttribute('width', fullW);
    this.feImage.setAttribute('height', fullH);
    this.feDisplacementMap.setAttribute('scale', maxShift.toString());
    this.filterEl.setAttribute('x', String(-pad));
    this.filterEl.setAttribute('y', String(-pad));
    this.filterEl.setAttribute('width', fullW);
    this.filterEl.setAttribute('height', fullH);
  };

  LiquidGlass.prototype._applyFilter = function () {
    const rect = this.el.getBoundingClientRect();
    const w = Math.round(rect.width);
    const h = Math.round(rect.height);
    if (!w || !h || (w === this.currentWidth && h === this.currentHeight)) return;
    this.currentWidth = w;
    this.currentHeight = h;

    this._buildDisplacementMap(w, h);

    const value = `url(#${this.filterId}) blur(${this.blur}px) contrast(1.01) saturate(1.1)`;
    this.el.style.backdropFilter = value;
    this.el.style.webkitBackdropFilter = value;
  };

  // Point d'entrée public, réutilisable pour n'importe quel élément.
  //   applyLiquidGlass('.mon-element', { shape: 'circle' });
  // Retourne l'instance (ou null si l'élément n'existe pas / pas de support),
  // au cas où tu voudrais la garder pour du debug.
  function applyLiquidGlass(selector, opts) {
    opts = opts || {};
    const el = typeof selector === 'string' ? document.querySelector(selector) : selector;
    if (!el) return null;
    const autoId = (typeof selector === 'string' ? selector : 'el').replace(/[^a-zA-Z0-9]/g, '-');
    return new LiquidGlass(el, Object.assign({ id: autoId }, opts));
  }

  window.applyLiquidGlass = applyLiquidGlass;

  // ===== Liste des éléments à traiter =====
  // Ajoute simplement une ligne ici pour appliquer l'effet à un nouvel élément.
  // shape: 'pill' (barre type mobile-nav), 'circle' (bouton rond), 'rect' (coins arrondis, avec rectRadius)
  const LIQUID_GLASS_TARGETS = [
    { selector: '.mobile-nav', shape: 'pill', bezel: 30, maxShift: 12 },
    { selector: '.search-float-btn', shape: 'circle', bezel: 30, maxShift: 3, blur: 4 },
    { selector: '.tab-indicator', shape: 'pill', bezel: 30, maxShift: 3, blur: 4 },
  ];

  LIQUID_GLASS_TARGETS.forEach(function (target) {
    const opts = {};
    for (const k in target) {
      if (k !== 'selector') opts[k] = target[k];
    }
    applyLiquidGlass(target.selector, opts);
  });
})();
