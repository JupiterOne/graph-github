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
import { toAppEntity } from '../sync/converters';
import { AccountEntity, AppEntity } from '../types';
import {
  GithubEntities,
  GITHUB_ACCOUNT_APP_RELATIONSHIP_TYPE,
} from '../constants';

export async function fetchApps({
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

  await apiClient.iterateApps(async (app) => {
    const appEntity = (await jobState.addEntity(toAppEntity(app))) as AppEntity;
    await jobState.addRelationship(
      createDirectRelationship({
        _class: RelationshipClass.INSTALLED,
        from: accountEntity,
        to: appEntity,
      }),
    );
  });
}

export const appSteps: IntegrationStep<IntegrationConfig>[] = [
  {
    id: 'fetch-apps',
    name: 'Fetch Apps',
    entities: [
      {
        resourceName: 'Github App',
        _type: GithubEntities.GITHUB_APP._type,
        _class: GithubEntities.GITHUB_APP._class,
      },
    ],
    relationships: [
      {
        _type: GITHUB_ACCOUNT_APP_RELATIONSHIP_TYPE,
        _class: RelationshipClass.INSTALLED,
        sourceType: GithubEntities.GITHUB_ACCOUNT._type,
        targetType: GithubEntities.GITHUB_APP._type,
      },
    ],
    dependsOn: ['fetch-account'],
    executionHandler: fetchApps,
  },
];
