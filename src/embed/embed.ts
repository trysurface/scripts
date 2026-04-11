import { VALID_EMBED_TYPES } from "../constants";
import { createLogger } from "../utils/logger";
import { onRouteChange } from "../utils/route-observer";
import { resolveEmbedType } from "./breakpoints";
import type { SurfaceStore } from "../store/store";
import type {
  Logger,
  EmbedTypeInput,
  EmbedTypeName,
  PopupSize,
  PreloadOption,
  SurfaceEmbedOptions,
  WidgetStyles,
} from "../types";

// Import mixin methods
import { updateIframeWithOptions } from "./iframe-updater";
import { setupClickHandlers } from "./click-handlers";
import { preloadIframe } from "./preload";
import { showSurfaceFormFromUrlParameter } from "./show-from-url";
import { embedInline, showSurfaceInline, hideSurfaceInline } from "./types/inline";
import { embedPopup, showSurfacePopup, hideSurfacePopup } from "./types/popup";
import { embedSlideover, showSurfaceSlideover, hideSurfaceSlideover } from "./types/slideover";
import { addWidgetButton } from "./types/widget";
import { formInputTriggerInitialize } from "./input-trigger/input-trigger";

const DEFAULT_WIDGET_STYLES: WidgetStyles = {
  position: "right",
  bottomMargin: "40px",
  sideMargin: "30px",
  size: "64px",
  backgroundColor: "#1a56db",
  hoverScale: "1.05",
  boxShadow: "0 6px 12px rgba(0,0,0,0.25)",
};

export class SurfaceEmbed {
  static _instances: SurfaceEmbed[] = [];

  src: URL;
  embed_type: EmbedTypeName | null;
  target_element_class: string;
  options: SurfaceEmbedOptions;
  log: Logger;
  store: SurfaceStore;

  initialized: boolean;
  iframe: HTMLIFrameElement | null;
  surface_popup_reference: HTMLDivElement | null;
  surface_inline_reference: HTMLDivElement | null;
  inline_embed_references: NodeListOf<Element> | null;
  iframeInlineStyle: Record<string, string> | null;
  styles: { popup: HTMLStyleElement | null; widget: HTMLStyleElement | null };
  widgetStyle: WidgetStyles;
  currentQuestionId: string | null;
  documentReferenceSelector: string;

  _popupSize: PopupSize;
  _preload: PreloadOption;
  _cachedSrcUrl: string | null;
  _cachedOptionsKey: string | null;
  _iframePreloaded: boolean;
  _previouslyFocusedElement: HTMLElement | null;
  _clickHandler: ((event: MouseEvent) => void) | null;
  _formHandlers: Array<{
    form: HTMLFormElement;
    submitHandler: (e: Event) => void;
    keydownHandler: (e: Event) => void;
  }> | null;
  _reinitTimeout: ReturnType<typeof setTimeout> | undefined;

  // Method declarations for prototype mixins
  declare updateIframeWithOptions: typeof updateIframeWithOptions;
  declare setupClickHandlers: typeof setupClickHandlers;
  declare preloadIframe: typeof preloadIframe;
  declare showSurfaceFormFromUrlParameter: typeof showSurfaceFormFromUrlParameter;
  declare embedInline: typeof embedInline;
  declare showSurfaceInline: typeof showSurfaceInline;
  declare hideSurfaceInline: typeof hideSurfaceInline;
  declare embedPopup: typeof embedPopup;
  declare showSurfacePopup: typeof showSurfacePopup;
  declare hideSurfacePopup: typeof hideSurfacePopup;
  declare embedSlideover: typeof embedSlideover;
  declare showSurfaceSlideover: typeof showSurfaceSlideover;
  declare hideSurfaceSlideover: typeof hideSurfaceSlideover;
  declare addWidgetButton: typeof addWidgetButton;
  declare formInputTriggerInitialize: typeof formInputTriggerInitialize;

