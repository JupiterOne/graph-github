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
import { AccountEntity, RepoKeyAndName, SecretEntity } from '../types';
import {
  GithubEntities,
  GITHUB_ACCOUNT_SECRET_RELATIONSHIP_TYPE,
  GITHUB_REPO_ORG_SECRET_RELATIONSHIP_TYPE,
  GITHUB_REPO_TAGS_ARRAY,
  Steps,
} from '../constants';
import { toOrgSecretEntity } from '../sync/converters';

export async function fetchOrgSecrets({
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

  await apiClient.iterateOrgSecrets(repoTags, async (secret) => {
    const secretEntity = (await jobState.addEntity(
      toOrgSecretEntity(
        secret,
        apiClient.graphQLClient.login || '',
        config.githubApiBaseUrl,
      ),
    )) as SecretEntity;

    await jobState.addRelationship(
      createDirectRelationship({
        _class: RelationshipClass.HAS,
        from: accountEntity,
        to: secretEntity,
      }),
    );

    //for every org secret, add a USES relationship for all repos with access to secret
    if (secret.repos) {
      for (const repoTag of secret.repos) {
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
  });
}

export const orgSecretSteps: IntegrationStep<IntegrationConfig>[] = [
  {
    id: Steps.FETCH_ORG_SECRETS,
    name: 'Fetch Organization Secrets',
    entities: [
      {
        resourceName: 'GitHub Org Secret',
        _type: GithubEntities.GITHUB_ORG_SECRET._type,
        _class: GithubEntities.GITHUB_ORG_SECRET._class,
      },
    ],
    relationships: [
      {
        _type: GITHUB_ACCOUNT_SECRET_RELATIONSHIP_TYPE,
        _class: RelationshipClass.HAS,
        sourceType: GithubEntities.GITHUB_ACCOUNT._type,
        targetType: GithubEntities.GITHUB_ORG_SECRET._type,
      },
      {
        _type: GITHUB_REPO_ORG_SECRET_RELATIONSHIP_TYPE,
        _class: RelationshipClass.USES,
        sourceType: GithubEntities.GITHUB_REPO._type,
        targetType: GithubEntities.GITHUB_ORG_SECRET._type,
      },
    ],
    dependsOn: [Steps.FETCH_ACCOUNT, Steps.FETCH_REPOS],
    executionHandler: fetchOrgSecrets,
  },
];
