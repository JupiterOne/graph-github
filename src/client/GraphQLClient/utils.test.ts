import utils, { EnterpriseFeatures } from './utils';

describe('utils', () => {
  test('hasProperties', () => {
    expect(utils.hasProperties(null)).toBeFalsy();
    expect(utils.hasProperties(undefined)).toBeFalsy();
    expect(utils.hasProperties({})).toBeFalsy();
    expect(utils.hasProperties(new Object())).toBeFalsy();
    expect(utils.hasProperties({ dog: 'dog' })).toBeTruthy();
  });

  test('responseToResource', () => {
    expect(
      utils.responseToResource({
        id: 'PR_asdf',
        commits: {
          totalCount: 11,
          nodes: [null, null, null, null, null, { commit: { asdf: 'commit' } }],
          pageInfo: {
            endCursor: 'MTE',
            hasNextPage: false,
          },
        },
        reviews: {
          totalCount: 117,
          nodes: [
            null,
            undefined,
            {
              id: 'asdf',
              commit: null,
              author: {},
              state: 'COMMENTED',
              submittedAt: '2000-04-19T04:33:08Z',
              updatedAt: '2000-04-19T04:33:08Z',
              url: 'https://github.com/',
            },
          ],
          pageInfo: {
            endCursor: 'asdf333',
            hasNextPage: true,
          },
        },
        labels: {
          totalCount: 2,
          nodes: [null, { asdf: 'label' }],
          pageInfo: {
            endCursor: null,
            hasNextPage: false,
          },
        },
      }),
    ).toMatchSnapshot();

    expect(
      utils.responseToResource({
        mergeCommit: {
          id: 'C_kwDOIAVVA9oAKDg1NjNlOWIyZDYzMzRiNzUwZjhmN2I2MzA4NTgxODg5NTBkMmFiOTI',
          associatedPullRequests: {
            nodes: [
              {
                number: 2,
                id: 'PR_kwDOIAVVA84_DshD',
                state: 'MERGED',
                reviewDecision: null,
                url: 'https://github.com/j1-ingest/ubiquitous-umbrella/pull/2',
              },
            ],
          },
          author: {
            user: {
              login: 'VDubber',
            },
          },
        },
      }),
    ).toMatchSnapshot();
  });
  test('#isSupported', () => {
    expect(
      utils.isSupported(
        EnterpriseFeatures.REPO_VULN_ALERT_STATE_ARG,
        '3.3.300',
      ),
    ).toBeFalsy();
    expect(
      utils.isSupported(EnterpriseFeatures.REPO_VULN_ALERT_FIELDS, '3.5.0'),
    ).toBeTruthy();
    expect(
      utils.isSupported(EnterpriseFeatures.REPO_VULN_ALERT_FIELDS, '3.6.3'),
    ).toBeTruthy();
    expect(
      utils.isSupported(EnterpriseFeatures.REPO_VULN_ALERT_FIELDS, ''),
    ).toBeTruthy();
    expect(
      utils.isSupported(EnterpriseFeatures.REPO_VULN_ALERT_FIELDS, null),
    ).toBeTruthy();
  });
});
