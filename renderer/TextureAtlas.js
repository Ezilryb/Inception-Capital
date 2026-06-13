/**
 * ============================================================
 *  TextureAtlas.js — Minecraft 1.0 Recreation
 * ============================================================
 *  Génère un atlas de texture procédural (256×256, 16×16 tuiles)
 *  pour le test sans fichier PNG externe.
 *
 *  Chaque tuile est dessinée sur un OffscreenCanvas puis l'atlas
 *  complet est converti en THREE.Texture.
 *
 *  Pour la prod : remplacer par le chargement de terrain.png.
 * ============================================================
 */
'use strict';
// PATCHED v2

import * as THREE from 'three';

const ATLAS_SIZE  = 256;
const TILE_SIZE   = 16;
const TILES_PER_ROW = 16;

// Palette de couleurs simplifiée par index de tuile
// Format : [r, g, b] couleur principale, [r2,g2,b2] couleur secondaire, pattern
const TILE_DEFS = {
   0: { name: 'grass_top',       base: [120,180, 60], alt: [ 90,140, 40], pat: 'noise'  },
   1: { name: 'stone',           base: [120,120,120], alt: [100,100,100], pat: 'noise'  },
   2: { name: 'dirt',            base: [134, 96, 67], alt: [110, 78, 50], pat: 'noise'  },
   3: { name: 'grass_side',      base: [134, 96, 67], alt: [120,180, 60], pat: 'grass_side' },
   4: { name: 'planks',          base: [175,143, 90], alt: [155,120, 70], pat: 'planks' },
   5: { name: 'slab_side',       base: [175,143, 90], alt: [155,120, 70], pat: 'planks' },
   6: { name: 'slab_top',        base: [175,143, 90], alt: [155,120, 70], pat: 'planks' },
   7: { name: 'bricks',          base: [158, 97, 80], alt: [100, 90, 85], pat: 'bricks' },
   8: { name: 'tnt_side',        base: [180, 40, 40], alt: [220,200, 60], pat: 'solid'  },
   9: { name: 'tnt_top',         base: [220,200, 60], alt: [180, 40, 40], pat: 'solid'  },
  10: { name: 'tnt_bottom',      base: [220,200, 60], alt: [180, 40, 40], pat: 'solid'  },
  11: { name: 'cobweb',          base: [210,210,210], alt: [255,255,255], pat: 'cross'  },
  12: { name: 'red_flower',      base: [220, 50, 50], alt: [ 60,160, 40], pat: 'cross'  },
  13: { name: 'yellow_flower',   base: [230,200, 30], alt: [ 60,160, 40], pat: 'cross'  },
  15: { name: 'sapling',         base: [ 60,140, 40], alt: [ 90,160, 55], pat: 'cross'  },
  16: { name: 'cobblestone',     base: [110,110,110], alt: [ 80, 80, 80], pat: 'cobble' },
  17: { name: 'bedrock',         base: [ 50, 50, 55], alt: [ 30, 30, 35], pat: 'noise'  },
  18: { name: 'sand',            base: [220,210,150], alt: [200,190,130], pat: 'noise'  },
  19: { name: 'gravel',          base: [140,130,120], alt: [110,105,100], pat: 'cobble' },
  20: { name: 'log_side',        base: [120, 90, 55], alt: [ 80, 60, 35], pat: 'log'   },
  21: { name: 'log_top',         base: [140,110, 65], alt: [100, 75, 45], pat: 'rings' },
  22: { name: 'iron_block',      base: [200,200,200], alt: [230,230,230], pat: 'metal' },
  23: { name: 'gold_block',      base: [240,195, 50], alt: [220,170, 30], pat: 'metal' },
  24: { name: 'diamond_block',   base: [ 80,210,215], alt: [ 50,180,185], pat: 'metal' },
  25: { name: 'chest_top',       base: [170,130, 75], alt: [130, 95, 50], pat: 'planks'},
  26: { name: 'chest_front',     base: [170,130, 75], alt: [ 70, 50, 30], pat: 'chest' },
  27: { name: 'chest_side',      base: [170,130, 75], alt: [130, 95, 50], pat: 'planks'},
  28: { name: 'red_mushroom',    base: [200, 50, 50], alt: [255,220,220], pat: 'shroom'},
  29: { name: 'brown_mushroom',  base: [140, 90, 55], alt: [220,200,170], pat: 'shroom'},
  31: { name: 'fire',            base: [255,140, 20], alt: [255,220,  0], pat: 'noise'  },
  32: { name: 'gold_ore',        base: [120,120,120], alt: [220,180, 50], pat: 'ore'   },
  33: { name: 'iron_ore',        base: [120,120,120], alt: [195,160,130], pat: 'ore'   },
  34: { name: 'coal_ore',        base: [120,120,120], alt: [ 30, 30, 30], pat: 'ore'   },
  35: { name: 'bookshelf',       base: [175,143, 90], alt: [110, 75, 35], pat: 'shelf' },
  36: { name: 'mossy_cobble',    base: [100,120, 90], alt: [ 70, 90, 65], pat: 'cobble'},
  37: { name: 'obsidian',        base: [ 18, 12, 25], alt: [ 35, 20, 45], pat: 'noise' },
  39: { name: 'tall_grass',      base: [ 80,160, 50], alt: [ 60,140, 35], pat: 'cross' },
  43: { name: 'crafting_top',    base: [175,143, 90], alt: [ 60, 40, 20], pat: 'craft' },
  44: { name: 'crafting_side',   base: [175,143, 90], alt: [ 60, 40, 20], pat: 'planks'},
  45: { name: 'furnace_side',    base: [120,120,120], alt: [ 80, 80, 80], pat: 'noise' },
  46: { name: 'furnace_front_off', base:[120,120,120],alt: [ 60, 45, 30], pat: 'furnace'},
  48: { name: 'sponge',          base: [185,180, 70], alt: [210,205, 90], pat: 'noise' },
  49: { name: 'glass',           base: [190,220,240], alt: [255,255,255], pat: 'glass' },
  50: { name: 'diamond_ore',     base: [120,120,120], alt: [ 70,210,215], pat: 'ore'   },
  51: { name: 'redstone_ore',    base: [120,120,120], alt: [180, 30, 30], pat: 'ore'   },
  52: { name: 'leaves',          base: [ 50,110, 35], alt: [ 35, 85, 25], pat: 'leaves'},
  54: { name: 'stone_brick',     base: [130,130,130], alt: [ 90, 90, 90], pat: 'sbrick'},
  55: { name: 'dead_bush',       base: [130, 95, 55], alt: [110, 75, 40], pat: 'cross' },
  62: { name: 'furnace_top',     base: [120,120,120], alt: [ 80, 80, 80], pat: 'noise' },
  64: { name: 'wool_white',      base: [220,220,220], alt: [200,200,200], pat: 'noise' },
  66: { name: 'snow',            base: [230,235,240], alt: [200,210,220], pat: 'noise' },
  67: { name: 'ice',             base: [150,180,220], alt: [120,160,210], pat: 'ice'   },
  68: { name: 'snow_side',       base: [134, 96, 67], alt: [230,235,240], pat: 'snow_side'},
  69: { name: 'cactus_top',      base: [ 70,130, 50], alt: [ 55,110, 40], pat: 'noise' },
  70: { name: 'cactus_side',     base: [ 65,120, 45], alt: [ 40, 90, 30], pat: 'cactus'},
  71: { name: 'cactus_bottom',   base: [ 70,130, 50], alt: [ 55,110, 40], pat: 'noise' },
  72: { name: 'clay',            base: [155,160,170], alt: [130,135,145], pat: 'noise' },
  73: { name: 'sugar_cane',      base: [ 90,175, 65], alt: [ 65,145, 45], pat: 'cross' },
  74: { name: 'noteblock_side',  base: [175,143, 90], alt: [ 60, 40, 20], pat: 'planks'},
  75: { name: 'jukebox_top',     base: [ 90, 60, 40], alt: [ 60, 40, 20], pat: 'noise' },
  78: { name: 'mycelium_top',    base: [110,100,110], alt: [140,120,140], pat: 'noise' },
  79: { name: 'mycelium_side',   base: [134, 96, 67], alt: [110,100,110], pat: 'dirt_top'},
  80: { name: 'torch',           base: [180,140, 40], alt: [220,180, 50], pat: 'torch' },
  83: { name: 'ladder',          base: [175,143, 90], alt: [120, 85, 45], pat: 'ladder'},
  84: { name: 'trapdoor',        base: [130,100, 60], alt: [ 90, 65, 35], pat: 'planks'},
  85: { name: 'iron_bars',       base: [160,160,160], alt: [200,200,200], pat: 'bars'  },
  86: { name: 'farmland_dry',    base: [145, 95, 60], alt: [120, 75, 45], pat: 'noise' },
  87: { name: 'farmland_wet',    base: [ 90, 65, 40], alt: [110, 80, 50], pat: 'noise' },
  96: { name: 'lever',           base: [110,110,110], alt: [175,143, 90], pat: 'noise' },
  99: { name: 'redstone_torch_on', base:[200,30,30],  alt: [255,180,  0], pat: 'torch' },
  102: { name: 'pumpkin_top',    base: [175,140, 35], alt: [140,110, 25], pat: 'noise' },
  103: { name: 'netherrack',     base: [100, 40, 40], alt: [ 80, 30, 30], pat: 'noise' },
  104: { name: 'soul_sand',      base: [ 70, 55, 40], alt: [ 50, 40, 28], pat: 'noise' },
  105: { name: 'glowstone',      base: [215,180, 90], alt: [235,200,110], pat: 'glowstone'},
  112: { name: 'rail_curve',     base: [100, 80, 55], alt: [180,150, 80], pat: 'solid' },
  115: { name: 'redstone_torch_off',base:[80,20,20],  alt: [120, 80, 40], pat: 'torch' },
  118: { name: 'enchant_side',   base: [ 20, 20, 60], alt: [ 80, 60,180], pat: 'magic' },
  119: { name: 'enchant_top',    base: [ 15, 15, 45], alt: [100, 80,200], pat: 'magic' },
  128: { name: 'rail',           base: [100, 80, 55], alt: [180,150, 80], pat: 'rail'  },
  136: { name: 'melon_top',      base: [140,170, 40], alt: [110,140, 30], pat: 'noise' },
  137: { name: 'melon_side',     base: [100,140, 40], alt: [140,170, 40], pat: 'melon' },
  140: { name: 'lily_pad',       base: [ 35,120, 40], alt: [ 25, 95, 30], pat: 'leaves'},
  143: { name: 'vine',           base: [ 55,130, 40], alt: [ 40,105, 30], pat: 'cross' },
  144: { name: 'lapis_block',    base: [ 30, 65,150], alt: [ 20, 50,120], pat: 'metal' },
  159: { name: 'end_frame_top',  base: [ 50, 90, 60], alt: [ 30, 65, 45], pat: 'noise' },
  160: { name: 'lapis_ore',      base: [120,120,120], alt: [ 30, 65,150], pat: 'ore'   },
  163: { name: 'powered_rail',   base: [100, 80, 55], alt: [210,170, 40], pat: 'rail'  },
  175: { name: 'end_stone',      base: [205,200,155], alt: [185,180,130], pat: 'noise' },
  176: { name: 'sandstone_top',  base: [220,210,150], alt: [200,190,130], pat: 'noise' },
  192: { name: 'sandstone_side', base: [220,210,150], alt: [160,150, 80], pat: 'sandstone'},
  195: { name: 'detector_rail',  base: [100, 80, 55], alt: [180, 60, 60], pat: 'rail'  },
  205: { name: 'water_still',    base: [ 30, 80,200], alt: [ 20, 60,170], pat: 'water' },
  206: { name: 'water_flow',     base: [ 30, 80,200], alt: [ 20, 60,170], pat: 'water' },
  208: { name: 'sandstone_bot',  base: [220,210,150], alt: [200,190,130], pat: 'noise' },
  214: { name: 'dragon_egg',     base: [ 15, 10, 20], alt: [ 40, 30, 60], pat: 'noise' },
  224: { name: 'nether_brick',   base: [ 45, 20, 20], alt: [ 30, 12, 12], pat: 'bricks'},
  237: { name: 'lava_still',     base: [200, 70, 10], alt: [240,110, 10], pat: 'lava'  },
  238: { name: 'lava_flow',      base: [200, 70, 10], alt: [240,110, 10], pat: 'lava'  },
};

