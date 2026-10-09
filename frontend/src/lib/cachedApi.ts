import { BookingApi, MaintenanceApi, RequisitionApi } from "./api";
import { fetchWithCache } from "./requestCache";

export async function cachedBookingList(orgId: string) {
  return fetchWithCache(`bookings:${orgId}`, async () => {
    const res = await BookingApi.list(orgId);
    return res.data || [];
  });
}

export async function cachedRequisitionList(orgId: string) {
  return fetchWithCache(`requisitions:${orgId}`, async () => {
    const res = await RequisitionApi.list(orgId);
    return res.data || [];
  });
}

export async function cachedMaintenanceList(orgId: string) {
  return fetchWithCache(`maintenance:${orgId}`, async () => {
    const res = await MaintenanceApi.list(orgId);
    return res.data || [];
  });
}
