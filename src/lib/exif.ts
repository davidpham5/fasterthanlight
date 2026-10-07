// Turns a photo's raw EXIF (stored by the sync in photo-log.json) into the grey line under it.
import type { RawExif } from './schema';

export type Override = string | number | undefined;
export interface ExifOverrides {
  camera?: Override;
  lens?: Override;
  focal?: Override;
  aperture?: Override;
  shutter?: Override;
  iso?: Override;
}

const BRANDS: Record<string, string> = {
  FUJIFILM: 'Fujifilm',
  'OLYMPUS CORPORATION': 'Olympus',
  'OLYMPUS IMAGING CORP.': 'Olympus',
  'OM DIGITAL SOLUTIONS': 'OM System',
  'NIKON CORPORATION': 'Nikon',
  'RICOH IMAGING COMPANY, LTD.': 'Ricoh',
  'LEICA CAMERA AG': 'Leica',
  SONY: 'Sony',
  CANON: 'Canon',
  APPLE: 'Apple',
  PANASONIC: 'Panasonic',
};

function brand(make: string): string {
  const known = BRANDS[make.trim().toUpperCase()];
  if (known) return known;
  const first = make.trim().split(/\s+/)[0];
  return first.charAt(0).toUpperCase() + first.slice(1).toLowerCase();
}

function camera(make?: string, model?: string): string | undefined {
  const name = model?.trim();
  const maker = make?.trim() ? brand(make) : undefined;
  if (!name) return maker;
  if (!maker) return name;
  // "Canon EOS 5D Mark II", "NIKON D750": the model already names the brand.
  const rest = name.toUpperCase().startsWith(`${maker.toUpperCase()} `)
    ? name.slice(maker.length + 1)
    : name;
  return `${maker} ${rest}`;
}

/** A positive number, or undefined for missing and nonsense values (f/0, 0mm, ISO 0). */
function positive(value?: string): number | undefined {
  const n = Number.parseFloat(value ?? '');
  return Number.isFinite(n) && n > 0 ? n : undefined;
}

const oneDecimal = (n: number) => String(Math.round(n * 10) / 10);
// Keep up to 2 decimals; String() naturally omits trailing zeros.
const twoDecimals = (n: number) => String(Math.round(n * 100) / 100);
const units = {
  focal: (n: number) => `${oneDecimal(n)}mm`,
  aperture: (n: number) => `f/${twoDecimals(n)}`,
  shutter: (n: number) => `${n}s`,
  iso: (n: number) => `ISO ${Math.round(n)}`,
};

function withUnit(value: string | undefined, unit: (n: number) => string): string | undefined {
  const n = positive(value);
  return n === undefined ? undefined : unit(n);
}

function shutter(value?: string): string | undefined {
  const fraction = /^\s*(\d+)\/(\d+)\s*$/.exec(value ?? '');
  if (!fraction) return withUnit(value, units.shutter);
  return Number(fraction[1]) > 0 && Number(fraction[2]) > 0
    ? `${fraction[1]}/${fraction[2]}s`
    : undefined;
}

function choose(
  override: Override,
  unit: ((n: number) => string) | undefined,
  fallback: string | undefined,
): string | undefined {
  if (override === undefined) return fallback;
  if (typeof override === 'number') return unit ? unit(override) : String(override);
  return override.trim() || undefined;
}

export function cameraLine(raw: RawExif, overrides: ExifOverrides = {}): string {
  return [
    choose(overrides.camera, undefined, camera(raw.make, raw.model)),
    choose(overrides.lens, undefined, raw.lens?.trim() || undefined),
    choose(overrides.focal, units.focal, withUnit(raw.focal, units.focal)),
    choose(overrides.aperture, units.aperture, withUnit(raw.aperture, units.aperture)),
    choose(overrides.shutter, units.shutter, shutter(raw.shutter)),
    choose(overrides.iso, units.iso, withUnit(raw.iso, units.iso)),
  ]
    .filter(Boolean)
    .join(' · ');
}
