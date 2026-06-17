// ============================================================
// CraftingUI — Minecraft-style crafting table window.
//
// Features:
//  • Toggle between 3×3 workbench and 2×2 player craft
//  • Click an inventory item to "hold" it, then click a grid
//    slot to place it (right-click / second click to remove)
//  • Live recipe preview updates with each change
//  • Click the result slot to collect the crafted stack
//  • Crafted items go into the hotbar (first available slot or
//    selected slot if empty)
//  • Inventory reflects the current hotbar so you can craft
//    with what you're carrying
// ============================================================

import { BLOCKS, PALETTE, B } from './blocks.js';
import { matchRecipe } from './crafting.js';

// Make BLOCKS accessible to crafting.js recipeName helper
window.__mc_blocks = { BLOCKS };

export class CraftingUI {
  /**
   * @param {{
   *   icons: Map<number,string>,
   *   getHotbar: () => number[],
   *   onCraft: (id: number, count: number) => void,
   *   onClose: () => void,
   * }} opts
   */
  constructor(opts) {
    this.icons = opts.icons;
    this.getHotbar = opts.getHotbar;
    this.onCraft = opts.onCraft;
    this.onClose = opts.onClose;

    // State
    this.gridSize = 3;           // 2 or 3
    this.gridItems = new Array(9).fill(0); // always 9 entries; only first 4 used for 2×2
    this.heldBlock = 0;          // block id the cursor is "holding"
    this.craftResult = null;     // { id, count, label } | null

    this._buildDOM();
    this._buildCursor();
  }

  // ------------------------------------------------------------------
  // DOM construction
  // ------------------------------------------------------------------

  _buildDOM() {
    // Overlay wrapper
    this.overlay = document.createElement('div');
    this.overlay.id = 'craft-menu';
    this.overlay.className = 'overlay hidden';

    const win = document.createElement('div');
    win.className = 'craft-window';
    this.overlay.appendChild(win);

    // Title
    const title = document.createElement('div');
    title.className = 'craft-title';
    title.textContent = 'Crafting';
    win.appendChild(title);

    // Mode tabs
    const tabs = document.createElement('div');
    tabs.className = 'craft-mode-tabs';
    this.tab3 = this._makeTab('Workbench (3×3)', () => this._setMode(3));
    this.tab2 = this._makeTab('Player (2×2)', () => this._setMode(2));
    tabs.appendChild(this.tab3);
    tabs.appendChild(this.tab2);
    win.appendChild(tabs);

    // Top row: grid + arrow + result
    this.topRow = document.createElement('div');
    this.topRow.className = 'craft-top';
    win.appendChild(this.topRow);

    this.gridEl = document.createElement('div');
    this.topRow.appendChild(this.gridEl);

    // Arrow SVG
    const arrowWrap = document.createElement('div');
    arrowWrap.className = 'craft-arrow';
    arrowWrap.innerHTML = `
      <svg class="craft-arrow-svg" viewBox="0 0 40 28" fill="none" xmlns="http://www.w3.org/2000/svg">
        <path d="M4 14 H30 M22 6 L30 14 L22 22" stroke="#555" stroke-width="4" stroke-linecap="square"/>
      </svg>
    `;
    this.topRow.appendChild(arrowWrap);

    // Result slot
    this.resultSlot = document.createElement('div');
    this.resultSlot.className = 'craft-result-slot';
    this.resultSlot.title = 'Click to collect';
    this.resultSlot.addEventListener('click', () => this._collectResult());
    this.topRow.appendChild(this.resultSlot);

    // Result img + count (inside result slot)
    this.resultImg = document.createElement('img');
    this.resultImg.draggable = false;
    this.resultSlot.appendChild(this.resultImg);
    this.resultCountEl = document.createElement('span');
    this.resultCountEl.className = 'slot-count';
    this.resultSlot.appendChild(this.resultCountEl);

    // Result name
    this.resultNameEl = document.createElement('div');
    this.resultNameEl.className = 'craft-result-name';
    win.appendChild(this.resultNameEl);

    // Divider
    const div = document.createElement('div');
    div.className = 'craft-divider';
    win.appendChild(div);

    // Inventory label
    const invLabel = document.createElement('div');
    invLabel.className = 'craft-inventory-label';
    invLabel.textContent = 'Your blocks — click to select, then place in grid';
    win.appendChild(invLabel);

    // Inventory grid (palette + hotbar blocks)
    this.invGrid = document.createElement('div');
    this.invGrid.className = 'craft-inventory-grid';
    win.appendChild(this.invGrid);

    // Hint
    const hint = document.createElement('div');
    hint.className = 'craft-hint';
    hint.innerHTML = 'Right-click a grid slot to remove &nbsp;·&nbsp; E or Esc to close';
    win.appendChild(hint);

    // Close on backdrop
    this.overlay.addEventListener('click', (e) => {
      if (e.target === this.overlay) this.onClose();
    });

    // Context-menu prevention
    this.overlay.addEventListener('contextmenu', (e) => {
      e.preventDefault();
      if (e.target.closest('.craft-slot, .craft-grid')) this._removeAtEvent(e);
    });

    document.body.appendChild(this.overlay);

    // Build initial grid and inventory
    this._buildGrid();
    this._buildInventory();
    this._setMode(3); // default: workbench
  }

