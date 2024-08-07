import {
  IntegrationStep,
  IntegrationStepExecutionContext,
  RelationshipClass,
  IntegrationMissingKeyError,
  createDirectRelationship,
} from '@jupiterone/integration-sdk-core';

import { IntegrationConfig } from '../config';
import { DATA_ACCOUNT_ENTITY } from './account';
import { AccountEntity, RepoData, SecretEntity } from '../types';
import {
  GithubEntities,
  GITHUB_REPO_TAGS_ARRAY,
  Steps,
  IngestionSources,
  Relationships,
} from '../constants';
import { toOrgSecretEntity } from '../sync/converters';
import { getOrCreateRestClient } from '../client/RESTClient/client';

export async function fetchOrgSecrets({
  instance,
  logger,
  jobState,
}: IntegrationStepExecutionContext<IntegrationConfig>) {
  const config = instance.config;
  const restClient = getOrCreateRestClient(config, logger);

  const accountEntity =
    await jobState.getData<AccountEntity>(DATA_ACCOUNT_ENTITY);
  if (!accountEntity) {
    throw new IntegrationMissingKeyError(
      `Expected to find Account entity in jobState.`,
    );
  }
  const repoTags = await jobState.getData<Map<string, RepoData>>(
    GITHUB_REPO_TAGS_ARRAY,
  );
  if (!repoTags) {
    throw new IntegrationMissingKeyError(
      `Expected repos.ts to have set ${GITHUB_REPO_TAGS_ARRAY} in jobState.`,
    );
  }

  await restClient.iterateOrgSecrets(repoTags, async (secret) => {
    const secretEntity = (await jobState.addEntity(
      toOrgSecretEntity(
        secret,
        await restClient.getOrganizationLogin(),
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
    ingestionSourceId: IngestionSources.ORG_SECRETS,
    name: 'Fetch Organization Secrets',
    entities: [GithubEntities.GITHUB_ORG_SECRET],
    relationships: [
      Relationships.ACCOUNT_HAS_ORG_SECRET,
      Relationships.REPO_USES_ORG_SECRET,
    ],
    dependsOn: [Steps.FETCH_ACCOUNT, Steps.FETCH_REPOS],
    executionHandler: fetchOrgSecrets,
  },
];
