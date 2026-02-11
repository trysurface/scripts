import { EmbedStyles } from '../embed-styles';
import { updateIframeWithOptions, IframeUtilsContext } from '../shared/iframe-utils';
import { getSlideoverContentHtml } from '../shared/html-templates';

export interface SlideoverContext extends IframeUtilsContext {
  surface_popup_reference: HTMLDivElement | null;
  initialized: boolean;
  embedStyles: EmbedStyles;
}

export function embedSlideover(context: SlideoverContext) {
  if (context.surface_popup_reference == null) {
    context.log(
      "error",
      `Cannot embed slideover because Surface embed type is ${(context as any).embed_type}`
    );
    return;
  }

  const surface_slideover = context.surface_popup_reference;
  const src = context._getSrcUrl();

  // Check if slideover already exists in DOM (cached)
  const existingSlideover = document.getElementById("surface-popup");
  if (existingSlideover && existingSlideover.querySelector("#surface-iframe")) {
    // Slideover already exists, just ensure iframe reference is set
    const iframe = existingSlideover.querySelector("#surface-iframe") as HTMLIFrameElement;
    if (iframe) {
      context.iframe = iframe;
      if (context._updateIframe) {
        context._updateIframe(iframe);
      }
    }
    return;
  }

  // Only create slideover if it doesn't exist
  surface_slideover.id = "surface-popup";
  surface_slideover.innerHTML = getSlideoverContentHtml(src);

  document.body.appendChild(surface_slideover);

  var style = document.createElement("style");
  style.innerHTML = context.embedStyles.getSlideoverStyles();
  document.head.appendChild(style);

  const iframe = surface_slideover.querySelector("#surface-iframe") as HTMLIFrameElement;
  const spinner = surface_slideover.querySelector(".surface-loading-spinner") as HTMLElement;
  const closeBtn = surface_slideover.querySelector(".close-btn-container") as HTMLElement;

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
  const closeBtnEl = surface_slideover.querySelector(".close-btn");
  if (closeBtnEl) {
    closeBtnEl.addEventListener("click", () => {
      hideSurfaceSlideover(context);
    });
  }

  window.addEventListener("click", (event) => {
    if (event.target == surface_slideover) {
      hideSurfaceSlideover(context);
    }
  });
}

export function showSurfaceSlideover(
  context: SlideoverContext,
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

  context.surface_popup_reference.style.display = "block";
  document.body.style.overflow = "hidden";

  setTimeout(function () {
    context.surface_popup_reference?.classList.add("active");
  }, 50);
}

export function hideSurfaceSlideover(context: SlideoverContext) {
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
  }, 300);
}
