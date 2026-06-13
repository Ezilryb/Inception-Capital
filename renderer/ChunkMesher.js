/**
 * ============================================================
 *  ChunkMesher.js — Minecraft 1.0 Recreation
 * ============================================================
 *  Convertit les données brutes d'un Chunk en géométrie Three.js.
 *
 *  ALGORITHME : Face-culling naïf (pas de greedy mesh en étape 1C)
 *  ─────────────────────────────────────────────────────────────
 *  Pour chaque bloc non-air, on teste les 6 voisins.
 *  Si le voisin est transparent/absent → on émet un quad (2 triangles).
 *  Un quad = 4 vertices + 6 indices (2 triangles).
 *
 *  Trois "passes" de géométrie (matériaux séparés) :
 *    • SOLID      — blocs opaques, rendu standard
 *    • CUTOUT     — végétaux, vitre (alpha test) — quads en croix inclus
 *    • LIQUID     — eau/lave (alpha blend, animated UV scroll)
 *
 *  ATLAS UV (terrain.png — 256×256, tiles 16×16 = 16×16 tuiles)
 *  ─────────────────────────────────────────────────────────────
 *  tileU = (index % 16) / 16
 *  tileV = Math.floor(index / 16) / 16
 *  UV coin bas-gauche (Three.js convention +Y = haut) :
 *    u0 = col * TILE_SIZE
 *    v0 = 1 - (row + 1) * TILE_SIZE
 *    u1 = u0 + TILE_SIZE
 *    v1 = v0 + TILE_SIZE
 *
 *  VERTEX FORMAT (entrelacé dans un BufferGeometry) :
 *    position  : Float32Array [x, y, z]        × 4 par quad
 *    uv        : Float32Array [u, v]            × 4 par quad
 *    normal    : Float32Array [nx, ny, nz]      × 4 par quad (flat)
 *    color     : Float32Array [r, g, b]         × 4 par quad (light * tint)
 *
 *  ORDRE DES FACES : +X, -X, +Y, -Y, +Z, -Z  (E/W/Top/Bot/S/N)
 * ============================================================
 */

'use strict';
// PATCHED v2 — fixes: colors buffer, mipmaps, light fallback, tint-per-face

import * as THREE         from 'three';
import { REGISTRY, BlockID } from '../world/BlockRegistry.js';
import { RenderType }     from '../world/Block.js';
import { CHUNK_WIDTH, CHUNK_DEPTH, CHUNK_HEIGHT } from '../world/Chunk.js';

// ─────────────────────────────────────────────────────────────
//  Constantes UV atlas
// ─────────────────────────────────────────────────────────────
const ATLAS_TILES = 16;         // 16×16 tuiles dans l'atlas
const TILE_SIZE   = 1 / ATLAS_TILES;   // 0.0625

// ─────────────────────────────────────────────────────────────
//  Définition des 6 faces (normale, voisin, indices de vertex)
// ─────────────────────────────────────────────────────────────

/**
 * Pour chaque face : normale, décalage vers le voisin, et les 4 sommets
 * du quad exprimés comme offsets par rapport au coin bas-gauche-avant du bloc.
 *
 * Convention : le bloc est en [0,1]³.
 * Ordre des vertices : bas-gauche, bas-droite, haut-droite, haut-gauche
 * → indices triangles : 0,1,2  0,2,3  (sens anti-horaire vu de l'extérieur)
 */
