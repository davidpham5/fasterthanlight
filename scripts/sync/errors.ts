/**
 * A printable description of a failure that never includes request details. Cloudinary's SDK
 * rejects with plain objects whose `request_options.auth` holds the API key and secret, so
 * errors must never be printed or serialised as-is.
 */
export function describeError(error: unknown): string {
  if (error instanceof Error) return error.message;
  const api = (error as { error?: { message?: unknown; http_code?: unknown } } | null)?.error;
  if (api && typeof api.message === 'string') {
    const code = api.http_code === undefined ? '' : ` ${String(api.http_code)}`;
    return `Cloudinary API error${code}: ${api.message}`;
  }
  return 'Unknown error (details hidden)';
}
