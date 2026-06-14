'use strict';

// ─────────────────────────────────────────────────────────────
//  ItemID — IDs for non-block items (block items reuse their BlockID)
// ─────────────────────────────────────────────────────────────
export const ItemID = {
  // Materials
  STICK:            500,
  COAL:             501,
  CHARCOAL:         502,
  IRON_INGOT:       503,
  GOLD_INGOT:       504,
  DIAMOND:          505,
  REDSTONE_DUST:    506,
  LAPIS_LAZULI:     507,
  FLINT:            508,
  CLAY_BALL:        509,
  GLOWSTONE_DUST:   510,
  MELON_SLICE:      511,
  BOOK:             512,
  LEATHER:          513,
  FEATHER:          514,
  ARROW:            515,
  STRING:           516,
  GUNPOWDER:        517,
  BONE:             518,
  PAPER:            519,
  SUGAR:            520,

  // Pickaxes
  WOODEN_PICKAXE:   1000,
  STONE_PICKAXE:    1001,
  IRON_PICKAXE:     1002,
  DIAMOND_PICKAXE:  1003,
  GOLDEN_PICKAXE:   1004,

  // Axes
  WOODEN_AXE:       1010,
  STONE_AXE:        1011,
  IRON_AXE:         1012,
  DIAMOND_AXE:      1013,
  GOLDEN_AXE:       1014,

  // Shovels
  WOODEN_SHOVEL:    1020,
  STONE_SHOVEL:     1021,
  IRON_SHOVEL:      1022,
  DIAMOND_SHOVEL:   1023,
  GOLDEN_SHOVEL:    1024,

  // Swords
  WOODEN_SWORD:     1030,
  STONE_SWORD:      1031,
  IRON_SWORD:       1032,
  DIAMOND_SWORD:    1033,
  GOLDEN_SWORD:     1034,

  // Hoes
  WOODEN_HOE:       1040,
  STONE_HOE:        1041,
  IRON_HOE:         1042,
  DIAMOND_HOE:      1043,

  // Misc tools
  FLINT_STEEL:      1050,
  SHEARS:           1051,
};

// ─────────────────────────────────────────────────────────────
//  Tool speed multiplier per tool level (MC 1.0)
//  Level: 0=hand, 1=wood, 2=stone, 3=iron, 4=diamond, 5=gold(=12)
// ─────────────────────────────────────────────────────────────
export const TOOL_SPEED = { 0: 1, 1: 2, 2: 4, 3: 6, 4: 8, 5: 12 };

// ─────────────────────────────────────────────────────────────
//  Item registry
// ─────────────────────────────────────────────────────────────
const _reg = new Map();

function item(id, opts) {
  _reg.set(id, { id, maxStack: 64, toolType: null, toolLevel: 0,
    durability: -1, damage: 1, color: '#888', shape: 'item', ...opts });
}

// ── Materials ────────────────────────────────────────────────
item(ItemID.STICK,          { name:'stick',          displayName:'Bâton',              color:'#8B6914', shape:'stick' });
item(ItemID.COAL,           { name:'coal',           displayName:'Charbon',            color:'#1a1a1a' });
item(ItemID.CHARCOAL,       { name:'charcoal',       displayName:'Charbon de bois',    color:'#2a2a2a' });
item(ItemID.IRON_INGOT,     { name:'iron_ingot',     displayName:'Lingot de fer',      color:'#c8c8c8', shape:'ingot' });
item(ItemID.GOLD_INGOT,     { name:'gold_ingot',     displayName:"Lingot d'or",        color:'#FFD700', shape:'ingot' });
item(ItemID.DIAMOND,        { name:'diamond',        displayName:'Diamant',            color:'#00FFEE', shape:'gem'   });
item(ItemID.REDSTONE_DUST,  { name:'redstone',       displayName:'Redstone',           color:'#CC0000' });
item(ItemID.LAPIS_LAZULI,   { name:'lapis_lazuli',   displayName:'Lapis-lazuli',       color:'#1E3CCC', shape:'gem'   });
item(ItemID.FLINT,          { name:'flint',          displayName:'Silex',              color:'#444' });
item(ItemID.CLAY_BALL,      { name:'clay_ball',      displayName:"Boule d'argile",     color:'#8A97A0' });
item(ItemID.GLOWSTONE_DUST, { name:'glowstone_dust', displayName:'Poudre de Glowstone',color:'#FFE060' });
item(ItemID.MELON_SLICE,    { name:'melon_slice',    displayName:'Tranche de melon',   color:'#8FCB30' });
item(ItemID.BOOK,           { name:'book',           displayName:'Livre',              color:'#9B7A4A', shape:'book' });
item(ItemID.LEATHER,        { name:'leather',        displayName:'Cuir',               color:'#7C5230' });
item(ItemID.FEATHER,        { name:'feather',        displayName:'Plume',              color:'#eee' });
item(ItemID.ARROW,          { name:'arrow',          displayName:'Flèche',             color:'#aaa', maxStack:64 });
item(ItemID.STRING,         { name:'string',         displayName:'Fil',                color:'#eee' });
item(ItemID.GUNPOWDER,      { name:'gunpowder',      displayName:'Poudre à canon',     color:'#555' });
item(ItemID.BONE,           { name:'bone',           displayName:'Os',                 color:'#f0f0e0' });
item(ItemID.PAPER,          { name:'paper',          displayName:'Papier',             color:'#f5f5dc' });
item(ItemID.SUGAR,          { name:'sugar',          displayName:'Sucre',              color:'#fff' });

