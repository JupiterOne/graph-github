import {
  IntegrationStep,
  IntegrationStepExecutionContext,
  RelationshipClass,
  IntegrationMissingKeyError,
  createDirectRelationship,
} from '@jupiterone/integration-sdk-core';

import { createAPIClient } from '../client';
import { IntegrationConfig } from '../config';
import { RepoKeyAndName, SecretEntity } from '../types';
import {
  GITHUB_REPO_ENTITY_TYPE,
  GITHUB_REPO_SECRET_ENTITY_TYPE,
  GITHUB_ORG_SECRET_ENTITY_TYPE,
  GITHUB_ENV_SECRET_ENTITY_TYPE,
  GITHUB_SECRET_ENTITY_CLASS,
  GITHUB_ENVIRONMENT_ENTITY_TYPE,
  GITHUB_ENVIRONMENT_ENTITY_CLASS,
  GITHUB_REPO_ENVIRONMENT_RELATIONSHIP_TYPE,
  GITHUB_ENVIRONMENT_SECRET_RELATIONSHIP_TYPE,
  GITHUB_REPO_ENV_SECRET_RELATIONSHIP_TYPE,
  GITHUB_ENV_SECRET_ORG_SECRET_RELATIONSHIP_TYPE,
  GITHUB_ENV_SECRET_REPO_SECRET_RELATIONSHIP_TYPE,
  GITHUB_REPO_SECRET_ENTITIES_BY_REPO_NAME_MAP,
  GITHUB_REPO_TAGS_ARRAY,
  GITHUB_ORG_SECRET_BY_NAME_MAP,
} from '../constants';
import { toRepoSecretEntity } from '../sync/converters';

export async function fetchEnvironments({
  instance,
  logger,
  jobState,
}: IntegrationStepExecutionContext<IntegrationConfig>) {
  const config = instance.config;
  const apiClient = createAPIClient(config, logger);

  const repoTags = await jobState.getData<RepoKeyAndName[]>(
    GITHUB_REPO_TAGS_ARRAY,
  );
  if (!repoTags) {
    throw new IntegrationMissingKeyError(
      `Expected repos.ts to have set ${GITHUB_REPO_TAGS_ARRAY} in jobState.`,
    );
  }

  const orgSecretEntities = await jobState.getData<string[]>(
    GITHUB_ORG_SECRET_BY_NAME_MAP,
  );
  if (!orgSecretEntities) {
    throw new IntegrationMissingKeyError(
      `Expected orgsecrets.ts to have set ${GITHUB_ORG_SECRET_BY_NAME_MAP} in jobState.`,
    );
  }

  const repoSecretEntitiesByRepoNameMap = await jobState.getData<string[]>(
    GITHUB_REPO_SECRET_ENTITIES_BY_REPO_NAME_MAP,
  );
  if (!repoSecretEntitiesByRepoNameMap) {
    throw new IntegrationMissingKeyError(
      `Expected reposecrets.ts to have set ${GITHUB_REPO_SECRET_ENTITIES_BY_REPO_NAME_MAP} in jobState.`,
    );
  }

  for (const repoTag of repoTags) {
    await apiClient.iterateEnvironments(repoTag.name, async (secret) => {
      /*
      const secretEntity = (await jobState.addEntity(
        toRepoSecretEntity(secret, apiClient.accountClient.login, repoTag.name),
      )) as SecretEntity;
      repoSecretEntities.push(secretEntity);

      await jobState.addRelationship(
        createDirectRelationship({
          _class: RelationshipClass.HAS,
          fromType: GITHUB_REPO_ENTITY_TYPE,
          toType: GITHUB_REPO_SECRET_ENTITY_TYPE,
          fromKey: repoTag._key,
          toKey: secretEntity._key,
        }),
      );

      await jobState.addRelationship(
        createDirectRelationship({
          _class: RelationshipClass.USES,
          fromType: GITHUB_REPO_ENTITY_TYPE,
          toType: GITHUB_REPO_SECRET_ENTITY_TYPE,
          fromKey: repoTag._key,
          toKey: secretEntity._key,
        }),
      );

      if (orgSecretEntities[secret.name]) {
        await jobState.addRelationship(
          createDirectRelationship({
            _class: RelationshipClass.OVERRIDES,
            from: secretEntity,
            to: orgSecretEntities[secret.name],
          }),
        );
      } */
    });
  }
}

export const environmentSteps: IntegrationStep<IntegrationConfig>[] = [
  {
    id: 'fetch-environments',
    name: 'Fetch Environments',
    entities: [
      {
        resourceName: 'GitHub Environment',
        _type: GITHUB_ENVIRONMENT_ENTITY_TYPE,
        _class: GITHUB_ENVIRONMENT_ENTITY_CLASS,
      },
      {
        resourceName: 'GitHub Env Secret',
        _type: GITHUB_ENV_SECRET_ENTITY_TYPE,
        _class: GITHUB_SECRET_ENTITY_CLASS,
      },
    ],
    relationships: [
      {
        _type: GITHUB_REPO_ENVIRONMENT_RELATIONSHIP_TYPE,
        _class: RelationshipClass.HAS,
        sourceType: GITHUB_REPO_ENTITY_TYPE,
        targetType: GITHUB_ENVIRONMENT_ENTITY_TYPE,
      },
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
    dependsOn: ['fetch-repo-secrets'],
    executionHandler: fetchEnvironments,
  },
];
