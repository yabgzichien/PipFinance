// src/lib/diagnosticsScrub.ts
// Pure redaction helpers for crash reports. No Sentry import lives here on purpose: this is the
// part that has to be readable and testable on its own, because it is the only thing standing
// between a crash message and a user's financial data leaving the phone.

/** A JS expression like `txn.merchant.name` or `rows[3].amount` — a code path, not user data. */
const IDENTIFIER_PATH = /^[A-Za-z_$][\w$]*(?:\.[A-Za-z_$][\w$]*|\[\d+\])*$/;
const QUOTED = /(['"`])(.*?)\1/g;
const DECIMAL = /\b\d+\.\d+\b/g;
/** Three digits is where an integer stops reading as an index/count and starts reading as money. */
const LONG_INT = /\b\d{3,}\b/g;

/**
 * Strip user data out of a fatal error's message while keeping it diagnostic.
 *
 * Fatal messages can't be rewritten at the throw site the way handled ones can, so they get
 * redacted instead. The quoted-span rule is the interesting one: Hermes reports type errors as
 * `undefined is not an object (evaluating 'txn.merchant.name')`, where the quoted text is the
 * single most useful part of the report — but `Cannot parse "STARBUCKS KLCC RM23.50"` puts a
 * merchant and an amount in exactly the same position. Quoted text survives only if it parses
 * as an identifier path; anything else is data by default.
 */
export function redactFatalMessage(message: string): string {
  const withoutQuotedData = message.replace(QUOTED, (whole, quote: string, inner: string) =>
    IDENTIFIER_PATH.test(inner) ? whole : `${quote}<str>${quote}`
  );
  return withoutQuotedData.replace(DECIMAL, '<num>').replace(LONG_INT, '<num>');
}

/** A real stack frame: `at fn (file.ts:12:3)` or `at file.ts:12:3`. The trailing line:col is what
 *  separates a frame from a wrapped message line that happens to contain the word "at". */
const STACK_FRAME = /^\s+at\s.*\d+:\d+/;

/**
 * Keep a stack's frames and discard everything else.
 *
 * A thrown error's `stack` begins with its message, which for this app routinely means a merchant
 * name or an amount. Handled reports are rebuilt around a hand-written tag instead, so the frames
 * are the only part worth carrying over — and they must arrive without the header they came with.
 * Returns undefined rather than a frameless string, so a caller can never accidentally forward a
 * bare message as if it were a stack.
 */
export function sanitizeStack(stack: string | undefined | null): string | undefined {
  if (!stack) return undefined;
  const frames = stack.split('\n').filter((line) => STACK_FRAME.test(line));
  return frames.length > 0 ? frames.join('\n') : undefined;
}

/** The error's class name, which is safe to send. Thrown non-errors report as `NonError` rather
 *  than being stringified, since in this app the thrown value is often the data that broke. */
export function handledErrorName(err: unknown): string {
  if (!(err instanceof Error)) return 'NonError';
  return err.constructor?.name || 'Error';
}

/** What a crash report needs to be actionable: which handset, which chip. Everything else the SDK
 *  offers about the device is either volatile or high-entropy. */
const DEVICE_FIELDS_KEPT = ['model', 'family', 'arch', 'manufacturer', 'brand', 'simulator'] as const;

/**
 * Cut the device context down to the fields that help triage a crash.
 *
 * The SDK's default device context also carries battery level, free memory, boot time and screen
 * density — individually harmless, collectively a usable fingerprint. Since reports already carry
 * a deliberately chosen install id, none of that needs to travel with them.
 */
export function reduceDeviceContext(device: Record<string, unknown>): Record<string, unknown> {
  const kept: Record<string, unknown> = {};
  for (const field of DEVICE_FIELDS_KEPT) {
    if (device[field] !== undefined) kept[field] = device[field];
  }
  return kept;
}