const FACES = [
  // +X  (Est)
  {
    normal: [1, 0, 0],
    neighbor: [1, 0, 0],
    vertices: [
      [1, 0, 1],
      [1, 0, 0],
      [1, 1, 0],
      [1, 1, 1],
    ],
    textureKey: 'east',
    aoCorners: [
      [[1,0,1],[1,-1,0],[1,-1,1]],
      [[1,0,-1],[1,-1,0],[1,-1,-1]],
      [[1,0,-1],[1,1,0],[1,1,-1]],
      [[1,0,1],[1,1,0],[1,1,1]],
    ],
  },
  // -X  (Ouest)
  {
    normal: [-1, 0, 0],
    neighbor: [-1, 0, 0],
    vertices: [
      [0, 0, 0],
      [0, 0, 1],
      [0, 1, 1],
      [0, 1, 0],
    ],
    textureKey: 'west',
    aoCorners: [
      [[-1,0,-1],[-1,-1,0],[-1,-1,-1]],
      [[-1,0,1],[-1,-1,0],[-1,-1,1]],
      [[-1,0,1],[-1,1,0],[-1,1,1]],
      [[-1,0,-1],[-1,1,0],[-1,1,-1]],
    ],
  },
  // +Y  (Dessus)
  {
    normal: [0, 1, 0],
    neighbor: [0, 1, 0],
    vertices: [
      [0, 1, 0],
      [1, 1, 0],
      [1, 1, 1],
      [0, 1, 1],
    ],
    textureKey: 'top',
    aoCorners: [
      [[-1,1,0],[0,1,-1],[-1,1,-1]],
      [[1,1,0],[0,1,-1],[1,1,-1]],
      [[1,1,0],[0,1,1],[1,1,1]],
      [[-1,1,0],[0,1,1],[-1,1,1]],
    ],
  },
  // -Y  (Dessous)
  {
    normal: [0, -1, 0],
    neighbor: [0, -1, 0],
    vertices: [
      [0, 0, 1],
      [1, 0, 1],
      [1, 0, 0],
      [0, 0, 0],
    ],
    textureKey: 'bottom',
    aoCorners: [
      [[-1,-1,0],[0,-1,1],[-1,-1,1]],
      [[1,-1,0],[0,-1,1],[1,-1,1]],
      [[1,-1,0],[0,-1,-1],[1,-1,-1]],
      [[-1,-1,0],[0,-1,-1],[-1,-1,-1]],
    ],
  },
  // +Z  (Sud)
  {
    normal: [0, 0, 1],
    neighbor: [0, 0, 1],
    vertices: [
      [0, 0, 1],
      [1, 0, 1],
      [1, 1, 1],
      [0, 1, 1],
    ],
    textureKey: 'south',
    aoCorners: [
      [[-1,0,1],[0,-1,1],[-1,-1,1]],
      [[1,0,1],[0,-1,1],[1,-1,1]],
      [[1,0,1],[0,1,1],[1,1,1]],
      [[-1,0,1],[0,1,1],[-1,1,1]],
    ],
  },
  // -Z  (Nord)
  {
    normal: [0, 0, -1],
    neighbor: [0, 0, -1],
    vertices: [
      [1, 0, 0],
      [0, 0, 0],
      [0, 1, 0],
      [1, 1, 0],
    ],
    textureKey: 'north',
    aoCorners: [
      [[1,0,-1],[0,-1,-1],[1,-1,-1]],
      [[-1,0,-1],[0,-1,-1],[-1,-1,-1]],
      [[-1,0,-1],[0,1,-1],[-1,1,-1]],
      [[1,0,-1],[0,1,-1],[1,1,-1]],
    ],
  },
];

// Facteurs d'assombrissement par face (MC 1.0 : face du bas 50%, côtés 80%)
const FACE_SHADE = [
  0.8,  // +X
  0.8,  // -X
  1.0,  // +Y (top, plein soleil)
  0.5,  // -Y (bottom)
  0.8,  // +Z
  0.8,  // -Z
];

// ─────────────────────────────────────────────────────────────
//  Buffers de construction (réutilisés pour éviter les allocations)
// ─────────────────────────────────────────────────────────────

/**
 * Accumulateur de géométrie pour une passe de rendu.
 * On pré-alloue largement (2M floats), puis on recopie la zone utile.
 */
class GeometryBuffer {
  constructor() {
    // Taille max estimée : chunk 16*16*256 blocs, 6 faces, 4 vertices, 8 floats
    // On alloue pour ~50 % de remplissage d'un chunk dense
    const MAX_QUADS = 200_000;
    this.positions = new Float32Array(MAX_QUADS * 4 * 3);
    this.uvs       = new Float32Array(MAX_QUADS * 4 * 2);
    this.normals   = new Float32Array(MAX_QUADS * 4 * 3);
    this.colors    = new Float32Array(MAX_QUADS * 4 * 3);
    this.indices   = new Uint32Array(MAX_QUADS * 6);
    this.reset();
  }

  reset() {
    this.vertCount = 0;
    this.idxCount  = 0;
  }

