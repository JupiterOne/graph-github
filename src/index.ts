import { IntegrationInvocationConfig } from '@jupiterone/integration-sdk-core';
import { integrationSteps } from './steps';
import {
  IntegrationConfig,
  instanceConfigFields,
  validateInvocation,
  ingestionConfig,
} from './config';
import getStepStartStates from './getStepStartStates';

export const invocationConfig: IntegrationInvocationConfig<IntegrationConfig> =
  {
    validateInvocation,
    instanceConfigFields,
    getStepStartStates,
    integrationSteps,
    ingestionConfig,
    // Added to execute steps serially.
    // https://docs.github.com/en/rest/guides/best-practices-for-using-the-rest-api?apiVersion=2022-11-28#dealing-with-secondary-rate-limits
    stepConcurrency: 1,
  };

export { validateInvocation };
