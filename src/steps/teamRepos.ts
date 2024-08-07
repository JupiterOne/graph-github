import {
  IntegrationMissingKeyError,
  IntegrationStep,
  IntegrationStepExecutionContext,
  JobState,
} from '@jupiterone/integration-sdk-core';

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
import {
  OrgTeamRepoQueryResponse,
  getOrCreateGraphqlClient,
} from '../client/GraphQLClient';

export async function fetchTeamRepos({
  instance,
  logger,
  jobState,
}: IntegrationStepExecutionContext<IntegrationConfig>) {
  const config = instance.config;
  const graphqlClient = getOrCreateGraphqlClient(config, logger);

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
      await graphqlClient.iterateTeamRepositories(teamKeys, iteratee);
    },
    singleCb: async (teamKey) => {
      const teamData = teamDataMap.get(teamKey);
      if (!teamData) {
        return;
      }
      await graphqlClient.iterateTeamRepositories(teamData.name, iteratee);
    },
    logger,
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
    dependsOn: [Steps.FETCH_REPOS, Steps.FETCH_TEAMS],
    executionHandler: fetchTeamRepos,
  },
];
