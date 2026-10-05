import { describe, expect, it } from 'vitest';
import { cameraLine } from './exif';

const xt3 = {
  make: 'FUJIFILM',
  model: 'X-T3',
  lens: 'XC35mmF2',
  focal: '35.0 mm',
  aperture: '3.2',
  shutter: '1/140',
  iso: '160',
};

describe('cameraLine', () => {
  it('formats a full set of camera data in order', () => {
    expect(cameraLine(xt3)).toBe('Fujifilm X-T3 · XC35mmF2 · 35mm · f/3.2 · 1/140s · ISO 160');
  });

  it('maps known makes to their brand names', () => {
    expect(cameraLine({ make: 'OLYMPUS CORPORATION', model: 'E-M5' })).toBe('Olympus E-M5');
    expect(cameraLine({ make: 'OLYMPUS IMAGING CORP.', model: 'E-P5' })).toBe('Olympus E-P5');
    expect(cameraLine({ make: 'RICOH IMAGING COMPANY, LTD.', model: 'GR III' })).toBe(
      'Ricoh GR III',
    );
    expect(cameraLine({ make: 'LEICA CAMERA AG', model: 'Q2' })).toBe('Leica Q2');
    expect(cameraLine({ make: 'SONY', model: 'ILCE-7M3' })).toBe('Sony ILCE-7M3');
  });

  it("doesn't repeat the brand when the model starts with it", () => {
    expect(cameraLine({ make: 'Canon', model: 'Canon EOS 5D Mark II' })).toBe(
      'Canon EOS 5D Mark II',
    );
    expect(cameraLine({ make: 'NIKON CORPORATION', model: 'NIKON D750' })).toBe('Nikon D750');
  });

  it('title-cases the first word of an unknown make', () => {
    expect(cameraLine({ make: 'HASSELBLAD AB', model: 'X2D' })).toBe('Hasselblad X2D');
  });

  it('shows whatever half of make/model exists', () => {
    expect(cameraLine({ make: 'FUJIFILM' })).toBe('Fujifilm');
    expect(cameraLine({ model: 'X-T3' })).toBe('X-T3');
  });

  it('formats units', () => {
    expect(cameraLine({ focal: '58.0 mm' })).toBe('58mm');
    expect(cameraLine({ focal: '4.2 mm' })).toBe('4.2mm');
    expect(cameraLine({ aperture: '2.0' })).toBe('f/2');
    expect(cameraLine({ aperture: '0.95' })).toBe('f/0.95');
    expect(cameraLine({ aperture: '1.25' })).toBe('f/1.25');
    expect(cameraLine({ aperture: '10' })).toBe('f/10');
    expect(cameraLine({ aperture: '22.0' })).toBe('f/22');
    expect(cameraLine({ shutter: '0.5' })).toBe('0.5s');
    expect(cameraLine({ shutter: '2' })).toBe('2s');
  });

  it('drops nonsense values that manual lenses record', () => {
    expect(
      cameraLine({
        ...xt3,
        lens: '',
        focal: '0.0 mm',
        aperture: '0',
        iso: '0',
        shutter: '1/0',
      }),
    ).toBe('Fujifilm X-T3');
  });

  it('returns an empty string when nothing is known', () => {
    expect(cameraLine({})).toBe('');
  });

  it('lets overrides win: numbers get units, strings are verbatim, empty strings hide', () => {
    expect(
      cameraLine(xt3, {
        lens: 'Helios 44-2',
        focal: 58,
        aperture: 2,
        iso: '',
        shutter: '1/250',
      }),
    ).toBe('Fujifilm X-T3 · Helios 44-2 · 58mm · f/2 · 1/250');
    expect(cameraLine({}, { camera: 'Pentax K1000', iso: 400 })).toBe('Pentax K1000 · ISO 400');
    expect(cameraLine({}, { aperture: 10 })).toBe('f/10');
  });
});
