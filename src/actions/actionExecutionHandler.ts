import { IntegrationAction } from '@jupiterone/jupiter-types';
import { partialIngestActionHandler } from './partialIngestActionHandler';
import { getOrCreateApiClient } from '../client';
import { IntegrationExecutionContext } from '@jupiterone/integration-sdk-core';
import { IntegrationConfig } from '../config';

interface IntegrationPartialIngestAction extends IntegrationAction {
  parameters: Record<string, any>;
}

export interface IntegrationActionExecutionContext<TConfig>
  extends IntegrationExecutionContext<TConfig> {
  event: {
    accountId: string;
    integrationInstanceId: string;
    action: IntegrationAction;
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

  switch (
    action.name as string // TODO: Update jupiter-types (VDubber May 2022)
  ) {
    case 'PARTIAL_INGEST': {
      const partialIngestAction = action as IntegrationPartialIngestAction;
      if (!partialIngestAction.parameters) {
        throw new Error('parameters are required for action PARTIAL_INGEST');
      }

      return await partialIngestActionHandler(
        client,
        partialIngestAction.parameters.entities,
      );
    }
  }
}
