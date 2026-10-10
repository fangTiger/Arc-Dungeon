import { createRunRecord } from "./records.js";

export function notifyRunSettled(run, result, target = globalThis.window) {
  const record = createRunRecord(run, result);
  if (record && target?.dispatchEvent) {
    target.dispatchEvent(new CustomEvent("arc:run-settled", { detail: record }));
  }
  return record;
}
