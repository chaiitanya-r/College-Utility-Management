import axios, { type AxiosError } from "axios";
import { clearAuth, getAuthToken } from "./auth";

export type { ApiErrorBody } from "./apiError";
export {
  getApiErrorMessage,
  getApiErrorCode,
  getApiErrorDetails,
  isRateLimitError,
} from "./apiError";

let apiBaseUrl =
  import.meta.env.VITE_API_URL ||
  `http://localhost:${import.meta.env.VITE_API_PORT || 4000}/api`;

if (apiBaseUrl && !apiBaseUrl.endsWith("/api") && !apiBaseUrl.endsWith("/api/")) {
  const cleaned = apiBaseUrl.endsWith("/") ? apiBaseUrl.slice(0, -1) : apiBaseUrl;
  apiBaseUrl = `${cleaned}/api`;
}

export const api = axios.create({
  baseURL: apiBaseUrl,
  withCredentials: false
});

api.interceptors.request.use((config) => {
  const token = getAuthToken();
  if (token) {
    config.headers = config.headers || {} as any;
    (config.headers as any).Authorization = `Bearer ${token}`;
  }
  return config;
});

const normalizeMongoIds = (data: any): any => {
  if (!data || typeof data !== "object") return data;
  if (Array.isArray(data)) {
    return data.map(normalizeMongoIds);
  }
  if (data.constructor === Object) {
    if (data._id && !data.id) {
      data.id = String(data._id);
    }
    for (const key of Object.keys(data)) {
      if (Array.isArray(data[key])) {
        data[key] = data[key].map(normalizeMongoIds);
      }
    }
  }
  return data;
};

const AUTH_SKIP_PATHS = ["/auth/login", "/auth/forgot-password", "/auth/verify-otp", "/auth/reset-password"];

api.interceptors.response.use(
  (response) => {
    if (response.data) {
      response.data = normalizeMongoIds(response.data);
    }
    return response;
  },
  async (error: AxiosError) => {
    const status = error.response?.status;
    const requestUrl = String(error.config?.url || "");

    if (status === 401 && !AUTH_SKIP_PATHS.some((p) => requestUrl.includes(p))) {
      const hadToken = !!getAuthToken();
      clearAuth();
      if (hadToken && typeof window !== "undefined") {
        const orgMatch = window.location.pathname.match(/\/org\/([^/]+)/);
        const orgId = orgMatch?.[1];
        const loginPath = orgId ? `/org/${orgId}/login` : "/";
        const redirect = encodeURIComponent(
          window.location.pathname + window.location.search
        );
        if (!window.location.pathname.endsWith("/login")) {
          window.location.href = `${loginPath}?session=expired&redirect=${redirect}`;
        }
      }
    }
    return Promise.reject(error);
  }
);

export const AuthApi = {
  login: (data: { orgId?: string; email: string; password: string }) =>
    api.post("/auth/login", data),
  forgotPassword: (data: { orgId?: string; email: string }) =>
    api.post("/auth/forgot-password", data),
  verifyOTP: (data: { resetId: string; otp: string }) =>
    api.post("/auth/verify-otp", data),
  resetPassword: (data: { resetId: string; newPassword: string; confirmPassword: string }) =>
    api.post("/auth/reset-password", data)
};

export const OrganizationApi = {
  list: (params?: { includeInactive?: boolean }) => api.get("/organizations", { params }),
  getPublic: (orgId: string) => api.get(`/organizations/${orgId}/public`),
  getPlatformStats: () => api.get("/organizations/stats/platform"),
  getChatbotUsageStats: () => api.get("/organizations/stats/chatbot-usage"),
  create: (data: { name: string }) =>
    api.post("/organizations", data),
  delete: (orgId: string) => api.delete(`/organizations/${orgId}`),
  reactivate: (orgId: string) => api.patch(`/organizations/${orgId}/reactivate`),
  purge: (orgId: string) => api.delete(`/organizations/${orgId}/purge`),
  exportHistory: (orgId: string, format: "csv" | "xlsx" = "csv") =>
    api.get(`/organizations/${orgId}/export-history`, {
      params: { format },
      responseType: "blob"
    }),
};

