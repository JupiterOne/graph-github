import {
  IntegrationStep,
  IntegrationStepExecutionContext,
  RelationshipClass,
  IntegrationMissingKeyError,
  createDirectRelationship,
} from '@jupiterone/integration-sdk-core';

import { createAPIClient } from '../client';
import { IntegrationConfig } from '../config';
import { RepoKeyAndName, SecretEntity, IdEntityMap } from '../types';
import {
  GITHUB_REPO_ENTITY_TYPE,
  GITHUB_REPO_SECRET_ENTITY_TYPE,
  GITHUB_ORG_SECRET_ENTITY_TYPE,
  GITHUB_SECRET_ENTITY_CLASS,
  GITHUB_REPO_REPO_SECRET_RELATIONSHIP_TYPE,
  GITHUB_REPO_SECRET_RELATIONSHIP_TYPE,
  GITHUB_REPO_TAGS_ARRAY,
  GITHUB_ORG_SECRET_BY_NAME_MAP,
  GITHUB_REPO_SECRET_ORG_SECRET_RELATIONSHIP_TYPE,
  GITHUB_REPO_SECRET_ENTITIES_BY_REPO_NAME_MAP,
} from '../constants';
import { toRepoSecretEntity } from '../sync/converters';

export async function fetchRepoSecrets({
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

  const orgSecretEntities = await jobState.getData<IdEntityMap<SecretEntity>>(
    GITHUB_ORG_SECRET_BY_NAME_MAP,
  );
  if (!orgSecretEntities) {
    throw new IntegrationMissingKeyError(
      `Expected orgsecrets.ts to have set ${GITHUB_ORG_SECRET_BY_NAME_MAP} in jobState.`,
    );
  }

  //for use in detecting overrides by environmental secrets
  const repoSecretEntitiesByRepoNameMap = {};

  for (const repoTag of repoTags) {
    const repoSecretEntities = {};
    await apiClient.iterateRepoSecrets(repoTag.name, async (secret) => {
      const secretEntity = (await jobState.addEntity(
        toRepoSecretEntity(secret, apiClient.accountClient.login, repoTag.name),
      )) as SecretEntity;
      repoSecretEntities[secret.name] = secretEntity;

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
      }
    });
    repoSecretEntitiesByRepoNameMap[repoTag.name] = repoSecretEntities;
  }
  await jobState.setData(
    GITHUB_REPO_SECRET_ENTITIES_BY_REPO_NAME_MAP,
    repoSecretEntitiesByRepoNameMap,
  );
}

export const repoSecretSteps: IntegrationStep<IntegrationConfig>[] = [
  {
    id: 'fetch-repo-secrets',
    name: 'Fetch Repo Secrets',
    entities: [
      {
        resourceName: 'GitHub Repo Secret',
        _type: GITHUB_REPO_SECRET_ENTITY_TYPE,
        _class: GITHUB_SECRET_ENTITY_CLASS,
      },
    ],
    relationships: [
      {
        _type: GITHUB_REPO_SECRET_RELATIONSHIP_TYPE,
        _class: RelationshipClass.HAS,
        sourceType: GITHUB_REPO_ENTITY_TYPE,
        targetType: GITHUB_REPO_SECRET_ENTITY_TYPE,
      },
      {
        _type: GITHUB_REPO_REPO_SECRET_RELATIONSHIP_TYPE,
        _class: RelationshipClass.USES,
        sourceType: GITHUB_REPO_ENTITY_TYPE,
        targetType: GITHUB_REPO_SECRET_ENTITY_TYPE,
      },
      {
        _type: GITHUB_REPO_SECRET_ORG_SECRET_RELATIONSHIP_TYPE,
        _class: RelationshipClass.OVERRIDES,
        sourceType: GITHUB_REPO_SECRET_ENTITY_TYPE,
        targetType: GITHUB_ORG_SECRET_ENTITY_TYPE,
      },
    ],
    dependsOn: ['fetch-org-secrets', 'fetch-repos'],
    executionHandler: fetchRepoSecrets,
  },
];
