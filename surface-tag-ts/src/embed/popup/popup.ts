import { EmbedStyles } from '../embed-styles';
import { updateIframeWithOptions, IframeUtilsContext } from '../shared/iframe-utils';
import { getPopupContentHtml } from '../shared/html-templates';

export interface PopupContext extends IframeUtilsContext {
  surface_popup_reference: HTMLDivElement | null;
  _popupSize: string | { width?: string; height?: string };
  initialized: boolean;
  styles: { popup: HTMLStyleElement | null; widget: HTMLStyleElement | null };
  embedStyles: EmbedStyles;
}

export function embedPopup(context: PopupContext) {
  if (context.surface_popup_reference == null) {
    context.log(
      "error",
      `Cannot embed popup because Surface embed type is ${(context as any).embed_type}`
    );
    return;
  }

  const surface_popup = context.surface_popup_reference;
  const src = context._getSrcUrl();

  // Check if popup already exists in DOM (cached) - this prevents recreating on every call
  const existingPopup = document.getElementById("surface-popup");
  if (existingPopup && existingPopup.querySelector("#surface-iframe")) {
    // Popup already exists, just ensure iframe reference is set
    const iframe = existingPopup.querySelector("#surface-iframe") as HTMLIFrameElement;
    if (iframe) {
      context.iframe = iframe;
      if (context._updateIframe) {
        context._updateIframe(iframe);
      }
    }
    return;
  }

  // Only create popup if it doesn't exist and not initialized yet
  if (!context.initialized) {
    surface_popup.id = "surface-popup";
    surface_popup.innerHTML = getPopupContentHtml(src);

    document.body.appendChild(surface_popup);

    const desktopPopupDimensions = context.embedStyles.getPopupDimensions(context._popupSize);

    if (!context.styles.popup) {
      const style = document.createElement("style");
      style.innerHTML = context.embedStyles.getPopupStyles(desktopPopupDimensions);
      document.head.appendChild(style);
      context.styles.popup = style;
    }

    const iframe = surface_popup.querySelector("#surface-iframe") as HTMLIFrameElement;
    const spinner = surface_popup.querySelector(".surface-loading-spinner") as HTMLElement;
    const closeBtn = surface_popup.querySelector(".close-btn-container") as HTMLElement;

    if (iframe) {
      context.iframe = iframe;
      // Use callbacks to update instance properties (for state preservation)
      if (context._updateIframe) {
        context._updateIframe(iframe);
      }
      context._cachedOptionsKey = JSON.stringify({});
      if (context._updateCachedOptionsKey) {
        context._updateCachedOptionsKey(JSON.stringify({}));
      }

      iframe.onload = () => {
        context._iframePreloaded = true;
        if (context._updateIframePreloaded) {
          context._updateIframePreloaded(true);
        }
        iframe.style.opacity = "1";
        if (spinner) spinner.style.display = "none";
        if (closeBtn) closeBtn.style.display = "flex";
      };
    }

    // Add event listeners only once
    const closeBtnContainer = surface_popup.querySelector(".close-btn-container");
    if (closeBtnContainer) {
      closeBtnContainer.addEventListener("click", () => {
        hideSurfacePopup(context);
      });
    }

    window.addEventListener("click", (event) => {
      if (event.target == surface_popup) {
        hideSurfacePopup(context);
      }
    });
  }
}

export function showSurfacePopup(
  context: PopupContext,
  options: Record<string, any> = {},
  fromInputTrigger: boolean = false
) {
  if (context.surface_popup_reference == null) {
    context.log(
      "warn",
      "Invalid shouldShowSurfaceForm invocation. Embed type is not popup or slideover"
    );
    return;
  }

  updateIframeWithOptions(context, options, context.surface_popup_reference);

  context.surface_popup_reference.style.display = "flex";
  document.body.style.overflow = "hidden";

  setTimeout(function () {
    context.surface_popup_reference?.classList.add("active");
  }, 50);
}

export function hideSurfacePopup(context: PopupContext) {
  if (context.surface_popup_reference == null) {
    context.log(
      "warn",
      "Invalid hideSurfaceForm invocation. Embed type is not popup or slideover"
    );
    return;
  }
  context.surface_popup_reference.classList.remove("active");
  document.body.style.overflow = "auto";

  setTimeout(function () {
    if (context.surface_popup_reference) {
      context.surface_popup_reference.style.display = "none";
    }
  }, 200);
}
