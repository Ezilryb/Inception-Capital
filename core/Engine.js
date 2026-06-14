/**
 * ============================================================
 *  Engine.js — PATCHED v3
 *  Ajouts : destruction de blocs (timings MC), inventaire, craft
 * ============================================================
 */
'use strict';

import * as THREE from 'three';
import { WorldManager }    from '../world/WorldManager.js';
import { WorldGenerator }  from '../generation/WorldGenerator.js';
import { Renderer }        from '../renderer/Renderer.js';
import { ChunkMesher }     from '../renderer/ChunkMesher.js';
import { TextureAtlas }    from '../renderer/TextureAtlas.js';
import { BlockID }         from '../world/BlockRegistry.js';
import { isBlockItem }     from '../gameplay/Items.js';
import { Inventory }       from '../gameplay/Inventory.js';
import { BlockBreaker }    from '../gameplay/BlockBreaker.js';
import { CraftingSystem }  from '../gameplay/CraftingSystem.js';
import { UIManager }       from '../ui/UIManager.js';

export class Engine {
  constructor({ container, seed = 42, viewDistance = 6 }) {
    this._container = container;
    this._running   = false;
    this._lastTime  = 0;

    // ── Systèmes monde ───────────────────────────────────────
    const generator = new WorldGenerator({ seed, seaLevel: 63 });
    this.worldManager = new WorldManager({ generator, viewDistance });
    this.renderer = new Renderer({ container, viewDistance, fov: 70, antialias: false });

    const atlasTexture = TextureAtlas.createProceduralAtlas();
    const materials    = ChunkMesher.createMaterials(atlasTexture);
    this.mesher        = new ChunkMesher(materials);

    // ── Systèmes gameplay ────────────────────────────────────
    this.inventory    = new Inventory();
    this.blockBreaker = new BlockBreaker(this.worldManager, this.inventory);
    this.craft2       = new CraftingSystem(2);   // inventaire 2×2
    this.craft3       = new CraftingSystem(3);   // table de craft 3×3
    this.uiManager    = new UIManager(
      this.inventory, this.craft2, this.craft3,
      TextureAtlas.canvas   // expose the atlas canvas for item icons
    );

    // ── Caméra ───────────────────────────────────────────────
    this._camPos   = new THREE.Vector3(0, 120, 0);
    this._camYaw   = 0;
    this._camPitch = -0.3;
    this._keys     = new Set();
    this._locked   = false;

    // ── Physique ─────────────────────────────────────────────
    this._velY       = 0;
    this._onGround   = false;
    this._flyMode    = false;
    this._jumpQueued = false;
    this._GRAVITY    = -28;
    this._JUMP_FORCE = 10;
    this._PLAYER_H   = 1.8;

    // ── État souris ──────────────────────────────────────────
    this._breakMouseHeld = false;
    this._uiCausedUnlock = false;   // distingue ouverture UI vs ESC pur

    // ── Callbacks bloc-breaker ───────────────────────────────
    this.blockBreaker.onProgress = (progress, pos) => {
      this.uiManager.setBreakProgress(progress, pos);
    };
    this.blockBreaker.onBlockBroken = () => {
      this.uiManager.setBreakProgress(0, null);
      this.inventory.onChange = () => this.uiManager.refresh();
      this.uiManager.refresh();
    };
    this.inventory.onChange = () => this.uiManager.refresh();

    // ── Callback fermeture UI ────────────────────────────────
    this.uiManager.onClose = () => {
      if (!this._running) return;
      container.requestPointerLock();
    };

    // ── Events ───────────────────────────────────────────────
    this.worldManager.addEventListener('chunkUnloaded', e => {
      this.renderer.removeChunkMesh(e.chunk.chunkX, e.chunk.chunkZ);
    });

    this._setupInput(container);
    console.log('[Engine v3] Destruction blocs + Inventaire + Craft initialisés');
    console.log('  F = fly, E = inventaire, 1-9 = sélection, molette = défilement');
  }

