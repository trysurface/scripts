// SurfaceTagStore will be available globally
declare const SurfaceTagStore: any;

import { EmbedOptions, WidgetStyle, DEFAULT_WIDGET_STYLES, PRELOAD_OPTIONS } from './embed-config';
import { EmbedTypeHandler } from './embed-types';
import { EmbedStyles } from './embed-styles';
import { embedPopup, showSurfacePopup, hideSurfacePopup, PopupContext } from './popup';
import { embedSlideover, showSurfaceSlideover, hideSurfaceSlideover, SlideoverContext } from './slideover';
import { addWidgetButton, WidgetContext } from './widget';
import { embedInline, showSurfaceInline, hideSurfaceInline, InlineContext } from './inline';
import { formInputTriggerInitialize, InputTriggerContext } from './input-trigger';
import { IframeUtilsContext } from './shared/iframe-utils';
import { createBaseIframeContext } from './shared/context-builder';

export class SurfaceEmbed {
  static _instances: SurfaceEmbed[] = [];

  src: URL;
  currentQuestionId: string | null;
  _popupSize: string | { width?: string; height?: string };
  documentReferenceSelector: string;
  _preload: string;
  styles: { popup: HTMLStyleElement | null; widget: HTMLStyleElement | null };
  initialized: boolean;
  widgetStyle: WidgetStyle;
  _cachedSrcUrl: string | null;
  embed_type: string | null;
  target_element_class: string;
  options: EmbedOptions;
  shouldShowSurfaceForm: () => void;
  embedSurfaceForm: () => void;
  hideSurfaceForm: () => void;
  surface_popup_reference: HTMLDivElement | null;
  surface_inline_reference: HTMLElement | null;
  inline_embed_references: NodeListOf<Element>;
  iframe: HTMLIFrameElement | null;
  iframeInlineStyle?: Partial<CSSStyleDeclaration>;
  _cachedOptionsKey: string | null;
  _iframePreloaded: boolean;
  _clickHandler: ((event: MouseEvent) => void) | null;
  _reinitTimeout: number | null;
  _formHandlers: Array<{ form: HTMLFormElement; submitHandler: (e: Event) => void; keydownHandler: (e: KeyboardEvent) => void }>;
  private embedTypeHandler: EmbedTypeHandler;
  private embedStyles: EmbedStyles;

  constructor(src: string, surface_embed_type: string | Record<string, string>, target_element_class: string, options: EmbedOptions = {}) {
    this.src = new URL(src);
    this.currentQuestionId = (document.currentScript as HTMLScriptElement)?.getAttribute("data-question-id") || null;
    SurfaceEmbed._instances.push(this);
    const isPreviewMode = this._isFormPreviewMode();

    if (isPreviewMode) {
      this.log("info", "Form is in preview mode");
      this.src.searchParams.append("preview", "true");
    }

    this._popupSize = options.popupSize || "medium";
    this.documentReferenceSelector = options.enforceIDSelector ? "#" : ".";

    this.log(
      "info",
      "documentReferenceSelector set to " + this.documentReferenceSelector
    );

    this._preload = PRELOAD_OPTIONS.includes(options.preload || "")
      ? (options.preload || "true")
      : "true";

    this.log("info", "preload set to " + this._preload);

    this.styles = {
      popup: null,
      widget: null,
    };

    this.initialized = false;

    this.widgetStyle = {
      ...DEFAULT_WIDGET_STYLES,
      ...(options.widgetStyles || {}),
    };

    // Initialize helper classes
    this.embedTypeHandler = new EmbedTypeHandler();
    this.embedStyles = new EmbedStyles(this.widgetStyle);

    if (options.prefillData) {
      const store = (window as any).SurfaceTagStore;
      if (store) {
        store.partialFilledData = Object.entries(
          options.prefillData
        ).map(([key, value]) => ({ [key]: value }));
      }
    }

    this._cachedSrcUrl = null;

    this.embed_type = this.embedTypeHandler.getEmbedType(surface_embed_type);
    this.target_element_class = target_element_class;
    this.options = options;
    this.options.popupSize = this._popupSize;
    this.shouldShowSurfaceForm = () => {};
    this.embedSurfaceForm = () => {};
    this.hideSurfaceForm = () => {};
    this.surface_popup_reference = null;
    this.surface_inline_reference = null;
    this.inline_embed_references = document.querySelectorAll("div");
    this.iframe = null;
    this._cachedOptionsKey = null;
    this._iframePreloaded = false;
    this._clickHandler = null;
    this._reinitTimeout = null;
    this._formHandlers = [];

    const store = (window as any).SurfaceTagStore;
    if (!store || !store.validEmbedTypes.includes(this.embed_type || "")) {
      this.log("error", "Invalid embed type: must be string or object");
    }

    if (
      this.embed_type &&
      store &&
      store.validEmbedTypes.includes(this.embed_type) &&
      target_element_class
    ) {
      if (this.embed_type === "inline") {
        if (this.initialized) return;
        this.surface_inline_reference = null;
        this.inline_embed_references = document.querySelectorAll(
          this.documentReferenceSelector + this.target_element_class
        );
        this.embedSurfaceForm = () => embedInline(this.getInlineContext());
        this.shouldShowSurfaceForm = () => showSurfaceInline(this.getInlineContext());
        this.hideSurfaceForm = () => hideSurfaceInline(this.getInlineContext());
        this.initializeEmbed();
      } else if (
        this.embed_type === "popup" ||
        this.embed_type === "widget" ||
        this.embed_type === "input-trigger"
      ) {
        if (this.initialized) return;
        this.embedSurfaceForm = () => embedPopup(this.getPopupContext());
        this.shouldShowSurfaceForm = () => showSurfacePopup(this.getPopupContext());
        this.hideSurfaceForm = () => hideSurfacePopup(this.getPopupContext());
        if (this.embed_type === "widget") {
          if (this.surface_popup_reference == null) {
            this.surface_popup_reference = document.createElement("div");
          }
          addWidgetButton(this.getWidgetContext());
        }
      } else if (this.embed_type === "slideover") {
        if (this.initialized) return;
        this.embedSurfaceForm = () => embedSlideover(this.getSlideoverContext());
        this.shouldShowSurfaceForm = () => showSurfaceSlideover(this.getSlideoverContext());
        this.hideSurfaceForm = () => hideSurfaceSlideover(this.getSlideoverContext());
      }

      if (this.surface_popup_reference == null) {
        this.surface_popup_reference = document.createElement("div");
      }
      this.setupClickHandlers();
      formInputTriggerInitialize(this.getInputTriggerContext());
      this.showSurfaceFormFromUrlParameter();
      this.preloadIframe();
      this._hideFormOnEsc();
      this._setupRouteChangeDetection();
    }
  }

