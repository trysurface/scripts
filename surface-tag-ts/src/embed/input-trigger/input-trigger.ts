export interface InputTriggerContext {
  currentQuestionId: string | null;
  initialized: boolean;
  getIframe(): HTMLIFrameElement | null;  // Changed to getter for dynamic access
  _formHandlers: Array<{ form: HTMLFormElement; submitHandler: (e: Event) => void; keydownHandler: (e: KeyboardEvent) => void }>;
  initializeEmbed(): void;
  showSurfaceForm(): void;
}

export function formInputTriggerInitialize(context: InputTriggerContext) {
  const e = context.currentQuestionId;
  if (context._formHandlers) {
    context._formHandlers.forEach(({ form, submitHandler, keydownHandler }) => {
      form.removeEventListener("submit", submitHandler);
      form.removeEventListener("keydown", keydownHandler);
    });
    context._formHandlers = [];
  } else {
    context._formHandlers = [];
  }

  let forms: HTMLFormElement[] = [];

  const allForms = document.querySelectorAll("form.surface-form-handler");
  forms = Array.from(allForms).filter(
    (form) => form.getAttribute("data-question-id") === e
  ) as HTMLFormElement[];

  if (forms.length === 0) {
    forms = Array.from(allForms) as HTMLFormElement[];
  }

  const handleSubmitCallback = (t: HTMLFormElement) => (n: Event) => {
    n.preventDefault();
    const o = t.querySelector('input[type="email"]') as HTMLInputElement,
      c = o?.value.trim();
    if (o && c && /^[^\s@]+@[^\s@]+\.[a-zA-Z]{2,}$/.test(c) && e) {
      const options: Record<string, string> = {
        [`${e}_emailAddress`]: c,
      };
      if (options) {
        const store = (window as any).SurfaceTagStore;
        if (store) {
          const existingData = Array.isArray(store.partialFilledData)
            ? store.partialFilledData
            : [];

          const dataMap = new Map<string, number>();
          existingData.forEach((entry: any, index: number) => {
            const key = Object.keys(entry)[0];
            dataMap.set(key, index);
          });

          Object.entries(options).forEach(([key, value]) => {
            const newEntry = { [key]: value };

            const index = dataMap.get(key);
            if (index !== undefined) {
              existingData[index] = newEntry;
            } else {
              existingData.push(newEntry);
            }
          });

          store.partialFilledData = existingData;
          if (!context.initialized) {
            context.initializeEmbed();
          }
          store.notifyIframe(context.getIframe(), "STORE_UPDATE");
          context.showSurfaceForm();
        }
      }
    } else {
      o?.reportValidity();
    }
  };

  const handleKeyDownCallback = (t: HTMLFormElement) => (n: KeyboardEvent) => {
    if (n.key === "Enter" && (document.activeElement as HTMLInputElement)?.type === "email") {
      n.preventDefault();

      t.dispatchEvent(new Event("submit", { cancelable: true }));
    }
  };

  if (forms.length > 0) {
    forms.forEach((form) => {
      const submitHandler = handleSubmitCallback(form);
      const keydownHandler = handleKeyDownCallback(form);
      form.addEventListener("submit", submitHandler);
      form.addEventListener("keydown", keydownHandler);
      context._formHandlers.push({ form, submitHandler, keydownHandler });
    });
  }
}
