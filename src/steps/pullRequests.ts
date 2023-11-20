import {
  createDirectRelationship,
  Entity,
  Execution,
  IntegrationLogger,
  IntegrationMissingKeyError,
  IntegrationStep,
  IntegrationStepExecutionContext,
  JobState,
  RelationshipClass,
} from '@jupiterone/integration-sdk-core';

import { APIClient, getOrCreateApiClient } from '../client';
import { IntegrationConfig } from '../config';
import { DATA_ACCOUNT_ENTITY } from './account';

import {
  AccountEntity,
  IdEntityMap,
  OutsideCollaboratorData,
  PullRequestEntity,
  RepoData,
} from '../types';
import {
  GITHUB_MEMBER_BY_LOGIN_MAP,
  GITHUB_OUTSIDE_COLLABORATOR_ARRAY,
  GITHUB_REPO_TAGS_ARRAY,
  GithubEntities,
  IngestionSources,
  MappedRelationships,
  PULL_REQUESTS_TOTAL_BY_REPO,
  Relationships,
  Steps,
} from '../constants';
import {
  createAssociatedMergePullRequestRelationship,
  createUnknownUserIssueRelationship,
  toPullRequestEntity,
} from '../sync/converters';
import { cloneDeep } from 'lodash';
import { hasAssociatedMergePullRequest } from '../sync/converterUtils';
import { sub } from 'date-fns';
import {
  Commit,
  Label,
  PullRequestResponse,
  Review,
} from '../client/GraphQLClient';
import { MAX_SEARCH_LIMIT } from '../client/GraphQLClient/paginate';
import { withBatching } from '../client/GraphQLClient/batchUtils';

const PULL_REQUESTS_PROCESSING_BATCH_SIZE = 500;
const DEFAULT_MAX_RESOURCES_PER_EXECUTION = 500;

const fetchCommits = async ({
  apiClient,
  pullRequestsMap,
  commitsTotalByPullRequest,
  logger,
}: {
  apiClient: APIClient;
  pullRequestsMap: Map<string, PullRequestResponse>;
  commitsTotalByPullRequest: Map<string, number>;
  logger: IntegrationLogger;
}) => {
  const commits = new Map<string, Commit[]>();

  const iteratee = (commit: Commit) => {
    if (!commits.has(commit.pullRequestId)) {
      commits.set(commit.pullRequestId, []);
    }
    const prCommits = commits.get(commit.pullRequestId) ?? [];
    prCommits.push(commit);
  };

  await withBatching({
    totalConnectionsById: commitsTotalByPullRequest,
    threshold: 25,
    batchCb: async (pullRequestIds) => {
      await apiClient.iterateBatchedCommits(pullRequestIds, iteratee);
    },
    singleCb: async (pullRequestId) => {
      const pullRequest = pullRequestsMap.get(pullRequestId);
      if (!pullRequest) {
        return;
      }
      const repoName = pullRequest.baseRepository.name;
      await apiClient.iterateCommits(repoName, pullRequest.number, iteratee);
    },
    logger,
  });

  return commits;
};

const fetchLabels = async ({
  apiClient,
  pullRequestsMap,
  labelsTotalByPullRequest,
  logger,
}: {
  apiClient: APIClient;
  pullRequestsMap: Map<string, PullRequestResponse>;
  labelsTotalByPullRequest: Map<string, number>;
  logger: IntegrationLogger;
}) => {
  const labels = new Map<string, Label[]>();

  const iteratee = (label: Label) => {
    if (!labels.has(label.pullRequestId)) {
      labels.set(label.pullRequestId, []);
    }
    const prLabels = labels.get(label.pullRequestId) ?? [];
    prLabels.push(label);
  };

  await withBatching({
    totalConnectionsById: labelsTotalByPullRequest,
    threshold: 25,
    batchCb: async (pullRequestIds) => {
      await apiClient.iterateBatchedLabels(pullRequestIds, iteratee);
    },
    singleCb: async (pullRequestId) => {
      const pullRequest = pullRequestsMap.get(pullRequestId);
      if (!pullRequest) {
        return;
      }
      const repoName = pullRequest.baseRepository.name;
      await apiClient.iterateLabels(repoName, pullRequest.number, iteratee);
    },
    logger,
  });

  return labels;
};

