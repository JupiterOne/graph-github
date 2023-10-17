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
  GITHUB_REPO_SECRET_ENTITIES_BY_REPO_NAME_MAP,
  Steps,
  IngestionSources,
  Relationships,
} from '../constants';
import { toEnvSecretEntity, getSecretEntityKey } from '../sync/converters';

export async function fetchEnvSecrets({
  instance,
  logger,
  jobState,
}: IntegrationStepExecutionContext<IntegrationConfig>) {
  const config = instance.config;
  const apiClient = getOrCreateApiClient(config, logger);

  const repoSecretEntitiesByRepoNameMap = await jobState.getData<
    IdEntityMap<IdEntityMap<SecretEntity['_key']>>
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
        if (jobState.hasKey(keyOfHypotheticalOrgSecretOfSameName)) {
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

        const repoSecretEntitiesMap = repoSecretEntitiesByRepoNameMap.get(
          envEntity.parentRepoName,
        );
        if (
          repoSecretEntitiesMap &&
          repoSecretEntitiesMap.has(envSecret.name)
        ) {
          await jobState.addRelationship(
            createDirectRelationship({
              _class: RelationshipClass.OVERRIDES,
              fromType: GithubEntities.GITHUB_ENV_SECRET._type,
              fromKey: secretEntity._key,
              toType: GithubEntities.GITHUB_REPO_SECRET._type,
              toKey: repoSecretEntitiesMap.get(envSecret.name) as string,
            }),
          );
        }
      });
    },
  );
}

export const envSecretSteps: IntegrationStep<IntegrationConfig>[] = [
  {
    id: Steps.FETCH_ENV_SECRETS,
    ingestionSourceId: IngestionSources.ENV_SECRETS,
    name: 'Fetch Environment Secrets',
    entities: [GithubEntities.GITHUB_ENV_SECRET],
    relationships: [
      Relationships.ENVIRONMENT_HAS_ENV_SECRET,
      Relationships.REPO_USES_ENV_SECRET,
      Relationships.ENV_SECRET_OVERRIDES_ORG_SECRET,
      Relationships.ENV_SECRET_OVERRIDES_REPO_SECRET,
    ],
    dependsOn: [
      Steps.FETCH_ENVIRONMENTS,
      Steps.FETCH_REPO_SECRETS,
      Steps.FETCH_ORG_SECRETS,
    ],
    executionHandler: fetchEnvSecrets,
  },
];
