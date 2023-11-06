import {
  createDirectRelationship,
  Entity,
  Execution,
  IntegrationMissingKeyError,
  IntegrationStep,
  IntegrationStepExecutionContext,
  RelationshipClass,
} from '@jupiterone/integration-sdk-core';

import { getOrCreateApiClient } from '../client';
import { IntegrationConfig } from '../config';
import { DATA_ACCOUNT_ENTITY } from './account';

import {
  AccountEntity,
  IdEntityMap,
  OutsideCollaboratorData,
  PullRequestEntity,
  RepoEntity,
} from '../types';
import {
  GITHUB_MEMBER_BY_LOGIN_MAP,
  GITHUB_OUTSIDE_COLLABORATOR_ARRAY,
  GithubEntities,
  IngestionSources,
  MappedRelationships,
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
import { Commit, Label, Review } from '../client/GraphQLClient';
import { MAX_SEARCH_LIMIT } from '../client/GraphQLClient/paginate';

const DEFAULT_MAX_RESOURCES_PER_EXECUTION = 500;

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

  await jobState.iterateEntities<RepoEntity>(
    { _type: GithubEntities.GITHUB_REPO._type },
    async (repoEntity) => {
      try {
        await apiClient.iteratePullRequests(
          repoEntity,
          logger,
          ingestStartDatetime,
          maxResourceIngestion,
          maxSearchLimit,
          async (pullRequest) => {
            const pullRequestReviews: Review[] = [];
            await apiClient.iterateReviews(
              repoEntity,
              pullRequest.number,
              logger,
              (review) => {
                pullRequestReviews.push(review);
              },
            );
            const pullRequestLabels: Label[] = [];
            await apiClient.iterateLabels(
              repoEntity,
              pullRequest.number,
              logger,
              (label) => {
                pullRequestLabels.push(label);
              },
            );
            const pullRequestCommits: Commit[] = [];
            if (repoEntity.public) {
              await apiClient.iterateCommits(
                repoEntity,
                pullRequest.number,
                logger,
                (commit) => {
                  pullRequestCommits.push(commit);
                },
              );
            }

            const pr = toPullRequestEntity({
              pullRequest,
              reviews: pullRequestReviews,
              labels: pullRequestLabels,
              commits: pullRequestCommits,
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

            const prEntity = (await jobState.addEntity(
              pr,
            )) as PullRequestEntity;

            await jobState.addRelationship(
              createDirectRelationship({
                _class: RelationshipClass.HAS,
                from: repoEntity,
                to: prEntity,
              }),
            );

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
          },
        );
      } catch (error) {
        logger.error(
          {
            errors: JSON.stringify(error),
            repoName: repoEntity.name,
            repoKey: repoEntity._key,
          },
          'Unable to process pull request entities due to error.',
        );
        throw error;
      }
    },
  );
}

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
