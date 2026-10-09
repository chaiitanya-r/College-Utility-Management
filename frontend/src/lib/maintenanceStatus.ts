const CLOSED_STATUSES = new Set(["COMPLETED", "REJECTED"]);

export function isMaintenanceTicketOpen(status: unknown): boolean {
  const s = String(status ?? "").toUpperCase();
  if (!s) return false;
  return !CLOSED_STATUSES.has(s);
}

export function getMaintenanceTicketLabel(ticket: {
  problemTitle?: string;
  title?: string;
  status?: string;
}): string {
  return ticket.problemTitle || ticket.title || ticket.status || "Maintenance ticket";
}
