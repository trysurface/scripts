export interface EmbedOptions {
  popupSize?: string | { width?: string; height?: string };
  preload?: string;
  enforceIDSelector?: boolean;
  widgetStyles?: {
    position?: string;
    bottomMargin?: string;
    sideMargin?: string;
    size?: string;
    backgroundColor?: string;
    hoverScale?: string;
    boxShadow?: string;
  };
  prefillData?: Record<string, any>;
}

export interface WidgetStyle {
  position: string;
  bottomMargin: string;
  sideMargin: string;
  size: string;
  backgroundColor: string;
  hoverScale: string;
  boxShadow: string;
}

export const DEFAULT_WIDGET_STYLES: WidgetStyle = {
  position: "right",
  bottomMargin: "40px",
  sideMargin: "30px",
  size: "64px",
  backgroundColor: "#1a56db",
  hoverScale: "1.05",
  boxShadow: "0 6px 12px rgba(0,0,0,0.25)",
};

export const PRELOAD_OPTIONS = ["true", "false", "pageLoad"];

export const DEFAULT_POPUP_DIMENSIONS = {
  width: "calc(100% - 80px)",
  height: "calc(100% - 80px)",
};

export const POPUP_SIZE_PRESETS: Record<string, { width: string; height: string }> = {
  small: {
    width: "500px",
    height: "80%",
  },
  medium: {
    width: "70%",
    height: "80%",
  },
  large: DEFAULT_POPUP_DIMENSIONS,
};

export interface PopupDimensions {
  width: string;
  height: string;
}
