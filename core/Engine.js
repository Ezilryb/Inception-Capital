/**
 * ============================================================
 *  Engine.js — PATCHED v2
 *  Corrections : gravité, collision sol, toggle fly (F)
 * ============================================================
 */
'use strict';

import * as THREE from 'three';
import { WorldManager }    from '../world/WorldManager.js';
import { WorldGenerator }  from '../generation/WorldGenerator.js';
import { Renderer }        from '../renderer/Renderer.js';
import { ChunkMesher }     from '../renderer/ChunkMesher.js';
import { TextureAtlas }    from '../renderer/TextureAtlas.js';

export class Engine {
  constructor({ container, seed = 42, viewDistance = 6 }) {
    this._container = container;
    this._running   = false;
    this._lastTime  = 0;

    // ── Systèmes ─────────────────────────────────────────────
    const generator = new WorldGenerator({ seed, seaLevel: 63 });
    this.worldManager = new WorldManager({ generator, viewDistance });
    this.renderer = new Renderer({ container, viewDistance, fov: 70, antialias: false });

    const atlasTexture = TextureAtlas.createProceduralAtlas();
    const materials    = ChunkMesher.createMaterials(atlasTexture);
    this.mesher        = new ChunkMesher(materials);

    // ── Caméra ───────────────────────────────────────────────
    this._camPos   = new THREE.Vector3(0, 75, 0);
    this._camYaw   = 0;
    this._camPitch = -0.3;
    this._keys     = new Set();
    this._locked   = false;

    // ── Physique ─────────────────────────────────────────────
    this._velY       = 0;
    this._onGround   = false;
    this._flyMode    = true;    // F pour basculer
    this._jumpQueued = false;
    this._GRAVITY    = -28;
    this._JUMP_FORCE = 10;
    this._PLAYER_H   = 1.8;

    // ── Events ───────────────────────────────────────────────
    this.worldManager.addEventListener('chunkUnloaded', e => {
      this.renderer.removeChunkMesh(e.chunk.chunkX, e.chunk.chunkZ);
    });

    this._setupInput(container);
    console.log('[Engine v2] Initialisé — touche F = basculer gravité/fly');
  }

  _setupInput(container) {
    window.addEventListener('keydown', e => {
      this._keys.add(e.code);
      if (e.code === 'KeyF') {
        this._flyMode = !this._flyMode;
        this._velY    = 0;
        console.log('[Engine] Mode:', this._flyMode ? 'FLY (vol libre)' : 'SURVIE (gravité)');
      }
      if (e.code === 'Space' && !this._flyMode) {
        this._jumpQueued = true;
      }
    });
    window.addEventListener('keyup', e => this._keys.delete(e.code));

    container.addEventListener('click', () => container.requestPointerLock());
    document.addEventListener('pointerlockchange', () => {
      this._locked = document.pointerLockElement === container;
    });
    document.addEventListener('mousemove', e => {
      if (!this._locked) return;
      this._camYaw   -= e.movementX * 0.002;
      this._camPitch -= e.movementY * 0.002;
      this._camPitch  = Math.max(-Math.PI / 2 + 0.01, Math.min(Math.PI / 2 - 0.01, this._camPitch));
    });
  }

  start() {
    this._running  = true;
    this._lastTime = performance.now();
    requestAnimationFrame(t => this._loop(t));
  }

  stop() { this._running = false; }

  _loop(timestamp) {
    if (!this._running) return;
    const dt = Math.min((timestamp - this._lastTime) / 1000, 0.1);
    this._lastTime = timestamp;

    this._updateCamera(dt);
    this.worldManager.update(this._camPos.x, this._camPos.z);
    this._remeshDirty();
    this.renderer.render();

    requestAnimationFrame(t => this._loop(t));
  }

  _updateCamera(dt) {
    const sprint  = this._keys.has('ShiftLeft');
    const forward = new THREE.Vector3(-Math.sin(this._camYaw), 0, -Math.cos(this._camYaw));
    const right   = new THREE.Vector3( Math.cos(this._camYaw), 0, -Math.sin(this._camYaw));

    if (this._flyMode) {
      const spd = sprint ? 40 : 10;
      if (this._keys.has('KeyW') || this._keys.has('ArrowUp'))    this._camPos.addScaledVector(forward,  spd * dt);
      if (this._keys.has('KeyS') || this._keys.has('ArrowDown'))  this._camPos.addScaledVector(forward, -spd * dt);
      if (this._keys.has('KeyA') || this._keys.has('ArrowLeft'))  this._camPos.addScaledVector(right,   -spd * dt);
      if (this._keys.has('KeyD') || this._keys.has('ArrowRight')) this._camPos.addScaledVector(right,    spd * dt);
      if (this._keys.has('Space'))       this._camPos.y += spd * dt;
      if (this._keys.has('ControlLeft')) this._camPos.y -= spd * dt;
    } else {
      const spd = sprint ? 8.0 : 4.3;
      if (this._keys.has('KeyW') || this._keys.has('ArrowUp'))    this._camPos.addScaledVector(forward,  spd * dt);
      if (this._keys.has('KeyS') || this._keys.has('ArrowDown'))  this._camPos.addScaledVector(forward, -spd * dt);
      if (this._keys.has('KeyA') || this._keys.has('ArrowLeft'))  this._camPos.addScaledVector(right,   -spd * dt);
      if (this._keys.has('KeyD') || this._keys.has('ArrowRight')) this._camPos.addScaledVector(right,    spd * dt);

      if (this._jumpQueued && this._onGround) {
        this._velY     = this._JUMP_FORCE;
        this._onGround = false;
      }
      this._jumpQueued = false;

      this._velY += this._GRAVITY * dt;
      if (this._velY < -60) this._velY = -60;

      this._camPos.y += this._velY * dt;
      this._onGround  = this._resolveGround();
    }

    this.renderer.setCameraTransform(
      this._camPos.x, this._camPos.y, this._camPos.z,
      this._camYaw, this._camPitch
    );
  }

  _resolveGround() {
    const feetY  = this._camPos.y - this._PLAYER_H;
    const blockY = Math.floor(feetY);
    const corners = [[0.29, 0.29],[0.29,-0.29],[-0.29, 0.29],[-0.29,-0.29]];

    for (const [dx, dz] of corners) {
      const bx = Math.floor(this._camPos.x + dx);
      const bz = Math.floor(this._camPos.z + dz);
      const id = this.worldManager.getBlockId(bx, blockY, bz);
      if (id !== 0 && id < 8 || id > 11) {
        if (id !== 0) {
          const top = blockY + 1;
          if (feetY < top && this._velY <= 0) {
            this._camPos.y = top + this._PLAYER_H;
            this._velY     = 0;
            return true;
          }
        }
      }
    }
    return false;
  }

  _remeshDirty() {
    const dirty = this.worldManager.getDirtyChunks();
    for (let i = 0; i < Math.min(dirty.length, 3); i++) {
      const chunk     = dirty[i];
      const neighbors = this.worldManager.getNeighbors(chunk.chunkX, chunk.chunkZ);
      const meshes    = this.mesher.build(chunk, neighbors);
      this.renderer.setChunkMesh(chunk.chunkX, chunk.chunkZ, meshes);
      chunk.isDirty = false;
    }
  }

  getStats() {
    const r = this.renderer.getStats();
    return {
      ...r,
      pos: `${this._camPos.x.toFixed(1)}, ${this._camPos.y.toFixed(1)}, ${this._camPos.z.toFixed(1)}`,
    };
  }
}
