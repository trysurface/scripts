let SurfaceSharedSessionId: string | null = null;

export function SurfaceGenerateSessionId(): string {
  if (!SurfaceSharedSessionId) {
    SurfaceSharedSessionId =
      "session_" +
      Math.random().toString(36).substring(2, 15) +
      Math.random().toString(36).substring(2, 15);
  }
  return SurfaceSharedSessionId;
}
