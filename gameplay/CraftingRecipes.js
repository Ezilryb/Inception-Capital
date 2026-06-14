'use strict';

import { BlockID } from '../world/BlockRegistry.js';
import { ItemID }  from './Items.js';

// ─────────────────────────────────────────────────────────────
//  Recipe format — patterns use numeric item/block IDs directly.
//
//  SHAPED:
//  { type:'shaped', pattern:[[id,id,null],[null,id,null],[null,id,null]], result:{id,count} }
//  null  = empty cell, any number = the required item/block ID
//
//  SHAPELESS:
//  { type:'shapeless', ingredients:[id,id,...], result:{id,count} }
// ─────────────────────────────────────────────────────────────

const P  = BlockID.PLANKS;
const C  = BlockID.COBBLESTONE;
const S  = ItemID.STICK;
const I  = ItemID.IRON_INGOT;
const D  = ItemID.DIAMOND;
const G  = ItemID.GOLD_INGOT;
const L  = BlockID.LOG;
const OB = BlockID.OBSIDIAN;
const BK = ItemID.BOOK;
const CO = ItemID.COAL;
const CH = ItemID.CHARCOAL;
const FL = ItemID.FLINT;
const GU = ItemID.GUNPOWDER;
const SA = BlockID.SAND;
const GL = BlockID.GLASS;
const LB = ItemID.LAPIS_LAZULI;

function shaped(pattern, result) {
  return { type: 'shaped', pattern, result };
}
function shapeless(ingredients, result) {
  return { type: 'shapeless', ingredients, result };
}

