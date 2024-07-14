type Person = {
  name: string;
  avatar: string;
};

export type VotedTiers = {
  S: Person[];
  A: Person[];
  B: Person[];
  C: Person[];
  D: Person[];
  E: Person[];
  F: Person[];
};

export const initializeVotedTiers = (): VotedTiers => {
  return {
    S: [],
    A: [],
    B: [],
    C: [],
    D: [],
    E: [],
    F: [],
  };
};

export function calculateAverage(votes: VotedTiers) {
  const tierValues: { [key: string]: number } = {
    S: 0,
    A: 1,
    B: 2,
    C: 3,
    D: 4,
    E: 5,
    F: 6,
  };

  // calculate the sum of all the votes
  const sum = Object.keys(votes).reduce((acc, curr) => {
    const val = votes[curr as keyof VotedTiers];
    const bias = tierValues[curr];
    return acc + bias * val.length;
  }, 0);

  const numberOfVotes = Object.values(votes).reduce(
    (acc, val) => acc + val.length,
    0
  );

  const average = sum / numberOfVotes;

  const roundedAverage = Math.round(average);

  for (const [key, val] of Object.entries(tierValues)) {
    if (val === roundedAverage) {
      return key;
    }
  }
}