  /**
   * Ajoute un quad (4 vertices, 2 triangles).
   * @param {number[][]} verts   4 positions [x,y,z]
   * @param {number[]}   uvCoords [u0,v0, u1,v0, u1,v1, u0,v1] (BL→BR→TR→TL)
   * @param {number[]}   normal  [nx, ny, nz]
   * @param {number}     light   0-15 lumière effective
   * @param {number}     shade   0-1  facteur de face
   * @param {number}     tint    0xRRGGBB teinte couleur (herbe biome, etc.)
   */
  addQuad(verts, uvCoords, normal, light, shade, tint = 0xFFFFFF) {
    const base   = this.vertCount;
    const pi     = base * 3;
    const ui     = base * 2;

    // Luminosité finale [0,1]
    const lf = (light / 15) * shade;
    const r  = ((tint >> 16) & 0xFF) / 255 * lf;
    const g  = ((tint >>  8) & 0xFF) / 255 * lf;
    const b  = ( tint        & 0xFF) / 255 * lf;

    for (let i = 0; i < 4; i++) {
      const p = pi + i * 3;
      this.positions[p]     = verts[i][0];
      this.positions[p + 1] = verts[i][1];
      this.positions[p + 2] = verts[i][2];

      const u = ui + i * 2;
      this.uvs[u]     = uvCoords[i * 2];
      this.uvs[u + 1] = uvCoords[i * 2 + 1];

      const n = pi + i * 3;
      this.normals[n]     = normal[0];
      this.normals[n + 1] = normal[1];
      this.normals[n + 2] = normal[2];

      const c = base * 3 + i * 3; // FIX: était pi+i*3, écrasait les normales
      this.colors[c]     = r;
      this.colors[c + 1] = g;
      this.colors[c + 2] = b;
    }

    // 2 triangles : 0-1-2, 0-2-3
    const ii = this.idxCount;
    this.indices[ii]     = base;
    this.indices[ii + 1] = base + 1;
    this.indices[ii + 2] = base + 2;
    this.indices[ii + 3] = base;
    this.indices[ii + 4] = base + 2;
    this.indices[ii + 5] = base + 3;

    this.vertCount += 4;
    this.idxCount  += 6;
  }

  /**
   * Construit un THREE.BufferGeometry à partir du contenu actuel.
   * @returns {THREE.BufferGeometry | null}  null si vide
   */
  build() {
    if (this.vertCount === 0) return null;

    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(
      this.positions.slice(0, this.vertCount * 3), 3));
    geo.setAttribute('uv', new THREE.BufferAttribute(
      this.uvs.slice(0, this.vertCount * 2), 2));
    geo.setAttribute('normal', new THREE.BufferAttribute(
      this.normals.slice(0, this.vertCount * 3), 3));
    geo.setAttribute('color', new THREE.BufferAttribute(
      this.colors.slice(0, this.vertCount * 3), 3));
    geo.setIndex(new THREE.BufferAttribute(
      this.indices.slice(0, this.idxCount), 1));
    return geo;
  }
}

// ─────────────────────────────────────────────────────────────
//  ChunkMesher
// ─────────────────────────────────────────────────────────────
export class ChunkMesher {
  /**
   * @param {Object}              opts
   * @param {THREE.Material}      opts.solidMaterial     Matériau solide (MeshLambertMaterial + atlas)
   * @param {THREE.Material}      opts.cutoutMaterial    Matériau alpha-test
   * @param {THREE.Material}      opts.liquidMaterial    Matériau alpha-blend
   * @param {TextureAtlas}       [opts.textureAtlas]     Pour tints biome (optionnel en 1C)
   */
  constructor({ solidMaterial, cutoutMaterial, liquidMaterial, textureAtlas = null }) {
    this._solidMat   = solidMaterial;
    this._cutoutMat  = cutoutMaterial;
    this._liquidMat  = liquidMaterial;
    this._atlas      = textureAtlas;

    // Buffers réutilisables (évite les GC pression)
    this._bufSolid   = new GeometryBuffer();
    this._bufCutout  = new GeometryBuffer();
    this._bufLiquid  = new GeometryBuffer();
  }

  // ─────────────────────────────────────────────────────────
  //  Création des matériaux statiques (appelé une fois)
  // ─────────────────────────────────────────────────────────

