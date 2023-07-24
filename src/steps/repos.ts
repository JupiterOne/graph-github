import {
  IntegrationStep,
  IntegrationStepExecutionContext,
  RelationshipClass,
  IntegrationMissingKeyError,
  createDirectRelationship,
} from '@jupiterone/integration-sdk-core';

import { getOrCreateApiClient } from '../client';
import { IntegrationConfig } from '../config';
import { DATA_ACCOUNT_ENTITY } from './account';
import {
  decorateRepoEntityWithPagesInfo,
  toRepositoryEntity,
} from '../sync/converters';
import { AccountEntity, RepoKeyAndName } from '../types';
import {
  GithubEntities,
  GITHUB_ACCOUNT_REPO_RELATIONSHIP_TYPE,
  GITHUB_REPO_TAGS_ARRAY,
  Steps,
} from '../constants';

export async function fetchRepos({
  instance,
  logger,
  jobState,
}: IntegrationStepExecutionContext<IntegrationConfig>) {
  const config = instance.config;
  const apiClient = getOrCreateApiClient(config, logger);

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
    const tags: string[] = [];
    await apiClient.iterateTags(repo.name, (tag) => {
      tags.push(tag.name);
    });
    const repoEntity = toRepositoryEntity(repo, tags);
    if (apiClient.scopes.repoPages) {
      const pagesInfo = await apiClient.fetchPagesInfoForRepo(
        repoEntity.owner,
        repoEntity.name,
      );
      decorateRepoEntityWithPagesInfo(repoEntity, pagesInfo);
    }
    await jobState.addEntity(repoEntity);

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
    id: Steps.FETCH_REPOS,
    name: 'Fetch Repos',
    entities: [
      {
        resourceName: 'Github Repo',
        _type: GithubEntities.GITHUB_REPO._type,
        _class: GithubEntities.GITHUB_REPO._class,
      },
    ],
    relationships: [
      {
        _type: GITHUB_ACCOUNT_REPO_RELATIONSHIP_TYPE,
        _class: RelationshipClass.OWNS,
        sourceType: GithubEntities.GITHUB_ACCOUNT._type,
        targetType: GithubEntities.GITHUB_REPO._type,
      },
    ],
    dependsOn: [Steps.FETCH_ACCOUNT],
    executionHandler: fetchRepos,
  },
];
