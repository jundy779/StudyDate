import * as SecureStore from "expo-secure-store";

const CHUNK_SIZE = 1800;
const MAX_CHUNKS = 32;

function metaKey(key: string) {
  return `${key}.__chunks`;
}

function chunkKey(key: string, index: number) {
  return `${key}.__chunk_${index}`;
}

async function removeChunks(key: string) {
  const rawCount = await SecureStore.getItemAsync(metaKey(key));
  const count = Number(rawCount ?? 0);

  if (Number.isInteger(count) && count > 0 && count <= MAX_CHUNKS) {
    await Promise.all(
      Array.from({ length: count }, (_, index) =>
        SecureStore.deleteItemAsync(chunkKey(key, index)),
      ),
    );
  }

  await SecureStore.deleteItemAsync(metaKey(key));
}

export const secureSessionStorage = {
  async getItem(key: string) {
    const directValue = await SecureStore.getItemAsync(key);
    if (directValue !== null) return directValue;

    const rawCount = await SecureStore.getItemAsync(metaKey(key));
    const count = Number(rawCount ?? 0);
    if (!Number.isInteger(count) || count < 1 || count > MAX_CHUNKS) return null;

    const chunks = await Promise.all(
      Array.from({ length: count }, (_, index) =>
        SecureStore.getItemAsync(chunkKey(key, index)),
      ),
    );

    return chunks.some((chunk) => chunk === null) ? null : chunks.join("");
  },

  async setItem(key: string, value: string) {
    await SecureStore.deleteItemAsync(key);
    await removeChunks(key);

    if (value.length <= CHUNK_SIZE) {
      await SecureStore.setItemAsync(key, value);
      return;
    }

    const chunks = value.match(new RegExp(`.{1,${CHUNK_SIZE}}`, "gs")) ?? [];
    if (chunks.length > MAX_CHUNKS) {
      throw new Error("Sesi terlalu besar untuk disimpan dengan aman di perangkat.");
    }

    await Promise.all(
      chunks.map((chunk, index) =>
        SecureStore.setItemAsync(chunkKey(key, index), chunk),
      ),
    );
    await SecureStore.setItemAsync(metaKey(key), String(chunks.length));
  },

  async removeItem(key: string) {
    await Promise.all([SecureStore.deleteItemAsync(key), removeChunks(key)]);
  },
};
