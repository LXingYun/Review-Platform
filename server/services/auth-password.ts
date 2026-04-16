import { randomBytes, scryptSync, timingSafeEqual } from "node:crypto";

const saltLengthBytes = 16;
const hashLengthBytes = 64;

export const hashPassword = (password: string) => {
  const salt = randomBytes(saltLengthBytes).toString("base64");
  const hash = scryptSync(password, salt, hashLengthBytes).toString("base64");
  return { salt, hash };
};

export const verifyPassword = (password: string, salt: string, passwordHash: string) => {
  try {
    const expectedHash = Buffer.from(passwordHash, "base64");
    const actualHash = scryptSync(password, salt, expectedHash.length);
    return timingSafeEqual(actualHash, expectedHash);
  } catch {
    return false;
  }
};
