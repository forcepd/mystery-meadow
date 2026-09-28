import { BALANCE } from '../config/balance';
import { getIllness } from '../config/illnesses';
import type { SimEvents } from '../sim/events';
import { displayName, speciesName } from './describe';

export interface ToastMessage {
  icon: string;
  text: string;
}

/** DESIGN 17.4: short, friendly toasts for sim events. `null` = no toast for this event. */
export const TOASTS: {
  [K in keyof SimEvents]?: (payload: SimEvents[K]) => ToastMessage | null;
} = {
  visitorArrived: () => ({ icon: '❓', text: 'A mystery visitor is here!' }),
  visitorLeft: ({ visitor }) => ({
    icon: '👋',
    text: `No room! The ${speciesName(visitor.roll.speciesId)} waved goodbye.`,
  }),
  visitorSkipped: () => ({ icon: '🏡', text: 'Your yard is too crowded for visitors!' }),
  animalBorn: ({ mother, babies }) => ({
    icon: '🍼',
    text:
      babies.length === 1
        ? `${displayName(mother)} had a baby!`
        : `${displayName(mother)} had ${babies.length} babies!`,
  }),
  bowlEmptied: () => ({ icon: '🥣', text: 'The food bowl is empty! Tap it to refill.' }),
  readyToSell: ({ animal }) => ({ icon: '🪙', text: `${displayName(animal)} is ready to sell!` }),
  animalSold: ({ animal, price }) => ({
    icon: '💖',
    text: `${displayName(animal)} went to a loving new home! +${price}`,
  }),
  animalSick: ({ animal, illnessId }) => ({
    icon: getIllness(illnessId)?.symptomIcon ?? '🤒',
    text: `Oh no, ${displayName(animal)} looks sick!`,
  }),
  clinicReady: ({ animal }) => ({
    icon: '🏥',
    text: `The vet is ready to see ${displayName(animal)}!`,
  }),
  animalCured: ({ animal }) => ({ icon: '💖', text: `${displayName(animal)} is all better!` }),
  houseUpgraded: ({ tierId }) => ({
    icon: '🎉',
    text: `Welcome to your ${BALANCE.houseTiers.find((t) => t.id === tierId)?.name ?? 'new house'}!`,
  }),
  crowdedChanged: ({ crowded }) =>
    crowded
      ? { icon: '🐾', text: 'Your yard is crowded!' }
      : { icon: '🌼', text: 'There’s room again. Visitors are on their way!' },
  caughtUp: (s) => {
    const parts: string[] = [];
    if (s.visitorsWaiting > 0) {
      parts.push(
        `${s.visitorsWaiting} visitor${s.visitorsWaiting === 1 ? ' is' : 's are'} waiting`,
      );
    }
    if (s.babiesBorn > 0)
      parts.push(`${s.babiesBorn} bab${s.babiesBorn === 1 ? 'y was' : 'ies were'} born`);
    if (parts.length === 0) return null;
    return { icon: '🌈', text: `Welcome back! ${parts.join(' and ')}.` };
  },
};
