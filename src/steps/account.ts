import {
  IntegrationError,
  IntegrationStep,
  IntegrationStepExecutionContext,
} from '@jupiterone/integration-sdk-core';

import { IntegrationConfig } from '../config';
import { toAccountEntity } from '../sync/converters';
import { GithubEntities, Steps } from '../constants';
import { getOrCreateGraphqlClient } from '../client/GraphQLClient';

export const DATA_ACCOUNT_ENTITY = 'DATA_ACCOUNT_ENTITY';

export async function fetchAccountDetails({
  jobState,
  instance,
  logger,
}: IntegrationStepExecutionContext<IntegrationConfig>) {
  const { config } = instance;
  const graphqlClient = getOrCreateGraphqlClient(config, logger);
  const organization = await graphqlClient.fetchOrganization();
  if (!organization) {
    throw new IntegrationError({
      code: 'ORGANIZATION_FETCH_FAILED',
      message: 'Failed to fetch organization details',
    });
  }

  const accountEntity = toAccountEntity(organization);
  await jobState.addEntity(accountEntity);
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
