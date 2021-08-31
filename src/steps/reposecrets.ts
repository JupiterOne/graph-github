import {
  IntegrationStep,
  IntegrationStepExecutionContext,
  RelationshipClass,
  IntegrationMissingKeyError,
  createDirectRelationship,
} from '@jupiterone/integration-sdk-core';

import { createAPIClient } from '../client';
import { IntegrationConfig } from '../config';
import { RepoEntity, SecretEntity } from '../types';
import {
  GITHUB_REPO_ENTITY_TYPE,
  GITHUB_REPO_SECRET_ENTITY_TYPE,
  GITHUB_ORG_SECRET_ENTITY_TYPE,
  GITHUB_SECRET_ENTITY_CLASS,
  GITHUB_REPO_REPO_SECRET_RELATIONSHIP_TYPE,
  GITHUB_REPO_SECRET_RELATIONSHIP_TYPE,
  GITHUB_REPO_ARRAY,
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

  const repoEntities = await jobState.getData<RepoEntity[]>(GITHUB_REPO_ARRAY);
  if (!repoEntities) {
    throw new IntegrationMissingKeyError(
      `Expected repos.ts to have set ${GITHUB_REPO_ARRAY} in jobState.`,
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

  //for use in detecting overrides by environmental secrets
  const repoSecretEntitiesByRepoNameMap = {};

  for (const repoEntity of repoEntities) {
    const repoSecretEntities: SecretEntity[] = [];
    await apiClient.iterateRepoSecrets(repoEntity.name, async (secret) => {
      const secretEntity = (await jobState.addEntity(
        toRepoSecretEntity(
          secret,
          apiClient.accountClient.login,
          repoEntity.name,
        ),
      )) as SecretEntity;
      repoSecretEntities.push(secretEntity);

      await jobState.addRelationship(
        createDirectRelationship({
          _class: RelationshipClass.HAS,
          from: repoEntity,
          to: secretEntity,
        }),
      );
      await jobState.addRelationship(
        createDirectRelationship({
          _class: RelationshipClass.USES,
          from: repoEntity,
          to: secretEntity,
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
    repoSecretEntitiesByRepoNameMap[repoEntity.name] = repoSecretEntities;
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
    dependsOn: ['fetch-org-secrets'],
    executionHandler: fetchRepoSecrets,
  },
];