const fetchReviews = async ({
  apiClient,
  pullRequestsMap,
  reviewsTotalByPullRequest,
  logger,
}: {
  apiClient: APIClient;
  pullRequestsMap: Map<string, PullRequestResponse>;
  reviewsTotalByPullRequest: Map<string, number>;
  logger: IntegrationLogger;
}) => {
  const reviews = new Map<string, Review[]>();

  const iteratee = (review: Review) => {
    if (!reviews.has(review.pullRequestId)) {
      reviews.set(review.pullRequestId, []);
    }
    const prReviews = reviews.get(review.pullRequestId) as Review[];
    prReviews.push(review);
  };

  await withBatching({
    totalConnectionsById: reviewsTotalByPullRequest,
    threshold: 25,
    batchCb: async (pullRequestIds) => {
      await apiClient.iterateBatchedReviews(pullRequestIds, iteratee);
    },
    singleCb: async (pullRequestId) => {
      const pullRequest = pullRequestsMap.get(pullRequestId);
      if (!pullRequest) {
        return;
      }
      const repoName = pullRequest.baseRepository.name;
      const isPublicRepo = !pullRequest.baseRepository.isPrivate;
      await apiClient.iterateReviews(
        repoName,
        isPublicRepo,
        pullRequest.number,
        iteratee,
      );
    },
    logger,
  });

  return reviews;
};

const processPullRequest = async ({
  jobState,
  logger,
  pullRequest,
  labels,
  commits,
  reviews,
  teamMembersByLoginMap,
  usersByLoginMap,
}: {
  jobState: JobState;
  logger: IntegrationLogger;
  pullRequest: PullRequestResponse;
  labels: Label[];
  commits: Commit[];
  reviews: Review[];
  teamMembersByLoginMap: IdEntityMap<string>;
  usersByLoginMap?: Map<string, string>;
}) => {
  const pr = toPullRequestEntity({
    pullRequest,
    reviews,
    labels,
    commits,
    teamMembersByLoginMap,
    allKnownUsersByLoginMap: usersByLoginMap!,
  });

  // If we receive a new PR into a repo while paginating, the
  // results will shift and cause us to see a PR twice.
  // We should skip both entity and relationship creation as we
  // cannot have duplicate keys for either.
  if (jobState.hasKey(pr._key)) {
    logger.info({ key: pr._key }, 'PR already exists in job state.');
    return;
  }

  const prEntity = (await jobState.addEntity(pr)) as PullRequestEntity;

  const repoKey = pullRequest.baseRepository.id;
  if (jobState.hasKey(repoKey)) {
    await jobState.addRelationship(
      createDirectRelationship({
        _class: RelationshipClass.HAS,
        fromKey: repoKey,
        fromType: GithubEntities.GITHUB_REPO._type,
        toKey: prEntity._key,
        toType: GithubEntities.GITHUB_PR._type,
      }),
    );
  }

  if (hasAssociatedMergePullRequest(pullRequest)) {
    await jobState.addRelationship(
      createAssociatedMergePullRequestRelationship(pullRequest),
    );
  }

  if (usersByLoginMap?.has(pr.authorLogin)) {
    await jobState.addRelationship(
      createDirectRelationship({
        _class: RelationshipClass.OPENED,
        fromType: GithubEntities.GITHUB_MEMBER._type,
        fromKey: usersByLoginMap.get(pr.authorLogin) as string,
        toType: GithubEntities.GITHUB_PR._type,
        toKey: prEntity._key,
      }),
    );
  } else {
    //we don't recognize this author - make a mapped relationship
    await jobState.addRelationship(
      createUnknownUserIssueRelationship(
        pr.authorLogin,
        Relationships.USER_OPENED_PULLREQUEST._type,
        RelationshipClass.OPENED,
        prEntity._key,
      ),
    );
  }

  if (pr.reviewerLogins) {
    for (const reviewer of pr.reviewerLogins) {
      if (usersByLoginMap?.has(reviewer)) {
        await jobState.addRelationship(
          createDirectRelationship({
            _class: RelationshipClass.REVIEWED,
            fromType: GithubEntities.GITHUB_MEMBER._type,
            fromKey: usersByLoginMap.get(reviewer) as string,
            toType: GithubEntities.GITHUB_PR._type,
            toKey: prEntity._key,
          }),
        );
      } else {
        //we don't recognize this reviewer - make a mapped relationship
        await jobState.addRelationship(
          createUnknownUserIssueRelationship(
            reviewer,
            Relationships.USER_REVIEWED_PULLREQUEST._type,
            RelationshipClass.REVIEWED,
            prEntity._key,
          ),
        );
      }
    }
  }

  if (pr.approverLogins) {
    for (const approver of pr.approverLogins) {
      if (usersByLoginMap?.has(approver)) {
        await jobState.addRelationship(
          createDirectRelationship({
            _class: RelationshipClass.APPROVED,
            fromType: GithubEntities.GITHUB_MEMBER._type,
            fromKey: usersByLoginMap.get(approver) as string,
            toType: GithubEntities.GITHUB_PR._type,
            toKey: prEntity._key,
          }),
        );
      } else {
        //we don't recognize this approver - make a mapped relationship
        await jobState.addRelationship(
          createUnknownUserIssueRelationship(
            approver,
            Relationships.USER_APPROVED_PULLREQUEST._type,
            RelationshipClass.APPROVED,
            prEntity._key,
          ),
        );
      }
    }
  }
};

