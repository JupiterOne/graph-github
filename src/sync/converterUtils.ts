import { VulnerabilityAlertResponse } from '../client/GraphQLClient';

export function buildVulnAlertRecommendation(
  alert: VulnerabilityAlertResponse,
): string | undefined {
  if (!alert.securityVulnerability) {
    return;
  }
  return (
    `Update ${alert.securityVulnerability.package.ecosystem} package ` +
    `"${alert.securityVulnerability.package.name}" to >= ${alert.securityVulnerability.firstPatchedVersion.identifier}`
  );
}

export function buildVulnAlertId(alert: VulnerabilityAlertResponse) {
  return `ghva_${alert.repository.nameWithOwner}_${alert.number}`;
}