  // ─────────────────────────────────────────────────────────
  //  Input
  // ─────────────────────────────────────────────────────────
  _setupInput(container) {
    // ── Clavier ──────────────────────────────────────────────
    window.addEventListener('keydown', e => {
      this._keys.add(e.code);

      // Fly mode toggle
      if (e.code === 'KeyF' && !this.uiManager.isUIOpen()) {
        this._flyMode = !this._flyMode;
        this._velY    = 0;
        console.log('[Engine] Mode:', this._flyMode ? 'FLY' : 'SURVIE');
      }

      // Saut
      if (e.code === 'Space' && !this._flyMode && !this.uiManager.isUIOpen()) {
        this._jumpQueued = true;
      }

      // ── Inventaire (E) ────────────────────────────────────
      if (e.code === 'KeyE') {
        if (this.uiManager.isInventoryOpen()) {
          this.uiManager.closeInventory();
          // onClose callback will re-request pointer lock
        } else if (this.uiManager.isCraftingTableOpen()) {
          this.uiManager.closeCraftingTable();
        } else {
          this._uiCausedUnlock = true;
          document.exitPointerLock();
          this.uiManager.openInventory();
        }
      }

      // ── Sélection raccourci (1-9) ─────────────────────────
      if (e.code.startsWith('Digit')) {
        const idx = parseInt(e.code.replace('Digit', '')) - 1;
        if (idx >= 0 && idx <= 8) {
          this.inventory.setHotbarIndex(idx);
        }
      }

      // ── Fermeture UI avec Échap ───────────────────────────
      if (e.code === 'Escape' && this.uiManager.isUIOpen()) {
        this.uiManager.closeAll();
        // pointerlockchange will handle re-locking if needed
      }
    });

    window.addEventListener('keyup', e => this._keys.delete(e.code));

    // ── Pointer lock ─────────────────────────────────────────
    container.addEventListener('click', () => {
      if (!this._locked && !this.uiManager.isUIOpen()) {
        container.requestPointerLock();
      }
    });

    document.addEventListener('pointerlockchange', () => {
      this._locked = document.pointerLockElement === container;
      if (!this._locked) {
        // Si l'UI n'a PAS causé l'unlock, c'est un ESC volontaire du joueur
        if (!this._uiCausedUnlock && this.uiManager.isUIOpen()) {
          this.uiManager.closeAll();
        }
        this._uiCausedUnlock = false;
        this._breakMouseHeld = false;
        this.blockBreaker.stopBreaking();
      }
    });

    document.addEventListener('mousemove', e => {
      if (!this._locked) return;
      this._camYaw   -= e.movementX * 0.002;
      this._camPitch -= e.movementY * 0.002;
      this._camPitch  = Math.max(-Math.PI / 2 + 0.01, Math.min(Math.PI / 2 - 0.01, this._camPitch));
    });

    // ── Souris : clic gauche (destruction) ───────────────────
    container.addEventListener('mousedown', e => {
      if (!this._locked) return;
      if (this.uiManager.isUIOpen()) return;
      e.preventDefault();

      if (e.button === 0) {
        this._breakMouseHeld = true;
      } else if (e.button === 2) {
        const target = this.renderer.getTargetBlock();
        if (target) this._interactWith(target);
      }
    });

    container.addEventListener('mouseup', e => {
      if (e.button === 0) {
        this._breakMouseHeld = false;
        this.blockBreaker.stopBreaking();
        this.uiManager.setBreakProgress(0, null);
      }
    });

    container.addEventListener('contextmenu', e => e.preventDefault());

    // ── Molette : sélection hotbar ────────────────────────────
    container.addEventListener('wheel', e => {
      if (!this._locked || this.uiManager.isUIOpen()) return;
      e.preventDefault();
      this.inventory.scrollHotbar(e.deltaY > 0 ? 1 : -1);
    }, { passive: false });
  }

