import { IntegrationSpecConfig } from '@jupiterone/integration-sdk-core';
import { IntegrationConfig } from '../../../src/config';
import { repositorySpec } from './repository';
import { vulnerabilityAlertSpec } from './vulnerabilityalerts';

export const invocationConfig: IntegrationSpecConfig<IntegrationConfig> = {
  integrationSteps: [...repositorySpec, ...vulnerabilityAlertSpec],
};
