export interface LeadData {
  leadId: string | null;
  leadSessionId: string | null;
  fingerprint: string;
  landingPageUrl?: string;
  expiry?: number;
}

export interface StorePayload {
  windowUrl: string;
  referrer: string;
  cookies: Record<string, string>;
  origin: string;
  questionIds: PartialFilledData;
  urlParams: Record<string, string>;
  surfaceLeadData: LeadData | null;
  userJourneyId: string | null;
}

export type EmbedTypeName =
  | "popup"
  | "slideover"
  | "widget"
  | "inline"
  | "input-trigger";

export type BreakpointName = "sm" | "md" | "lg" | "xl" | "2xl";

export type ResponsiveEmbedType = Partial<
  Record<BreakpointName, EmbedTypeName>
> & {
  default?: EmbedTypeName;
};

export type EmbedTypeInput = EmbedTypeName | ResponsiveEmbedType;

export interface WidgetStyles {
  position: "left" | "right";
  bottomMargin: string;
  sideMargin: string;
  size: string;
  backgroundColor: string;
  hoverScale: string;
  boxShadow: string;
}

export interface PopupDimensions {
  width: string;
  height: string;
}

export type PopupSize = "small" | "medium" | "large" | PopupDimensions;

export type PreloadOption = "true" | "false" | "pageLoad";

export interface SurfaceEmbedOptions {
  popupSize?: PopupSize;
  preload?: PreloadOption;
  enforceIDSelector?: boolean;
  widgetStyles?: Partial<WidgetStyles>;
  prefillData?: Record<string, string>;
}

export interface ExternalFormProps {
  serverBaseUrl?: string;
  siteId?: string;
}

export type PartialFilledData =
  | Array<Record<string, string>>
  | Record<string, never>;

export interface CookieOptions {
  path?: string;
  maxAge?: number;
  sameSite?: string;
  domain?: string;
}

export interface Logger {
  info: (message: string) => void;
  warn: (message: string) => void;
  error: (message: string) => void;
}

export interface JourneyTrackEvent {
  id?: string;
  data: {
    type: string;
    payload: Record<string, unknown>;
  };
  metadata: Record<string, unknown>;
}
