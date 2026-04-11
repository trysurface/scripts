import { getFieldValue } from "./field-validation";

export interface CollectedField {
  field: HTMLElement;
  questionId: string;
  fieldName: string;
  value: string | string[] | null;
}

export function collectFormFields(
  form: HTMLFormElement,
  defaultQuestionId: string
): CollectedField[] {
  const fields: CollectedField[] = [];
  const formQuestionId = form.getAttribute("data-question-id") || defaultQuestionId;
  const processedFields = new Set<HTMLElement>();

  const elementsWithQuestionId = form.querySelectorAll("[data-question-id]");
  elementsWithQuestionId.forEach((element) => {
    const questionId = element.getAttribute("data-question-id")!;
    const formField = findFormField(element as HTMLElement);
    if (formField) {
      const fieldNameFromParent = element.getAttribute("data-field-name");
      processField(formField, questionId, fieldNameFromParent, fields, processedFields);
    }
  });

  const elementsWithFieldName = form.querySelectorAll("[data-field-name]");
  elementsWithFieldName.forEach((element) => {
    if (!element.hasAttribute("data-question-id")) {
      const formField = findFormField(element as HTMLElement);
      if (formField && !processedFields.has(formField)) {
        const fieldNameFromParent = element.getAttribute("data-field-name");
        processField(formField, formQuestionId, fieldNameFromParent, fields, processedFields);
      }
    }
  });

  const emailInput = form.querySelector<HTMLInputElement>('input[type="email"]');
  if (emailInput && !processedFields.has(emailInput)) {
    processField(emailInput, formQuestionId, "emailAddress", fields, processedFields);
  }

  return fields;
}

function findFormField(element: HTMLElement): HTMLElement | null {
  const tagName = element.tagName.toLowerCase();
  if (tagName === "input" || tagName === "select" || tagName === "textarea") {
    return element;
  }
  return element.querySelector("input, select, textarea");
}

function processField(
  field: HTMLElement,
  questionId: string,
  fieldNameFromParent: string | null,
  fields: CollectedField[],
  processed: Set<HTMLElement>
): void {
  if (processed.has(field)) return;

  const fieldType = (field as HTMLInputElement).type?.toLowerCase();

  let fieldName: string;
  if (fieldType === "email") {
    fieldName = "emailAddress";
  } else {
    fieldName = fieldNameFromParent || field.getAttribute("data-field-name") || "";
  }

  if ((field as HTMLInputElement).type === "radio") {
    const radioGroupName = (field as HTMLInputElement).name;
    const alreadyProcessed = fields.some(
      (f) =>
        (f.field as HTMLInputElement).type === "radio" &&
        (f.field as HTMLInputElement).name === radioGroupName
    );
    if (alreadyProcessed) return;
  }

  fields.push({
    field,
    questionId,
    fieldName,
    value: getFieldValue(field),
  });
  processed.add(field);
}
