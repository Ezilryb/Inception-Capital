/**
 * ============================================================
 *  WorldManager.js — Minecraft 1.0 Recreation
 * ============================================================
 *  Gère le chargement, la génération et le déchargement des chunks.
 *  Interface pub/sub légère via EventTarget.
 * ============================================================
 */
'use strict';

import { Chunk, CHUNK_WIDTH, CHUNK_DEPTH } from './Chunk.js';

export class WorldManager extends EventTarget {
  constructor({ generator, viewDistance = 8 }) {
    super();
    this._generator    = generator;
    this._viewDistance = viewDistance;
    /** @type {Map<string, Chunk>} */
    this._chunks       = new Map();
    this._generateQueue = [];
    this._chunksPerTick = 2;
  }

  static _key(cx, cz) { return `${cx},${cz}`; }

  getChunk(cx, cz) { return this._chunks.get(WorldManager._key(cx, cz)) ?? null; }

  /** Coordonnées monde → coordonnées chunk */
  static worldToChunk(wx, wz) {
    return { cx: Math.floor(wx / CHUNK_WIDTH), cz: Math.floor(wz / CHUNK_DEPTH) };
  }
  /** Coordonnées monde → locales dans le chunk */
  static worldToLocal(wx, wz) {
    return {
      lx: ((wx % CHUNK_WIDTH)  + CHUNK_WIDTH)  % CHUNK_WIDTH,
      lz: ((wz % CHUNK_DEPTH)  + CHUNK_DEPTH)  % CHUNK_DEPTH,
    };
  }

  // ── Accès monde ────────────────────────────────────────────
  getBlockId(wx, wy, wz) {
    const { cx, cz } = WorldManager.worldToChunk(wx, wz);
    const chunk = this.getChunk(cx, cz);
    if (!chunk) return 0;
    const { lx, lz } = WorldManager.worldToLocal(wx, wz);
    return chunk.getBlockId(lx, wy, lz);
  }

  setBlockId(wx, wy, wz, id) {
    const { cx, cz } = WorldManager.worldToChunk(wx, wz);
    const chunk = this.getChunk(cx, cz);
    if (!chunk) return;
    const { lx, lz } = WorldManager.worldToLocal(wx, wz);
    chunk.setBlockId(lx, wy, lz, id);
    // Propager dirty aux chunks frontières
    if (lx === 0)              { const n = this.getChunk(cx - 1, cz); if (n) n.isDirty = true; }
    if (lx === CHUNK_WIDTH - 1){ const n = this.getChunk(cx + 1, cz); if (n) n.isDirty = true; }
    if (lz === 0)              { const n = this.getChunk(cx, cz - 1); if (n) n.isDirty = true; }
    if (lz === CHUNK_DEPTH - 1){ const n = this.getChunk(cx, cz + 1); if (n) n.isDirty = true; }
  }

  // ── Update (appelé chaque frame par Engine) ───────────────
  update(playerX, playerZ) {
    const { cx: pcx, cz: pcz } = WorldManager.worldToChunk(playerX, playerZ);
    this._scheduleChunks(pcx, pcz);
    this._processQueue();
    this._unloadDistant(pcx, pcz);
  }

  _scheduleChunks(pcx, pcz) {
    const r = this._viewDistance;
    for (let dz = -r; dz <= r; dz++) {
      for (let dx = -r; dx <= r; dx++) {
        if (dx * dx + dz * dz > r * r) continue;
        const cx = pcx + dx;
        const cz = pcz + dz;
        const key = WorldManager._key(cx, cz);
        if (!this._chunks.has(key) && !this._generateQueue.find(e => e.key === key)) {
          const dist = dx * dx + dz * dz;
          this._generateQueue.push({ cx, cz, key, dist });
        }
      }
    }
    this._generateQueue.sort((a, b) => a.dist - b.dist);
  }

  _processQueue() {
    for (let i = 0; i < this._chunksPerTick && this._generateQueue.length > 0; i++) {
      const { cx, cz, key } = this._generateQueue.shift();
      if (this._chunks.has(key)) continue;
      const chunk = new Chunk(cx, cz);
      this._generator.generate(chunk);
      chunk.buildHeightMap();
      chunk.propagateSkyLight();
      chunk.isGenerated = true;
      this._chunks.set(key, chunk);
      this.dispatchEvent(Object.assign(new Event('chunkLoaded'), { chunk }));
    }
  }

  _unloadDistant(pcx, pcz) {
    const maxDist = (this._viewDistance + 2) ** 2;
    for (const [key, chunk] of this._chunks) {
      const dx = chunk.chunkX - pcx;
      const dz = chunk.chunkZ - pcz;
      if (dx * dx + dz * dz > maxDist) {
        this._chunks.delete(key);
        this._generateQueue = this._generateQueue.filter(e => e.key !== key);
        this.dispatchEvent(Object.assign(new Event('chunkUnloaded'), { chunk }));
      }
    }
  }

  getDirtyChunks() {
    const dirty = [];
    for (const chunk of this._chunks.values()) {
      if (chunk.isDirty) dirty.push(chunk);
    }
    return dirty;
  }

  getNeighbors(cx, cz) {
    return {
      px: this.getChunk(cx + 1, cz),
      nx: this.getChunk(cx - 1, cz),
      pz: this.getChunk(cx, cz + 1),
      nz: this.getChunk(cx, cz - 1),
    };
  }
}
