import pMap from 'p-map';

import {
  IngestEntitiesContext,
  IngestPullRequestEntity,
  ProviderData,
  AccountType,
} from '../../types';
import {
  loadProviderData,
  loadUsersFromGitHub,
  loadReposFromGitHub,
  loadGraphData,
  loadUserEntitiesFromGraph,
  loadAccountUserRelationshipsFromGraph,
  loadRepoEntitiesFromGraph,
  addPullRequest,
} from '../syncContext';
import determineOperations from '../determineOperations';
import OrganizationAccountClient from '../../client/OrganizationAccountClient';

async function loadPullRequests(
  client: OrganizationAccountClient,
  accumulator: ProviderData,
  prs: IngestPullRequestEntity[]
) {
  await pMap(
    prs,
    async pr => {
      const prFromGitHub = await client.getPullRequestEntity(
        accumulator.account!,
        accumulator.repoByNameMap[pr.repository],
        pr.id,
        accumulator.users.length > 0 ? accumulator.users : undefined,
        Object.keys(accumulator.userByLoginMap).length > 0
          ? accumulator.userByLoginMap
          : undefined
      );

      if (prFromGitHub) {
        addPullRequest(accumulator, prFromGitHub);
      }
    },
    { concurrency: 2 }
  );
}

const pullRequestContext: IngestEntitiesContext<IngestPullRequestEntity> = {
  loadProviderData: async (executionContext, prs) => {
    return loadProviderData({
      github: executionContext.github,
      logger: executionContext.logger,
      loadContextSpecificData: async (client, data, logger) => {
        if (data.account && data.account.accountType === AccountType.Org) {
          // We need to load all of the users from GitHub to make calculate approval
          // for the PRs (PR authors must be in the organization)
          await loadUsersFromGitHub(client, data, logger);
        }
        await loadReposFromGitHub(
          client,
          data,
          prs.map(pr => pr.repository)
        );
        await loadPullRequests(client, data, prs);
      },
      allData: false,
    });
  },

  loadGraphData: async (executionContext, prs) => {
    return loadGraphData(executionContext.graph, async (graph, data) => {
      const loaders = [
        loadRepoEntitiesFromGraph(
          graph,
          data,
          prs.map(pr => pr.repository)
        ),
      ];

      if (executionContext.accountType === AccountType.Org) {
        loaders.push(
          loadUserEntitiesFromGraph(graph, data),
          loadAccountUserRelationshipsFromGraph(graph, data)
        );
      }

      await Promise.all(loaders);
    });
  },

  determineOperations,
};

export default pullRequestContext;
