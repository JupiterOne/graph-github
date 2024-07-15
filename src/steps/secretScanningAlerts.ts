import {
  createDirectRelationship,
  IntegrationStep,
  IntegrationStepExecutionContext,
  RelationshipClass,
} from '@jupiterone/integration-sdk-core';

import { IntegrationConfig } from '../config';
import { SecretScanningFindingEntity } from '../types';
import {
  GithubEntities,
  IngestionSources,
  Relationships,
  Steps,
} from '../constants';
import {
  createSecretScanningAlertEntity,
  getRepositoryEntityKey,
} from '../sync/converters';
import { getOrCreateRestClient } from '../client/RESTClient/client';

export async function fetchSecretScanningAlerts({
  instance,
  logger,
  jobState,
}: IntegrationStepExecutionContext<IntegrationConfig>) {
  const config = instance.config;
  const restClient = getOrCreateRestClient(config, logger);

  await restClient.iterateSecretScanningAlerts(async (alert) => {
    if (!alert.repository?.node_id) {
      return;
    }
    const secretScanningAlertEntity = await jobState.addEntity(
      createSecretScanningAlertEntity(alert) as SecretScanningFindingEntity,
    );

    const repoEntityKey = getRepositoryEntityKey(alert.repository.node_id);
    if (jobState.hasKey(repoEntityKey)) {
      await jobState.addRelationship(
        createDirectRelationship({
          _class: RelationshipClass.HAS,
          fromType: GithubEntities.GITHUB_REPO._type,
          fromKey: repoEntityKey,
          toType: GithubEntities.GITHUB_SECRET_SCANNING_ALERT._type,
          toKey: secretScanningAlertEntity._key,
        }),
      );
    }
  });
}

export const secretScanningAlertsSteps: IntegrationStep<IntegrationConfig>[] = [
  {
    id: Steps.FETCH_SECRET_SCANNING_ALERTS,
    name: 'Fetch Secret Scanning Findings',
    entities: [GithubEntities.GITHUB_SECRET_SCANNING_ALERT],
    relationships: [Relationships.REPO_HAS_SECRET_SCANNING_FINDING],
    dependsOn: [Steps.FETCH_REPOS],
    ingestionSourceId: IngestionSources.SECRET_SCANNING_ALERTS,
    executionHandler: fetchSecretScanningAlerts,
  },
];
