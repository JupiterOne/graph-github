import {
  IntegrationStep,
  IntegrationStepExecutionContext,
  RelationshipClass,
  IntegrationMissingKeyError,
  createDirectRelationship,
} from '@jupiterone/integration-sdk-core';

import { getOrCreateApiClient } from '../client';
import { IntegrationConfig } from '../config';
import { DATA_ACCOUNT_ENTITY } from './account';
import { toTeamEntity } from '../sync/converters';
import { AccountEntity, TeamEntity } from '../types';
import { GithubEntities, Steps, Relationships } from '../constants';

export async function fetchTeams({
  instance,
  logger,
  jobState,
}: IntegrationStepExecutionContext<IntegrationConfig>) {
  const config = instance.config;
  const apiClient = getOrCreateApiClient(config, logger);

  const accountEntity =
    await jobState.getData<AccountEntity>(DATA_ACCOUNT_ENTITY);
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
    id: Steps.FETCH_TEAMS,
    name: 'Fetch Teams',
    entities: [GithubEntities.GITHUB_TEAM],
    relationships: [Relationships.ACCOUNT_HAS_TEAM],
    dependsOn: [Steps.FETCH_ACCOUNT],
    executionHandler: fetchTeams,
  },
];
