import { test, expect } from 'bun:test';
import { calculateAverage, type VotedTiers } from './helper';
test('huh', () => {
  const votes: VotedTiers = {
    S: [
      { name: 'Ron', avatar: 'astronaut' },
      { name: 'Rach', avatar: 'apple' },
    ],
    A: [],
    B: [{ name: 'Ron', avatar: 'astronaut' }],
    C: [],
    D: [],
    E: [],
    F: [
      { name: 'Ron', avatar: 'astronaut' },
      { name: 'Rach', avatar: 'apple' },
    ],
  };
  expect(calculateAverage(votes)).toBe('C');

  const votes2: VotedTiers = {
    S: [],
    A: [],
    B: [{ name: 'Ron', avatar: 'astronaut' }],
    C: [],
    D: [{ name: 'Ron', avatar: 'astronaut' }],
    E: [],
    F: [],
  };
  expect(calculateAverage(votes2)).toBe('C');
});
