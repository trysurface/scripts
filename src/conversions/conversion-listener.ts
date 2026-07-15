import type { Logger } from "../types";
import { fireConversion, type ConversionProvider } from "./providers";

// Wire contract with the iframe (surface_forms form-render). Keep in sync.
const CONVERSION_MESSAGE_TYPE = "surface:conversion";
const CONVERSION_ACK_TYPE = "surface:conversion:ack";

const VALID_PROVIDERS: ConversionProvider[] = ["x", "meta", "ga4", "linkedin"];

// Idempotency: a form may retry a send; only fire once per message id.
const firedIds = new Set<string>();

interface ConversionMessage {
  type: typeof CONVERSION_MESSAGE_TYPE;
  id: string;
  provider: ConversionProvider;
  event: Record<string, string>;
  response_id: string;
  email?: string;
  twclid?: string;
  fbclid?: string;
  gclid?: string;
  li_fat_id?: string;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const isConversionMessage = (data: any): data is ConversionMessage =>
  !!data &&
  data.type === CONVERSION_MESSAGE_TYPE &&
  typeof data.id === "string" &&
  VALID_PROVIDERS.includes(data.provider) &&
  !!data.event &&
  typeof data.response_id === "string";

// Handles a `surface:conversion` message from a Surface form iframe: fires the
// pixel in this (parent) page, then acks so the iframe knows not to fall back to
// in-frame firing. The caller guarantees the origin is already trusted (checked
// in the shared message listener against SURFACE_DOMAINS).
export const handleConversionMessage = (event: MessageEvent, log: Logger): void => {
  const data = event.data;
  if (!isConversionMessage(data)) return;

  // Ack unconditionally (after the best-effort fire below) — even when firing
  // is blocked by an ad blocker, the iframe shouldn't double-fire in-frame.
  // fireConversion swallows all errors, so the ack is always reached.
  const ack = () => {
    try {
      (event.source as WindowProxy | null)?.postMessage(
        { type: CONVERSION_ACK_TYPE, id: data.id },
        event.origin
      );
    } catch {
      /* no-op */
    }
  };

  if (firedIds.has(data.id)) {
    ack();
    return;
  }
  firedIds.add(data.id);

  const fired = fireConversion(data.provider, data.event, {
    response_id: data.response_id,
    email: data.email,
    twclid: data.twclid,
    fbclid: data.fbclid,
    gclid: data.gclid,
    li_fat_id: data.li_fat_id,
  });

  log.info({
    message: "Conversion handled",
    response: { provider: data.provider, responseId: data.response_id, fired },
  });

  ack();
};

export { CONVERSION_MESSAGE_TYPE };
