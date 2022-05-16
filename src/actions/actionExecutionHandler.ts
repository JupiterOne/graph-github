import { partialIngestActionHandler } from './partialIngestActionHandler';
import { getOrCreateApiClient } from '../client';
import {
  IntegrationError,
  IntegrationExecutionContext,
} from '@jupiterone/integration-sdk-core';
import { IntegrationConfig } from '../config';

// TODO: extend IntegrationAction from jupiter-types VDubber 5/2022
interface IntegrationPartialIngestAction {
  name: string;
  parameters: Record<string, any>;
}

export interface IntegrationActionExecutionContext<TConfig>
  extends IntegrationExecutionContext<TConfig> {
  event: {
    accountId: string;
    integrationInstanceId: string;
    action: IntegrationPartialIngestAction;
    timestamp: number;
  };
}

export default async function actionExecutionHandler(
  context: IntegrationActionExecutionContext<IntegrationConfig>,
) {
  const { logger, instance, event } = context;
  const { action } = event;

  logger.debug({ integrationAction: action }, 'Handling integration action');

  const client = getOrCreateApiClient(instance.config, logger);

  await client.verifyAuthentication();

  switch (action.name) {
    case 'PARTIAL_INGEST': {
      if (!action.parameters) {
        throw new Error('parameters are required for action PARTIAL_INGEST');
      }

      return await partialIngestActionHandler(
        client,
        action.parameters.entities,
        logger,
      );
    }
    default: {
      throw new IntegrationError({
        code: 'UNKNOWN_ACTION_NAME',
        message: 'The provided action.name is not unknown.',
      });
    }
  }
}
