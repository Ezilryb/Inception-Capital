/**
 * ============================================================
 *  Renderer.js — Minecraft 1.0 Recreation
 * ============================================================
 *  Gère la scène Three.js : caméra, lumières, fog, post-process
 *  léger, et le cycle de vie des ChunkMesh.
 *
 *  Responsabilités :
 *    • Initialisation WebGL / scène Three.js
 *    • Caméra FPS (PerspectiveCamera + pointerlockcontrols)
 *    • Brouillard linéaire (fog de distance comme MC 1.0)
 *    • Lumière ambiante + directionnel soleil
 *    • Ajout / suppression de ChunkMesh dans la scène
 *    • Boucle de rendu (appelée par Engine.js)
 *    • Sélection de bloc (raycasting, bloc ciblé en surbrillance)
 *
 *  Dépendances externes : Three.js (importé via CDN/ESM)
 *  Aucune dépendance vers les systèmes gameplay.
 * ============================================================
 */

'use strict';

import * as THREE from 'three';

// ─────────────────────────────────────────────────────────────
//  Constantes de configuration
// ─────────────────────────────────────────────────────────────

/** FOV vertical en degrés (MC 1.0 = 70° normal, 110° quake-pro) */
const DEFAULT_FOV        = 70;
const NEAR_PLANE         = 0.05;   // ~5 cm — évite le z-fighting des blocs proches
const FAR_PLANE          = 512;    // 32 chunks × 16 blocs — légèrement au-delà du view distance max
const FOG_NEAR_FACTOR    = 0.4;    // fog commence à 40 % de la distance de rendu
const FOG_FAR_FACTOR     = 0.9;    // fog opaque à 90 %

/** Couleur ciel overworld — bleu MC classique (#789CF0 approximé) */
const SKY_COLOR_OVERWORLD = 0x789CF0;
/** Couleur ciel Nether */
const SKY_COLOR_NETHER    = 0x0D0D0D;
/** Couleur ciel The End */
const SKY_COLOR_END       = 0x0A0A14;

/** Épaisseur du wireframe de sélection (en unités Three.js) */
const SELECTION_LINE_WIDTH = 2;

// ─────────────────────────────────────────────────────────────
//  Renderer
// ─────────────────────────────────────────────────────────────
export class Renderer {
  /**
   * @param {Object}       opts
   * @param {HTMLElement}  opts.container   Élément DOM parent du canvas
   * @param {number}      [opts.viewDistance=8]   En chunks
   * @param {number}      [opts.fov=70]
   * @param {boolean}     [opts.antialias=false]  Off par défaut (perf, style MC)
   */
  constructor({ container, viewDistance = 8, fov = DEFAULT_FOV, antialias = false }) {
    this._container    = container;
    this._viewDistance = viewDistance;

    // ── WebGLRenderer ────────────────────────────────────────
    this.renderer = new THREE.WebGLRenderer({
      antialias,
      powerPreference: 'high-performance',
    });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.shadowMap.enabled  = false; // MC 1.0 n'a pas de shadow mapping temps-réel
    this.renderer.outputColorSpace   = THREE.SRGBColorSpace;
    this.renderer.setSize(container.clientWidth, container.clientHeight);
    container.appendChild(this.renderer.domElement);

    // ── Scène ────────────────────────────────────────────────
    this.scene = new THREE.Scene();
    this._currentDimension = 'overworld';
    this._applyDimensionSky('overworld');

    // ── Caméra ───────────────────────────────────────────────
    const aspect = container.clientWidth / container.clientHeight;
    this.camera = new THREE.PerspectiveCamera(fov, aspect, NEAR_PLANE, FAR_PLANE);
    this.camera.position.set(0, 80, 0); // hauteur de spawn par défaut

    // ── Lumières ─────────────────────────────────────────────
    this._setupLights();

    // ── Brouillard ───────────────────────────────────────────
    this._updateFog();

    // ── Sélection de bloc ────────────────────────────────────
    this._selectionMesh = this._buildSelectionBox();
    this.scene.add(this._selectionMesh);
    this._selectionMesh.visible = false;

    // ── Registre des chunk meshes ─────────────────────────────
    /** @type {Map<string, THREE.Mesh[]>}  clé = "cx,cz" */
    this._chunkMeshes = new Map();

    // ── Raycaster pour la sélection ──────────────────────────
    this._raycaster = new THREE.Raycaster();
    this._raycaster.far = 5; // portée de casse/placement : 5 blocs (MC 1.0)

    // ── Resize observer ──────────────────────────────────────
    this._resizeObserver = new ResizeObserver(() => this._onResize());
    this._resizeObserver.observe(container);
  }

  // ─────────────────────────────────────────────────────────
  //  Initialisation interne
  // ─────────────────────────────────────────────────────────