export const UserApi = {
  list: (orgId: string) => api.get(`/orgs/${orgId}/users`),
  create: (orgId: string, data: { name: string; email: string; password: string; role: string; department?: string; phone?: string }) =>
    api.post(`/orgs/${orgId}/users`, data),
  update: (orgId: string, userId: string, data: { name?: string; email?: string; password?: string; role?: string; department?: string; phone?: string }) =>
    api.put(`/orgs/${orgId}/users/${userId}`, data),
  delete: (orgId: string, userId: string) => api.delete(`/orgs/${orgId}/users/${userId}`),
  updateSelf: (orgId: string, data: { name?: string; email?: string; phone?: string }) =>
    api.put(`/orgs/${orgId}/users/me/profile`, data),
};

export interface CustomDepartment {
  _id: string;
  name: string;
  code?: string;
  organizationId: string;
  isActive: boolean;
  createdAt: string;
}

export const DepartmentApi = {
  list: (orgId: string) =>
    api.get<{ departments: string[]; customDepartments: CustomDepartment[] }>(`/orgs/${orgId}/departments`),
  create: (orgId: string, data: { name: string; code?: string }) =>
    api.post<CustomDepartment>(`/orgs/${orgId}/departments`, data),
  delete: (orgId: string, deptId: string) =>
    api.delete(`/orgs/${orgId}/departments/${deptId}`),
};

export const CategoryApi = {
  list: (orgId: string) => api.get(`/orgs/${orgId}/categories`),
  create: (orgId: string, data: any) => api.post(`/orgs/${orgId}/categories`, data),
  update: (orgId: string, categoryId: string, data: any) => api.put(`/orgs/${orgId}/categories/${categoryId}`, data),
  delete: (orgId: string, categoryId: string) => api.delete(`/orgs/${orgId}/categories/${categoryId}`),
};

export const UtilityApi = {
  list: (orgId: string, categoryId?: string) =>
    api.get(`/orgs/${orgId}/utilities`, { params: { categoryId } }),
  create: (orgId: string, data: any) => api.post(`/orgs/${orgId}/utilities`, data),
  update: (orgId: string, utilityId: string, data: any) => api.put(`/orgs/${orgId}/utilities/${utilityId}`, data),
  delete: (orgId: string, utilityId: string) => api.delete(`/orgs/${orgId}/utilities/${utilityId}`),
};

export const BookingApi = {
  list: (orgId: string, utilityId?: string, status?: string) =>
    api.get(`/orgs/${orgId}/bookings`, { params: { utilityId, status } }),
  create: (
    orgId: string,
    payload: {
      utilityId: string;
      date: string;
      timeSlotId: string;
      purpose: string;
      attendeesCount?: number;
      customFieldValues?: Record<string, any>;
    }
  ) => api.post(`/orgs/${orgId}/bookings`, payload),
  updateStatus: (orgId: string, bookingId: string, action: "approve" | "reject" | "confirm", remarks?: string) =>
    api.patch(`/orgs/${orgId}/bookings/${bookingId}/status`, { action, remarks }),
  modify: (
    orgId: string,
    bookingId: string,
    payload: {
      date?: string;
      timeSlotId?: string;
      timeSlotLabel?: string;
      purpose?: string;
      attendeesCount?: number;
      customFieldValues?: Record<string, any>;
    }
  ) => api.patch(`/orgs/${orgId}/bookings/${bookingId}`, payload),
  cancel: (orgId: string, bookingId: string) =>
    api.post(`/orgs/${orgId}/bookings/${bookingId}/cancel`),
  submitFeedback: (
    orgId: string,
    bookingId: string,
    feedback: {
      rating: number;
      comment: string;
    }
  ) => api.post(`/orgs/${orgId}/bookings/${bookingId}/feedback`, feedback),
  complete: (orgId: string, bookingId: string) =>
    api.post(`/orgs/${orgId}/bookings/${bookingId}/complete`),
  getReviews: (
    orgId: string,
    utilityId: string,
    page: number = 1,
    limit: number = 5
  ) => api.get(`/orgs/${orgId}/bookings/reviews/${utilityId}`, { params: { page, limit } }),
  lock: (
    orgId: string,
    payload: {
      utilityId: string;
      date: string;
      timeSlotId: string;
    }
  ) => api.post(`/orgs/${orgId}/bookings/lock`, payload),
  confirm: (
    orgId: string,
    payload: {
      bookingId: string;
      purpose: string;
      attendeesCount?: number;
      customFieldValues?: Record<string, any>;
    }
  ) => api.post(`/orgs/${orgId}/bookings/confirm`, payload),
  release: (orgId: string, bookingId: string) =>
    api.post(`/orgs/${orgId}/bookings/${bookingId}/release`),
};

