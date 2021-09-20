import {
  IntegrationMissingKeyError,
  IntegrationStep,
  IntegrationStepExecutionContext,
  RelationshipClass,
  createDirectRelationship,
  IntegrationError,
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
  GITHUB_MEMBER_ENTITY_TYPE,
  GITHUB_REPO_ENTITY_TYPE,
  GITHUB_PR_ENTITY_TYPE,
  GITHUB_PR_ENTITY_CLASS,
  GITHUB_MEMBER_REVIEWED_PR_RELATIONSHIP_TYPE,
  GITHUB_MEMBER_APPROVED_PR_RELATIONSHIP_TYPE,
  GITHUB_MEMBER_OPENED_PR_RELATIONSHIP_TYPE,
  GITHUB_REPO_PR_RELATIONSHIP_TYPE,
  GITHUB_MEMBER_BY_LOGIN_MAP,
  GITHUB_OUTSIDE_COLLABORATOR_ARRAY,
} from '../constants';
import {
  createUnknownUserPrRelationship,
  toPullRequestEntity,
} from '../sync/converters';
import { cloneDeep } from 'lodash';

export async function fetchPrs({
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

  let UsersByLoginMap = await jobState.getData<IdEntityMap<UserEntity>>(
    GITHUB_MEMBER_BY_LOGIN_MAP,
  );

  if (!UsersByLoginMap) {
    logger.warn(
      {},
      `Expected members.ts to have set ${GITHUB_MEMBER_BY_LOGIN_MAP} in jobState. Proceeding anyway.`,
    );
    UsersByLoginMap = {};
  }
  const teamMembersByLoginMap = cloneDeep(UsersByLoginMap) ?? {};

  const outsideCollaboratorEntities = await jobState.getData<UserEntity[]>(
    GITHUB_OUTSIDE_COLLABORATOR_ARRAY,
  );
  if (outsideCollaboratorEntities) {
    for (const collab of outsideCollaboratorEntities) {
      UsersByLoginMap[collab.login] = collab;
    }
  } else {
    logger.warn(
      {},
      `Expected collaborators.ts to have set ${GITHUB_OUTSIDE_COLLABORATOR_ARRAY} in jobState. Proceeding anyway.`,
    );
  }

  await jobState.iterateEntities<RepoEntity>(
    { _type: GITHUB_REPO_ENTITY_TYPE },
    async (repoEntity) => {
      try {
        await apiClient.iteratePullRequests(
          repoEntity,
          logger,
          async (pullRequest) => {
            const pr = toPullRequestEntity(
              pullRequest,
              teamMembersByLoginMap,
              UsersByLoginMap!,
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

            if (UsersByLoginMap![pr.authorLogin]) {
              await jobState.addRelationship(
                createDirectRelationship({
                  _class: RelationshipClass.OPENED,
                  from: UsersByLoginMap![pr.authorLogin],
                  to: prEntity,
                }),
              );
            } else {
              //we don't recognize this author - make a mapped relationship
              await jobState.addRelationship(
                createUnknownUserPrRelationship(
                  pr.authorLogin,
                  GITHUB_MEMBER_OPENED_PR_RELATIONSHIP_TYPE,
                  RelationshipClass.OPENED,
                  prEntity._key,
                ),
              );
            }

            if (pr.reviewerLogins) {
              for (const reviewer of pr.reviewerLogins) {
                if (UsersByLoginMap![reviewer]) {
                  await jobState.addRelationship(
                    createDirectRelationship({
                      _class: RelationshipClass.REVIEWED,
                      from: UsersByLoginMap![reviewer],
                      to: prEntity,
                    }),
                  );
                } else {
                  //we don't recognize this reviewer - make a mapped relationship
                  await jobState.addRelationship(
                    createUnknownUserPrRelationship(
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
                if (UsersByLoginMap![approver]) {
                  await jobState.addRelationship(
                    createDirectRelationship({
                      _class: RelationshipClass.APPROVED,
                      from: UsersByLoginMap![approver],
                      to: prEntity,
                    }),
                  );
                } else {
                  //we don't recognize this approver - make a mapped relationship
                  await jobState.addRelationship(
                    createUnknownUserPrRelationship(
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
            'Receved Not Found error(s) for pull requests for this repository. Skipping pull request ingestion for this repository.',
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
          throw new IntegrationError({
            message: errors.map((e) => e.message).join(' | '),
            code: errors[0].Code,
            cause: errors[0],
          });
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
        _type: GITHUB_PR_ENTITY_TYPE,
        _class: GITHUB_PR_ENTITY_CLASS,
        partial: true,
      },
    ],
    relationships: [
      {
        _type: GITHUB_REPO_PR_RELATIONSHIP_TYPE,
        _class: RelationshipClass.HAS,
        sourceType: GITHUB_REPO_ENTITY_TYPE,
        targetType: GITHUB_PR_ENTITY_TYPE,
        partial: true,
      },
      {
        _type: GITHUB_MEMBER_APPROVED_PR_RELATIONSHIP_TYPE,
        _class: RelationshipClass.APPROVED,
        sourceType: GITHUB_MEMBER_ENTITY_TYPE,
        targetType: GITHUB_PR_ENTITY_TYPE,
        partial: true,
      },
      {
        _type: GITHUB_MEMBER_OPENED_PR_RELATIONSHIP_TYPE,
        _class: RelationshipClass.OPENED,
        sourceType: GITHUB_MEMBER_ENTITY_TYPE,
        targetType: GITHUB_PR_ENTITY_TYPE,
        partial: true,
      },
      {
        _type: GITHUB_MEMBER_REVIEWED_PR_RELATIONSHIP_TYPE,
        _class: RelationshipClass.REVIEWED,
        sourceType: GITHUB_MEMBER_ENTITY_TYPE,
        targetType: GITHUB_PR_ENTITY_TYPE,
        partial: true,
      },
    ],
    dependsOn: ['fetch-repos', 'fetch-users', 'fetch-collaborators'],
    executionHandler: fetchPrs,
  },
];
