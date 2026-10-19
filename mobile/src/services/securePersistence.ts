interface SecureStorage {
  getItemAsync(key: string): Promise<string | null>;
  setItemAsync(key: string, value: string): Promise<void>;
  deleteItemAsync(key: string): Promise<void>;
}

/** Firebase persistence adapter. Serialized operations prevent refresh/logout races. */
export function createSecurePersistence(secure: SecureStorage) {
  let tail = Promise.resolve();
  const serialize = <T>(action: () => Promise<T>): Promise<T> => {
    const next = tail.then(action);
    tail = next.then(
      () => {},
      () => {},
    );
    return next;
  };
  const keyFor = (key: string) =>
    `fable_auth_${Array.from(key)
      .map((char) => char.codePointAt(0)!.toString(16).padStart(6, "0"))
      .join("")}`;
  const readCount = async (base: string) => {
    const count = Number(await secure.getItemAsync(`${base}_count`));
    return Number.isInteger(count) && count > 0 && count <= 64 ? count : 0;
  };
  return {
    getItem: (key: string) =>
      serialize(async (): Promise<string | null> => {
        const base = keyFor(key);
        const count = await readCount(base);
        if (!count) return null;
        const parts = await Promise.all(
          Array.from({ length: count }, (_, i) =>
            secure.getItemAsync(`${base}_${i}`),
          ),
        );
        return parts.some((part) => part === null) ? null : parts.join("");
      }),
    setItem: (key: string, value: string) =>
      serialize(async () => {
        const characters = Array.from(value);
        if (characters.length > 32_000)
          throw new Error(
            "The authentication session is too large to store securely.",
          );
        const base = keyFor(key);
        const previousCount = await readCount(base);
        const chunks: string[] = [];
        for (let i = 0; i < characters.length; i += 500)
          chunks.push(characters.slice(i, i + 500).join(""));
        if (!chunks.length) chunks.push("");
        // At most 2000 UTF-8 bytes/chunk; complete manifest is committed last.
        await secure.deleteItemAsync(`${base}_count`);
        for (let i = 0; i < chunks.length; i++)
          await secure.setItemAsync(`${base}_${i}`, chunks[i]);
        await secure.setItemAsync(`${base}_count`, String(chunks.length));
        await Promise.all(
          Array.from(
            { length: Math.max(previousCount - chunks.length, 0) },
            (_, i) => secure.deleteItemAsync(`${base}_${chunks.length + i}`),
          ),
        );
      }),
    removeItem: (key: string) =>
      serialize(async () => {
        const base = keyFor(key);
        await secure.deleteItemAsync(`${base}_count`);
        // Also remove shards left by an interrupted write with no manifest.
        await Promise.all(
          Array.from({ length: 64 }, (_, i) =>
            secure.deleteItemAsync(`${base}_${i}`),
          ),
        );
      }),
  };
}
