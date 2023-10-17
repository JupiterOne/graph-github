import {
  IntegrationStep,
  IntegrationStepExecutionContext,
} from '@jupiterone/integration-sdk-core';

import { IntegrationConfig } from '../config';
import { getOrCreateApiClient } from '../client';
import { toAccountEntity } from '../sync/converters';
import { GithubEntities, Steps } from '../constants';

export const DATA_ACCOUNT_ENTITY = 'DATA_ACCOUNT_ENTITY';

export async function fetchAccountDetails({
  jobState,
  instance,
  logger,
}: IntegrationStepExecutionContext<IntegrationConfig>) {
  const config = instance.config;
  const apiClient = getOrCreateApiClient(config, logger);
  const accountEntity = await jobState.addEntity(
    toAccountEntity(await apiClient.fetchOrganization()),
  );
  await jobState.setData(DATA_ACCOUNT_ENTITY, accountEntity);
}

export const accountSteps: IntegrationStep<IntegrationConfig>[] = [
  {
    id: Steps.FETCH_ACCOUNT,
    name: 'Fetch Account Details',
    entities: [GithubEntities.GITHUB_ACCOUNT],
    relationships: [],
    dependsOn: [],
    executionHandler: fetchAccountDetails,
  },
];
