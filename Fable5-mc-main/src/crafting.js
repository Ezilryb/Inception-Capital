// ============================================================
// Crafting system — shaped and shapeless recipes for a 3×3
// grid (workbench) and 2×2 grid (player inventory), matching
// Minecraft 1.0 recipes as closely as possible given the
// blocks available in the registry.
//
// Recipe format:
//   pattern : string[] — rows of the grid, using alias chars
//   key     : {char: blockId}
//   result  : {id, count}
//   shapeless: true — order/position doesn't matter
//
// We resolve the *smallest bounding box* of the placed items,
// then try every 3×3 offset inside that box.
// ============================================================

import { B } from './blocks.js';

// ------------------------------------------------------------------
// Shapeless helper — sort ingredient ids and compare
// ------------------------------------------------------------------
const sortedKey = (ids) => [...ids].sort((a, b) => a - b).join(',');

// ------------------------------------------------------------------
// Recipe table
// ------------------------------------------------------------------

// 3×3 workbench recipes
export const SHAPED_3 = [
  // --- Wood conversion ---
  { pattern: ['L'], key: { L: B.LOG },    result: { id: B.PLANKS, count: 4 } },
  { pattern: ['L'], key: { L: B.SPRUCE_LOG }, result: { id: B.PLANKS, count: 4 } },

  // --- Crafting table (from planks 2×2) ---
  {
    pattern: ['PP', 'PP'],
    key: { P: B.PLANKS },
    result: { id: B.BOOKSHELF, count: 1 }, // re-use as "workbench" visual placeholder
    _label: 'Crafting Table',
  },

  // --- Stone variants ---
  {
    pattern: ['CCC', 'C C', 'CCC'],
    key: { C: B.COBBLE },
    result: { id: B.STONEBRICK, count: 4 },
  },
  {
    pattern: ['SSS', 'SBS', 'SSS'],
    key: { S: B.STONE, B: B.COBBLE },
    result: { id: B.BRICKS, count: 4 }, // stone bricks from stone+cobble
  },

  // --- Bricks from stone ---
  {
    pattern: ['SS', 'SS'],
    key: { S: B.STONE },
    result: { id: B.STONEBRICK, count: 4 },
  },

  // --- Glass panes (4 glass → 4) ---
  {
    pattern: ['GGG', 'GGG'],
    key: { G: B.GLASS },
    result: { id: B.GLASS, count: 6 }, // net glass from glass (recycling)
  },

  // --- Sand → Glass ---
  {
    pattern: ['SSS'],
    key: { S: B.SAND },
    result: { id: B.GLASS, count: 3 },
  },

  // --- Sandstone ---
  {
    pattern: ['SS', 'SS'],
    key: { S: B.SAND },
    result: { id: B.SANDSTONE, count: 4 },
  },

  // --- TNT (sand + gunpowder; use redstone ore as "gunpowder" substitute) ---
  {
    pattern: ['SRS', 'RSR', 'SRS'],
    key: { S: B.SAND, R: B.REDSTONE_ORE },
    result: { id: B.TNT, count: 1 },
  },

  // --- Obsidian from stone + diamond (symbolic) ---
  {
    pattern: ['DDD', 'DSD', 'DDD'],
    key: { D: B.DIAMOND_ORE, S: B.STONE },
    result: { id: B.OBSIDIAN, count: 2 },
    _label: 'Obsidian',
  },

  // --- Bookshelf ---
  {
    pattern: ['PPP', 'CCC', 'PPP'],
    key: { P: B.PLANKS, C: B.COBBLE }, // cobble as "books" substitute
    result: { id: B.BOOKSHELF, count: 1 },
  },

  // --- Snow block ---
  {
    pattern: ['SS', 'SS'],
    key: { S: B.SNOW_BLOCK },
    result: { id: B.SNOW_BLOCK, count: 1 }, // compress 4 → 1 big block
  },

  // --- Ice from snow ---
  {
    pattern: ['SSS', 'SSS', 'SSS'],
    key: { S: B.SNOW_BLOCK },
    result: { id: B.ICE, count: 1 },
  },

  // --- Log → plank (single cell, any row/col) ---
  // Already covered above via the 1-cell pattern.
];

