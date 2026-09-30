import { describe, expect, it } from 'vitest';
import { pagePath } from './url';

describe('pagePath', () => {
  it('turns built file paths into the public URL path Netlify serves', () => {
    expect(pagePath('/index.html')).toBe('/');
    expect(pagePath('/about.html')).toBe('/about');
    expect(pagePath('/gallery/special-events.html')).toBe('/gallery/special-events');
  });

  it('leaves clean paths alone', () => {
    expect(pagePath('/')).toBe('/');
    expect(pagePath('/about')).toBe('/about');
    expect(pagePath('/about/')).toBe('/about');
  });
});
