import {
  IntegrationStep,
  IntegrationStepExecutionContext,
  RelationshipClass,
  IntegrationMissingKeyError,
  createDirectRelationship,
  Entity,
} from '@jupiterone/integration-sdk-core';

import { IntegrationConfig } from '../config';
import { IdEntityMap, RepoData, SecretEntity } from '../types';
import {
  GithubEntities,
  GITHUB_REPO_TAGS_ARRAY,
  GITHUB_REPO_SECRET_ENTITIES_BY_REPO_NAME_MAP,
  Steps,
  IngestionSources,
  Relationships,
} from '../constants';
import { toRepoSecretEntity, getSecretEntityKey } from '../sync/converters';
import { getOrCreateRestClient } from '../client/RESTClient/client';

export async function fetchRepoSecrets({
  instance,
  logger,
  jobState,
}: IntegrationStepExecutionContext<IntegrationConfig>) {
  const config = instance.config;
  const restClient = getOrCreateRestClient(config, logger);

  const repoTags = await jobState.getData<Map<string, RepoData>>(
    GITHUB_REPO_TAGS_ARRAY,
  );
  if (!repoTags) {
    throw new IntegrationMissingKeyError(
      `Expected repos.ts to have set ${GITHUB_REPO_TAGS_ARRAY} in jobState.`,
    );
  }

  //for use in detecting overrides by environmental secrets
  const repoSecretEntitiesByRepoNameMap: IdEntityMap<
    IdEntityMap<Entity['_key']>
  > = new Map();

  for (const [repoKey, repoData] of repoTags) {
    const repoSecretEntities: IdEntityMap<Entity['_key']> = new Map();
    await restClient.iterateRepoSecrets(repoData.name, async (secret) => {
      const secretEntity = (await jobState.addEntity(
        toRepoSecretEntity(
          secret,
          await restClient.getOrganizationLogin(),
          config.githubApiBaseUrl,
          repoData.name,
        ),
      )) as SecretEntity;
      repoSecretEntities.set(secret.name, secretEntity._key);

      await jobState.addRelationship(
        createDirectRelationship({
          _class: RelationshipClass.HAS,
          fromType: GithubEntities.GITHUB_REPO._type,
          toType: GithubEntities.GITHUB_REPO_SECRET._type,
          fromKey: repoKey,
          toKey: secretEntity._key,
        }),
      );

      await jobState.addRelationship(
        createDirectRelationship({
          _class: RelationshipClass.USES,
          fromType: GithubEntities.GITHUB_REPO._type,
          toType: GithubEntities.GITHUB_REPO_SECRET._type,
          fromKey: repoKey,
          toKey: secretEntity._key,
        }),
      );

      const keyOfHypotheticalOrgSecretOfSameName = getSecretEntityKey({
        name: secret.name,
        secretOwnerType: 'Org',
        secretOwnerName: await restClient.getOrganizationLogin(),
      });
      if (jobState.hasKey(keyOfHypotheticalOrgSecretOfSameName)) {
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
    repoSecretEntitiesByRepoNameMap.set(repoData.name, repoSecretEntities);
  }
  await jobState.setData(
    GITHUB_REPO_SECRET_ENTITIES_BY_REPO_NAME_MAP,
    repoSecretEntitiesByRepoNameMap,
  );
}

export const repoSecretSteps: IntegrationStep<IntegrationConfig>[] = [
  {
    id: Steps.FETCH_REPO_SECRETS,
    ingestionSourceId: IngestionSources.REPO_SECRETS,
    name: 'Fetch Repo Secrets',
    entities: [GithubEntities.GITHUB_REPO_SECRET],
    relationships: [
      Relationships.REPO_HAS_SECRET,
      Relationships.REPO_USES_SECRET,
      Relationships.REPO_SECRET_OVERRIDES_ORG_SECRET,
    ],
    dependsOn: [Steps.FETCH_ORG_SECRETS, Steps.FETCH_REPOS],
    executionHandler: fetchRepoSecrets,
  },
];
