import { embedLog, LogLevel } from '../utils/logger';

export class EmbedTypeHandler {
  private log(level: LogLevel, message: string) {
    embedLog(level, message);
  }

  getEmbedType(embed_type: string | Record<string, string>): string | null {
    if (typeof embed_type === "string") {
      return embed_type;
    }

    if (typeof embed_type === "object") {
      return this.handleObjectEmbedType(embed_type);
    }

    this.log("error", "Invalid embed type: must be string or object");
    return null;
  }

  handleObjectEmbedType(embed_type: Record<string, string>): string {
    const embedTypeWithDefault = this.ensureDefaultEmbedType(embed_type);
    const matchingBreakpoint = this.getCurrentScreenBreakpoint();

    if (!matchingBreakpoint) {
      this.log(
        "info",
        "No matching breakpoint found, using default embed type"
      );
      return embedTypeWithDefault.default;
    }

    const [breakpointKey] = matchingBreakpoint;
    const embedType = embedTypeWithDefault[breakpointKey];

    if (embedType) {
      this.log(
        "info",
        `Using ${breakpointKey} breakpoint embed type: ${embedType}`
      );
      return embedType;
    }

    this.log(
      "warn",
      `No embed type defined for breakpoint: ${breakpointKey}, using default`
    );
    return embedTypeWithDefault.default;
  }

  ensureDefaultEmbedType(embed_type: Record<string, string>): Record<string, string> {
    if (!embed_type.default) {
      embed_type.default = embed_type.sm || Object.values(embed_type)[0];
    }
    return embed_type;
  }

  getCurrentScreenBreakpoint(): [string, number] | null {
    const width = window.innerWidth;
    const breakpoints = [
      { name: "2xl", min: 1536 },
      { name: "xl", min: 1280 },
      { name: "lg", min: 1024 },
      { name: "md", min: 768 },
      { name: "sm", min: 0 },
    ];

    const matchingBreakpoint = breakpoints.find((bp) => width >= bp.min);
    if (!matchingBreakpoint) return null;
    return [matchingBreakpoint.name, matchingBreakpoint.min];
  }
}
