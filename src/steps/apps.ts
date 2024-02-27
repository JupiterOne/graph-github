import {
  IntegrationStep,
  IntegrationStepExecutionContext,
  RelationshipClass,
  IntegrationMissingKeyError,
  createDirectRelationship,
  Entity,
} from '@jupiterone/integration-sdk-core';

import { IntegrationConfig } from '../config';
import { DATA_ACCOUNT_ENTITY } from './account';
import { toAppEntity } from '../sync/converters';
import { AccountEntity, AppEntity, IdEntityMap } from '../types';
import {
  GithubEntities,
  GITHUB_APP_BY_APP_ID,
  Steps,
  IngestionSources,
  Relationships,
} from '../constants';
import { getOrCreateRestClient } from '../client/RESTClient/client';

export async function fetchApps({
  instance,
  logger,
  jobState,
}: IntegrationStepExecutionContext<IntegrationConfig>) {
  const config = instance.config;
  const restClient = getOrCreateRestClient(config, logger);

  const accountEntity =
    await jobState.getData<AccountEntity>(DATA_ACCOUNT_ENTITY);

  if (!accountEntity) {
    throw new IntegrationMissingKeyError(
      `Expected to find Account entity in jobState.`,
    );
  }

  const appIdMap: IdEntityMap<Entity['_key']> = new Map();
  await restClient.iterateApps(async (app) => {
    const appEntity = (await jobState.addEntity(toAppEntity(app))) as AppEntity;

    appIdMap.set(`${app.app_id}`, appEntity._key);

    await jobState.addRelationship(
      createDirectRelationship({
        _class: RelationshipClass.INSTALLED,
        from: accountEntity,
        to: appEntity,
      }),
    );
  });

  await jobState.setData(GITHUB_APP_BY_APP_ID, appIdMap);
}

export const appSteps: IntegrationStep<IntegrationConfig>[] = [
  {
    id: Steps.FETCH_APPS,
    ingestionSourceId: IngestionSources.APPS,
    name: 'Fetch Apps',
    entities: [GithubEntities.GITHUB_APP],
    relationships: [Relationships.ACCOUNT_INSTALLED_APP],
    dependsOn: [Steps.FETCH_ACCOUNT],
    executionHandler: fetchApps,
  },
];
