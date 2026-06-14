/**
 * ============================================================
 *  WorldGenerator.js — Minecraft 1.0 Recreation — Étape 1C
 * ============================================================
 *  Génération procédurale via bruit de Perlin simplifié.
 *  Pas de dépendance externe — Perlin implementé in-house.
 * ============================================================
 */
'use strict';

import { BlockID } from '../world/BlockRegistry.js';
import { CHUNK_WIDTH, CHUNK_DEPTH, CHUNK_HEIGHT } from '../world/Chunk.js';

// ─────────────────────────────────────────────────────────────
//  Perlin Noise (implémentation Fade/Lerp classique)
// ─────────────────────────────────────────────────────────────
class PerlinNoise {
  constructor(seed = 0) {
    this._p = new Uint8Array(512);
    const perm = new Uint8Array(256);
    for (let i = 0; i < 256; i++) perm[i] = i;
    // Shuffle déterministe par graine
    let s = (seed * 1664525 + 1013904223) >>> 0;
    for (let i = 255; i > 0; i--) {
      s = (s * 1664525 + 1013904223) >>> 0;
      const j = s % (i + 1);
      [perm[i], perm[j]] = [perm[j], perm[i]];
    }
    for (let i = 0; i < 256; i++) this._p[i] = this._p[i + 256] = perm[i];
  }

  _fade(t) { return t * t * t * (t * (t * 6 - 15) + 10); }
  _lerp(t, a, b) { return a + t * (b - a); }
  _grad(hash, x, y, z) {
    const h = hash & 15;
    const u = h < 8 ? x : y;
    const v = h < 4 ? y : (h === 12 || h === 14 ? x : z);
    return ((h & 1) ? -u : u) + ((h & 2) ? -v : v);
  }

  noise(x, y, z) {
    const X = Math.floor(x) & 255;
    const Y = Math.floor(y) & 255;
    const Z = Math.floor(z) & 255;
    x -= Math.floor(x); y -= Math.floor(y); z -= Math.floor(z);
    const u = this._fade(x), v = this._fade(y), w = this._fade(z);
    const p = this._p;
    const A = p[X] + Y, AA = p[A] + Z, AB = p[A + 1] + Z;
    const B = p[X + 1] + Y, BA = p[B] + Z, BB = p[B + 1] + Z;
    return this._lerp(w,
      this._lerp(v,
        this._lerp(u, this._grad(p[AA], x, y, z),     this._grad(p[BA], x-1, y, z)),
        this._lerp(u, this._grad(p[AB], x, y-1, z),   this._grad(p[BB], x-1, y-1, z))),
      this._lerp(v,
        this._lerp(u, this._grad(p[AA+1], x, y, z-1), this._grad(p[BA+1], x-1, y, z-1)),
        this._lerp(u, this._grad(p[AB+1], x, y-1, z-1),this._grad(p[BB+1], x-1, y-1, z-1))));
  }

  /** FBM (fractional brownian motion) — somme d'octaves */
  fbm(x, y, z, octaves = 4, lacunarity = 2, gain = 0.5) {
    let val = 0, amp = 1, freq = 1, max = 0;
    for (let i = 0; i < octaves; i++) {
      val += this.noise(x * freq, y * freq, z * freq) * amp;
      max  += amp;
      amp  *= gain;
      freq *= lacunarity;
    }
    return val / max;
  }
}

// ─────────────────────────────────────────────────────────────
//  WorldGenerator
// ─────────────────────────────────────────────────────────────
export class WorldGenerator {
  /**
   * @param {Object} opts
   * @param {number} [opts.seed=0]
   * @param {number} [opts.seaLevel=63]
   */
  constructor({ seed = 0, seaLevel = 63 } = {}) {
    this._seed     = seed;
    this._seaLevel = seaLevel;

    // Bruits indépendants pour chaque couche
    this._noiseTerrain = new PerlinNoise(seed);
    this._noiseHills   = new PerlinNoise(seed ^ 0xDEADBEEF);
    this._noiseCave    = new PerlinNoise(seed ^ 0xCAFEBABE);
    this._noiseOre     = new PerlinNoise(seed ^ 0x12345678);
    this._noiseBiome   = new PerlinNoise(seed ^ 0xABCDEF01);
  }

