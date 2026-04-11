import { EXTERNAL_FORM_API } from "../constants";
import { createLogger } from "../utils/logger";
import { sendBeacon } from "../utils/beacon";
import { getSiteIdFromScript } from "../lead/site-id";
import { attachFormHandlers } from "./form-handlers";
import type { Logger, ExternalFormProps } from "../types";

export class SurfaceExternalForm {
  initialRenderTime: Date;
  formStates: Record<string, Record<string, Record<string, string>>>;
  responseIds: Record<string, string>;
  formSessions: Record<string, Record<string, string>>;
  formInitializationStatus: Record<string, boolean>;
  formStarted: Record<string, boolean>;
  config: { serverBaseUrl: string };
  environmentId: string | null;
  forms: HTMLFormElement[];
  log: Logger;

  constructor(props?: ExternalFormProps) {
    this.initialRenderTime = new Date();
    this.formStates = {};
    this.responseIds = {};
    this.formSessions = {};
    this.formInitializationStatus = {};
    this.formStarted = {};
    this.log = createLogger("Surface External Form");

    this.config = {
      serverBaseUrl: props?.serverBaseUrl || EXTERNAL_FORM_API,
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

  async identify(formId: string): Promise<void> {
    const apiUrl = `${this.config.serverBaseUrl}/lead/identify`;
    const parentUrl = new URL(window.location.href);

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
      this.log.error("Error identifying lead: " + error);
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
    variableName: string;
    value: string;
  }): void {
    const { formId, questionId, variableName, value } = params;
    if (!this.formStates[formId]) this.formStates[formId] = {};
    if (!this.formStates[formId][questionId]) this.formStates[formId][questionId] = {};
    this.formStates[formId][questionId][variableName] = value;
  }

  attachFormHandlers(): void {
    attachFormHandlers(this);
  }
}