  shouldShowSurfaceForm: (options?: Record<string, string>) => void;
  embedSurfaceForm: () => void;
  hideSurfaceForm: () => void;

  constructor(
    src: string,
    surface_embed_type: EmbedTypeInput,
    target_element_class: string,
    options: SurfaceEmbedOptions = {}
  ) {
    this.src = new URL(src);
    this.log = createLogger("Surface Embed");
    this.store = (window as unknown as Record<string, unknown>).SurfaceTagStore as SurfaceStore;
    this.currentQuestionId =
      document.currentScript?.getAttribute("data-question-id") || null;

    SurfaceEmbed._instances.push(this);

    if (this._isFormPreviewMode()) {
      this.log.info({ message: "Form is in preview mode" });
      this.src.searchParams.append("preview", "true");
    }

    this._popupSize = options.popupSize || "medium";
    this.documentReferenceSelector = options.enforceIDSelector ? "#" : ".";
    this.log.info({ message: "documentReferenceSelector set", response: { selector: this.documentReferenceSelector } });

    const preloadOptions: PreloadOption[] = ["true", "false", "pageLoad"];
    this._preload = preloadOptions.includes(options.preload as PreloadOption)
      ? options.preload!
      : "true";
    this.log.info({ message: "preload set", response: { preload: this._preload } });

    this.styles = { popup: null, widget: null };
    this.initialized = false;
    this.iframe = null;
    this.surface_popup_reference = null;
    this.surface_inline_reference = null;
    this.inline_embed_references = null;
    this.iframeInlineStyle = null;
    this._cachedSrcUrl = null;
    this._cachedOptionsKey = null;
    this._iframePreloaded = false;
    this._previouslyFocusedElement = null;
    this._clickHandler = null;
    this._formHandlers = null;
    this.target_element_class = target_element_class;
    this.options = options;
    this.options.popupSize = this._popupSize;

    this.widgetStyle = { ...DEFAULT_WIDGET_STYLES, ...(options.widgetStyles || {}) } as WidgetStyles;

    if (options.prefillData) {
      this.store.partialFilledData = Object.entries(options.prefillData).map(
        ([key, value]) => ({ [key]: value })
      );
    }

    this.embed_type = resolveEmbedType(surface_embed_type, this.log);
    this.shouldShowSurfaceForm = () => {};
    this.embedSurfaceForm = () => {};
    this.hideSurfaceForm = () => {};

    if (!this.embed_type || !(VALID_EMBED_TYPES as readonly string[]).includes(this.embed_type)) {
      this.log.error({ message: "Invalid embed type: must be string or object" });
      return;
    }

    if (!target_element_class) return;

    this.wireEmbedType();
    this.surface_popup_reference ??= document.createElement("div");
    this.setupClickHandlers();
    this.formInputTriggerInitialize();
    this.showSurfaceFormFromUrlParameter();
    this.preloadIframe();
    this.hideFormOnEsc();
    this.setupEmbedRouteDetection();
  }

  private wireEmbedType(): void {
    if (this.initialized) return;

    if (this.embed_type === "inline") {
      this.surface_inline_reference = null;
      this.inline_embed_references = document.querySelectorAll(
        this.documentReferenceSelector + this.target_element_class
      );
      this.embedSurfaceForm = this.embedInline;
      this.shouldShowSurfaceForm = this.showSurfaceInline;
      this.hideSurfaceForm = this.hideSurfaceInline;
      this.initializeEmbed();
    } else if (
      this.embed_type === "popup" ||
      this.embed_type === "widget" ||
      this.embed_type === "input-trigger"
    ) {
      this.embedSurfaceForm = this.embedPopup;
      this.shouldShowSurfaceForm = this.showSurfacePopup;
      this.hideSurfaceForm = this.hideSurfacePopup;
      if (this.embed_type === "widget") {
        this.surface_popup_reference ??= document.createElement("div");
        this.addWidgetButton();
      }
    } else if (this.embed_type === "slideover") {
      this.embedSurfaceForm = this.embedSlideover;
      this.shouldShowSurfaceForm = this.showSurfaceSlideover;
      this.hideSurfaceForm = this.hideSurfaceSlideover;
    }
  }

