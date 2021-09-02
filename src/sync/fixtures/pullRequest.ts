import { PullRequest } from '../../client/GraphQLClient/types';

export const fixtureUser: any = {
  displayName: 'Some Body',
  name: 'Some Body',
  login: 'somebody',
};
export const fixtureReviewerUser: any = {
  displayName: 'Reviewer User',
  name: 'Reviewer User',
  login: 'reviewer-user',
};
export const fixturePullRequest: PullRequest = {
  additions: 156,
  author: fixtureUser,
  authorAssociation: 'CONTRIBUTOR',
  baseRefName: 'main',
  baseRefOid: '989c2e36df5b7d2e77ff1ab33aaee49bea705066',
  baseRepository: {
    name: 'jupiter-integration-aws',
    nameWithOwner: 'JupiterOne/jupiter-integration-aws',
    owner: {},
  },
  body: 'This is some discription or something',
  changedFiles: 7,
  checksUrl:
    'https://github.com/JupiterOne/jupiter-integration-aws/pull/45/checks',
  closed: true,
  closedAt: '2021-09-01T01:53:34Z',
  createdAt: '2021-08-31T22:15:07Z',
  deletions: 27,
  headRefName: 'autoscaling-policies',
  headRefOid: '1103a7a2e976439ca184f775196759084f16e42f',
  headRepository: {
    name: 'jupiter-integration-aws',
    nameWithOwner: 'JupiterOne/jupiter-integration-aws',
    owner: {},
  },
  id: 'MDExOlB1bGxSZXF1ZXN0NzIzODE1Nzc1',
  isDraft: false,
  lastEditedAt: undefined,
  locked: false,
  mergeCommit: {
    id:
      'MDY6Q29tbWl0Mzg4ODgwNzEwOjM5NDgzYWY4YTM1NmI1Njg0NTEzYmY1NmMwNDRkYWIwZWQ0YzBjN2E=',
    message: 'Merge pull request #45 from JupiterOne/autoscaling-policies',
    authoredDate: '2021-09-01T01:53:35Z',
    changedFiles: 7,
    commitUrl:
      'https://github.com/JupiterOne/jupiter-integration-aws/commit/39483af8a356b5684513bf56c044dab0ed4c0c7a',
    oid: '39483af8a356b5684513bf56c044dab0ed4c0c7a',
    author: {
      date: '2021-08-31T21:53:34-04:00',
      user: fixtureUser,
    },
  },
  mergeable: 'UNKNOWN',
  merged: true,
  mergedAt: '2021-09-01T01:53:34Z',
  mergedBy: fixtureUser,
  number: 45,
  permalink: 'https://github.com/JupiterOne/jupiter-integration-aws/pull/45',
  publishedAt: '2021-08-31T22:15:07Z',
  reviewDecision: 'APPROVED',
  state: 'MERGED',
  title: 'Ingest AutoScaling Policies and build relationships',
  updatedAt: '2021-09-01T01:53:35Z',
  url: 'https://github.com/JupiterOne/jupiter-integration-aws/pull/45',
  commits: [
    {
      id:
        'MDY6Q29tbWl0Mzg4ODgwNzEwOjg5MGFmMjRkOTEzMTA3MTk0ZTljZTk0MzliN2U3MWVhMmIxYjE3YzQ=',
      message:
        'Ingest AutoScaling Policies and build `aws_autoscaling_group` `USES` `aws_autoscaling_policy` relationships',
      authoredDate: '2021-08-31T22:14:45Z',
      changedFiles: 7,
      commitUrl:
        'https://github.com/JupiterOne/jupiter-integration-aws/commit/890af24d913107194e9ce9439b7e71ea2b1b17c4',
      oid: '890af24d913107194e9ce9439b7e71ea2b1b17c4',
      author: {
        date: '2021-08-31T18:14:38-04:00',
        user: fixtureUser,
      },
    },
    {
      id:
        'MDY6Q29tbWl0Mzg4ODgwNzEwOjY5YjNkNTc3MWE1MDc1MmFjZjkzMTBmZDkzYjdhMTc2ZDZjZmZhYTI=',
      message:
        "Merge branch 'main' of github.com:jupiterone/jupiter-integration-aws into autoscaling-policies",
      authoredDate: '2021-08-31T22:17:46Z',
      changedFiles: 0,
      commitUrl:
        'https://github.com/JupiterOne/jupiter-integration-aws/commit/69b3d5771a50752acf9310fd93b7a176d6cffaa2',
      oid: '69b3d5771a50752acf9310fd93b7a176d6cffaa2',
      author: {
        date: '2021-08-31T18:17:39-04:00',
        user: fixtureUser,
      },
    },
    {
      id:
        'MDY6Q29tbWl0Mzg4ODgwNzEwOjExMDNhN2EyZTk3NjQzOWNhMTg0Zjc3NTE5Njc1OTA4NGYxNmU0MmY=',
      message: 'fix _type and _class',
      authoredDate: '2021-08-31T22:19:39Z',
      changedFiles: 2,
      commitUrl:
        'https://github.com/JupiterOne/jupiter-integration-aws/commit/1103a7a2e976439ca184f775196759084f16e42f',
      oid: '1103a7a2e976439ca184f775196759084f16e42f',
      author: {
        date: '2021-08-31T18:19:34-04:00',
        user: fixtureUser,
      },
    },
  ],
  reviews: [
    {
      id: 'MDE3OlB1bGxSZXF1ZXN0UmV2aWV3NzQzMjk0Njkx',
      commit: {
        oid: '1103a7a2e976439ca184f775196759084f16e42f',
      },
      author: fixtureReviewerUser,
      state: 'APPROVED',
      submittedAt: '2021-09-01T00:19:38Z',
      updatedAt: '2021-09-01T00:19:38Z',
      url:
        'https://github.com/JupiterOne/jupiter-integration-aws/pull/45#pullrequestreview-743294691',
    },
  ],
  labels: [],
};
