import { CERTIFICATION_PROFILE } from "./certification-profile.ts";

export const ENGINE_PROFILE = {
  id: "celestial-mit-v1",
  name: "Celestial Calculation Engine",
  version: "1.0.0",
  kernelName: "Astronomy Engine",
  kernelVersion: "2.1.19",
  kernelLicense: "MIT",
  statedKernelAccuracy: "approximately ±1 arcminute",
  validationProfile: "jpl-horizons-de441-v1",
  validationSummary: "20 pinned NASA/JPL Horizons DE441 position fixtures; max observed delta 0.190′; internal comparison only, not NASA certification",
  referenceEpochs: ["2000-01-01T12:00:00Z", "2024-04-08T18:00:00Z"],
} as const;

export const AYANAMSA_PROFILE = {
  id: "mean-lahiri-j2000-linear-v1",
  name: "Mean Lahiri/Chitrapaksha J2000 linear model",
  anchorDegrees: 23.85675,
  anchorJulianDay: 2_451_545.0,
  annualPrecessionArcseconds: 50.290966,
} as const;

export const NODE_PROFILE = {
  id: "mean-lunar-node-meeus-v1",
  name: "Mean lunar node",
} as const;

export const HOUSE_PROFILE = {
  id: "whole-sign-v1",
  name: "Whole sign",
} as const;

export const CALCULATION_PROFILE_ID = "celestial-lahiri-ws-mean-node-v1" as const;
export const DATE_RANGE_PROFILE_ID = "celestial-lahiri-date-range-v1" as const;

export function engineFingerprint() {
  return [
    `${ENGINE_PROFILE.id}@${ENGINE_PROFILE.version}`,
    `${ENGINE_PROFILE.kernelName}@${ENGINE_PROFILE.kernelVersion}`,
    AYANAMSA_PROFILE.id,
    NODE_PROFILE.id,
    HOUSE_PROFILE.id,
    ENGINE_PROFILE.validationProfile,
    CERTIFICATION_PROFILE.id,
  ].join("|");
}
