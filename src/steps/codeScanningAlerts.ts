import {
  IntegrationStep,
  IntegrationStepExecutionContext,
  RelationshipClass,
  IntegrationMissingKeyError,
  createDirectRelationship,
} from '@jupiterone/integration-sdk-core';

import { getOrCreateApiClient } from '../client';
import { IntegrationConfig } from '../config';
import { DATA_ACCOUNT_ENTITY } from './account';
import { AccountEntity, CodeScanAlertsEntity, RepoKeyAndName } from '../types';
import {
  GithubEntities,
  GITHUB_FINDING_ALERT_RULE_RELATIONSHIP_TYPE,
  GITHUB_REPO_TAGS_ARRAY,
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
  const repoTags = await jobState.getData<RepoKeyAndName[]>(
    GITHUB_REPO_TAGS_ARRAY,
  );
  if (!repoTags) {
    throw new IntegrationMissingKeyError(
      `Expected repos.ts to have set ${GITHUB_REPO_TAGS_ARRAY} in jobState.`,
    );
  }

  await apiClient.iterateCodeScanningAlerts(repoTags, async (alerts) => {
    const codeScanAlertsEntity = (await jobState.addEntity(
      createCodeScanAlertsEntity(
        alerts,
        apiClient.graphQLClient.login || '',
        config.githubApiBaseUrl,
      ),
    )) as CodeScanAlertsEntity;

    await jobState.addRelationship(
      createDirectRelationship({
        _class: RelationshipClass.HAS,
        from: accountEntity,
        to: codeScanAlertsEntity,
      }),
    );

    /*
    //for every org code scanner alert, add a USES relationship for all repos with access to secret
    if (alerts) {
      for (const repoTag of alerts.repos) {
        await jobState.addRelationship(
          createDirectRelationship({
            _class: RelationshipClass.USES,
            fromType: GithubEntities.GITHUB_REPO._type,
            toType: GithubEntities.GITHUB_ORG_SECRET._type,
            fromKey: repoTag._key,
            toKey: secretEntity._key,
          }),
        );
      }
    }
    */
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
        _type: GITHUB_FINDING_ALERT_RULE_RELATIONSHIP_TYPE,
        sourceType: GithubEntities.GITHUB_REPO._type,
        _class: RelationshipClass.HAS,
        targetType: GithubEntities.GITHUB_CODE_SCANNER_ALERTS._type,
      },
    ],
    dependsOn: ['fetch-account', 'fetch-repos'],
    executionHandler: fetchCodeScanAlerts,
  },
];