  _makeTab(label, fn) {
    const btn = document.createElement('button');
    btn.className = 'craft-tab';
    btn.textContent = label;
    btn.addEventListener('click', fn);
    return btn;
  }

  _buildGrid() {
    this.gridEl.innerHTML = '';
    const size = this.gridSize;
    this.gridEl.className = size === 3 ? 'craft-grid' : 'craft-grid-2';

    this.slotEls = [];
    const numSlots = size * size;
    for (let i = 0; i < numSlots; i++) {
      const slot = document.createElement('div');
      slot.className = 'craft-slot';
      slot.dataset.idx = i;

      const img = document.createElement('img');
      img.draggable = false;
      slot.appendChild(img);

      const cnt = document.createElement('span');
      cnt.className = 'slot-count';
      slot.appendChild(cnt);

      slot.addEventListener('click', (e) => { e.preventDefault(); this._clickGridSlot(i); });
      slot.addEventListener('contextmenu', (e) => { e.preventDefault(); this._removeGridSlot(i); });

      this.gridEl.appendChild(slot);
      this.slotEls.push(slot);
    }
  }

  _buildInventory() {
    this.invGrid.innerHTML = '';
    this.invSlotEls = [];

    // Combine palette + hotbar unique items
    const hotbar = this.getHotbar();
    const seen = new Set();
    const items = [];
    for (const id of hotbar) {
      if (id && id !== B.AIR && !seen.has(id)) { seen.add(id); items.push(id); }
    }
    for (const id of PALETTE) {
      if (!seen.has(id)) { seen.add(id); items.push(id); }
    }

    for (const id of items) {
      const slot = document.createElement('div');
      slot.className = 'craft-inv-slot';
      slot.dataset.blockId = id;
      slot.title = BLOCKS[id]?.name || '';

      const img = document.createElement('img');
      img.draggable = false;
      const url = this.icons.get(id);
      if (url) img.src = url;
      slot.appendChild(img);

      slot.addEventListener('click', () => this._selectBlock(id, slot));
      this.invGrid.appendChild(slot);
      this.invSlotEls.push(slot);
    }
  }

  _buildCursor() {
    this.cursor = document.createElement('div');
    this.cursor.id = 'craft-cursor-block';
    const img = document.createElement('img');
    img.draggable = false;
    this.cursor.appendChild(img);
    document.body.appendChild(this.cursor);

    document.addEventListener('mousemove', (e) => {
      if (this.heldBlock && !this.overlay.classList.contains('hidden')) {
        this.cursor.style.left = e.clientX + 'px';
        this.cursor.style.top = e.clientY + 'px';
      }
    });
  }

  // ------------------------------------------------------------------
  // Mode switching
  // ------------------------------------------------------------------

