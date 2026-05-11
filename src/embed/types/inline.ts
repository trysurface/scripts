import { injectStyle } from "../../utils/dom";
import type { SurfaceEmbed } from "../embed";

export function embedInline(this: SurfaceEmbed): void {
  if (this.surface_inline_reference == null) {
    this.log.warn({ message: "Surface Form could not find target div", response: { targetClass: this.target_element_class } });
  }

  const src = this._getSrcUrl();
  const targetDivs = this.inline_embed_references!;

  targetDivs.forEach((clientDiv) => {
    if (clientDiv.querySelector("#surface-inline-div")) return;

    const wrapper = document.createElement("div");
    wrapper.id = "surface-inline-div";

    const iframe = document.createElement("iframe");
    iframe.id = "surface-iframe";
    iframe.src = src;
    iframe.frameBorder = "0";
    iframe.allowFullscreen = true;

    if (!this.iframe) this.iframe = iframe;

    if (this.iframeInlineStyle && typeof this.iframeInlineStyle === "object") {
      Object.assign(iframe.style, this.iframeInlineStyle);
    }

    clientDiv.appendChild(wrapper);
    wrapper.appendChild(iframe);

    injectStyle(`
      #surface-inline-div { width: 100%; height: 100%; }
      #surface-inline-div iframe { width: 100%; height: 100%; }
    `);

    this.updateIframeWithOptions({}, wrapper);
  });
}
