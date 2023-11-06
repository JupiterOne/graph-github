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
  GITHUB_REPO_TAGS_ARRAY,
  Steps,
  Relationships,
} from '../constants';

export async function fetchRepos({
  instance,
  logger,
  jobState,
}: IntegrationStepExecutionContext<IntegrationConfig>) {
  const config = instance.config;
  const apiClient = getOrCreateApiClient(config, logger);

  const accountEntity =
    await jobState.getData<AccountEntity>(DATA_ACCOUNT_ENTITY);

  if (!accountEntity) {
    throw new IntegrationMissingKeyError(
      `Expected to find Account entity in jobState.`,
    );
  }

  const repoTags: RepoKeyAndName[] = []; //for use later in PRs

  await apiClient.iterateRepos(async (repo) => {
    const repoOwner = repo.nameWithOwner.toLowerCase().split('/')[0];
    const repoEntity = toRepositoryEntity(repo);

    await Promise.all([
      (async () => {
        const tags: string[] = [];
        if (!repo.isPrivate) {
          await apiClient.iterateTags(repoOwner, repo.name, (tag) => {
            tags.push(tag.name);
          });
        }
        repoEntity.tags = tags;
      })(),
      (async () => {
        if (apiClient.scopes.repoPages) {
          const pagesInfo = await apiClient.fetchPagesInfoForRepo(
            repoEntity.owner,
            repoEntity.name,
          );
          decorateRepoEntityWithPagesInfo(repoEntity, pagesInfo);
        }
      })(),
      (async () => {
        const topics: string[] = [];
        await apiClient.iterateTopics(repo.name, (topic) => {
          topics.push(topic);
        });
        repoEntity.topics = topics;
      })(),
    ]);
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
    entities: [GithubEntities.GITHUB_REPO],
    relationships: [Relationships.ACCOUNT_OWNS_REPO],
    dependsOn: [Steps.FETCH_ACCOUNT],
    executionHandler: fetchRepos,
  },
];
