const authTokenStorageKey = "auth:token";
export const authUnauthorizedEvent = "auth:unauthorized";

export const getAuthToken = () => {
  if (typeof window === "undefined") {
    return null;
  }

  try {
    return window.localStorage.getItem(authTokenStorageKey);
  } catch {
    return null;
  }
};

export const setAuthToken = (token: string) => {
  if (typeof window === "undefined") {
    return;
  }

  window.localStorage.setItem(authTokenStorageKey, token);
};

export const clearAuthToken = () => {
  if (typeof window === "undefined") {
    return;
  }

  window.localStorage.removeItem(authTokenStorageKey);
};

export const emitAuthUnauthorized = () => {
  if (typeof window === "undefined") {
    return;
  }

  window.dispatchEvent(new CustomEvent(authUnauthorizedEvent));
};
