import {
  PullRequestResponse,
  PullRequestUser,
} from '../../client/GraphQLClient/types';
import { UserEntity } from '../../types';

export const fixtureUser: UserEntity = {
  displayName: 'Some Body',
  name: 'Some Body',
  login: 'somebody',
} as unknown as UserEntity;
export const pullRequestUser: PullRequestUser = {
  login: fixtureUser.login,
  name: fixtureUser.name as string,
};
export const fixtureReviewerUser: UserEntity = {
  displayName: 'Reviewer User',
  name: 'Reviewer User',
  login: 'reviewer-user',
} as unknown as UserEntity;
export const pullRequestReviewer: PullRequestUser = {
  login: fixtureReviewerUser.login,
  name: fixtureReviewerUser.name as string,
};
export const fixturePullRequest: PullRequestResponse = {
  author: {
    login: fixtureUser.login,
    name: fixtureUser.name as string,
  },
  baseRefName: 'main',
  baseRefOid: '989c2e36df5b7d2e77ff1ab33aaee49bea705066',
  baseRepository: {
    name: 'jupiter-integration-aws',
    owner: {
      login: 'JupiterOne',
    },
  },
  body: 'This is some discription or something',
  changedFiles: 7,
  createdAt: '2021-08-31T22:15:07Z',
  headRefName: 'autoscaling-policies',
  headRefOid: '1103a7a2e976439ca184f775196759084f16e42f',
  headRepository: {
    name: 'jupiter-integration-aws',
    owner: {
      login: 'JupiterOne',
    },
  },
  id: 'MDExOlB1bGxSZXF1ZXN0NzIzODE1Nzc1',
  mergeCommit: {
    commitUrl:
      'https://github.com/JupiterOne/jupiter-integration-aws/commit/39483af8a356b5684513bf56c044dab0ed4c0c7a',
    oid: '39483af8a356b5684513bf56c044dab0ed4c0c7a',
  },
  merged: true,
  mergedAt: '2021-09-01T01:53:34Z',
  mergedBy: pullRequestUser,
  number: 45,
  reviewDecision: 'APPROVED',
  state: 'MERGED',
  title: 'Ingest AutoScaling Policies and build relationships',
  updatedAt: '2021-09-01T01:53:35Z',
  url: 'https://github.com/JupiterOne/jupiter-integration-aws/pull/45',
  commits: [
    {
      message:
        'Ingest AutoScaling Policies and build `aws_autoscaling_group` `USES` `aws_autoscaling_policy` relationships',
      authoredDate: '2021-08-31T22:14:45Z',
      oid: '890af24d913107194e9ce9439b7e71ea2b1b17c4',
      author: {
        user: pullRequestUser,
      },
    },
    {
      message:
        "Merge branch 'main' of github.com:jupiterone/jupiter-integration-aws into autoscaling-policies",
      authoredDate: '2021-08-31T22:17:46Z',
      oid: '69b3d5771a50752acf9310fd93b7a176d6cffaa2',
      author: {
        user: pullRequestUser,
      },
    },
    {
      message: 'fix _type and _class',
      authoredDate: '2021-08-31T22:19:39Z',
      oid: '1103a7a2e976439ca184f775196759084f16e42f',
      author: {
        user: pullRequestUser,
      },
    },
  ],
  reviews: [
    {
      commit: {
        oid: '1103a7a2e976439ca184f775196759084f16e42f',
      },
      author: pullRequestReviewer,
      state: 'APPROVED',
    },
  ],
  labels: [],
};
