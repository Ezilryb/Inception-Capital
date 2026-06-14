/**
 * ============================================================
 *  BlockRegistry.js — Minecraft 1.0 Recreation
 * ============================================================
 *  Registre de tous les blocs. Atlas terrain.png 16×16 tuiles.
 *  index = row * 16 + col  (row 0 = haut de l'image)
 * ============================================================
 */
'use strict';

import { Block, BlockTexture, RenderType, Material, ToolType, ToolLevel } from './Block.js';

// ─────────────────────────────────────────────────────────────
//  IDs canoniques (exhaustif MC 1.0)
// ─────────────────────────────────────────────────────────────
export const BlockID = Object.freeze({
  AIR:              0,
  STONE:            1,
  GRASS:            2,
  DIRT:             3,
  COBBLESTONE:      4,
  PLANKS:           5,
  SAPLING:          6,
  BEDROCK:          7,
  WATER_FLOWING:    8,
  WATER_STILL:      9,
  LAVA_FLOWING:    10,
  LAVA_STILL:      11,
  SAND:            12,
  GRAVEL:          13,
  GOLD_ORE:        14,
  IRON_ORE:        15,
  COAL_ORE:        16,
  LOG:             17,
  LEAVES:          18,
  SPONGE:          19,
  GLASS:           20,
  LAPIS_ORE:       21,
  LAPIS_BLOCK:     22,
  DISPENSER:       23,
  SANDSTONE:       24,
  NOTEBLOCK:       25,
  BED:             26,
  POWERED_RAIL:    27,
  DETECTOR_RAIL:   28,
  STICKY_PISTON:   29,
  COBWEB:          30,
  TALL_GRASS:      31,
  DEAD_BUSH:       32,
  PISTON:          33,
  PISTON_HEAD:     34,
  WOOL:            35,
  YELLOW_FLOWER:   37,
  RED_FLOWER:      38,
  BROWN_MUSHROOM:  39,
  RED_MUSHROOM:    40,
  GOLD_BLOCK:      41,
  IRON_BLOCK:      42,
  DOUBLE_SLAB:     43,
  SLAB:            44,
  BRICKS:          45,
  TNT:             46,
  BOOKSHELF:       47,
  MOSSY_COBBLE:    48,
  OBSIDIAN:        49,
  TORCH:           50,
  FIRE:            51,
  MOB_SPAWNER:     52,
  OAK_STAIRS:      53,
  CHEST:           54,
  REDSTONE_WIRE:   55,
  DIAMOND_ORE:     56,
  DIAMOND_BLOCK:   57,
  CRAFTING_TABLE:  58,
  WHEAT:           59,
  FARMLAND:        60,
  FURNACE:         61,
  FURNACE_LIT:     62,
  SIGN_POST:       63,
  DOOR_WOOD:       64,
  LADDER:          65,
  RAIL:            66,
  COBBLE_STAIRS:   67,
  SIGN_WALL:       68,
  LEVER:           69,
  STONE_PLATE:     70,
  DOOR_IRON:       71,
  WOOD_PLATE:      72,
  REDSTONE_ORE:    73,
  REDSTONE_ORE_LIT:74,
  REDSTONE_TORCH:  75,
  REDSTONE_TORCH_ON:76,
  BUTTON:          77,
  SNOW_LAYER:      78,
  ICE:             79,
  SNOW_BLOCK:      80,
  CACTUS:          81,
  CLAY_BLOCK:      82,
  SUGAR_CANE:      83,
  JUKEBOX:         84,
  FENCE:           85,
  PUMPKIN:         86,
  NETHERRACK:      87,
  SOUL_SAND:       88,
  GLOWSTONE:       89,
  NETHER_PORTAL:   90,
  PUMPKIN_LIT:     91,
  CAKE:            92,
  REPEATER:        93,
  REPEATER_ON:     94,
  STAINED_GLASS:   95,
  TRAPDOOR:        96,
  MONSTER_EGG:     97,
  STONE_BRICKS:    98,
  HUGE_BROWN_MUSHROOM: 99,
  HUGE_RED_MUSHROOM:  100,
  IRON_BARS:       101,
  GLASS_PANE:      102,
  MELON:           103,
  PUMPKIN_STEM:    104,
  MELON_STEM:      105,
  VINES:           106,
  FENCE_GATE:      107,
  BRICK_STAIRS:    108,
  STONE_BRICK_STAIRS: 109,
  MYCELIUM:        110,
  LILY_PAD:        111,
  NETHER_BRICK:    112,
  NETHER_BRICK_FENCE: 113,
  NETHER_BRICK_STAIRS: 114,
  NETHER_WART:     115,
  ENCHANTING_TABLE: 116,
  BREWING_STAND:   117,
  CAULDRON:        118,
  END_PORTAL:      119,
  END_PORTAL_FRAME: 120,
  END_STONE:       121,
  DRAGON_EGG:      122,
});

