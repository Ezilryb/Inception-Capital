'use strict';

import { RECIPES } from './CraftingRecipes.js';
import { ItemStack } from './Inventory.js';

// ─────────────────────────────────────────────────────────────
//  CraftingSystem
//  Manages a crafting grid (2×2 or 3×3) and matches recipes.
//
//  Patterns use numeric item/block IDs directly — null = empty cell.
//  Matching: extract bounding box of filled cells, compare IDs.
// ─────────────────────────────────────────────────────────────
export class CraftingSystem {
  /** @param {2|3} size */
  constructor(size = 2) {
    this.size   = size;
    /** @type {(ItemStack|null)[]} row-major, size² slots */
    this.grid   = new Array(size * size).fill(null);
    /** @type {{id:number,count:number}|null} current matched output */
    this.result = null;

    this.onChange = null;
  }

  resize(size) {
    this.size   = size;
    this.grid   = new Array(size * size).fill(null);
    this.result = null;
    this._notify();
  }

  setSlot(index, stack) {
    this.grid[index] = stack;
    this.result = this._match();
    this._notify();
  }

  getSlot(index) { return this.grid[index]; }

  /** Craft one output: consume ingredients, return result ItemStack or null. */
  craft() {
    if (!this.result) return null;
    const out = new ItemStack(this.result.id, this.result.count);

    for (let i = 0; i < this.grid.length; i++) {
      const s = this.grid[i];
      if (s) {
        s.count -= 1;
        if (s.count <= 0) this.grid[i] = null;
      }
    }
    this.result = this._match();
    this._notify();
    return out;
  }

  clearGrid() {
    this.grid.fill(null);
    this.result = null;
    this._notify();
  }

  /** Return all items from grid (for UI close). Clears the grid. */
  dumpGrid() {
    const items = this.grid.filter(Boolean).map(s => s.clone());
    this.clearGrid();
    return items;
  }

  // ─────────────────────────────────────────────────────────
  //  Recipe matching
  // ─────────────────────────────────────────────────────────
  _match() {
    for (const recipe of RECIPES) {
      const matched = recipe.type === 'shapeless'
        ? this._matchShapeless(recipe)
        : this._matchShaped(recipe);
      if (matched) return recipe.result;
    }
    return null;
  }

  _matchShapeless(recipe) {
    const needed = [...recipe.ingredients];
    const have   = this.grid.filter(Boolean).map(s => s.id);
    if (needed.length !== have.length) return false;

    const used = new Set();
    for (const req of needed) {
      const idx = have.findIndex((id, i) => id === req && !used.has(i));
      if (idx === -1) return false;
      used.add(idx);
    }
    return true;
  }

  _matchShaped(recipe) {
    const { pattern } = recipe;
    const rRows = pattern.length;
    const rCols = Math.max(...pattern.map(r => r.length));

    if (rRows > this.size || rCols > this.size) return false;

    const bb = this._boundingBox();
    if (bb.minR < 0) return false; // empty grid

    const gRows = bb.maxR - bb.minR + 1;
    const gCols = bb.maxC - bb.minC + 1;
    if (gRows !== rRows || gCols !== rCols) return false;

    for (let r = 0; r < rRows; r++) {
      for (let c = 0; c < rCols; c++) {
        const cell     = this.grid[(bb.minR + r) * this.size + (bb.minC + c)];
        const required = (pattern[r][c] !== undefined ? pattern[r][c] : null);
        const actual   = cell ? cell.id : null;
        if (actual !== required) return false;
      }
    }
    return true;
  }

  _boundingBox() {
    let minR = Infinity, maxR = -Infinity, minC = Infinity, maxC = -Infinity;
    for (let i = 0; i < this.grid.length; i++) {
      if (this.grid[i] !== null) {
        const r = Math.floor(i / this.size);
        const c = i % this.size;
        if (r < minR) minR = r; if (r > maxR) maxR = r;
        if (c < minC) minC = c; if (c > maxC) maxC = c;
      }
    }
    return minR === Infinity
      ? { minR: -1, maxR: -1, minC: -1, maxC: -1 }
      : { minR, maxR, minC, maxC };
  }

  _notify() { if (this.onChange) this.onChange(); }
}
