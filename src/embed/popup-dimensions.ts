import type { PopupDimensions, PopupSize } from "../types";

const DEFAULT_DIMENSIONS: PopupDimensions = {
  width: "calc(100% - 80px)",
  height: "calc(100% - 80px)",
};

const SIZE_PRESETS: Record<string, PopupDimensions> = {
  small: { width: "500px", height: "80%" },
  medium: { width: "70%", height: "80%" },
  large: DEFAULT_DIMENSIONS,
};

export function getPopupDimensions(size: PopupSize): PopupDimensions {
  if (typeof size === "string" && SIZE_PRESETS[size]) {
    return { ...SIZE_PRESETS[size] };
  }

  if (
    typeof size === "object" &&
    size !== null &&
    ("width" in size || "height" in size)
  ) {
    return {
      width: size.width || DEFAULT_DIMENSIONS.width,
      height: size.height || DEFAULT_DIMENSIONS.height,
    };
  }

  return { ...DEFAULT_DIMENSIONS };
}
