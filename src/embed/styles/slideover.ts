import { getLoaderStyles } from "./loader";
import { getCloseButtonStyles } from "./close-button";

export function getSlideoverStyles(): string {
  return `
    ${getLoaderStyles()}

    #surface-popup {
      display: none;
      position: fixed;
      top: 0;
      left: 0;
      width: 100%;
      height: 100%;
      z-index: 99999;
      background-color: rgba(0,0,0,0.5);
      opacity: 0;
      transition: opacity 0.15s ease;
    }

    .surface-popup-content {
      position: absolute;
      top: 0;
      left: 0;
      transform: translateX(80%);
      width: 100%;
      height: 100%;
      background-color: transparent;
      padding: 0;
      box-shadow: 0px 0px 15px rgba(0,0,0,0.2);
      opacity: 0;
      transition: transform 0.2s ease, opacity 0.2s ease;
    }

    .surface-popup-content iframe {
      width: 100%;
      height: 100%;
    }

    #surface-popup.active {
      opacity: 1;
    }

    #surface-popup.active .surface-popup-content {
      transform: translateX(0%);
      opacity: 1;
    }

    ${getCloseButtonStyles("slideover")}
  `;
}
