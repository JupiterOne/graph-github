import { VulnerabilityAlertResponse } from '../client/GraphQLClient';

export function buildVulnAlertRecommendation(
  alert: VulnerabilityAlertResponse,
): string | undefined {
  if (!alert.securityVulnerability) {
    return;
  }

  const packageRecommendation =
    `Update ${alert.securityVulnerability.package.ecosystem} package ` +
    `"${alert.securityVulnerability.package.name}"`;

  if (alert.securityVulnerability.firstPatchedVersion?.identifier) {
    return `${packageRecommendation} to >= ${alert.securityVulnerability.firstPatchedVersion.identifier}`;
  } else {
    return `${packageRecommendation}. Vulnerable version range: ${alert.securityVulnerability.vulnerableVersionRange}`;
  }
}

export function buildVulnAlertId(alert: VulnerabilityAlertResponse) {
  return `ghva_${alert.repository.nameWithOwner}_${alert.number}`;
}

/**
 * Finds the nested CVE.
 * @param alert
 */
export function findCve(
  alert: VulnerabilityAlertResponse,
): { type: string; value: string } | undefined {
  return alert.securityAdvisory?.identifiers?.find((id) => id.type === 'CVE');
}
