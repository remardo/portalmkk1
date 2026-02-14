import type { Role, User } from "../domain/models";

export interface AuthTokens {
  accessToken: string;
  refreshToken: string;
  expiresAt?: number;
}

interface BackendProfile {
  id: string;
  full_name: string;
  role: Role;
  office_id: number | null;
  email: string | null;
  phone: string | null;
  points: number | null;
  position: string | null;
  avatar: string | null;
}

const STORAGE_KEY = "portal_mkk_auth_tokens";

function readTokens(): AuthTokens | null {
  if (typeof window === "undefined") {
    return null;
  }

  const raw = window.localStorage.getItem(STORAGE_KEY);
  if (!raw) {
    return null;
  }

  try {
    return JSON.parse(raw) as AuthTokens;
  } catch {
    window.localStorage.removeItem(STORAGE_KEY);
    return null;
  }
}

function writeTokens(tokens: AuthTokens | null) {
  if (typeof window === "undefined") {
    return;
  }

  if (!tokens) {
    window.localStorage.removeItem(STORAGE_KEY);
    return;
  }

  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(tokens));
}

let tokensCache: AuthTokens | null = readTokens();

export function getAuthTokens() {
  return tokensCache;
}

export function setAuthTokens(tokens: AuthTokens | null) {
  tokensCache = tokens;
  writeTokens(tokens);
}

export function clearAuthTokens() {
  setAuthTokens(null);
}

export function mapProfileToUser(profile: BackendProfile): User {
  return {
    id: profile.id,
    name: profile.full_name,
    role: profile.role,
    officeId: profile.office_id ?? 0,
    avatar: profile.avatar ?? "👤",
    email: profile.email ?? "",
    phone: profile.phone ?? "",
    points: profile.points ?? 0,
    position: profile.position ?? "",
  };
}