export const CanteenMenuApi = {
  list: (orgId: string) => api.get(`/orgs/${orgId}/canteen-menu`),
  create: (orgId: string, data: { name: string; type: string; unit?: string; price?: number }) =>
    api.post(`/orgs/${orgId}/canteen-menu`, data),
  update: (
    orgId: string,
    itemId: string,
    data: { name?: string; type?: string; unit?: string; price?: number; isActive?: boolean }
  ) =>
    api.put(`/orgs/${orgId}/canteen-menu/${itemId}`, data),
  delete: (orgId: string, itemId: string) =>
    api.delete(`/orgs/${orgId}/canteen-menu/${itemId}`),
};

export const RequisitionApi = {
  list: (orgId: string, status?: string) =>
    api.get(`/orgs/${orgId}/requisitions`, { params: { status } }),
  listDepartments: (orgId: string) =>
    api.get(`/orgs/${orgId}/requisitions/departments`),
  get: (orgId: string, reqId: string) =>
    api.get(`/orgs/${orgId}/requisitions/${reqId}`),
  create: (
    orgId: string,
    payload: { items: { menuItemId: string; quantity: number }[]; department: string; reasoning: string; comment?: string }
  ) => api.post(`/orgs/${orgId}/requisitions`, payload),
  update: (
    orgId: string,
    reqId: string,
    payload: { items?: { menuItemId: string; quantity: number }[]; department?: string; reasoning?: string; comment?: string; remarks?: string }
  ) => api.patch(`/orgs/${orgId}/requisitions/${reqId}`, payload),
  updateStatus: (orgId: string, reqId: string, action: "approve" | "cancel", remarks?: string) =>
    api.patch(`/orgs/${orgId}/requisitions/${reqId}/status`, { action, remarks }),
  addComment: (orgId: string, reqId: string, content: string) =>
    api.post(`/orgs/${orgId}/requisitions/${reqId}/comments`, { content }),
  markPrepared: (
    orgId: string,
    reqId: string,
    billing?: { totalAmount: number; currency?: string; items: { name: string; quantity: number; unitPrice: number; amount: number }[] }
  ) => api.patch(`/orgs/${orgId}/requisitions/${reqId}/prepare`, { billing }),
  handOver: (
    orgId: string,
    reqId: string,
    data: { peonName: string; peonPhone: string; billing?: { totalAmount: number; currency?: string; items: { name: string; quantity: number; unitPrice: number; amount: number }[] } }
  ) => api.patch(`/orgs/${orgId}/requisitions/${reqId}/handover`, data),
};

