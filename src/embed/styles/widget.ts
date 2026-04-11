import type { WidgetStyles } from "../../types";

export function getWidgetStyles(ws: WidgetStyles): string {
  return `
    #surface-widget-button {
      position: fixed;
      bottom: ${ws.bottomMargin};
      ${ws.position}: ${ws.sideMargin};
      z-index: 99998;
      cursor: pointer;
    }

    .widget-button-inner {
      width: ${ws.size};
      height: ${ws.size};
      border-radius: 50%;
      background-color: ${ws.backgroundColor};
      display: flex;
      align-items: center;
      justify-content: center;
      box-shadow: ${ws.boxShadow};
      transition: transform 0.2s ease;
    }

    .widget-button-inner:hover {
      transform: scale(${ws.hoverScale});
    }
  `;
}
