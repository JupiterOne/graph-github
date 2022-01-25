export function isTeamSlugShadowed(slug: string, teamNames: string[]): Boolean {
  const slugsGitHubWillReturn: string[] = [];
  for (const name of teamNames) {
    if (name.includes(slug)) {
      slugsGitHubWillReturn.push(name);
    }
  }
  slugsGitHubWillReturn.sort();
  if (slugsGitHubWillReturn[0] !== slug) {
    return true;
  }
  return false;
}
