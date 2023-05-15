import {
  IntegrationStep,
  IntegrationStepExecutionContext,
  RelationshipClass,
  createDirectRelationship,
} from '@jupiterone/integration-sdk-core';

import { getOrCreateApiClient } from '../client';
import { IntegrationConfig } from '../config';
import {
  toIssueEntity,
  createUnknownUserIssueRelationship,
} from '../sync/converters';
import { UserEntity, IdEntityMap, RepoEntity, IssueEntity } from '../types';
import {
  GithubEntities,
  GITHUB_REPO_ISSUE_RELATIONSHIP_TYPE,
  GITHUB_MEMBER_ASSIGNED_ISSUE_RELATIONSHIP_TYPE,
  GITHUB_MEMBER_CREATED_ISSUE_RELATIONSHIP_TYPE,
  GITHUB_MEMBER_BY_LOGIN_MAP,
  GITHUB_OUTSIDE_COLLABORATOR_ARRAY,
  Steps,
} from '../constants';

export async function fetchIssues(
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
  const apiClient = getOrCreateApiClient(config, logger);

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
        await apiClient.iterateIssues(
          repoEntity,
          lastSuccessfulExecution,
          async (issue) => {
            const issueEntity = (await jobState.addEntity(
              toIssueEntity(issue, repoEntity.name),
            )) as IssueEntity;

            await jobState.addRelationship(
              createDirectRelationship({
                _class: RelationshipClass.HAS,
                from: repoEntity,
                to: issueEntity,
              }),
            );

            if (issue.author) {
              if (usersByLoginMap![issue.author.login]) {
                await jobState.addRelationship(
                  createDirectRelationship({
                    _class: RelationshipClass.CREATED,
                    from: usersByLoginMap![issue.author.login],
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
                if (usersByLoginMap![assignee.login]) {
                  await jobState.addRelationship(
                    createDirectRelationship({
                      _class: RelationshipClass.ASSIGNED,
                      from: usersByLoginMap![assignee.login],
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
          },
        );
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
    id: Steps.FETCH_ISSUES,
    name: 'Fetch Issues',
    entities: [
      {
        resourceName: 'GitHub Issue',
        _type: GithubEntities.GITHUB_ISSUE._type,
        _class: GithubEntities.GITHUB_ISSUE._class,
        partial: true,
      },
    ],
    relationships: [
      {
        _type: GITHUB_REPO_ISSUE_RELATIONSHIP_TYPE,
        _class: RelationshipClass.HAS,
        sourceType: GithubEntities.GITHUB_REPO._type,
        targetType: GithubEntities.GITHUB_ISSUE._type,
        partial: true,
      },
      {
        _type: GITHUB_MEMBER_CREATED_ISSUE_RELATIONSHIP_TYPE,
        _class: RelationshipClass.CREATED,
        sourceType: GithubEntities.GITHUB_MEMBER._type,
        targetType: GithubEntities.GITHUB_ISSUE._type,
        partial: true,
      },
      {
        _type: GITHUB_MEMBER_ASSIGNED_ISSUE_RELATIONSHIP_TYPE,
        _class: RelationshipClass.ASSIGNED,
        sourceType: GithubEntities.GITHUB_MEMBER._type,
        targetType: GithubEntities.GITHUB_ISSUE._type,
        partial: true,
      },
    ],
    dependsOn: [
      Steps.FETCH_REPOS,
      Steps.FETCH_USERS,
      Steps.FETCH_COLLABORATORS,
    ],
    executionHandler: fetchIssues,
  },
];