// ─────────────────────────────────────────────────────────────
//  Atlas terrain.png — indices de tuiles (row*16+col)
//  Basé sur le layout terrain.png de Minecraft Beta/1.0
// ─────────────────────────────────────────────────────────────
const T = {
  GRASS_TOP:      0,   // row 0, col 0
  STONE:          1,
  DIRT:           2,
  GRASS_SIDE:     3,
  PLANKS:         4,
  SLAB_SIDE:      5,
  SLAB_TOP:       6,
  BRICKS:         7,
  TNT_SIDE:       8,
  TNT_TOP:        9,
  TNT_BOTTOM:    10,
  COBWEB:        11,
  RED_FLOWER:    12,
  YELLOW_FLOWER: 13,
  SAPLING:       15,
  COBBLE:        16,
  BEDROCK:       17,
  SAND:          18,
  GRAVEL:        19,
  LOG_SIDE:      20,
  LOG_TOP:       21,
  IRON_BLOCK:    22,
  GOLD_BLOCK:    23,
  DIAMOND_BLOCK: 24,
  CHEST_TOP:     25,
  CHEST_FRONT:   26,
  CHEST_SIDE:    27,
  CRAFTING_TOP:  43,
  CRAFTING_SIDE: 44,
  FURNACE_FRONT: 44,
  FURNACE_SIDE:  45,
  FURNACE_TOP:   62,
  DISPENSER_FRONT: 46,
  SPONGE:        48,
  GLASS:         49,
  DIAMOND_ORE:   50,
  REDSTONE_ORE:  51,
  LEAVES_OPAQUE: 52,
  STONE_BRICK:   54,
  DEAD_BUSH:     55,
  TALL_GRASS:    39,
  FERN:          56,
  BOOKSHELF:     35,
  MOSSY_COBBLE:  36,
  OBSIDIAN:      37,
  GRASS_SIDE_OVERLAY: 38,
  TORCH:         80,
  DOOR_WOOD_TOP: 81,
  DOOR_WOOD_BOT: 97,
  DOOR_IRON_TOP: 82,
  DOOR_IRON_BOT: 98,
  LADDER:        83,
  TRAPDOOR:      84,
  IRON_BARS:     85,
  FARMLAND_DRY:  86,
  FARMLAND_WET:  87,
  WHEAT_0:       88,  WHEAT_1: 89,  WHEAT_2: 90,  WHEAT_3: 91,
  WHEAT_4: 104, WHEAT_5: 105, WHEAT_6: 106, WHEAT_7: 107,
  LEVER:         96,
  REDSTONE_TORCH_ON:  99,
  REDSTONE_TORCH_OFF: 115,
  RAIL:          128,
  RAIL_CURVE:    112,
  POWERED_RAIL:  163,
  DETECTOR_RAIL: 195,
  FIRE_0:        31,
  WOOL_WHITE:    64,
  SNOW:          66,
  ICE:           67,
  SNOW_SIDE:     68,
  CACTUS_TOP:    69,
  CACTUS_SIDE:   70,
  CACTUS_BOTTOM: 71,
  CLAY:          72,
  SUGAR_CANE:    73,
  MYCELIUM_TOP:  78,
  MYCELIUM_SIDE: 79,
  WATER_STILL:   205,
  WATER_FLOW:    206,
  LAVA_STILL:    237,
  LAVA_FLOW:     238,
  SANDSTONE_TOP: 176,
  SANDSTONE_SIDE:192,
  SANDSTONE_BOT: 208,
  GOLD_ORE:      32,
  IRON_ORE:      33,
  COAL_ORE:      34,
  LAPIS_ORE:     160,
  LAPIS_BLOCK:   144,
  NETHERRACK:    103,
  SOUL_SAND:     104,
  GLOWSTONE:     105,
  NETHER_BRICK:  224,
  END_STONE:     175,
  ENCHANT_TOP:   118,
  ENCHANT_SIDE:  119,
  ENCHANT_BOT:    6,
  BROWN_MUSHROOM: 29,
  RED_MUSHROOM:   28,
  PUMPKIN_TOP:    102,
  PUMPKIN_SIDE:   118,
  PUMPKIN_FRONT:  119,
  PUMPKIN_LIT_FRONT: 120,
  MELON_TOP:      136,
  MELON_SIDE:     137,
  VINE:           143,
  LILY_PAD:       140,
  DRAGON_EGG:     214,
  END_PORTAL_FRAME_TOP: 159,
  END_PORTAL_FRAME_SIDE: 175,
  NOTEBLOCK:      74,
  JUKEBOX_TOP:    75,
  JUKEBOX_SIDE:   74,
};

