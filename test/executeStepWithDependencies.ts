import {
  IntegrationExecutionConfig,
  IntegrationInstanceConfig,
  IntegrationInvocationConfig,
} from '@jupiterone/integration-sdk-core';
import { buildStepDependencyGraph } from '@jupiterone/integration-sdk-runtime';
import {
  createMockStepExecutionContext,
  MockIntegrationStepExecutionContext,
} from '@jupiterone/integration-sdk-testing';

export async function executeStepWithDependencies(params: {
  stepId: string;
  invocationConfig: Pick<
    IntegrationInvocationConfig,
    'integrationSteps' | 'loadExecutionConfig' | 'dependencyGraphOrder'
  >;
  instanceConfig: IntegrationInstanceConfig;
}) {
  const { stepId, invocationConfig, instanceConfig } = params;

  if (invocationConfig.dependencyGraphOrder) {
    throw new Error(
      'executeStepWithDependencies does not currently support dependencyGraphOrder',
    );
  }

  const stepDependencyGraph = buildStepDependencyGraph(
    invocationConfig.integrationSteps,
  ); // throws if graph contains circular dependency

  const dependencyStepIds = stepDependencyGraph.dependenciesOf(stepId); // throws if id does not exist

  const executionConfig = invocationConfig.loadExecutionConfig
    ? invocationConfig.loadExecutionConfig({ config: instanceConfig })
    : {};
  const preContext: MockIntegrationStepExecutionContext & {
    executionConfig: IntegrationExecutionConfig;
  } = {
    ...createMockStepExecutionContext({ instanceConfig }),
    executionConfig,
  };

  for (const dependencyStepId of dependencyStepIds) {
    const dependencyStep = stepDependencyGraph.getNodeData(dependencyStepId);
    await dependencyStep.executionHandler(preContext);
  }

  const context: MockIntegrationStepExecutionContext & {
    executionConfig: IntegrationExecutionConfig;
  } = {
    ...createMockStepExecutionContext({
      instanceConfig,
      entities: preContext.jobState.collectedEntities,
      relationships: preContext.jobState.collectedRelationships,
      // setData: preContext.jobState.collectedData, // todo support collectedData
    }),
    executionConfig,
  };

  // since we don't have access to preContext.jobState.collectedData, steal setData and getData from preContext
  context.jobState.setData = preContext.jobState.setData;
  context.jobState.getData = preContext.jobState.getData;

  const { executionHandler } = stepDependencyGraph.getNodeData(stepId);
  await executionHandler(context);

  return {
    collectedEntities: context.jobState.collectedEntities,
    collectedRelationships: context.jobState.collectedRelationships,
    encounteredTypes: context.jobState.encounteredTypes,
    jobState: context.jobState,
  };
}
