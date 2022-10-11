import {
  IntegrationStep,
  IntegrationStepExecutionContext,
  RelationshipClass,
  IntegrationMissingKeyError,
  createDirectRelationship,
} from '@jupiterone/integration-sdk-core';

import { getOrCreateApiClient } from '../client';
import { IntegrationConfig } from '../config';
import { EnvironmentEntity, SecretEntity, IdEntityMap } from '../types';
import {
  GithubEntities,
  GITHUB_ENVIRONMENT_SECRET_RELATIONSHIP_TYPE,
  GITHUB_REPO_ENV_SECRET_RELATIONSHIP_TYPE,
  GITHUB_ENV_SECRET_ORG_SECRET_RELATIONSHIP_TYPE,
  GITHUB_ENV_SECRET_REPO_SECRET_RELATIONSHIP_TYPE,
  GITHUB_REPO_SECRET_ENTITIES_BY_REPO_NAME_MAP,
} from '../constants';
import { toEnvSecretEntity } from '../sync/converters';
import { getSecretEntityKey } from '../util/propertyHelpers';

export async function fetchEnvSecrets({
  instance,
  logger,
  jobState,
}: IntegrationStepExecutionContext<IntegrationConfig>) {
  const config = instance.config;
  const apiClient = getOrCreateApiClient(config, logger);

  const repoSecretEntitiesByRepoNameMap = await jobState.getData<
    IdEntityMap<IdEntityMap<SecretEntity>>
  >(GITHUB_REPO_SECRET_ENTITIES_BY_REPO_NAME_MAP);
  if (!repoSecretEntitiesByRepoNameMap) {
    throw new IntegrationMissingKeyError(
      `Expected reposecrets.ts to have set ${GITHUB_REPO_SECRET_ENTITIES_BY_REPO_NAME_MAP} in jobState.`,
    );
  }

  await jobState.iterateEntities<EnvironmentEntity>(
    { _type: GithubEntities.GITHUB_ENVIRONMENT._type },
    async (envEntity) => {
      await apiClient.iterateEnvSecrets(envEntity, async (envSecret) => {
        const secretEntity = (await jobState.addEntity(
          toEnvSecretEntity(
            envSecret,
            apiClient.graphQLClient.login,
            config.githubApiBaseUrl,
            envEntity,
          ),
        )) as SecretEntity;

        await jobState.addRelationship(
          createDirectRelationship({
            _class: RelationshipClass.HAS,
            from: envEntity,
            to: secretEntity,
          }),
        );

        await jobState.addRelationship(
          createDirectRelationship({
            _class: RelationshipClass.USES,
            fromType: GithubEntities.GITHUB_REPO._type,
            toType: GithubEntities.GITHUB_ENV_SECRET._type,
            fromKey: envEntity.parentRepoKey,
            toKey: secretEntity._key,
          }),
        );

        const keyOfHypotheticalOrgSecretOfSameName = getSecretEntityKey({
          name: envSecret.name,
          secretOwnerType: 'Org',
          secretOwnerName: apiClient.graphQLClient.login,
        });
        if (await jobState.hasKey(keyOfHypotheticalOrgSecretOfSameName)) {
          await jobState.addRelationship(
            createDirectRelationship({
              _class: RelationshipClass.OVERRIDES,
              fromType: GithubEntities.GITHUB_ENV_SECRET._type,
              toType: GithubEntities.GITHUB_ORG_SECRET._type,
              fromKey: secretEntity._key,
              toKey: keyOfHypotheticalOrgSecretOfSameName,
            }),
          );
        }

        const repoSecretEntities =
          repoSecretEntitiesByRepoNameMap[envEntity.parentRepoName];
        if (repoSecretEntities && repoSecretEntities[envSecret.name]) {
          await jobState.addRelationship(
            createDirectRelationship({
              _class: RelationshipClass.OVERRIDES,
              from: secretEntity,
              to: repoSecretEntities[envSecret.name],
            }),
          );
        }
      });
    },
  );
}

export const envSecretSteps: IntegrationStep<IntegrationConfig>[] = [
  {
    id: 'fetch-env-secrets',
    name: 'Fetch Environment Secrets',
    entities: [
      {
        resourceName: 'GitHub Env Secret',
        _type: GithubEntities.GITHUB_ENV_SECRET._type,
        _class: GithubEntities.GITHUB_ENV_SECRET._class,
      },
    ],
    relationships: [
      {
        _type: GITHUB_ENVIRONMENT_SECRET_RELATIONSHIP_TYPE,
        _class: RelationshipClass.HAS,
        sourceType: GithubEntities.GITHUB_ENVIRONMENT._type,
        targetType: GithubEntities.GITHUB_ENV_SECRET._type,
      },
      {
        _type: GITHUB_REPO_ENV_SECRET_RELATIONSHIP_TYPE,
        _class: RelationshipClass.USES,
        sourceType: GithubEntities.GITHUB_REPO._type,
        targetType: GithubEntities.GITHUB_ENV_SECRET._type,
      },
      {
        _type: GITHUB_ENV_SECRET_ORG_SECRET_RELATIONSHIP_TYPE,
        _class: RelationshipClass.OVERRIDES,
        sourceType: GithubEntities.GITHUB_ENV_SECRET._type,
        targetType: GithubEntities.GITHUB_ORG_SECRET._type,
      },
      {
        _type: GITHUB_ENV_SECRET_REPO_SECRET_RELATIONSHIP_TYPE,
        _class: RelationshipClass.OVERRIDES,
        sourceType: GithubEntities.GITHUB_ENV_SECRET._type,
        targetType: GithubEntities.GITHUB_REPO_SECRET._type,
      },
    ],
    dependsOn: [
      'fetch-environments',
      'fetch-repo-secrets',
      'fetch-org-secrets',
    ],
    executionHandler: fetchEnvSecrets,
  },
];
