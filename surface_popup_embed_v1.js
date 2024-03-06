class SurfaceEmbed {
  constructor(src, embed_type, target_element_class) {
    this.embed_type = embed_type;
    this.target_element_class = target_element_class;

    this.src = new URL(src);
    this.src.searchParams.append("url", window.location.href);

    this.surface_popup_reference = null;
    if (embed_type == "popup") {
      this.surface_popup_reference = document.createElement("div");
      this.embedSurfaceForm = this.embedPopup;
      this.showSurfaceForm = this.showSurfacePopup;
      this.hideSurfaceForm = this.hideSurfacePopup;
    }

    if (embed_type == "slideover") {
      this.surface_popup_reference = document.createElement("div");
      this.embedSurfaceForm = this.embedSlideover;
      this.showSurfaceForm = this.showSurfaceSlideover;
      this.hideSurfaceForm = this.hideSurfaceSlideover;
    }
  }

  log(level, message) {
    const prefix = "Surface Embed :: ";
    const fullMessage = prefix + message;
    if (level == "info") {
      console.log(fullMessage);
    }
    if (level == "warn") {
      console.warn(fullMessage);
    }
    if (level == "error") {
      console.error(fullMessage);
    }
  }

  getUrlParams() {
    let params = {};
    let queryString = window.location.search.slice(1); // Remove the leading '?'
    let pairs = queryString.split("&");

    pairs.forEach((pair) => {
      let [key, value] = pair.split("=");
      params[decodeURIComponent(key)] = decodeURIComponent(value || "");
    });

    return params;
  }

  showSurfacePopup() {
    if (this.surface_popup_reference == null) {
      this.log(
        "warn",
        "Invalid showSurfaceForm invocation. Embed type is not popup or slideover"
      );
      return;
    }
    this.surface_popup_reference.style.display = "flex";
    document.body.style.overflow = "hidden"; // Prevent background scrolling

    const embedClient = this;
    // Timeout to allow the 'display' change to take effect before adding the animation class
    setTimeout(function () {
      embedClient.surface_popup_reference.classList.add("active");
    }, 50);
  }

  hideSurfacePopup() {
    if (this.surface_popup_reference == null) {
      this.log(
        "warn",
        "Invalid hideSurfaceForm invocation. Embed type is not popup or slideover"
      );
      return;
    }
    this.surface_popup_reference.classList.remove("active");
    document.body.style.overflow = "auto"; // Revert background scrolling behavior

    const embedClient = this;
    // After the animation completes, set display to none
    setTimeout(function () {
      embedClient.surface_popup_reference.style.display = "none";
    }, 300);
  }

  embedPopup() {
    if (this.surface_popup_reference == null) {
      this.log(
        "error",
        `Cannot embed popup because Surface embed type is ${this.embed_type}`
      );
    }

    const surface_popup = this.surface_popup_reference;
    const src = this.src.toString();
    const buttonElementClass = this.target_element_class;

    var buttonsByClass = document.querySelectorAll("." + buttonElementClass);
    var allButtons = Array.from(buttonsByClass);

    // Create the Popup HTML
    surface_popup.id = "surface-popup";

    surface_popup.innerHTML = `
    <div class="surface-popup-content">
        <iframe id="surface-iframe" src="${src}" frameborder="0" allowfullscreen></iframe>
        <div class="close-btn-container">
            <span class="close-btn">&times;</span>
        </div>
    </div>`;

    // Append to body
    document.body.appendChild(surface_popup);

    // Apply CSS
    var style = document.createElement("style");
    style.innerHTML = `
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
          background-color: rgba(0,0,0,0.8);
          opacity: 0;
          transition: opacity 0.3s ease;
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
          box-shadow: 0px 0px 15px rgba(0,0,0,0.2);
          opacity: 0;
          transition: transform 0.3s ease, opacity 0.3s ease;
      }

      .surface-popup-content iframe {
          width: 100%;
          height: 100%;
          border-radius: 15px;
      } 

      /* Adjust iframe dimensions for larger screens */
      @media (min-width: 481px) {
          .surface-popup-content {
            width: calc(100% - 80px);
            height: calc(100% - 80px);
          }
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
        display: flex;
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

      /* Adjust iframe dimensions for larger screens */
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

      /* Adjust iframe dimensions for larger screens */
      @media (min-width: 481px) {
          .close-btn {
            color: #ffffff; 
            font-size: 32px;
            margin-bottom: 0px;
            height: auto;
          }
      }
    `;
    document.head.appendChild(style);

    const embedClient = this;

    // Add Event Listeners
    allButtons.forEach(function (btn) {
      btn.addEventListener("click", function () {
        embedClient.showSurfacePopup();
      });
    });

    surface_popup
      .querySelector(".close-btn-container")
      .addEventListener("click", function () {
        embedClient.hideSurfacePopup();
      });

    window.addEventListener("click", function (event) {
      if (event.target == surface_popup) {
        embedClient.hideSurfacePopup();
      }
    });
  }

  showSurfaceSlideover() {
    if (this.surface_popup_reference == null) {
      this.log(
        "warn",
        "Invalid showSurfaceForm invocation. Embed type is not popup or slideover"
      );
      return;
    }
    this.surface_popup_reference.style.display = "block";
    document.body.style.overflow = "hidden"; // Prevent background scrolling

    const embedClient = this;
    // Timeout to allow the 'display' change to take effect before adding the animation class
    setTimeout(function () {
      embedClient.surface_popup_reference.classList.add("active");
    }, 50);
  }

  hideSurfaceSlideover() {
    if (this.surface_popup_reference == null) {
      this.log(
        "warn",
        "Invalid hideSurfaceForm invocation. Embed type is not popup or slideover"
      );
      return;
    }
    this.surface_popup_reference.classList.remove("active");
    document.body.style.overflow = "auto"; // Revert background scrolling behavior

    const embedClient = this;
    // After the animation completes, set display to none
    setTimeout(function () {
      embedClient.surface_popup_reference.style.display = "none";
    }, 300);
  }

  embedSlideover() {
    if (this.surface_popup_reference == null) {
      this.log(
        "error",
        `Cannot embed popup because Surface embed type is ${this.embed_type}`
      );
    }

    const surface_slideover = this.surface_popup_reference;
    const src = this.src.toString();
    const buttonElementClass = this.target_element_class;

    var buttonsByClass = document.querySelectorAll("." + buttonElementClass);
    var allButtons = Array.from(buttonsByClass);

    // Create the Popup HTML
    surface_slideover.id = "surface-popup";

    surface_slideover.innerHTML = `
    <div class="surface-popup-content">
        <span class="close-btn">&times;</span>
        <iframe id="surface-iframe" src="${src}" frameborder="0" allowfullscreen></iframe>
    </div>`;

    // Append to body
    document.body.appendChild(surface_slideover);

    // Apply CSS
    var style = document.createElement("style");
    style.innerHTML = `
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
          transition: opacity 0.3s ease;
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
          transition: transform 0.5s ease, opacity 0.5s ease;
      }

      .surface-popup-content iframe {
          width: 100%;
          height: 100%;
      }

      .close-btn {
          position: absolute;
          right: 20px;
          top: 10px;
          font-size: 24px;
          cursor: pointer;
      }

      #surface-popup.active {
          opacity: 1;
      }

      #surface-popup.active .surface-popup-content {
          transform: translateX(0%);
          opacity: 1;
      } 
    `;
    document.head.appendChild(style);

    const embedClient = this;

    // Add Event Listeners
    allButtons.forEach(function (btn) {
      btn.addEventListener("click", function () {
        embedClient.showSurfaceSlideover();
      });
    });

    surface_slideover
      .querySelector(".close-btn")
      .addEventListener("click", function () {
        embedClient.hideSurfaceSlideover();
      });

    window.addEventListener("click", function (event) {
      if (event.target == surface_slideover) {
        embedClient.hideSurfaceSlideover();
      }
    });
  }
}
