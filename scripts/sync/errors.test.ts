import { describe, expect, it } from 'vitest';
import { describeError, isNotFound } from './errors';

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

  it('handles the uploader shape, a bare { message, http_code } body', () => {
    const uploaderError = {
      message: 'Invalid Signature',
      http_code: 401,
      request_options: { auth: { api_key: 'KEY123', api_secret: 'SECRET456' } },
    };
    const text = describeError(uploaderError);
    expect(text).toBe('Cloudinary API error 401: Invalid Signature');
    expect(text).not.toContain('KEY123');
    expect(text).not.toContain('SECRET456');
  });

  it('returns the message of a normal Error', () => {
    expect(describeError(new Error('boom'))).toBe('boom');
  });

  it('never serialises unknown objects', () => {
    expect(describeError({ auth: 'KEY:SECRET' })).toBe('Unknown error (details hidden)');
  });
});

describe('isNotFound', () => {
  it('recognises a Cloudinary 404 without reading anything else', () => {
    expect(isNotFound({ error: { message: "Can't find folder", http_code: 404 } })).toBe(true);
    expect(isNotFound({ error: { http_code: 403 } })).toBe(false);
    expect(isNotFound(new Error('404'))).toBe(false);
    expect(isNotFound(null)).toBe(false);
  });
});
