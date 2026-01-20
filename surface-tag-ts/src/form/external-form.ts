import { SurfaceGetSiteIdFromScript } from '../utils/script-utils';

export class SurfaceExternalForm {
  initialRenderTime: Date;
  formStates: Record<string, Record<string, Record<string, any>>>;
  responseIds: Record<string, string>;
  windowUrl: string;
  formSessions: Record<string, any>;
  formInitializationStatus: Record<string, boolean>;
  formStarted: Record<string, boolean>;
  config: {
    serverBaseUrl: string;
    debugMode: boolean;
  };
  environmentId: string | null;
  forms: HTMLFormElement[];

  constructor(props?: { serverBaseUrl?: string; siteId?: string }) {
    this.initialRenderTime = new Date();
    this.formStates = {};
    this.responseIds = {};
    this.windowUrl = new URL(window.location.href).toString();
    this.formSessions = {};
    this.formInitializationStatus = {};
    this.formStarted = {};

    this.config = {
      serverBaseUrl:
        props && props.serverBaseUrl
          ? props.serverBaseUrl
          : "https://forms.withsurface.com/api/v1",
      debugMode: window.location.search.includes("surfaceDebug=true"),
    };

    this.environmentId =
      props && props.siteId
        ? props.siteId
        : SurfaceGetSiteIdFromScript(document.currentScript as HTMLScriptElement);

    this.forms = Array.from(document.querySelectorAll("form")).filter((form) =>
      Boolean(form.getAttribute("data-id"))
    );
  }

  getLeadSessionId(formId: string): string | null {
    return this.formSessions[formId] && this.formSessions[formId].sessionId
      ? this.formSessions[formId].sessionId
      : null;
  }

