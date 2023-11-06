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
import { AccountEntity, RepoData } from '../types';
import {
  GithubEntities,
  GITHUB_REPO_TAGS_ARRAY,
  Steps,
  Relationships,
  BRANCH_PROTECTION_RULE_TOTAL_BY_REPO,
  COLLABORATORS_TOTAL_BY_REPO,
  VULN_ALERTS_TOTAL_BY_REPO,
  ISSUES_TOTAL_BY_REPO,
} from '../constants';

export async function fetchRepos({
  instance,
  logger,
  jobState,
  executionHistory,
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

  const lastSuccessfulSyncTime =
    executionHistory.lastSuccessful?.startedOn ?? 0;
  const lastSuccessfulExecution = new Date(
    lastSuccessfulSyncTime,
  ).toISOString();

  const repoTags = new Map<string, RepoData>();
  const branchProtectionRuleTotalByRepo = new Map<string, number>();
  const collaboratorsTotalByRepo = new Map<string, number>();
  const vulnAlertsTotalByRepo = new Map<string, number>();
  const issuesTotalByRepo = new Map<string, number>();

  await apiClient.iterateRepos({ lastSuccessfulExecution }, async (repo) => {
    const repoOwner = repo.nameWithOwner.toLowerCase().split('/')[0];
    const repoEntity = toRepositoryEntity(repo);

    // Fetch tags
    const tags: string[] = [];
    if (!repo.isPrivate) {
      await apiClient.iterateTags(repoOwner, repo.name, (tag) => {
        tags.push(tag.name);
      });
    }
    repoEntity.tags = tags;

    // Fetch Repo Pages
    if (apiClient.scopes.repoPages) {
      const pagesInfo = await apiClient.fetchPagesInfoForRepo(
        repoEntity.owner,
        repoEntity.name,
      );
      decorateRepoEntityWithPagesInfo(repoEntity, pagesInfo);
    }

    // Fetch Repo Topics
    const topics: string[] = [];
    await apiClient.iterateTopics(repo.name, (topic) => {
      topics.push(topic);
    });
    repoEntity.topics = topics;

    await jobState.addEntity(repoEntity);

    repoTags.set(repoEntity._key, {
      _key: repoEntity._key,
      name: repoEntity.name,
      databaseId: repoEntity.databaseId,
    });

    if (repo.branchProtectionRules.totalCount) {
      branchProtectionRuleTotalByRepo.set(
        repoEntity._key,
        repo.branchProtectionRules.totalCount,
      );
    }
    if (repo.collaborators.totalCount) {
      collaboratorsTotalByRepo.set(
        repoEntity._key,
        repo.collaborators.totalCount,
      );
    }
    if (repo.vulnerabilityAlerts.totalCount) {
      vulnAlertsTotalByRepo.set(
        repoEntity._key,
        repo.vulnerabilityAlerts.totalCount,
      );
    }
    if (repo.issues.totalCount) {
      issuesTotalByRepo.set(repoEntity._key, repo.issues.totalCount);
    }

    await jobState.addRelationship(
      createDirectRelationship({
        _class: RelationshipClass.OWNS,
        from: accountEntity,
        to: repoEntity,
      }),
    );
  });

  await Promise.all([
    jobState.setData(GITHUB_REPO_TAGS_ARRAY, repoTags),
    jobState.setData(
      BRANCH_PROTECTION_RULE_TOTAL_BY_REPO,
      branchProtectionRuleTotalByRepo,
    ),
    jobState.setData(COLLABORATORS_TOTAL_BY_REPO, collaboratorsTotalByRepo),
    jobState.setData(VULN_ALERTS_TOTAL_BY_REPO, vulnAlertsTotalByRepo),
    jobState.setData(ISSUES_TOTAL_BY_REPO, issuesTotalByRepo),
  ]);
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
