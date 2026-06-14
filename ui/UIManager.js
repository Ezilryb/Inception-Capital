'use strict';

import { REGISTRY }          from '../world/BlockRegistry.js';
import { getItemInfo, isBlockItem } from './Items.js';
import { HOTBAR_SIZE, INV_SIZE, ItemStack } from './Inventory.js';

// ─────────────────────────────────────────────────────────────
//  UIManager
//  Builds and manages all DOM-based HUD elements:
//    • Hotbar      (always visible)
//    • Inventory   (E key)
//    • CraftingTable (right-click on table block)
//    • Break arc   (progress around crosshair while digging)
//    • Tooltip     (hover over slot)
// ─────────────────────────────────────────────────────────────
export class UIManager {
  /**
   * @param {import('./Inventory.js').Inventory}       inventory
   * @param {import('./CraftingSystem.js').CraftingSystem} crafting2x2
   * @param {import('./CraftingSystem.js').CraftingSystem} crafting3x3
   * @param {HTMLCanvasElement|null} atlasCanvas
   */
  constructor(inventory, crafting2x2, crafting3x3, atlasCanvas) {
    this._inv         = inventory;
    this._craft2      = crafting2x2;   // 2×2 – always available in inventory
    this._craft3      = crafting3x3;   // 3×3 – crafting table only
    this._atlasURL    = atlasCanvas ? atlasCanvas.toDataURL() : null;
    this._atlasSize   = 256; // atlas is 256×256
    this._tileSize    = 16;  // each tile is 16×16 px in atlas
    this._displaySize = 32;  // render at 32×32 in UI (2x scale)

    this._inventoryOpen     = false;
    this._craftingTableOpen = false;

    // "held item" – item following the cursor while dragging
    this._held    = null;  // {id, count, meta}
    this._heldEl  = null;

    // UI root elements
    this._hotbarEl   = null;
    this._invEl      = null;
    this._craftEl    = null;
    this._tooltipEl  = null;
    this._breakArcEl = null;

    // Cache of slot elements
    this._hotbarSlots  = [];
    this._mainSlots    = [];
    this._craft2Slots  = [];
    this._craft3Slots  = [];
    this._craft2Result = null;
    this._craft3Result = null;

    // Callback fired when UI is closed (to re-acquire pointer lock)
    this.onClose = null;
  }

  // ─────────────────────────────────────────────────────────
  //  Init
  // ─────────────────────────────────────────────────────────
  init() {
    this._injectCSS();
    this._buildHotbar();
    this._buildInventoryPanel();
    this._buildCraftingPanel();
    this._buildHeld();
    this._buildTooltip();
    this._buildBreakArc();
    this.refresh();

    // Attach crafting onChange callbacks
    this._craft2.onChange = () => this._refreshCraftingGrid(this._craft2Slots, this._craft2Result, this._craft2);
    this._craft3.onChange = () => this._refreshCraftingGrid(this._craft3Slots, this._craft3Result, this._craft3);

    document.addEventListener('mousemove', e => this._moveHeld(e));
  }

