import {
  IntegrationStep,
  IntegrationStepExecutionContext,
  RelationshipClass,
  IntegrationMissingKeyError,
  createDirectRelationship,
} from '@jupiterone/integration-sdk-core';

import { createAPIClient } from '../client';
import { IntegrationConfig } from '../config';
import { DATA_ACCOUNT_ENTITY } from './account';
import { toTeamEntity } from '../sync/converters';
import { AccountEntity, TeamEntity } from '../types';
import {
  GITHUB_ACCOUNT_ENTITY_TYPE,
  GITHUB_TEAM_ENTITY_TYPE,
  GITHUB_TEAM_ENTITY_CLASS,
  GITHUB_ACCOUNT_TEAM_RELATIONSHIP_TYPE,
} from '../constants';

export async function fetchTeams({
  instance,
  logger,
  jobState,
}: IntegrationStepExecutionContext<IntegrationConfig>) {
  const config = instance.config;
  const apiClient = createAPIClient(config, logger);

  const accountEntity = await jobState.getData<AccountEntity>(
    DATA_ACCOUNT_ENTITY,
  );
  if (!accountEntity) {
    throw new IntegrationMissingKeyError(
      `Expected to find Account entity in jobState.`,
    );
  }

  await apiClient.iterateTeams(async (team) => {
    const teamEntity = (await jobState.addEntity(
      toTeamEntity(team),
    )) as TeamEntity;

    await jobState.addRelationship(
      createDirectRelationship({
        _class: RelationshipClass.HAS,
        from: accountEntity,
        to: teamEntity,
      }),
    );
  });
}

export const teamSteps: IntegrationStep<IntegrationConfig>[] = [
  {
    id: 'fetch-teams',
    name: 'Fetch Teams',
    entities: [
      {
        resourceName: 'GitHub Team',
        _type: GITHUB_TEAM_ENTITY_TYPE,
        _class: GITHUB_TEAM_ENTITY_CLASS,
      },
    ],
    relationships: [
      {
        _type: GITHUB_ACCOUNT_TEAM_RELATIONSHIP_TYPE,
        _class: RelationshipClass.HAS,
        sourceType: GITHUB_ACCOUNT_ENTITY_TYPE,
        targetType: GITHUB_TEAM_ENTITY_TYPE,
      },
    ],
    dependsOn: ['fetch-repos', 'fetch-users'],
    executionHandler: fetchTeams,
  },
];