// ── Pickaxes ─────────────────────────────────────────────────
item(ItemID.WOODEN_PICKAXE,  { name:'wooden_pickaxe',  displayName:'Pioche Bois',    toolType:'pickaxe', toolLevel:1, durability:59,   maxStack:1, color:'#8B6914', shape:'pickaxe' });
item(ItemID.STONE_PICKAXE,   { name:'stone_pickaxe',   displayName:'Pioche Pierre',  toolType:'pickaxe', toolLevel:2, durability:131,  maxStack:1, color:'#808080', shape:'pickaxe' });
item(ItemID.IRON_PICKAXE,    { name:'iron_pickaxe',    displayName:'Pioche Fer',     toolType:'pickaxe', toolLevel:3, durability:250,  maxStack:1, color:'#c8c8c8', shape:'pickaxe' });
item(ItemID.DIAMOND_PICKAXE, { name:'diamond_pickaxe', displayName:'Pioche Diamant', toolType:'pickaxe', toolLevel:4, durability:1561, maxStack:1, color:'#00FFEE', shape:'pickaxe' });
item(ItemID.GOLDEN_PICKAXE,  { name:'golden_pickaxe',  displayName:"Pioche Or",      toolType:'pickaxe', toolLevel:5, durability:32,   maxStack:1, color:'#FFD700', shape:'pickaxe' });

// ── Axes ─────────────────────────────────────────────────────
item(ItemID.WOODEN_AXE,  { name:'wooden_axe',  displayName:'Hache Bois',    toolType:'axe', toolLevel:1, durability:59,   maxStack:1, color:'#8B6914', shape:'axe' });
item(ItemID.STONE_AXE,   { name:'stone_axe',   displayName:'Hache Pierre',  toolType:'axe', toolLevel:2, durability:131,  maxStack:1, color:'#808080', shape:'axe' });
item(ItemID.IRON_AXE,    { name:'iron_axe',    displayName:'Hache Fer',     toolType:'axe', toolLevel:3, durability:250,  maxStack:1, color:'#c8c8c8', shape:'axe' });
item(ItemID.DIAMOND_AXE, { name:'diamond_axe', displayName:'Hache Diamant', toolType:'axe', toolLevel:4, durability:1561, maxStack:1, color:'#00FFEE', shape:'axe' });
item(ItemID.GOLDEN_AXE,  { name:'golden_axe',  displayName:'Hache Or',      toolType:'axe', toolLevel:5, durability:32,   maxStack:1, color:'#FFD700', shape:'axe' });

// ── Shovels ──────────────────────────────────────────────────
item(ItemID.WOODEN_SHOVEL,  { name:'wooden_shovel',  displayName:'Pelle Bois',    toolType:'shovel', toolLevel:1, durability:59,   maxStack:1, color:'#8B6914', shape:'shovel' });
item(ItemID.STONE_SHOVEL,   { name:'stone_shovel',   displayName:'Pelle Pierre',  toolType:'shovel', toolLevel:2, durability:131,  maxStack:1, color:'#808080', shape:'shovel' });
item(ItemID.IRON_SHOVEL,    { name:'iron_shovel',    displayName:'Pelle Fer',     toolType:'shovel', toolLevel:3, durability:250,  maxStack:1, color:'#c8c8c8', shape:'shovel' });
item(ItemID.DIAMOND_SHOVEL, { name:'diamond_shovel', displayName:'Pelle Diamant', toolType:'shovel', toolLevel:4, durability:1561, maxStack:1, color:'#00FFEE', shape:'shovel' });
item(ItemID.GOLDEN_SHOVEL,  { name:'golden_shovel',  displayName:'Pelle Or',      toolType:'shovel', toolLevel:5, durability:32,   maxStack:1, color:'#FFD700', shape:'shovel' });

