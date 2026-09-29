import type { PetOutfitItemDef } from '../config/items';
import { OUTLINE, n, stroke, twinkle } from './svg';

/**
 * Pet outfit art (DESIGN 10.3) as SVG markup, drawn around an anchor at (0, 0) for a standard head
 * (radius 27). The animal builder moves and scales it onto each species' outfit anchors.
 */

/** Drawn behind the animal's body instead of on top. */
export function isBackOutfit(def: PetOutfitItemDef): boolean {
  return def.kind === 'cape';
}

/** Body outfits the head overlaps (the rest of the body slot sits on top, like a scarf). */
export function isUnderHeadOutfit(def: PetOutfitItemDef): boolean {
  return def.kind === 'sweater' || def.kind === 'tutu';
}

/**
 * The outfit's markup at the anchor. `eyeDx` is how far each eye is from the middle of the face
 * (in the same standard-head units), so glasses sit on the eyes.
 */
export function outfitFragment(def: PetOutfitItemDef, eyeDx = 10): string {
  const c = def.color;
  const c2 = def.color2 ?? '#ffffff';
  const s = stroke(OUTLINE, 3);
  switch (def.kind) {
    // Head.
    case 'party':
      return (
        `<path d="M-14 6 L0 -30 L14 6 Q0 10 -14 6 Z" fill="${c}" ${s}/>` +
        `<path d="M-8 -8 L8 -8 M-11 0 L11 0" stroke="${c2}" stroke-width="3"/>` +
        `<circle cx="0" cy="-31" r="5.5" fill="${c2}" ${s}/>`
      );
    case 'bow':
      return (
        `<path d="M0 0 L-19 -11 Q-23 0 -19 11 Z" fill="${c}" ${s}/>` +
        `<path d="M0 0 L19 -11 Q23 0 19 11 Z" fill="${c}" ${s}/>` +
        `<circle cx="0" cy="0" r="5.5" fill="${c}" ${s}/>`
      );
    case 'flower': {
      const petals = [0, 1, 2, 3, 4]
        .map((i) => {
          const a = (i / 5) * Math.PI * 2 - Math.PI / 2;
          return `<circle cx="${n(12 + Math.cos(a) * 7)}" cy="${n(2 + Math.sin(a) * 7)}" r="5.5" fill="${c2}" ${stroke(OUTLINE, 2)}/>`;
        })
        .join('');
      return `${petals}<circle cx="12" cy="2" r="5" fill="${c}" ${stroke(OUTLINE, 2)}/>`;
    }
    case 'crown':
      return (
        `<path d="M-16 4 L-16 -12 L-8 -2 L0 -16 L8 -2 L16 -12 L16 4 Z" fill="${c}" ${s}/>` +
        `<circle cx="0" cy="-3" r="3" fill="#ff6f9a"/><circle cx="-9" cy="0" r="2" fill="#8fd6ff"/><circle cx="9" cy="0" r="2" fill="#8fd6ff"/>`
      );
    // Body.
    case 'sweater':
      return (
        `<ellipse cx="0" cy="0" rx="33" ry="19" fill="${c}" ${s}/>` +
        `<path d="M-30 -2 L30 -2 M-26 9 L26 9" stroke="${c2}" stroke-width="4"/>` +
        `<path d="M-14 -17 Q0 -10 14 -17" fill="none" stroke="${c2}" stroke-width="4"/>`
      );
    case 'cape':
      return (
        `<path d="M-26 -22 L26 -22 Q40 4 44 26 Q0 34 -44 26 Q-40 4 -26 -22 Z" fill="${c}" ${s}/>` +
        `<circle cx="0" cy="-20" r="5" fill="${c2}" ${stroke(OUTLINE, 2)}/>`
      );
    case 'tutu':
      return (
        `<ellipse cx="0" cy="10" rx="45" ry="11" fill="${c}" fill-opacity="0.95" ${s}/>` +
        `<path d="M-38 10 L-30 18 L-22 10 L-14 19 L-6 10 L2 19 L10 10 L18 19 L26 10 L34 18" fill="none" stroke="#ffffff" stroke-width="2" stroke-opacity="0.8"/>`
      );
    case 'scarf':
      return (
        `<rect x="-26" y="-22" width="52" height="11" rx="5.5" fill="${c}" ${s}/>` +
        `<rect x="10" y="-15" width="11" height="24" rx="4" fill="${c}" ${s}/>` +
        `<path d="M10 4 L21 4" stroke="${c2}" stroke-width="3"/>`
      );
    // Face.
    case 'glasses':
      return (
        `<circle cx="${n(-eyeDx)}" cy="0" r="7.5" fill="#ffffff" fill-opacity="0.25" stroke="${c}" stroke-width="3"/>` +
        `<circle cx="${n(eyeDx)}" cy="0" r="7.5" fill="#ffffff" fill-opacity="0.25" stroke="${c}" stroke-width="3"/>` +
        `<path d="M${n(-eyeDx + 7.5)} 0 L${n(eyeDx - 7.5)} 0" stroke="${c}" stroke-width="3"/>`
      );
    case 'bandana':
      return (
        `<path d="M-20 12 L20 12 L0 30 Z" fill="${c}" ${stroke(OUTLINE, 2.5)}/>` +
        `<circle cx="-6" cy="16" r="2" fill="${c2}"/><circle cx="5" cy="20" r="2" fill="${c2}"/><circle cx="0" cy="25" r="1.5" fill="${c2}"/>`
      );
    case 'star':
      return (
        [-eyeDx, eyeDx].map((x) => starShape(x, 0, 9.5, c)).join('') +
        `<path d="M${n(-eyeDx + 8)} -1 L${n(eyeDx - 8)} -1" stroke="${c}" stroke-width="3"/>` +
        twinkle(-eyeDx + 3, -3, 2.5, '#ffffff')
      );
    default:
      return '';
  }
}

function starShape(cx: number, cy: number, r: number, color: string): string {
  const pts: string[] = [];
  for (let i = 0; i < 10; i++) {
    const rr = i % 2 ? r * 0.45 : r;
    const a = -Math.PI / 2 + (i * Math.PI) / 5;
    pts.push(`${n(cx + Math.cos(a) * rr)},${n(cy + Math.sin(a) * rr)}`);
  }
  return `<polygon points="${pts.join(' ')}" fill="${color}" ${stroke(OUTLINE, 2)}/>`;
}
