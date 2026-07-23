export const CERTIFICATION_PROFILE = {
  id: "reference-chart-cert-v1",
  certificateId: "CAA-P2-RCC-20260723-01",
  name: "P2 Internal Reference Validation",
  version: "1.0.0",
  status: "Passed",
  issuedOn: "2026-07-23",
  referenceCharts: 5,
  placementSnapshots: 60,
  externalPositionChecks: 20,
  timeScenarios: 8,
  timezones: [
    "Asia/Kolkata",
    "America/New_York",
    "Europe/London",
    "Australia/Sydney",
    "Asia/Kathmandu",
  ],
  summary: "5 pinned full charts, 60 placements, 20 NASA/JPL comparison fixtures, and 8 time-handling scenarios passed the internal regression suite",
  scope:
    "Internal reproducibility validation for the named calculation profile; not NASA certification, third-party accreditation, universal accuracy certification, or validation of astrological predictions.",
} as const;