  // ─────────────────────────────────────────────────────────
  //  CSS injection
  // ─────────────────────────────────────────────────────────
  _injectCSS() {
    const style = document.createElement('style');
    style.textContent = `
/* ── Minecraft UI Root ── */
:root {
  --mc-bg:        #C6C6C6;
  --mc-dark:      #373737;
  --mc-mid:       #8B8B8B;
  --mc-light:     #FFFFFF;
  --mc-panel:     #3C3C3C;
  --mc-panel-border: #212121;
  --mc-slot-bg:   #8B8B8B;
  --mc-slot-dark: #373737;
  --mc-slot-lite: #ffffff88;
  --mc-text:      #FFFFFF;
  --mc-text-dark: #3F3F3F;
  --mc-selected:  rgba(255,255,255,0.5);
  --tile:         ${this._displaySize}px;
}

/* ── Hotbar ── */
#mc-hotbar {
  position: fixed;
  bottom: 0;
  left: 50%;
  transform: translateX(-50%);
  display: flex;
  gap: 0;
  z-index: 50;
  pointer-events: none;
}
#mc-hotbar .mc-slot {
  pointer-events: auto;
}

/* ── Generic slot ── */
.mc-slot {
  position: relative;
  width: 44px; height: 44px;
  background: var(--mc-slot-bg);
  box-shadow:
    inset  2px  2px 0 var(--mc-slot-dark),
    inset -2px -2px 0 var(--mc-slot-lite);
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  user-select: none;
  box-sizing: border-box;
}
.mc-slot.selected {
  box-shadow:
    inset  2px  2px 0 var(--mc-slot-lite),
    inset -2px -2px 0 var(--mc-slot-dark);
  background: #6B6B6B;
}
.mc-slot:hover { background: #7B7B7B; }
.mc-slot .mc-count {
  position: absolute;
  bottom: 2px; right: 3px;
  color: #FFF;
  font-size: 10px;
  font-family: 'Courier New', monospace;
  font-weight: bold;
  text-shadow: 1px 1px 0 #000;
  pointer-events: none;
  line-height: 1;
}
.mc-slot .mc-icon {
  width: var(--tile); height: var(--tile);
  image-rendering: pixelated;
  pointer-events: none;
}
.mc-slot .mc-tool-icon {
  width: 28px; height: 28px;
  display: flex; align-items: center; justify-content: center;
  font-size: 9px;
  font-family: 'Courier New', monospace;
  font-weight: bold;
  color: #fff;
  text-shadow: 1px 1px 0 #000;
  line-height: 1.2;
  text-align: center;
  border-radius: 2px;
}

/* ── Overlay backdrop ── */
.mc-overlay {
  position: fixed;
  inset: 0;
  background: rgba(0,0,0,0.5);
  z-index: 60;
  display: flex;
  align-items: center;
  justify-content: center;
}
.mc-overlay.hidden { display: none; }

/* ── Panel ── */
.mc-panel {
  background: var(--mc-bg);
  border: 2px solid var(--mc-panel-border);
  box-shadow: 4px 4px 0 rgba(0,0,0,0.5);
  padding: 8px 8px 12px;
  font-family: 'Courier New', monospace;
}
.mc-panel-title {
  color: var(--mc-text-dark);
  font-size: 12px;
  margin-bottom: 8px;
  display: block;
}

/* ── Slot groups ── */
.mc-row    { display: flex; gap: 0; }
.mc-grid   { display: grid; gap: 0; }
.mc-vspace { height: 8px; }
.mc-hspace { width: 8px; }

/* ── Inventory panel layout ── */
.mc-inv-top {
  display: flex;
  gap: 12px;
  align-items: flex-start;
  margin-bottom: 4px;
}
.mc-inv-craft-area {
  display: flex;
  align-items: center;
  gap: 6px;
}
.mc-craft-arrow {
  font-size: 20px;
  color: var(--mc-text-dark);
  padding: 0 4px;
}

/* ── Crafting result slot ── */
.mc-result-slot {
  width: 44px; height: 44px;
  background: var(--mc-slot-bg);
  box-shadow:
    inset  2px  2px 0 var(--mc-slot-dark),
    inset -2px -2px 0 var(--mc-slot-lite);
  display: flex; align-items: center; justify-content: center;
  cursor: pointer;
  position: relative;
}
.mc-result-slot.has-result {
  box-shadow:
    inset  2px  2px 0 #aaffaa,
    inset -2px -2px 0 #004400;
  background: #6B8B6B;
}
.mc-result-slot.has-result:hover { background: #7B9B7B; }
.mc-result-slot .mc-count { position:absolute;bottom:2px;right:3px;color:#FFF;font-size:10px;font-family:'Courier New',monospace;font-weight:bold;text-shadow:1px 1px 0 #000;pointer-events:none; }

/* ── Held item ── */
#mc-held {
  position: fixed;
  pointer-events: none;
  z-index: 999;
  transform: translate(-50%, -50%);
  display: none;
}

/* ── Tooltip ── */
#mc-tooltip {
  position: fixed;
  background: rgba(16,0,16,0.94);
  border: 1px solid #5000A0;
  color: #FFF;
  font-family: 'Courier New', monospace;
  font-size: 11px;
  padding: 4px 7px;
  pointer-events: none;
  z-index: 1000;
  white-space: nowrap;
  display: none;
  box-shadow: 2px 2px 0 rgba(0,0,0,0.7);
}

/* ── Break arc (SVG around crosshair) ── */
#mc-break-arc {
  position: fixed;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%);
  width: 54px; height: 54px;
  pointer-events: none;
  z-index: 20;
  display: none;
}
    `;
    document.head.appendChild(style);
  }