  // ─────────────────────────────────────────────────────────
  //  Interaction (clic droit)
  // ─────────────────────────────────────────────────────────
  _interactWith(target) {
    const { blockPos, faceNormal } = target;
    const bx = blockPos.x, by = blockPos.y, bz = blockPos.z;
    const blockId = this.worldManager.getBlockId(bx, by, bz);

    // Ouvrir la table de craft
    if (blockId === BlockID.CRAFTING_TABLE) {
      this._uiCausedUnlock = true;
      document.exitPointerLock();
      this.uiManager.openCraftingTable();
      return;
    }

    // Placement de bloc
    const selected = this.inventory.getSelectedStack();
    if (!selected || !isBlockItem(selected.id)) return;

    const px = bx + Math.round(faceNormal.x);
    const py = by + Math.round(faceNormal.y);
    const pz = bz + Math.round(faceNormal.z);

    // Vérifier que la position ne coïncide pas avec le joueur
    const playerFeetY = Math.floor(this._camPos.y - this._PLAYER_H);
    const playerHeadY = Math.floor(this._camPos.y);
    const camXi = Math.floor(this._camPos.x);
    const camZi = Math.floor(this._camPos.z);

    const playerOccupies = (
      (px === camXi || px === camXi - 1 || px === camXi + 1) &&
      (py === playerFeetY || py === playerHeadY) &&
      (pz === camZi || pz === camZi - 1 || pz === camZi + 1)
    );

    if (playerOccupies) return;

    const existing = this.worldManager.getBlockId(px, py, pz);
    if (existing !== 0) return; // position occupée

    this.worldManager.setBlockId(px, py, pz, selected.id);
    this.inventory.removeFromSelected(1);
  }

  // ─────────────────────────────────────────────────────────
  //  Game loop
  // ─────────────────────────────────────────────────────────
  start() {
    this.uiManager.init();
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
    this._updateBlockBreaking(dt);
    this.worldManager.update(this._camPos.x, this._camPos.z);
    this._remeshDirty();
    this.renderer.render();

    requestAnimationFrame(t => this._loop(t));
  }

  // ─────────────────────────────────────────────────────────
  //  Block breaking (each frame, while LMB held)
  // ─────────────────────────────────────────────────────────
  _updateBlockBreaking(dt) {
    if (!this._breakMouseHeld || !this._locked || this.uiManager.isUIOpen()) {
      if (this.blockBreaker.isBreaking()) this.blockBreaker.stopBreaking();
      return;
    }

    const target = this.renderer.getTargetBlock();
    if (!target) {
      if (this.blockBreaker.isBreaking()) this.blockBreaker.stopBreaking();
      return;
    }

    const { blockPos } = target;
    this.blockBreaker.update(dt, blockPos.x, blockPos.y, blockPos.z);
  }

  // ─────────────────────────────────────────────────────────
  //  Camera & physics  (identique v2 + gestion UI-open)
  // ─────────────────────────────────────────────────────────
  _updateCamera(dt) {
    // Bloquer le mouvement quand l'UI est ouverte
    if (this.uiManager.isUIOpen()) return;

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
      const oldX = this._camPos.x;
      const oldZ = this._camPos.z;

      if (this._keys.has('KeyW') || this._keys.has('ArrowUp'))    this._camPos.addScaledVector(forward,  spd * dt);
      if (this._keys.has('KeyS') || this._keys.has('ArrowDown'))  this._camPos.addScaledVector(forward, -spd * dt);
      if (this._keys.has('KeyA') || this._keys.has('ArrowLeft'))  this._camPos.addScaledVector(right,   -spd * dt);
      if (this._keys.has('KeyD') || this._keys.has('ArrowRight')) this._camPos.addScaledVector(right,    spd * dt);

      this._resolveHorizontal(oldX, oldZ);

      if (this._jumpQueued && this._onGround) {
        this._velY     = this._JUMP_FORCE;
        this._onGround = false;
      }
      this._jumpQueued = false;

      if (!this._onGround) {
        this._velY += this._GRAVITY * dt;
        if (this._velY < -60) this._velY = -60;
      }
      this._camPos.y += this._velY * dt;

      this._onGround = this._resolveGround();
      this._resolveCeiling();
    }

