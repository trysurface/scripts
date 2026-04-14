import { getLoaderStyles } from "./loader";
import { getCloseButtonStyles } from "./close-button";
import type { PopupDimensions } from "../../types";

export function getPopupStyles(dimensions: PopupDimensions): string {
  return `
    ${getLoaderStyles()}

    #surface-popup {
      display: none;
      justify-content: center;
      align-items: center;
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
      position: relative;
      top: 0;
      left: 0;
      transform: scale(0.9);
      width: calc(100% - 20px);
      height: calc(100% - 20px);
      background-color: transparent;
      border-radius: 15px;
      opacity: 0;
      transition: transform 0.15s ease, opacity 0.15s ease;
    }

    .surface-popup-content iframe {
      width: 100%;
      height: 100%;
      border-radius: 15px;
    }

    @media (min-width: 481px) {
      .surface-popup-content {
        width: ${dimensions.width};
        height: ${dimensions.height};
        margin: 20px;
      }
    }

    #surface-iframe {
      transition: opacity 0.15s ease-in-out;
    }

    #surface-popup.active {
      opacity: 1;
    }

    #surface-popup.active .surface-popup-content {
      transform: scale(1);
      opacity: 1;
    }

    ${getCloseButtonStyles("popup")}
  `;
}
