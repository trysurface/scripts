import { updateIframeWithOptions, IframeUtilsContext } from '../shared/iframe-utils';

export interface InlineContext extends IframeUtilsContext {
  surface_inline_reference: HTMLElement | null;
  inline_embed_references: NodeListOf<Element>;
  target_element_class: string;
  iframeInlineStyle?: Partial<CSSStyleDeclaration>;
  log(level: string, message: string): void;
}

export function embedInline(
  context: InlineContext,
  options: Record<string, any> = {},
  fromInputTrigger: boolean = false
) {
  if (context.surface_inline_reference == null) {
    context.log(
      "warn",
      `Surface Form could not find target div with class ${context.target_element_class}`
    );
  }

  const src = context._getSrcUrl();
  const target_client_divs = context.inline_embed_references;

  target_client_divs.forEach((client_div) => {
    const existingDiv = client_div.querySelector("#surface-inline-div");
    if (existingDiv) {
      return;
    }

    const surface_inline_iframe_wrapper = document.createElement("div");
    surface_inline_iframe_wrapper.id = "surface-inline-div";

    const inline_iframe = document.createElement("iframe");
    inline_iframe.id = "surface-iframe";
    inline_iframe.src = src;
    inline_iframe.frameBorder = "0";
    inline_iframe.allowFullscreen = true;

    if (!context.iframe) {
      context.iframe = inline_iframe;
      // Use callback to update instance property
      if (context._updateIframe) {
        context._updateIframe(inline_iframe);
      }
    }

    if (
      context.iframeInlineStyle &&
      typeof context.iframeInlineStyle === "object"
    ) {
      Object.assign(inline_iframe.style, context.iframeInlineStyle);
    }

    client_div.appendChild(surface_inline_iframe_wrapper);
    surface_inline_iframe_wrapper.appendChild(inline_iframe);

    var style = document.createElement("style");
    style.innerHTML = `
          #surface-inline-div {
              width: 100%;
              height: 100%;
          }
          #surface-inline-div iframe {
              width: 100%;
              height: 100%;
          }
      `;
    document.head.appendChild(style);
    updateIframeWithOptions(context, options, surface_inline_iframe_wrapper);
  });
}

export function showSurfaceInline(
  context: InlineContext,
  options: Record<string, any> = {},
  fromInputTrigger: boolean = false
) {
  // For inline, showing means ensuring it's visible
  context.inline_embed_references.forEach((div) => {
    const inlineDiv = div.querySelector("#surface-inline-div") as HTMLElement;
    if (inlineDiv) {
      inlineDiv.style.display = "block";
    }
  });
}

export function hideSurfaceInline(context: InlineContext) {
  context.inline_embed_references.forEach((div) => {
    const inlineDiv = div.querySelector("#surface-inline-div") as HTMLElement;
    if (inlineDiv) {
      inlineDiv.style.display = "none";
    }
  });
}