// 2×2 player inventory recipes (no workbench needed)
export const SHAPED_2 = [
  // Log → Planks (2×2 grid version)
  { pattern: ['L'], key: { L: B.LOG },       result: { id: B.PLANKS, count: 4 } },
  { pattern: ['L'], key: { L: B.SPRUCE_LOG },result: { id: B.PLANKS, count: 4 } },

  // 4 Planks → Crafting Table (visual: bookshelf)
  {
    pattern: ['PP', 'PP'],
    key: { P: B.PLANKS },
    result: { id: B.BOOKSHELF, count: 1 },
    _label: 'Crafting Table',
  },

  // Sand → Sandstone 2×2
  {
    pattern: ['SS', 'SS'],
    key: { S: B.SAND },
    result: { id: B.SANDSTONE, count: 4 },
  },

  // Snow block 2×2
  {
    pattern: ['SS', 'SS'],
    key: { S: B.SNOW_BLOCK },
    result: { id: B.SNOW_BLOCK, count: 1 },
  },
];

// ------------------------------------------------------------------
// Pattern → normalised ingredient matrix
// ------------------------------------------------------------------

/**
 * Returns a flat array (rows×cols) of block ids (0 = empty),
 * trimmed to the minimal bounding box.
 */
function parsePattern(pattern, key) {
  const rows = pattern.map((row) =>
    [...row].map((ch) => (ch === ' ' ? 0 : (key[ch] ?? 0))),
  );
  // trim empty leading/trailing rows
  let r0 = 0, r1 = rows.length - 1;
  while (r0 < r1 && rows[r0].every((v) => v === 0)) r0++;
  while (r1 > r0 && rows[r1].every((v) => v === 0)) r1--;
  const trimmed = rows.slice(r0, r1 + 1);
  // trim empty leading/trailing cols
  const cols = trimmed[0].length;
  let c0 = 0, c1 = cols - 1;
  while (c0 < c1 && trimmed.every((row) => row[c0] === 0)) c0++;
  while (c1 > c0 && trimmed.every((row) => row[c1] === 0)) c1++;
  return trimmed.map((row) => row.slice(c0, c1 + 1));
}

/**
 * Compile a recipe into a lookup-friendly object.
 * { matrix: number[][], w, h, result, label }
 */
function compile(recipe) {
  const matrix = parsePattern(recipe.pattern, recipe.key);
  return {
    matrix,
    h: matrix.length,
    w: matrix[0].length,
    result: recipe.result,
    label: recipe._label || null,
  };
}

const COMPILED_3 = SHAPED_3.map(compile);
const COMPILED_2 = SHAPED_2.map(compile);

// ------------------------------------------------------------------
// Main matching function
// ------------------------------------------------------------------

/**
 * Try to match the contents of a crafting grid against all recipes.
 *
 * @param {number[]} grid  — flat row-major array of block ids (0 = empty)
 * @param {number}   size  — 2 or 3 (grid side length)
 * @returns {{ id, count, label } | null}
 */
export function matchRecipe(grid, size) {
  const recipes = size === 2 ? COMPILED_2 : COMPILED_3;

  // Find bounding box of placed items in the grid
  let minR = size, maxR = -1, minC = size, maxC = -1;
  for (let r = 0; r < size; r++) {
    for (let c = 0; c < size; c++) {
      if (grid[r * size + c] !== 0) {
        if (r < minR) minR = r;
        if (r > maxR) maxR = r;
        if (c < minC) minC = c;
        if (c > maxC) maxC = c;
      }
    }
  }
  if (maxR < 0) return null; // empty grid

  const boxH = maxR - minR + 1;
  const boxW = maxC - minC + 1;

  // Extract the bounding box as a 2D array
  const box = [];
  for (let r = minR; r <= maxR; r++) {
    box.push([]);
    for (let c = minC; c <= maxC; c++) {
      box[box.length - 1].push(grid[r * size + c]);
    }
  }

  // Try each recipe
  for (const rec of recipes) {
    if (rec.h !== boxH || rec.w !== boxW) continue;
    let match = true;
    outer: for (let r = 0; r < boxH; r++) {
      for (let c = 0; c < boxW; c++) {
        if (box[r][c] !== rec.matrix[r][c]) { match = false; break outer; }
      }
    }
    if (match) {
      return {
        id: rec.result.id,
        count: rec.result.count,
        label: rec.label,
      };
    }
  }
  return null;
}

// ------------------------------------------------------------------
// Ingredient consumption helper
// ------------------------------------------------------------------

/**
 * Remove exactly one of each non-zero cell from the grid.
 * Returns a new grid array.
 */
export function consumeIngredients(grid) {
  return grid.map((id) => (id !== 0 ? 0 : 0)); // clear all slots
}

// ------------------------------------------------------------------
// Nice display name for a recipe result
// ------------------------------------------------------------------
export function recipeName(result) {
  if (!result) return '';
  const { BLOCKS } = window.__mc_blocks || {};
  const name = BLOCKS?.[result.id]?.name || `Block ${result.id}`;
  return result.count > 1 ? `${name} ×${result.count}` : name;
}
