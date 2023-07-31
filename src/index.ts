import { IntegrationInvocationConfig } from '@jupiterone/integration-sdk-core';
import { integrationSteps } from './steps';
import {
  IntegrationConfig,
  instanceConfigFields,
  validateInvocation,
  ingestionConfig,
} from './config';
import getStepStartStates from './getStepStartStates';
import actionExecutionHandler from './actions/actionExecutionHandler';

export const invocationConfig: IntegrationInvocationConfig<IntegrationConfig> =
  {
    validateInvocation,
    instanceConfigFields,
    getStepStartStates,
    integrationSteps,
    ingestionConfig,
  };

export { validateInvocation, actionExecutionHandler };
