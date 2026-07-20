export const AUTH_COOKIE = "ems_auth";
const ACCESS_TOKEN_KEY = "access_token";
const AUTH_USER_KEY = "auth_user";

export function setAuthSession() {
  if (typeof document !== "undefined") {
    document.cookie = `${AUTH_COOKIE}=1; path=/; SameSite=Lax`;
  }
}

export function setStoredAuth(accessToken: string, user: unknown) {
  if (typeof window === "undefined") return;
  sessionStorage.setItem(ACCESS_TOKEN_KEY, accessToken);
  sessionStorage.setItem(AUTH_USER_KEY, JSON.stringify(user));
  localStorage.removeItem(ACCESS_TOKEN_KEY);
  localStorage.removeItem(AUTH_USER_KEY);
  setAuthSession();
}

export function getAccessToken() {
  return typeof window !== "undefined" ? sessionStorage.getItem(ACCESS_TOKEN_KEY) : null;
}

export function getStoredAuthUser() {
  return typeof window !== "undefined" ? sessionStorage.getItem(AUTH_USER_KEY) : null;
}

export function updateStoredAuthUser(updater: (current: Record<string, unknown>) => Record<string, unknown>) {
  if (typeof window === "undefined") return;
  const raw = sessionStorage.getItem(AUTH_USER_KEY);
  if (!raw) return;
  const current = JSON.parse(raw) as Record<string, unknown>;
  sessionStorage.setItem(AUTH_USER_KEY, JSON.stringify(updater(current)));
}

export function clearAuthSession() {
  if (typeof window !== "undefined") {
    sessionStorage.removeItem(ACCESS_TOKEN_KEY);
    sessionStorage.removeItem(AUTH_USER_KEY);
    localStorage.removeItem("access_token");
    localStorage.removeItem("auth_user");
  }
  if (typeof document !== "undefined") {
    document.cookie = `${AUTH_COOKIE}=; path=/; max-age=0; SameSite=Lax`;
  }
}

export function handleUnauthorized() {
  clearAuthSession();
  if (typeof window !== "undefined" && !window.location.pathname.startsWith("/login")) {
    window.location.href = "/login?reason=session-ended";
  }
}
