const ACCESS_KEY = 'sdb_access_token';
const REFRESH_KEY = 'sdb_refresh_token';

/** @deprecated sessionStorage — migrate once */
function migrateFromSessionStorage() {
  for (const [from, to] of [
    ['sdb_access_token', ACCESS_KEY],
    ['sdb_refresh_token', REFRESH_KEY],
  ]) {
    const legacy = sessionStorage.getItem(from);
    if (legacy && !localStorage.getItem(to)) {
      localStorage.setItem(to, legacy);
    }
    sessionStorage.removeItem(from);
  }
}

export function loadTokens() {
  migrateFromSessionStorage();
  return {
    accessToken: localStorage.getItem(ACCESS_KEY),
    refreshToken: localStorage.getItem(REFRESH_KEY),
  };
}

export function saveTokens(accessToken, refreshToken) {
  if (accessToken) localStorage.setItem(ACCESS_KEY, accessToken);
  else localStorage.removeItem(ACCESS_KEY);
  if (refreshToken) localStorage.setItem(REFRESH_KEY, refreshToken);
  else localStorage.removeItem(REFRESH_KEY);
}

export function clearTokens() {
  localStorage.removeItem(ACCESS_KEY);
  localStorage.removeItem(REFRESH_KEY);
  sessionStorage.removeItem('sdb_access_token');
  sessionStorage.removeItem('sdb_refresh_token');
}

export function isAccessTokenExpired(token, skewSeconds = 60) {
  if (!token) return true;
  try {
    const b64 = token.split('.')[1]?.replace(/-/g, '+').replace(/_/g, '/');
    if (!b64) return true;
    const payload = JSON.parse(atob(b64));
    if (!payload.exp) return false;
    return payload.exp <= Math.floor(Date.now() / 1000) + skewSeconds;
  } catch {
    return true;
  }
}

export async function refreshAuthSession(authUrl, refreshToken) {
  if (!refreshToken) return null;
  const res = await fetch(`${authUrl}/auth/refresh`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
    body: JSON.stringify({ refresh_token: refreshToken }),
  });
  if (!res.ok) return null;
  return res.json();
}

function tokensMatch(a, b) {
  return a.accessToken === b.accessToken && a.refreshToken === b.refreshToken;
}

/** Clear stored tokens only if they still match a snapshot (avoids wiping a fresh login). */
function clearTokensIfUnchanged(snapshot) {
  if (tokensMatch(loadTokens(), snapshot)) clearTokens();
}

export async function restoreAuthSession(authUrl) {
  const snapshot = loadTokens();
  let { accessToken, refreshToken } = snapshot;
  if (!accessToken && !refreshToken) return null;

  if ((!accessToken || isAccessTokenExpired(accessToken)) && refreshToken) {
    const session = await refreshAuthSession(authUrl, refreshToken);
    if (!session) {
      clearTokensIfUnchanged(snapshot);
      return null;
    }
    accessToken = session.access_token;
    refreshToken = session.refresh_token;
    saveTokens(accessToken, refreshToken);
  }

  if (!accessToken) {
    clearTokensIfUnchanged(snapshot);
    return null;
  }

  let res = await fetch(`${authUrl}/auth/me`, {
    headers: { Authorization: `Bearer ${accessToken}`, Accept: 'application/json' },
  });

  if (res.status === 401 && refreshToken) {
    const session = await refreshAuthSession(authUrl, refreshToken);
    if (!session) {
      clearTokensIfUnchanged(snapshot);
      return null;
    }
    accessToken = session.access_token;
    refreshToken = session.refresh_token;
    saveTokens(accessToken, refreshToken);
    res = await fetch(`${authUrl}/auth/me`, {
      headers: { Authorization: `Bearer ${accessToken}`, Accept: 'application/json' },
    });
  }

  if (!res.ok) {
    clearTokensIfUnchanged(snapshot);
    return null;
  }

  const body = await res.json();
  return { accessToken, refreshToken, user: body.user };
}
