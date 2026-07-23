import { SIGNS } from "./astro.ts";

export const CORE_RULE_IDS = [
  "p4.ascendant.sign.v1",
  "p4.moon.sign-nakshatra.v1",
  "p4.mercury.sign-house.v1",
  "p4.mars.sign-house.v1",
  "p4.dasha.current-lord.v1",
] as const;

export const CAREER_RULE_IDS = [
  "p4.career.tenth-house-sign.v1",
  "p4.career.tenth-lord-position.v1",
  "p4.career.sun-position.v1",
  "p4.career.saturn-position.v1",
  "p4.career.jupiter-position.v1",
  "p4.career.decision-factors.v1",
] as const;

export const RELATIONSHIP_RULE_IDS = [
  "p4.relationship.seventh-house-sign.v1",
  "p4.relationship.seventh-lord-position.v1",
  "p4.relationship.venus-position.v1",
  "p4.relationship.moon-venus-needs.v1",
] as const;

export const APPROVED_RULE_IDS = [
  ...CORE_RULE_IDS,
  ...CAREER_RULE_IDS,
  ...RELATIONSHIP_RULE_IDS,
] as const;

export const RULE_PACKS = [
  {
    id: "celestial-core-jyotish-p4-v1",
    label: "Core",
    status: "Active",
    ruleIds: CORE_RULE_IDS,
  },
  {
    id: "celestial-career-jyotish-p4-v1",
    label: "Career",
    status: "Active",
    ruleIds: CAREER_RULE_IDS,
  },
  {
    id: "celestial-relationship-jyotish-p4-v1",
    label: "Relationship",
    status: "Active",
    ruleIds: RELATIONSHIP_RULE_IDS,
  },
] as const;

export const TRADITIONAL_SIGN_LORDS = {
  Aries: "Mars",
  Taurus: "Venus",
  Gemini: "Mercury",
  Cancer: "Moon",
  Leo: "Sun",
  Virgo: "Mercury",
  Libra: "Venus",
  Scorpio: "Mars",
  Sagittarius: "Jupiter",
  Capricorn: "Saturn",
  Aquarius: "Saturn",
  Pisces: "Jupiter",
} as const;

export const HOUSE_TOPICS: Record<number, string> = {
  1: "identity, embodiment, and personal approach",
  2: "resources, speech, and continuity",
  3: "skills, initiative, and communication effort",
  4: "home, foundations, and private stability",
  5: "learning, creativity, and considered expression",
  6: "service, routines, and practical problem-solving",
  7: "one-to-one partnership and negotiated responsibility",
  8: "shared resources, research, and sustained change",
  9: "higher learning, guidance, and wider meaning",
  10: "public work, responsibility, and visible contribution",
  11: "networks, collaboration, and long-range gains",
  12: "retreat, distant contexts, and behind-the-scenes effort",
};

export function wholeSignHouseSign(ascendantSignIndex: number, house: number) {
  if (!Number.isInteger(house) || house < 1 || house > 12) {
    throw new Error(`Whole-sign house must be between 1 and 12; received ${house}.`);
  }
  return SIGNS[(ascendantSignIndex + house - 1) % 12];
}

export function traditionalSignLord(sign: string) {
  const lord = TRADITIONAL_SIGN_LORDS[sign as keyof typeof TRADITIONAL_SIGN_LORDS];
  if (!lord) throw new Error(`No approved traditional sign lord is defined for ${sign}.`);
  return lord;
}

export function houseTopic(house: number) {
  const topic = HOUSE_TOPICS[house];
  if (!topic) throw new Error(`No approved house topic is defined for house ${house}.`);
  return topic;
}