  _setMode(size) {
    this.gridSize = size;
    this.gridItems = new Array(9).fill(0);
    this.tab3.classList.toggle('active', size === 3);
    this.tab2.classList.toggle('active', size === 2);
    this._buildGrid();
    this._syncGrid();
    this._evalRecipe();
  }

  // ------------------------------------------------------------------
  // Interaction
  // ------------------------------------------------------------------

  _selectBlock(id, slotEl) {
    this.heldBlock = id;
    // highlight
    this.invSlotEls.forEach((el) => el.classList.remove('selected-for-place'));
    slotEl.classList.add('selected-for-place');
    // show cursor
    const img = this.cursor.querySelector('img');
    const url = this.icons.get(id);
    if (url) img.src = url;
    this.cursor.style.display = 'block';
  }

  _clickGridSlot(i) {
    if (this.heldBlock) {
      this.gridItems[i] = this.heldBlock;
    } else {
      // toggle removal if not holding anything
      this.gridItems[i] = 0;
    }
    this._syncGrid();
    this._evalRecipe();
  }

  _removeGridSlot(i) {
    this.gridItems[i] = 0;
    this._syncGrid();
    this._evalRecipe();
  }

  _removeAtEvent(e) {
    const slot = e.target.closest('.craft-slot');
    if (!slot) return;
    const i = parseInt(slot.dataset.idx, 10);
    if (!isNaN(i)) this._removeGridSlot(i);
  }

  _collectResult() {
    if (!this.craftResult) return;
    this.onCraft(this.craftResult.id, this.craftResult.count);
    // Clear the grid
    this.gridItems = new Array(9).fill(0);
    this.craftResult = null;
    this._syncGrid();
    this._syncResult();
  }

  // ------------------------------------------------------------------
  // State → DOM sync
  // ------------------------------------------------------------------

  _syncGrid() {
    const size = this.gridSize;
    const numSlots = size * size;
    for (let i = 0; i < numSlots; i++) {
      const id = this.gridItems[i];
      const el = this.slotEls[i];
      const img = el.querySelector('img');
      const cnt = el.querySelector('.slot-count');
      if (id && id !== B.AIR) {
        const url = this.icons.get(id);
        if (url) img.src = url;
        img.style.display = '';
        cnt.textContent = '';
        el.classList.add('occupied');
      } else {
        img.src = '';
        img.style.display = 'none';
        cnt.textContent = '';
        el.classList.remove('occupied');
      }
    }
  }

  _syncResult() {
    const r = this.craftResult;
    if (r) {
      this.resultSlot.classList.add('has-result');
      const url = this.icons.get(r.id);
      if (url) this.resultImg.src = url;
      this.resultImg.style.display = '';
      this.resultCountEl.textContent = r.count > 1 ? r.count : '';
      const name = r.label || BLOCKS[r.id]?.name || '';
      this.resultNameEl.textContent = `→ ${name}${r.count > 1 ? ' ×' + r.count : ''}`;
    } else {
      this.resultSlot.classList.remove('has-result');
      this.resultImg.src = '';
      this.resultImg.style.display = 'none';
      this.resultCountEl.textContent = '';
      this.resultNameEl.textContent = '';
    }
  }

  // ------------------------------------------------------------------
  // Recipe evaluation
  // ------------------------------------------------------------------

  _evalRecipe() {
    const size = this.gridSize;
    const grid = this.gridItems.slice(0, size * size);
    this.craftResult = matchRecipe(grid, size);
    this._syncResult();
  }

  // ------------------------------------------------------------------
  // Public API
  // ------------------------------------------------------------------

  open() {
    this._buildInventory(); // refresh with current hotbar
    this.overlay.classList.remove('hidden');
    // reset held block
    this.heldBlock = 0;
    this.cursor.style.display = 'none';
    this.invSlotEls.forEach((el) => el.classList.remove('selected-for-place'));
  }

  close() {
    this.overlay.classList.add('hidden');
    this.heldBlock = 0;
    this.cursor.style.display = 'none';
  }

  /** Called when hotbar icons become available */
  setIcons(icons) {
    this.icons = icons;
    this._buildInventory();
  }
}