  // ─────────────────────────────────────────────────────────
  //  Hotbar
  // ─────────────────────────────────────────────────────────
  _buildHotbar() {
    const bar = document.createElement('div');
    bar.id = 'mc-hotbar';
    this._hotbarSlots = [];

    for (let i = 0; i < HOTBAR_SIZE; i++) {
      const slot = this._makeSlotEl('hotbar', i);
      bar.appendChild(slot);
      this._hotbarSlots.push(slot);
    }
    document.body.appendChild(bar);
    this._hotbarEl = bar;
  }

  // ─────────────────────────────────────────────────────────
  //  Inventory panel
  // ─────────────────────────────────────────────────────────
  _buildInventoryPanel() {
    const overlay = document.createElement('div');
    overlay.id = 'mc-inventory';
    overlay.className = 'mc-overlay hidden';
    overlay.addEventListener('mousedown', e => {
      if (e.target === overlay) this.closeInventory();
    });

    const panel = document.createElement('div');
    panel.className = 'mc-panel';

    // Title
    const title = document.createElement('span');
    title.className = 'mc-panel-title';
    title.textContent = 'Inventaire';
    panel.appendChild(title);

    // Top area: crafting 2×2 + arrow + result
    const topArea = document.createElement('div');
    topArea.className = 'mc-inv-top';

    const craftArea = document.createElement('div');
    craftArea.className = 'mc-inv-craft-area';

    const grid2 = document.createElement('div');
    grid2.className = 'mc-grid';
    grid2.style.gridTemplateColumns = 'repeat(2, 44px)';
    this._craft2Slots = [];
    for (let i = 0; i < 4; i++) {
      const slot = this._makeCraftSlot('craft2', i);
      grid2.appendChild(slot);
      this._craft2Slots.push(slot);
    }

    const arrow = document.createElement('div');
    arrow.className = 'mc-craft-arrow';
    arrow.textContent = '▶';

    const result2 = document.createElement('div');
    result2.className = 'mc-result-slot';
    result2.addEventListener('mousedown', () => this._craftResult(this._craft2, result2));
    this._craft2Result = result2;

    craftArea.appendChild(grid2);
    craftArea.appendChild(arrow);
    craftArea.appendChild(result2);
    topArea.appendChild(craftArea);
    panel.appendChild(topArea);

    // Spacer
    const vspace = document.createElement('div');
    vspace.className = 'mc-vspace';
    panel.appendChild(vspace);

    // Main inventory (3 rows × 9)
    this._mainSlots = [];
    const mainTitle = document.createElement('span');
    mainTitle.className = 'mc-panel-title';
    mainTitle.textContent = 'Inventaire';
    panel.appendChild(mainTitle);

    for (let row = 0; row < 3; row++) {
      const rowEl = document.createElement('div');
      rowEl.className = 'mc-row';
      for (let col = 0; col < 9; col++) {
        const invIndex = 9 + row * 9 + col; // slots 9..35
        const slot = this._makeSlotEl('main', invIndex);
        rowEl.appendChild(slot);
        this._mainSlots.push(slot);
      }
      panel.appendChild(rowEl);
    }

    // Hotbar row inside inventory
    const vspace2 = document.createElement('div');
    vspace2.style.height = '4px';
    panel.appendChild(vspace2);

    const hotbarTitle = document.createElement('span');
    hotbarTitle.className = 'mc-panel-title';
    hotbarTitle.textContent = 'Actions rapides';
    panel.appendChild(hotbarTitle);

    const hotbarRow = document.createElement('div');
    hotbarRow.className = 'mc-row';
    for (let i = 0; i < HOTBAR_SIZE; i++) {
      // These share slot indices 0-8 with the hotbar but are separate DOM elements
      const slot = this._makeSlotEl('hotbar-inv', i);
      hotbarRow.appendChild(slot);
    }
    panel.appendChild(hotbarRow);

    overlay.appendChild(panel);
    document.body.appendChild(overlay);
    this._invEl = overlay;
  }

