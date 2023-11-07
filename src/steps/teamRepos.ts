import {
  IntegrationMissingKeyError,
  IntegrationStep,
  IntegrationStepExecutionContext,
  JobState,
} from '@jupiterone/integration-sdk-core';

import { getOrCreateApiClient } from '../client';
import { IntegrationConfig } from '../config';
import { createRepoAllowsTeamRelationship } from '../sync/converters';
import {
  Steps,
  Relationships,
  REPOSITORIES_TOTAL_BY_TEAM,
  TEAM_DATA_MAP,
} from '../constants';
import { TeamData } from '../types';
import { withBatching } from '../client/GraphQLClient/batchUtils';
import { OrgTeamRepoQueryResponse } from '../client/GraphQLClient';

export async function fetchTeamRepos({
  instance,
  logger,
  jobState,
}: IntegrationStepExecutionContext<IntegrationConfig>) {
  const config = instance.config;
  const apiClient = getOrCreateApiClient(config, logger);

  const teamDataMap =
    await jobState.getData<Map<string, TeamData>>(TEAM_DATA_MAP);
  if (!teamDataMap) {
    throw new IntegrationMissingKeyError(
      `Expected teams.ts to have set ${TEAM_DATA_MAP} in jobState.`,
    );
  }

  const repositoriesTotalByTeam = await jobState.getData<Map<string, number>>(
    REPOSITORIES_TOTAL_BY_TEAM,
  );
  if (!repositoriesTotalByTeam) {
    return;
  }

  const iteratee = buildIteratee({
    jobState,
  });

  await withBatching({
    totalConnectionsById: repositoriesTotalByTeam,
    threshold: 100,
    batchCb: async (teamKeys) => {
      await apiClient.iterateBatchedTeamRepos(teamKeys, iteratee);
    },
    singleCb: async (teamKey) => {
      const teamData = teamDataMap.get(teamKey);
      if (!teamData) {
        return;
      }
      await apiClient.iterateTeamRepos(teamData.name, iteratee);
    },
  });

  await jobState.deleteData(REPOSITORIES_TOTAL_BY_TEAM);
}

function buildIteratee({ jobState }: { jobState: JobState }) {
  return async (teamRepo: OrgTeamRepoQueryResponse) => {
    const repoTeamRelationship = createRepoAllowsTeamRelationship(
      teamRepo.id,
      teamRepo.teamId,
      teamRepo.permission,
    );

    await jobState.addRelationship(repoTeamRelationship);
  };
}

export const teamRepoSteps: IntegrationStep<IntegrationConfig>[] = [
  {
    id: Steps.FETCH_TEAM_REPOS,
    name: 'Fetch Team Repos',
    entities: [],
    relationships: [Relationships.REPO_ALLOWS_TEAM],
    dependsOn: [
      Steps.FETCH_REPOS,
      Steps.FETCH_TEAMS,
      // Added to execute steps serially.
      // https://docs.github.com/en/rest/guides/best-practices-for-using-the-rest-api?apiVersion=2022-11-28#dealing-with-secondary-rate-limits
      Steps.FETCH_VULNERABILITY_ALERTS,
    ],
    executionHandler: fetchTeamRepos,
  },
];
