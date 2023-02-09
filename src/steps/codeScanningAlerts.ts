import {
  createDirectRelationship,
  IntegrationMissingKeyError,
  IntegrationStep,
  IntegrationStepExecutionContext,
  RelationshipClass,
} from '@jupiterone/integration-sdk-core';

import { getOrCreateApiClient } from '../client';
import { IntegrationConfig } from '../config';
import { DATA_ACCOUNT_ENTITY } from './account';
import { AccountEntity, CodeScanningFindingEntity } from '../types';
import {
  GITHUB_REPO_HAS_CODE_SCANNING_FINDING,
  GithubEntities,
} from '../constants';
import { createCodeScanningFindingEntity } from '../sync/converters';

export async function fetchCodeScanAlerts({
  instance,
  logger,
  jobState,
}: IntegrationStepExecutionContext<IntegrationConfig>) {
  const config = instance.config;
  const apiClient = getOrCreateApiClient(config, logger);

  const accountEntity = await jobState.getData<AccountEntity>(
    DATA_ACCOUNT_ENTITY,
  );
  if (!accountEntity) {
    throw new IntegrationMissingKeyError(
      `Expected to find Account entity in jobState.`,
    );
  }

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
    id: 'fetch-code-scanning-alerts',
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
    dependsOn: ['fetch-account', 'fetch-repos'],
    executionHandler: fetchCodeScanAlerts,
  },
];