// ─────────────────────────────────────────────────────────────
//  BlockRegistry
// ─────────────────────────────────────────────────────────────
class BlockRegistry {
  constructor() {
    /** @type {Map<number, Block>} */
    this._blocks = new Map();
  }

  register(config) {
    const block = new Block(config);
    this._blocks.set(block.id, block);
    return block;
  }

  get(id) {
    return this._blocks.get(id) ?? this._blocks.get(BlockID.AIR);
  }

  has(id) { return this._blocks.has(id); }

  /** Itère sur tous les blocs enregistrés */
  [Symbol.iterator]() { return this._blocks.values(); }
}

// ─────────────────────────────────────────────────────────────
//  Instanciation et remplissage du registre
// ─────────────────────────────────────────────────────────────
export const REGISTRY = new BlockRegistry();

const R = REGISTRY; // alias court

// ── Air ──────────────────────────────────────────────────────
R.register({ id: BlockID.AIR, name: 'air', material: Material.AIR,
  solid: false, collidable: false, transparent: true, opacity: 0,
  hardness: 0, renderType: RenderType.NONE, drops: 'nothing' });

// ── Terrain de base ──────────────────────────────────────────
R.register({ id: BlockID.STONE, name: 'stone', displayName: 'Pierre',
  material: Material.ROCK,
  texture: BlockTexture.uniform(T.STONE),
  hardness: 1.5, requiresTool: true, toolType: ToolType.PICKAXE, toolLevel: ToolLevel.WOOD,
  drops: [{ itemName: 'cobblestone', count: 1 }] });

R.register({ id: BlockID.GRASS, name: 'grass_block', displayName: "Bloc d'herbe",
  material: Material.DIRT,
  texture: BlockTexture.topSideBottom(T.GRASS_TOP, T.GRASS_SIDE, T.DIRT),
  tintType: 'grass',
  hardness: 0.6, toolType: ToolType.SHOVEL,
  drops: [{ itemName: 'dirt', count: 1 }] });

R.register({ id: BlockID.DIRT, name: 'dirt', displayName: 'Terre',
  material: Material.DIRT,
  texture: BlockTexture.uniform(T.DIRT),
  hardness: 0.5, toolType: ToolType.SHOVEL });

R.register({ id: BlockID.COBBLESTONE, name: 'cobblestone', displayName: 'Cobblestone',
  material: Material.ROCK,
  texture: BlockTexture.uniform(T.COBBLE),
  hardness: 2.0, requiresTool: true, toolType: ToolType.PICKAXE, toolLevel: ToolLevel.WOOD });

R.register({ id: BlockID.PLANKS, name: 'oak_planks', displayName: 'Planches de chêne',
  material: Material.WOOD,
  texture: BlockTexture.uniform(T.PLANKS),
  hardness: 2.0, toolType: ToolType.AXE, flammable: true });

R.register({ id: BlockID.SAPLING, name: 'oak_sapling', displayName: 'Pousse de chêne',
  material: Material.PLANT,
  texture: BlockTexture.uniform(T.SAPLING),
  renderType: RenderType.CROSS,
  solid: false, collidable: false, transparent: true, opacity: 0,
  hardness: 0, drops: 'self' });

R.register({ id: BlockID.BEDROCK, name: 'bedrock', displayName: 'Bedrock',
  material: Material.ROCK,
  texture: BlockTexture.uniform(T.BEDROCK),
  hardness: -1, drops: 'nothing' });

// ── Liquides ─────────────────────────────────────────────────
R.register({ id: BlockID.WATER_FLOWING, name: 'flowing_water',
  material: Material.WATER,
  texture: BlockTexture.uniform(T.WATER_FLOW),
  renderType: RenderType.LIQUID,
  solid: false, collidable: false, transparent: true, opacity: 2,
  liquid: true, replaceable: true, hardness: 100, drops: 'nothing' });

R.register({ id: BlockID.WATER_STILL, name: 'water',
  material: Material.WATER,
  texture: BlockTexture.uniform(T.WATER_STILL),
  renderType: RenderType.LIQUID,
  solid: false, collidable: false, transparent: true, opacity: 2,
  liquid: true, replaceable: true, hardness: 100, drops: 'nothing' });

