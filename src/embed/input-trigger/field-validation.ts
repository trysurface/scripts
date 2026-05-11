interface ValidationResult {
  valid: boolean;
  field: HTMLElement | null;
}

export function getFieldValue(field: HTMLElement): string | string[] | null {
  const tagName = field.tagName.toLowerCase();
  const type = (field as HTMLInputElement).type?.toLowerCase();

  if (tagName === "select") {
    const select = field as HTMLSelectElement;
    if (select.multiple) {
      return Array.from(select.selectedOptions).map((opt) => opt.value);
    }
    return select.value;
  }

  if (tagName === "textarea") {
    return (field as HTMLTextAreaElement).value.trim();
  }

  if (tagName === "input") {
    const input = field as HTMLInputElement;
    if (type === "checkbox") {
      return input.checked ? input.value || "true" : null;
    }
    if (type === "radio") {
      const group = document.querySelectorAll<HTMLInputElement>(
        `input[type="radio"][name="${input.name}"]`
      );
      const checked = Array.from(group).find((r) => r.checked);
      return checked ? checked.value : null;
    }
    return input.value.trim();
  }

  return null;
}

export function validateField(
  field: HTMLElement,
  value: string | string[] | null
): ValidationResult {
  const isArray = Array.isArray(value);
  const isEmpty = isArray ? value.length === 0 : value === null || value === "";

  if (isEmpty) {
    if (field.hasAttribute("required") || (field as HTMLInputElement).required) {
      return { valid: false, field };
    }
    return { valid: true, field: null };
  }

  const type = (field as HTMLInputElement).type?.toLowerCase();

  if (type === "email") {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[a-zA-Z]{2,}$/;
    const values = isArray ? value : [value];
    if (!values.every((v) => emailRegex.test(v!))) {
      return { valid: false, field };
    }
  }

  if (field.hasAttribute("pattern")) {
    const pattern = new RegExp(field.getAttribute("pattern")!);
    const values = isArray ? value : [value];
    if (!values.every((v) => pattern.test(v!))) {
      return { valid: false, field };
    }
  }

  if (field.hasAttribute("minlength")) {
    const minLength = parseInt(field.getAttribute("minlength")!);
    if ((value as string | string[]).length < minLength) {
      return { valid: false, field };
    }
  }

  if (field.hasAttribute("maxlength")) {
    const maxLength = parseInt(field.getAttribute("maxlength")!);
    if ((value as string | string[]).length > maxLength) {
      return { valid: false, field };
    }
  }

  if (!(field as HTMLInputElement).checkValidity()) {
    return { valid: false, field };
  }

  return { valid: true, field: null };
}
