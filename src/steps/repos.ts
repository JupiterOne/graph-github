import {
  IntegrationStep,
  IntegrationStepExecutionContext,
  RelationshipClass,
  IntegrationMissingKeyError,
  createDirectRelationship,
  JobState,
  IntegrationLogger,
} from '@jupiterone/integration-sdk-core';

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
  PULL_REQUESTS_TOTAL_BY_REPO,
} from '../constants';
import {
  GithubGraphqlClient,
  OrgRepoQueryResponse,
  TagQueryResponse,
  TopicQueryResponse,
  getOrCreateGraphqlClient,
} from '../client/GraphQLClient';
import { withBatching } from '../client/GraphQLClient/batchUtils';
import {
  GithubRestClient,
  getOrCreateRestClient,
} from '../client/RESTClient/client';
import { determineIngestStartDatetime } from './issues';

const REPOSITORIES_PROCESSING_BATCH_SIZE = 500;

async function fetchTags({
  graphqlClient,
  repositoriesMap,
  tagsTotalByRepo,
  logger,
}: {
  graphqlClient: GithubGraphqlClient;
  repositoriesMap: Map<string, OrgRepoQueryResponse>;
  tagsTotalByRepo: Map<string, number>;
  logger: IntegrationLogger;
}) {
  const tags = new Map<string, TagQueryResponse[]>();

  const iteratee = (tag: TagQueryResponse) => {
    if (!tags.has(tag.repoId)) {
      tags.set(tag.repoId, []);
    }
    const repoTags = tags.get(tag.repoId) ?? [];
    repoTags.push(tag);
  };

  await withBatching({
    totalConnectionsById: tagsTotalByRepo,
    threshold: 100,
    batchCb: async (repoIds) => {
      await graphqlClient.iterateTags(repoIds, iteratee);
    },
    singleCb: async (repoId) => {
      const repo = repositoriesMap.get(repoId);
      if (!repo) {
        return;
      }
      await graphqlClient.iterateTags(repo.name, iteratee);
    },
    logger,
  });

  return tags;
}

async function fetchTopics({
  graphqlClient,
  repositoriesMap,
  topicsTotalByRepo,
  logger,
}: {
  graphqlClient: GithubGraphqlClient;
  repositoriesMap: Map<string, OrgRepoQueryResponse>;
  topicsTotalByRepo: Map<string, number>;
  logger: IntegrationLogger;
}) {
  const topics = new Map<string, TopicQueryResponse[]>();

  const iteratee = (topic: TopicQueryResponse) => {
    if (!topics.has(topic.repoId)) {
      topics.set(topic.repoId, []);
    }
    const repoTopics = topics.get(topic.repoId) ?? [];
    repoTopics.push(topic);
  };

  await withBatching({
    totalConnectionsById: topicsTotalByRepo,
    threshold: 100,
    batchCb: async (repoIds) => {
      await graphqlClient.iterateTopics(repoIds, iteratee);
    },
    singleCb: async (repoId) => {
      const repo = repositoriesMap.get(repoId);
      if (!repo) {
        return;
      }
      await graphqlClient.iterateTopics(repo.name, iteratee);
    },
    logger,
  });

  return topics;
}