R.register({ id: BlockID.LAVA_FLOWING, name: 'flowing_lava',
  material: Material.LAVA,
  texture: BlockTexture.uniform(T.LAVA_FLOW),
  renderType: RenderType.LIQUID,
  solid: false, collidable: false, transparent: false, opacity: 15,
  luminosity: 15, liquid: true, replaceable: true, hardness: 100, drops: 'nothing' });

R.register({ id: BlockID.LAVA_STILL, name: 'lava',
  material: Material.LAVA,
  texture: BlockTexture.uniform(T.LAVA_STILL),
  renderType: RenderType.LIQUID,
  solid: false, collidable: false, transparent: false, opacity: 15,
  luminosity: 15, liquid: true, replaceable: true, hardness: 100, drops: 'nothing' });

// ── Terrain naturel ───────────────────────────────────────────
R.register({ id: BlockID.SAND, name: 'sand', displayName: 'Sable',
  material: Material.SAND,
  texture: BlockTexture.uniform(T.SAND),
  gravity: true, hardness: 0.5, toolType: ToolType.SHOVEL });

R.register({ id: BlockID.GRAVEL, name: 'gravel', displayName: 'Gravier',
  material: Material.SAND,
  texture: BlockTexture.uniform(T.GRAVEL),
  gravity: true, hardness: 0.6, toolType: ToolType.SHOVEL,
  drops: [{ itemName: 'gravel', count: 1, probability: 0.9 },
           { itemName: 'flint',  count: 1, probability: 0.1 }] });

// ── Minerais ─────────────────────────────────────────────────
R.register({ id: BlockID.GOLD_ORE, name: 'gold_ore', displayName: "Minerai d'or",
  material: Material.ROCK,
  texture: BlockTexture.uniform(T.GOLD_ORE),
  hardness: 3.0, requiresTool: true, toolType: ToolType.PICKAXE, toolLevel: ToolLevel.IRON });

R.register({ id: BlockID.IRON_ORE, name: 'iron_ore', displayName: "Minerai de fer",
  material: Material.ROCK,
  texture: BlockTexture.uniform(T.IRON_ORE),
  hardness: 3.0, requiresTool: true, toolType: ToolType.PICKAXE, toolLevel: ToolLevel.STONE });

R.register({ id: BlockID.COAL_ORE, name: 'coal_ore', displayName: "Minerai de charbon",
  material: Material.ROCK,
  texture: BlockTexture.uniform(T.COAL_ORE),
  hardness: 3.0, requiresTool: true, toolType: ToolType.PICKAXE, toolLevel: ToolLevel.WOOD,
  drops: [{ itemName: 'coal', count: 1 }] });

R.register({ id: BlockID.DIAMOND_ORE, name: 'diamond_ore', displayName: "Minerai de diamant",
  material: Material.ROCK,
  texture: BlockTexture.uniform(T.DIAMOND_ORE),
  hardness: 3.0, requiresTool: true, toolType: ToolType.PICKAXE, toolLevel: ToolLevel.IRON,
  drops: [{ itemName: 'diamond', count: 1 }] });

R.register({ id: BlockID.REDSTONE_ORE, name: 'redstone_ore',
  material: Material.ROCK,
  texture: BlockTexture.uniform(T.REDSTONE_ORE),
  hardness: 3.0, requiresTool: true, toolType: ToolType.PICKAXE, toolLevel: ToolLevel.IRON,
  drops: [{ itemName: 'redstone', count: 4, min: 4, max: 5 }] });

R.register({ id: BlockID.REDSTONE_ORE_LIT, name: 'lit_redstone_ore',
  material: Material.ROCK,
  texture: BlockTexture.uniform(T.REDSTONE_ORE),
  hardness: 3.0, requiresTool: true, toolType: ToolType.PICKAXE, toolLevel: ToolLevel.IRON,
  luminosity: 9,
  drops: [{ itemName: 'redstone', count: 4, min: 4, max: 5 }] });

R.register({ id: BlockID.LAPIS_ORE, name: 'lapis_ore',
  material: Material.ROCK,
  texture: BlockTexture.uniform(T.LAPIS_ORE),
  hardness: 3.0, requiresTool: true, toolType: ToolType.PICKAXE, toolLevel: ToolLevel.STONE,
  drops: [{ itemName: 'lapis_lazuli', count: 4, min: 4, max: 8 }] });

