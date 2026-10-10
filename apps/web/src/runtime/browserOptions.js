export function readBrowserOption(name) {
  if (typeof globalThis.location !== "undefined") {
    const value = new URLSearchParams(globalThis.location.search).get(name);
    if (value) {
      return value;
    }
  }

  try {
    return globalThis.localStorage?.getItem(name.replace(/^rialo/, "arc")) ?? null;
  } catch {
    return null;
  }
}
