import { IntegrationInvocationConfig } from '@jupiterone/integration-sdk-core';
import { integrationSteps } from './steps';
import {
  IntegrationConfig,
  instanceConfigFields,
  validateInvocation,
} from './config';
import getStepStartStates from './getStepStartStates';
import actionExecutionHandler from './actions/actionExecutionHandler';

export const invocationConfig: IntegrationInvocationConfig<IntegrationConfig> =
  {
    instanceConfigFields,
    getStepStartStates,
    integrationSteps,
  };

export { validateInvocation, actionExecutionHandler };
