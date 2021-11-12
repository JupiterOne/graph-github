import {
  IntegrationStep,
  IntegrationStepExecutionContext,
  RelationshipClass,
  IntegrationMissingKeyError,
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
    if (!jobState.hasKey(teamRepo.id)) {
      throw new IntegrationMissingKeyError(
        `Expected repo (CodeRepo) with id to exist (key=${teamRepo.id})`,
      );
    }
    //property .teams is just a single key
    if (!jobState.hasKey(teamRepo.teams)) {
      throw new IntegrationMissingKeyError(
        `Expected team (UserGroup) with id to exist (key=${teamRepo.teams})`,
      );
    }
    const repoTeamRelationship = createRepoAllowsTeamRelationship(
      teamRepo.id,
      teamRepo.teams,
      teamRepo.permission,
    );
    await jobState.addRelationship(repoTeamRelationship);
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
