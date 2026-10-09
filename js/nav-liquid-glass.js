// ===== Effet "liquid glass" réutilisable (v3 : Chromium + Safari/Firefox) =====
//
// Deux modes, choisis automatiquement :
//
//  1. Mode "svg" (Chromium / Edge / Chrome Android)
//     Vraie réfraction : filtre SVG feDisplacementMap appliqué en
//     backdrop-filter (technique de shuding/liquid-glass), avec profil de verre
//     bombé + loi de Snell, dispersion chromatique légère et reflets.
//
//  2. Mode "css" (Safari macOS/iOS, tous les navigateurs iOS, Firefox)
//     Ces moteurs ne savent pas déformer ce qu'il y a derrière un élément
//     (backdrop-filter: url() n'existe pas). On simule donc le rendu avec :
//       - un blur + saturation classiques en backdrop-filter,
//       - une couche superposée générée en canvas : reflet spéculaire de
//         contour (même formule que le mode svg), halo intérieur, voile de
//         lumière, léger ombrage de la tranche et fin liseré chromatique.
//     Pas de vraie déformation du fond, mais le verre reste très proche.
//
// Générique : n'importe quel élément (pilule, cercle, rectangle arrondi...)
// peut recevoir l'effet en l'ajoutant au tableau LIQUID_GLASS_TARGETS
// tout en bas de ce fichier.
(function () {
  'use strict';

  // ---------- Détection ----------
  // Safari accepte parfois `backdrop-filter: url(#a)` dans CSS.supports()
  // sans jamais l'afficher : on ne se fie donc pas à ce test seul et on
  // exige en plus un moteur Chromium.
  function isChromiumEngine() {
    try {
      const uad = navigator.userAgentData;
      if (uad && uad.brands && uad.brands.length) {
        return uad.brands.some(function (b) { return /Chromium/i.test(b.brand); });
      }
      const ua = navigator.userAgent || '';
      return /Chrome|Chromium|Edg\//.test(ua) && !/CriOS|FxiOS|EdgiOS|OPiOS/.test(ua);
    } catch (e) {
      return false;
    }
  }

  function cssSupports(prop, value) {
    try {
      return !!(window.CSS && CSS.supports && CSS.supports(prop, value));
    } catch (e) {
      return false;
    }
  }

  const SVG_MODE =
    isChromiumEngine() &&
    (cssSupports('backdrop-filter', 'url(#a)') || cssSupports('-webkit-backdrop-filter', 'url(#a)'));

  const HAS_BACKDROP =
    cssSupports('backdrop-filter', 'blur(1px)') || cssSupports('-webkit-backdrop-filter', 'blur(1px)');

  const SVG_NS = 'http://www.w3.org/2000/svg';
  const XLINK_NS = 'http://www.w3.org/1999/xlink';

  function svgEl(name, attrs) {
    const el = document.createElementNS(SVG_NS, name);
    if (attrs) for (const k in attrs) el.setAttribute(k, attrs[k]);
    return el;
  }

  // Un seul <svg> caché partagé par tous les filtres (mode svg uniquement).
  let sharedSvg = null;
  function getSharedSvgDefs() {
    if (sharedSvg) return sharedSvg;
    sharedSvg = svgEl('svg', { width: '0', height: '0', 'aria-hidden': 'true' });
    sharedSvg.style.cssText = 'position:absolute;width:0;height:0;overflow:hidden;pointer-events:none;';
    sharedSvg.appendChild(svgEl('defs'));
    document.body.appendChild(sharedSvg);
    return sharedSvg;
  }

  // ---------- Profil de réfraction (mode svg) ----------
  // Surface convexe "squircle" : h(s) = (1 - (1 - s)^4)^(1/4), s ∈ [0,1]
  // (s = 0 au bord de l'élément, s = 1 quand on s'est enfoncé de `bezel` px).
  // La pente de cette surface donne l'angle d'incidence ; la loi de Snell
  // donne l'angle réfracté ; l'écart entre les deux = déplacement du pixel.
  // Retourne un tableau normalisé 0..1 (1 pile au bord, 0 au bout du bezel).
  const PROFILE_STEPS = 256;
  function buildRefractionProfile(ior, curve) {
    const out = new Float32Array(PROFILE_STEPS + 1);
    const SLOPE_CAP = 3; // évite l'explosion de la pente exactement sur le bord
    let max = 0;
    for (let i = 0; i <= PROFILE_STEPS; i++) {
      const s = Math.max(i / PROFILE_STEPS, 0.002);
      const omt = 1 - s;
      const base = 1 - Math.pow(omt, 4);
      let slope = Math.pow(omt, 3) * Math.pow(base, -0.75);
      slope = Math.min(slope, SLOPE_CAP);
      const theta1 = Math.atan(slope);
      const theta2 = Math.asin(Math.sin(theta1) / ior);
      const disp = Math.max(0, slope - Math.tan(theta2));
      out[i] = disp;
      if (disp > max) max = disp;
    }
    for (let i = 0; i <= PROFILE_STEPS; i++) {
      // `curve` < 1 étale un peu la déformation vers l'intérieur
      out[i] = Math.pow(out[i] / (max || 1), curve);
    }
    return out;
  }

  function sampleProfile(profile, s) {
    if (s <= 0) return profile[0];
    if (s >= 1) return 0;
    const f = s * PROFILE_STEPS;
    const i = Math.floor(f);
    const t = f - i;
    return profile[i] * (1 - t) + profile[i + 1] * t;
  }

  function smoothstep(a, b, x) {
    const t = Math.max(0, Math.min(1, (x - a) / (b - a)));
    return t * t * (3 - 2 * t);
  }

  // ---------- Géométrie ----------
  // Retourne le vecteur { dist, dx, dy } entre un point (px, py) relatif au
  // centre et le point le plus proche sur "l'épine" de la forme.
  // (dx, dy) donne la direction (normale) vers l'extérieur le long des bords.
  // shape: 'pill'   -> pilule (bords latéraux complètement arrondis)
  //        'circle' -> cercle parfait (épine = un point)
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
      const r = halfH;
      const spine = Math.max(0, halfW - r);
      return function (px, py) {
        const cx = Math.max(-spine, Math.min(spine, px));
        const dx = px - cx;
        const dy = py;
        return { dist: Math.hypot(dx, dy), dx, dy };
      };
    }

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

  // ---------- Illumination (partagée par les deux modes) ----------
  // Alpha (0..1) du blanc à superposer au pixel situé à `d` px du bord,
  // dont la normale sortante est (nx, ny).
  function illumination(nx, ny, d, P) {
    // Fort côté lumière, rebond plus faible à l'opposé
    const cosL = nx * P.lx + ny * P.ly;
    const ang = cosL >= 0 ? Math.pow(cosL, 1.3) : Math.pow(-cosL, 1.3) * 0.55;

    const sharp = 1 - smoothstep(0, P.specW, d); // liseré net
    const soft = 1 - smoothstep(0, P.glowW, d);  // halo doux
    let a = ang * (sharp * P.spec + soft * soft * P.glow);
    // léger voile uniforme (le "verre" reçoit un peu de lumière partout)
    a += P.sheen * (0.6 + 0.4 * soft);
    // adoucit le tout premier pixel pour éviter l'escalier sur le contour
    a *= smoothstep(0, 1, d);
    return a;
  }

  // Composite "over" en alpha prémultiplié dans acc = [r, g, b, a]
  function blend(acc, r, g, b, a) {
    if (a <= 0) return;
    const k = 1 - a;
    acc[0] = r * a + acc[0] * k;
    acc[1] = g * a + acc[1] * k;
    acc[2] = b * a + acc[2] * k;
    acc[3] = a + acc[3] * k;
  }

  function bump(d, center, halfWidth) {
    return Math.max(0, 1 - Math.abs(d - center) / halfWidth);
  }

  // ---------- Classe principale ----------
  function LiquidGlass(el, opts) {
    this.el = el;
    this.mode = SVG_MODE ? 'svg' : 'css';
    this.shape = opts.shape || 'pill';
    this.bezel = opts.bezel || 22;          // largeur (px) de la zone de déformation depuis le bord
    this.maxShift = opts.maxShift || 14;    // déplacement max des pixels au bord, en px (mode svg)
    this.blur = opts.blur != null ? opts.blur : 1.5; // flou (px) avant la réfraction (mode svg)
    this.saturate = opts.saturate != null ? opts.saturate : 1.15;
    this.brightness = opts.brightness != null ? opts.brightness : 1.04;
    this.rectRadius = opts.rectRadius || 0; // utilisé seulement si shape === 'rect'
    this.ior = opts.ior || 1.5;             // indice de réfraction du "verre"
    this.curve = opts.curve != null ? opts.curve : 0.55; // <1 = déformation plus étalée
    this.dispersion = opts.dispersion != null ? opts.dispersion : 0.12; // 0 = aucune, 0.12 = très léger
    this.specular = opts.specular != null ? opts.specular : 0.55;       // intensité du reflet de contour (0..1)
    this.specularWidth = opts.specularWidth || 1.8;                     // épaisseur (px) du reflet net
    this.glow = opts.glow != null ? opts.glow : 0.16;                   // halo intérieur doux (0..1)
    this.sheen = opts.sheen != null ? opts.sheen : 0.035;               // voile de lumière sur toute la surface
    this.lightAngle = opts.lightAngle != null ? opts.lightAngle : -135; // degrés, -135 = haut-gauche

    // Réglages propres au mode css (Safari / Firefox)
    this.fallbackBlur = opts.fallbackBlur != null ? opts.fallbackBlur : 14;
    this.fallbackSaturate = opts.fallbackSaturate != null ? opts.fallbackSaturate : 1.6;
    this.fallbackBrightness = opts.fallbackBrightness != null ? opts.fallbackBrightness : 1.05;
    this.edgeShade = opts.edgeShade != null ? opts.edgeShade : 0.10;    // ombrage de la tranche (0..0.3)

    this.filterId = 'liquid-glass-' + (opts.id || Math.random().toString(36).slice(2));
    this.currentWidth = 0;
    this.currentHeight = 0;
    this.profile = this.mode === 'svg' ? buildRefractionProfile(this.ior, this.curve) : null;

    if (this.mode === 'svg') {
      this._buildFilter();
    } else {
      this._buildFallbackLayer();
    }

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

  // Paramètres d'illumination communs aux deux modes, pour une forme donnée.
  LiquidGlass.prototype._lightParams = function (bezel) {
    const la = (this.lightAngle * Math.PI) / 180;
    return {
      lx: Math.cos(la),
      ly: Math.sin(la),
      specW: this.specularWidth,
      glowW: Math.max(bezel * 0.7, this.specularWidth * 3),
      spec: this.specular,
      glow: this.glow,
      sheen: this.sheen,
    };
  };

  // ======================= MODE SVG (Chromium) =======================

  LiquidGlass.prototype._buildFilter = function () {
    const svg = getSharedSvgDefs();
    const defs = svg.querySelector('defs');

    const filter = svgEl('filter', {
      id: this.filterId,
      filterUnits: 'userSpaceOnUse',
      // Attention : l'attribut SVG s'écrit avec des tirets (sinon ignoré)
      'color-interpolation-filters': 'sRGB',
      x: '0',
      y: '0',
    });
    this.filterEl = filter;

    // Cartes (déplacement + reflets), mappées pixel pour pixel
    this.feDisp = svgEl('feImage', { result: 'dispMap', preserveAspectRatio: 'none' });
    this.feSpec = svgEl('feImage', { result: 'specMap', preserveAspectRatio: 'none' });
    filter.appendChild(this.feDisp);
    filter.appendChild(this.feSpec);

    // Un déplacement par canal -> dispersion chromatique
    const d = this.dispersion;
    const channels = [
      { id: 'r', factor: 1, matrix: '1 0 0 0 0  0 0 0 0 0  0 0 0 0 0  0 0 0 1 0' },
      { id: 'g', factor: 1 - d, matrix: '0 0 0 0 0  0 1 0 0 0  0 0 0 0 0  0 0 0 1 0' },
      { id: 'b', factor: 1 - d * 2, matrix: '0 0 0 0 0  0 0 0 0 0  0 0 1 0 0  0 0 0 1 0' },
    ];
    this.feDisplacements = [];
    channels.forEach((c) => {
      const disp = svgEl('feDisplacementMap', {
        in: 'SourceGraphic',
        in2: 'dispMap',
        xChannelSelector: 'R',
        yChannelSelector: 'G',
        result: 'disp_' + c.id,
      });
      disp.__factor = c.factor;
      this.feDisplacements.push(disp);
      filter.appendChild(disp);
      filter.appendChild(svgEl('feColorMatrix', {
        in: 'disp_' + c.id,
        type: 'matrix',
        values: c.matrix,
        result: 'chan_' + c.id,
      }));
    });

    // Recomposition des 3 canaux (screen = addition car canaux disjoints)
    filter.appendChild(svgEl('feBlend', { in: 'chan_r', in2: 'chan_g', mode: 'screen', result: 'rg' }));
    filter.appendChild(svgEl('feBlend', { in: 'rg', in2: 'chan_b', mode: 'screen', result: 'rgb' }));
    // Reflets / illumination par-dessus
    filter.appendChild(svgEl('feBlend', { in: 'specMap', in2: 'rgb', mode: 'normal' }));

    defs.appendChild(filter);

    this.canvas = document.createElement('canvas');
    this.ctx = this.canvas.getContext('2d');
    this.specCanvas = document.createElement('canvas');
    this.specCtx = this.specCanvas.getContext('2d');
  };

  LiquidGlass.prototype._buildMaps = function (w, h) {
    const pad = Math.ceil(this.maxShift) + 2; // marge pour ne pas échantillonner hors zone capturée
    const fullW = w + pad * 2;
    const fullH = h + pad * 2;

    this.canvas.width = this.specCanvas.width = fullW;
    this.canvas.height = this.specCanvas.height = fullH;

    const halfW = w / 2;
    const halfH = h / 2;
    const vectorFn = makeVectorFn(this.shape, w, h, this.rectRadius);
    const edgeR = edgeRadius(this.shape, w, h, this.rectRadius);
    const bezel = Math.min(this.bezel, edgeR);
    const maxShift = this.maxShift;
    const profile = this.profile;
    const P = this._lightParams(bezel);

    // Neutre (pas de déplacement) = 128 sur R et G, partout (y compris la marge)
    const dispData = new Uint8ClampedArray(fullW * fullH * 4);
    for (let i = 0; i < fullW * fullH; i++) {
      dispData[i * 4] = 128;
      dispData[i * 4 + 1] = 128;
      dispData[i * 4 + 2] = 128;
      dispData[i * 4 + 3] = 255;
    }
    const specData = new Uint8ClampedArray(fullW * fullH * 4); // RGBA tout à 0 = transparent

    for (let y = 0; y < h; y++) {
      const py = y - halfH + 0.5;
      for (let x = 0; x < w; x++) {
        const px = x - halfW + 0.5;
        const v = vectorFn(px, py);
        const distToEdge = edgeR - v.dist; // > 0 à l'intérieur de la forme
        if (distToEdge <= 0) continue;

        const len = v.dist || 1;
        const nx = v.dx / len; // normale sortante
        const ny = v.dy / len;
        const i = ((y + pad) * fullW + (x + pad)) * 4;

        // --- Réfraction ---
        if (distToEdge < bezel) {
          const k = sampleProfile(profile, distToEdge / bezel); // 0..1
          // le pixel affiché au bord vient de plus loin vers l'extérieur
          dispData[i] = Math.round((nx * k / 2 + 0.5) * 255);
          dispData[i + 1] = Math.round((ny * k / 2 + 0.5) * 255);
        }

        // --- Illumination ---
        const a = illumination(nx, ny, distToEdge, P);
        if (a > 0) {
          specData[i] = 255;
          specData[i + 1] = 255;
          specData[i + 2] = 255;
          specData[i + 3] = Math.max(0, Math.min(255, Math.round(a * 255)));
        }
      }
    }

    this.ctx.putImageData(new ImageData(dispData, fullW, fullH), 0, 0);
    this.specCtx.putImageData(new ImageData(specData, fullW, fullH), 0, 0);

    const dispUrl = this.canvas.toDataURL();
    const specUrl = this.specCanvas.toDataURL();
    [[this.feDisp, dispUrl], [this.feSpec, specUrl]].forEach(([fe, url]) => {
      fe.setAttributeNS(XLINK_NS, 'href', url);
      fe.setAttribute('href', url);
      fe.setAttribute('x', String(-pad));
      fe.setAttribute('y', String(-pad));
      fe.setAttribute('width', fullW);
      fe.setAttribute('height', fullH);
    });

    // scale = 2 × déplacement max (la carte encode -1..1 sur 0..255)
    this.feDisplacements.forEach((fe) => {
      fe.setAttribute('scale', String(maxShift * 2 * fe.__factor));
    });

    this.filterEl.setAttribute('x', String(-pad));
    this.filterEl.setAttribute('y', String(-pad));
    this.filterEl.setAttribute('width', fullW);
    this.filterEl.setAttribute('height', fullH);
  };

  // ======================= MODE CSS (Safari / Firefox) =======================

  LiquidGlass.prototype._buildFallbackLayer = function () {
    const el = this.el;
    const cs = getComputedStyle(el);

    // Le calque est positionné par rapport à l'élément
    if (cs.position === 'static') el.style.position = 'relative';
    // Crée un contexte d'empilement : le calque (z-index:-1) passe au-dessus
    // du fond de l'élément mais reste SOUS son contenu (icônes, textes...).
    el.style.isolation = 'isolate';

    // Blur + saturation classiques, seulement si le CSS n'en définit pas déjà un.
    if (HAS_BACKDROP) {
      const existing =
        cs.getPropertyValue('-webkit-backdrop-filter') || cs.getPropertyValue('backdrop-filter');
      if (!existing || existing === 'none') {
        const value =
          `blur(${this.fallbackBlur}px) saturate(${this.fallbackSaturate}) ` +
          `brightness(${this.fallbackBrightness})`;
        el.style.webkitBackdropFilter = value;
        el.style.backdropFilter = value;
      }
    }

    // Si l'élément a une bordure, le calque doit recouvrir la boîte complète.
    const bt = parseFloat(cs.borderTopWidth) || 0;
    const br = parseFloat(cs.borderRightWidth) || 0;
    const bb = parseFloat(cs.borderBottomWidth) || 0;
    const bl = parseFloat(cs.borderLeftWidth) || 0;

    const layer = document.createElement('div');
    layer.className = 'liquid-glass-layer';
    layer.setAttribute('aria-hidden', 'true');
    layer.style.cssText =
      'position:absolute;pointer-events:none;z-index:-1;border-radius:inherit;' +
      `top:${-bt}px;right:${-br}px;bottom:${-bb}px;left:${-bl}px;` +
      'background-repeat:no-repeat;background-position:center;background-size:100% 100%;';
    el.insertBefore(layer, el.firstChild);
    this.layer = layer;

    this.canvas = document.createElement('canvas');
    this.ctx = this.canvas.getContext('2d');
  };

  LiquidGlass.prototype._buildFallbackImage = function (w, h) {
    // Résolution écran réelle (Retina) pour que le liseré reste fin et net.
    const s = Math.min(window.devicePixelRatio || 1, 3);
    const cw = Math.max(1, Math.round(w * s));
    const ch = Math.max(1, Math.round(h * s));
    this.canvas.width = cw;
    this.canvas.height = ch;

    const halfW = w / 2;
    const halfH = h / 2;
    const vectorFn = makeVectorFn(this.shape, w, h, this.rectRadius);
    const edgeR = edgeRadius(this.shape, w, h, this.rectRadius);
    const bezel = Math.min(this.bezel, edgeR);
    const P = this._lightParams(bezel);
    const shadeAmt = this.edgeShade;
    const fringeAmt = this.dispersion * 1.5; // 0.12 -> ~0.18 d'alpha max
    const data = new Uint8ClampedArray(cw * ch * 4);
    const acc = new Float32Array(4);

    for (let y = 0; y < ch; y++) {
      const py = (y + 0.5) / s - halfH;
      for (let x = 0; x < cw; x++) {
        const px = (x + 0.5) / s - halfW;
        const v = vectorFn(px, py);
        const d = edgeR - v.dist; // px CSS depuis le bord, > 0 à l'intérieur
        if (d <= 0) continue;

        const len = v.dist || 1;
        const nx = v.dx / len;
        const ny = v.dy / len;
        const cosL = nx * P.lx + ny * P.ly;

        acc[0] = acc[1] = acc[2] = acc[3] = 0;

        // 1) Ombrage de la tranche : le côté opposé à la lumière s'assombrit
        //    très légèrement, comme l'épaisseur d'un verre vue de biais.
        if (shadeAmt > 0) {
          const ring = smoothstep(P.specW * 0.5, bezel * 0.5, d) * (1 - smoothstep(bezel * 0.5, bezel, d));
          const far = 0.5 - 0.5 * cosL; // 1 côté opposé à la lumière
          blend(acc, 0, 0, 0, shadeAmt * ring * (0.35 + 0.65 * far));
        }

        // 2) Liseré chromatique : rouge tout au bord, bleu juste en dessous.
        if (fringeAmt > 0) {
          const ang = 0.6 + 0.4 * Math.abs(cosL);
          blend(acc, 255, 70, 60, fringeAmt * ang * bump(d, 1.2, 1.1));
          blend(acc, 60, 140, 255, fringeAmt * ang * bump(d, 2.6, 1.1));
        }

        // 3) Reflets + halo + voile (même formule que le mode svg)
        blend(acc, 255, 255, 255, illumination(nx, ny, d, P));

        const a = acc[3];
        if (a > 0) {
          const i = (y * cw + x) * 4;
          data[i] = Math.min(255, (acc[0] / a) + 0.5);
          data[i + 1] = Math.min(255, (acc[1] / a) + 0.5);
          data[i + 2] = Math.min(255, (acc[2] / a) + 0.5);
          data[i + 3] = Math.min(255, Math.round(a * 255));
        }
      }
    }

    this.ctx.putImageData(new ImageData(data, cw, ch), 0, 0);
    this.layer.style.backgroundImage = `url(${this.canvas.toDataURL()})`;
  };

  // ======================= Commun =======================

  LiquidGlass.prototype._applyFilter = function () {
    const rect = this.el.getBoundingClientRect();
    const w = Math.round(rect.width);
    const h = Math.round(rect.height);
    if (!w || !h || (w === this.currentWidth && h === this.currentHeight)) return;
    this.currentWidth = w;
    this.currentHeight = h;

    if (this.mode === 'css') {
      this._buildFallbackImage(w, h);
      return;
    }

    this._buildMaps(w, h);

    // Le flou passe AVANT le filtre SVG pour que les reflets restent nets.
    const value =
      `blur(${this.blur}px) url(#${this.filterId}) ` +
      `saturate(${this.saturate}) brightness(${this.brightness})`;
    this.el.style.backdropFilter = value;
    this.el.style.webkitBackdropFilter = value;
  };

  // Point d'entrée public, réutilisable pour n'importe quel élément.
  //   applyLiquidGlass('.mon-element', { shape: 'circle' });
  // Retourne l'instance (ou null si l'élément n'existe pas).
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
  //
  // Réglages utiles (tous optionnels) :
  //   bezel          largeur de la zone réfractée / éclairée (px)
  //   maxShift       force de la réfraction au bord (px) — Chromium seulement
  //   dispersion     liseré coloré (0 = off, 0.12 = très léger, 0.3 = marqué)
  //   specular       intensité du reflet de contour (0..1)
  //   glow           halo lumineux intérieur (0..1)
  //   sheen          voile de lumière sur toute la surface (0..0.1)
  //   lightAngle     direction de la lumière en degrés (-135 = haut-gauche)
  //   fallbackBlur / fallbackSaturate / fallbackBrightness
  //                  blur du verre sur Safari/Firefox (ignorés si ton CSS
  //                  définit déjà un backdrop-filter sur l'élément)
  //   edgeShade      ombrage de la tranche sur Safari/Firefox (0..0.3)
  const LIQUID_GLASS_TARGETS = [
    { selector: '.mobile-nav', shape: 'pill', bezel: 28, maxShift: 16, blur: 1.5, saturate: 1.2 },
    { selector: '.search-float-btn', shape: 'circle', bezel: 16, maxShift: 7, blur: 3, specularWidth: 1.5 },
  ];

  function init() {
    LIQUID_GLASS_TARGETS.forEach(function (target) {
      const opts = {};
      for (const k in target) {
        if (k !== 'selector') opts[k] = target[k];
      }
      applyLiquidGlass(target.selector, opts);
    });
  }

  // Le <body> doit exister (mode svg) et les éléments aussi.
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
