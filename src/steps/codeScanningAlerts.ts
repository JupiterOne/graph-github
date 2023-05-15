import {
  createDirectRelationship,
  IntegrationStep,
  IntegrationStepExecutionContext,
  RelationshipClass,
} from '@jupiterone/integration-sdk-core';

import { getOrCreateApiClient } from '../client';
import { IntegrationConfig } from '../config';
import { CodeScanningFindingEntity } from '../types';
import {
  GITHUB_REPO_HAS_CODE_SCANNING_FINDING,
  GithubEntities,
  Steps,
} from '../constants';
import { createCodeScanningFindingEntity } from '../sync/converters';

export async function fetchCodeScanAlerts({
  instance,
  logger,
  jobState,
}: IntegrationStepExecutionContext<IntegrationConfig>) {
  const config = instance.config;
  const apiClient = getOrCreateApiClient(config, logger);

  await apiClient.iterateCodeScanningAlerts(async (alert) => {
    const codeScanningFinding = (await jobState.addEntity(
      createCodeScanningFindingEntity(alert),
    )) as CodeScanningFindingEntity;

    const repoEntity = await jobState.findEntity(alert.repository.node_id);

    if (repoEntity) {
      await jobState.addRelationship(
        createDirectRelationship({
          _class: RelationshipClass.HAS,
          from: repoEntity,
          to: codeScanningFinding,
        }),
      );
    }
  });
}

export const codeScanningAlertsSteps: IntegrationStep<IntegrationConfig>[] = [
  {
    id: Steps.FETCH_CODE_SCANNING_ALERTS,
    name: 'Fetch Code Scanning Alerts',
    entities: [
      {
        resourceName: 'GitHub Code Scanning Alerts',
        _type: GithubEntities.GITHUB_CODE_SCANNING_ALERT._type,
        _class: GithubEntities.GITHUB_CODE_SCANNING_ALERT._class,
      },
    ],
    relationships: [
      {
        _type: GITHUB_REPO_HAS_CODE_SCANNING_FINDING,
        sourceType: GithubEntities.GITHUB_REPO._type,
        _class: RelationshipClass.HAS,
        targetType: GithubEntities.GITHUB_CODE_SCANNING_ALERT._type,
      },
    ],
    dependsOn: [Steps.FETCH_REPOS],
    executionHandler: fetchCodeScanAlerts,
  },
];