const processRepository = async ({
  repo,
  tags,
  topics,
  accountEntity,
  restClient,
  jobState,
  repoTags,
  branchProtectionRuleTotalByRepo,
  collaboratorsTotalByRepo,
  vulnAlertsTotalByRepo,
  issuesTotalByRepo,
  pullRequestsTotalByRepo,
}: {
  repo: OrgRepoQueryResponse;
  tags: TagQueryResponse[];
  topics: TopicQueryResponse[];
  accountEntity: AccountEntity;
  jobState: JobState;
  restClient: GithubRestClient;
  repoTags: Map<string, RepoData>;
  branchProtectionRuleTotalByRepo: Map<string, number>;
  collaboratorsTotalByRepo: Map<string, number>;
  vulnAlertsTotalByRepo: Map<string, number>;
  issuesTotalByRepo: Map<string, number>;
  pullRequestsTotalByRepo: Map<string, number>;
}) => {
  const repoEntity = toRepositoryEntity(repo);

  repoEntity.tags = tags.map((t) => t.name);
  repoEntity.topics = topics.map((t) => t.name);

  // Fetch Repo Pages
  const pagesInfo = await restClient.fetchPagesInfoForRepo(
    repoEntity.owner,
    repoEntity.name,
  );
  if (pagesInfo) {
    decorateRepoEntityWithPagesInfo(repoEntity, pagesInfo);
  }

  await jobState.addEntity(repoEntity);

  repoTags.set(repoEntity._key, {
    _key: repoEntity._key,
    name: repoEntity.name,
    databaseId: repoEntity.databaseId,
    public: repoEntity.public,
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
  if (repo.pullRequests.totalCount) {
    pullRequestsTotalByRepo.set(repoEntity._key, repo.pullRequests.totalCount);
  }

  await jobState.addRelationship(
    createDirectRelationship({
      _class: RelationshipClass.OWNS,
      from: accountEntity,
      to: repoEntity,
    }),
  );
};

export async function fetchRepos({
  instance,
  logger,
  jobState,
}: IntegrationStepExecutionContext<IntegrationConfig>) {
  const config = instance.config;
  const restClient = getOrCreateRestClient(config, logger);
  const graphqlClient = getOrCreateGraphqlClient(config, logger);

  const accountEntity =
    await jobState.getData<AccountEntity>(DATA_ACCOUNT_ENTITY);

  if (!accountEntity) {
    throw new IntegrationMissingKeyError(
      `Expected to find Account entity in jobState.`,
    );
  }

  const issuesSinceDate = determineIngestStartDatetime(config);

  const repoTags = new Map<string, RepoData>();
  const branchProtectionRuleTotalByRepo = new Map<string, number>();
  const collaboratorsTotalByRepo = new Map<string, number>();
  const vulnAlertsTotalByRepo = new Map<string, number>();
  const issuesTotalByRepo = new Map<string, number>();
  const pullRequestsTotalByRepo = new Map<string, number>();

  const repositoriesMap = new Map<string, OrgRepoQueryResponse>();
  const tagsTotalByRepo = new Map<string, number>();
  const topicsTotalByRepo = new Map<string, number>();

  const processReposBatch = async () => {
    const tagsByRepo = await fetchTags({
      graphqlClient,
      repositoriesMap,
      tagsTotalByRepo,
      logger,
    });
    const topicsByRepo = await fetchTopics({
      graphqlClient,
      repositoriesMap,
      topicsTotalByRepo,
      logger,
    });

    for (const repo of repositoriesMap.values()) {
      await processRepository({
        repo,
        tags: tagsByRepo.get(repo.id) ?? [],
        topics: topicsByRepo.get(repo.id) ?? [],
        accountEntity,
        restClient,
        jobState,
        repoTags,
        branchProtectionRuleTotalByRepo,
        collaboratorsTotalByRepo,
        vulnAlertsTotalByRepo,
        issuesTotalByRepo,
        pullRequestsTotalByRepo,
      });
    }
  };

  await graphqlClient.iterateRepositories(issuesSinceDate, async (repo) => {
    repositoriesMap.set(repo.id, repo);
    if (repo.tags?.totalCount) {
      tagsTotalByRepo.set(repo.id, repo.tags.totalCount);
    }
    if (repo.topics.totalCount) {
      topicsTotalByRepo.set(repo.id, repo.topics.totalCount);
    }

    if (repositoriesMap.size >= REPOSITORIES_PROCESSING_BATCH_SIZE) {
      await processReposBatch();
      repositoriesMap.clear();
      tagsTotalByRepo.clear();
      topicsTotalByRepo.clear();
    }
  });

  // flush remaining unprocessed repositories
  if (repositoriesMap.size) {
    await processReposBatch();
  }

  await Promise.all([
    jobState.setData(GITHUB_REPO_TAGS_ARRAY, repoTags),
    jobState.setData(
      BRANCH_PROTECTION_RULE_TOTAL_BY_REPO,
      branchProtectionRuleTotalByRepo,
    ),
    jobState.setData(COLLABORATORS_TOTAL_BY_REPO, collaboratorsTotalByRepo),
    jobState.setData(VULN_ALERTS_TOTAL_BY_REPO, vulnAlertsTotalByRepo),
    jobState.setData(ISSUES_TOTAL_BY_REPO, issuesTotalByRepo),
    jobState.setData(PULL_REQUESTS_TOTAL_BY_REPO, pullRequestsTotalByRepo),
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
