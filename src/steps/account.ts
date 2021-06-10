import {
  IntegrationStep,
  IntegrationStepExecutionContext,
} from '@jupiterone/integration-sdk-core';

import { IntegrationConfig } from '../config';
import { createAPIClient } from '../client';
import { toAccountEntity } from '../sync/converters';
import {
  GITHUB_ACCOUNT_ENTITY_TYPE,
  GITHUB_ACCOUNT_ENTITY_CLASS,
} from '../constants';

export const DATA_ACCOUNT_ENTITY = 'DATA_ACCOUNT_ENTITY';

export async function fetchAccountDetails({
  jobState,
  instance,
  logger,
}: IntegrationStepExecutionContext<IntegrationConfig>) {
  const config = instance.config;
  const apiClient = createAPIClient(config, logger);
  const accountEntity = await jobState.addEntity(
    toAccountEntity(await apiClient.getAccountDetails()),
  );

  await jobState.setData(DATA_ACCOUNT_ENTITY, accountEntity);
}

export const accountSteps: IntegrationStep<IntegrationConfig>[] = [
  {
    id: 'fetch-account',
    name: 'Fetch Account Details',
    entities: [
      {
        resourceName: 'Account',
        _type: GITHUB_ACCOUNT_ENTITY_TYPE,
        _class: GITHUB_ACCOUNT_ENTITY_CLASS,
      },
    ],
    relationships: [],
    dependsOn: [],
    executionHandler: fetchAccountDetails,
  },
];