  async sendBeacon(url: string, payload: any) {
    try {
      const blob = new Blob([JSON.stringify(payload)], {
        type: "application/json",
      });
      if (navigator.sendBeacon) {
        navigator.sendBeacon(url, blob);
      } else {
        // Fallback to fetch if sendBeacon is not supported
        const response = await fetch(url, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify(payload),
          keepalive: true,
        });
        if (!response.ok) {
          throw new Error("Network response was not ok");
        }
      }
    } catch (error) {
      console.error("Push event API failed: ", error);
    }
  }

  callFormViewApi(formId: string) {
    const apiUrl = `${this.config.serverBaseUrl}/externalForm/initialize`;
    const payload = {
      formId,
      environmentId: this.environmentId,
      leadSessionId: this.getLeadSessionId(formId),
    };
    this.sendBeacon(apiUrl, payload);
  }

  callFormStartedApi(formId: string) {
    const apiUrl = `${this.config.serverBaseUrl}/externalForm/formStarted`;
    const payload = {
      formId,
      environmentId: this.environmentId,
      leadSessionId: this.getLeadSessionId(formId),
    };
    this.sendBeacon(apiUrl, payload);
  }

  async identify(formId: string) {
    const apiUrl = `${this.config.serverBaseUrl}/lead/identify`;
    const parentUrl = new URL(this.windowUrl);
    const payload = {
      formId,
      environmentId: this.environmentId,
      source: "surfaceForm",
      sourceURL: parentUrl.href,
      sourceURLDomain: parentUrl.hostname,
      sourceURLPath: parentUrl.pathname,
      sourceUrlSearchParams: parentUrl.search,
      leadId: null,
      sessionIdFromParams: null,
    };
    try {
      const identifyResponse = await fetch(apiUrl, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(payload),
      });
      const jsonData = await identifyResponse.json();
      if (
        identifyResponse.ok &&
        jsonData.data &&
        jsonData.data.data &&
        jsonData.data.data.sessionId
      ) {
        this.formSessions[formId] = jsonData.data.data;
      }
    } catch (error) {
      this.log(`Error identifying lead: ${error instanceof Error ? error.message : String(error)}`, "error");
    }
  }

  async initializeForm(formId: string) {
    if (this.formInitializationStatus[formId]) {
      return;
    }
    this.formInitializationStatus[formId] = true;
    await this.identify(formId);
    this.callFormViewApi(formId);
  }

  log(message: any, level: string = "log", ...additionalArgs: any[]) {
    if (this.config.debugMode) {
      const fullMessage = additionalArgs.length > 0 
        ? `${message} ${additionalArgs.map(arg => typeof arg === 'object' ? JSON.stringify(arg) : arg).join(' ')}`
        : message;
      
      switch (level) {
        case "log":
          console.log(fullMessage);
          break;
        case "warn":
          console.warn(fullMessage);
          break;
        case "error":
          console.error(fullMessage);
          break;
        default:
          console.log(fullMessage);
          break;
      }
    }
  }

  storeQuestionData({ formId, questionId, variableName = "value", value }: {
    formId: string;
    questionId: string;
    variableName?: string;
    value: any;
  }) {
    if (!this.formStates[formId]) {
      this.formStates[formId] = {};
    }
    if (!this.formStates[formId][questionId]) {
      this.formStates[formId][questionId] = {};
    }
    this.formStates[formId][questionId][variableName] = value;
  }

  submitForm(form: HTMLFormElement, finished: boolean = false) {
    const formId = form.getAttribute("data-id")!;

    const responses = Object.entries(this.formStates[formId] || {}).map(
      ([questionId, data]) => ({
        questionId,
        response: data,
      })
    );
    const payload = {
      id: this.responseIds[formId],
      formId,
      responses: responses,
      finished,
      environmentId: this.environmentId,
      leadSessionId: this.getLeadSessionId(formId),
      initialRenderTime: this.initialRenderTime.toISOString(),
    };

    this.log(`Submitting form data: ${JSON.stringify(payload)}`);

    if (this.environmentId == null) {
      this.log(
        "Skipping form submission as the environmentId is not configured.",
        "error"
      );
      return;
    }

    fetch(`${this.config.serverBaseUrl}/externalForm/submit`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    })
      .then((response) => response.json())
      .then((data) => {
        if (data && data.data && data.data.response && data.data.response.id) {
          this.responseIds[formId] = data.data.response.id;
          this.log("Response ID stored:", data.data.response.id);
        }
      })
      .catch((error) => {
        this.log(`Error submitting form: ${error instanceof Error ? error.message : String(error)}`, "error");
      });
  }

  handleInputChange(formId: string, event: Event) {
    if (!this.formStarted[formId]) {
      this.callFormStartedApi(formId);
      this.formStarted[formId] = true;
    }

    const target = event.target as HTMLElement;
    const elementId = target.getAttribute("data-id")!;
    const [questionId, variableName] = elementId.includes("_")
      ? elementId.split("_")
      : [elementId, null];
    const value = (target as HTMLInputElement).value;

    this.log(
      `Form ${formId} element changed - Question ID: ${questionId}, Variable Name: ${variableName}, Value: ${value}`
    );
    this.storeQuestionData({
      formId,
      questionId,
      variableName: variableName ?? "value",
      value,
    });
  }

  attachFormHandlers() {
    if (!this.environmentId) {
      this.log("No environment id configured", "warn");
      return;
    }

    if (this.forms.length === 0) {
      this.log("No forms with data-id attribute found", "warn");
      return;
    }

    this.forms.forEach((form) => {
      const formId = form.getAttribute("data-id")!;

      this.log(`Attaching handlers to form: ${formId}`);

      form
        .querySelectorAll(
          "input[data-id], select[data-id], textarea[data-id], fieldset[data-id]"
        )
        .forEach((element) =>
          element.addEventListener("change", (e) =>
            this.handleInputChange(formId, e)
          )
        );

      const surfaceNextButtonElements = form.getElementsByClassName(
        "surface-next-button"
      );

      const surfaceSubmitButtonElements = form.getElementsByClassName(
        "surface-submit-button"
      );

      if (surfaceNextButtonElements.length > 0) {
        Array.from(surfaceNextButtonElements).forEach((button) => {
          button.addEventListener("click", (event) => {
            this.submitForm(form, false);
          });
        });
      }
      if (surfaceSubmitButtonElements.length > 0) {
        Array.from(surfaceSubmitButtonElements).forEach((button) => {
          button.addEventListener("click", (event) => {
            event.preventDefault();
            this.submitForm(form, true);
          });
        });
      } else {
        form.addEventListener("submit", (event) => {
          event.preventDefault();
          this.log(`Form ${formId} submitted`);
          this.submitForm(form, true);
        });
      }

      // initialize the form state
      this.formStates[formId] = {};
      this.formStarted[formId] = false;

      this.initializeForm(formId);
    });
  }
}