  // ─────────────────────────────────────────────────────────
  //  Crafting table panel
  // ─────────────────────────────────────────────────────────
  _buildCraftingPanel() {
    const overlay = document.createElement('div');
    overlay.id = 'mc-crafting';
    overlay.className = 'mc-overlay hidden';
    overlay.addEventListener('mousedown', e => {
      if (e.target === overlay) this.closeCraftingTable();
    });

    const panel = document.createElement('div');
    panel.className = 'mc-panel';
    panel.style.minWidth = '420px';

    // Title
    const title = document.createElement('span');
    title.className = 'mc-panel-title';
    title.textContent = 'Table de Craft';
    panel.appendChild(title);

    // Crafting area: 3×3 grid + arrow + result
    const craftRow = document.createElement('div');
    craftRow.className = 'mc-inv-craft-area';
    craftRow.style.marginBottom = '8px';

    const grid3 = document.createElement('div');
    grid3.className = 'mc-grid';
    grid3.style.gridTemplateColumns = 'repeat(3, 44px)';
    this._craft3Slots = [];
    for (let i = 0; i < 9; i++) {
      const slot = this._makeCraftSlot('craft3', i);
      grid3.appendChild(slot);
      this._craft3Slots.push(slot);
    }

    const arrow = document.createElement('div');
    arrow.className = 'mc-craft-arrow';
    arrow.textContent = '▶';

    const result3 = document.createElement('div');
    result3.className = 'mc-result-slot';
    result3.addEventListener('mousedown', () => this._craftResult(this._craft3, result3));
    this._craft3Result = result3;

    craftRow.appendChild(grid3);
    craftRow.appendChild(arrow);
    craftRow.appendChild(result3);
    panel.appendChild(craftRow);

    // Separator
    const hr = document.createElement('hr');
    hr.style.cssText = 'border:none;border-top:2px solid #8B8B8B;margin:6px 0';
    panel.appendChild(hr);

    // Inventory (mirrored, 3 rows + hotbar)
    const invTitle = document.createElement('span');
    invTitle.className = 'mc-panel-title';
    invTitle.textContent = 'Inventaire';
    panel.appendChild(invTitle);

    this._craft3InvSlots = [];
    for (let row = 0; row < 3; row++) {
      const rowEl = document.createElement('div');
      rowEl.className = 'mc-row';
      for (let col = 0; col < 9; col++) {
        const invIndex = 9 + row * 9 + col;
        const slot = this._makeSlotEl('ct-main', invIndex);
        rowEl.appendChild(slot);
        this._craft3InvSlots.push(slot);
      }
      panel.appendChild(rowEl);
    }

    const vspace = document.createElement('div');
    vspace.style.height = '4px';
    panel.appendChild(vspace);

    this._craft3HotbarSlots = [];
    const hotRow = document.createElement('div');
    hotRow.className = 'mc-row';
    for (let i = 0; i < HOTBAR_SIZE; i++) {
      const slot = this._makeSlotEl('ct-hotbar', i);
      hotRow.appendChild(slot);
      this._craft3HotbarSlots.push(slot);
    }
    panel.appendChild(hotRow);

    overlay.appendChild(panel);
    document.body.appendChild(overlay);
    this._craftEl = overlay;
  }

  // ─────────────────────────────────────────────────────────
  //  Held item ghost
  // ─────────────────────────────────────────────────────────
  _buildHeld() {
    const el = document.createElement('div');
    el.id = 'mc-held';
    document.body.appendChild(el);
    this._heldEl = el;
  }

  _buildTooltip() {
    const el = document.createElement('div');
    el.id = 'mc-tooltip';
    document.body.appendChild(el);
    this._tooltipEl = el;
  }

  // ─────────────────────────────────────────────────────────
  //  Break arc (SVG circle showing dig progress)
  // ─────────────────────────────────────────────────────────
  _buildBreakArc() {
    const el = document.createElement('div');
    el.id = 'mc-break-arc';
    el.innerHTML = `
      <svg viewBox="0 0 54 54" xmlns="http://www.w3.org/2000/svg">
        <circle cx="27" cy="27" r="22" fill="none"
          stroke="rgba(0,0,0,0.35)" stroke-width="5"/>
        <circle id="mc-break-fill" cx="27" cy="27" r="22" fill="none"
          stroke="#FF8800" stroke-width="5"
          stroke-dasharray="138.2" stroke-dashoffset="138.2"
          stroke-linecap="round"
          transform="rotate(-90 27 27)"/>
      </svg>`;
    document.body.appendChild(el);
    this._breakArcEl  = el;
    this._breakFillEl = el.querySelector('#mc-break-fill');
  }

