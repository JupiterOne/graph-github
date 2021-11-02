import {
  IntegrationStep,
  IntegrationStepExecutionContext,
  RelationshipClass,
  IntegrationMissingKeyError,
  createDirectRelationship,
} from '@jupiterone/integration-sdk-core';

import { createAPIClient } from '../client';
import { IntegrationConfig } from '../config';
import { EnvironmentEntity, SecretEntity, IdEntityMap } from '../types';
import {
  GITHUB_REPO_ENTITY_TYPE,
  GITHUB_REPO_SECRET_ENTITY_TYPE,
  GITHUB_ORG_SECRET_ENTITY_TYPE,
  GITHUB_ENV_SECRET_ENTITY_TYPE,
  GITHUB_SECRET_ENTITY_CLASS,
  GITHUB_ENVIRONMENT_ENTITY_TYPE,
  GITHUB_ENVIRONMENT_SECRET_RELATIONSHIP_TYPE,
  GITHUB_REPO_ENV_SECRET_RELATIONSHIP_TYPE,
  GITHUB_ENV_SECRET_ORG_SECRET_RELATIONSHIP_TYPE,
  GITHUB_ENV_SECRET_REPO_SECRET_RELATIONSHIP_TYPE,
  GITHUB_REPO_SECRET_ENTITIES_BY_REPO_NAME_MAP,
  GITHUB_ORG_SECRET_BY_NAME_MAP,
} from '../constants';
import { toEnvSecretEntity } from '../sync/converters';

export async function fetchEnvSecrets({
  instance,
  logger,
  jobState,
}: IntegrationStepExecutionContext<IntegrationConfig>) {
  const config = instance.config;
  const apiClient = createAPIClient(config, logger);

  const orgSecretEntities = await jobState.getData<IdEntityMap<SecretEntity>>(
    GITHUB_ORG_SECRET_BY_NAME_MAP,
  );
  if (!orgSecretEntities) {
    throw new IntegrationMissingKeyError(
      `Expected orgsecrets.ts to have set ${GITHUB_ORG_SECRET_BY_NAME_MAP} in jobState.`,
    );
  }

  const repoSecretEntitiesByRepoNameMap = await jobState.getData<
    IdEntityMap<IdEntityMap<SecretEntity>>
  >(GITHUB_REPO_SECRET_ENTITIES_BY_REPO_NAME_MAP);
  if (!repoSecretEntitiesByRepoNameMap) {
    throw new IntegrationMissingKeyError(
      `Expected reposecrets.ts to have set ${GITHUB_REPO_SECRET_ENTITIES_BY_REPO_NAME_MAP} in jobState.`,
    );
  }

  await jobState.iterateEntities<EnvironmentEntity>(
    { _type: GITHUB_ENVIRONMENT_ENTITY_TYPE },
    async (envEntity) => {
      await apiClient.iterateEnvSecrets(envEntity, async (envSecret) => {
        const secretEntity = (await jobState.addEntity(
          toEnvSecretEntity(
            envSecret,
            apiClient.accountClient.login,
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
            fromType: GITHUB_REPO_ENTITY_TYPE,
            toType: GITHUB_ENV_SECRET_ENTITY_TYPE,
            fromKey: envEntity.parentRepoKey,
            toKey: secretEntity._key,
          }),
        );

        if (orgSecretEntities[envSecret.name]) {
          await jobState.addRelationship(
            createDirectRelationship({
              _class: RelationshipClass.OVERRIDES,
              from: secretEntity,
              to: orgSecretEntities[envSecret.name],
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
        _type: GITHUB_ENV_SECRET_ENTITY_TYPE,
        _class: GITHUB_SECRET_ENTITY_CLASS,
      },
    ],
    relationships: [
      {
        _type: GITHUB_ENVIRONMENT_SECRET_RELATIONSHIP_TYPE,
        _class: RelationshipClass.HAS,
        sourceType: GITHUB_ENVIRONMENT_ENTITY_TYPE,
        targetType: GITHUB_ENV_SECRET_ENTITY_TYPE,
      },
      {
        _type: GITHUB_REPO_ENV_SECRET_RELATIONSHIP_TYPE,
        _class: RelationshipClass.USES,
        sourceType: GITHUB_REPO_ENTITY_TYPE,
        targetType: GITHUB_ENV_SECRET_ENTITY_TYPE,
      },
      {
        _type: GITHUB_ENV_SECRET_ORG_SECRET_RELATIONSHIP_TYPE,
        _class: RelationshipClass.OVERRIDES,
        sourceType: GITHUB_ENV_SECRET_ENTITY_TYPE,
        targetType: GITHUB_ORG_SECRET_ENTITY_TYPE,
      },
      {
        _type: GITHUB_ENV_SECRET_REPO_SECRET_RELATIONSHIP_TYPE,
        _class: RelationshipClass.OVERRIDES,
        sourceType: GITHUB_ENV_SECRET_ENTITY_TYPE,
        targetType: GITHUB_REPO_SECRET_ENTITY_TYPE,
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