const PollingIntervalToDurationMap: Record<string, Duration> = {
  DISABLED: {},
  ONE_WEEK: { days: 7 },
  ONE_DAY: { days: 1 },
  TWELVE_HOURS: { hours: 12 },
  EIGHT_HOURS: { hours: 8 },
  FOUR_HOURS: { hours: 4 },
  ONE_HOUR: { hours: 1 },
  THIRTY_MINUTES: { minutes: 30 },
};

/**
 * Determines what the ingestion start datetime should be for PRs.
 * Values are considered in the following order:
 * 1. Value provided by config
 * 2. last successful build time
 * 3. Defaults to Unix epoch
 * @param config
 * @param lastSuccessful
 */
export const determineIngestStartDatetime = (
  config: IntegrationConfig,
  lastSuccessful?: Execution,
): string => {
  let startDatetime;
  if (config.pullRequestIngestStartDatetime) {
    // Allows for historical pull requests to be ingested.
    startDatetime = config.pullRequestIngestStartDatetime;
  } else if (lastSuccessful?.startedOn) {
    startDatetime = lastSuccessful?.startedOn;

    // subtract a pollingInterval to collect any missed PRs during the previous run
    if (
      config.pollingInterval &&
      PollingIntervalToDurationMap[config.pollingInterval]
    ) {
      startDatetime = sub(
        startDatetime,
        PollingIntervalToDurationMap[config.pollingInterval],
      );
    }
  } else {
    startDatetime = 0;
  }

  return new Date(startDatetime).toISOString();
};