export const RECIPES = [
  // ── Wood & base materials ──────────────────────────────────
  shapeless([L],              { id: P,  count: 4 }),
  shapeless([SA, SA, SA, SA], { id: BlockID.SANDSTONE, count: 1 }),

  // Sticks: 2 planks vertical → 4 sticks
  shaped([[P], [P]],          { id: S, count: 4 }),

  // Crafting table: 2×2 planks
  shaped([[P, P], [P, P]],    { id: BlockID.CRAFTING_TABLE, count: 1 }),

  // Planks → slabs
  shaped([[P, P, P]],         { id: BlockID.SLAB, count: 6 }),

  // ── Pickaxes ──────────────────────────────────────────────
  shaped([[P,P,P],[null,S,null],[null,S,null]], { id: ItemID.WOODEN_PICKAXE,  count: 1 }),
  shaped([[C,C,C],[null,S,null],[null,S,null]], { id: ItemID.STONE_PICKAXE,   count: 1 }),
  shaped([[I,I,I],[null,S,null],[null,S,null]], { id: ItemID.IRON_PICKAXE,    count: 1 }),
  shaped([[D,D,D],[null,S,null],[null,S,null]], { id: ItemID.DIAMOND_PICKAXE, count: 1 }),
  shaped([[G,G,G],[null,S,null],[null,S,null]], { id: ItemID.GOLDEN_PICKAXE,  count: 1 }),

  // ── Axes (both mirror orientations) ───────────────────────
  shaped([[P,P,null],[P,S,null],[null,S,null]], { id: ItemID.WOODEN_AXE,  count: 1 }),
  shaped([[null,P,P],[null,S,P],[null,S,null]], { id: ItemID.WOODEN_AXE,  count: 1 }),
  shaped([[C,C,null],[C,S,null],[null,S,null]], { id: ItemID.STONE_AXE,   count: 1 }),
  shaped([[null,C,C],[null,S,C],[null,S,null]], { id: ItemID.STONE_AXE,   count: 1 }),
  shaped([[I,I,null],[I,S,null],[null,S,null]], { id: ItemID.IRON_AXE,    count: 1 }),
  shaped([[null,I,I],[null,S,I],[null,S,null]], { id: ItemID.IRON_AXE,    count: 1 }),
  shaped([[D,D,null],[D,S,null],[null,S,null]], { id: ItemID.DIAMOND_AXE, count: 1 }),
  shaped([[null,D,D],[null,S,D],[null,S,null]], { id: ItemID.DIAMOND_AXE, count: 1 }),
  shaped([[G,G,null],[G,S,null],[null,S,null]], { id: ItemID.GOLDEN_AXE,  count: 1 }),
  shaped([[null,G,G],[null,S,G],[null,S,null]], { id: ItemID.GOLDEN_AXE,  count: 1 }),

  // ── Shovels ───────────────────────────────────────────────
  shaped([[P],[S],[S]], { id: ItemID.WOODEN_SHOVEL,  count: 1 }),
  shaped([[C],[S],[S]], { id: ItemID.STONE_SHOVEL,   count: 1 }),
  shaped([[I],[S],[S]], { id: ItemID.IRON_SHOVEL,    count: 1 }),
  shaped([[D],[S],[S]], { id: ItemID.DIAMOND_SHOVEL, count: 1 }),
  shaped([[G],[S],[S]], { id: ItemID.GOLDEN_SHOVEL,  count: 1 }),

  // ── Swords ────────────────────────────────────────────────
  shaped([[P],[P],[S]], { id: ItemID.WOODEN_SWORD,  count: 1 }),
  shaped([[C],[C],[S]], { id: ItemID.STONE_SWORD,   count: 1 }),
  shaped([[I],[I],[S]], { id: ItemID.IRON_SWORD,    count: 1 }),
  shaped([[D],[D],[S]], { id: ItemID.DIAMOND_SWORD, count: 1 }),
  shaped([[G],[G],[S]], { id: ItemID.GOLDEN_SWORD,  count: 1 }),

  // ── Hoes (both mirror orientations) ───────────────────────
  shaped([[P,P,null],[null,S,null],[null,S,null]], { id: ItemID.WOODEN_HOE, count: 1 }),
  shaped([[null,P,P],[null,S,null],[null,S,null]], { id: ItemID.WOODEN_HOE, count: 1 }),
  shaped([[C,C,null],[null,S,null],[null,S,null]], { id: ItemID.STONE_HOE,  count: 1 }),
  shaped([[null,C,C],[null,S,null],[null,S,null]], { id: ItemID.STONE_HOE,  count: 1 }),
  shaped([[I,I,null],[null,S,null],[null,S,null]], { id: ItemID.IRON_HOE,   count: 1 }),
  shaped([[null,I,I],[null,S,null],[null,S,null]], { id: ItemID.IRON_HOE,   count: 1 }),
  shaped([[D,D,null],[null,S,null],[null,S,null]], { id: ItemID.DIAMOND_HOE,count: 1 }),
  shaped([[null,D,D],[null,S,null],[null,S,null]], { id: ItemID.DIAMOND_HOE,count: 1 }),
  shaped([[G,G,null],[null,S,null],[null,S,null]], { id: ItemID.GOLDEN_HOE, count: 1 }),
  shaped([[null,G,G],[null,S,null],[null,S,null]], { id: ItemID.GOLDEN_HOE, count: 1 }),

  // ── Furnace (8 cobblestone ring) ──────────────────────────
  shaped([[C,C,C],[C,null,C],[C,C,C]], { id: BlockID.FURNACE, count: 1 }),

  // ── Chest (8 planks ring) ─────────────────────────────────
  shaped([[P,P,P],[P,null,P],[P,P,P]], { id: BlockID.CHEST, count: 1 }),

  // ── Torch (coal or charcoal + stick) ──────────────────────
  shaped([[CO],[S]], { id: BlockID.TORCH, count: 4 }),
  shaped([[CH],[S]], { id: BlockID.TORCH, count: 4 }),

  // ── Ladder (6 sticks) ─────────────────────────────────────
  shaped([[S,null,S],[S,S,S],[S,null,S]], { id: BlockID.LADDER, count: 3 }),

  // ── Fence (6 sticks in 2 rows) ────────────────────────────
  shaped([[S,S,S],[S,S,S]], { id: BlockID.FENCE, count: 2 }),

  // ── Glass Pane (6 glass) ──────────────────────────────────
  shaped([[GL,GL,GL],[GL,GL,GL]], { id: BlockID.GLASS_PANE, count: 16 }),

  // ── Bookshelf ─────────────────────────────────────────────
  shaped([[P,P,P],[BK,BK,BK],[P,P,P]], { id: BlockID.BOOKSHELF, count: 1 }),

  // ── Stone Bricks (2×2 cobble) ─────────────────────────────
  shaped([[C,C],[C,C]], { id: BlockID.STONE_BRICKS, count: 4 }),

  // ── Sandstone (4 sand) ────────────────────────────────────
  shaped([[SA,SA],[SA,SA]], { id: BlockID.SANDSTONE, count: 1 }),

  // ── Mineral blocks (9× ingot / gem) ───────────────────────
  shaped([[I,I,I],[I,I,I],[I,I,I]], { id: BlockID.IRON_BLOCK,    count: 1 }),
  shaped([[G,G,G],[G,G,G],[G,G,G]], { id: BlockID.GOLD_BLOCK,    count: 1 }),
  shaped([[D,D,D],[D,D,D],[D,D,D]], { id: BlockID.DIAMOND_BLOCK, count: 1 }),
  shapeless([LB,LB,LB,LB,LB,LB,LB,LB,LB], { id: BlockID.LAPIS_BLOCK, count: 1 }),

  // ── TNT (5 gunpowder + 4 sand, alternating) ───────────────
  shaped([[GU,SA,GU],[SA,GU,SA],[GU,SA,GU]], { id: BlockID.TNT, count: 1 }),

  // ── Enchanting table ──────────────────────────────────────
  shaped([[null,BK,null],[D,OB,D],[OB,OB,OB]], { id: BlockID.ENCHANTING_TABLE, count: 1 }),

  // ── Trapdoor (6 planks) ───────────────────────────────────
  shaped([[P,P,P],[P,P,P]], { id: BlockID.TRAPDOOR, count: 2 }),

  // ── Cobblestone stairs ────────────────────────────────────
  shaped([[C,null,null],[C,C,null],[C,C,C]], { id: BlockID.COBBLE_STAIRS, count: 4 }),

  // ── Flint & Steel ─────────────────────────────────────────
  shaped([[I,null],[null,FL]], { id: ItemID.FLINT_STEEL, count: 1 }),
];