  /**
   * Crée les 3 matériaux standard à partir de la texture atlas.
   * Méthode statique de commodité.
   *
   * @param {THREE.Texture} atlasTexture  THREE.Texture depuis TextureAtlas
   * @returns {{ solidMaterial, cutoutMaterial, liquidMaterial }}
   */
  static createMaterials(atlasTexture) {
    // Pixel-perfect (pas de bilinear) pour reproduire le look 2011
    atlasTexture.magFilter = THREE.NearestFilter;
    atlasTexture.minFilter = THREE.NearestFilter; // FIX: cohérent avec generateMipmaps=false
    atlasTexture.generateMipmaps = false;

    const solidMaterial = new THREE.MeshLambertMaterial({
      map:            atlasTexture,
      vertexColors:   true,   // color buffer (lumière baked + tint)
      side:           THREE.FrontSide,
    });

    const cutoutMaterial = new THREE.MeshLambertMaterial({
      map:            atlasTexture,
      vertexColors:   true,
      side:           THREE.DoubleSide,  // végétaux visibles des deux côtés
      alphaTest:      0.5,
      transparent:    false,             // alphaTest suffit, pas de sort
    });

    const liquidMaterial = new THREE.MeshLambertMaterial({
      map:            atlasTexture,
      vertexColors:   true,
      side:           THREE.FrontSide,
      transparent:    true,
      opacity:        0.85,
      depthWrite:     false,
    });

    return { solidMaterial, cutoutMaterial, liquidMaterial };
  }

  // ─────────────────────────────────────────────────────────
  //  Build principal
  // ─────────────────────────────────────────────────────────

  /**
   * Construit les meshes d'un chunk.
   *
   * @param {import('../world/Chunk.js').Chunk} chunk  Le chunk à mesher
   * @param {Object} neighbors   Chunks voisins { px, nx, pz, nz }
   *   (peuvent être null — les faces frontières contre null sont émises)
   * @returns {THREE.Mesh[]}  Tableau de 1–3 meshes (solid, cutout, liquid)
   */
  build(chunk, neighbors = {}) {
    this._bufSolid.reset();
    this._bufCutout.reset();
    this._bufLiquid.reset();

    const wx0 = chunk.worldX;
    const wz0 = chunk.worldZ;

    for (let y = 0; y < CHUNK_HEIGHT; y++) {
      for (let z = 0; z < CHUNK_DEPTH; z++) {
        for (let x = 0; x < CHUNK_WIDTH; x++) {
          const blockId = chunk.blockIds[_idx(x, y, z)];
          if (blockId === BlockID.AIR) continue;

          const block = REGISTRY.get(blockId);
          if (!block || block.renderType === RenderType.NONE) continue;

          // Position monde du coin bas-gauche-avant du bloc
          const wx = wx0 + x;
          const wy = y;
          const wz = wz0 + z;

          switch (block.renderType) {
            case RenderType.CUBE:
              this._emitCube(chunk, neighbors, block, x, y, z, wx, wy, wz);
              break;
            case RenderType.CROSS:
              this._emitCross(block, wx, wy, wz);
              break;
            case RenderType.LIQUID:
              this._emitLiquid(chunk, neighbors, block, x, y, z, wx, wy, wz);
              break;
            case RenderType.FLAT:
            case RenderType.TORCH:
            case RenderType.CROP:
            case RenderType.SNOW:
              // TODO Étape 1D — formes spéciales
              // Fallback temporaire : on émet un cube
              this._emitCube(chunk, neighbors, block, x, y, z, wx, wy, wz);
              break;
            default:
              // SLAB, STAIRS, etc. — Étape 1D
              this._emitCube(chunk, neighbors, block, x, y, z, wx, wy, wz);
          }
        }
      }
    }

    return this._buildMeshes(wx0, wz0);
  }

  // ─────────────────────────────────────────────────────────
  //  Émetteurs de géométrie
  // ─────────────────────────────────────────────────────────

