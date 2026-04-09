/**
 * Shared embed configuration UI and refresh logic.
 *
 * Usage:
 *   setupEmbedConfig({
 *     embedType: "popup" | "slideover" | "inline",
 *     triggerClass: "surface-popup-trigger",
 *     defaultFormUrl: "https://forms.withsurface.com/s/...",
 *     showSizeOptions: true,          // popup only
 *     onEmbed(src, embed) {}          // optional post-init hook
 *   });
 */
function setupEmbedConfig(opts) {
  const configEl = document.getElementById("embed-config");
  const statusEl = document.getElementById("refreshStatus");
  const formUrlInput = document.getElementById("formUrlInput");

  let selectedSize = "medium";
  let dirty = false;
  let statusTimeout = null;

  // --- Size options (popup only) ---

  if (opts.showSizeOptions) {
    document.querySelectorAll(".size-btn").forEach(btn => {
      btn.addEventListener("click", function () {
        document.querySelectorAll(".size-btn").forEach(b => b.classList.remove("active"));
        this.classList.add("active");
        selectedSize = this.dataset.size;
        document.getElementById("customSliders").style.display =
          selectedSize === "custom" ? "block" : "none";
        markDirty();
      });
    });

    document.getElementById("widthSlider").addEventListener("input", function () {
      document.getElementById("widthValue").textContent = this.value;
      markDirty();
    });

    document.getElementById("heightSlider").addEventListener("input", function () {
      document.getElementById("heightValue").textContent = this.value;
      markDirty();
    });
  }

  // --- Dirty state ---

  function showStatus(text, className) {
    clearTimeout(statusTimeout);
    statusEl.textContent = text;
    statusEl.className = className;
  }

  function markDirty() {
    if (dirty) return;
    dirty = true;
    showStatus("Settings changed \u2014 click Refresh Embed to apply", "status-dirty");
  }

  formUrlInput.addEventListener("input", markDirty);

  // --- Refresh ---

  function getPopupSize() {
    if (selectedSize === "custom") {
      return {
        width: document.getElementById("widthSlider").value + "px",
        height: document.getElementById("heightSlider").value + "px",
      };
    }
    return selectedSize;
  }

  function teardown() {
    if (opts.embedType === "inline") {
      // Clear the inline container's contents so SurfaceEmbed can re-populate it
      document.querySelectorAll("." + opts.triggerClass).forEach(el => {
        el.innerHTML = "";
      });
    } else {
      // Remove Surface-created overlay DOM
      document.querySelectorAll("#surface-popup").forEach(el => el.remove());
      // Strip old click handlers from trigger buttons
      document.querySelectorAll("." + opts.triggerClass).forEach(btn => {
        btn.replaceWith(btn.cloneNode(true));
      });
    }
  }

  function initEmbed() {
    teardown();

    var formUrl = formUrlInput.value.trim();
    var sep = formUrl.includes("?") ? "&" : "?";
    var src = formUrl + sep + "_t=" + Date.now();

    var embed = new SurfaceEmbed(src, opts.embedType, opts.triggerClass);

    if (opts.embedType === "popup") {
      embed.popupSize = getPopupSize();
    }

    if (opts.onEmbed) {
      opts.onEmbed(src, embed);
    }

    dirty = false;
    showStatus("Refreshed (" + (opts.embedType === "popup" ? selectedSize : opts.embedType) + ")", "status-ok");
    statusTimeout = setTimeout(function () { statusEl.textContent = ""; }, 3000);
  }

  document.getElementById("refreshEmbed").addEventListener("click", initEmbed);

  // Boot
  initEmbed();
}