    this.renderer.setCameraTransform(
      this._camPos.x, this._camPos.y, this._camPos.z,
      this._camYaw, this._camPitch
    );
  }

  // ─────────────────────────────────────────────────────────
  //  Physique helpers (inchangés vs v2)
  // ─────────────────────────────────────────────────────────
  _resolveGround() {
    if (this._velY > 0.5) return false;
    const feetY  = this._camPos.y - this._PLAYER_H;
    const blockY = Math.floor(feetY);
    const CORNERS = [[ 0.3, 0.3], [ 0.3,-0.3], [-0.3, 0.3], [-0.3,-0.3]];
    for (const [dx, dz] of CORNERS) {
      const bx = Math.floor(this._camPos.x + dx);
      const bz = Math.floor(this._camPos.z + dz);
      for (let by = blockY; by >= blockY - 1; by--) {
        const id = this.worldManager.getBlockId(bx, by, bz);
        if (id === 0 || (id >= 8 && id <= 11)) continue;
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

  _isSolid(id) { return id !== 0 && !(id >= 8 && id <= 11); }

  _resolveHorizontal(oldX, oldZ) {
    const W     = 0.3;
    const feetY = this._camPos.y - this._PLAYER_H;
    const yMin  = Math.floor(feetY + 0.05);
    const yMax  = Math.floor(this._camPos.y - 0.05);

    const dx = this._camPos.x - oldX;
    if (Math.abs(dx) > 0.0001) {
      const edgeX = dx > 0 ? Math.floor(this._camPos.x + W) : Math.floor(this._camPos.x - W);
      const zA = Math.floor(this._camPos.z - W + 0.01);
      const zB = Math.floor(this._camPos.z + W - 0.01);
      let blocked = false;
      outer: for (let y = yMin; y <= yMax; y++) {
        for (const bz of [zA, zB]) {
          if (this._isSolid(this.worldManager.getBlockId(edgeX, y, bz))) { blocked = true; break outer; }
        }
      }
      if (blocked) this._camPos.x = dx > 0 ? edgeX - W : edgeX + 1 + W;
    }

    const dz = this._camPos.z - oldZ;
    if (Math.abs(dz) > 0.0001) {
      const edgeZ = dz > 0 ? Math.floor(this._camPos.z + W) : Math.floor(this._camPos.z - W);
      const xA = Math.floor(this._camPos.x - W + 0.01);
      const xB = Math.floor(this._camPos.x + W - 0.01);
      let blocked = false;
      outer: for (let y = yMin; y <= yMax; y++) {
        for (const bx of [xA, xB]) {
          if (this._isSolid(this.worldManager.getBlockId(bx, y, edgeZ))) { blocked = true; break outer; }
        }
      }
      if (blocked) this._camPos.z = dz > 0 ? edgeZ - W : edgeZ + 1 + W;
    }
  }

  _resolveCeiling() {
    if (this._velY <= 0) return;
    const headY = Math.floor(this._camPos.y);
    const W     = 0.3;
    const corners = [
      [Math.floor(this._camPos.x - W + 0.01), Math.floor(this._camPos.z - W + 0.01)],
      [Math.floor(this._camPos.x + W - 0.01), Math.floor(this._camPos.z - W + 0.01)],
      [Math.floor(this._camPos.x - W + 0.01), Math.floor(this._camPos.z + W - 0.01)],
      [Math.floor(this._camPos.x + W - 0.01), Math.floor(this._camPos.z + W - 0.01)],
    ];
    for (const [bx, bz] of corners) {
      if (this._isSolid(this.worldManager.getBlockId(bx, headY, bz))) {
        this._camPos.y = headY - 0.001;
        this._velY     = 0;
        return;
      }
    }
  }
}