  /**
   * Configure les lumières de la scène.
   * MC 1.0 utilise un modèle flat + ambient.  Ici on ajoute un
   * DirectionalLight doux pour l'ombrage de face (AO-like), ce qui
   * reproduit l'assombrissement des faces latérales vs top-face.
   */
  _setupLights() {
    // Lumière ambiante : teinte les faces du bas / intérieures
    this._ambientLight = new THREE.AmbientLight(0xFFFFFF, 0.6);
    this.scene.add(this._ambientLight);

    // Soleil (overworld) — angle ~45° pour couvrir top/côtés
    this._sunLight = new THREE.DirectionalLight(0xFFFFFF, 0.8);
    this._sunLight.position.set(1.5, 3, 1.5);
    this._sunLight.castShadow = false;
    this.scene.add(this._sunLight);

    // Lumière Nether — rouge diffuse
    this._netherLight = new THREE.AmbientLight(0xFF4400, 0.4);
    this._netherLight.visible = false;
    this.scene.add(this._netherLight);
  }

  /**
   * Construit le wireframe de sélection de bloc (carré légèrement
   * agrandi autour du bloc ciblé, comme MC 1.0).
   * @returns {THREE.LineSegments}
   */
  _buildSelectionBox() {
    // Boîte légèrement plus grande que 1×1×1 (offset = 0.002)
    const offset = 0.002;
    const s = 1 + offset * 2;
    const geo = new THREE.EdgesGeometry(new THREE.BoxGeometry(s, s, s));
    const mat = new THREE.LineBasicMaterial({
      color: 0x000000,
      linewidth: SELECTION_LINE_WIDTH,
      depthTest: true,
    });
    return new THREE.LineSegments(geo, mat);
  }

  // ─────────────────────────────────────────────────────────
  //  Gestion des dimensions
  // ─────────────────────────────────────────────────────────

  /**
   * Applique les paramètres visuels (ciel, fog, lumières) d'une dimension.
   * @param {'overworld'|'nether'|'end'} dimension
   */
  _applyDimensionSky(dimension) {
    let skyColor;
    switch (dimension) {
      case 'nether': skyColor = SKY_COLOR_NETHER; break;
      case 'end':    skyColor = SKY_COLOR_END;    break;
      default:       skyColor = SKY_COLOR_OVERWORLD;
    }
    this.scene.background = new THREE.Color(skyColor);
    this._currentDimension = dimension;
    this._updateFog();

    // Lumières
    if (this._sunLight) {
      this._sunLight.visible    = (dimension === 'overworld');
    }
    if (this._ambientLight) {
      this._ambientLight.intensity = (dimension === 'overworld') ? 0.6 : 0.3;
    }
    if (this._netherLight) {
      this._netherLight.visible = (dimension === 'nether');
    }
  }

  /**
   * @param {'overworld'|'nether'|'end'} dimension
   */
  setDimension(dimension) {
    if (dimension !== this._currentDimension) {
      this._applyDimensionSky(dimension);
    }
  }

  // ─────────────────────────────────────────────────────────
  //  Fog
  // ─────────────────────────────────────────────────────────

  /**
   * Recalcule le fog linéaire en fonction du view distance et de la dimension.
   */
  _updateFog() {
    const renderDist = this._viewDistance * 16; // en blocs
    const near = renderDist * FOG_NEAR_FACTOR;
    const far  = renderDist * FOG_FAR_FACTOR;

    let fogColor;
    switch (this._currentDimension) {
      case 'nether': fogColor = 0x330A00; break;
      case 'end':    fogColor = 0x0A0A14; break;
      default:       fogColor = SKY_COLOR_OVERWORLD;
    }

    this.scene.fog = new THREE.Fog(fogColor, near, far);
  }

  // ─────────────────────────────────────────────────────────
  //  Gestion des Chunk Meshes
  // ─────────────────────────────────────────────────────────

  /**
   * Clé de map pour un chunk.
   * @param {number} cx @param {number} cz
   * @returns {string}
   */
  static _key(cx, cz) { return `${cx},${cz}`; }

  /**
   * Ajoute (ou remplace) les meshes d'un chunk dans la scène.
   * Le ChunkMesher produit un tableau de THREE.Mesh (un par "layer" :
   * solide, transparent, liquide).
   *
   * @param {number}       cx     Coordonnée chunk X
   * @param {number}       cz     Coordonnée chunk Z
   * @param {THREE.Mesh[]} meshes Meshes produits par ChunkMesher
   */
  setChunkMesh(cx, cz, meshes) {
    const key = Renderer._key(cx, cz);

    // Supprime les anciens meshes si existants
    this._removeChunkMeshByKey(key);

    // Ajoute les nouveaux dans la scène
    for (const mesh of meshes) {
      this.scene.add(mesh);
    }
    this._chunkMeshes.set(key, meshes);
  }

  /**
   * Supprime les meshes d'un chunk de la scène et libère la géométrie.
   * @param {number} cx @param {number} cz
   */
  removeChunkMesh(cx, cz) {
    this._removeChunkMeshByKey(Renderer._key(cx, cz));
  }

