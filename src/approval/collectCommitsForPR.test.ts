import {
  createMockStepExecutionContext,
  Recording,
  createMockIntegrationLogger,
} from '@jupiterone/integration-sdk-testing';

import collectCommitsForPR from './collectCommitsForPR';
import { AccountEntity, PullsListResponseItem } from '../types';
import { setupGithubRecording } from '../../test/recording';
import { IntegrationConfig, sanitizeConfig } from '../config';
import { integrationConfig } from '../../test/config';
import createGitHubAppClient from '../util/createGitHubAppClient';
import resourceMetadataMap from '../client/GraphQLClient/resourceMetadataMap';
import OrganizationAccountClient from '../client/OrganizationAccountClient';
import { GitHubGraphQLClient } from '../client/GraphQLClient';

let p: Recording; //p for polly

afterEach(async () => {
  await p.stop();
});

function commitExpectationsFromShas(...shas: string[]) {
  return shas.map((sha) => expect.objectContaining({ sha }));
}

function collectCommitsForPRTest({
  title,
  recordingName,
  prId,
  expected,
  teamMembers,
}: {
  title: string;
  recordingName: string;
  prId: number;
  expected: any;
  teamMembers?: any[];
}) {
  return test(title, async () => {
    p = setupGithubRecording({
      directory: __dirname,
      name: recordingName,
      options: {
        matchRequestsBy: {
          headers: false,
        },
      },
    });

    const context = createMockStepExecutionContext<IntegrationConfig>({
      instanceConfig: integrationConfig,
    });

    //mutate config with installation ID 953957, which is used in recordings
    const config = context.instance.config;
    sanitizeConfig(config);
    config.installationId = 953957;
    //config.githubAppPrivateKey = '-----BEGIN RSA PRIVATE KEY-----MIIEowIBAAKCAQEA0g7LvR7i2TxTxBnNdP7c/pgJ5lNWhQdw48nf8/xBF8M6ixQFDZPnrSxjUt3+R8C3382ZpVu3xBaXO12G8/ubrqP2qIU/eBHzm1rHCmOXxPa6jec1-----END RSA PRIVATE KEY----';

    const logger = createMockIntegrationLogger();
    const token = 'faketoken';
    const appClient = createGitHubAppClient(config, logger);
    const accountClient = new OrganizationAccountClient({
      login: 'github-app-test',
      restClient: appClient,
      graphqlClient: new GitHubGraphQLClient(
        token,
        resourceMetadataMap(),
        logger,
      ),
      logger: logger,
      analyzeCommitApproval: config.analyzeCommitApproval,
    });

    const commitsForPR = await collectCommitsForPR(
      accountClient,
      {
        login: 'github-app-test',
      } as AccountEntity,
      {
        base: {
          repo: {
            name: 'power-demo',
          },
        },
        number: prId,
      } as PullsListResponseItem,
      teamMembers,
    );

    expect(commitsForPR).toEqual(expected);
  });
}

collectCommitsForPRTest({
  title: 'pull request with self-approval',
  recordingName: 'collectCommitsForPR.selfApproval',
  // https://github.com/github-app-test/power-demo/pull/1
  prId: 1,
  expected: {
    allCommits: commitExpectationsFromShas(
      '08167cc7b2067451ee85fb45d9fd7b9f0581ee27',
      '992cebcd8e2038bb5406c24636faa4ffb32bdb17',
      '8133160989625cf6dac3b571f88d1d077686f8c6',
      'bc9e3b6ac9f5091772ef825ead58259cd9c956c7',
    ),
    approvedCommits: [],
    commitsByUnknownAuthor: [],
    approvals: [],
  },
});

