import { describe, expect, it } from 'vitest';
import { STRIP_ARGS, locationFields, locationVerdict } from './location';

// Shaped like Cloudinary's image_metadata for one of David's Fujifilm exports.
const camera = {
  Make: 'FUJIFILM',
  Model: 'X-T3',
  LensModel: 'XC35mmF2',
  FNumber: '2.2',
  DateTimeOriginal: '2026:08:02 20:29:40',
  CopyrightNotice: '',
};

describe('locationFields', () => {
  it('finds nothing in camera-only metadata', () => {
    expect(locationFields(camera)).toEqual([]);
  });

  it('finds GPS tags', () => {
    expect(
      locationFields({ ...camera, GPSLatitude: '40 deg 40\' 12.00" N', GPSVersionID: '2.3.0.0' }),
    ).toEqual(['GPSLatitude', 'GPSVersionID']);
  });

  it('finds IPTC and XMP place names', () => {
    expect(
      locationFields({
        ...camera,
        City: 'Brooklyn',
        'Sub-location': 'Park Slope',
        'Province-State': 'NY',
        'Country-PrimaryLocationName': 'USA',
        'Country-PrimaryLocationCode': 'US',
        State: 'NY',
        Country: 'USA',
        CountryCode: 'US',
        Location: 'Prospect Park',
      }),
    ).toEqual([
      'City',
      'Country',
      'Country-PrimaryLocationCode',
      'Country-PrimaryLocationName',
      'CountryCode',
      'Location',
      'Province-State',
      'State',
      'Sub-location',
    ]);
  });

  it('finds XMP location structures, flattened or not', () => {
    expect(
      locationFields({ LocationCreatedCity: 'Brooklyn', LocationShown: [{ City: 'Brooklyn' }] }),
    ).toEqual(['LocationCreatedCity', 'LocationShown']);
  });

  it("empty values aren't location", () => {
    expect(
      locationFields({ City: '', 'Sub-location': '   ', GPSLatitude: null, LocationShown: [] }),
    ).toEqual([]);
  });
});

describe('locationVerdict', () => {
  it('keeps a photo without location', () => {
    expect(locationVerdict(camera, 'jpg')).toEqual({ action: 'keep' });
  });

  it('strips a JPEG with location', () => {
    expect(locationVerdict({ ...camera, City: 'Brooklyn' }, 'jpg')).toEqual({
      action: 'strip',
      fields: ['City'],
    });
    expect(locationVerdict({ GPSLatitude: '1' }, 'JPEG')).toMatchObject({ action: 'strip' });
  });

  it('holds back any other format with location, and says what to do', () => {
    const verdict = locationVerdict({ GPSLatitude: '1' }, 'heic');
    expect(verdict).toMatchObject({ action: 'hold', fields: ['GPSLatitude'] });
    expect(verdict.action === 'hold' && verdict.reason).toMatch(/HEIC.*re-export it as a JPEG/);
  });

  it('keeps any format without location', () => {
    expect(locationVerdict(camera, 'heic')).toEqual({ action: 'keep' });
  });
});

describe('STRIP_ARGS', () => {
  it('overwrites in place and deletes GPS and place names, not whole metadata groups', () => {
    expect(STRIP_ARGS[0]).toBe('-overwrite_original');
    expect(STRIP_ARGS).toContain('-gps:all=');
    expect(STRIP_ARGS).toContain('-iptc:city=');
    expect(STRIP_ARGS).not.toContain('-all=');
    expect(STRIP_ARGS).not.toContain('-exif:all=');
  });
});
