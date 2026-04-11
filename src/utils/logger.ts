import { isDebugMode } from "./debug";
import type { Logger } from "../types";

export function createLogger(prefix: string): Logger {
  const fmt = (msg: string | Record<string, unknown>) => {
    if (typeof msg === "string") {
      return `${prefix} :: ${msg}`;
    }
    return {
      prefix,
      ...msg,
    }
  }

  return {
    info: (msg) => {
      if (isDebugMode()) console.log(fmt(msg));
    },
    warn: (msg) => console.warn(fmt(msg)),
    error: (msg) => console.error(fmt(msg)),
  };
}
