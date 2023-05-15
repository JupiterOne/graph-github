import {
  IntegrationStep,
  IntegrationStepExecutionContext,
  RelationshipClass,
  IntegrationMissingKeyError,
  createDirectRelationship,
} from '@jupiterone/integration-sdk-core';

import { getOrCreateApiClient } from '../client';
import { IntegrationConfig } from '../config';
import { RepoKeyAndName, SecretEntity } from '../types';
import {
  GithubEntities,
  GITHUB_REPO_REPO_SECRET_RELATIONSHIP_TYPE,
  GITHUB_REPO_SECRET_RELATIONSHIP_TYPE,
  GITHUB_REPO_TAGS_ARRAY,
  GITHUB_REPO_SECRET_ORG_SECRET_RELATIONSHIP_TYPE,
  GITHUB_REPO_SECRET_ENTITIES_BY_REPO_NAME_MAP,
  Steps,
} from '../constants';
import { toRepoSecretEntity } from '../sync/converters';
import { getSecretEntityKey } from '../util/propertyHelpers';

export async function fetchRepoSecrets({
  instance,
  logger,
  jobState,
}: IntegrationStepExecutionContext<IntegrationConfig>) {
  const config = instance.config;
  const apiClient = getOrCreateApiClient(config, logger);

  const repoTags = await jobState.getData<RepoKeyAndName[]>(
    GITHUB_REPO_TAGS_ARRAY,
  );
  if (!repoTags) {
    throw new IntegrationMissingKeyError(
      `Expected repos.ts to have set ${GITHUB_REPO_TAGS_ARRAY} in jobState.`,
    );
  }

  //for use in detecting overrides by environmental secrets
  const repoSecretEntitiesByRepoNameMap = {};

  for (const repoTag of repoTags) {
    const repoSecretEntities = {};
    await apiClient.iterateRepoSecrets(repoTag.name, async (secret) => {
      const secretEntity = (await jobState.addEntity(
        toRepoSecretEntity(
          secret,
          apiClient.graphQLClient.login,
          config.githubApiBaseUrl,
          repoTag.name,
        ),
      )) as SecretEntity;
      repoSecretEntities[secret.name] = secretEntity;

      await jobState.addRelationship(
        createDirectRelationship({
          _class: RelationshipClass.HAS,
          fromType: GithubEntities.GITHUB_REPO._type,
          toType: GithubEntities.GITHUB_REPO_SECRET._type,
          fromKey: repoTag._key,
          toKey: secretEntity._key,
        }),
      );

      await jobState.addRelationship(
        createDirectRelationship({
          _class: RelationshipClass.USES,
          fromType: GithubEntities.GITHUB_REPO._type,
          toType: GithubEntities.GITHUB_REPO_SECRET._type,
          fromKey: repoTag._key,
          toKey: secretEntity._key,
        }),
      );

      const keyOfHypotheticalOrgSecretOfSameName = getSecretEntityKey({
        name: secret.name,
        secretOwnerType: 'Org',
        secretOwnerName: apiClient.graphQLClient.login,
      });
      if (await jobState.hasKey(keyOfHypotheticalOrgSecretOfSameName)) {
        await jobState.addRelationship(
          createDirectRelationship({
            _class: RelationshipClass.OVERRIDES,
            fromType: GithubEntities.GITHUB_REPO_SECRET._type,
            toType: GithubEntities.GITHUB_ORG_SECRET._type,
            fromKey: secretEntity._key,
            toKey: keyOfHypotheticalOrgSecretOfSameName,
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
    id: Steps.FETCH_REPO_SECRETS,
    name: 'Fetch Repo Secrets',
    entities: [
      {
        resourceName: 'GitHub Repo Secret',
        _type: GithubEntities.GITHUB_REPO_SECRET._type,
        _class: GithubEntities.GITHUB_REPO_SECRET._class,
      },
    ],
    relationships: [
      {
        _type: GITHUB_REPO_SECRET_RELATIONSHIP_TYPE,
        _class: RelationshipClass.HAS,
        sourceType: GithubEntities.GITHUB_REPO._type,
        targetType: GithubEntities.GITHUB_REPO_SECRET._type,
      },
      {
        _type: GITHUB_REPO_REPO_SECRET_RELATIONSHIP_TYPE,
        _class: RelationshipClass.USES,
        sourceType: GithubEntities.GITHUB_REPO._type,
        targetType: GithubEntities.GITHUB_REPO_SECRET._type,
      },
      {
        _type: GITHUB_REPO_SECRET_ORG_SECRET_RELATIONSHIP_TYPE,
        _class: RelationshipClass.OVERRIDES,
        sourceType: GithubEntities.GITHUB_REPO_SECRET._type,
        targetType: GithubEntities.GITHUB_ORG_SECRET._type,
      },
    ],
    dependsOn: [Steps.FETCH_ORG_SECRETS, Steps.FETCH_REPOS],
    executionHandler: fetchRepoSecrets,
  },
];
