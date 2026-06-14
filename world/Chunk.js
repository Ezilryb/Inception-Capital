/**
 * ============================================================
 *  Chunk.js — Minecraft 1.0 Recreation
 * ============================================================
 */
'use strict';

import { REGISTRY } from './BlockRegistry.js';
import { BlockID }  from './BlockRegistry.js';

export const CHUNK_WIDTH  = 16;
export const CHUNK_DEPTH  = 16;
export const CHUNK_HEIGHT = 256;
export const CHUNK_VOLUME = CHUNK_WIDTH * CHUNK_DEPTH * CHUNK_HEIGHT;

const NIBBLE_SIZE = CHUNK_VOLUME >> 1;

function getNibble(arr, i) {
  const byte = arr[i >> 1];
  return (i & 1) ? (byte >> 4) : (byte & 0x0F);
}
function setNibble(arr, i, value) {
  const half = i >> 1;
  if (i & 1) {
    arr[half] = (arr[half] & 0x0F) | ((value & 0x0F) << 4);
  } else {
    arr[half] = (arr[half] & 0xF0) | (value & 0x0F);
  }
}

export class Chunk {
  constructor(chunkX, chunkZ) {
    this.chunkX  = chunkX;
    this.chunkZ  = chunkZ;
    this.worldX  = chunkX * CHUNK_WIDTH;
    this.worldZ  = chunkZ * CHUNK_DEPTH;

    this.blockIds   = new Uint8Array(CHUNK_VOLUME);
    this.metadata   = new Uint8Array(NIBBLE_SIZE);
    this.skyLight   = new Uint8Array(NIBBLE_SIZE);
    this.blockLight = new Uint8Array(NIBBLE_SIZE);

    this.isDirty     = true;
    this.isGenerated = false;
    this.heightMap   = new Uint8Array(CHUNK_WIDTH * CHUNK_DEPTH);
  }

  static index(x, y, z) { return (y << 8) | (z << 4) | x; }

  static inBounds(x, y, z) {
    return x >= 0 && x < CHUNK_WIDTH && y >= 0 && y < CHUNK_HEIGHT && z >= 0 && z < CHUNK_DEPTH;
  }

  getBlockId(x, y, z) {
    if (!Chunk.inBounds(x, y, z)) return BlockID.AIR;
    return this.blockIds[Chunk.index(x, y, z)];
  }

  setBlockId(x, y, z, id) {
    if (!Chunk.inBounds(x, y, z)) return;
    this.blockIds[Chunk.index(x, y, z)] = id;
    this.isDirty = true;
    const col = x + z * CHUNK_WIDTH;
    if (id !== BlockID.AIR) {
      if (y > this.heightMap[col]) this.heightMap[col] = y;
    } else if (y === this.heightMap[col]) {
      this._recalcHeight(x, z);
    }
  }

  getBlock(x, y, z) { return REGISTRY.get(this.getBlockId(x, y, z)); }

  getMeta(x, y, z) {
    if (!Chunk.inBounds(x, y, z)) return 0;
    return getNibble(this.metadata, Chunk.index(x, y, z));
  }
  setMeta(x, y, z, value) {
    if (!Chunk.inBounds(x, y, z)) return;
    setNibble(this.metadata, Chunk.index(x, y, z), value);
    this.isDirty = true;
  }

  getSkyLight(x, y, z) {
    if (!Chunk.inBounds(x, y, z)) return 15;
    return getNibble(this.skyLight, Chunk.index(x, y, z));
  }
  setSkyLight(x, y, z, value) {
    if (!Chunk.inBounds(x, y, z)) return;
    setNibble(this.skyLight, Chunk.index(x, y, z), value);
    this.isDirty = true;
  }

  getBlockLight(x, y, z) {
    if (!Chunk.inBounds(x, y, z)) return 0;
    return getNibble(this.blockLight, Chunk.index(x, y, z));
  }
  setBlockLight(x, y, z, value) {
    if (!Chunk.inBounds(x, y, z)) return;
    setNibble(this.blockLight, Chunk.index(x, y, z), value);
    this.isDirty = true;
  }

  getLight(x, y, z) {
    return Math.max(this.getSkyLight(x, y, z), this.getBlockLight(x, y, z));
  }

  getHeight(x, z) { return this.heightMap[x + z * CHUNK_WIDTH]; }

  buildHeightMap() {
    for (let z = 0; z < CHUNK_DEPTH;  z++)
    for (let x = 0; x < CHUNK_WIDTH; x++)
      this._recalcHeight(x, z);
  }

  _recalcHeight(x, z) {
    const col = x + z * CHUNK_WIDTH;
    for (let y = CHUNK_HEIGHT - 1; y >= 0; y--) {
      if (this.blockIds[Chunk.index(x, y, z)] !== BlockID.AIR) {
        this.heightMap[col] = y; return;
      }
    }
    this.heightMap[col] = 0;
  }

  propagateSkyLight() {
    for (let z = 0; z < CHUNK_DEPTH; z++) {
      for (let x = 0; x < CHUNK_WIDTH; x++) {
        let light = 15;
        for (let y = CHUNK_HEIGHT - 1; y >= 0; y--) {
          const block = REGISTRY.get(this.blockIds[Chunk.index(x, y, z)]);
          if (block.opacity >= 15) light = 0;
          setNibble(this.skyLight, Chunk.index(x, y, z), light);
          if (light > 0 && block.opacity > 0) light = Math.max(0, light - block.opacity);
        }
      }
    }
  }

  serialize() {
    return {
      chunkX:     this.chunkX,
      chunkZ:     this.chunkZ,
      blockIds:   Array.from(this.blockIds),
      metadata:   Array.from(this.metadata),
      skyLight:   Array.from(this.skyLight),
      blockLight: Array.from(this.blockLight),
      heightMap:  Array.from(this.heightMap),
    };
  }

  static deserialize(data) {
    const chunk = new Chunk(data.chunkX, data.chunkZ);
    chunk.blockIds.set(data.blockIds);
    chunk.metadata.set(data.metadata);
    chunk.skyLight.set(data.skyLight);
    chunk.blockLight.set(data.blockLight);
    chunk.heightMap.set(data.heightMap);
    chunk.isGenerated = true;
    chunk.isDirty     = true;
    return chunk;
  }

  toString() { return `Chunk[${this.chunkX}, ${this.chunkZ}] dirty=${this.isDirty}`; }
}
