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
    this._camPos   = new THREE.Vector3(0, 120, 0);
    this._camYaw   = 0;
    this._camPitch = -0.3;
    this._keys     = new Set();
    this._locked   = false;

    // ── Physique ─────────────────────────────────────────────
    this._velY       = 0;
    this._onGround   = false;
    this._flyMode    = false;    // F pour basculer
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

  // ── Input ───────────────────────────────────────────────
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
    
      // ── Mouvement horizontal ─────────────────────────────────────
      const oldX = this._camPos.x;
      const oldZ = this._camPos.z;
    
      if (this._keys.has('KeyW') || this._keys.has('ArrowUp'))    this._camPos.addScaledVector(forward,  spd * dt);
      if (this._keys.has('KeyS') || this._keys.has('ArrowDown'))  this._camPos.addScaledVector(forward, -spd * dt);
      if (this._keys.has('KeyA') || this._keys.has('ArrowLeft'))  this._camPos.addScaledVector(right,   -spd * dt);
      if (this._keys.has('KeyD') || this._keys.has('ArrowRight')) this._camPos.addScaledVector(right,    spd * dt);
    
      // Collision murs (X et Z séparément — permet le glissement)
      this._resolveHorizontal(oldX, oldZ);
    
      // ── Saut ─────────────────────────────────────────────────────
      if (this._jumpQueued && this._onGround) {
        this._velY     = this._JUMP_FORCE;
        this._onGround = false;
      }
      this._jumpQueued = false;
    
      // ── Gravité ──────────────────────────────────────────────────
      if (!this._onGround) {
        this._velY += this._GRAVITY * dt;
        if (this._velY < -60) this._velY = -60;
      }
      this._camPos.y += this._velY * dt;
    
      // Collision sol et plafond
      this._onGround = this._resolveGround();
      this._resolveCeiling();
    }

    this.renderer.setCameraTransform(
      this._camPos.x, this._camPos.y, this._camPos.z,
      this._camYaw, this._camPitch
    );
  }

  _resolveGround() {
    // Ne tester le sol que si on descend ou est immobile
    if (this._velY > 0.5) return false;
  
    const feetY  = this._camPos.y - this._PLAYER_H;
    const blockY = Math.floor(feetY);
    const CORNERS = [[ 0.3, 0.3], [ 0.3,-0.3], [-0.3, 0.3], [-0.3,-0.3]];
  
    for (const [dx, dz] of CORNERS) {
      const bx = Math.floor(this._camPos.x + dx);
      const bz = Math.floor(this._camPos.z + dz);
  
      // Vérifier blockY et blockY-1 : gère le cas limite feetY = entier exact
      for (let by = blockY; by >= blockY - 1; by--) {
        const id = this.worldManager.getBlockId(bx, by, bz);
  
        // Air (0) ou liquides (ids 8–11) : pas de collision
        if (id === 0 || (id >= 8 && id <= 11)) continue;
  
        // Pieds dans/sur un bloc solide → remonter à sa surface
        if (feetY < by + 1 + 0.001) {
          this._camPos.y = by + 1 + this._PLAYER_H;
          this._velY     = 0;
          return true;
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

  _isSolid(id) {
    return id !== 0 && !(id >= 8 && id <= 11);
  }

  /**
 * Collision contre les murs — axe X puis axe Z séparément.
 * La résolution en deux passes permet de glisser le long des murs
 * (si X est bloqué, on peut encore se déplacer en Z).
 */
  _resolveHorizontal(oldX, oldZ) {
  const W     = 0.3;                                // demi-largeur AABB
  const feetY = this._camPos.y - this._PLAYER_H;
  const yMin  = Math.floor(feetY + 0.05);           // bloc au niveau des pieds
  const yMax  = Math.floor(this._camPos.y - 0.05);  // bloc au niveau de la tête

  // ── Résolution X ────────────────────────────────────────────────
  const dx = this._camPos.x - oldX;
    if (Math.abs(dx) > 0.0001) {
      // Colonne de blocs touchée par la face avant du joueur en X
      const edgeX = dx > 0
        ? Math.floor(this._camPos.x + W)   // face droite
        : Math.floor(this._camPos.x - W);  // face gauche

      // Les deux bords Z du joueur
      const zA = Math.floor(this._camPos.z - W + 0.01);
      const zB = Math.floor(this._camPos.z + W - 0.01);

      let blocked = false;
      outer: for (let y = yMin; y <= yMax; y++) {
        for (const bz of [zA, zB]) {
          if (this._isSolid(this.worldManager.getBlockId(edgeX, y, bz))) {
            blocked = true; break outer;
          }
        }
      }
      if (blocked) {
        // Coller la face du joueur contre la face du bloc
        this._camPos.x = dx > 0 ? edgeX - W : edgeX + 1 + W;
      }
    }

    // ── Résolution Z ────────────────────────────────────────────────
    const dz = this._camPos.z - oldZ;
    if (Math.abs(dz) > 0.0001) {
      const edgeZ = dz > 0
        ? Math.floor(this._camPos.z + W)
        : Math.floor(this._camPos.z - W);

      // Les deux bords X du joueur (position mise à jour après résolution X)
      const xA = Math.floor(this._camPos.x - W + 0.01);
      const xB = Math.floor(this._camPos.x + W - 0.01);

      let blocked = false;
      outer: for (let y = yMin; y <= yMax; y++) {
        for (const bx of [xA, xB]) {
          if (this._isSolid(this.worldManager.getBlockId(bx, y, edgeZ))) {
            blocked = true; break outer;
          }
        }
      }
      if (blocked) {
        this._camPos.z = dz > 0 ? edgeZ - W : edgeZ + 1 + W;
      }
    }
  }

  /** Collision avec le plafond — annule velY si le joueur monte dans un bloc. */
  _resolveCeiling() {
    if (this._velY <= 0) return;  // seulement en montant

    const headY = Math.floor(this._camPos.y);  // bloc au niveau des yeux
    const W     = 0.3;
    const corners = [
      [Math.floor(this._camPos.x - W + 0.01), Math.floor(this._camPos.z - W + 0.01)],
      [Math.floor(this._camPos.x + W - 0.01), Math.floor(this._camPos.z - W + 0.01)],
      [Math.floor(this._camPos.x - W + 0.01), Math.floor(this._camPos.z + W - 0.01)],
      [Math.floor(this._camPos.x + W - 0.01), Math.floor(this._camPos.z + W - 0.01)],
    ];

    for (const [bx, bz] of corners) {
      if (this._isSolid(this.worldManager.getBlockId(bx, headY, bz))) {
        this._camPos.y = headY - 0.001;  // coller sous le plafond
        this._velY     = 0;              // saut annulé
        return;
      }
    }
  }
  
}