  /**
   * Point d'entrée : remplissage d'un Chunk.
   * @param {import('../world/Chunk.js').Chunk} chunk
   */
  generate(chunk) {
    const wx0 = chunk.worldX;
    const wz0 = chunk.worldZ;

    // ── Pass 1 : Hauteur de terrain + blocs de base ──────────
    for (let lz = 0; lz < CHUNK_DEPTH; lz++) {
      for (let lx = 0; lx < CHUNK_WIDTH; lx++) {
        const wx = wx0 + lx;
        const wz = wz0 + lz;

        const height = this._terrainHeight(wx, wz);
        const biome  = this._biomeType(wx, wz); // 0=plains, 1=hills, 2=desert, 3=taiga

        this._fillColumn(chunk, lx, lz, height, biome);
      }
    }

    // ── Pass 2 : Grottes ──────────────────────────────────────
    this._carveCaves(chunk, wx0, wz0);

    // ── Pass 3 : Minerais ─────────────────────────────────────
    this._placeOres(chunk, wx0, wz0);

    // ── Pass 4 : Structures de surface ───────────────────────
    this._surfaceStructures(chunk, wx0, wz0);
  }

  // ─────────────────────────────────────────────────────────
  //  Hauteur de terrain
  // ─────────────────────────────────────────────────────────

  _terrainHeight(wx, wz) {
    const scale = 0.003;
    const hillScale = 0.008;

    const base  = this._noiseTerrain.fbm(wx * scale, 0, wz * scale, 4) * 0.5 + 0.5;
    const hills = Math.max(0, this._noiseHills.fbm(wx * hillScale, 1, wz * hillScale, 3)) * 0.5 + 0.5;
    const biome = this._biomeType(wx, wz);

    let h;
    switch (biome) {
      case 1: // Hills
        h = 60 + base * 20 + hills * 30;
        break;
      case 2: // Desert — plat
        h = 62 + base * 6;
        break;
      case 3: // Taiga — légèrement vallonné
        h = 63 + base * 15 + hills * 10;
        break;
      default: // Plains
        h = 62 + base * 10;
    }
    return Math.round(Math.max(5, Math.min(200, h)));
  }

  _biomeType(wx, wz) {
    const v = this._noiseBiome.fbm(wx * 0.002, 0, wz * 0.002, 2) * 0.5 + 0.5;
    if (v < 0.25) return 2; // desert
    if (v < 0.45) return 1; // hills
    if (v < 0.65) return 0; // plains
    return 3;                // taiga
  }

  // ─────────────────────────────────────────────────────────
  //  Remplissage d'une colonne
  // ─────────────────────────────────────────────────────────

  _fillColumn(chunk, lx, lz, height, biome) {
    const sl = this._seaLevel;

    for (let y = 0; y <= height; y++) {
      let id;
      if (y === 0) {
        id = BlockID.BEDROCK;
      } else if (y < 5) {
        // Couche de bedrock partielle
        const v = this._noiseOre.noise(lx * 0.3, y * 0.3, lz * 0.3);
        id = (v > 0) ? BlockID.BEDROCK : BlockID.STONE;
      } else if (y < height - 4) {
        id = BlockID.STONE;
      } else if (y < height) {
        // 4 couches de dirt sous la surface
        id = (biome === 2) ? BlockID.SAND : BlockID.DIRT;
      } else {
        // Bloc de surface
        switch (biome) {
          case 2: id = BlockID.SAND;  break;
          case 3: id = height > 80 ? BlockID.SNOW_BLOCK : BlockID.GRASS; break;
          default: id = BlockID.GRASS;
        }
      }
      chunk.blockIds[_idx(lx, y, lz)] = id;
    }

    // Eau si sous le niveau de la mer
    if (height < sl) {
      for (let y = height + 1; y <= sl; y++) {
        chunk.blockIds[_idx(lx, y, lz)] = BlockID.WATER_STILL;
      }
    }
  }

