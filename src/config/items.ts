import { deepFreeze } from './deepFreeze';

/**
 * Placeable items (DESIGN.md 6.5, 12). Phase 1 only needs the yard lures, because the rarity
 * and species rolls read them. Furniture, beds, bowls, and outfits join this file later.
 */
export interface LureItemDef {
  readonly id: string;
  readonly name: string;
  readonly category: 'lure';
  readonly cost: number;
  /** Added to the yard's Lure Score while placed in the yard. */
  readonly lure: number;
  /** Species ids this lure attracts within their rarity tier. Empty = general. */
  readonly affinity: readonly string[];
  readonly assetKey: string;
}

export type ItemDef = LureItemDef;

const lure = (
  id: string,
  name: string,
  cost: number,
  lureValue: number,
  affinity: readonly string[],
): LureItemDef => ({
  id,
  name,
  category: 'lure',
  cost,
  lure: lureValue,
  affinity,
  assetKey: `item.${id}`,
});

// prettier-ignore
export const ITEMS: readonly ItemDef[] = deepFreeze([
  lure('carrot_patch',     'Carrot Patch',     80,   4,  ['bunny', 'piglet']),
  lure('bird_bath',        'Bird Bath',        100,  4,  ['chick', 'duckling', 'owl']),
  lure('toy_basket',       'Toy Basket',       120,  5,  ['puppy', 'kitten']),
  lure('flower_garden',    'Flower Garden',    150,  6,  []),
  lure('little_pond',      'Little Pond',      300,  8,  ['otter', 'duckling', 'penguin', 'axolotl']),
  lure('bamboo_grove',     'Bamboo Grove',     400,  8,  ['red_panda']),
  lure('eucalyptus_tree',  'Eucalyptus Tree',  600,  10, ['koala']),
  lure('warm_rock',        'Warm Rock',        900,  12, ['baby_dragon']),
  lure('rainbow_fountain', 'Rainbow Fountain', 1500, 15, ['unicorn']),
  lure('moon_lantern',     'Moon Lantern',     1500, 15, ['moon_bunny']),
]);

export function getItem(id: string): ItemDef | undefined {
  return ITEMS.find((i) => i.id === id);
}
