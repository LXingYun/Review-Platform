interface AiKeyState {
  keyId: string;
  apiKey: string;
  index: number;
  cooldownUntil: number;
  lastUsedAt: number;
}

export interface AiKeyLease {
  keyId: string;
  apiKey: string;
}

export interface AiKeyPool {
  acquire: () => AiKeyLease;
  reportRateLimited: (params: { keyId: string; cooldownMs: number }) => void;
  reportSuccess: (params: { keyId: string }) => void;
}

const defaultNow = () => Date.now();

const toKeyStates = (apiKeys: string[]): AiKeyState[] =>
  apiKeys.map((apiKey, index) => ({
    keyId: `key-${index + 1}`,
    apiKey,
    index,
    cooldownUntil: 0,
    lastUsedAt: 0,
  }));

export const createAiKeyPool = (params: {
  apiKeys: string[];
  now?: () => number;
}): AiKeyPool => {
  if (params.apiKeys.length === 0) {
    throw new Error("AI key pool requires at least one api key");
  }

  const now = params.now ?? defaultNow;
  const states = toKeyStates(params.apiKeys);
  const stateByKeyId = new Map(states.map((state) => [state.keyId, state]));

  let cursor = 0;

  const resolveLeaseState = () => {
    const timestamp = now();
    const size = states.length;

    for (let step = 0; step < size; step += 1) {
      const index = (cursor + step) % size;
      const candidate = states[index];
      if (candidate.cooldownUntil <= timestamp) {
        cursor = (index + 1) % size;
        return candidate;
      }
    }

    const fallback = states.slice().sort((left, right) => left.cooldownUntil - right.cooldownUntil)[0];
    cursor = (fallback.index + 1) % size;
    return fallback;
  };

  return {
    acquire: () => {
      const state = resolveLeaseState();
      state.lastUsedAt = now();

      return {
        keyId: state.keyId,
        apiKey: state.apiKey,
      };
    },
    reportRateLimited: ({ keyId, cooldownMs }) => {
      const state = stateByKeyId.get(keyId);
      if (!state) return;

      const cooldownUntil = now() + Math.max(0, cooldownMs);
      state.cooldownUntil = Math.max(state.cooldownUntil, cooldownUntil);
    },
    reportSuccess: ({ keyId }) => {
      const state = stateByKeyId.get(keyId);
      if (!state) return;
      if (state.cooldownUntil <= now()) {
        state.cooldownUntil = 0;
      }
    },
  };
};

let sharedPool:
  | {
      signature: string;
      pool: AiKeyPool;
    }
  | null = null;

const buildPoolSignature = (apiKeys: string[]) => apiKeys.join("||");

export const getSharedAiKeyPool = (params: {
  apiKeys: string[];
}): AiKeyPool => {
  const signature = buildPoolSignature(params.apiKeys);

  if (!sharedPool || sharedPool.signature !== signature) {
    sharedPool = {
      signature,
      pool: createAiKeyPool({ apiKeys: params.apiKeys }),
    };
  }

  return sharedPool.pool;
};

