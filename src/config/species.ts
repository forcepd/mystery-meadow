import type { Rarity } from '../sim/types';
import { deepFreeze } from './deepFreeze';

/**
 * Species roster (DESIGN.md 7.1). Adding a species = adding an entry here plus art.
 * Phase 0 stub: ids, names, rarity, color variants, and asset keys. `placeholderColor`
 * is only for the simple shape art used before the Phase 10 art pass.
 */
export interface SpeciesVariant {
  readonly id: string;
  readonly name: string;
  readonly placeholderColor: string;
}

export interface SpeciesDef {
  readonly id: string;
  readonly name: string;
  readonly rarity: Rarity;
  readonly assetKey: string;
  readonly variants: readonly SpeciesVariant[];
}

const v = (id: string, name: string, placeholderColor: string): SpeciesVariant => ({
  id,
  name,
  placeholderColor,
});

// prettier-ignore
export const SPECIES: readonly SpeciesDef[] = deepFreeze([
  // Common
  { id: 'bunny', name: 'Bunny', rarity: 'common', assetKey: 'species.bunny',
    variants: [v('white', 'Snow', '#f7f4ef'), v('brown', 'Cocoa', '#a57a5a'), v('gray', 'Pebble', '#a9a9b3'), v('spotted', 'Patches', '#d9c2a6')] },
  { id: 'kitten', name: 'Kitten', rarity: 'common', assetKey: 'species.kitten',
    variants: [v('orange', 'Ginger', '#f0a35e'), v('black', 'Shadow', '#3d3a40'), v('gray', 'Misty', '#9fa3ad'), v('calico', 'Calico', '#e8c9a0'), v('white', 'Cotton', '#fbf8f3')] },
  { id: 'puppy', name: 'Puppy', rarity: 'common', assetKey: 'species.puppy',
    variants: [v('golden', 'Golden', '#e8b865'), v('brown', 'Mocha', '#8b5e3c'), v('spotted', 'Dotty', '#efe6da'), v('black', 'Midnight', '#403833')] },
  { id: 'hamster', name: 'Hamster', rarity: 'common', assetKey: 'species.hamster',
    variants: [v('golden', 'Honey', '#e9b872'), v('white', 'Marshmallow', '#faf5ee'), v('gray', 'Smoky', '#a4a0a0')] },
  { id: 'duckling', name: 'Duckling', rarity: 'common', assetKey: 'species.duckling',
    variants: [v('yellow', 'Sunny', '#ffe066'), v('brown', 'Mallard', '#b58b52'), v('white', 'Puff', '#fffaf0')] },
  { id: 'chick', name: 'Chick', rarity: 'common', assetKey: 'species.chick',
    variants: [v('yellow', 'Lemon', '#fff07a'), v('peach', 'Peachy', '#ffcf9e'), v('brown', 'Speckle', '#c49a6c')] },
  // Uncommon
  { id: 'hedgehog', name: 'Hedgehog', rarity: 'uncommon', assetKey: 'species.hedgehog',
    variants: [v('brown', 'Chestnut', '#8a6a4f'), v('cream', 'Cream', '#e6d3b3'), v('dark', 'Acorn', '#5c4636')] },
  { id: 'fox', name: 'Fox', rarity: 'uncommon', assetKey: 'species.fox',
    variants: [v('red', 'Ember', '#e0703a'), v('silver', 'Silver', '#b8bcc6'), v('arctic', 'Frost', '#f4f7fb')] },
  { id: 'raccoon', name: 'Raccoon', rarity: 'uncommon', assetKey: 'species.raccoon',
    variants: [v('gray', 'Bandit', '#8e8e96'), v('brown', 'Hazel', '#8f7560'), v('light', 'Ash', '#c4c2c0')] },
  { id: 'piglet', name: 'Piglet', rarity: 'uncommon', assetKey: 'species.piglet',
    variants: [v('pink', 'Rosie', '#f7b3c2'), v('spotted', 'Domino', '#f2d6d6'), v('brown', 'Truffle', '#a0705a')] },
  { id: 'lamb', name: 'Lamb', rarity: 'uncommon', assetKey: 'species.lamb',
    variants: [v('white', 'Cloud', '#fbfaf5'), v('cream', 'Biscuit', '#efdfc2'), v('black', 'Licorice', '#3f3b3d')] },
  // Rare
  { id: 'red_panda', name: 'Red Panda', rarity: 'rare', assetKey: 'species.red_panda',
    variants: [v('red', 'Maple', '#c9542e'), v('amber', 'Amber', '#d98a3d'), v('dark', 'Cinnamon', '#8c3b22')] },
  { id: 'otter', name: 'Otter', rarity: 'rare', assetKey: 'species.otter',
    variants: [v('brown', 'River', '#7a5a41'), v('light', 'Sandy', '#b89a7a'), v('dark', 'Pebble', '#4d3a2c')] },
  { id: 'penguin', name: 'Penguin', rarity: 'rare', assetKey: 'species.penguin',
    variants: [v('classic', 'Tuxedo', '#2f3440'), v('blue', 'Little Blue', '#5d7fa8'), v('fluffy', 'Fluffball', '#9a9aa0')] },
  { id: 'owl', name: 'Owl', rarity: 'rare', assetKey: 'species.owl',
    variants: [v('brown', 'Hoot', '#8b6b4a'), v('snowy', 'Snowy', '#f3f3ee'), v('barn', 'Barnaby', '#d9b98c')] },
  // Epic
  { id: 'koala', name: 'Koala', rarity: 'epic', assetKey: 'species.koala',
    variants: [v('gray', 'Eucy', '#9aa0a6'), v('light', 'Silverleaf', '#c9ccd1'), v('brown', 'Gumnut', '#8d7b6b')] },
  { id: 'fennec_fox', name: 'Fennec Fox', rarity: 'epic', assetKey: 'species.fennec_fox',
    variants: [v('sand', 'Dune', '#e8c99b'), v('cream', 'Vanilla', '#f5e6c8'), v('ginger', 'Sunset', '#e3a063')] },
  { id: 'axolotl', name: 'Axolotl', rarity: 'epic', assetKey: 'species.axolotl',
    variants: [v('pink', 'Bubblegum', '#f7a8c4'), v('gold', 'Goldie', '#f5d76e'), v('blue', 'Lagoon', '#8fb8e8'), v('white', 'Pearl', '#faf2f5')] },
  // Legendary
  { id: 'unicorn', name: 'Unicorn', rarity: 'legendary', assetKey: 'species.unicorn',
    variants: [v('white', 'Starlight', '#fdfbff'), v('pink', 'Candyfloss', '#f9c6e0'), v('lilac', 'Lilac', '#d6c2f2')] },
  { id: 'baby_dragon', name: 'Baby Dragon', rarity: 'legendary', assetKey: 'species.baby_dragon',
    variants: [v('green', 'Moss', '#7cc47a'), v('red', 'Blaze', '#e2604a'), v('purple', 'Amethyst', '#9b6fd1')] },
  { id: 'moon_bunny', name: 'Moon Bunny', rarity: 'legendary', assetKey: 'species.moon_bunny',
    variants: [v('silver', 'Moonbeam', '#dfe3f2'), v('night', 'Nightsky', '#4a4f8a'), v('gold', 'Harvest Moon', '#f0d77a')] },
]);

export function getSpecies(id: string): SpeciesDef | undefined {
  return SPECIES.find((s) => s.id === id);
}