function seededRandom(seed) {
  let s = seed;
  return () => { s = (s * 1664525 + 1013904223) >>> 0; return s / 0xFFFFFFFF; };
}

function drawTile(ctx, tileX, tileY, def) {
  const x0 = tileX * TILE_SIZE;
  const y0 = tileY * TILE_SIZE;
  const rng = seededRandom(tileX * 256 + tileY);
  const [r,g,b]     = def.base;
  const [r2,g2,b2]  = def.alt;

  const fillBase = () => { ctx.fillStyle = `rgb(${r},${g},${b})`; ctx.fillRect(x0,y0,TILE_SIZE,TILE_SIZE); };

  switch (def.pat) {
    case 'solid':
      fillBase();
      break;

    case 'noise':
      fillBase();
      for (let py = 0; py < TILE_SIZE; py++) {
        for (let px = 0; px < TILE_SIZE; px++) {
          if (rng() < 0.3) {
            const v = (rng() * 30 - 15) | 0;
            ctx.fillStyle = `rgb(${r+v},${g+v},${b+v})`;
            ctx.fillRect(x0+px, y0+py, 1, 1);
          }
        }
      }
      break;

    case 'planks': {
      fillBase();
      ctx.fillStyle = `rgb(${r2},${g2},${b2})`;
      // Lignes horizontales de planches
      for (let py = 0; py < TILE_SIZE; py += 4) {
        ctx.fillRect(x0, y0+py, TILE_SIZE, 1);
      }
      // Jointures verticales alternées
      for (let py = 0; py < TILE_SIZE; py += 4) {
        const offset = (py / 4 % 2 === 0) ? 8 : 0;
        ctx.fillRect(x0+offset, y0+py, 1, 4);
      }
      break;
    }

    case 'bricks': {
      fillBase();
      ctx.fillStyle = `rgb(${r2},${g2},${b2})`;
      for (let py = 0; py < TILE_SIZE; py += 4) {
        ctx.fillRect(x0, y0+py, TILE_SIZE, 1);
        const off = (py / 4 % 2 === 0) ? 8 : 4;
        for (let px = off; px < TILE_SIZE; px += 8) {
          ctx.fillRect(x0+px, y0+py, 1, 4);
        }
      }
      break;
    }

    case 'cobble': {
      ctx.fillStyle = `rgb(${r},${g},${b})`;
      ctx.fillRect(x0,y0,TILE_SIZE,TILE_SIZE);
      for (let i = 0; i < 12; i++) {
        const cx2 = (rng() * TILE_SIZE) | 0;
        const cy  = (rng() * TILE_SIZE) | 0;
        const w   = 2 + (rng() * 5) | 0;
        const h   = 2 + (rng() * 5) | 0;
        const v   = (rng() * 40 - 20) | 0;
        ctx.fillStyle = `rgb(${r+v},${g+v},${b+v})`;
        ctx.fillRect(x0+cx2, y0+cy, w, h);
      }
      ctx.fillStyle = `rgb(${r2},${g2},${b2})`;
      for (let i = 0; i < 20; i++) {
        const cx2 = (rng() * TILE_SIZE) | 0;
        const cy  = (rng() * TILE_SIZE) | 0;
        ctx.fillRect(x0+cx2, y0+cy, 1+(rng()*3|0), 1);
      }
      break;
    }

    case 'ore': {
      // Base stone + taches de minerai
      ctx.fillStyle = `rgb(120,120,120)`;
      ctx.fillRect(x0,y0,TILE_SIZE,TILE_SIZE);
      for (let py=0;py<TILE_SIZE;py++) {
        for (let px=0;px<TILE_SIZE;px++) {
          if (rng() < 0.12) {
            const v = (rng()*20-10)|0;
            ctx.fillStyle = `rgb(${110+v},${110+v},${110+v})`;
            ctx.fillRect(x0+px,y0+py,1,1);
          }
        }
      }
      for (let i = 0; i < 6; i++) {
        const cx2 = 2 + (rng() * (TILE_SIZE-4)) | 0;
        const cy  = 2 + (rng() * (TILE_SIZE-4)) | 0;
        const v   = (rng() * 20 - 10) | 0;
        ctx.fillStyle = `rgb(${r2+v},${g2+v},${b2+v})`;
        ctx.beginPath();
        ctx.arc(x0+cx2, y0+cy, 1.5+rng()*1.5, 0, Math.PI*2);
        ctx.fill();
      }
      break;
    }

    case 'log': {
      fillBase();
      for (let py = 0; py < TILE_SIZE; py++) {
        const v = (Math.sin(py/2)*8)|0;
        ctx.fillStyle = `rgb(${r+v},${g+v},${b+v})`;
        ctx.fillRect(x0, y0+py, TILE_SIZE, 1);
      }
      // Nœud de bois
      ctx.fillStyle = `rgb(${r2},${g2},${b2})`;
      ctx.fillRect(x0+6, y0+6, 4, 4);
      break;
    }

    case 'rings': {
      fillBase();
      ctx.fillStyle = `rgb(${r2},${g2},${b2})`;
      ctx.beginPath();
      ctx.arc(x0+8, y0+8, 5, 0, Math.PI*2);
      ctx.arc(x0+8, y0+8, 2, 0, Math.PI*2);
      ctx.stroke();
      break;
    }

    case 'leaves': {
      for (let py=0;py<TILE_SIZE;py++) {
        for (let px=0;px<TILE_SIZE;px++) {
          const v = (rng()*40-20)|0;
          const on = rng() > 0.1;
          if (on) { ctx.fillStyle=`rgb(${r+v},${g+v},${b+v})`; ctx.fillRect(x0+px,y0+py,1,1); }
          else    { ctx.clearRect(x0+px,y0+py,1,1); }
        }
      }
      break;
    }

    case 'glass': {
      ctx.clearRect(x0,y0,TILE_SIZE,TILE_SIZE);
      ctx.fillStyle = `rgba(${r},${g},${b},0.3)`;
      ctx.fillRect(x0,y0,TILE_SIZE,TILE_SIZE);
      ctx.fillStyle = `rgb(${r2},${g2},${b2})`;
      ctx.fillRect(x0,y0,TILE_SIZE,1); ctx.fillRect(x0,y0+TILE_SIZE-1,TILE_SIZE,1);
      ctx.fillRect(x0,y0,1,TILE_SIZE); ctx.fillRect(x0+TILE_SIZE-1,y0,1,TILE_SIZE);
      break;
    }

    case 'water': {
      ctx.fillStyle = `rgba(${r},${g},${b},0.8)`;
      ctx.fillRect(x0,y0,TILE_SIZE,TILE_SIZE);
      ctx.fillStyle = `rgba(${r2},${g2},${b2},0.4)`;
      for (let py=0;py<TILE_SIZE;py+=3) {
        ctx.fillRect(x0, y0+py, TILE_SIZE, 1);
      }
      break;
    }

    case 'lava': {
      fillBase();
      for (let i=0;i<10;i++) {
        const cx2=(rng()*TILE_SIZE)|0, cy=(rng()*TILE_SIZE)|0;
        ctx.fillStyle=`rgb(${r2},${g2},${b2})`;
        ctx.fillRect(x0+cx2,y0+cy,2+(rng()*4|0),2+(rng()*4|0));
      }
      break;
    }

    case 'cross': {
      ctx.clearRect(x0,y0,TILE_SIZE,TILE_SIZE);
      const cx2 = x0 + TILE_SIZE/2;
      const cy2 = y0 + TILE_SIZE/2;
      ctx.fillStyle = `rgb(${r},${g},${b})`;
      for (let i=-5;i<=5;i++) {
        ctx.fillStyle=`rgb(${r+(rng()*20-10|0)},${g+(rng()*20-10|0)},${b+(rng()*10-5|0)})`;
        ctx.fillRect(cx2-1+i*0.3, cy2-6+i, 2, 2);
        ctx.fillRect(cx2-1-i*0.3, cy2-6+i, 2, 2);
      }
      break;
    }

    case 'metal': {
      fillBase();
      for (let py=0;py<TILE_SIZE;py+=4) {
        const v=(rng()*20-10)|0;
        ctx.fillStyle=`rgb(${r+v},${g+v},${b+v})`;
        ctx.fillRect(x0,y0+py,TILE_SIZE,2);
      }
      break;
    }

    case 'grass_side': {
      ctx.fillStyle = `rgb(${r},${g},${b})`;
      ctx.fillRect(x0, y0+3, TILE_SIZE, TILE_SIZE-3);
      ctx.fillStyle = `rgb(${r2},${g2},${b2})`;
      ctx.fillRect(x0, y0, TILE_SIZE, 3);
      for (let px=0;px<TILE_SIZE;px++) {
        const v=(rng()*10)|0;
        ctx.fillStyle = `rgb(${r2-v},${g2-v},${b2-v})`;
        ctx.fillRect(x0+px, y0+2+v%2, 1, 1+(v%2));
      }
      break;
    }

    case 'sbrick': {
      fillBase();
      ctx.fillStyle = `rgb(${r2},${g2},${b2})`;
      for (let py=0;py<TILE_SIZE;py+=8) {
        ctx.fillRect(x0,y0+py,TILE_SIZE,1);
        for (let px=0;px<TILE_SIZE;px+=8) {
          ctx.fillRect(x0+px,y0+py,1,8);
        }
      }
      break;
    }

    case 'glowstone': {
      for (let py=0;py<TILE_SIZE;py++) {
        for (let px=0;px<TILE_SIZE;px++) {
          const v=(rng()*40-20)|0;
          ctx.fillStyle=`rgb(${r+v},${g+v},${b+v})`;
          ctx.fillRect(x0+px,y0+py,1,1);
        }
      }
      // Spots lumineux
      for(let i=0;i<5;i++) {
        const cx2=(2+rng()*(TILE_SIZE-4))|0, cy=(2+rng()*(TILE_SIZE-4))|0;
        ctx.fillStyle=`rgb(255,240,150)`;
        ctx.fillRect(x0+cx2,y0+cy,2,2);
      }
      break;
    }

    case 'magic': {
      ctx.fillStyle=`rgb(${r},${g},${b})`;
      ctx.fillRect(x0,y0,TILE_SIZE,TILE_SIZE);
      for(let i=0;i<8;i++) {
        const px2=(rng()*TILE_SIZE)|0, py2=(rng()*TILE_SIZE)|0;
        ctx.fillStyle=`rgb(${r2},${g2},${b2})`;
        ctx.fillRect(x0+px2,y0+py2,1+(rng()*2|0),1+(rng()*2|0));
      }
      break;
    }

    case 'ice': {
      ctx.fillStyle=`rgb(${r},${g},${b})`;
      ctx.fillRect(x0,y0,TILE_SIZE,TILE_SIZE);
      ctx.fillStyle=`rgba(255,255,255,0.5)`;
      for(let i=0;i<3;i++) {
        const ax=(rng()*TILE_SIZE)|0, ay=(rng()*TILE_SIZE)|0;
        ctx.fillRect(x0+ax,y0+ay,rng()*8|0,1);
      }
      break;
    }

    case 'shroom': {
      ctx.clearRect(x0,y0,TILE_SIZE,TILE_SIZE);
      ctx.fillStyle=`rgb(${r},${g},${b})`;
      ctx.fillRect(x0,y0,TILE_SIZE,TILE_SIZE);
      ctx.fillStyle=`rgb(${r2},${g2},${b2})`;
      for(let i=0;i<5;i++) {
        const cx2=2+(rng()*10)|0, cy=2+(rng()*10)|0;
        ctx.fillRect(x0+cx2,y0+cy,2,2);
      }
      break;
    }

    case 'torch': {
      ctx.clearRect(x0,y0,TILE_SIZE,TILE_SIZE);
      ctx.fillStyle=`rgb(${r2},${g2},${b2})`;
      ctx.fillRect(x0+7,y0+0,2,4);
      ctx.fillStyle=`rgb(${r},${g},${b})`;
      ctx.fillRect(x0+6,y0+4,4,10);
      break;
    }

    case 'chest': {
      ctx.fillStyle=`rgb(${r},${g},${b})`;
      ctx.fillRect(x0,y0,TILE_SIZE,TILE_SIZE);
      ctx.fillStyle=`rgb(${r2},${g2},${b2})`;
      ctx.fillRect(x0,y0+7,TILE_SIZE,2);
      ctx.fillRect(x0+6,y0+4,4,5);
      break;
    }

    case 'craft': {
      ctx.fillStyle=`rgb(${r},${g},${b})`;
      ctx.fillRect(x0,y0,TILE_SIZE,TILE_SIZE);
      ctx.fillStyle=`rgb(${r2},${g2},${b2})`;
      for(let i=0;i<3;i++) for(let j=0;j<3;j++) {
        ctx.fillRect(x0+2+i*5,y0+2+j*5,4,4);
      }
      break;
    }

    case 'furnace': {
      ctx.fillStyle=`rgb(${r},${g},${b})`;
      ctx.fillRect(x0,y0,TILE_SIZE,TILE_SIZE);
      ctx.fillStyle=`rgb(${r2},${g2},${b2})`;
      ctx.fillRect(x0+4,y0+4,8,8);
      break;
    }

    case 'sandstone': {
      fillBase();
      ctx.fillStyle=`rgb(${r2},${g2},${b2})`;
      ctx.fillRect(x0,y0+5,TILE_SIZE,1);
      ctx.fillRect(x0,y0+10,TILE_SIZE,1);
      break;
    }

    case 'melon': {
      fillBase();
      ctx.fillStyle=`rgb(${r2},${g2},${b2})`;
      for(let px=0;px<TILE_SIZE;px+=3) ctx.fillRect(x0+px,y0,1,TILE_SIZE);
      break;
    }

    case 'cactus': {
      fillBase();
      ctx.fillStyle=`rgb(${r2},${g2},${b2})`;
      for(let py=0;py<TILE_SIZE;py+=3) ctx.fillRect(x0,y0+py,TILE_SIZE,1);
      break;
    }

    case 'shelf': {
      ctx.fillStyle=`rgb(${r},${g},${b})`;
      ctx.fillRect(x0,y0,TILE_SIZE,TILE_SIZE);
      ctx.fillStyle=`rgb(${r2},${g2},${b2})`;
      for(let i=0;i<3;i++) ctx.fillRect(x0+i*5+1,y0+2,3,12);
      ctx.fillStyle=`rgb(200,160,100)`;
      for(let i=0;i<3;i++) ctx.fillRect(x0+i*5+1,y0+4,3,3);
      break;
    }

    case 'snow_side': {
      ctx.fillStyle=`rgb(${r},${g},${b})`;
      ctx.fillRect(x0,y0+3,TILE_SIZE,TILE_SIZE-3);
      ctx.fillStyle=`rgb(${r2},${g2},${b2})`;
      ctx.fillRect(x0,y0,TILE_SIZE,3);
      break;
    }

    case 'dirt_top': {
      ctx.fillStyle=`rgb(${r},${g},${b})`;
      ctx.fillRect(x0,y0+3,TILE_SIZE,TILE_SIZE-3);
      ctx.fillStyle=`rgb(${r2},${g2},${b2})`;
      ctx.fillRect(x0,y0,TILE_SIZE,3);
      break;
    }

    case 'water':  case 'bars': case 'ladder': case 'rail': default: {
      fillBase();
      break;
    }
  }
}