// ── Swords ───────────────────────────────────────────────────
item(ItemID.WOODEN_SWORD,  { name:'wooden_sword',  displayName:'Épée Bois',    toolType:'sword', toolLevel:1, durability:59,   maxStack:1, color:'#8B6914', shape:'sword', damage:5 });
item(ItemID.STONE_SWORD,   { name:'stone_sword',   displayName:'Épée Pierre',  toolType:'sword', toolLevel:2, durability:131,  maxStack:1, color:'#808080', shape:'sword', damage:6 });
item(ItemID.IRON_SWORD,    { name:'iron_sword',    displayName:'Épée Fer',     toolType:'sword', toolLevel:3, durability:250,  maxStack:1, color:'#c8c8c8', shape:'sword', damage:7 });
item(ItemID.DIAMOND_SWORD, { name:'diamond_sword', displayName:'Épée Diamant', toolType:'sword', toolLevel:4, durability:1561, maxStack:1, color:'#00FFEE', shape:'sword', damage:8 });
item(ItemID.GOLDEN_SWORD,  { name:'golden_sword',  displayName:'Épée Or',      toolType:'sword', toolLevel:5, durability:32,   maxStack:1, color:'#FFD700', shape:'sword', damage:5 });

// ── Hoes ─────────────────────────────────────────────────────
item(ItemID.WOODEN_HOE,  { name:'wooden_hoe',  displayName:'Houe Bois',    toolType:'hoe', toolLevel:1, durability:59,   maxStack:1, color:'#8B6914', shape:'hoe' });
item(ItemID.STONE_HOE,   { name:'stone_hoe',   displayName:'Houe Pierre',  toolType:'hoe', toolLevel:2, durability:131,  maxStack:1, color:'#808080', shape:'hoe' });
item(ItemID.IRON_HOE,    { name:'iron_hoe',    displayName:'Houe Fer',     toolType:'hoe', toolLevel:3, durability:250,  maxStack:1, color:'#c8c8c8', shape:'hoe' });
item(ItemID.DIAMOND_HOE, { name:'diamond_hoe', displayName:'Houe Diamant', toolType:'hoe', toolLevel:4, durability:1561, maxStack:1, color:'#00FFEE', shape:'hoe' });

// ── Misc ─────────────────────────────────────────────────────
item(ItemID.FLINT_STEEL, { name:'flint_and_steel', displayName:'Briquet', toolType:null, toolLevel:0, durability:64,  maxStack:1, color:'#888', shape:'flint_steel' });
item(ItemID.SHEARS,      { name:'shears',          displayName:'Ciseaux', toolType:'shears', toolLevel:0, durability:238, maxStack:1, color:'#aaa', shape:'shears' });

// ─────────────────────────────────────────────────────────────
//  Exports
// ─────────────────────────────────────────────────────────────
export function getItemInfo(id) { return _reg.get(id) ?? null; }
export function isBlockItem(id) { return id >= 0 && id < 500; }

// Resolves drop itemName strings (from Block.drops arrays) to item/block IDs
const _dropNames = {
  cobblestone: 4, dirt: 3, gravel: 13, sand: 12, oak_sapling: 6,
  flint:         ItemID.FLINT,
  coal:          ItemID.COAL,
  diamond:       ItemID.DIAMOND,
  redstone:      ItemID.REDSTONE_DUST,
  lapis_lazuli:  ItemID.LAPIS_LAZULI,
  clay_ball:     ItemID.CLAY_BALL,
  glowstone_dust:ItemID.GLOWSTONE_DUST,
  melon_slice:   ItemID.MELON_SLICE,
  book:          ItemID.BOOK,
  // simplifications
  iron_ingot:    ItemID.IRON_INGOT,  // smelted normally, but we give raw
};
export function resolveDropName(name) { return _dropNames[name] ?? null; }
