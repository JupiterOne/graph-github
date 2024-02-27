import {
  EntityIngestError,
  partialIngestActionHandler,
} from './partialIngestActionHandler';
import {
  Entity,
  IntegrationError,
  IntegrationExecutionContext,
  IntegrationInstanceConfig,
} from '@jupiterone/integration-sdk-core';
import { IntegrationConfig } from '../config';
import { getOrCreateRestClient } from '../client/RESTClient/client';
import { getOrCreateGraphqlClient } from '../client/GraphQLClient';

// TODO: extend IntegrationAction from jupiter-types VDubber 5/2022
interface IntegrationPartialIngestAction {
  name: string;
  parameters: Record<string, any>;
}

export interface IntegrationActionExecutionContext<
  TConfig extends IntegrationInstanceConfig,
> extends IntegrationExecutionContext<TConfig> {
  event: {
    accountId: string;
    integrationInstanceId: string;
    action: IntegrationPartialIngestAction;
    timestamp: number;
  };
}

export default async function actionExecutionHandler(
  context: IntegrationActionExecutionContext<IntegrationConfig>,
): Promise<{ entities: Entity[]; errors: EntityIngestError[] }> {
  const { logger, instance, event } = context;
  const { action } = event;

  logger.debug({ integrationAction: action }, 'Handling integration action');

  const restClient = getOrCreateRestClient(instance.config, logger);
  const graphqlClient = getOrCreateGraphqlClient(instance.config, logger);

  await restClient.verifyAuthentication();

  switch (action.name) {
    case 'PARTIAL_INGEST': {
      if (!action.parameters) {
        throw new Error('parameters are required for action PARTIAL_INGEST');
      }

      return await partialIngestActionHandler(
        graphqlClient,
        action.parameters.entities,
        instance.config,
        logger,
      );
    }
    default: {
      throw new IntegrationError({
        code: 'UNKNOWN_ACTION_NAME',
        message: 'The provided action.name is unknown.',
      });
    }
  }
}
