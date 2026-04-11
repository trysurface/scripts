import type { SurfaceExternalForm } from "./external-form";

export function attachFormHandlers(form: SurfaceExternalForm): void {
  if (!form.environmentId) {
    form.log("No environment id configured", "warn");
    return;
  }

  if (form.forms.length === 0) {
    form.log("No forms with data-id attribute found", "warn");
    return;
  }

  form.forms.forEach((htmlForm) => {
    const formId = htmlForm.getAttribute("data-id")!;
    form.log(`Attaching handlers to form: ${formId}`);

    htmlForm
      .querySelectorAll(
        "input[data-id], select[data-id], textarea[data-id], fieldset[data-id]"
      )
      .forEach((el) =>
        el.addEventListener("change", (e) =>
          form.handleInputChange(formId, e)
        )
      );

    const nextButtons = htmlForm.getElementsByClassName("surface-next-button");
    const submitButtons = htmlForm.getElementsByClassName("surface-submit-button");

    if (nextButtons.length > 0) {
      Array.from(nextButtons).forEach((btn) => {
        btn.addEventListener("click", () => form.submitForm(htmlForm, false));
      });
    }

    if (submitButtons.length > 0) {
      Array.from(submitButtons).forEach((btn) => {
        btn.addEventListener("click", (e) => {
          e.preventDefault();
          form.submitForm(htmlForm, true);
        });
      });
    } else {
      htmlForm.addEventListener("submit", (e) => {
        e.preventDefault();
        form.log(`Form ${formId} submitted`);
        form.submitForm(htmlForm, true);
      });
    }

    form.formStates[formId] = {};
    form.formStarted[formId] = false;
    form.initializeForm(formId);
  });
}
