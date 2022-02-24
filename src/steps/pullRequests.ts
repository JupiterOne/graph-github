import {
  IntegrationMissingKeyError,
  IntegrationStep,
  IntegrationStepExecutionContext,
  RelationshipClass,
  createDirectRelationship,
} from '@jupiterone/integration-sdk-core';

import { createAPIClient } from '../client';
import { IntegrationConfig } from '../config';
import { DATA_ACCOUNT_ENTITY } from './account';

import {
  PullRequestEntity,
  UserEntity,
  RepoEntity,
  AccountEntity,
  IdEntityMap,
} from '../types';
import {
  GithubEntities,
  GITHUB_MEMBER_REVIEWED_PR_RELATIONSHIP_TYPE,
  GITHUB_MEMBER_APPROVED_PR_RELATIONSHIP_TYPE,
  GITHUB_MEMBER_OPENED_PR_RELATIONSHIP_TYPE,
  GITHUB_REPO_PR_RELATIONSHIP_TYPE,
  GITHUB_MEMBER_BY_LOGIN_MAP,
  GITHUB_OUTSIDE_COLLABORATOR_ARRAY,
} from '../constants';
import {
  createUnknownUserIssueRelationship,
  toPullRequestEntity,
} from '../sync/converters';
import { cloneDeep } from 'lodash';
import { formatAndThrowGraphQlError } from '../util/formatAndThrowGraphQlError';

export async function fetchPrs(
  context: IntegrationStepExecutionContext<IntegrationConfig>,
) {
  const config = context.instance.config;
  const jobState = context.jobState;
  const logger = context.logger;
  const lastSuccessfulSyncTime =
    context.executionHistory.lastSuccessful?.startedOn ?? 0;
  const lastSuccessfulExecution = new Date(
    lastSuccessfulSyncTime,
  ).toISOString();
  const apiClient = createAPIClient(config, logger);
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

  await jobState.iterateEntities<RepoEntity>(
    { _type: GithubEntities.GITHUB_REPO._type },
    async (repoEntity) => {
      try {
        await apiClient.iteratePullRequests(
          repoEntity,
          logger,
          lastSuccessfulExecution,
          async (pullRequest) => {
            const pr = toPullRequestEntity(
              pullRequest,
              teamMembersByLoginMap,
              usersByLoginMap!,
            );
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
        // Handle both graphQl errors and rest errors
        const errors = error[0] ? error : [error];
        if (allErrorsAreNotFoundErrors(errors)) {
          logger.warn(
            {
              error: JSON.stringify(error),
              repoName: repoEntity.name,
              repoKey: repoEntity._key,
            },
            'Received Not Found error(s) for pull requests for this repository. Skipping pull request ingestion for this repository.',
          );
        } else {
          logger.error(
            {
              error: JSON.stringify(error),
              repoName: repoEntity.name,
              repoKey: repoEntity._key,
            },
            'Unable to process pull request entities due to error.',
          );
          formatAndThrowGraphQlError(error, 'iteratePullRequests');
        }
      }
    },
  );
}

function allErrorsAreNotFoundErrors(errors: any[]) {
  return !errors.some((e) => !isNotFoundError(e));
}

function isNotFoundError(error: any) {
  return error.type == 'NOT_FOUND' || error.Code == 404 || error.code == 404;
}

export const prSteps: IntegrationStep<IntegrationConfig>[] = [
  {
    id: 'fetch-prs',
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
    ],
    dependsOn: ['fetch-repos', 'fetch-users', 'fetch-collaborators'],
    executionHandler: fetchPrs,
  },
];
