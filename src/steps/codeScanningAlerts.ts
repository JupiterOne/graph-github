import {
  createDirectRelationship,
  IntegrationStep,
  IntegrationStepExecutionContext,
  RelationshipClass,
} from '@jupiterone/integration-sdk-core';

import { IntegrationConfig } from '../config';
import { CodeScanningFindingEntity } from '../types';
import {
  GithubEntities,
  IngestionSources,
  Relationships,
  Steps,
} from '../constants';
import {
  createCodeScanningFindingEntity,
  getRepositoryEntityKey,
} from '../sync/converters';
import { getOrCreateRestClient } from '../client/RESTClient/client';

export async function fetchCodeScanAlerts({
  instance,
  logger,
  jobState,
}: IntegrationStepExecutionContext<IntegrationConfig>) {
  const config = instance.config;
  const restClient = getOrCreateRestClient(config, logger);

  await restClient.iterateCodeScanningAlerts(async (alert) => {
    const codeScanningFinding = (await jobState.addEntity(
      createCodeScanningFindingEntity(alert),
    )) as CodeScanningFindingEntity;

    const repoEntityKey =
      alert.repository.node_id &&
      getRepositoryEntityKey(alert.repository.node_id);

    if (repoEntityKey && jobState.hasKey(repoEntityKey)) {
      await jobState.addRelationship(
        createDirectRelationship({
          _class: RelationshipClass.HAS,
          fromType: GithubEntities.GITHUB_REPO._type,
          fromKey: repoEntityKey,
          toType: GithubEntities.GITHUB_CODE_SCANNING_ALERT._type,
          toKey: codeScanningFinding._key,
        }),
      );
    }
  });
}

export const codeScanningAlertsSteps: IntegrationStep<IntegrationConfig>[] = [
  {
    id: Steps.FETCH_CODE_SCANNING_ALERTS,
    ingestionSourceId: IngestionSources.CODE_SCANNING_ALERTS,
    name: 'Fetch Code Scanning Alerts',
    entities: [GithubEntities.GITHUB_CODE_SCANNING_ALERT],
    relationships: [Relationships.REPO_HAS_CODE_SCANNING_FINDING],
    dependsOn: [Steps.FETCH_REPOS],
    executionHandler: fetchCodeScanAlerts,
  },
];