  // ─────────────────────────────────────────────────────────
  //  Grottes (3D noise density)
  // ─────────────────────────────────────────────────────────

  _carveCaves(chunk, wx0, wz0) {
    for (let lz = 0; lz < CHUNK_DEPTH; lz++) {
      for (let lx = 0; lx < CHUNK_WIDTH; lx++) {
        for (let y = 1; y < 60; y++) {
          const wx = wx0 + lx;
          const wz = wz0 + lz;
          const n  = this._noiseCave.noise(wx * 0.05, y * 0.05, wz * 0.05);
          const n2 = this._noiseCave.noise(wx * 0.05 + 100, y * 0.05, wz * 0.05 + 100);
          // Tunnel si les deux bruits sont proches de 0
          if (n * n + n2 * n2 < 0.02) {
            const cur = chunk.blockIds[_idx(lx, y, lz)];
            if (cur !== BlockID.BEDROCK && cur !== BlockID.AIR) {
              chunk.blockIds[_idx(lx, y, lz)] = BlockID.AIR;
              // Lava sous y=10
              if (y < 10 && chunk.blockIds[_idx(lx, y - 1, lz)] !== BlockID.AIR) {
                chunk.blockIds[_idx(lx, y, lz)] = BlockID.LAVA_STILL;
              }
            }
          }
        }
      }
    }
  }

  // ─────────────────────────────────────────────────────────
  //  Minerais
  // ─────────────────────────────────────────────────────────

  _placeOres(chunk, wx0, wz0) {
    const ores = [
      { id: BlockID.COAL_ORE,     maxY:  128, freq: 0.045, threshold: 0.55 },
      { id: BlockID.IRON_ORE,     maxY:   64, freq: 0.06,  threshold: 0.58 },
      { id: BlockID.GOLD_ORE,     maxY:   32, freq: 0.07,  threshold: 0.62 },
      { id: BlockID.DIAMOND_ORE,  maxY:   16, freq: 0.08,  threshold: 0.65 },
      { id: BlockID.REDSTONE_ORE, maxY:   16, freq: 0.07,  threshold: 0.62 },
      { id: BlockID.LAPIS_ORE,    maxY:   32, freq: 0.065, threshold: 0.63 },
    ];

    for (const ore of ores) {
      for (let lz = 0; lz < CHUNK_DEPTH; lz++) {
        for (let lx = 0; lx < CHUNK_WIDTH; lx++) {
          const wx = wx0 + lx;
          const wz = wz0 + lz;
          for (let y = 1; y < ore.maxY; y++) {
            if (chunk.blockIds[_idx(lx, y, lz)] !== BlockID.STONE) continue;
            const n = this._noiseOre.noise(wx * ore.freq, y * ore.freq, wz * ore.freq) * 0.5 + 0.5;
            if (n > ore.threshold) {
              chunk.blockIds[_idx(lx, y, lz)] = ore.id;
            }
          }
        }
      }
    }
  }

  // ─────────────────────────────────────────────────────────
  //  Structures de surface (arbres, fleurs)
  // ─────────────────────────────────────────────────────────

