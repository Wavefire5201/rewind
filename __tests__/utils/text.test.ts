import { nounFor, plural } from '@/utils/text';

it('uses the singular only for exactly one', () => {
  expect(plural(1, 'photo')).toBe('1 photo');
  expect(plural(0, 'photo')).toBe('0 photos');
  expect(plural(2, 'photo')).toBe('2 photos');
  expect(nounFor(1, 'photo')).toBe('photo');
  expect(nounFor(5, 'photo')).toBe('photos');
});