  /**
   * @param {string} key
   * @private
   */
  _removeChunkMeshByKey(key) {
    const existing = this._chunkMeshes.get(key);
    if (!existing) return;
    for (const mesh of existing) {
      this.scene.remove(mesh);
      mesh.geometry.dispose();
      // Note : le matériau est partagé (atlas), ne pas le dispose ici
    }
    this._chunkMeshes.delete(key);
  }

  /**
   * Supprime TOUS les chunks de la scène (changement de dimension).
   */
  clearAllChunks() {
    for (const key of this._chunkMeshes.keys()) {
      this._removeChunkMeshByKey(key);
    }
  }

  // ─────────────────────────────────────────────────────────
  //  Sélection de bloc (raycasting)
  // ─────────────────────────────────────────────────────────

  /**
   * Lance un rayon depuis le centre de la caméra et retourne le
   * premier bloc solide touché dans la portée de 5 blocs.
   *
   * @returns {{ blockPos: THREE.Vector3, faceNormal: THREE.Vector3 } | null}
   *   blockPos    : coordonnées monde du bloc touché (entières)
   *   faceNormal  : normale de la face touchée (pour le placement)
   */
  getTargetBlock() {
    // Rayon depuis le centre de l'écran
    this._raycaster.setFromCamera({ x: 0, y: 0 }, this.camera);

    // Collecte tous les mesh solides (on exclut les liquides et la sélection)
    const meshes = [];
    for (const chunkMeshes of this._chunkMeshes.values()) {
      for (const m of chunkMeshes) {
        if (m.userData.layer === 'solid') meshes.push(m);
      }
    }

    const hits = this._raycaster.intersectObjects(meshes, false);
    if (hits.length === 0) {
      this._selectionMesh.visible = false;
      return null;
    }

    const hit  = hits[0];
    const pos  = hit.point;
    const norm = hit.face.normal;

    // Décale légèrement vers l'intérieur du bloc touché
    const bx = Math.floor(pos.x - norm.x * 0.5);
    const by = Math.floor(pos.y - norm.y * 0.5);
    const bz = Math.floor(pos.z - norm.z * 0.5);

    // Positionne le wireframe de sélection
    this._selectionMesh.position.set(bx + 0.5, by + 0.5, bz + 0.5);
    this._selectionMesh.visible = true;

    return {
      blockPos:   new THREE.Vector3(bx, by, bz),
      faceNormal: norm.clone(),
    };
  }

  /**
   * Cache la surbrillance de sélection (ex : menu ouvert).
   */
  hideSelection() {
    this._selectionMesh.visible = false;
  }

  // ─────────────────────────────────────────────────────────
  //  Position caméra (synchronisée par le Player)
  // ─────────────────────────────────────────────────────────

  /**
   * Met à jour la position et la rotation de la caméra.
   * Appelé par Player.js à chaque tick.
   *
   * @param {number} x @param {number} y @param {number} z   Position des yeux
   * @param {number} yaw    Rotation horizontale en radians
   * @param {number} pitch  Rotation verticale  en radians (clampée ±89°)
   */
  setCameraTransform(x, y, z, yaw, pitch) {
    this.camera.position.set(x, y, z);
    // Three.js : ordre Euler YXZ pour une caméra FPS
    this.camera.rotation.order = 'YXZ';
    this.camera.rotation.y = yaw;
    this.camera.rotation.x = pitch;
  }

  // ─────────────────────────────────────────────────────────
  //  Rendu
  // ─────────────────────────────────────────────────────────

  /**
   * Effectue un frame de rendu.
   * Appelé par Engine.js dans la game loop, après les mises à jour.
   */
  render() {
    this.renderer.render(this.scene, this.camera);
  }

  // ─────────────────────────────────────────────────────────
  //  Resize
  // ─────────────────────────────────────────────────────────

  _onResize() {
    const w = this._container.clientWidth;
    const h = this._container.clientHeight;
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(w, h);
  }

  // ─────────────────────────────────────────────────────────
  //  View distance dynamique
  // ─────────────────────────────────────────────────────────

  /**
   * Modifie la distance de vue (ex : options in-game).
   * @param {number} chunks
   */
  setViewDistance(chunks) {
    this._viewDistance = chunks;
    this._updateFog();
    this.camera.far = chunks * 16 * 1.2;
    this.camera.updateProjectionMatrix();
  }

  // ─────────────────────────────────────────────────────────
  //  Nettoyage
  // ─────────────────────────────────────────────────────────

  dispose() {
    this._resizeObserver.disconnect();
    this.clearAllChunks();
    this._selectionMesh.geometry.dispose();
    this.renderer.dispose();
    this._container.removeChild(this.renderer.domElement);
  }

  // ─────────────────────────────────────────────────────────
  //  Debug
  // ─────────────────────────────────────────────────────────

  /** Retourne des statistiques de rendu pour un overlay de debug. */
  getStats() {
    const info = this.renderer.info;
    return {
      drawCalls:  info.render.calls,
      triangles:  info.render.triangles,
      chunkCount: this._chunkMeshes.size,
    };
  }
}