  initializeEmbed(): void {
    if (this.initialized) return;
    this.embedSurfaceForm();
    this.initialized = true;
  }

  showSurfaceForm(): void {
    if (!this.initialized) this.initializeEmbed();
    this.shouldShowSurfaceForm();
  }

  _getSrcUrl(): string {
    if (!this._cachedSrcUrl) {
      this._cachedSrcUrl = this.src.toString();
    }
    return this._cachedSrcUrl;
  }

  get popupSize(): PopupSize {
    return this._popupSize;
  }

  set popupSize(size: PopupSize) {
    const validSizes = ["small", "medium", "large"];
    if (
      !(typeof size === "string" && validSizes.includes(size)) &&
      !(typeof size === "object" && Object.keys(size).length > 0)
    ) {
      this.log.warn({ message: "Invalid popup size, using 'medium' instead", response: { size } });
      this._popupSize = "medium";
    } else {
      this._popupSize = size;
    }
  }

  private _isFormPreviewMode(): boolean {
    const params = this.store?.getUrlParams?.() ?? {};
    return params.surfaceDebug === "true";
  }

  private hideFormOnEsc(): void {
    document.addEventListener("keydown", (event) => {
      if (event.key === "Escape") this.hideSurfaceForm();
    });
  }

  private setupEmbedRouteDetection(): void {
    let currentUrl = window.location.href;

    const handleChange = () => {
      const newUrl = window.location.href;
      if (newUrl === currentUrl) return;
      currentUrl = newUrl;
      this.store.windowUrl = new URL(newUrl).toString();
      this.setupClickHandlers();
      this.formInputTriggerInitialize();
      this.log.info({ message: "Route changed, re-initialized handlers", response: { url: newUrl } });
    };

    onRouteChange(handleChange);

    if (typeof MutationObserver !== "undefined") {
      const observer = new MutationObserver((mutations) => {
        let shouldReinit = false;
        mutations.forEach((mutation) => {
          mutation.addedNodes.forEach((node) => {
            if (node.nodeType !== 1) return;
            const el = node as Element;
            if (
              el.matches?.("form.surface-form-handler") ||
              el.matches?.(this.documentReferenceSelector + this.target_element_class) ||
              el.querySelector?.("form.surface-form-handler") ||
              el.querySelector?.(this.documentReferenceSelector + this.target_element_class)
            ) {
              shouldReinit = true;
            }
          });
        });

        if (shouldReinit) {
          clearTimeout(this._reinitTimeout);
          this._reinitTimeout = setTimeout(() => {
            this.store.windowUrl = new URL(window.location.href).toString();
            this.setupClickHandlers();
            this.formInputTriggerInitialize();
            this.log.info({ message: "DOM changed, re-initialized handlers" });
          }, 100);
        }
      });

      if (document.body) {
        observer.observe(document.body, { childList: true, subtree: true });
      } else {
        const bodyObserver = new MutationObserver(() => {
          if (document.body) {
            observer.observe(document.body, { childList: true, subtree: true });
            bodyObserver.disconnect();
          }
        });
        bodyObserver.observe(document.documentElement, { childList: true });
      }
    }
  }
}

// Wire prototype mixins
Object.assign(SurfaceEmbed.prototype, {
  updateIframeWithOptions,
  setupClickHandlers,
  preloadIframe,
  showSurfaceFormFromUrlParameter,
  embedInline,
  showSurfaceInline,
  hideSurfaceInline,
  embedPopup,
  showSurfacePopup,
  hideSurfacePopup,
  embedSlideover,
  showSurfaceSlideover,
  hideSurfaceSlideover,
  addWidgetButton,
  formInputTriggerInitialize,
});
