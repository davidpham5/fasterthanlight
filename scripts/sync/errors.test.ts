import { describe, expect, it } from 'vitest';
import { describeError } from './errors';

describe('describeError', () => {
  it('returns only the message from a Cloudinary API error, never the request or credentials', () => {
    const cloudinaryError = {
      request_options: { hostname: 'api.cloudinary.com', auth: 'KEY:SECRET' },
      error: { message: 'Request forbidden due to missing permissions', http_code: 403 },
    };
    const text = describeError(cloudinaryError);
    expect(text).toBe('Cloudinary API error 403: Request forbidden due to missing permissions');
    expect(text).not.toContain('SECRET');
  });

  it('returns the message of a normal Error', () => {
    expect(describeError(new Error('boom'))).toBe('boom');
  });

  it('never serialises unknown objects', () => {
    expect(describeError({ auth: 'KEY:SECRET' })).toBe('Unknown error (details hidden)');
  });
});
