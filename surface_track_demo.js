window.SurfaceTracking = (() => {
  "use strict";

  const SurfaceTracking = {};

  const documentAlias = document;
  const navigatorAlias = navigator;
  const windowAlias = window;

  const serverBaseUrl = "http://localhost:3000/api/v1";

  let step = 0;
  let responseId = '';
  let userEmailAddress = '';

  async function sendEmailToServer(emailAddress) {
    var myHeaders = new Headers();
    myHeaders.append("Content-Type", "application/json");

    var raw = JSON.stringify({
      "responses": [
        {
          "questionId": "gOyoYYzZRnvo",
          "response": {
            "emailAddress": emailAddress,
            "type": "IdentityInfo",
            "componentShapeVersion": "2.0",
            "headline": "Identity Info"
          }
        },
        {
          "questionId": "gOyoYYzZRnvo",
          "response": {
            "lastName": "",
            "firstName": "",
            "companyName": "",
            "phoneNumber": "",
            "numberOfEmployees": "",
            "type": "IdentityInfo",
            "componentShapeVersion": "2.0",
            "headline": "Identity Info"
          }
        }
      ],
      "formId": "clyooxbhe0001li0922qwuxfi",
      "responseShapeVersion": "2.0",
      "finished": false,
      "stepId": "FDl2fdnb"
    });

    var requestOptions = {
      method: 'POST',
      headers: myHeaders,
      body: raw,
      redirect: 'follow'
    };

    const response = await fetch("https://express-proxy-zg2k.onrender.com/proxy", requestOptions)
    const result = await response.json()
    console.log(result);
    step = step + 1;
    responseId = result.data.id;
    userEmailAddress = emailAddress;
  }

  async function sendIdentityInfoToServer(firstName, lastName, company, employees, phoneNumber) {
    var myHeaders = new Headers();
    myHeaders.append("Content-Type", "application/json");

    var raw = JSON.stringify({
      "responses": [
        {
          "questionId": "gOyoYYzZRnvo",
          "response": {
            "emailAddress": userEmailAddress,
            "type": "IdentityInfo",
            "componentShapeVersion": "2.0",
            "headline": "Identity Info"
          }
        },
        {
          "questionId": "gOyoYYzZRnvo",
          "response": {
            "lastName": lastName,
            "firstName": firstName,
            "companyName": company,
            "phoneNumber": phoneNumber,
            "numberOfEmployees": employees,
            "type": "IdentityInfo",
            "componentShapeVersion": "2.0",
            "headline": "Identity Info"
          }
        }
      ],
      "responseId": responseId,
      "finished": true,
      "stepId": "aujZfLlyQunT"
    });

    var requestOptions = {
      method: 'PUT',
      headers: myHeaders,
      body: raw,
      redirect: 'follow'
    };

    const result = await fetch("https://express-proxy-zg2k.onrender.com/proxy", requestOptions);
  }

  const surfaceScriptElement =
    document.currentScript || document.querySelector('script[src*="surface_tracking.min.js"]');

  const apiKey = 'abc123'; // surfaceScriptElement.getAttribute("apikey") || surfaceScriptElement.getAttribute("data-apikey");
  const debugMode = window.location.search.includes("surfaceDebug=true");

  const addEvent = (element, type, listener) => {
    if (debugMode) console.log("Adding event listener for", type, "on", element);
    if (typeof element.addEventListener !== "undefined") element.addEventListener(type, listener, false);
    else element.attachEvent("on" + type, listener);
  };

  async function getHash(input) {
    const encoder = new TextEncoder();
    const data = encoder.encode(input);
    const hashBuffer = await crypto.subtle.digest("SHA-256", data);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    const hashHex = hashArray.map((b) => b.toString(16).padStart(2, "0")).join("");
    return hashHex;
  }

  function isEmailInput(inputElement) {
    if (!(inputElement instanceof HTMLElement)) {
      console.error("Invalid HTML element provided.");
      return false;
    }

    const emailRegex = /email/i; // Case-insensitive regex for "email"

    const emailValueRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/; // Matches typical email formats
    const isEmailPlaceholder = inputElement.placeholder && emailValueRegex.test(inputElement.placeholder);

    return (
      inputElement.type === "email" ||
      (inputElement.type === "text" && emailRegex.test(inputElement.name)) ||
      emailRegex.test(inputElement.className) ||
      emailRegex.test(inputElement.placeholder) ||
      isEmailPlaceholder
    );
  }

  function isPhoneInput(inputElement) {
    if (!(inputElement instanceof HTMLElement)) {
      console.error("Invalid HTML element provided.");
      return false;
    }

    const isPhonePlaceholder = !!inputElement.placeholder?.toLowerCase().includes("phone"); // Check if placeholder includes 'phone'
    const isPhonePattern = !!inputElement.getAttribute("pattern")?.includes("tel"); // Check if pattern attribute includes 'tel'

    return inputElement.type === "tel" || isPhonePlaceholder || isPhonePattern;
  }

  function isFirstNameInput(inputElement) {
    if (!inputElement || !(inputElement instanceof HTMLElement)) {
      console.error("Invalid input element provided.");
      return false;
    }

    // Check if the input element is of type "text" or "search"
    const isTextInput = inputElement.type === "text" || inputElement.type === "search";

    // Check for additional conditions that may indicate a first name input
    const hasNamePattern = !!inputElement.getAttribute("pattern")?.includes("name"); // Check if pattern attribute includes 'name'
    const hasNamePlaceholder = !!inputElement.placeholder?.toLowerCase().includes("first name"); // Check if placeholder includes 'first name'
    const hasNameLabel = !!document
      .querySelector(`label[for="${inputElement.id}"]`)
      ?.textContent.toLowerCase()
      .includes("first name"); // Check if associated label includes 'first name'

    // Combine conditions
    return isTextInput || hasNamePattern || hasNamePlaceholder || hasNameLabel;
  }

  function isLastNameInput(inputElement) {
    if (!inputElement || !(inputElement instanceof HTMLElement)) {
      console.error("Invalid input element provided.");
      return false;
    }

    // Check if the input element is of type "text" or "search"
    const isTextInput = inputElement.type === "text" || inputElement.type === "search";

    // Check for additional conditions that may indicate a last name input
    const hasNamePattern = !!inputElement.getAttribute("pattern")?.includes("name"); // Check if pattern attribute includes 'name'
    const hasNamePlaceholder = !!inputElement.placeholder?.toLowerCase().includes("last name"); // Check if placeholder includes 'last name'
    const hasNameLabel = !!document
      .querySelector(`label[for="${inputElement.id}"]`)
      ?.textContent.toLowerCase()
      .includes("last name"); // Check if associated label includes 'last name'

    // Combine conditions
    return isTextInput || hasNamePattern || hasNamePlaceholder || hasNameLabel;
  }

  async function getBrowserFingerprint() {
    let fingerprint = {};

    // Device Type
    fingerprint.deviceType = /Mobi|Android/i.test(navigator.userAgent) ? "Mobile" : "Desktop";

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
    fingerprint.plugins = Array.from(navigator.plugins).map((plugin) => plugin.name);

    // TODO: attach extensions data
    fingerprint.extensions = [];

    // TODO: attach location data, it will require third party api call.
    fingerprint.locationData = {
      country: "",
      city: "",
    };

    // Time Zone
    fingerprint.timezone = Intl.DateTimeFormat().resolvedOptions().timeZone;

    // Combine all fingerprint data into a single string
    let fingerprintString = JSON.stringify(fingerprint);

    // Generate a unique ID using a hash function
    fingerprint.id = await getHash(fingerprintString);

    return fingerprint;
  }

  async function sendFormDataToServer({ formData }) {
    const browserFingerprint = await getBrowserFingerprint();
    const url = `${serverBaseUrl}/tracking`; // Replace with your server endpoint

    const payload = {
      fingerprint: browserFingerprint,
      formData,
      apiKey,
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
        value = Array.from(inputElement.selectedOptions).map((option) => option.value);
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

  function checkSubmitClickInForm(target) {
    const clickedButton = target.closest("button") || target.closest("a");
    if (!clickedButton) {
      return;
    }

    if (clickedButton.nodeName === "A" && !clickedButton.className.includes("button")) {
      return;
    }

    const form = target.closest("form");
    if (form) {
      const elements = form.elements;
      let isValid = true;

      const formData = {};

      for (let i = 0; i < elements.length; i++) {
        const element = elements[i];
        if (!element || element.type === "hidden") continue;
        const isInputInValid = element.validity && !element.validity.valid;

        // due to some reason nextiva tel input always returns invalid but site redirects to success page.
        if (isInputInValid && element.type !== "tel") {
          isValid = false;
        }

        const inputData = extractInputValue(element);
        if (inputData.value) {
          if (isEmailInput(element)) {
            formData["email"] = inputData.value;
          }
          if (isPhoneInput(element)) {
            formData["phone"] = inputData.value;
          }
          if (isFirstNameInput(element)) {
            formData["firstName"] = inputData.value;
          }
          if (isLastNameInput(element)) {
            formData["lastName"] = inputData.value;
          }

          // it might cause duplicate entries, but if we prevent this then below case wont work
          // ex: if two fields triggered phone input validation then only one of them will be sent to server
          // due to above case didn't prevented duplicate values.
          formData[inputData.name] = inputData.value;
        }

        if (isInputInValid && debugMode) {
          console.log("invalid input", inputData, element.validity);
        }
      }

      if (debugMode) {
        console.table(formData);
      }

      // track submission if button is type submit or has submission classes
      const hasSubmissionClasses = !!clickedButton.className.match(/(cta |submit|submission|book\-demo)/g);

      console.log({
        isValid,
        formData: JSON.stringify(formData),
        type: clickedButton.type,
        hasSubmissionClasses,
      });

      if (
        isValid &&
        Object.keys(formData).length > 0 &&
        (clickedButton.type === "submit" || hasSubmissionClasses)
      ) {
        console.log({ formData })
        if (step == 0) {
          sendEmailToServer(formData.email);
        }
        if (step == 1) {
          sendIdentityInfoToServer(formData.firstName, formData.lastName, formData.company, formData.employees, formData.phone)
        }
        // sendFormDataToServer({ formData });
      }
    }
  }

  function handleOnClick(e) {
    checkSubmitClickInForm(e.target);
  }

  SurfaceTracking.init = async function (apiKey) {
    addEvent(windowAlias, "mousedown", (e) => handleOnClick(e));
  };

  SurfaceTracking.init();
  return SurfaceTracking;
})();
