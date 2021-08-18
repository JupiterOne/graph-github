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
  GITHUB_MEMBER_ENTITY_TYPE,
  GITHUB_REPO_ENTITY_TYPE,
  GITHUB_PR_ENTITY_TYPE,
  GITHUB_PR_ENTITY_CLASS,
  GITHUB_MEMBER_REVIEWED_PR_RELATIONSHIP_TYPE,
  GITHUB_MEMBER_APPROVED_PR_RELATIONSHIP_TYPE,
  GITHUB_MEMBER_OPENED_PR_RELATIONSHIP_TYPE,
  GITHUB_REPO_PR_RELATIONSHIP_TYPE,
} from '../constants';

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

  const repoEntities = await jobState.getData<RepoEntity[]>('REPO_ARRAY');
  if (!repoEntities) {
    throw new IntegrationMissingKeyError(
      `Expected to find repoEntities in jobState.`,
    );
  }
  let userEntities = await jobState.getData<UserEntity[]>('USER_ARRAY');
  if (!userEntities) {
    //try the members-only (no outside collaborators) array
    userEntities = await jobState.getData<UserEntity[]>('MEMBER_ARRAY');
    if (!userEntities) {
      throw new IntegrationMissingKeyError(
        `Expected to find userEntities in jobState.`,
      );
    }
  }

  let userByLoginMap = await jobState.getData<IdEntityMap<UserEntity>>(
    'USER_BY_LOGIN_MAP',
  );
  if (!userByLoginMap) {
    //try the members-only (no outside collaborators) map
    userByLoginMap = await jobState.getData<IdEntityMap<UserEntity>>(
      'MEMBER_BY_LOGIN_MAP',
    );
    if (!userByLoginMap) {
      throw new IntegrationMissingKeyError(
        `Expected to find userByLoginMap in jobState.`,
      );
    }
  }

  for (const repoEntity of repoEntities) {
    await apiClient.iteratePullRequests(
      accountEntity,
      repoEntity,
      userEntities,
      userByLoginMap,
      logger,
      async (pr) => {
        //this is a different pattern than for members, teams, and repos
        //because the client call actually returns the finished entity instead of the raw "org response"
        //therefore, we just add the entity directly instead of calling a converter here
        //it seems to be like that in the old code because of the commit analysis functions
        const prEntity = (await jobState.addEntity(pr)) as PullRequestEntity;

        await jobState.addRelationship(
          createDirectRelationship({
            _class: RelationshipClass.HAS,
            from: repoEntity,
            to: prEntity,
          }),
        );

        if (userByLoginMap![pr.authorLogin]) {
          await jobState.addRelationship(
            createDirectRelationship({
              _class: RelationshipClass.OPENED,
              from: userByLoginMap![pr.authorLogin],
              to: prEntity,
            }),
          );
        }

        if (pr.reviewerLogins) {
          for (const reviewer of pr.reviewerLogins) {
            if (userByLoginMap![reviewer]) {
              await jobState.addRelationship(
                createDirectRelationship({
                  _class: RelationshipClass.REVIEWED,
                  from: userByLoginMap![reviewer],
                  to: prEntity,
                }),
              );
            }
          }
        }

        if (pr.approverLogins) {
          for (const approver of pr.approverLogins) {
            if (userByLoginMap![approver]) {
              await jobState.addRelationship(
                createDirectRelationship({
                  _class: RelationshipClass.APPROVED,
                  from: userByLoginMap![approver],
                  to: prEntity,
                }),
              );
            }
          }
        }
      },
    );
  }
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
    dependsOn: ['fetch-repos', 'fetch-users', 'fetch-direct-collaborators'],
    executionHandler: fetchPrs,
  },
];