// ── Bois & végétation ────────────────────────────────────────
R.register({ id: BlockID.LOG, name: 'oak_log', displayName: 'Bois de chêne',
  material: Material.WOOD,
  texture: BlockTexture.capSide(T.LOG_TOP, T.LOG_SIDE),
  hardness: 2.0, toolType: ToolType.AXE, flammable: true, hasMetadata: true });

R.register({ id: BlockID.LEAVES, name: 'oak_leaves', displayName: 'Feuilles de chêne',
  material: Material.LEAVES,
  texture: BlockTexture.uniform(T.LEAVES_OPAQUE),
  tintType: 'foliage',
  transparent: true, opacity: 1,
  hardness: 0.2, flammable: true, hasMetadata: true,
  drops: [{ itemName: 'oak_sapling', count: 1, probability: 0.05 }] });

R.register({ id: BlockID.TALL_GRASS, name: 'tall_grass',
  material: Material.PLANT,
  texture: BlockTexture.uniform(T.TALL_GRASS),
  tintType: 'grass',
  renderType: RenderType.CROSS,
  solid: false, collidable: false, transparent: true, opacity: 0,
  hardness: 0, replaceable: true, drops: 'nothing' });

R.register({ id: BlockID.DEAD_BUSH, name: 'dead_bush',
  material: Material.PLANT,
  texture: BlockTexture.uniform(T.DEAD_BUSH),
  renderType: RenderType.CROSS,
  solid: false, collidable: false, transparent: true, opacity: 0,
  hardness: 0, drops: 'nothing' });

R.register({ id: BlockID.YELLOW_FLOWER, name: 'dandelion', displayName: 'Pissenlit',
  material: Material.PLANT,
  texture: BlockTexture.uniform(T.YELLOW_FLOWER),
  renderType: RenderType.CROSS,
  solid: false, collidable: false, transparent: true, opacity: 0, hardness: 0 });

R.register({ id: BlockID.RED_FLOWER, name: 'poppy', displayName: 'Coquelicot',
  material: Material.PLANT,
  texture: BlockTexture.uniform(T.RED_FLOWER),
  renderType: RenderType.CROSS,
  solid: false, collidable: false, transparent: true, opacity: 0, hardness: 0 });

R.register({ id: BlockID.BROWN_MUSHROOM, name: 'brown_mushroom',
  material: Material.PLANT,
  texture: BlockTexture.uniform(T.BROWN_MUSHROOM),
  renderType: RenderType.CROSS,
  solid: false, collidable: false, transparent: true, opacity: 0,
  luminosity: 1, hardness: 0 });

R.register({ id: BlockID.RED_MUSHROOM, name: 'red_mushroom',
  material: Material.PLANT,
  texture: BlockTexture.uniform(T.RED_MUSHROOM),
  renderType: RenderType.CROSS,
  solid: false, collidable: false, transparent: true, opacity: 0, hardness: 0 });

R.register({ id: BlockID.COBWEB, name: 'cobweb',
  material: Material.WEB,
  texture: BlockTexture.uniform(T.COBWEB),
  renderType: RenderType.CROSS,
  solid: false, collidable: true, transparent: true, opacity: 1,
  hardness: 4.0, toolType: ToolType.SWORD });

R.register({ id: BlockID.SUGAR_CANE, name: 'sugar_cane',
  material: Material.PLANT,
  texture: BlockTexture.uniform(T.SUGAR_CANE),
  renderType: RenderType.CROSS,
  solid: false, collidable: false, transparent: true, opacity: 0, hardness: 0 });

R.register({ id: BlockID.VINES, name: 'vines',
  material: Material.PLANT,
  texture: BlockTexture.uniform(T.VINE),
  renderType: RenderType.CROSS,
  solid: false, collidable: false, transparent: true, opacity: 1,
  hardness: 0.2, flammable: true, tintType: 'foliage' });

R.register({ id: BlockID.LILY_PAD, name: 'lily_pad',
  material: Material.PLANT,
  texture: BlockTexture.uniform(T.LILY_PAD),
  renderType: RenderType.FLAT,
  solid: true, collidable: true, transparent: true, opacity: 0,
  hardness: 0, tintType: 'foliage' });

// ── Blocs crafted ─────────────────────────────────────────────
R.register({ id: BlockID.GOLD_BLOCK, name: 'gold_block',
  material: Material.METAL,
  texture: BlockTexture.uniform(T.GOLD_BLOCK),
  hardness: 3.0, requiresTool: true, toolType: ToolType.PICKAXE, toolLevel: ToolLevel.IRON });