  // Helper to get base iframe context (reduces repetition)
  private getBaseContext(): IframeUtilsContext {
    return createBaseIframeContext(this);
  }

  // Context getters for passing to module functions
  getPopupContext(): PopupContext {
    return {
      ...this.getBaseContext(),
      surface_popup_reference: this.surface_popup_reference,
      _popupSize: this._popupSize,
      initialized: this.initialized,
      styles: this.styles,
      embedStyles: this.embedStyles,
    };
  }

  getSlideoverContext(): SlideoverContext {
    return {
      ...this.getBaseContext(),
      surface_popup_reference: this.surface_popup_reference,
      initialized: this.initialized,
      embedStyles: this.embedStyles,
    };
  }

  getWidgetContext(): WidgetContext {
    return {
      initialized: this.initialized,
      embedStyles: this.embedStyles,
      showSurfaceForm: () => this.showSurfaceForm(),
      initializeEmbed: () => this.initializeEmbed(),
    };
  }

  getInlineContext(): InlineContext {
    return {
      ...this.getBaseContext(),
      surface_inline_reference: this.surface_inline_reference,
      inline_embed_references: this.inline_embed_references,
      target_element_class: this.target_element_class,
      iframeInlineStyle: this.iframeInlineStyle,
    };
  }

  getInputTriggerContext(): InputTriggerContext {
    return {
      currentQuestionId: this.currentQuestionId,
      initialized: this.initialized,
      getIframe: () => this.iframe,  // Dynamic getter for current iframe value
      _formHandlers: this._formHandlers,
      initializeEmbed: () => this.initializeEmbed(),
      showSurfaceForm: () => this.showSurfaceForm(),
    };
  }

  getIframeUtilsContext(): IframeUtilsContext {
    return this.getBaseContext();
  }

  _setupRouteChangeDetection() {
    let currentUrl = window.location.href;

    const handleRouteChange = () => {
      const newUrl = window.location.href;
      if (newUrl !== currentUrl) {
        currentUrl = newUrl;
        const store = (window as any).SurfaceTagStore;
        if (store) {
          store.windowUrl = new URL(window.location.href).toString();
        }

        this.setupClickHandlers();
        formInputTriggerInitialize(this.getInputTriggerContext());

        if (store && store.debugMode) {
          this.log("info", "Route changed, re-initialized handlers");
        }
      }
    };

    window.addEventListener("popstate", handleRouteChange);

    const originalPushState = history.pushState.bind(history);
    const originalReplaceState = history.replaceState.bind(history);

    history.pushState = function (data: any, unused: string, url?: string | URL | null) {
      originalPushState(data, unused, url);
      window.setTimeout(handleRouteChange, 0);
    };

    history.replaceState = function (data: any, unused: string, url?: string | URL | null) {
      originalReplaceState(data, unused, url);
      window.setTimeout(handleRouteChange, 0);
    };

    if (typeof MutationObserver !== "undefined") {
      const observer = new MutationObserver((mutations) => {
        let shouldReinit = false;

        mutations.forEach((mutation) => {
          mutation.addedNodes.forEach((node) => {
            if (node.nodeType === 1) {
              const element = node as Element;
              if (
                element.matches &&
                (element.matches("form.surface-form-handler") ||
                  element.matches(
                    this.documentReferenceSelector + this.target_element_class
                  ) ||
                  element.querySelector("form.surface-form-handler") ||
                  element.querySelector(
                    this.documentReferenceSelector + this.target_element_class
                  ))
              ) {
                shouldReinit = true;
              }
            }
          });
        });

        if (shouldReinit) {
          if (this._reinitTimeout) {
            clearTimeout(this._reinitTimeout);
          }
          this._reinitTimeout = window.setTimeout(() => {
            const newUrl = window.location.href;
            if (newUrl !== currentUrl) {
              currentUrl = newUrl;
              const store = (window as any).SurfaceTagStore;
              if (store) {
                store.windowUrl = new URL(
                  window.location.href
                ).toString();
              }
            }
            this.setupClickHandlers();
            formInputTriggerInitialize(this.getInputTriggerContext());

            const store = (window as any).SurfaceTagStore;
            if (store && store.debugMode) {
              this.log("info", "DOM changed, re-initialized handlers");
            }
          }, 100);
        }
      });

      if (document.body) {
        observer.observe(document.body, {
          childList: true,
          subtree: true,
        });
      } else {
        const bodyObserver = new MutationObserver(() => {
          if (document.body) {
            observer.observe(document.body, {
              childList: true,
              subtree: true,
            });
            bodyObserver.disconnect();
          }
        });
        bodyObserver.observe(document.documentElement, {
          childList: true,
        });
      }
    }
  }


