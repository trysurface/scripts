window.SurfaceTracking = (() => {
  "use strict";

  const SurfaceTracking = {};

  const documentAlias = document;
  const navigatorAlias = navigator;
  const windowAlias = window;

  let serverBaseUrl = "https://app.withsurface.com/api/v1";
  const localUrl = localStorage.getItem("surfaceServerBaseURL");
  // to set the local url as the server url is exists in local storage
  if (localUrl) {
    serverBaseUrl = localUrl;
  }

  const surfaceScriptElement =
    document.currentScript ||
    document.querySelector('script[src*="surface_tracking.min.js"]');

  const environmentId = surfaceScriptElement.getAttribute("environmentid");
  const debugMode = window.location.search.includes("surfaceDebug=true");
  let userFingerprint = null;

  const addEvent = (element, type, listener) => {
    if (debugMode)
      console.log("Adding event listener for", type, "on", element);
    if (typeof element.addEventListener !== "undefined")
      element.addEventListener(type, listener, false);
    else element.attachEvent("on" + type, listener);
  };

  async function getHash(input) {
    const encoder = new TextEncoder();
    const data = encoder.encode(input);
    const hashBuffer = await crypto.subtle.digest("SHA-256", data);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    const hashHex = hashArray
      .map((b) => b.toString(16).padStart(2, "0"))
      .join("");
    return hashHex;
  }

  function isEmailInput(inputElement) {
    if (!(inputElement instanceof HTMLElement)) {
      console.error("Invalid HTML element provided.");
      return false;
    }

    const emailRegex = /email/i; // Case-insensitive regex for "email"

    const emailValueRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/; // Matches typical email formats
    const isEmailPlaceholder =
      (inputElement.placeholder &&
        emailValueRegex.test(inputElement.placeholder)) ||
      emailRegex.test(inputElement.placeholder);
    const hasEmailLabel = emailRegex.test(
      document.querySelector(`label[for="${inputElement.id}"]`)?.textContent
    );

    return (
      inputElement.type === "email" ||
      (inputElement.type === "text" && emailRegex.test(inputElement.name)) ||
      emailRegex.test(inputElement.className) ||
      hasEmailLabel ||
      isEmailPlaceholder
    );
  }

  function isPhoneInput(inputElement) {
    if (!(inputElement instanceof HTMLElement)) {
      console.error("Invalid HTML element provided.");
      return false;
    }

    const phoneRegex =
      /^\+?(?:\s|-|\()?[0-9]{1,4}(?:\s|-|\))?[0-9]{1,4}\s?[0-9]{1,4}$/i;
    const phoneTermRegex =
      /phone|Tel|Telephone|telephone|cell|Cell|mobile|Mobile|call|Call/i;

    const hasNameAtribute = phoneTermRegex.test(inputElement.name); // Check if pattern attribute includes terms
    const hasClassNameAttribute = phoneTermRegex.test(inputElement.className);
    const isPhonePlaceholder =
      phoneTermRegex.test(inputElement.placeholder) ||
      phoneRegex.test(inputElement.placeholder); // Check if placeholder includes 'phone'
    const hasPhoneLabel = phoneTermRegex.test(
      document.querySelector(`label[for="${inputElement.id}"]`)?.textContent
    );

    return (
      inputElement.type === "tel" ||
      hasNameAtribute ||
      hasClassNameAttribute ||
      isPhonePlaceholder ||
      hasPhoneLabel
    );
  }

  function isFirstNameInput(inputElement) {
    if (!inputElement || !(inputElement instanceof HTMLElement)) {
      console.error("Invalid input element provided.");
      return false;
    }

    // Case-insensitive regex for common last name  terms
    const firstNameRegex =
      /first|Forename|given|Given|firstname|FirstName|name|Name|givenName|GivenName|forename|Forename/i;

    // Check if the input element is of type "text" or "search"
    const isTextInput =
      inputElement.type === "text" || inputElement.type === "search";

    // Check for additional conditions that may indicate a first name input
    const hasNameAtribute = firstNameRegex.test(inputElement.name); // Check if pattern attribute includes 'name'
    const hasClassNameAttribute = firstNameRegex.test(inputElement.className);
    const hasNamePlaceholder = firstNameRegex.test(inputElement.placeholder); // Check if placeholder includes 'first name'
    const hasNameLabel =
      !!document
        .querySelector(`label[for="${inputElement.id}"]`)
        ?.textContent.toLowerCase()
        .includes("name") ||
      firstNameRegex.test(
        document.querySelector(`label[for="${inputElement.id}"]`)?.textContent
      ); // Check if associated label includes 'first name'

    // Combine conditions
    return (
      isTextInput &&
      (hasNameAtribute ||
        hasClassNameAttribute ||
        hasNamePlaceholder ||
        hasNameLabel)
    );
  }

  function isLastNameInput(inputElement) {
    if (!inputElement || !(inputElement instanceof HTMLElement)) {
      console.error("Invalid input element provided.");
      return false;
    }

    // Case-insensitive regex for common last name  terms
    const lastNameRegex =
      /last|Surname|family|Family|lastname|Lastname|lname|l-name|LName|familyName|FamilyName|surname|Surname|familyName|FamilyName/i;

    // Check if the input element is of type "text" or "search"
    const isTextInput =
      inputElement.type === "text" || inputElement.type === "search";

    // Check for additional conditions that may indicate a last name input
    const hasNameAttribute = lastNameRegex.test(inputElement.name);
    const hasClassNameAttribute = lastNameRegex.test(inputElement.className);
    const hasNamePlaceholder =
      !!inputElement.placeholder?.toLowerCase().includes("last name") ||
      lastNameRegex.test(inputElement.placeholder); // Check if placeholder includes 'last name'
    const hasNameLabel =
      !!document
        .querySelector(`label[for="${inputElement.id}"]`)
        ?.textContent.toLowerCase()
        .includes("last name") ||
      lastNameRegex.test(
        document.querySelector(`label[for="${inputElement.id}"]`)?.textContent
      ); // Check if associated label includes 'last name'

    // Combine conditions
    return (
      isTextInput &&
      (hasNameAttribute ||
        hasClassNameAttribute ||
        hasNamePlaceholder ||
        hasNameLabel)
    );
  }

  function isCompanyInput(inputElement) {
    if (!(inputElement instanceof HTMLElement)) {
      console.error("Invalid HTML element provided.");
      return false;
    }

    const companyRegex = /company|organization|business|firm|enterprise/i; // Case-insensitive regex for common company terms

    const companyValueRegex =
      /(Pvt\s*Ltd|LLC|Inc|Corporation|Ltd|Limited|GmbH|Co|Partnership)$/i; // Matches typical company name formats
    const isCompanyPlaceholder =
      inputElement.placeholder &&
      (companyValueRegex.test(inputElement.placeholder) ||
        companyRegex.test(inputElement.placeholder));
    const hasCompanyLabel = companyRegex.test(
      document.querySelector(`label[for="${inputElement.id}"]`)?.textContent
    ); // Check if associated label includes 'company'
    return (
      inputElement.type === "text" &&
      (companyRegex.test(inputElement.name) ||
        companyRegex.test(inputElement.className) ||
        hasCompanyLabel ||
        isCompanyPlaceholder)
    );
  }

  async function getBrowserFingerprint() {
    if (userFingerprint != null) {
      return userFingerprint;
    }

    let fingerprint = {};

    // Device Type
    fingerprint.deviceType = /Mobi|Android/i.test(navigator.userAgent)
      ? "Mobile"
      : "Desktop";

    // Screen Properties
    fingerprint.screen = {
      width: screen.width,
      height: screen.height,
      colorDepth: screen.colorDepth,
    };

    // Browser, OS, and Version
    fingerprint.userAgent = navigator.userAgent;
    let userAgentData = navigator.userAgentData || {};
    fingerprint.browser = userAgentData.brands ||
      userAgentData.uaList || [{ brand: "unknown", version: "unknown" }];
    fingerprint.os = userAgentData.platform || "unknown";

    // Browser Language
    fingerprint.language = navigator.language;

    // Installed Plugins
    if (navigator.plugins != null) {
      fingerprint.plugins = Array.from(navigator.plugins).map(
        (plugin) => plugin.name
      );
    }

    // TODO: attach extensions data

    // Time Zone
    fingerprint.timezone = Intl.DateTimeFormat().resolvedOptions().timeZone;

    fingerprint.environmentId = environmentId;

    // Combine all fingerprint data into a single string
    let fingerprintString = JSON.stringify(fingerprint);

    // Generate a unique ID using a hash function
    fingerprint.id = await getHash(fingerprintString);

    // Store the result to make future function calls faster
    userFingerprint = fingerprint;

    return fingerprint;
  }

  async function callIdentifyApi() {
    const browserFingerprint = await getBrowserFingerprint();
    const url = `${serverBaseUrl}/lead/identify`; // Replace with your server endpoint

    const { href, hostname, pathname, search } = window.location;
    const payload = {
      fingerprint: browserFingerprint.id,
      environmentId,
      source: "htmlForm",
      sourceURL: href,
      sourceURLDomain: hostname,
      sourceURLPath: pathname,
      sourceUrlSearchParams: search,
    };

    const res = await fetch(url, {
      method: "POST",
      body: JSON.stringify(payload),
      headers: {
        "Content-Type": "application/json",
      },
    });
    const result = await res?.json();
    return result?.data?.data;
  }

  async function callCaptureApi({ attributes }) {
    const browserFingerprint = await getBrowserFingerprint();
    const url = `${serverBaseUrl}/lead/capture`;

    const payload = {
      fingerprint: browserFingerprint.id,
      data: attributes,
      sessionId: SurfaceTracking.sessionId,
    };

    const blob = new Blob([JSON.stringify(payload)], {
      type: "application/json",
    });

    if (navigator.sendBeacon) {
      navigator.sendBeacon(url, blob);
    } else {
      // Fallback to fetch if sendBeacon is not supported
      await fetch(url, {
        method: "POST",
        body: JSON.stringify(payload),
        headers: {
          "Content-Type": "application/json",
        },
      });
    }
  }

  function extractInputValue(inputElement) {
    if (!(inputElement instanceof HTMLElement)) {
      console.error("Invalid HTML element provided.");
      return;
    }

    const inputType = inputElement.type;
    let value;

    switch (inputType) {
      case "checkbox":
        value = inputElement.checked;
        break;
      case "radio":
        value = inputElement.checked ? inputElement.value : null;
        break;
      case "select-one":
      case "select-multiple":
        value = Array.from(inputElement.selectedOptions).map(
          (option) => option.value
        );
        if (inputType === "select-one") {
          value = value[0]; // For select-one, just take the first value
        }
        break;
      case "text":
      case "password":
      case "email":
      case "number":
      case "textarea":
      default:
        value = inputElement.value;
        break;
    }

    return {
      name: inputElement.name,
      value: value,
    };
  }

  function calculateInputType(element) {
    if (isEmailInput(element)) {
      return "email";
    }
    if (isPhoneInput(element)) {
      return "phone";
    }
    if (isCompanyInput(element)) {
      return "company";
    }
    if (isLastNameInput(element)) {
      return "lastName";
    }
    if (isFirstNameInput(element)) {
      return "firstName";
    }
    return "other";
  }

  function isElementVisible(element) {
    if (!element) return false;

    function isVisible(el) {
      const style = window.getComputedStyle(el);
      return (
        style.display !== "none" &&
        style.visibility !== "hidden" &&
        style.opacity !== "0"
      );
    }

    function isWithinViewport(el) {
      const rect = el.getBoundingClientRect();
      return (
        rect.top >= 0 &&
        rect.left >= 0 &&
        rect.bottom <=
          (window.innerHeight || document.documentElement.clientHeight) &&
        rect.right <=
          (window.innerWidth || document.documentElement.clientWidth)
      );
    }

    let currentElement = element;
    while (currentElement) {
      if (!isVisible(currentElement)) {
        return false;
      }
      currentElement = currentElement.parentElement; // Move to the parent element
    }

    return isWithinViewport(element);
  }

  async function checkSubmitClickInForm(target) {
    const clickedButton = target.closest("button") || target.closest("a");
    if (!clickedButton) {
      return;
    }

    // check if the element is an anchor tag disguised as a button, if its a normal anchor tag, then return
    if (
      clickedButton.nodeName === "A" &&
      !clickedButton.className.includes("button") &&
      !clickedButton.className.includes("btn")
    ) {
      return;
    }

    const form = target.closest("form");
    if (form) {
      const elements = form.elements;
      let isValid = true;

      const formData = {};

      const attributes = [];
      let sourceFormId = "Unknown form";

      if (form.id) {
        sourceFormId = form.id;
      } else if (form.className) {
        sourceFormId = form.className;
      }
      // loop through all the inputs of the form and extract their content.
      for (let i = 0; i < elements.length; i++) {
        const element = elements[i];
        if (!element || element.type === "hidden") continue;
        const isInputVisible = isElementVisible(element);
        const isInputInvalid =
          isInputVisible && element.validity && !element.validity.valid;

        // due to some reason nextiva tel input always returns invalid but site redirects to success page.
        if (isInputInvalid && element.type !== "tel") {
          isValid = false;
        }

        const inputData = extractInputValue(element);
        if (inputData.value.toString() && inputData.name) {
          const inputType = calculateInputType(element);

          attributes.push({
            type: inputType,
            name: inputData.name,
            value: inputData.value.toString(),
            sourceFormId,
          });

          // it might cause duplicate entries, but if we prevent this then below case wont work
          // ex: if two fields triggered phone input validation then only one of them will be sent to server
          // due to above case didn't prevented duplicate values.
          formData[inputData.name] = inputData.value;
        }

        if (isInputInvalid && debugMode) {
          console.log("invalid input", inputData, element.validity);
        }
      }

      if (debugMode) {
        console.table(formData);
      }

      // track submission if button is type submit or has submission classes
      const hasSubmissionClasses = !!clickedButton.className.match(
        /(cta |submit|submission|book\-demo)/g
      );
      const hasSubmissionIds = !!clickedButton.id.match(
        /(cta|submit|submission|book\-demo|button)/g
      );

      if (
        isValid &&
        attributes.length > 0 &&
        (clickedButton.type === "submit" ||
          hasSubmissionClasses ||
          hasSubmissionIds)
      ) {
        await callCaptureApi({ attributes });
      }
    }
  }

  async function handleOnClick(e) {
    await checkSubmitClickInForm(e.target);
  }

  SurfaceTracking.init = async function (apiKey) {
    addEvent(windowAlias, "mousedown", async (e) => handleOnClick(e));
    const { sessionId } = await callIdentifyApi();
    SurfaceTracking.sessionId = sessionId;
  };

  if (!environmentId) {
    console.error("Please add a valid environmentid in surface script tag");
    return;
  }

  SurfaceTracking.init();
  return SurfaceTracking;
})();
