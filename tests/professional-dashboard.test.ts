import assert from "node:assert/strict";
import test from "node:test";
import {
  assertCaseAccess,
  assertChartDisclosureAllowed,
  canDeliverReport,
  sanitizeProfessionalNote,
  transitionAppointment,
} from "../app/professional-dashboard.ts";

const record = {
  id: "case_1",
  workspaceId: "workspace_1",
  clientAccountId: "acct_client",
  assignedProfessionalId: "pro_1",
  status: "active" as const,
  consentGrantedAt: "2026-07-20T00:00:00Z",
  consentRevokedAt: null,
};

test("workspace and assignment boundaries are enforced", () => {
  assert.equal(assertCaseAccess({ professionalId: "pro_1", workspaceId: "workspace_1", role: "astrologer" }, record, true), true);
  assert.throws(
    () => assertCaseAccess({ professionalId: "pro_2", workspaceId: "workspace_1", role: "astrologer" }, record, true),
    /another astrologer/,
  );
  assert.throws(
    () => assertCaseAccess({ professionalId: "pro_1", workspaceId: "workspace_2", role: "owner" }, record),
    /different professional workspace/,
  );
});

test("chart disclosure requires active consent", () => {
  assert.equal(assertChartDisclosureAllowed(record), true);
  assert.throws(() => assertChartDisclosureAllowed({ ...record, consentGrantedAt: null }), /consent/);
});

test("appointment states reject invalid transitions", () => {
  assert.equal(transitionAppointment("requested", "confirmed"), "confirmed");
  assert.throws(() => transitionAppointment("completed", "confirmed"), /cannot move/);
});

test("report delivery must match the case chart", () => {
  assert.equal(canDeliverReport(record, "chart_abc", "chart_abc"), true);
  assert.throws(() => canDeliverReport(record, "chart_other", "chart_abc"), /does not belong/);
});

test("professional notes strip scripts and enforce useful content", () => {
  assert.equal(sanitizeProfessionalNote("  Review ascendant <script>alert(1)</script>  "), "Review ascendant ");
  assert.throws(() => sanitizeProfessionalNote("   "), /cannot be empty/);
});