  _surfaceStructures(chunk, wx0, wz0) {
    for (let lz = 0; lz < CHUNK_DEPTH; lz++) {
      for (let lx = 0; lx < CHUNK_WIDTH; lx++) {
        const wx = wx0 + lx;
        const wz = wz0 + lz;
        const biome  = this._biomeType(wx, wz);
        if (biome === 2) continue; // pas d'arbres dans le désert

        // Hauteur de surface
        const surface = this._getSurface(chunk, lx, lz);
        if (surface < 1) continue;

        const surfId = chunk.blockIds[_idx(lx, surface, lz)];
        if (surfId !== BlockID.GRASS) continue;

        // Hash pseudo-aléatoire déterministe
        const hash = _hash(wx, wz, this._seed);

        // Arbre (probabilité ~5%)
        if (hash % 20 === 0 && surface + 7 < CHUNK_HEIGHT) {
          this._placeTree(chunk, lx, surface + 1, lz);
          continue;
        }

        // Fleur / herbe haute
        if (hash % 7 === 1) {
          const flowerType = (hash % 3 === 0) ? BlockID.YELLOW_FLOWER
                           : (hash % 3 === 1) ? BlockID.RED_FLOWER
                           : BlockID.TALL_GRASS;
          if (surface + 1 < CHUNK_HEIGHT) {
            chunk.blockIds[_idx(lx, surface + 1, lz)] = flowerType;
          }
        }
      }
    }
  }

  _getSurface(chunk, lx, lz) {
    for (let y = CHUNK_HEIGHT - 1; y > 0; y--) {
      if (chunk.blockIds[_idx(lx, y, lz)] !== BlockID.AIR) return y;
    }
    return 0;
  }

  _placeTree(chunk, lx, baseY, lz) {
    const trunkH = 4 + ((_hash(lx, baseY, lz) % 3));

    // Tronc
    for (let ty = 0; ty < trunkH; ty++) {
      if (baseY + ty >= CHUNK_HEIGHT) break;
      chunk.blockIds[_idx(lx, baseY + ty, lz)] = BlockID.LOG;
    }

    // Feuillages (sphère aplatie autour du sommet)
    const topY = baseY + trunkH;
    const leafOffsets = [
      // Couche -1
      [-2,-1,-2],[-1,-1,-2],[0,-1,-2],[1,-1,-2],[2,-1,-2],
      [-2,-1,-1],[-1,-1,-1],[0,-1,-1],[1,-1,-1],[2,-1,-1],
      [-2,-1,0], [-1,-1,0], [0,-1,0], [1,-1,0], [2,-1,0],
      [-2,-1,1], [-1,-1,1], [0,-1,1], [1,-1,1], [2,-1,1],
      [-2,-1,2], [-1,-1,2], [0,-1,2], [1,-1,2], [2,-1,2],
      // Couche 0
      [-2,0,-2], [-1,0,-2],[0,0,-2],[1,0,-2],[2,0,-2],
      [-2,0,-1], [-1,0,-1],[0,0,-1],[1,0,-1],[2,0,-1],
      [-2,0,0],  [-1,0,0], [1,0,0], [2,0,0],
      [-2,0,1],  [-1,0,1], [0,0,1], [1,0,1], [2,0,1],
      [-2,0,2],  [-1,0,2], [0,0,2], [1,0,2], [2,0,2],
      // Couche +1
      [-1,1,-1],[0,1,-1],[1,1,-1],
      [-1,1,0], [0,1,0], [1,1,0],
      [-1,1,1], [0,1,1], [1,1,1],
      // Couche +2
      [0,2,0],
    ];

    for (const [dx, dy, dz] of leafOffsets) {
      const lx2 = lx + dx;
      const ly2 = topY + dy;
      const lz2 = lz + dz;
      if (lx2 < 0 || lx2 >= CHUNK_WIDTH || lz2 < 0 || lz2 >= CHUNK_DEPTH) continue;
      if (ly2 < 0 || ly2 >= CHUNK_HEIGHT) continue;
      if (chunk.blockIds[_idx(lx2, ly2, lz2)] === BlockID.AIR) {
        chunk.blockIds[_idx(lx2, ly2, lz2)] = BlockID.LEAVES;
      }
    }
  }
}

// ─────────────────────────────────────────────────────────────
//  Helpers
// ─────────────────────────────────────────────────────────────
function _idx(x, y, z) { return (y << 8) | (z << 4) | x; }

function _hash(x, z, seed) {
  let h = (x * 374761393 + z * 1111111111 + seed * 2246822519) >>> 0;
  h ^= h >> 16; h = Math.imul(h, 0x45d9f3b); h ^= h >> 16;
  return h;
}