  // ─────────────────────────────────────────────────────────
  //  Slot DOM factory
  // ─────────────────────────────────────────────────────────
  _makeSlotEl(category, index) {
    const el = document.createElement('div');
    el.className = 'mc-slot';
    el.dataset.category = category;
    el.dataset.index    = index;

    el.addEventListener('mousedown', (e) => {
      e.preventDefault();
      e.stopPropagation();
      this._onSlotClick(category, index, e.button === 2);
    });
    el.addEventListener('contextmenu', e => e.preventDefault());
    el.addEventListener('mouseenter', () => this._showTooltip(el, category, index));
    el.addEventListener('mouseleave', () => this._hideTooltip());

    return el;
  }

  _makeCraftSlot(category, index) {
    const el = this._makeSlotEl(category, index);
    return el;
  }

  // ─────────────────────────────────────────────────────────
  //  Slot click logic (pick-up / place / swap)
  // ─────────────────────────────────────────────────────────
  _onSlotClick(category, index, rightClick) {
    const stack = this._getSlotStack(category, index);

    if (!this._held) {
      // Pick up
      if (!stack) return;
      if (rightClick) {
        // Take half
        const take = Math.ceil(stack.count / 2);
        this._held = new ItemStack(stack.id, take, stack.meta);
        stack.count -= take;
        if (stack.count <= 0) this._setSlotStack(category, index, null);
        else this._setSlotStack(category, index, stack);
      } else {
        // Take all
        this._held = stack.clone();
        this._setSlotStack(category, index, null);
      }
      this._refreshHeld();
    } else {
      // Place / swap
      if (!stack) {
        // Place held
        const place = rightClick ? new ItemStack(this._held.id, 1, this._held.meta) : this._held.clone();
        if (rightClick) {
          this._held.count -= 1;
          if (this._held.count <= 0) this._held = null;
        } else {
          this._held = null;
        }
        this._setSlotStack(category, index, place);
      } else if (stack.id === this._held.id && stack.meta === this._held.meta) {
        // Stack
        const add = rightClick ? 1 : this._held.count;
        const canAdd = Math.min(add, 64 - stack.count);
        stack.count += canAdd;
        this._held.count -= canAdd;
        if (this._held.count <= 0) this._held = null;
        this._setSlotStack(category, index, stack);
      } else {
        // Swap
        const tmp = stack.clone();
        this._setSlotStack(category, index, this._held.clone());
        this._held = tmp;
      }
      this._refreshHeld();
    }
    this.refresh();
  }

  // Returns ItemStack for any slot category
  _getSlotStack(category, index) {
    switch (category) {
      case 'hotbar':
      case 'hotbar-inv':
      case 'ct-hotbar':
        return this._inv.get(index);
      case 'main':
      case 'ct-main':
        return this._inv.get(index); // index is already absolute (9-35)
      case 'craft2':
        return this._craft2.getSlot(index);
      case 'craft3':
        return this._craft3.getSlot(index);
      default:
        return null;
    }
  }

  _setSlotStack(category, index, stack) {
    switch (category) {
      case 'hotbar':
      case 'hotbar-inv':
      case 'ct-hotbar':
      case 'main':
      case 'ct-main':
        this._inv.set(index, stack);
        break;
      case 'craft2':
        this._craft2.setSlot(index, stack);
        break;
      case 'craft3':
        this._craft3.setSlot(index, stack);
        break;
    }
  }

  // ─────────────────────────────────────────────────────────
  //  Crafting result click
  // ─────────────────────────────────────────────────────────
  _craftResult(craftingSystem, resultEl) {
    if (!craftingSystem.result) return;
    const out = craftingSystem.craft();
    if (!out) return;

    if (this._held) {
      if (this._held.id === out.id && this._held.count + out.count <= 64) {
        this._held.count += out.count;
      } else {
        // can't merge, just add to inventory
        this._inv.addItem(out.id, out.count, out.meta);
      }
    } else {
      this._held = out;
    }
    this._refreshHeld();
    this.refresh();
  }

  // ─────────────────────────────────────────────────────────
  //  Break arc
  // ─────────────────────────────────────────────────────────
  setBreakProgress(progress, pos) {
    if (progress <= 0 || !pos) {
      this._breakArcEl.style.display = 'none';
      return;
    }
    this._breakArcEl.style.display = 'block';
    const circumference = 138.2;
    const offset = circumference * (1 - Math.min(1, progress));
    this._breakFillEl.setAttribute('stroke-dashoffset', offset.toFixed(2));
  }

