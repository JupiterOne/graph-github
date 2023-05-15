import {
  createDirectRelationship,
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
  PullRequestEntity,
  RepoEntity,
  UserEntity,
} from '../types';
import {
  GITHUB_MEMBER_APPROVED_PR_RELATIONSHIP_TYPE,
  GITHUB_MEMBER_BY_LOGIN_MAP,
  GITHUB_MEMBER_OPENED_PR_RELATIONSHIP_TYPE,
  GITHUB_MEMBER_REVIEWED_PR_RELATIONSHIP_TYPE,
  GITHUB_OUTSIDE_COLLABORATOR_ARRAY,
  GITHUB_PR_CONTAINS_PR_RELATIONSHIP_TYPE,
  GITHUB_REPO_PR_RELATIONSHIP_TYPE,
  GithubEntities,
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

const DEFAULT_MAX_RESOURCES_PER_EXECUTION = 500;

export async function fetchPrs(
  context: IntegrationStepExecutionContext<IntegrationConfig>,
) {
  const config = context.instance.config;
  const jobState = context.jobState;
  const logger = context.logger;

  const apiClient = getOrCreateApiClient(config, logger);

  const accountEntity = await jobState.getData<AccountEntity>(
    DATA_ACCOUNT_ENTITY,
  );
  if (!accountEntity) {
    throw new IntegrationMissingKeyError(
      `Expected to find Account entity in jobState.`,
    );
  }

  let usersByLoginMap = await jobState.getData<IdEntityMap<UserEntity>>(
    GITHUB_MEMBER_BY_LOGIN_MAP,
  );

  if (!usersByLoginMap) {
    logger.warn(
      {},
      `Expected members.ts to have set ${GITHUB_MEMBER_BY_LOGIN_MAP} in jobState. Proceeding anyway.`,
    );
    usersByLoginMap = {};
  }
  const teamMembersByLoginMap = cloneDeep(usersByLoginMap) ?? {};

  const outsideCollaboratorEntities = await jobState.getData<UserEntity[]>(
    GITHUB_OUTSIDE_COLLABORATOR_ARRAY,
  );
  if (outsideCollaboratorEntities) {
    for (const collab of outsideCollaboratorEntities) {
      usersByLoginMap[collab.login] = collab;
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
          async (pullRequest) => {
            const pr = toPullRequestEntity(
              pullRequest,
              teamMembersByLoginMap,
              usersByLoginMap!,
            );
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

            if (usersByLoginMap![pr.authorLogin]) {
              await jobState.addRelationship(
                createDirectRelationship({
                  _class: RelationshipClass.OPENED,
                  from: usersByLoginMap![pr.authorLogin],
                  to: prEntity,
                }),
              );
            } else {
              //we don't recognize this author - make a mapped relationship
              await jobState.addRelationship(
                createUnknownUserIssueRelationship(
                  pr.authorLogin,
                  GITHUB_MEMBER_OPENED_PR_RELATIONSHIP_TYPE,
                  RelationshipClass.OPENED,
                  prEntity._key,
                ),
              );
            }

            if (pr.reviewerLogins) {
              for (const reviewer of pr.reviewerLogins) {
                if (usersByLoginMap![reviewer]) {
                  await jobState.addRelationship(
                    createDirectRelationship({
                      _class: RelationshipClass.REVIEWED,
                      from: usersByLoginMap![reviewer],
                      to: prEntity,
                    }),
                  );
                } else {
                  //we don't recognize this reviewer - make a mapped relationship
                  await jobState.addRelationship(
                    createUnknownUserIssueRelationship(
                      reviewer,
                      GITHUB_MEMBER_REVIEWED_PR_RELATIONSHIP_TYPE,
                      RelationshipClass.REVIEWED,
                      prEntity._key,
                    ),
                  );
                }
              }
            }

            if (pr.approverLogins) {
              for (const approver of pr.approverLogins) {
                if (usersByLoginMap![approver]) {
                  await jobState.addRelationship(
                    createDirectRelationship({
                      _class: RelationshipClass.APPROVED,
                      from: usersByLoginMap![approver],
                      to: prEntity,
                    }),
                  );
                } else {
                  //we don't recognize this approver - make a mapped relationship
                  await jobState.addRelationship(
                    createUnknownUserIssueRelationship(
                      approver,
                      GITHUB_MEMBER_APPROVED_PR_RELATIONSHIP_TYPE,
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
    name: 'Fetch Pull Requests',
    entities: [
      {
        resourceName: 'GitHub Pull Request',
        _type: GithubEntities.GITHUB_PR._type,
        _class: GithubEntities.GITHUB_PR._class,
        partial: true,
      },
    ],
    relationships: [
      {
        _type: GITHUB_REPO_PR_RELATIONSHIP_TYPE,
        _class: RelationshipClass.HAS,
        sourceType: GithubEntities.GITHUB_REPO._type,
        targetType: GithubEntities.GITHUB_PR._type,
        partial: true,
      },
      {
        _type: GITHUB_MEMBER_APPROVED_PR_RELATIONSHIP_TYPE,
        _class: RelationshipClass.APPROVED,
        sourceType: GithubEntities.GITHUB_MEMBER._type,
        targetType: GithubEntities.GITHUB_PR._type,
        partial: true,
      },
      {
        _type: GITHUB_MEMBER_OPENED_PR_RELATIONSHIP_TYPE,
        _class: RelationshipClass.OPENED,
        sourceType: GithubEntities.GITHUB_MEMBER._type,
        targetType: GithubEntities.GITHUB_PR._type,
        partial: true,
      },
      {
        _type: GITHUB_MEMBER_REVIEWED_PR_RELATIONSHIP_TYPE,
        _class: RelationshipClass.REVIEWED,
        sourceType: GithubEntities.GITHUB_MEMBER._type,
        targetType: GithubEntities.GITHUB_PR._type,
        partial: true,
      },
      {
        _type: GITHUB_PR_CONTAINS_PR_RELATIONSHIP_TYPE,
        _class: RelationshipClass.CONTAINS,
        sourceType: GithubEntities.GITHUB_PR._type,
        targetType: GithubEntities.GITHUB_PR._type,
      },
    ],
    dependsOn: [
      Steps.FETCH_REPOS,
      Steps.FETCH_USERS,
      Steps.FETCH_COLLABORATORS,
    ],
    executionHandler: fetchPrs,
  },
];