collectCommitsForPRTest({
  title: 'pull request with commits from null unknown author',
  recordingName: 'collectCommitsForPR.nullAuthor',
  // https://github.com/github-app-test/power-demo/pull/2
  prId: 2,
  expected: {
    allCommits: commitExpectationsFromShas(
      '37bf4ef3083fb14e7cf2eb076cdee1710764084a',
      '098d667efc63095f4e099305de8597bfaee8c381',
    ),
    approvedCommits: commitExpectationsFromShas(
      '37bf4ef3083fb14e7cf2eb076cdee1710764084a',
      '098d667efc63095f4e099305de8597bfaee8c381',
    ),
    commitsByUnknownAuthor: [
      expect.objectContaining({
        author: null,
        committer: null,
        sha: '098d667efc63095f4e099305de8597bfaee8c381',
      }),
    ],
    approvals: [
      {
        approverUsernames: ['fomentia2'],
        commit: '098d667efc63095f4e099305de8597bfaee8c381',
      },
    ],
  },
});

collectCommitsForPRTest({
  title: 'pull request with approvers outside of team',
  recordingName: 'collectCommitsForPR.unknownApprover',
  // https://github.com/github-app-test/power-demo/pull/6
  prId: 9,
  expected: {
    allCommits: commitExpectationsFromShas(
      'e42f6281ec53e1611a0b45c012333af688b85d2d',
    ),
    approvedCommits: [],
    commitsByUnknownAuthor: [],
    approvals: [],
  },
  teamMembers: [{ login: 'fomentia2' }],
});

// test('pull request with commits from author outside of team', async () => {
//   const commitsForPR = await mockCollectCommitsForPR(
//     commitsWithSelfApproval,
//     reviewsWithSelfApproval,
//     [{ login: 'fomentia2' }]
//   );

//   expect(commitsForPR).toEqual({
//     allCommits: commitsWithSelfApproval,
//     approvedCommits: [],
//     commitsByUnknownAuthor: [
//       commitsWithSelfApproval[0],
//       commitsWithSelfApproval[2],
//       commitsWithSelfApproval[3]
//     ],
//     approvals: []
//   });
// });

collectCommitsForPRTest({
  title: 'pull request with multiple approvers',
  recordingName: 'collectCommitsForPR.multipleApprovers',
  // https://github.com/github-app-test/power-demo/pull/10
  prId: 10,
  expected: {
    allCommits: commitExpectationsFromShas(
      '0a8f4c03958084032179fc675d2d607661f43625',
    ),
    approvedCommits: commitExpectationsFromShas(
      '0a8f4c03958084032179fc675d2d607661f43625',
    ),
    commitsByUnknownAuthor: [],
    approvals: [
      {
        approverUsernames: ['fomentia', 'github-user-test'],
        commit: '0a8f4c03958084032179fc675d2d607661f43625',
      },
    ],
  },
});

collectCommitsForPRTest({
  title: 'pull request with approval then force push',
  recordingName: 'collectCommitsForPR.forcePush',
  // https://github.com/github-app-test/power-demo/pull/3
  prId: 3,
  expected: {
    allCommits: commitExpectationsFromShas(
      '8bdb8e835476acd7c1483958c5ba333644b7050c',
      '1c9ecf2cb14eb88bc97c9bf84694b95668c2088e',
      '567e24bdafae62e6d2d08d1af63f3eeed0465753',
    ),
    approvedCommits: [],
    commitsByUnknownAuthor: [],
    approvals: [
      {
        approverUsernames: ['fomentia2'],
        commit: 'a65bdc6872957b4def38df92c2be90c2ced2879c',
      },
    ],
  },
});

collectCommitsForPRTest({
  title: 'pull request with dismissed review',
  recordingName: 'collectCommitsForPR.dismissedReview',
  // https://github.com/github-app-test/power-demo/pull/4
  prId: 4,
  expected: {
    allCommits: commitExpectationsFromShas(
      '0f9820226b89470f927a21dbbff5fcc298ff6917',
      'f46826dbaaba5c52f63a1ab2492150869a368acb',
    ),
    approvedCommits: commitExpectationsFromShas(
      '0f9820226b89470f927a21dbbff5fcc298ff6917',
    ),
    commitsByUnknownAuthor: [],
    approvals: [
      {
        approverUsernames: ['fomentia2'],
        commit: '0f9820226b89470f927a21dbbff5fcc298ff6917',
      },
    ],
  },
});
