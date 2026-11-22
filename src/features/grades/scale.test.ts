import { describe, expect, it } from 'vitest';
import { chooseScale, isScale, PRESETS } from './scale';

const AF = [
  { name: 'A', value: 0.9 },
  { name: 'B', value: 0.8 },
  { name: 'C', value: 0.7 },
  { name: 'D', value: 0.6 },
  { name: 'F', value: 0 },
];
const OWN = [
  { name: 'Pass', value: 0.7 },
  { name: 'Fail', value: 0 },
];

describe('PRESETS', () => {
  it('starts with A to F at 90, 80, 70 and 60', () => {
    expect(PRESETS[0]?.cutoffs).toEqual(AF);
  });

  it('are all scales', () => {
    for (const preset of PRESETS) expect(isScale(preset.cutoffs)).toBe(true);
  });
});

describe('chooseScale', () => {
  it('keeps a scale the teacher chose', () => {
    expect(chooseScale({ cutoffs: OWN, isDefault: false }, AF)).toEqual({
      cutoffs: OWN,
      source: 'course',
    });
  });

  it('puts the school’s in place of Canvas’s default, or of none', () => {
    const school = { cutoffs: AF, source: 'school' };
    expect(chooseScale({ cutoffs: OWN, isDefault: true }, AF)).toEqual(school);
    expect(chooseScale(undefined, AF)).toEqual(school);
  });

  it('falls back to Canvas’s default without a school scale', () => {
    expect(chooseScale({ cutoffs: OWN, isDefault: true }, undefined)).toEqual({
      cutoffs: OWN,
      source: 'canvas',
    });
    expect(chooseScale(undefined, undefined)).toBeUndefined();
  });

  it('puts the student’s scale for the course before any other', () => {
    const yours = { cutoffs: AF, source: 'yours' };
    expect(chooseScale({ cutoffs: OWN, isDefault: false }, OWN, AF)).toEqual(
      yours,
    );
    expect(chooseScale({ isDefault: false }, undefined, AF)).toEqual(yours);
    expect(chooseScale(undefined, OWN, AF)).toEqual(yours);
  });

  it('gives a course with a scheme in points no letters', () => {
    expect(chooseScale({ isDefault: false }, AF)).toBeUndefined();
  });
});

describe('isScale', () => {
  it('needs each cutoff under the one above, down to 0', () => {
    expect(isScale(AF)).toBe(true);
    expect(
      isScale([
        { name: 'A', value: 0.8 },
        { name: 'B', value: 0.8 },
        { name: 'F', value: 0 },
      ]),
    ).toBe(false);
    expect(
      isScale([
        { name: 'A', value: 0.9 },
        { name: 'F', value: 0.1 },
      ]),
    ).toBe(false);
    expect(
      isScale([
        { name: 'A', value: 1.2 },
        { name: 'F', value: 0 },
      ]),
    ).toBe(false);
    expect(isScale([{ name: 'F', value: 0 }])).toBe(false);
  });
});
