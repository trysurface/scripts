import type { SurfaceExternalForm } from "./external-form";

export function attachFormHandlers(form: SurfaceExternalForm): void {
  if (!form.environmentId) {
    form.log.warn("No environment id configured");
    return;
  }

  if (form.forms.length === 0) {
    form.log.warn("No forms with data-id attribute found");
    return;
  }

  form.forms.forEach((htmlForm) => {
    const formId = htmlForm.getAttribute("data-id")!;
    form.log.info(`Attaching handlers to form: ${formId}`);

    htmlForm
      .querySelectorAll(
        "input[data-id], select[data-id], textarea[data-id], fieldset[data-id]"
      )
      .forEach((el) =>
        el.addEventListener("change", (e) =>
          handleInputChange(form, formId, e as Event)
        )
      );

    const nextButtons = htmlForm.getElementsByClassName("surface-next-button");
    const submitButtons = htmlForm.getElementsByClassName("surface-submit-button");

    if (nextButtons.length > 0) {
      Array.from(nextButtons).forEach((btn) => {
        btn.addEventListener("click", () => submitForm(form, htmlForm, false));
      });
    }

    if (submitButtons.length > 0) {
      Array.from(submitButtons).forEach((btn) => {
        btn.addEventListener("click", (e) => {
          e.preventDefault();
          submitForm(form, htmlForm, true);
        });
      });
    } else {
      htmlForm.addEventListener("submit", (e) => {
        e.preventDefault();
        form.log.info(`Form ${formId} submitted`);
        submitForm(form, htmlForm, true);
      });
    }

    form.formStates[formId] = {};
    form.formStarted[formId] = false;
    form.initializeForm(formId);
  });
}

function handleInputChange(
  form: SurfaceExternalForm,
  formId: string,
  event: Event
): void {
  if (!form.formStarted[formId]) {
    form.callFormStartedApi(formId);
    form.formStarted[formId] = true;
  }

  const target = event.target as HTMLElement;
  const elementId = target.getAttribute("data-id") || "";
  const [questionId, variableName] = elementId.includes("_")
    ? elementId.split("_")
    : [elementId, null];
  const value = (target as HTMLInputElement).value;

  form.log.info(
    `Form ${formId} element changed - Question ID: ${questionId}, Variable Name: ${variableName}, Value: ${value}`
  );

  form.storeQuestionData({
    formId,
    questionId,
    variableName: variableName ?? "value",
    value,
  });
}

function submitForm(
  form: SurfaceExternalForm,
  htmlForm: HTMLFormElement,
  finished: boolean
): void {
  const formId = htmlForm.getAttribute("data-id")!;
  const responses = Object.entries(form.formStates[formId] || {}).map(
    ([questionId, data]) => ({ questionId, response: data })
  );

  const payload = {
    id: form.responseIds[formId],
    formId,
    responses,
    finished,
    environmentId: form.environmentId,
    leadSessionId: form.getLeadSessionId(formId),
    initialRenderTime: form.initialRenderTime.toISOString(),
  };

  form.log.info("Submitting form data");

  if (!form.environmentId) {
    form.log.error("Skipping form submission: environmentId not configured");
    return;
  }

  fetch(`${form.config.serverBaseUrl}/externalForm/submit`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  })
    .then((r) => r.json())
    .then((data) => {
      if (data?.data?.response?.id) {
        form.responseIds[formId] = data.data.response.id;
        form.log.info("Response ID stored: " + data.data.response.id);
      }
    })
    .catch((error) => form.log.error("Error submitting form: " + error));
}
