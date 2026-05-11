export function getCloseButtonStyles(variant: "popup" | "slideover"): string {
  if (variant === "slideover") {
    return `
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
        margin: 0 0 6px 0;
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
    `;
  }

  return `
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
      margin: 0 0 6px 0;
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
