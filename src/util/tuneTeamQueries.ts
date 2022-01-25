// find the position (starting from 1) that the slug will be in an ascending sort query on GitHub
// given that GitHub will return all team names that CONTAIN (not equal) the slug string
export function findTeamSlugPositionInAscQuery(
  slug: string,
  teamNames: string[],
): number {
  const slugsGitHubWillReturn: string[] = [];
  for (const name of teamNames) {
    if (name.includes(slug)) {
      slugsGitHubWillReturn.push(name);
    }
  }
  slugsGitHubWillReturn.sort();
  return slugsGitHubWillReturn.findIndex((e) => e === slug) + 1;
}

// find the position (starting from 1) that the slug will be in a descending sort query on GH
export function calculateDesQueryPosition(
  namesLength: number,
  ascSortPosition: number,
): number {
  return namesLength - ascSortPosition + 1;
}

export function tuneTeamQuery(
  slug: string,
  teamNames: string[],
  query: string,
): string {
  const ascSortPosition = findTeamSlugPositionInAscQuery(slug, teamNames);
  const desSortPosition = calculateDesQueryPosition(
    teamNames.length,
    ascSortPosition,
  );
  if (ascSortPosition <= desSortPosition) {
    // the comma in the substitution is important to not change the subquery
    return query.replace('first: 1,', `first: ${ascSortPosition},`);
  } else {
    return query
      .replace('first: 1,', `first: ${desSortPosition},`)
      .replace('direction: ASC', 'direction: DESC');
  }
}
