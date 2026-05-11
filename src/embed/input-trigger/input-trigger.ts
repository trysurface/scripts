import { createSubmitHandler, createKeyDownHandler } from "./submit-handler";
import type { SurfaceEmbed } from "../embed";

interface FormHandler {
  form: HTMLFormElement;
  submitHandler: (e: Event) => void;
  keydownHandler: (e: Event) => void;
}

export function formInputTriggerInitialize(this: SurfaceEmbed): void {
  const questionId = this.currentQuestionId || "";

  // Remove previous handlers
  if (this._formHandlers) {
    this._formHandlers.forEach(({ form, submitHandler, keydownHandler }: FormHandler) => {
      form.removeEventListener("submit", submitHandler);
      form.removeEventListener("keydown", keydownHandler);
    });
  }
  this._formHandlers = [];

  // Find matching forms
  const allForms = document.querySelectorAll<HTMLFormElement>("form.surface-form-handler");
  let forms = Array.from(allForms).filter(
    (form) => form.getAttribute("data-question-id") === questionId
  );

  if (forms.length === 0) {
    const formsWithQuestionId = Array.from(allForms).filter((f) =>
      f.hasAttribute("data-question-id")
    );
    if (!formsWithQuestionId.length) {
      forms = Array.from(allForms);
    }
  }

  // Attach handlers
  forms.forEach((form) => {
    const submitHandler = createSubmitHandler(this, form, questionId);
    const keydownHandler = createKeyDownHandler(form);

    form.addEventListener("submit", submitHandler);
    form.addEventListener("keydown", keydownHandler);

    this._formHandlers!.push({ form, submitHandler, keydownHandler });
  });
}
