import type { SurfaceEmbed } from "./embed";

export function showSurfaceFormFromUrlParameter(this: SurfaceEmbed): void {
  try {
    const params = this.store.getUrlParams();
    if (params?.showSurfaceForm === "true") {
      this.showSurfaceForm();
    }
  } catch (error) {
    this.log.error({ message: "Failed to show Surface Form from URL parameter", error });
  }
}
