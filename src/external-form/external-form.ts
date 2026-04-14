import { EXTERNAL_FORM_API } from "../constants";
import { isDebugMode } from "../utils/debug";
import { sendBeacon } from "../utils/beacon";
import { getSiteIdFromScript } from "../lead/site-id";
import { attachFormHandlers } from "./form-handlers";
import type { ExternalFormProps } from "../types";

export class SurfaceExternalForm {
  initialRenderTime: Date;
  formStates: Record<string, Record<string, Record<string, string>>>;
  responseIds: Record<string, string>;
  windowUrl: string;
  formSessions: Record<string, Record<string, string>>;
  formInitializationStatus: Record<string, boolean>;
  formStarted: Record<string, boolean>;
  config: { serverBaseUrl: string; debugMode: boolean };
  environmentId: string | null;
  forms: HTMLFormElement[];

  constructor(props?: ExternalFormProps) {
    this.initialRenderTime = new Date();
    this.formStates = {};
    this.responseIds = {};
    this.windowUrl = new URL(window.location.href).toString();
    this.formSessions = {};
    this.formInitializationStatus = {};
    this.formStarted = {};

    this.config = {
      serverBaseUrl: props?.serverBaseUrl || EXTERNAL_FORM_API,
      debugMode: isDebugMode(),
    };

    this.environmentId =
      props?.siteId || getSiteIdFromScript(document.currentScript as HTMLScriptElement);

    this.forms = Array.from(document.querySelectorAll("form")).filter(
      (form) => Boolean(form.getAttribute("data-id"))
    );
  }

  getLeadSessionId(formId: string): string | null {
    return this.formSessions[formId]?.sessionId || null;
  }

  callFormViewApi(formId: string): void {
    sendBeacon(`${this.config.serverBaseUrl}/externalForm/initialize`, {
      formId,
      environmentId: this.environmentId,
      leadSessionId: this.getLeadSessionId(formId),
    });
  }

  callFormStartedApi(formId: string): void {
    sendBeacon(`${this.config.serverBaseUrl}/externalForm/formStarted`, {
      formId,
      environmentId: this.environmentId,
      leadSessionId: this.getLeadSessionId(formId),
    });
  }

  log(message: string, level: string = "log"): void {
    if (!this.config.debugMode) return;

    switch (level) {
      case "warn":
        console.warn(message);
        break;
      case "error":
        console.error(message);
        break;
      default:
        console.log(message);
        break;
    }
  }

  async identify(formId: string): Promise<void> {
    const apiUrl = `${this.config.serverBaseUrl}/lead/identify`;
    const parentUrl = new URL(this.windowUrl);

    try {
      const response = await fetch(apiUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          formId,
          environmentId: this.environmentId,
          source: "surfaceForm",
          sourceURL: parentUrl.href,
          sourceURLDomain: parentUrl.hostname,
          sourceURLPath: parentUrl.pathname,
          sourceUrlSearchParams: parentUrl.search,
          leadId: null,
          sessionIdFromParams: null,
        }),
      });

      const jsonData = await response.json();
      if (response.ok && jsonData.data?.data?.sessionId) {
        this.formSessions[formId] = jsonData.data.data;
      }
    } catch (error) {
      this.log("Error identifying lead: " + error, "error");
    }
  }

  async initializeForm(formId: string): Promise<void> {
    if (this.formInitializationStatus[formId]) return;
    this.formInitializationStatus[formId] = true;
    await this.identify(formId);
    this.callFormViewApi(formId);
  }

  storeQuestionData(params: {
    formId: string;
    questionId: string;
    variableName?: string;
    value: string;
  }): void {
    const { formId, questionId, value } = params;
    const variableName = params.variableName ?? "value";
    if (!this.formStates[formId]) this.formStates[formId] = {};
    if (!this.formStates[formId][questionId]) this.formStates[formId][questionId] = {};
    this.formStates[formId][questionId][variableName] = value;
  }

  sendBeacon(url: string, payload: Record<string, unknown>): void {
    sendBeacon(url, payload);
  }

  submitForm(form: HTMLFormElement, finished: boolean = false): void {
    const formId = form.getAttribute("data-id")!;
    const responses = Object.entries(this.formStates[formId] || {}).map(
      ([questionId, data]) => ({ questionId, response: data })
    );

    const payload = {
      id: this.responseIds[formId],
      formId,
      responses,
      finished,
      environmentId: this.environmentId,
      leadSessionId: this.getLeadSessionId(formId),
      initialRenderTime: this.initialRenderTime.toISOString(),
    };

    this.log("Submitting form data:" + JSON.stringify(payload));

    if (!this.environmentId) {
      this.log("Skipping form submission: environmentId not configured", "error");
      return;
    }

    fetch(`${this.config.serverBaseUrl}/externalForm/submit`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    })
      .then((r) => r.json())
      .then((data) => {
        if (data?.data?.response?.id) {
          this.responseIds[formId] = data.data.response.id;
          this.log("Response ID stored: " + data.data.response.id);
        }
      })
      .catch((error) => this.log("Error submitting form: " + error, "error"));
  }

  handleInputChange(formId: string, event: Event): void {
    if (!this.formStarted[formId]) {
      this.callFormStartedApi(formId);
      this.formStarted[formId] = true;
    }

    const target = event.target as HTMLElement;
    const elementId = target.getAttribute("data-id") || "";
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

  attachFormHandlers(): void {
    attachFormHandlers(this);
  }
}
