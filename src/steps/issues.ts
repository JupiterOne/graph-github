import {
  IntegrationStep,
  IntegrationStepExecutionContext,
  RelationshipClass,
  IntegrationMissingKeyError,
  createDirectRelationship,
} from '@jupiterone/integration-sdk-core';

import { createAPIClient } from '../client';
import { IntegrationConfig } from '../config';
import {
  toIssueEntity,
  createUnknownUserIssueRelationship,
} from '../sync/converters';
import { UserEntity, IdEntityMap, RepoEntity, IssueEntity } from '../types';
import {
  GITHUB_MEMBER_ENTITY_TYPE,
  GITHUB_ISSUE_ENTITY_TYPE,
  GITHUB_ISSUE_ENTITY_CLASS,
  GITHUB_REPO_ENTITY_TYPE,
  GITHUB_REPO_ISSUE_RELATIONSHIP_TYPE,
  GITHUB_MEMBER_ASSIGNED_ISSUE_RELATIONSHIP_TYPE,
  GITHUB_MEMBER_CREATED_ISSUE_RELATIONSHIP_TYPE,
  GITHUB_MEMBER_BY_LOGIN_MAP,
} from '../constants';

export async function fetchIssues({
  instance,
  logger,
  jobState,
}: IntegrationStepExecutionContext<IntegrationConfig>) {
  const config = instance.config;
  const apiClient = createAPIClient(config, logger);

  const memberByLoginMap = await jobState.getData<IdEntityMap<UserEntity>>(
    GITHUB_MEMBER_BY_LOGIN_MAP,
  );
  if (!memberByLoginMap) {
    throw new IntegrationMissingKeyError(
      `Expected members.ts to have set ${GITHUB_MEMBER_BY_LOGIN_MAP} in jobState.`,
    );
  }

  await jobState.iterateEntities<RepoEntity>(
    { _type: GITHUB_REPO_ENTITY_TYPE },
    async (repoEntity) => {
      try {
        await apiClient.iterateIssues(repoEntity, async (issue) => {
          const issueEntity = (await jobState.addEntity(
            toIssueEntity(issue, repoEntity.name),
          )) as IssueEntity;

          logger.info(issueEntity);

          await jobState.addRelationship(
            createDirectRelationship({
              _class: RelationshipClass.HAS,
              from: repoEntity,
              to: issueEntity,
            }),
          );

          if (issue.author) {
            if (memberByLoginMap[issue.author.login]) {
              await jobState.addRelationship(
                createDirectRelationship({
                  _class: RelationshipClass.CREATED,
                  from: memberByLoginMap[issue.author.login],
                  to: issueEntity,
                }),
              );
            } else {
              //we don't recognize this author - make a mapped relationship
              await jobState.addRelationship(
                createUnknownUserIssueRelationship(
                  issue.author.login,
                  GITHUB_MEMBER_CREATED_ISSUE_RELATIONSHIP_TYPE,
                  RelationshipClass.CREATED,
                  issueEntity._key,
                ),
              );
            }
          }

          if (issue.assignees) {
            for (const assignee of issue.assignees) {
              if (memberByLoginMap[assignee.login]) {
                await jobState.addRelationship(
                  createDirectRelationship({
                    _class: RelationshipClass.ASSIGNED,
                    from: memberByLoginMap[assignee.login],
                    to: issueEntity,
                  }),
                );
              } else {
                //we don't recognize this assignee - make a mapped relationship
                await jobState.addRelationship(
                  createUnknownUserIssueRelationship(
                    assignee.login,
                    GITHUB_MEMBER_ASSIGNED_ISSUE_RELATIONSHIP_TYPE,
                    RelationshipClass.ASSIGNED,
                    issueEntity._key,
                  ),
                );
              }
            }
          }
        });
      } catch (err) {
        apiClient.logger.warn(
          err,
          `Had an error ingesting Issues for repo ${repoEntity._key}. Skipping and continuing.`,
        );
      }
    },
  );
}

export const issueSteps: IntegrationStep<IntegrationConfig>[] = [
  {
    id: 'fetch-issues',
    name: 'Fetch Issues',
    entities: [
      {
        resourceName: 'GitHub Issue',
        _type: GITHUB_ISSUE_ENTITY_TYPE,
        _class: GITHUB_ISSUE_ENTITY_CLASS,
      },
    ],
    relationships: [
      {
        _type: GITHUB_REPO_ISSUE_RELATIONSHIP_TYPE,
        _class: RelationshipClass.HAS,
        sourceType: GITHUB_REPO_ENTITY_TYPE,
        targetType: GITHUB_ISSUE_ENTITY_TYPE,
      },
      {
        _type: GITHUB_MEMBER_CREATED_ISSUE_RELATIONSHIP_TYPE,
        _class: RelationshipClass.CREATED,
        sourceType: GITHUB_MEMBER_ENTITY_TYPE,
        targetType: GITHUB_ISSUE_ENTITY_TYPE,
      },
      {
        _type: GITHUB_MEMBER_ASSIGNED_ISSUE_RELATIONSHIP_TYPE,
        _class: RelationshipClass.ASSIGNED,
        sourceType: GITHUB_MEMBER_ENTITY_TYPE,
        targetType: GITHUB_ISSUE_ENTITY_TYPE,
      },
    ],
    dependsOn: ['fetch-repos', 'fetch-users', 'fetch-teams'],
    executionHandler: fetchIssues,
  },
];