  // ─────────────────────────────────────────────────────────
  //  Open / close
  // ─────────────────────────────────────────────────────────
  openInventory() {
    this._inventoryOpen = true;
    this._invEl.classList.remove('hidden');
    this.refresh();
  }

  closeInventory() {
    this._inventoryOpen = false;
    this._invEl.classList.add('hidden');
    // Return crafting items to inventory
    const dump = this._craft2.dumpGrid();
    dump.forEach(s => this._inv.addItem(s.id, s.count, s.meta));
    // Return held item to inventory
    if (this._held) {
      this._inv.addItem(this._held.id, this._held.count, this._held.meta);
      this._held = null;
      this._refreshHeld();
    }
    this.refresh();
    if (this.onClose) this.onClose();
  }

  openCraftingTable() {
    this._craftingTableOpen = true;
    this._craftEl.classList.remove('hidden');
    this.refresh();
  }

  closeCraftingTable() {
    this._craftingTableOpen = false;
    this._craftEl.classList.add('hidden');
    const dump = this._craft3.dumpGrid();
    dump.forEach(s => this._inv.addItem(s.id, s.count, s.meta));
    if (this._held) {
      this._inv.addItem(this._held.id, this._held.count, this._held.meta);
      this._held = null;
      this._refreshHeld();
    }
    this.refresh();
    if (this.onClose) this.onClose();
  }

  closeAll() {
    if (this._inventoryOpen)     this.closeInventory();
    if (this._craftingTableOpen) this.closeCraftingTable();
  }

  isUIOpen()              { return this._inventoryOpen || this._craftingTableOpen; }
  isInventoryOpen()       { return this._inventoryOpen; }
  isCraftingTableOpen()   { return this._craftingTableOpen; }

  // ─────────────────────────────────────────────────────────
  //  Refresh all displays
  // ─────────────────────────────────────────────────────────
  refresh() {
    this._refreshHotbar();
    if (this._inventoryOpen)     this._refreshInventoryPanel();
    if (this._craftingTableOpen) this._refreshCraftingPanel();
  }

  _refreshHotbar() {
    for (let i = 0; i < HOTBAR_SIZE; i++) {
      const stack = this._inv.get(i);
      this._renderSlot(this._hotbarSlots[i], stack);
      this._hotbarSlots[i].classList.toggle('selected', i === this._inv.hotbarIndex);
    }
  }

  _refreshInventoryPanel() {
    // Hotbar row inside inventory panel
    const hotbarInvSlots = this._invEl.querySelectorAll('[data-category="hotbar-inv"]');
    hotbarInvSlots.forEach((el, i) => {
      this._renderSlot(el, this._inv.get(i));
      el.classList.toggle('selected', i === this._inv.hotbarIndex);
    });

    // Main inventory slots
    this._mainSlots.forEach((el, i) => {
      this._renderSlot(el, this._inv.get(9 + i));
    });

    // 2×2 crafting
    this._refreshCraftingGrid(this._craft2Slots, this._craft2Result, this._craft2);
  }

  _refreshCraftingPanel() {
    this._craft3Slots.forEach((el, i) => {
      this._renderSlot(el, this._craft3.getSlot(i));
    });
    this._refreshCraftResult(this._craft3Result, this._craft3.result);

    this._craft3InvSlots.forEach((el, i) => {
      this._renderSlot(el, this._inv.get(9 + i));
    });
    this._craft3HotbarSlots.forEach((el, i) => {
      this._renderSlot(el, this._inv.get(i));
      el.classList.toggle('selected', i === this._inv.hotbarIndex);
    });
  }

  _refreshCraftingGrid(slots, resultEl, system) {
    slots.forEach((el, i) => this._renderSlot(el, system.getSlot(i)));
    this._refreshCraftResult(resultEl, system.result);
  }

  _refreshCraftResult(el, result) {
    if (!el) return;
    if (result) {
      el.classList.add('has-result');
      this._renderSlot(el, new ItemStack(result.id, result.count));
    } else {
      el.classList.remove('has-result');
      el.innerHTML = '';
    }
  }