export async function fetchPrs(
  context: IntegrationStepExecutionContext<IntegrationConfig>,
) {
  const config = context.instance.config;
  const jobState = context.jobState;
  const logger = context.logger;

  const apiClient = getOrCreateApiClient(config, logger);

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

  let usersByLoginMap = await jobState.getData<IdEntityMap<Entity['_key']>>(
    GITHUB_MEMBER_BY_LOGIN_MAP,
  );

  if (!usersByLoginMap) {
    logger.warn(
      {},
      `Expected members.ts to have set ${GITHUB_MEMBER_BY_LOGIN_MAP} in jobState. Proceeding anyway.`,
    );
    usersByLoginMap = new Map();
  }
  const teamMembersByLoginMap = cloneDeep(usersByLoginMap) ?? new Map();

  const outsideCollaboratorEntities = await jobState.getData<
    OutsideCollaboratorData[]
  >(GITHUB_OUTSIDE_COLLABORATOR_ARRAY);
  if (outsideCollaboratorEntities) {
    for (const collab of outsideCollaboratorEntities) {
      usersByLoginMap.set(collab.login, collab.key);
    }
  } else {
    logger.warn(
      {},
      `Expected collaborators.ts to have set ${GITHUB_OUTSIDE_COLLABORATOR_ARRAY} in jobState. Proceeding anyway.`,
    );
  }

  const ingestStartDatetime = determineIngestStartDatetime(
    config,
    context.executionHistory.lastSuccessful,
  );
  const maxResourceIngestion =
    config.pullRequestMaxResourcesPerRepo ??
    DEFAULT_MAX_RESOURCES_PER_EXECUTION;

  const maxSearchLimit = Number(
    config.pullRequestMaxSearchLimit ?? MAX_SEARCH_LIMIT,
  );

  logger.info(
    { ingestStartDatetime, maxResourceIngestion },
    'Pull requests will be ingested starting on the specified date with the specified max resources to ingest.',
  );

  const pullRequestsTotalByRepo = await jobState.getData<Map<string, number>>(
    PULL_REQUESTS_TOTAL_BY_REPO,
  );
  if (!pullRequestsTotalByRepo) {
    return;
  }

  const pullRequestsMap = new Map<string, PullRequestResponse>();
  const reviewsTotalByPullRequest = new Map<string, number>();
  const labelsTotalByPullRequest = new Map<string, number>();
  const commitsTotalByPullRequest = new Map<string, number>();

  const processRawPullRequests = async () => {
    const commitsByPullRequest = await fetchCommits({
      apiClient,
      pullRequestsMap,
      commitsTotalByPullRequest,
      logger,
    });
    const labelsByPullRequest = await fetchLabels({
      apiClient,
      pullRequestsMap,
      labelsTotalByPullRequest,
      logger,
    });
    const reviewsByPullRequest = await fetchReviews({
      apiClient,
      pullRequestsMap,
      reviewsTotalByPullRequest,
      logger,
    });

    await Promise.all(
      Array.from(pullRequestsMap.values()).map((pullRequest) => {
        return processPullRequest({
          jobState,
          logger,
          pullRequest,
          labels: labelsByPullRequest.get(pullRequest.id) ?? [],
          commits: commitsByPullRequest.get(pullRequest.id) ?? [],
          reviews: reviewsByPullRequest.get(pullRequest.id) ?? [],
          teamMembersByLoginMap,
          usersByLoginMap,
        });
      }),
    );
  };

  const iteratee = async (pullRequest: PullRequestResponse) => {
    pullRequestsMap.set(pullRequest.id, pullRequest);
    if (
      !pullRequest.baseRepository.isPrivate &&
      pullRequest.commits.totalCount
    ) {
      commitsTotalByPullRequest.set(
        pullRequest.id,
        pullRequest.commits.totalCount,
      );
    }
    if (pullRequest.labels.totalCount) {
      labelsTotalByPullRequest.set(
        pullRequest.id,
        pullRequest.labels.totalCount,
      );
    }
    if (pullRequest.reviews.totalCount) {
      reviewsTotalByPullRequest.set(
        pullRequest.id,
        pullRequest.reviews.totalCount,
      );
    }

    if (pullRequestsMap.size >= PULL_REQUESTS_PROCESSING_BATCH_SIZE) {
      await processRawPullRequests();
      pullRequestsMap.clear();
      commitsTotalByPullRequest.clear();
      labelsTotalByPullRequest.clear();
      reviewsTotalByPullRequest.clear();
    }
  };

  await withBatching({
    totalConnectionsById: pullRequestsTotalByRepo,
    threshold: 25,
    batchCb: async (repoKeys) => {
      await apiClient.iterateBatchedPullRequests(repoKeys, iteratee);
    },
    singleCb: async (repoKey) => {
      const repoData = repoTags.get(repoKey);
      if (!repoData) {
        return;
      }
      await apiClient.iteratePullRequests(
        repoData.name,
        repoData.public,
        ingestStartDatetime,
        maxResourceIngestion,
        maxSearchLimit,
        iteratee,
      );
    },
    logger,
  });

  // flush, process any remaining PRs
  if (pullRequestsMap.size) {
    await processRawPullRequests();
    pullRequestsMap.clear();
    commitsTotalByPullRequest.clear();
    labelsTotalByPullRequest.clear();
    reviewsTotalByPullRequest.clear();
  }
}

export const prSteps: IntegrationStep<IntegrationConfig>[] = [
  {
    id: Steps.FETCH_PRS,
    ingestionSourceId: IngestionSources.PRS,
    name: 'Fetch Pull Requests',
    entities: [GithubEntities.GITHUB_PR],
    relationships: [
      Relationships.REPO_HAS_PULLREQUEST,
      Relationships.USER_APPROVED_PULLREQUEST,
      Relationships.USER_OPENED_PULLREQUEST,
      Relationships.USER_REVIEWED_PULLREQUEST,
      Relationships.PULLREQUEST_CONTAINS_PULLREQUEST,
    ],
    mappedRelationships: [
      MappedRelationships.USER_OPENED_PULLREQUEST,
      MappedRelationships.USER_REVIEWED_PULLREQUEST,
      MappedRelationships.USER_APPROVED_PULLREQUEST,
    ],
    dependsOn: [
      Steps.FETCH_REPOS,
      Steps.FETCH_USERS,
      Steps.FETCH_COLLABORATORS,
    ],
    executionHandler: fetchPrs,
  },
];
