import type {
  EmbedTypeInput,
  EmbedTypeName,
  ResponsiveEmbedType,
  BreakpointName,
} from "../types";
import type { Logger } from "../types";

const BREAKPOINTS: Array<{ name: BreakpointName; min: number }> = [
  { name: "2xl", min: 1536 },
  { name: "xl", min: 1280 },
  { name: "lg", min: 1024 },
  { name: "md", min: 768 },
  { name: "sm", min: 0 },
];

export function resolveEmbedType(
  input: EmbedTypeInput,
  log: Logger
): EmbedTypeName | null {
  if (typeof input === "string") return input;
  if (typeof input === "object") return resolveResponsiveType(input, log);

  log.error({ message: "Invalid embed type: must be string or object" });
  return null;
}

function resolveResponsiveType(
  config: ResponsiveEmbedType,
  log: Logger
): EmbedTypeName {
  const withDefault = ensureDefault(config);
  const breakpoint = getCurrentBreakpoint();

  if (!breakpoint) {
    log.info({ message: "No matching breakpoint, using default embed type" });
    return withDefault.default!;
  }

  const embedType = withDefault[breakpoint];
  if (embedType) {
    log.info({ message: "Using breakpoint embed type", response: { breakpoint, embedType } });
    return embedType;
  }

  log.warn({ message: "No embed type for breakpoint, using default", response: { breakpoint } });
  return withDefault.default!;
}

function ensureDefault(config: ResponsiveEmbedType): ResponsiveEmbedType {
  if (!config.default) {
    config.default = config.sm || Object.values(config)[0] as EmbedTypeName;
  }
  return config;
}

function getCurrentBreakpoint(): BreakpointName | null {
  const width = window.innerWidth;
  const match = BREAKPOINTS.find((bp) => width >= bp.min);
  return match?.name ?? null;
}
