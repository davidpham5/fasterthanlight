/**
 * A printable description of a failure that never includes request details. Cloudinary's SDK
 * rejects with plain objects whose `request_options.auth` holds the API key and secret, so
 * errors must never be printed or serialised as-is.
 */
export function describeError(error: unknown): string {
  if (error instanceof Error) return error.message;
  type Body = { message?: unknown; http_code?: unknown };
  const hasMessage = (value: unknown): value is Body & { message: string } =>
    typeof value === 'object' && value !== null && typeof (value as Body).message === 'string';
  // The Admin API wraps the body in `error`; the uploader rejects with the bare body.
  const wrapped = (error as { error?: unknown } | null)?.error;
  const body = hasMessage(wrapped) ? wrapped : hasMessage(error) ? error : undefined;
  if (body) {
    const code = body.http_code === undefined ? '' : ` ${String(body.http_code)}`;
    return `Cloudinary API error${code}: ${body.message}`;
  }
  return 'Unknown error (details hidden)';
}
