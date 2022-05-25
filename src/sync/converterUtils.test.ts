import { buildVulnAlertRecommendation } from './converterUtils';
import { VulnerabilityAlertResponse } from '../client/GraphQLClient';

describe('converterUtils', () => {
  test('buildVulnAlertRecommendation without securityVulnerability', () => {
    // securityVulnerability is not a required field of RepositoryVulnerabilityAlert
    // See more here: https://docs.github.com/en/graphql/reference/objects#repositoryvulnerabilityalert
    expect(
      buildVulnAlertRecommendation({} as VulnerabilityAlertResponse),
    ).toBeUndefined();
  });

  test('buildVulnAlertRecommendation with patched version identifier', () => {
    const alert = {
      securityVulnerability: {
        package: {
          ecosystem: 'NPM',
          name: 'my-npm-package',
        },
        firstPatchedVersion: {
          identifier: '3.4.2',
        },
      },
    } as VulnerabilityAlertResponse;

    expect(buildVulnAlertRecommendation(alert)).toBe(
      'Update NPM package "my-npm-package" to >= 3.4.2',
    );
  });
  test('buildVulnAlertRecommendation with vulnerableVersionRange', () => {
    const alert = {
      securityVulnerability: {
        package: {
          ecosystem: 'NPM',
          name: 'my-npm-package',
        },
        vulnerableVersionRange: '>= 3.0.0, < 3.0.1',
      },
    } as VulnerabilityAlertResponse;

    expect(buildVulnAlertRecommendation(alert)).toBe(
      'Update NPM package "my-npm-package". Vulnerable version range: >= 3.0.0, < 3.0.1',
    );
  });
});