R.register({ id: BlockID.IRON_BLOCK, name: 'iron_block',
  material: Material.METAL,
  texture: BlockTexture.uniform(T.IRON_BLOCK),
  hardness: 5.0, requiresTool: true, toolType: ToolType.PICKAXE, toolLevel: ToolLevel.STONE });

R.register({ id: BlockID.DIAMOND_BLOCK, name: 'diamond_block',
  material: Material.METAL,
  texture: BlockTexture.uniform(T.DIAMOND_BLOCK),
  hardness: 5.0, requiresTool: true, toolType: ToolType.PICKAXE, toolLevel: ToolLevel.IRON });

R.register({ id: BlockID.LAPIS_BLOCK, name: 'lapis_block',
  material: Material.ROCK,
  texture: BlockTexture.uniform(T.LAPIS_BLOCK),
  hardness: 3.0, requiresTool: true, toolType: ToolType.PICKAXE, toolLevel: ToolLevel.STONE });

R.register({ id: BlockID.BRICKS, name: 'bricks',
  material: Material.ROCK,
  texture: BlockTexture.uniform(T.BRICKS),
  hardness: 2.0, requiresTool: true, toolType: ToolType.PICKAXE });

R.register({ id: BlockID.STONE_BRICKS, name: 'stone_bricks',
  material: Material.ROCK,
  texture: BlockTexture.uniform(T.STONE_BRICK),
  hardness: 1.5, requiresTool: true, toolType: ToolType.PICKAXE });

R.register({ id: BlockID.MOSSY_COBBLE, name: 'mossy_cobblestone',
  material: Material.ROCK,
  texture: BlockTexture.uniform(T.MOSSY_COBBLE),
  hardness: 2.0, requiresTool: true, toolType: ToolType.PICKAXE });

R.register({ id: BlockID.OBSIDIAN, name: 'obsidian',
  material: Material.ROCK,
  texture: BlockTexture.uniform(T.OBSIDIAN),
  hardness: 50.0, requiresTool: true, toolType: ToolType.PICKAXE, toolLevel: ToolLevel.DIAMOND,
  blastResistance: 6_000_000 });

R.register({ id: BlockID.SANDSTONE, name: 'sandstone',
  material: Material.ROCK,
  texture: BlockTexture.topSideBottom(T.SANDSTONE_TOP, T.SANDSTONE_SIDE, T.SANDSTONE_BOT),
  hardness: 0.8, requiresTool: true, toolType: ToolType.PICKAXE });

R.register({ id: BlockID.SPONGE, name: 'sponge',
  material: Material.PLANT,
  texture: BlockTexture.uniform(T.SPONGE),
  hardness: 0.6 });

R.register({ id: BlockID.GLASS, name: 'glass',
  material: Material.GLASS,
  texture: BlockTexture.uniform(T.GLASS),
  transparent: true, opacity: 0,
  hardness: 0.3, drops: 'nothing' });

R.register({ id: BlockID.TNT, name: 'tnt',
  material: Material.CLOTH,
  texture: BlockTexture.topSideBottom(T.TNT_TOP, T.TNT_SIDE, T.TNT_BOTTOM),
  hardness: 0, flammable: true });

R.register({ id: BlockID.BOOKSHELF, name: 'bookshelf',
  material: Material.WOOD,
  texture: BlockTexture.topSideBottom(T.PLANKS, T.BOOKSHELF, T.PLANKS),
  hardness: 1.5, toolType: ToolType.AXE, flammable: true,
  drops: [{ itemName: 'book', count: 3 }] });

// ── Outils / mécanismes ───────────────────────────────────────
R.register({ id: BlockID.CRAFTING_TABLE, name: 'crafting_table',
  material: Material.WOOD,
  texture: BlockTexture.faces({ top: T.CRAFTING_TOP, bottom: T.PLANKS,
    north: T.CRAFTING_SIDE, south: T.CRAFTING_SIDE,
    east:  T.CRAFTING_SIDE, west:  T.CRAFTING_SIDE }),
  hardness: 2.5, toolType: ToolType.AXE, hasBlockEntity: false });

R.register({ id: BlockID.FURNACE, name: 'furnace',
  material: Material.ROCK,
  texture: BlockTexture.faces({ top: T.FURNACE_TOP, bottom: T.FURNACE_TOP,
    north: T.FURNACE_FRONT, south: T.FURNACE_SIDE,
    east:  T.FURNACE_SIDE,  west:  T.FURNACE_SIDE }),
  hardness: 3.5, requiresTool: true, toolType: ToolType.PICKAXE, hasBlockEntity: true });

