/** Public store URLs are optional until the mobile listings are published. */
function storeUrl(value: string | undefined, store: "apple" | "google") {
  if (!value?.trim()) return undefined;
  try {
    const url = new URL(value.trim());
    if (url.protocol !== "https:" || url.username || url.password)
      return undefined;
    const valid =
      store === "apple"
        ? url.hostname === "apps.apple.com" && url.pathname.includes("/app/")
        : url.hostname === "play.google.com" &&
          url.pathname === "/store/apps/details" &&
          Boolean(url.searchParams.get("id"));
    return valid ? url.href : undefined;
  } catch {
    return undefined;
  }
}

const stores = [
  {
    id: "apple",
    name: "App Store",
    action: "Download on the",
    href: storeUrl(import.meta.env.VITE_APP_STORE_URL, "apple"),
  },
  {
    id: "google",
    name: "Google Play",
    action: "Get it on",
    href: storeUrl(import.meta.env.VITE_PLAY_STORE_URL, "google"),
  },
] as const;
export const hasStoreDownloads = stores.some((store) => store.href);

function StoreIcon({ store }: { store: "apple" | "google" }) {
  return store === "apple" ? (
    <svg
      aria-hidden="true"
      width="26"
      height="30"
      viewBox="0 0 24 28"
      fill="currentColor"
    >
      <path d="M19.3 14.6c0-3 2.4-4.5 2.5-4.6-1.4-2.1-3.6-2.4-4.4-2.4-1.9-.2-3.7 1.1-4.7 1.1s-2.5-1.1-4.1-1.1C6.5 7.6 4.5 8.8 3.4 10.6c-2.2 3.8-.6 9.5 1.5 12.6 1 1.5 2.2 3.1 3.8 3 1.5-.1 2.1-1 4-1s2.4 1 4.1 1c1.7 0 2.8-1.5 3.8-3 1.2-1.7 1.7-3.4 1.7-3.5-.1 0-3-1.2-3-5.1ZM16.3 5.6c.9-1.1 1.6-2.6 1.4-4.1-1.3.1-2.9.9-3.9 2-.8 1-1.6 2.5-1.4 4 1.5.1 3-.8 3.9-1.9Z" />
    </svg>
  ) : (
    <svg aria-hidden="true" width="27" height="30" viewBox="0 0 27 30">
      <path fill="#51C5E8" d="M2 1 16 15 2 29Z" />
      <path fill="#4ECB71" d="m2 1 17 10-3 4Z" />
      <path fill="#FFCE43" d="m19 11 7 4-7 4-4-4Z" />
      <path fill="#F45C64" d="m2 29 17-10-3-4Z" />
    </svg>
  );
}

export function StoreDownloads() {
  return (
    <div className="fl-store-downloads" aria-label="Get Fable for your phone">
      {stores.map((store) => {
        const content = (
          <>
            <StoreIcon store={store.id} />
            <span>
              <small>{store.href ? store.action : "Coming soon to"}</small>
              <strong>{store.name}</strong>
            </span>
          </>
        );
        return store.href ? (
          <a
            key={store.id}
            className="fl-store-badge"
            href={store.href}
            target="_blank"
            rel="noopener noreferrer"
            aria-label={`Download Fable from ${store.name}`}
          >
            {content}
          </a>
        ) : (
          <div
            key={store.id}
            className="fl-store-badge is-unavailable"
            aria-label={`Fable on ${store.name}, coming soon`}
          >
            {content}
          </div>
        );
      })}
    </div>
  );
}
