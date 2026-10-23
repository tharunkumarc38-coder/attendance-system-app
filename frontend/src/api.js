const DEFAULT_API_BASE_URL = "http://localhost:8081/api";

export function getApiBaseUrl() {
  return (import.meta.env.VITE_API_BASE_URL || DEFAULT_API_BASE_URL).replace(/\/+$/, "");
}

export const API_BASE_URL = getApiBaseUrl();

export function authHeaders() {
  const savedUser = localStorage.getItem("user");
  if (!savedUser) return { "Content-Type": "application/json" };

  try {
    const parsed = JSON.parse(savedUser);
    const token = parsed.token || parsed.accessToken;
    return {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    };
  } catch {
    return { "Content-Type": "application/json" };
  }
}

export async function apiRequest(path, options = {}) {
  let response;
  try {
    response = await fetch(`${getApiBaseUrl()}${path}`, options);
  } catch {
    throw new Error("Unable to reach the service. Check your connection and try again.");
  }

  if (!response.ok) {
    let message = `Request failed (${response.status}).`;
    try {
      const payload = await response.json();
      if (typeof payload.error === "string") message = payload.error;
    } catch {
      // Keep the status-based message when the response is not JSON.
    }
    throw new Error(message);
  }
  return response;
}

export async function apiJson(path, options = {}) {
  const response = await apiRequest(path, options);
  return response.json();
}

export function getLogin(credentials) {
  return apiJson("/auth/login", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(credentials),
  });
}

export function getAttendance() {
  return apiJson("/attendance", { headers: authHeaders() });
}

export function getAttendanceSummary() {
  return apiJson("/attendance/summary", { headers: authHeaders() });
}

export function getLeaves() {
  return apiJson("/leave", { headers: authHeaders() });
}

export function getNotifications(unreadOnly = false) {
  return apiJson(`/notifications${unreadOnly ? "?unreadOnly=true" : ""}`, {
    headers: authHeaders(),
  });
}

export function getUnreadNotificationCount() {
  return apiJson("/notifications/unread-count", { headers: authHeaders() });
}

export function setNotificationRead(id) {
  return apiJson(`/notifications/${encodeURIComponent(id)}/read`, {
    method: "PATCH",
    headers: authHeaders(),
  });
}

export function setAllNotificationsRead() {
  return apiJson("/notifications/read-all", {
    method: "PATCH",
    headers: authHeaders(),
  });
}

export function submitLeave(payload) {
  return apiJson("/leave", {
    method: "POST",
    headers: authHeaders(),
    body: JSON.stringify(payload),
  });
}

export function updateLeaveStatus(id, status) {
  return apiJson(`/leave/${encodeURIComponent(id)}/status`, {
    method: "PATCH",
    headers: authHeaders(),
    body: JSON.stringify({ status }),
  });
}

export async function getCertificate(id) {
  return apiRequest(`/leave/${encodeURIComponent(id)}/certificate.pdf`, {
    headers: authHeaders(),
  });
}