R.register({ id: BlockID.FURNACE_LIT, name: 'lit_furnace',
  material: Material.ROCK,
  texture: BlockTexture.faces({ top: T.FURNACE_TOP, bottom: T.FURNACE_TOP,
    north: T.FURNACE_FRONT, south: T.FURNACE_SIDE,
    east:  T.FURNACE_SIDE,  west:  T.FURNACE_SIDE }),
  luminosity: 13,
  hardness: 3.5, requiresTool: true, toolType: ToolType.PICKAXE, hasBlockEntity: true });

R.register({ id: BlockID.CHEST, name: 'chest',
  material: Material.WOOD,
  texture: BlockTexture.topSideBottom(T.CHEST_TOP, T.CHEST_SIDE, T.CHEST_TOP),
  hardness: 2.5, toolType: ToolType.AXE, hasBlockEntity: true });

R.register({ id: BlockID.DISPENSER, name: 'dispenser',
  material: Material.ROCK,
  texture: BlockTexture.faces({ top: T.FURNACE_TOP, bottom: T.FURNACE_TOP,
    north: T.DISPENSER_FRONT, south: T.FURNACE_SIDE,
    east: T.FURNACE_SIDE, west: T.FURNACE_SIDE }),
  hardness: 3.5, requiresTool: true, toolType: ToolType.PICKAXE, hasBlockEntity: true });

R.register({ id: BlockID.ENCHANTING_TABLE, name: 'enchanting_table',
  material: Material.ROCK,
  texture: BlockTexture.topSideBottom(T.ENCHANT_TOP, T.ENCHANT_SIDE, T.ENCHANT_BOT),
  transparent: true, opacity: 0,
  hardness: 5.0, requiresTool: true, toolType: ToolType.PICKAXE, toolLevel: ToolLevel.WOOD,
  hasBlockEntity: true });

R.register({ id: BlockID.BREWING_STAND, name: 'brewing_stand',
  material: Material.METAL,
  texture: BlockTexture.uniform(T.FURNACE_TOP),
  transparent: true, opacity: 0,
  solid: false, hardness: 0.5, luminosity: 1, hasBlockEntity: true });

// ── Lumière ───────────────────────────────────────────────────
R.register({ id: BlockID.TORCH, name: 'torch',
  material: Material.PLANT,
  texture: BlockTexture.uniform(T.TORCH),
  renderType: RenderType.TORCH,
  solid: false, collidable: false, transparent: true, opacity: 0,
  hardness: 0, luminosity: 14 });

R.register({ id: BlockID.GLOWSTONE, name: 'glowstone',
  material: Material.GLASS,
  texture: BlockTexture.uniform(T.GLOWSTONE),
  transparent: true, opacity: 0,
  hardness: 0.3, luminosity: 15,
  drops: [{ itemName: 'glowstone_dust', count: 2, min: 2, max: 4 }] });

// ── Nether ────────────────────────────────────────────────────
R.register({ id: BlockID.NETHERRACK, name: 'netherrack',
  material: Material.ROCK,
  texture: BlockTexture.uniform(T.NETHERRACK),
  hardness: 0.4, requiresTool: true, toolType: ToolType.PICKAXE });

R.register({ id: BlockID.SOUL_SAND, name: 'soul_sand',
  material: Material.SAND,
  texture: BlockTexture.uniform(T.SOUL_SAND),
  hardness: 0.5, toolType: ToolType.SHOVEL });

R.register({ id: BlockID.NETHER_BRICK, name: 'nether_bricks',
  material: Material.ROCK,
  texture: BlockTexture.uniform(T.NETHER_BRICK),
  hardness: 2.0, requiresTool: true, toolType: ToolType.PICKAXE });

// ── The End ───────────────────────────────────────────────────
R.register({ id: BlockID.END_STONE, name: 'end_stone',
  material: Material.ROCK,
  texture: BlockTexture.uniform(T.END_STONE),
  hardness: 3.0, requiresTool: true, toolType: ToolType.PICKAXE });

R.register({ id: BlockID.DRAGON_EGG, name: 'dragon_egg',
  material: Material.ROCK,
  texture: BlockTexture.uniform(T.DRAGON_EGG),
  hardness: 3.0, luminosity: 1 });

R.register({ id: BlockID.END_PORTAL_FRAME, name: 'end_portal_frame',
  material: Material.ROCK,
  texture: BlockTexture.topSideBottom(T.END_PORTAL_FRAME_TOP, T.END_PORTAL_FRAME_SIDE, T.END_STONE),
  hardness: -1 });

