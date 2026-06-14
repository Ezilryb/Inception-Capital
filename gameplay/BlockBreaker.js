'use strict';

import { REGISTRY }              from '../world/BlockRegistry.js';
import { getItemInfo, isBlockItem, resolveDropName, TOOL_SPEED } from './Items.js';

// ─────────────────────────────────────────────────────────────
//  BlockBreaker
//  Implements the Minecraft 1.0 dig-speed formula:
//
//    With correct tool type and level:
//      t = hardness × 1.5 / speedMult   (seconds)
//
//    With wrong tool or bare hand (when not requiresTool):
//      t = hardness × 5                  (seconds)
//
//    With wrong tool (when requiresTool === true):
//      t = hardness × 5, AND no drops
//
//    Bedrock (hardness < 0) → unbreakable
//
//  Visual crack stages: 0-9 as in MC (10 stages of cracking texture).
// ─────────────────────────────────────────────────────────────
export class BlockBreaker {
  constructor(worldManager, inventory) {
    this._world     = worldManager;
    this._inventory = inventory;

    this._targetX   = null;
    this._targetY   = null;
    this._targetZ   = null;
    this._elapsed   = 0;
    this._breakTime = 0;      // seconds needed to break current block
    this._crackStage = -1;    // -1 = not breaking
    this._wrongTool  = false; // will it drop anything?

    /** @type {function(number, {x,y,z}|null):void} progress 0→1, position */
    this.onProgress = null;
    /** @type {function():void} fired after block is removed from world */
    this.onBlockBroken = null;
  }

  // ── Public API ───────────────────────────────────────────

  /**
   * Call every frame while LMB is held, with the currently targeted block.
   * If target changes, resets progress.
   */
  update(dt, wx, wy, wz) {
    // Target changed → reset
    if (wx !== this._targetX || wy !== this._targetY || wz !== this._targetZ) {
      this._startOn(wx, wy, wz);
    }
    if (this._crackStage < 0) return; // unbreakable

    this._elapsed += dt;
    const progress = Math.min(1, this._elapsed / this._breakTime);
    const stage    = Math.floor(progress * 10); // 0-10

    if (stage !== this._crackStage) {
      this._crackStage = stage;
      if (this.onProgress) this.onProgress(progress, { x: wx, y: wy, z: wz });
    }

    if (progress >= 1) this._breakBlock();
  }

  stopBreaking() {
    if (this._crackStage >= 0 && this.onProgress) {
      this.onProgress(0, null);
    }
    this._reset();
  }

  isBreaking() { return this._crackStage >= 0; }
  getProgress() {
    if (!this.isBreaking()) return 0;
    return Math.min(1, this._elapsed / this._breakTime);
  }

  // ── Private ──────────────────────────────────────────────

  _startOn(wx, wy, wz) {
    this._targetX = wx;
    this._targetY = wy;
    this._targetZ = wz;
    this._elapsed = 0;
    this._crackStage = -1;

    const id    = this._world.getBlockId(wx, wy, wz);
    const block = REGISTRY.get(id);
    if (!block || id === 0 || block.hardness < 0) return; // air or bedrock

    const { time, wrongTool } = this._calcBreakTime(block);
    this._breakTime  = time;
    this._wrongTool  = wrongTool;
    this._crackStage = 0;

    if (this.onProgress) this.onProgress(0, { x: wx, y: wy, z: wz });
  }

  _calcBreakTime(block) {
    const equipped   = this._inventory.getSelectedStack();
    const toolItemId = equipped?.id ?? null;

    let speedMult = 1;
    let correctType = false;

    if (toolItemId !== null) {
      if (isBlockItem(toolItemId)) {
        // Holding a block item in hand — counts as no tool
      } else {
        const toolInfo = getItemInfo(toolItemId);
        if (toolInfo && toolInfo.toolType && block.toolType === toolInfo.toolType) {
          correctType = true;
          // Use TOOL_SPEED; golden tools use level 5
          speedMult = TOOL_SPEED[toolInfo.toolLevel] ?? 1;
        }
      }
    }

    const requiresCorrectTool = block.requiresTool && !correctType;

    if (requiresCorrectTool) {
      // MC formula: hardness × 5, but yields no drops
      return { time: Math.max(0.05, block.hardness * 5), wrongTool: true };
    }

    const base = correctType
      ? (block.hardness * 1.5 / speedMult)
      : (block.hardness * 5);

    return { time: Math.max(0.05, base), wrongTool: false };
  }

  _breakBlock() {
    const wx = this._targetX, wy = this._targetY, wz = this._targetZ;
    const id    = this._world.getBlockId(wx, wy, wz);
    const block = REGISTRY.get(id);

    if (block && id !== 0) {
      if (!this._wrongTool) {
        this._giveDrops(block);
      }
      this._world.setBlockId(wx, wy, wz, 0); // remove block
    }

    if (this.onBlockBroken) this.onBlockBroken();
    this._reset();
  }

  _giveDrops(block) {
    const drops = block.drops;
    if (drops === 'nothing') return;

    if (drops === 'self') {
      this._inventory.addItem(block.id, 1);
      return;
    }

    if (Array.isArray(drops)) {
      for (const drop of drops) {
        // Probability check
        if (drop.probability !== undefined && Math.random() > drop.probability) continue;

        // Count: fixed or range
        const count = (drop.min !== undefined)
          ? drop.min + Math.floor(Math.random() * (drop.max - drop.min + 1))
          : (drop.count ?? 1);

        // Resolve itemName to an ID
        const resolved = resolveDropName(drop.itemName);
        const itemId   = resolved ?? block.id; // fallback: give the block itself
        this._inventory.addItem(itemId, count);
      }
      return;
    }

    // Fallback
    this._inventory.addItem(block.id, 1);
  }

  _reset() {
    this._targetX = this._targetY = this._targetZ = null;
    this._elapsed = 0;
    this._crackStage = -1;
    this._wrongTool = false;
  }
}
