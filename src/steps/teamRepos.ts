import {
  IntegrationStep,
  IntegrationStepExecutionContext,
  RelationshipClass,
} from '@jupiterone/integration-sdk-core';

import { getOrCreateApiClient } from '../client';
import { IntegrationConfig } from '../config';
import { createRepoAllowsTeamRelationship } from '../sync/converters';
import {
  GithubEntities,
  GITHUB_REPO_TEAM_RELATIONSHIP_TYPE,
  Steps,
} from '../constants';
import { TeamEntity } from '../types';

export async function fetchTeamRepos({
  instance,
  logger,
  jobState,
}: IntegrationStepExecutionContext<IntegrationConfig>) {
  const config = instance.config;
  const apiClient = getOrCreateApiClient(config, logger);

  await jobState.iterateEntities(
    { _type: GithubEntities.GITHUB_TEAM._type },
    async (teamEntity: TeamEntity) => {
      await apiClient.iterateTeamRepos(teamEntity, async (teamRepo) => {
        const repoTeamRelationship = createRepoAllowsTeamRelationship(
          teamRepo.id,
          teamEntity._key,
          teamRepo.permission,
        );

        await jobState.addRelationship(repoTeamRelationship);
      });
    },
  );
}

export const teamRepoSteps: IntegrationStep<IntegrationConfig>[] = [
  {
    id: Steps.FETCH_TEAM_REPOS,
    name: 'Fetch Team Repos',
    entities: [],
    relationships: [
      {
        _type: GITHUB_REPO_TEAM_RELATIONSHIP_TYPE,
        _class: RelationshipClass.ALLOWS,
        sourceType: GithubEntities.GITHUB_REPO._type,
        targetType: GithubEntities.GITHUB_TEAM._type,
      },
    ],
    dependsOn: [Steps.FETCH_REPOS, Steps.FETCH_TEAMS],
    executionHandler: fetchTeamRepos,
  },
];
