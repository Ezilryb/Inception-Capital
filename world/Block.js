/**
 * ============================================================
 *  Block.js — Minecraft 1.0 Recreation
 * ============================================================
 */
'use strict';

export const RenderType = Object.freeze({
  NONE:    'none',
  CUBE:    'cube',
  CROSS:   'cross',
  FLAT:    'flat',
  LIQUID:  'liquid',
  SLAB:    'slab',
  STAIRS:  'stairs',
  DOOR:    'door',
  FENCE:   'fence',
  PANE:    'pane',
  TORCH:   'torch',
  CROP:    'crop',
  SNOW:    'snow',
  CUSTOM:  'custom',
});

export const Material = Object.freeze({
  AIR: 'air', ROCK: 'rock', DIRT: 'dirt', WOOD: 'wood',
  PLANT: 'plant', LEAVES: 'leaves', SAND: 'sand', GLASS: 'glass',
  CLOTH: 'cloth', FIRE: 'fire', METAL: 'metal', SNOW: 'snow',
  ICE: 'ice', WATER: 'water', LAVA: 'lava', CACTUS: 'cactus',
  CLAY: 'clay', GOURD: 'gourd', CAKE: 'cake', WEB: 'web',
  PISTON: 'piston', PORTAL: 'portal',
});

export const ToolType  = Object.freeze({ PICKAXE:'pickaxe', AXE:'axe', SHOVEL:'shovel', SHEARS:'shears', SWORD:'sword' });
export const ToolLevel = Object.freeze({ HAND:0, WOOD:1, STONE:2, IRON:3, DIAMOND:4 });

export class BlockTexture {
  constructor(all = 0, opts = {}) {
    const side    = opts.side    ?? all;
    this.top      = opts.top     ?? all;
    this.bottom   = opts.bottom  ?? all;
    this.north    = opts.north   ?? side;
    this.south    = opts.south   ?? side;
    this.east     = opts.east    ?? side;
    this.west     = opts.west    ?? side;
  }
  static uniform(index) { return new BlockTexture(index); }
  static topSideBottom(top, side, bottom) { return new BlockTexture(side, { top, bottom }); }
  static capSide(cap, side)               { return new BlockTexture(side, { top: cap, bottom: cap }); }
  static faces({ top, bottom, north, south, east, west }) {
    return new BlockTexture(0, { top, bottom, north, south, east, west });
  }
}

export class Block {
  constructor(config) {
    this.id          = config.id;
    this.name        = config.name;
    this.displayName = config.displayName ?? config.name;
    this.category    = config.category    ?? 'misc';
    this.material    = config.material    ?? Material.ROCK;
    this.texture     = config.texture     ?? null;
    this.renderType  = config.renderType  ?? RenderType.CUBE;
    this.tintType    = config.tintType    ?? null;
    this.solid       = config.solid       ?? true;
    this.collidable  = config.collidable  ?? (config.solid ?? true);
    this.gravity     = config.gravity     ?? false;
    this.liquid      = config.liquid      ?? false;
    this.replaceable = config.replaceable ?? false;
    this.transparent = config.transparent ?? false;
    this.luminosity  = config.luminosity  ?? 0;
    this.opacity     = config.opacity     ?? (this.transparent ? 0 : this.solid ? 15 : 0);
    this.hardness    = config.hardness    ?? 1.5;
    this.blastResistance = config.blastResistance ?? (this.hardness >= 0 ? Math.max(this.hardness * 5, 10) : 18_000_000);
    this.toolType    = config.toolType    ?? null;
    this.toolLevel   = config.toolLevel   ?? ToolLevel.HAND;
    this.requiresTool= config.requiresTool ?? false;
    this.drops       = config.drops       ?? 'self';
    this.flammable      = config.flammable      ?? false;
    this.hasBlockEntity = config.hasBlockEntity ?? false;
    this.hasMetadata    = config.hasMetadata    ?? false;
    this.metaNames      = config.metaNames      ?? null;
  }
  get isAir()         { return this.id === 0; }
  get isPassable()    { return !this.collidable; }
  get isOpaque()      { return !this.transparent && this.opacity >= 15; }
  get isUnbreakable() { return this.hardness < 0; }
  toString() { return `Block[${this.id}:"${this.name}"]`; }
}
