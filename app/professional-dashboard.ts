export const PROFESSIONAL_DASHBOARD_PROFILE = {
  id: "celestial-professional-dashboard-p8-v1",
  phase: "P8",
  accessModel: "professional-owned workspace with client consent",
} as const;

export type ProfessionalRole = "owner" | "astrologer" | "assistant" | "viewer";
export type CaseStatus = "draft" | "awaiting_consent" | "active" | "completed" | "archived";
export type AppointmentStatus = "requested" | "confirmed" | "completed" | "canceled" | "no_show";

export type ProfessionalCase = {
  id: string;
  workspaceId: string;
  clientAccountId: string | null;
  assignedProfessionalId: string;
  status: CaseStatus;
  consentGrantedAt: string | null;
  consentRevokedAt: string | null;
};

export type DashboardActor = {
  professionalId: string;
  workspaceId: string;
  role: ProfessionalRole;
};

export function assertCaseAccess(actor: DashboardActor, record: ProfessionalCase, write = false) {
  if (actor.workspaceId !== record.workspaceId) throw new Error("This case belongs to a different professional workspace.");
  if (actor.role === "viewer" && write) throw new Error("Viewer access cannot modify professional cases.");
  if (actor.role === "astrologer" && record.assignedProfessionalId !== actor.professionalId) {
    throw new Error("This case is assigned to another astrologer.");
  }
  return true;
}

export function hasActiveClientConsent(record: ProfessionalCase) {
  if (!record.consentGrantedAt) return false;
  if (!record.consentRevokedAt) return true;
  return new Date(record.consentGrantedAt).getTime() > new Date(record.consentRevokedAt).getTime();
}

export function assertChartDisclosureAllowed(record: ProfessionalCase) {
  if (!hasActiveClientConsent(record)) throw new Error("Client consent is required before opening birth details or chart data.");
  if (!["active", "completed"].includes(record.status)) throw new Error("The professional case is not active.");
  return true;
}

export function transitionAppointment(current: AppointmentStatus, next: AppointmentStatus) {
  const allowed: Record<AppointmentStatus, AppointmentStatus[]> = {
    requested: ["confirmed", "canceled"],
    confirmed: ["completed", "canceled", "no_show"],
    completed: [],
    canceled: [],
    no_show: [],
  };
  if (!allowed[current].includes(next)) throw new Error(`Appointment cannot move from ${current} to ${next}.`);
  return next;
}

export function sanitizeProfessionalNote(input: string) {
  const value = input.trim();
  if (!value) throw new Error("A professional note cannot be empty.");
  if (value.length > 10_000) throw new Error("A professional note must be 10,000 characters or fewer.");
  return value.replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, "");
}

export function canDeliverReport(record: ProfessionalCase, reportChartId: string, caseChartId: string) {
  assertChartDisclosureAllowed(record);
  if (!reportChartId || reportChartId !== caseChartId) throw new Error("The report does not belong to this client case.");
  return true;
}
