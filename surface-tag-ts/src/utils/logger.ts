// Shared logger utility for consistent logging across the application

export type LogLevel = 'info' | 'warn' | 'error' | 'log';

export interface LoggerConfig {
  prefix: string;
  debugMode?: boolean;
  getDebugMode?: () => boolean;
}

/**
 * Creates a logger function with the given prefix and debug mode configuration.
 * This eliminates duplicate log implementations across the codebase.
 */
export function createLogger(config: LoggerConfig) {
  return function log(level: LogLevel, message: any, ...additionalArgs: any[]) {
    const debugMode = config.getDebugMode ? config.getDebugMode() : config.debugMode;
    const fullMessage = additionalArgs.length > 0
      ? config.prefix + message + " " + additionalArgs.map(arg => 
          typeof arg === 'object' ? JSON.stringify(arg) : String(arg)
        ).join(' ')
      : config.prefix + message;
    
    if (level === "info" && debugMode) {
      console.log(fullMessage);
    }
    if (level === "warn") {
      console.warn(fullMessage);
    }
    if (level === "error") {
      console.error(fullMessage);
    }
    if (level === "log" && debugMode) {
      console.log(fullMessage);
    }
  };
}

/**
 * Standalone log function that checks SurfaceTagStore for debug mode.
 * Used by modules that don't have direct access to the store instance.
 */
export function embedLog(level: LogLevel, message: string) {
  const prefix = "Surface Embed :: ";
  const fullMessage = prefix + message;
  const store = (window as any).SurfaceTagStore;
  const debugMode = store?.debugMode;
  
  if (level === "info" && debugMode) {
    console.log(fullMessage);
  }
  if (level === "warn") {
    console.warn(fullMessage);
  }
  if (level === "error") {
    console.error(fullMessage);
  }
}
