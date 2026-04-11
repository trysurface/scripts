export async function sendBeacon(
  url: string,
  payload: Record<string, unknown>
): Promise<boolean> {
  try {
    const blob = new Blob([JSON.stringify(payload)], {
      type: "application/json",
    });

    if (navigator.sendBeacon) {
      const sent = navigator.sendBeacon(url, blob);
      if (sent) return true;
    }

    const response = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
      keepalive: true,
    });

    if (!response.ok) {
      throw new Error("Network response was not ok");
    }

    return true;
  } catch (error) {
    console.error("Beacon send failed:", error);
    return false;
  }
}
