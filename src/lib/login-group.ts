import { AsyncLocalStorage } from "async_hooks";
import type { AccessGroupId } from "@/lib/access-catalog";

const loginGroupStore = new AsyncLocalStorage<AccessGroupId | null>();

export function runWithLoginGroup<T>(group: AccessGroupId | null, fn: () => T): T {
  return loginGroupStore.run(group, fn);
}

export function getLoginGroup(): AccessGroupId | null {
  return loginGroupStore.getStore() ?? null;
}
