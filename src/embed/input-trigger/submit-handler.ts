import { collectFormFields } from "./field-collection";
import { validateField } from "./field-validation";
import type { SurfaceEmbed } from "../embed";

export function createSubmitHandler(
  embed: SurfaceEmbed,
  form: HTMLFormElement,
  questionId: string
): (e: Event) => void {
  return (e: Event) => {
    e.preventDefault();

    const formFields = collectFormFields(form, questionId);
    const options: Record<string, string | string[]> = {};
    let hasError = false;
    let firstInvalid: HTMLElement | null = null;

    formFields.forEach(({ field, questionId: qId, fieldName, value }) => {
      const isArray = Array.isArray(value);
      const isEmpty = isArray ? value.length === 0 : value === null || value === "";

      if (isEmpty && !field.hasAttribute("required") && !(field as HTMLInputElement).required) {
        return;
      }

      const result = validateField(field, value);
      if (!result.valid) {
        hasError = true;
        if (!firstInvalid) firstInvalid = result.field || field;
        return;
      }

      if (!isEmpty) {
        const key = fieldName ? `${qId}_${fieldName}` : qId;
        options[key] = value!;
      }
    });

    if (hasError && firstInvalid) {
      (firstInvalid as HTMLInputElement).reportValidity();
      return;
    }

    if (Object.keys(options).length > 0) {
      const existingData = Array.isArray(embed.store.partialFilledData)
        ? embed.store.partialFilledData
        : [];

      const dataMap = new Map<string, number>();
      existingData.forEach((entry, index) => {
        const key = Object.keys(entry)[0];
        dataMap.set(key, index);
      });

      Object.entries(options).forEach(([key, value]) => {
        const newEntry = { [key]: value as string };
        if (dataMap.has(key)) {
          existingData[dataMap.get(key)!] = newEntry;
        } else {
          existingData.push(newEntry);
        }
      });

      embed.store.partialFilledData = existingData;

      if (!embed.initialized) embed.initializeEmbed();
      embed.store.notifyIframe(embed.iframe, "STORE_UPDATE");
      embed.showSurfaceForm();
    } else {
      const emailInput = form.querySelector<HTMLInputElement>('input[type="email"]');
      if (emailInput) emailInput.reportValidity();
    }
  };
}

export function createKeyDownHandler(form: HTMLFormElement): (e: Event) => void {
  return (e: Event) => {
    const ke = e as KeyboardEvent;
    if (ke.key !== "Enter") return;

    const active = document.activeElement as HTMLElement;
    const tagName = active.tagName.toLowerCase();
    const type = (active as HTMLInputElement).type?.toLowerCase();

    if (tagName === "textarea") return;
    if (type === "checkbox" || type === "radio") return;

    if (
      (tagName === "input" && type !== "checkbox" && type !== "radio") ||
      tagName === "select"
    ) {
      ke.preventDefault();
      form.dispatchEvent(new Event("submit", { cancelable: true }));
    }
  };
}