  log(level: string, message: string) {
    const prefix = "Surface Embed :: ";
    const fullMessage = prefix + message;
    const store = (window as any).SurfaceTagStore;
    if (level === "info" && store && store.debugMode) {
      console.log(fullMessage);
    }
    if (level === "warn") {
      console.warn(fullMessage);
    }
    if (level === "error") {
      console.error(fullMessage);
    }
  }

  setupClickHandlers() {
    if (this._clickHandler) {
      document.removeEventListener("click", this._clickHandler);
    }

    this._clickHandler = (event: MouseEvent) => {
      const clickedButton = (event.target as Element)?.closest(
        this.documentReferenceSelector + this.target_element_class
      );
      if (clickedButton) {
        if (!this.initialized) {
          this.initializeEmbed();
          this.shouldShowSurfaceForm();
        } else {
          this.shouldShowSurfaceForm();
        }
      }
    };

    document.addEventListener("click", this._clickHandler);
  }

  initializeEmbed() {
    if (this.initialized) return;
    if (this.embedSurfaceForm) {
      this.embedSurfaceForm();
    }

    this.initialized = true;
  }

  preloadIframe() {
    if (this.initialized || this._preload === "false") return;

    if (this.initializeEmbed && this._preload === "true") {
      const initWhenIdle = () => {
        if (this.initialized) return;
        if ("requestIdleCallback" in window) {
          (window as any).requestIdleCallback(
            () => {
              if (!this.initialized) {
                this.initializeEmbed();
              }
            },
            { timeout: 3000 }
          );
        } else {
          setTimeout(() => {
            if (!this.initialized) {
              this.initializeEmbed();
            }
          }, 100);
        }
      };

      if (document.readyState === "complete") {
        initWhenIdle();
      } else {
        window.addEventListener("load", initWhenIdle, { once: true });
      }
    }

    if (this.initializeEmbed && this._preload === "pageLoad") {
      this.initializeEmbed();
    }
  }

  _getSrcUrl(): string {
    if (!this._cachedSrcUrl) {
      this._cachedSrcUrl = this.src.toString();
    }
    return this._cachedSrcUrl;
  }


  // Show Surface Form
  showSurfaceForm() {
    if (!this.initialized) {
      this.initializeEmbed();
    }

    this.shouldShowSurfaceForm();
  }

  // Show Surface Form from URL parameter
  showSurfaceFormFromUrlParameter() {
    try {
      const store = (window as any).SurfaceTagStore;
      if (store) {
        const paramsFromStore = store.getUrlParams();
        if (!paramsFromStore) return;
        if (paramsFromStore.showSurfaceForm === "true") {
          this.showSurfaceForm();
        }
      }
    } catch (error) {
      this.log(
        "error",
        `Failed to show Surface Form from URL parameter: ${error}`
      );
    }
  }

  get popupSize() {
    return this._popupSize;
  }

  set popupSize(size: string | { width?: string; height?: string }) {
    if (
      !["small", "medium", "large"].includes(size as string) &&
      !(typeof size === "object" && Object.keys(size).length > 0)
    ) {
      this.log("warn", "Invalid popup size. Using 'medium' instead.");
      this._popupSize = "medium";
    } else {
      this._popupSize = size;
    }
  }

  _isFormPreviewMode(): boolean {
    const store = (window as any).SurfaceTagStore;
    if (store) {
      const params = store.getUrlParams();
      const previewMode = params?.surfaceDebug === "true";
      return previewMode;
    }
    return false;
  }

  _hideFormOnEsc() {
    document.addEventListener("keydown", (event) => {
      if (event.key === "Escape") {
        this.hideSurfaceForm();
      }
    });
  }

}
