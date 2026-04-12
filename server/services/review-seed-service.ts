const minSeed = 1;
const maxSeed = 2_147_483_646;
const fnvOffsetBasis = 2_166_136_261;
const fnvPrime = 16_777_619;

const normalizeProjectId = (projectId: string) => projectId.trim();

const hashProjectId = (projectId: string) => {
  let hash = fnvOffsetBasis;

  for (const char of normalizeProjectId(projectId)) {
    hash ^= char.charCodeAt(0);
    hash = Math.imul(hash, fnvPrime) >>> 0;
  }

  return hash;
};

export const toDeterministicSeed = (projectId: string) => {
  const normalizedProjectId = normalizeProjectId(projectId);
  if (!normalizedProjectId) {
    return minSeed;
  }

  return (hashProjectId(normalizedProjectId) % maxSeed) + minSeed;
};

