function getUrlParams() {
  let params = {};
  let queryString = window.location.search.slice(1); // Remove the leading '?'
  let pairs = queryString.split("&");

  pairs.forEach((pair) => {
    let [key, value] = pair.split("=");
    params[decodeURIComponent(key)] = decodeURIComponent(value || "");
  });

  return params;
}

let buttonElementClass = "surface-form-button";
let buttonElementID = "surface-form-button";
let src = "https://google.com/";

function embedSurfaceForm() {
  var buttonsByClass = document.querySelectorAll("." + buttonElementClass);
  var buttonByID = document.getElementById(buttonElementID);

  var allButtons = Array.from(buttonsByClass);
  if (buttonByID) {
    allButtons.push(buttonByID);
  }
  // Create the Popup HTML
  var popup = document.createElement("div");
  popup.id = "demoPopup";

  let urlParams = getUrlParams();

  if (urlParams.profile) {
    src += `?profile=${urlParams.profile}`;
  }
  popup.innerHTML = `
      <div class="popup-content">
          <span class="close-btn">&times;</span>
          <iframe src="${src}" frameborder="0" allowfullscreen></iframe>
      </div>`;

  // Append to body
  document.body.appendChild(popup);

  // Apply CSS
  var style = document.createElement("style");
  style.innerHTML = `
      #demoPopup {
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

      .popup-content {
          position: absolute;
          top: 50%;
          left: 50%;
          transform: translate(-50%, -50%) scale(0.9);
          width: 90%;
          height: 80%;
          max-width: 600px;
          background-color: transparent;
          padding: 0;
          border-radius: 15px;
          box-shadow: 0px 0px 15px rgba(0,0,0,0.2);
          opacity: 0;
          transition: transform 0.3s ease, opacity 0.3s ease;
      }

      .popup-content iframe {
          width: 100%;
          height: 100%;
          border-radius: 15px;
      }

      .close-btn {
          position: absolute;
          right: 10px;
          top: 10px;
          font-size: 24px;
          cursor: pointer;
      }

      /* Adjust iframe dimensions for larger screens */
      @media (min-width: 1024px) {
          .popup-content {
              max-width: 80%;
              height: 80%;
          }
      }

      #demoPopup.active {
          opacity: 1;
      }

      #demoPopup.active .popup-content {
          transform: translate(-50%, -50%) scale(1);
          opacity: 1;
      }
  `;
  document.head.appendChild(style);

  // Add Event Listeners
  allButtons.forEach(function (btn) {
    btn.addEventListener("click", function () {
      popup.style.display = "block";
      document.body.style.overflow = "hidden"; // Prevent background scrolling

      // Timeout to allow the 'display' change to take effect before adding the animation class
      setTimeout(function () {
        popup.classList.add("active");
      }, 50);
    });
  });

  popup.querySelector(".close-btn").addEventListener("click", function () {
    popup.classList.remove("active");
    document.body.style.overflow = "auto"; // Revert background scrolling behavior

    // After the animation completes, set display to none
    setTimeout(function () {
      popup.style.display = "none";
    }, 300);
  });

  window.addEventListener("click", function (event) {
    if (event.target == popup) {
      popup.classList.remove("active");
      document.body.style.overflow = "auto"; // Revert background scrolling behavior

      // After the animation completes, set display to none
      setTimeout(function () {
        popup.style.display = "none";
      }, 300);
    }
  });
}
