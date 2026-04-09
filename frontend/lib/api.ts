const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8001";

function getToken(): string | null {
  if (typeof window === "undefined") return null;
  return localStorage.getItem("uwsd_token");
}

async function request<T>(path: string, options: RequestInit = {}): Promise<T> {
  const token = getToken();
  const res = await fetch(`${API_URL}${path}`, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...options.headers,
    },
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: res.statusText }));
    throw new Error(err.detail || "Request failed");
  }
  return res.json();
}

export const api = {
  login: (email: string, password: string) =>
    request<{ token: string; user: any }>("/auth/login", {
      method: "POST",
      body: JSON.stringify({ email, password }),
    }),

  me: () => request<any>("/auth/me"),

  getDashboardStats: () => request<any>("/dashboard/stats"),

  getCameras: () => request<any[]>("/cameras"),

  getAlerts: (limit?: number) =>
    request<any[]>(`/alerts${limit ? `?limit=${limit}` : ""}`),

  acknowledgeAlert: (id: string) =>
    request<any>(`/alerts/${id}/acknowledge`, { method: "POST" }),

  getAccessLogs: (limit?: number) =>
    request<any[]>(`/access-logs${limit ? `?limit=${limit}` : ""}`),

  getHourlyTraffic: () => request<any[]>("/traffic/hourly"),

  getWeeklyAlerts: () => request<any[]>("/traffic/weekly-alerts"),

  getVisitors: () => request<any[]>("/visitors"),

  checkInVisitor: (id: string) =>
    request<any>(`/visitors/${id}/check-in`, { method: "POST" }),

  checkOutVisitor: (id: string) =>
    request<any>(`/visitors/${id}/check-out`, { method: "POST" }),

  registerVisitor: (data: {
    name: string;
    phone?: string;
    purpose: string;
    hostUserId?: string;
    selfie?: string;
    timeStart?: string;
    timeEnd?: string;
    allowedZones?: string[];
  }) => request<any>("/visitor/register", { method: "POST", body: JSON.stringify(data) }),

  checkVisitor: (data: { qr_token?: string; image?: string }) =>
    request<any>("/visitor/check", { method: "POST", body: JSON.stringify(data) }),

  getNightOuts: () => request<any[]>("/night-outs"),

  approveNightOut: (id: string) =>
    request<any>(`/night-outs/${id}/approve`, { method: "POST" }),

  rejectNightOut: (id: string) =>
    request<any>(`/night-outs/${id}/reject`, { method: "POST" }),

  getParcels: (status?: string) =>
    request<any[]>(`/parcels${status ? `?status=${status}` : ""}`),

  collectParcel: (id: string) =>
    request<any>(`/parcels/${id}/collect`, { method: "POST" }),

  addParcel: (data: { tracking_id: string; student_id: string; courierName?: string }) =>
    request<any>("/parcel/add", { method: "POST", body: JSON.stringify(data) }),

  getParcelByTracking: (trackingId: string) =>
    request<any>(`/parcel/${trackingId}`),

  verifyParcel: (tracking_id: string) =>
    request<any>("/parcel/verify", { method: "POST", body: JSON.stringify({ tracking_id }) }),

  getVehicles: () => request<any[]>("/vehicles"),

  registerVehicle: (data: { licensePlate: string; ownerName: string; vehicleType: string; isBlacklisted: boolean }) =>
    request<any>("/vehicles/register", { method: "POST", body: JSON.stringify(data) }),

  toggleBlacklist: (id: string) =>
    request<any>(`/vehicles/${id}/blacklist`, { method: "POST" }),

  analyzeVehicleVideo: (file: File) => {
    const token = getToken();
    const form = new FormData();
    form.append("file", file);
    return fetch(`${API_URL}/vehicles/analyze-video`, {
      method: "POST",
      headers: token ? { Authorization: `Bearer ${token}` } : {},
      body: form,
    }).then(async (res) => {
      if (!res.ok) {
        const err = await res.json().catch(() => ({ detail: res.statusText }));
        throw new Error(err.detail || "Request failed");
      }
      return res.json();
    });
  },

  getUsers: () => request<any[]>("/users"),
};