// ── Divers ────────────────────────────────────────────────────
R.register({ id: BlockID.SNOW_BLOCK, name: 'snow_block',
  material: Material.SNOW,
  texture: BlockTexture.uniform(T.SNOW),
  hardness: 0.2, toolType: ToolType.SHOVEL });

R.register({ id: BlockID.ICE, name: 'ice',
  material: Material.ICE,
  texture: BlockTexture.uniform(T.ICE),
  transparent: true, opacity: 3,
  hardness: 0.5, toolType: ToolType.PICKAXE,
  drops: 'nothing' });

R.register({ id: BlockID.CLAY_BLOCK, name: 'clay',
  material: Material.CLAY,
  texture: BlockTexture.uniform(T.CLAY),
  hardness: 0.6, toolType: ToolType.SHOVEL,
  drops: [{ itemName: 'clay_ball', count: 4 }] });

R.register({ id: BlockID.FARMLAND, name: 'farmland',
  material: Material.DIRT,
  texture: BlockTexture.topSideBottom(T.FARMLAND_WET, T.DIRT, T.DIRT),
  hardness: 0.6, toolType: ToolType.SHOVEL, hasMetadata: true });

R.register({ id: BlockID.MYCELIUM, name: 'mycelium',
  material: Material.DIRT,
  texture: BlockTexture.topSideBottom(T.MYCELIUM_TOP, T.MYCELIUM_SIDE, T.DIRT),
  hardness: 0.6, toolType: ToolType.SHOVEL });

R.register({ id: BlockID.PUMPKIN, name: 'pumpkin',
  material: Material.GOURD,
  texture: BlockTexture.topSideBottom(T.PUMPKIN_TOP, T.PUMPKIN_SIDE, T.PUMPKIN_TOP),
  hardness: 1.0, toolType: ToolType.AXE });

R.register({ id: BlockID.PUMPKIN_LIT, name: 'lit_pumpkin',
  material: Material.GOURD,
  texture: BlockTexture.faces({ top: T.PUMPKIN_TOP, bottom: T.PUMPKIN_TOP,
    north: T.PUMPKIN_LIT_FRONT, south: T.PUMPKIN_SIDE,
    east: T.PUMPKIN_SIDE, west: T.PUMPKIN_SIDE }),
  hardness: 1.0, toolType: ToolType.AXE, luminosity: 15 });

R.register({ id: BlockID.MELON, name: 'melon',
  material: Material.GOURD,
  texture: BlockTexture.topSideBottom(T.MELON_TOP, T.MELON_SIDE, T.MELON_TOP),
  hardness: 1.0, toolType: ToolType.AXE,
  drops: [{ itemName: 'melon_slice', count: 3, min: 3, max: 7 }] });

R.register({ id: BlockID.CACTUS, name: 'cactus',
  material: Material.CACTUS,
  texture: BlockTexture.topSideBottom(T.CACTUS_TOP, T.CACTUS_SIDE, T.CACTUS_BOTTOM),
  solid: false, collidable: true, transparent: true, opacity: 0,
  hardness: 0.4 });

R.register({ id: BlockID.MOB_SPAWNER, name: 'mob_spawner',
  material: Material.METAL,
  texture: BlockTexture.uniform(T.STONE_BRICK),
  transparent: true, opacity: 0,
  hardness: 5.0, requiresTool: true, toolType: ToolType.PICKAXE, drops: 'nothing',
  hasBlockEntity: true });

R.register({ id: BlockID.NOTEBLOCK, name: 'note_block',
  material: Material.WOOD,
  texture: BlockTexture.uniform(T.NOTEBLOCK),
  hardness: 0.8, toolType: ToolType.AXE, hasBlockEntity: true });

R.register({ id: BlockID.JUKEBOX, name: 'jukebox',
  material: Material.WOOD,
  texture: BlockTexture.topSideBottom(T.JUKEBOX_TOP, T.JUKEBOX_SIDE, T.JUKEBOX_SIDE),
  hardness: 2.0, toolType: ToolType.AXE, hasBlockEntity: true });

R.register({ id: BlockID.MONSTER_EGG, name: 'infested_stone',
  material: Material.ROCK,
  texture: BlockTexture.uniform(T.STONE),
  hardness: 0.75 });

R.register({ id: BlockID.SNOW_LAYER, name: 'snow_layer',
  material: Material.SNOW,
  texture: BlockTexture.uniform(T.SNOW),
  renderType: RenderType.SNOW,
  solid: false, collidable: true, transparent: true, opacity: 0,
  hardness: 0.1, toolType: ToolType.SHOVEL, hasMetadata: true });