  /**
   * Émet les faces visibles d'un cube plein.
   */
  _emitCube(chunk, neighbors, block, lx, ly, lz, wx, wy, wz) {
    // FIX: fallback 15 si skyLight non propagée (évite faces noires)
    const rawLight = chunk.getSkyLight(lx, ly, lz);
    const light    = rawLight > 0 ? rawLight : 15;

    for (let fi = 0; fi < FACES.length; fi++) {
      const face    = FACES[fi];
      const [nx, ny, nz] = face.neighbor;

      // Résoudre le bloc voisin (peut être dans un chunk adjacent)
      const neighborId = this._getWorldBlockId(
        chunk, neighbors,
        lx + nx, ly + ny, lz + nz
      );

      // Culling : n'émet la face que si le voisin est transparent ou absent
      if (!this._faceVisible(neighborId)) continue;

      const uvCoords = this._getUVs(block.texture, face.textureKey);
      const shade    = FACE_SHADE[fi];
      const tint     = this._getTintForFace(block, face.textureKey);

      // Sommets en coordonnées monde
      const verts = face.vertices.map(([dx, dy, dz]) => [
        wx + dx, wy + dy, wz + dz,
      ]);

      const buf = block.transparent ? this._bufCutout : this._bufSolid;
      buf.addQuad(verts, uvCoords, face.normal, light, shade, tint);
    }
  }

  /**
   * Émet 2 quads en croix pour les végétaux (fleurs, herbe, champignons…).
   */
  _emitCross(block, wx, wy, wz) {
    const uvCoords = this._getUVs(block.texture, 'north');
    // Les deux diagonales d'un carré unitaire
    const quads = [
      // Diagonale NW→SE
      [[0.15, 0, 0.85], [0.85, 0, 0.15], [0.85, 1, 0.15], [0.15, 1, 0.85]],
      // Diagonale NE→SW
      [[0.15, 0, 0.15], [0.85, 0, 0.85], [0.85, 1, 0.85], [0.15, 1, 0.15]],
    ];

    for (const localVerts of quads) {
      const verts = localVerts.map(([dx, dy, dz]) => [wx + dx, wy + dy, wz + dz]);
      this._bufCutout.addQuad(verts, uvCoords, [0, 1, 0], 15, 1.0, 0xFFFFFF);
    }
  }

  /**
   * Émet la surface d'un liquide (eau, lave).
   * Seul le dessus et les côtés exposés sont émis.
   */
  _emitLiquid(chunk, neighbors, block, lx, ly, lz, wx, wy, wz) {
    const rawLight = chunk.getSkyLight(lx, ly, lz);
    const light    = rawLight > 0 ? rawLight : 15; // FIX: fallback plein soleil

    for (let fi = 0; fi < FACES.length; fi++) {
      const face    = FACES[fi];
      const [nx, ny, nz] = face.neighbor;

      const neighborId = this._getWorldBlockId(
        chunk, neighbors,
        lx + nx, ly + ny, lz + nz
      );

      // Liquid-liquid culling : ne pas émettre les faces entre deux liquides identiques
      if (neighborId === block.id) continue;
      if (!this._faceVisible(neighborId)) continue;

      const uvCoords = this._getUVs(block.texture, face.textureKey);
      const shade    = FACE_SHADE[fi];

      // La surface du liquide est légèrement abaissée (0.875 au lieu de 1)
      let verts = face.vertices.map(([dx, dy, dz]) => [
        wx + dx, wy + dy, wz + dz,
      ]);

      // Abaisse les sommets du haut pour la face TOP uniquement
      if (fi === 2 /* +Y */) {
        verts = verts.map(([vx, vy, vz]) => [vx, vy - 0.125, vz]);
      }

      this._bufLiquid.addQuad(verts, uvCoords, face.normal, light, shade, 0xFFFFFF);
    }
  }

  // ─────────────────────────────────────────────────────────
  //  Utilitaires
  // ─────────────────────────────────────────────────────────

  /**
   * Résout l'ID d'un bloc en coordonnées locales, avec traversée des voisins.
   * @param {Chunk}  chunk      Chunk courant
   * @param {Object} neighbors  { px, nx, pz, nz }
   * @param {number} lx  @param {number} ly  @param {number} lz  Coordonnées locales
   * @returns {number}  BlockID
   */
  _getWorldBlockId(chunk, neighbors, lx, ly, lz) {
    // Hors bornes verticales → air
    if (ly < 0 || ly >= CHUNK_HEIGHT) return BlockID.AIR;

    // Dans le chunk courant
    if (lx >= 0 && lx < CHUNK_WIDTH && lz >= 0 && lz < CHUNK_DEPTH) {
      return chunk.blockIds[_idx(lx, ly, lz)];
    }

    // Chunk voisin
    let neighbor = null;
    let nlx = lx;
    let nlz = lz;

    if (lx < 0) {
      neighbor = neighbors.nx ?? null;
      nlx = lx + CHUNK_WIDTH;
    } else if (lx >= CHUNK_WIDTH) {
      neighbor = neighbors.px ?? null;
      nlx = lx - CHUNK_WIDTH;
    } else if (lz < 0) {
      neighbor = neighbors.nz ?? null;
      nlz = lz + CHUNK_DEPTH;
    } else if (lz >= CHUNK_DEPTH) {
      neighbor = neighbors.pz ?? null;
      nlz = lz - CHUNK_DEPTH;
    }

    if (!neighbor) return BlockID.AIR; // chunk non chargé → traiter comme air
    return neighbor.blockIds[_idx(nlx, ly, nlz)];
  }

