import { WidgetStyle, DEFAULT_POPUP_DIMENSIONS, POPUP_SIZE_PRESETS, PopupDimensions } from './embed-config';

export class EmbedStyles {
  widgetStyle: WidgetStyle;

  constructor(widgetStyle: WidgetStyle) {
    this.widgetStyle = widgetStyle;
  }

  getLoaderStyles(): string {
    return `
      .surface-loading-spinner {
        height: 5px;
        width: 5px;
        color: #fff;
        box-shadow: -10px -10px 0 5px,
                    -10px -10px 0 5px,
                    -10px -10px 0 5px,
                    -10px -10px 0 5px;
        animation: loader-38 6s infinite;
      }

      @keyframes loader-38 {
        0% {
          box-shadow: -10px -10px 0 5px,
                      -10px -10px 0 5px,
                      -10px -10px 0 5px,
                      -10px -10px 0 5px;
        }
        8.33% {
          box-shadow: -10px -10px 0 5px,
                      10px -10px 0 5px,
                      10px -10px 0 5px,
                      10px -10px 0 5px;
        }
        16.66% {
          box-shadow: -10px -10px 0 5px,
                      10px -10px 0 5px,
                      10px 10px 0 5px,
                      10px 10px 0 5px;
        }
        24.99% {
          box-shadow: -10px -10px 0 5px,
                      10px -10px 0 5px,
                      10px 10px 0 5px,
                      -10px 10px 0 5px;
        }
        33.32% {
          box-shadow: -10px -10px 0 5px,
                      10px -10px 0 5px,
                      10px 10px 0 5px,
                      -10px -10px 0 5px;
        }
        41.65% {
          box-shadow: 10px -10px 0 5px,
                      10px -10px 0 5px,
                      10px 10px 0 5px,
                      10px -10px 0 5px;
        }
        49.98% {
          box-shadow: 10px 10px 0 5px,
                    10px 10px 0 5px,
                    10px 10px 0 5px,
                    10px 10px 0 5px;
        }
        58.31% {
          box-shadow: -10px 10px 0 5px,
                      -10px 10px 0 5px,
                      10px 10px 0 5px,
                      -10px 10px 0 5px;
        }
        66.64% {
          box-shadow: -10px -10px 0 5px,
                      -10px -10px 0 5px,
                      10px 10px 0 5px,
                      -10px 10px 0 5px;
        }
        74.97% {
          box-shadow: -10px -10px 0 5px,
                      10px -10px 0 5px,
                      10px 10px 0 5px,
                      -10px 10px 0 5px;
        }
        83.3% {
          box-shadow: -10px -10px 0 5px,
                      10px 10px 0 5px,
                      10px 10px 0 5px,
                      -10px 10px 0 5px;
        }
        91.63% {
          box-shadow: -10px -10px 0 5px,
                      -10px 10px 0 5px,
                      -10px 10px 0 5px,
                      -10px 10px 0 5px;
        }
        100% {
          box-shadow: -10px -10px 0 5px,
                      -10px -10px 0 5px,
                      -10px -10px 0 5px,
                      -10px -10px 0 5px;
        }
      }

      @keyframes spin {
          0% { transform: translate(-50%, -50%) rotate(0deg); }
          100% { transform: translate(-50%, -50%) rotate(360deg); }
      }
    `;
  }

  getPopupStyles(desktopPopupDimensions: PopupDimensions): string {
    return `
      ${this.getLoaderStyles()}
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
          width: ${desktopPopupDimensions.width};
          height: ${desktopPopupDimensions.height};
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

      .close-btn-container {
        position: absolute;
        display: none;
        justify-content: center;
        align-items: center;
        top: 6px;
        right: 8px;
        background: #ffffff;
        border: none;
        border-radius: 50%;
        width: 24px;
        height: 24px;
        opacity: .75;
      }

      @media (min-width: 481px) {
        .close-btn-container {
          top: -34px;
          right: 0;
          background: none;
          border: none;
          border-radius: 0;
        }
      }

      .close-btn {
        display: block;
        padding: 0;
        margin: 0;
        margin-bottom: 6px;
        font-size: 20px;
        font-weight: normal;
        line-height: 24px;
        text-align: center;
        text-transform: none;
        cursor: pointer;
        transition: opacity .25s ease-in-out;
        text-decoration: none;
        color: #000;
        height: 20px;
      }

      @media (min-width: 481px) {
        .close-btn {
          color: #ffffff;
          font-size: 32px;
          margin-bottom: 0px;
          height: auto;
        }
      }
    `;
  }

  getWidgetStyles(): string {
    return `
      ${this.getLoaderStyles()}
      #surface-widget-button {
        position: fixed;
        bottom: ${this.widgetStyle.bottomMargin};
        ${this.widgetStyle.position}: ${this.widgetStyle.sideMargin};
        z-index: 99998;
        cursor: pointer;
      }

      .widget-button-inner {
        width: ${this.widgetStyle.size};
        height: ${this.widgetStyle.size};
        border-radius: 50%;
        background-color: ${this.widgetStyle.backgroundColor};
        display: flex;
        align-items: center;
        justify-content: center;
        box-shadow: ${this.widgetStyle.boxShadow};
        transition: transform 0.2s ease;
      }

      .widget-button-inner:hover {
        transform: scale(${this.widgetStyle.hoverScale});
      }
    `;
  }

  getSlideoverStyles(): string {
    return `
      ${this.getLoaderStyles()}
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

      .close-btn-container {
        position: absolute;
        right: 20px;
        top: 10px;
        z-index: 100000;
        display: none;
        justify-content: center;
        align-items: center;
        background: #ffffff;
        border: none;
        border-radius: 50%;
        width: 24px;
        height: 24px;
        opacity: .75;
      }

      .close-btn {
        display: block;
        padding: 0;
        margin: 0;
        margin-bottom: 6px;
        font-size: 20px;
        font-weight: normal;
        line-height: 24px;
        text-align: center;
        text-transform: none;
        cursor: pointer;
        transition: opacity .25s ease-in-out;
        text-decoration: none;
        color: #000;
        height: 20px;
      }

      #surface-popup.active {
        opacity: 1;
      }

      #surface-popup.active .surface-popup-content {
        transform: translateX(0%);
        opacity: 1;
      }
    `;
  }

  getPopupDimensions(popupSize: string | { width?: string; height?: string }): PopupDimensions {
    if (typeof popupSize === "string" && POPUP_SIZE_PRESETS[popupSize]) {
      return { ...POPUP_SIZE_PRESETS[popupSize] };
    }

    if (
      typeof popupSize === "object" &&
      popupSize !== null &&
      (popupSize.width || popupSize.height)
    ) {
      return {
        width: popupSize.width || DEFAULT_POPUP_DIMENSIONS.width,
        height: popupSize.height || DEFAULT_POPUP_DIMENSIONS.height,
      };
    }

    return { ...DEFAULT_POPUP_DIMENSIONS };
  }
}