export const MaintenanceApi = {
  list: (orgId: string) => api.get(`/orgs/${orgId}/maintenance`),
  get: (orgId: string, ticketId: string) =>
    api.get(`/orgs/${orgId}/maintenance/${ticketId}`),
  create: (
    orgId: string,
    payload: {
      department: string;
      issueCategory: 'minor' | 'major';
      problemTitle: string;
      actualProblem: string;
      itemsToRepair: { name: string; quantity: number }[];
    }
  ) => api.post(`/orgs/${orgId}/maintenance`, payload),
  addComment: (
    orgId: string,
    ticketId: string,
    payload: {
      content?: string;
      attachmentUrl?: string;
      attachmentName?: string;
      attachmentType?: string;
    }
  ) => api.post(`/orgs/${orgId}/maintenance/${ticketId}/comments`, payload),
  act: (orgId: string, ticketId: string, payload: any) =>
    api.post(`/orgs/${orgId}/maintenance/${ticketId}/actions`, payload),
  listWorkers: (orgId: string) => api.get(`/orgs/${orgId}/maintenance/workers`),
  createWorker: (orgId: string, payload: { name: string; phone: string; department?: string; email?: string; password?: string }) =>
    api.post(`/orgs/${orgId}/maintenance/workers`, payload),
  updateWorker: (orgId: string, workerId: string, payload: { name?: string; phone?: string; department?: string; email?: string; password?: string }) =>
    api.put(`/orgs/${orgId}/maintenance/workers/${workerId}`, payload),
  deleteWorker: (orgId: string, workerId: string) =>
    api.delete(`/orgs/${orgId}/maintenance/workers/${workerId}`),
};

export const UtilityBookingApi = {
  listCategories: async (orgId: string) => {
    const res = await api.get(`/orgs/${orgId}/categories`);
    const data = (res.data || []).map((c: any) => ({ ...c, id: c.id || c._id }));
    return { ...res, data };
  },
  listUtilities: async (orgId: string, categoryId?: string) => {
    const res = await api.get(`/orgs/${orgId}/utilities`, { params: { categoryId } });
    const data = (res.data || []).map((u: any) => ({
      ...u,
      id: u.id || u._id,
      categoryId: u.categoryId || u.categoryId?._id || u.categoryId,
    }));
    return { ...res, data };
  },
  getUtility: async (orgId: string, utilityId: string) => {
    const res = await api.get(`/orgs/${orgId}/utilities/${utilityId}`);
    const u = res.data || {};
    const data = {
      ...u,
      id: u.id || u._id,
      categoryId: u.categoryId || u.categoryId?._id || u.categoryId,
    };
    return { ...res, data };
  },
  listBookings: async (orgId: string, utilityId?: string) => {
    const res = await api.get(`/orgs/${orgId}/bookings`, { params: { utilityId } });
    const data = (res.data || []).map((b: any) => ({
      ...b,
      id: b.id || b._id,
      utilityId: b.utilityId || b.utilityId?._id || b.utilityId,
    }));
    return { ...res, data };
  },
  listBookingOccupancy: async (orgId: string, date?: string, utilityId?: string) => {
    const res = await api.get(`/orgs/${orgId}/bookings/occupancy`, {
      params: { date, utilityId },
    });
    return { ...res, data: res.data || [] };
  },
  createBooking: (
    orgId: string,
    payload: {
      utilityId: string;
      date: string;
      timeSlotId: string;
      purpose: string;
      attendeesCount?: number;
      customFieldValues?: Record<string, any>;
    }
  ) => api.post(`/orgs/${orgId}/bookings`, payload)
};

export const ChatApi = {
  send: (payload: {
    messages: { role: string; content: string }[];
    orgId?: string;
  }) => api.post<{ reply: string; meta?: Record<string, unknown> }>("/chat", payload),
};

export const AnalyticsApi = {
  bookings: (orgId: string, params?: Record<string, string>) =>
    api.get(`/orgs/${orgId}/analytics/bookings`, { params }),
  canteen: (orgId: string, params?: Record<string, string>) =>
    api.get(`/orgs/${orgId}/analytics/canteen`, { params }),
  maintenance: (orgId: string, params?: Record<string, string>) =>
    api.get(`/orgs/${orgId}/analytics/maintenance`, { params }),
  overview: (orgId: string, params?: Record<string, string>) =>
    api.get(`/orgs/${orgId}/analytics/overview`, { params }),
  me: (orgId: string, params?: Record<string, string>) =>
    api.get(`/orgs/${orgId}/analytics/me`, { params }),
  platform: (params?: Record<string, string>) =>
    api.get(`/analytics/platform`, { params }),
};
