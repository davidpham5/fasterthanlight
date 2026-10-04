// Decides whether a photo's original carries location data, and how to remove it. Delivered
// (resized) images never carry metadata; the original stored in Cloudinary keeps everything.

/** A photo's metadata: Cloudinary's image_metadata, or tags read by exiftool. */
export type Metadata = Record<string, unknown>;

/** IPTC and XMP place-name fields, as Cloudinary and exiftool name them (without group prefix). */
const PLACE_NAMES = new Set([
  'City',
  'Sub-location',
  'Sublocation',
  'Province-State',
  'State',
  'Country',
  'Country-PrimaryLocationName',
  'Country-PrimaryLocationCode',
  'CountryCode',
  'Location',
]);

function isLocationKey(key: string): boolean {
  return (
    key.startsWith('GPS') ||
    key.startsWith('LocationCreated') ||
    key.startsWith('LocationShown') ||
    PLACE_NAMES.has(key)
  );
}

function hasValue(value: unknown): boolean {
  if (value === null || value === undefined) return false;
  if (Array.isArray(value)) return value.length > 0;
  if (typeof value === 'object') return Object.keys(value).length > 0;
  return String(value).trim() !== '';
}

export function locationFields(meta: Metadata): string[] {
  return Object.entries(meta)
    .filter(([key, value]) => isLocationKey(key) && hasValue(value))
    .map(([key]) => key)
    .sort();
}

export type Verdict =
  | { action: 'keep' }
  | { action: 'strip'; fields: string[] }
  | { action: 'hold'; fields: string[]; reason: string };

/** Only JPEGs are cleaned; anything else with location is held back from the site. */
export function locationVerdict(meta: Metadata, format: string): Verdict {
  const fields = locationFields(meta);
  if (fields.length === 0) return { action: 'keep' };
  if (/^jpe?g$/i.test(format)) return { action: 'strip', fields };
  return {
    action: 'hold',
    fields,
    reason:
      `has location data (${fields.join(', ')}) but is a ${format.toUpperCase()}, and only ` +
      'JPEGs are cleaned automatically. re-export it as a JPEG without location.',
  };
}

/**
 * exiftool arguments that delete GPS and place names only. exiftool rewrites metadata segments
 * without re-encoding, so the image data and camera fields are untouched.
 */
export const STRIP_ARGS: readonly string[] = [
  '-overwrite_original',
  '-gps:all=',
  '-xmp-exif:gps*=',
  '-iptc:city=',
  '-iptc:sub-location=',
  '-iptc:province-state=',
  '-iptc:country-primarylocationname=',
  '-iptc:country-primarylocationcode=',
  '-xmp-photoshop:city=',
  '-xmp-photoshop:state=',
  '-xmp-photoshop:country=',
  '-xmp-iptccore:location=',
  '-xmp-iptccore:countrycode=',
  '-xmp-iptcext:locationcreated=',
  '-xmp-iptcext:locationshown=',
];
