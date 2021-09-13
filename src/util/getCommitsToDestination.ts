import { Commit } from '../client/GraphQLClient';

function commitMatches(commit: string, match?: string): boolean {
  // using the length of the proposed match allows for matching shas of
  // different length, so that abcdefghij12345678 matches abcdefghij
  return !!match?.length && commit.slice(0, match.length) === match;
}

export default function getCommitsToDestination(
  commits: Commit[],
  destination: string | undefined,
): Commit[] | undefined {
  const destinationIndex = commits.findIndex((commit) =>
    commitMatches(commit.oid, destination),
  );
  if (destinationIndex < 0) {
    return [];
  }
  return commits.slice(0, destinationIndex + 1);
}
