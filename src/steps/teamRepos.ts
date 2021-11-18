import {
  IntegrationStep,
  IntegrationStepExecutionContext,
  RelationshipClass,
} from '@jupiterone/integration-sdk-core';

import { createAPIClient } from '../client';
import { IntegrationConfig } from '../config';
import { createRepoAllowsTeamRelationship } from '../sync/converters';
import {
  GITHUB_REPO_ENTITY_TYPE,
  GITHUB_TEAM_ENTITY_TYPE,
  GITHUB_REPO_TEAM_RELATIONSHIP_TYPE,
} from '../constants';

export async function fetchTeamRepos({
  instance,
  logger,
  jobState,
}: IntegrationStepExecutionContext<IntegrationConfig>) {
  const config = instance.config;
  const apiClient = createAPIClient(config, logger);

  await apiClient.iterateTeamRepos(async (teamRepo) => {
    //teamRepo.id is the repo id
    //teamRepo.teams is the team id
    if (
      (await jobState.hasKey(teamRepo.id)) &&
      (await jobState.hasKey(teamRepo.teams))
    ) {
      const repoTeamRelationship = createRepoAllowsTeamRelationship(
        teamRepo.id,
        teamRepo.teams,
        teamRepo.permission,
      );
      await jobState.addRelationship(repoTeamRelationship);
    } else {
      logger.warn(
        { repoId: teamRepo.id, teamId: teamRepo.teams },
        `Could not build relationship between team and repo.`,
      );
    }
  });
}

export const teamRepoSteps: IntegrationStep<IntegrationConfig>[] = [
  {
    id: 'fetch-team-repos',
    name: 'Fetch Team Repos',
    entities: [],
    relationships: [
      {
        _type: GITHUB_REPO_TEAM_RELATIONSHIP_TYPE,
        _class: RelationshipClass.ALLOWS,
        sourceType: GITHUB_REPO_ENTITY_TYPE,
        targetType: GITHUB_TEAM_ENTITY_TYPE,
      },
    ],
    dependsOn: ['fetch-repos', 'fetch-teams'],
    executionHandler: fetchTeamRepos,
  },
];