// ─────────────────────────────────────────────────────────────
//  Export
// ─────────────────────────────────────────────────────────────
export class TextureAtlas {
  /**
   * Crée et retourne un THREE.Texture de l'atlas procédural.
   * @returns {THREE.Texture}
   */
  static createProceduralAtlas() {
    const canvas = document.createElement('canvas');
    canvas.width  = ATLAS_SIZE;
    canvas.height = ATLAS_SIZE;
    const ctx = canvas.getContext('2d');
    ctx.imageSmoothingEnabled = false;

    // Remplissage par défaut (rose = tuile manquante, comme MC)
    ctx.fillStyle = '#FF00FF';
    ctx.fillRect(0, 0, ATLAS_SIZE, ATLAS_SIZE);

    // Dessin de chaque tuile définie
    for (const [indexStr, def] of Object.entries(TILE_DEFS)) {
      const index = parseInt(indexStr, 10);
      const tileX = index % TILES_PER_ROW;
      const tileY = Math.floor(index / TILES_PER_ROW);
      drawTile(ctx, tileX, tileY, def);
    }

    const tex = new THREE.CanvasTexture(canvas);
    tex.magFilter = THREE.NearestFilter;
    tex.minFilter = THREE.NearestFilter;
    tex.generateMipmaps = false;
    tex.needsUpdate = true; // FIX: force upload GPU
    return tex;
  }
}
