'use strict';

export const HOTBAR_SIZE  = 9;
export const INV_ROWS     = 3;
export const INV_COLS     = 9;
export const INV_SIZE     = HOTBAR_SIZE + INV_ROWS * INV_COLS; // 36

// ─────────────────────────────────────────────────────────────
//  ItemStack — a slot's contents
// ─────────────────────────────────────────────────────────────
export class ItemStack {
  constructor(id, count = 1, meta = 0) {
    this.id    = id;
    this.count = count;
    this.meta  = meta;
  }
  clone() { return new ItemStack(this.id, this.count, this.meta); }
}

// ─────────────────────────────────────────────────────────────
//  Inventory
//  Slot layout : [0..8] = hotbar, [9..35] = main inventory
// ─────────────────────────────────────────────────────────────
export class Inventory {
  constructor() {
    /** @type {(ItemStack|null)[]} */
    this.slots = new Array(INV_SIZE).fill(null);
    this.hotbarIndex = 0;

    // Fired when any slot changes – subscribers can refresh UI
    this.onChange = null;
  }

  // ── Hotbar ───────────────────────────────────────────────
  getSelectedStack() { return this.slots[this.hotbarIndex]; }

  setHotbarIndex(i) {
    if (i >= 0 && i < HOTBAR_SIZE) {
      this.hotbarIndex = i;
      this._notify();
    }
  }

  scrollHotbar(delta) {
    this.hotbarIndex = ((this.hotbarIndex + delta) % HOTBAR_SIZE + HOTBAR_SIZE) % HOTBAR_SIZE;
    this._notify();
  }

  removeFromSelected(count = 1) {
    const stack = this.slots[this.hotbarIndex];
    if (!stack) return;
    stack.count -= count;
    if (stack.count <= 0) this.slots[this.hotbarIndex] = null;
    this._notify();
  }

  // ── Generic slot access ──────────────────────────────────
  get(index)        { return this.slots[index]; }
  set(index, stack) { this.slots[index] = stack; this._notify(); }

  // ── Add item to first available slot ────────────────────
  addItem(id, count = 1, meta = 0) {
    let remaining = count;

    // 1) Try to stack in existing matching slots
    for (let i = 0; i < INV_SIZE && remaining > 0; i++) {
      const s = this.slots[i];
      if (s && s.id === id && s.meta === meta && s.count < 64) {
        const add = Math.min(remaining, 64 - s.count);
        s.count += add;
        remaining -= add;
      }
    }

    // 2) Fill empty slots
    for (let i = 0; i < INV_SIZE && remaining > 0; i++) {
      if (!this.slots[i]) {
        const add = Math.min(remaining, 64);
        this.slots[i] = new ItemStack(id, add, meta);
        remaining -= add;
      }
    }

    if (remaining < count) this._notify();
    return remaining === 0; // true = all items fit
  }

  // ── Remove from a specific slot ──────────────────────────
  removeFromSlot(index, count = 1) {
    const s = this.slots[index];
    if (!s) return 0;
    const removed = Math.min(count, s.count);
    s.count -= removed;
    if (s.count <= 0) this.slots[index] = null;
    this._notify();
    return removed;
  }

  // ── Swap / move items between slots ─────────────────────
  swapSlots(a, b) {
    [this.slots[a], this.slots[b]] = [this.slots[b], this.slots[a]];
    this._notify();
  }

  // Move one item from slot a to slot b (or half-stack if right-click)
  splitSlot(from, to, half = false) {
    const src = this.slots[from];
    if (!src) return;
    const give = half ? Math.ceil(src.count / 2) : src.count;

    const dst = this.slots[to];
    if (dst && (dst.id !== src.id || dst.meta !== src.meta)) return; // incompatible

    const canAdd = Math.min(give, 64 - (dst ? dst.count : 0));
    if (!dst) {
      this.slots[to] = new ItemStack(src.id, canAdd, src.meta);
    } else {
      dst.count += canAdd;
    }
    src.count -= canAdd;
    if (src.count <= 0) this.slots[from] = null;
    this._notify();
  }

  _notify() {
    if (this.onChange) this.onChange();
  }
}
