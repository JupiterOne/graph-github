import {
  IntegrationStep,
  IntegrationStepExecutionContext,
  RelationshipClass,
  IntegrationMissingKeyError,
  createDirectRelationship,
} from '@jupiterone/integration-sdk-core';

import { createAPIClient } from '../client';
import { IntegrationConfig } from '../config';
import { DATA_ACCOUNT_ENTITY } from './account';
import { toRepositoryEntity } from '../sync/converters';
import { AccountEntity, RepoEntity, RepoKeyAndName } from '../types';
import {
  GITHUB_ACCOUNT_ENTITY_TYPE,
  GITHUB_REPO_ENTITY_TYPE,
  GITHUB_REPO_ENTITY_CLASS,
  GITHUB_ACCOUNT_REPO_RELATIONSHIP_TYPE,
  GITHUB_REPO_TAGS_ARRAY,
} from '../constants';

export async function fetchRepos({
  instance,
  logger,
  jobState,
}: IntegrationStepExecutionContext<IntegrationConfig>) {
  const config = instance.config;
  const apiClient = createAPIClient(config, logger);

  const accountEntity = await jobState.getData<AccountEntity>(
    DATA_ACCOUNT_ENTITY,
  );

  if (!accountEntity) {
    throw new IntegrationMissingKeyError(
      `Expected to find Account entity in jobState.`,
    );
  }

  const repoTags: RepoKeyAndName[] = []; //for use later in PRs

  await apiClient.iterateRepos(async (repo) => {
    const repoEntity = (await jobState.addEntity(
      toRepositoryEntity(repo),
    )) as RepoEntity;

    repoTags.push({
      _key: repoEntity._key,
      name: repoEntity.name,
      databaseId: repoEntity.databaseId,
    });

    await jobState.addRelationship(
      createDirectRelationship({
        _class: RelationshipClass.OWNS,
        from: accountEntity,
        to: repoEntity,
      }),
    );
  });

  await jobState.setData(GITHUB_REPO_TAGS_ARRAY, repoTags);
}

export const repoSteps: IntegrationStep<IntegrationConfig>[] = [
  {
    id: 'fetch-repos',
    name: 'Fetch Repos',
    entities: [
      {
        resourceName: 'Github Repo',
        _type: GITHUB_REPO_ENTITY_TYPE,
        _class: GITHUB_REPO_ENTITY_CLASS,
      },
    ],
    relationships: [
      {
        _type: GITHUB_ACCOUNT_REPO_RELATIONSHIP_TYPE,
        _class: RelationshipClass.OWNS,
        sourceType: GITHUB_ACCOUNT_ENTITY_TYPE,
        targetType: GITHUB_REPO_ENTITY_TYPE,
      },
    ],
    dependsOn: ['fetch-account'],
    executionHandler: fetchRepos,
  },
];