  // ─────────────────────────────────────────────────────────
  //  Render a single item into a slot element
  // ─────────────────────────────────────────────────────────
  _renderSlot(el, stack) {
    el.innerHTML = '';
    if (!stack || stack.count <= 0) return;

    const icon = this._makeItemIcon(stack.id);
    el.appendChild(icon);

    if (stack.count > 1) {
      const cnt = document.createElement('span');
      cnt.className = 'mc-count';
      cnt.textContent = stack.count;
      el.appendChild(cnt);
    }
  }

  _makeItemIcon(id) {
    if (isBlockItem(id) && this._atlasURL) {
      // Use terrain atlas
      const block = REGISTRY.get(id);
      const tileIndex = block?.texture?.top ?? 0;
      const col = tileIndex % 16;
      const row = Math.floor(tileIndex / 16);
      const scale = this._displaySize / this._tileSize; // 2

      const img = document.createElement('div');
      img.className = 'mc-icon';
      img.style.cssText = `
        width: ${this._displaySize}px; height: ${this._displaySize}px;
        background-image: url(${this._atlasURL});
        background-size: ${this._atlasSize * scale}px ${this._atlasSize * scale}px;
        background-position: -${col * this._displaySize}px -${row * this._displaySize}px;
        image-rendering: pixelated;
      `;
      return img;
    } else {
      // Tool / material: colored box + label
      const info = getItemInfo(id);
      const el = document.createElement('div');
      el.className = 'mc-tool-icon';
      el.style.background = info?.color ?? '#666';
      el.style.color = this._contrastColor(info?.color ?? '#666');
      el.textContent = this._shortLabel(info?.displayName ?? '?', info?.shape);
      return el;
    }
  }

  _shortLabel(name, shape) {
    const shapeSymbol = {
      pickaxe: '⛏', axe: '🪓', shovel: '⬇', sword: '⚔', hoe: '⚒',
      ingot: '▬', gem: '◆', stick: '|', book: '📖', item: '',
      flint_steel: '🔥', shears: '✂',
    };
    const sym = shapeSymbol[shape] ?? '';
    const short = name.replace(/[aeiouAEIOU]/g, '').slice(0, 6);
    return sym ? sym : short || '?';
  }

  _contrastColor(hex) {
    const r = parseInt(hex.slice(1,3), 16);
    const g = parseInt(hex.slice(3,5), 16);
    const b = parseInt(hex.slice(5,7), 16);
    return (r * 0.299 + g * 0.587 + b * 0.114) > 128 ? '#000' : '#fff';
  }

  // ─────────────────────────────────────────────────────────
  //  Held item rendering
  // ─────────────────────────────────────────────────────────
  _refreshHeld() {
    if (!this._held) {
      this._heldEl.style.display = 'none';
      return;
    }
    this._heldEl.style.display = 'block';
    this._heldEl.innerHTML = '';
    const icon = this._makeItemIcon(this._held.id);
    this._heldEl.appendChild(icon);
    if (this._held.count > 1) {
      const cnt = document.createElement('span');
      cnt.className = 'mc-count';
      cnt.style.position = 'absolute';
      cnt.style.bottom = '0';
      cnt.style.right = '0';
      cnt.textContent = this._held.count;
      this._heldEl.appendChild(cnt);
    }
    this._heldEl.style.position = 'fixed';
  }

  _moveHeld(e) {
    if (!this._held) return;
    this._heldEl.style.left = e.clientX + 'px';
    this._heldEl.style.top  = e.clientY + 'px';
  }

  // ─────────────────────────────────────────────────────────
  //  Tooltip
  // ─────────────────────────────────────────────────────────
  _showTooltip(el, category, index) {
    const stack = this._getSlotStack(category, index);
    if (!stack) return;

    let name = '';
    if (isBlockItem(stack.id)) {
      const block = REGISTRY.get(stack.id);
      name = block?.displayName ?? block?.name ?? `Bloc #${stack.id}`;
    } else {
      const info = getItemInfo(stack.id);
      name = info?.displayName ?? `Objet #${stack.id}`;
    }

    const rect = el.getBoundingClientRect();
    this._tooltipEl.textContent = name;
    this._tooltipEl.style.left    = (rect.left + rect.width / 2 - this._tooltipEl.offsetWidth / 2) + 'px';
    this._tooltipEl.style.top     = (rect.top - 28) + 'px';
    this._tooltipEl.style.display = 'block';
  }

  _hideTooltip() {
    this._tooltipEl.style.display = 'none';
  }
}
