import {
  createDirectRelationship,
  IntegrationStep,
  IntegrationStepExecutionContext,
  RelationshipClass,
  IntegrationMissingKeyError,
} from '@jupiterone/integration-sdk-core';

import { getOrCreateApiClient } from '../client';
import { IntegrationConfig } from '../config';
import { DATA_ACCOUNT_ENTITY } from './account';
import { AccountEntity, CodeScanAlertsEntity, RepoEntity } from '../types';
import {
  GithubEntities,
  GITHUB_REPO_FINDING_RELATIONSHIP_TYPE,
} from '../constants';
import { createCodeScanAlertsEntity } from '../sync/converters';

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

  await apiClient.iterateCodeScanningAlerts(async (alerts) => {
    const codeScanAlertsEntity = (await jobState.addEntity(
      createCodeScanAlertsEntity(alerts),
    )) as CodeScanAlertsEntity;

    await jobState.iterateEntities<RepoEntity>(
      { _type: GithubEntities.GITHUB_REPO._type },
      async (repoEntity) => {
        if (repoEntity.displayName === codeScanAlertsEntity.repository) {
          await jobState.addRelationship(
            createDirectRelationship({
              _class: RelationshipClass.HAS,
              from: repoEntity,
              to: codeScanAlertsEntity,
            }),
          );
        }
      },
    );
  });
}

export const codeScanningAlertsSteps: IntegrationStep<IntegrationConfig>[] = [
  {
    id: 'fetch-codescanning-alerts',
    name: 'Fetch Code Scanning Alerts',
    entities: [
      {
        resourceName: 'GitHub Code Scanning Alerts',
        _type: GithubEntities.GITHUB_CODE_SCANNER_ALERTS._type,
        _class: GithubEntities.GITHUB_CODE_SCANNER_ALERTS._class,
      },
    ],
    relationships: [
      {
        _type: GITHUB_REPO_FINDING_RELATIONSHIP_TYPE,
        sourceType: GithubEntities.GITHUB_REPO._type,
        _class: RelationshipClass.HAS,
        targetType: GithubEntities.GITHUB_CODE_SCANNER_ALERTS._type,
      },
    ],
    dependsOn: ['fetch-account', 'fetch-repos'],
    executionHandler: fetchCodeScanAlerts,
  },
];
