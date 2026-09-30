// Loaded once at build time. Invalid content throws, which fails the build.
import siteJson from '../content/site.json';
import photosJson from '../content/photos.json';
import { loadContent } from './schema';

export const { site, sets, hero, portrait } = loadContent(siteJson, photosJson);
