let SurfaceSyncCookieHappenedOnce = false;
function SurfaceSyncCookie(visitorId) {
    const endpoint = new URL("https://a.usbrowserspeed.com/cs");
    var pid =
        "b3752b5f7f17d773b265c2847b23ffa444cac7db2af8a040c341973a6704a819";
    endpoint.searchParams.append("pid", pid);
    endpoint.searchParams.append("puid", visitorId);

    if (SurfaceSyncCookieHappenedOnce == false) {
        fetch(endpoint.href, {
            mode: "no-cors",
            credentials: "include",
        });
        SurfaceSyncCookieHappenedOnce = true;
    }
}

class SurfaceEmbed {
    constructor(src, embed_type, target_element_class, options = {}) {
        this.enableWidget = options.enableWidget || false;
        const defaultWidgetStyles = {
            position: 'right',
            bottomMargin: '40px',
            sideMargin: '30px',
            size: '64px',
            backgroundColor: '#1a56db',
            hoverScale: '1.05',
            boxShadow: '0 6px 12px rgba(0,0,0,0.2)'
        };

        this.widgetStyle = {
            ...defaultWidgetStyles,
            ...(options.widgetStyles || {})
        };

        if (!src) {
            console.error(
                `Surface :: Invalid src. Surface src url must not be null nor empty`
            );
        } else if (
            embed_type != "inline" &&
            embed_type != "slideover" &&
            embed_type != "popup" &&
            embed_type != "widget"
        ) {
            console.error(
                `Surface :: Invalid embed type: ${embed_type}. Embed Type must be inline, slideover, popup, or widget`
            );
        } else if (!target_element_class && embed_type !== "widget") {
            console.error(
                `Surface :: Invalid target element class. Target element class must not be null nor empty`
            );
        }

        this.embed_type = embed_type;
        this.target_element_class = target_element_class;

        SurfaceSyncCookie(src);
        this.src = new URL(src);
        this.src.searchParams.append("url", window.location.href);
        this.surface_popup_reference = null;
        this.inline_embed_references = null;
        this.iframeInlineStyle = null;
        this.popupSize = null;

        // For popup or widget, we create a DIV (for the iframe)
        if (embed_type == "popup" || embed_type == "widget") {
            this.surface_popup_reference = document.createElement("div");
            this.embedSurfaceForm =
                embed_type == "widget" ? this.embedWidget : this.embedPopup;
            this.showSurfaceForm = this.showSurfacePopup;
            this.hideSurfaceForm = this.hideSurfacePopup;

            // If widget, add the floating button
            if (embed_type == "widget") {
                this.addWidgetButton();
            }
        }

        // For slideover, we also create the DIV
        if (embed_type == "slideover") {
            this.surface_popup_reference = document.createElement("div");
            this.embedSurfaceForm = this.embedSlideover;
            this.showSurfaceForm = this.showSurfaceSlideover;
            this.hideSurfaceForm = this.hideSurfaceSlideover;
        }

        // For inline, we select the target inline elements
        if (embed_type == "inline") {
            this.inline_embed_references = document.querySelectorAll(
                "." + this.target_element_class
            );
            this.embedSurfaceForm = this.embedInline;
            this.showSurfaceForm = () => {};
            this.hideSurfaceForm = () => {};
        }

        // --------------------------------------------------
        // KEY CHANGE: Event Delegation for popup/slideover
        // --------------------------------------------------
        // Instead of looping over each .surface-form-button inside embedPopup or embedSlideover,
        // we attach one document-level click listener. If the user clicks an element with
        // the target_element_class, we open the popup/slideover.

        if (
            (embed_type === "popup" || embed_type === "slideover") &&
            target_element_class
        ) {
            document.addEventListener("click", (event) => {
                // Check if the click was on an element with our target class
                const clickedButton = event.target.closest("." + target_element_class);
                if (clickedButton) {
                    if (embed_type === "popup") {
                        this.showSurfacePopup();
                    } else if (embed_type === "slideover") {
                        this.showSurfaceSlideover();
                    }
                }
            });
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

    // --- Inline embedding ---
    embedInline() {
        if (
            this.inline_embed_references == null ||
            this.inline_embed_references.length <= 0
        ) {
            this.log(
                "warn",
                `Surface Form could not find target div with class ${this.target_element_class}`
            );
        }

        const src = this.src.toString();
        const target_client_divs = this.inline_embed_references;

        target_client_divs.forEach((client_div) => {
            const surface_inline_iframe_wrapper = document.createElement("div");
            surface_inline_iframe_wrapper.id = "surface-inline-div";

            const inline_iframe = document.createElement("iframe");
            inline_iframe.id = "surface-iframe";
            inline_iframe.src = src;
            inline_iframe.frameBorder = "0";
            inline_iframe.allowFullscreen = true;

            // Optional inline style
            if (
                this.iframeInlineStyle &&
                typeof this.iframeInlineStyle === "object"
            ) {
                Object.assign(inline_iframe.style, this.iframeInlineStyle);
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
        });
    }

    // --- Common popup logic ---
    showSurfacePopup(options = {}) {
        if (this.surface_popup_reference == null) {
            this.log(
                "warn",
                "Invalid showSurfaceForm invocation. Embed type is not popup or slideover"
            );
            return;
        }

        // If the user passed in form data or parameters, apply them to the iframe URL
        if (Object.keys(options).length > 0) {
            Object.keys(options).forEach(key => {
                this.src.searchParams.set(key, options[key]);
            });

            const iframe = this.surface_popup_reference.querySelector("#surface-iframe");
            if (iframe) {
                // Smoothly hide the iframe
                iframe.style.opacity = "0";
                setTimeout(() => {
                    iframe.src = this.src.toString(); // Update src
                    iframe.onload = () => {
                        iframe.style.opacity = "1";
                    };
                }, 100);
            }
        }

        this.surface_popup_reference.style.display = "flex";
        document.body.style.overflow = "hidden"; // Prevent background scrolling

        const embedClient = this;
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
        document.body.style.overflow = "auto";

        const embedClient = this;
        setTimeout(function () {
            embedClient.surface_popup_reference.style.display = "none";
        }, 300);
    }

    // --- The popup embed method ---
    embedPopup() {
        if (this.surface_popup_reference == null) {
            this.log(
                "error",
                `Cannot embed popup because Surface embed type is ${this.embed_type}`
            );
        }

        const surface_popup = this.surface_popup_reference;
        const src = this.src.toString();

        // Create the Popup HTML
        surface_popup.id = "surface-popup";
        surface_popup.innerHTML = `
            <div class="surface-popup-content">
                <iframe id="surface-iframe" src="${src}" frameborder="0" allowfullscreen></iframe>
                <div class="close-btn-container">
                    <span class="close-btn">&times;</span>
                </div>
            </div>
        `;

        // Append to body
        document.body.appendChild(surface_popup);

        const desktopPopupDimensions = {
            width: "calc(100% - 80px)",
            height: "calc(100% - 80px)",
        };

        if (this.popupSize != null && this.popupSize === "small") {
            desktopPopupDimensions.width = "50%";
            desktopPopupDimensions.height = "60%";
        } else if (this.popupSize == null || this.popupSize === "medium") {
            desktopPopupDimensions.width = "70%";
            desktopPopupDimensions.height = "80%";
        } else if (this.popupSize != null && this.popupSize === "large") {
            desktopPopupDimensions.width = "calc(100% - 80px)";
            desktopPopupDimensions.height = "calc(100% - 80px)";
        }

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
              background-color: rgba(0,0,0,0.5);
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

          @media (min-width: 481px) {
              .surface-popup-content {
                  width: ${desktopPopupDimensions.width};
                  height: ${desktopPopupDimensions.height};
              }
          }

          #surface-iframe {
              transition: opacity 0.3s ease-in-out;
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
        document.head.appendChild(style);

        // NOTE: We removed the loop over .surface-form-button because
        // we're now using event delegation in the constructor.

        // Close button
        surface_popup
            .querySelector(".close-btn-container")
            .addEventListener("click", () => {
                this.hideSurfacePopup();
            });

        // Close popup if user clicks outside the content
        window.addEventListener("click", (event) => {
            if (event.target == surface_popup) {
                this.hideSurfacePopup();
            }
        });
    }

    // --- Slideover logic ---
    showSurfaceSlideover() {
        if (this.surface_popup_reference == null) {
            this.log(
                "warn",
                "Invalid showSurfaceForm invocation. Embed type is not popup or slideover"
            );
            return;
        }
        this.surface_popup_reference.style.display = "block";
        document.body.style.overflow = "hidden";

        const embedClient = this;
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
        document.body.style.overflow = "auto";

        const embedClient = this;
        setTimeout(function () {
            embedClient.surface_popup_reference.style.display = "none";
        }, 300);
    }

    embedSlideover() {
        if (this.surface_popup_reference == null) {
            this.log(
                "error",
                `Cannot embed slideover because Surface embed type is ${this.embed_type}`
            );
        }

        const surface_slideover = this.surface_popup_reference;
        const src = this.src.toString();

        surface_slideover.id = "surface-popup";
        surface_slideover.innerHTML = `
            <div class="surface-popup-content">
                <span class="close-btn">&times;</span>
                <iframe id="surface-iframe" src="${src}" frameborder="0" allowfullscreen></iframe>
            </div>
        `;

        document.body.appendChild(surface_slideover);

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

        // We remove the per-button loop; we rely on delegated click in the constructor.

        surface_slideover
            .querySelector(".close-btn")
            .addEventListener("click", () => {
                this.hideSurfaceSlideover();
            });

        // Close slideover if user clicks outside the content
        window.addEventListener("click", (event) => {
            if (event.target == surface_slideover) {
                this.hideSurfaceSlideover();
            }
        });
    }

    // --- Widget logic ---
    addWidgetButton() {
        const widgetButton = document.createElement('div');
        widgetButton.id = 'surface-widget-button';
        widgetButton.innerHTML = `
          <div class="widget-button-inner">
            <svg width="29" height="34" viewBox="0 0 29 34" fill="none" xmlns="http://www.w3.org/2000/svg">
                <path d="M15.008 33.986C10.6773 33.986 7.27467 33.0773 4.8 31.26C2.364 29.404 1.088 26.852 0.972 23.604H8.222C8.338 24.6867 8.93733 25.6727 10.02 26.562C11.1027 27.4513 12.804 27.896 15.124 27.896C17.0573 27.896 18.5847 27.548 19.706 26.852C20.866 26.156 21.446 25.2087 21.446 24.01C21.446 22.966 21.0013 22.1347 20.112 21.516C19.2613 20.8973 17.792 20.4913 15.704 20.298L12.92 20.008C9.40133 19.6213 6.69467 18.616 4.8 16.992C2.90533 15.368 1.958 13.2027 1.958 10.496C1.958 8.33067 2.49933 6.51333 3.582 5.044C4.66467 3.57466 6.15333 2.47266 8.048 1.738C9.98133 0.964665 12.1853 0.577999 14.66 0.577999C18.5267 0.577999 21.6587 1.42867 24.056 3.13C26.4533 4.83133 27.71 7.32533 27.826 10.612H20.576C20.4987 9.52933 19.9573 8.60133 18.952 7.828C17.9467 7.05467 16.4967 6.668 14.602 6.668C12.9007 6.668 11.586 6.99667 10.658 7.654C9.73 8.31133 9.266 9.162 9.266 10.206C9.266 11.2113 9.63333 11.9847 10.368 12.526C11.1413 13.0673 12.3787 13.4347 14.08 13.628L16.864 13.918C20.576 14.3047 23.476 15.3293 25.564 16.992C27.6907 18.6547 28.754 20.8973 28.754 23.72C28.754 25.808 28.174 27.6253 27.014 29.172C25.8927 30.68 24.3073 31.8593 22.258 32.71C20.2087 33.5607 17.792 33.986 15.008 33.986Z" fill="white"/>
            </svg>
          </div>
        `;

        document.body.appendChild(widgetButton);

        // Add styles for widget button with customization
        const style = document.createElement('style');
        style.innerHTML = `
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
        document.head.appendChild(style);

        // Clicking the widget button opens the popup
        widgetButton.addEventListener('click', () => {
            this.showSurfaceForm();
        });
    }

    embedWidget() {
        // Reuse popup embed logic since widget also opens as a popup
        this.embedPopup();
    }
}

// Optional: sync environment ID cookie
(function () {
    const scriptTag = document.currentScript;
    const environmentId = scriptTag ? scriptTag.getAttribute('siteId') : null;

    if (environmentId != null) {
        const syncCookiePayload = {
            type: "LogAnonLeadEnvIdPayload",
            environmentId: environmentId
        };
        SurfaceSyncCookie(JSON.stringify(syncCookiePayload));
    }
})();
