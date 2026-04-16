import type express from "express";
import { resolveActorByToken } from "./auth-service";
import { forbidden, unauthorized } from "./http-error";

const parseBearerToken = (authorizationValue: string | undefined) => {
  if (!authorizationValue) {
    return null;
  }

  const [scheme, credentials] = authorizationValue.split(" ");
  if (!scheme || !credentials) {
    return null;
  }

  if (scheme.toLowerCase() !== "bearer") {
    return null;
  }

  return credentials.trim() || null;
};

export const requireAuth: express.RequestHandler = (req, _res, next) => {
  try {
    const token = parseBearerToken(req.header("authorization"));
    if (!token) {
      throw unauthorized("Unauthorized.");
    }

    const actor = resolveActorByToken(token);
    req.user = actor;
    req.authSessionToken = token;
    next();
  } catch (error) {
    next(error);
  }
};

export const requireAdmin: express.RequestHandler = (req, _res, next) => {
  if (!req.user) {
    next(unauthorized("Unauthorized."));
    return;
  }

  if (req.user.role !== "admin") {
    next(forbidden("Forbidden."));
    return;
  }

  next();
};
