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
  GITHUB_ALL_TEAM_NAMES,
} from '../constants';
import { TeamEntity } from '../types';

export async function fetchTeamRepos({
  instance,
  logger,
  jobState,
}: IntegrationStepExecutionContext<IntegrationConfig>) {
  const config = instance.config;
  const apiClient = createAPIClient(config, logger);

  const allTeamNames = (await jobState.getData(
    GITHUB_ALL_TEAM_NAMES,
  )) as string[];
  if (!allTeamNames) {
    throw new IntegrationMissingKeyError(
      `Expected teams.ts to have set ${GITHUB_ALL_TEAM_NAMES} in jobState.`,
    );
  }

  await jobState.iterateEntities(
    { _type: GITHUB_TEAM_ENTITY_TYPE },
    async (teamEntity: TeamEntity) => {
      await apiClient.iterateTeamRepos(
        allTeamNames,
        teamEntity,
        async (teamRepo) => {
          //teamRepo.id is the repo id
          //teamRepo.teams is the team id
          if (
            (await jobState.hasKey(teamRepo.id)) &&
            (await jobState.hasKey(teamRepo.teams))
          ) {
            const repoTeamRelationship = createRepoAllowsTeamRelationship(
              teamRepo.id,
              teamEntity._key,
              teamRepo.permission,
            );
            if (jobState.hasKey(repoTeamRelationship._key)) {
              logger.warn(
                {
                  teamId: teamEntity.id,
                  teamKey: teamEntity._key,
                  teamName: teamEntity.name,
                  teamRepoTeamKey: teamRepo.teams,
                  teamRepoId: teamRepo.id,
                  relationshipKey: repoTeamRelationship._key,
                },
                'Repo-team relationship was already ingested: Skipping.',
              );
            } else {
              await jobState.addRelationship(repoTeamRelationship);
            }
          } else {
            logger.warn(
              { repoId: teamRepo.id, teamId: teamRepo.teams },
              `Could not build relationship between team and repo.`,
            );
          }
        },
      );
    },
  );
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