  /**
   * Une face est visible si le voisin est de l'air, transparent, ou non chargé.
   * @param {number} neighborId
   * @returns {boolean}
   */
  _faceVisible(neighborId) {
    if (neighborId === BlockID.AIR) return true;
    const neighbor = REGISTRY.get(neighborId);
    return !neighbor || neighbor.transparent || !neighbor.solid;
  }

  /**
   * Calcule les 4 paires UV d'une face d'un bloc pour l'atlas.
   * Ordre : BL → BR → TR → TL  (correspond aux 4 vertices du quad)
   *
   * @param {import('../world/Block.js').BlockTexture} texture
   * @param {string} faceKey  'top'|'bottom'|'north'|'south'|'east'|'west'
   * @returns {number[]}  [u0,v0, u1,v0, u1,v1, u0,v1]
   */
  _getUVs(texture, faceKey) {
    if (!texture) return _defaultUVs();

    const tileIndex = texture[faceKey] ?? texture.top ?? 0;
    const col = tileIndex % ATLAS_TILES;
    const row = Math.floor(tileIndex / ATLAS_TILES);

    const u0 = col * TILE_SIZE;
    const v0 = 1 - (row + 1) * TILE_SIZE;
    const u1 = u0 + TILE_SIZE;
    const v1 = v0 + TILE_SIZE;

    // BL, BR, TR, TL
    return [u0, v0,  u1, v0,  u1, v1,  u0, v1];
  }

  // FIX: tint par face — grass bottom (dirt) ne prend pas le vert
  _getTintForFace(block, faceKey) {
    if (!block.tintType) return 0xFFFFFF;
    switch (block.tintType) {
      case 'grass':
        return faceKey === 'bottom' ? 0xFFFFFF : 0x79C05A;
      case 'foliage': return 0x59AE30;
      default:        return 0xFFFFFF;
    }
  }
  _getTint(block, faceKey) { return this._getTintForFace(block, faceKey); }

  // ─────────────────────────────────────────────────────────
  //  Assemblage final des Mesh
  // ─────────────────────────────────────────────────────────

  /**
   * Construit les THREE.Mesh depuis les buffers remplis.
   * @param {number} wx0  worldX du coin du chunk (pour userData)
   * @param {number} wz0  worldZ
   * @returns {THREE.Mesh[]}
   */
  _buildMeshes(wx0, wz0) {
    const meshes = [];

    const add = (buffer, material, layer) => {
      const geo = buffer.build();
      if (!geo) return;
      const mesh = new THREE.Mesh(geo, material);
      mesh.frustumCulled = true;
      mesh.userData.layer = layer;
      mesh.userData.chunkWorldX = wx0;
      mesh.userData.chunkWorldZ = wz0;
      meshes.push(mesh);
    };

    add(this._bufSolid,   this._solidMat,   'solid');
    add(this._bufCutout,  this._cutoutMat,  'cutout');
    add(this._bufLiquid,  this._liquidMat,  'liquid');

    return meshes;
  }
}

// ─────────────────────────────────────────────────────────────
//  Helpers locaux
// ─────────────────────────────────────────────────────────────

/** Index linéaire inline (évite l'appel de méthode statique dans les boucles) */
function _idx(x, y, z) {
  return (y << 8) | (z << 4) | x;
}

/** UVs de la tuile 0 (coin supérieur gauche de l'atlas) — fallback */
function _defaultUVs() {
  return [0, 0,  TILE_SIZE, 0,  TILE_SIZE, TILE_SIZE,  0, TILE_SIZE];
}
