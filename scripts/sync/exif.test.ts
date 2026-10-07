import { describe, expect, it } from 'vitest';
import { pickExif } from './exif';

describe('pickExif', () => {
  it("picks the camera fields from Cloudinary's image_metadata and drops empty ones", () => {
    expect(
      pickExif({
        Make: 'FUJIFILM',
        Model: 'X-T3',
        LensModel: 'XC35mmF2',
        FocalLength: '35.0 mm',
        FNumber: '2.2',
        ExposureTime: '1/15',
        ISO: '800',
        DateTimeOriginal: '2026:08:02 20:29:40',
        Artist: '',
        SerialNumber: '8DA14510',
      }),
    ).toEqual({
      make: 'FUJIFILM',
      model: 'X-T3',
      lens: 'XC35mmF2',
      focal: '35.0 mm',
      aperture: '2.2',
      shutter: '1/15',
      iso: '800',
      takenAt: '2026:08:02 20:29:40',
    });
    expect(pickExif({ Make: ' ', Model: 'Canon EOS 5D Mark II' })).toEqual({
      model: 'Canon EOS 5D Mark II',
    });
  });
});
