import {
  Entity,
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
import {
  IdEntityMap,
  RepoEntity,
  IssueEntity,
  OutsideCollaboratorData,
} from '../types';
import {
  GithubEntities,
  GITHUB_MEMBER_BY_LOGIN_MAP,
  GITHUB_OUTSIDE_COLLABORATOR_ARRAY,
  Steps,
  IngestionSources,
  Relationships,
  MappedRelationships,
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
              if (usersByLoginMap?.has(issue.author.login)) {
                await jobState.addRelationship(
                  createDirectRelationship({
                    _class: RelationshipClass.CREATED,
                    fromType: GithubEntities.GITHUB_MEMBER._type,
                    fromKey: usersByLoginMap.get(issue.author.login) as string,
                    toType: GithubEntities.GITHUB_ISSUE._type,
                    toKey: issueEntity._key,
                  }),
                );
              } else {
                //we don't recognize this author - make a mapped relationship
                await jobState.addRelationship(
                  createUnknownUserIssueRelationship(
                    issue.author.login,
                    Relationships.USER_CREATED_ISSUE._type,
                    RelationshipClass.CREATED,
                    issueEntity._key,
                  ),
                );
              }
            }

            if (issue.assignees) {
              for (const assignee of issue.assignees) {
                if (usersByLoginMap?.has(assignee.login)) {
                  await jobState.addRelationship(
                    createDirectRelationship({
                      _class: RelationshipClass.ASSIGNED,
                      fromType: GithubEntities.GITHUB_MEMBER._type,
                      fromKey: usersByLoginMap.get(assignee.login) as string,
                      toType: GithubEntities.GITHUB_ISSUE._type,
                      toKey: issueEntity._key,
                    }),
                  );
                } else {
                  //we don't recognize this assignee - make a mapped relationship
                  await jobState.addRelationship(
                    createUnknownUserIssueRelationship(
                      assignee.login,
                      Relationships.USER_ASSIGNED_ISSUE._type,
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
    ingestionSourceId: IngestionSources.ISSUES,
    name: 'Fetch Issues',
    entities: [GithubEntities.GITHUB_ISSUE],
    relationships: [
      Relationships.REPO_HAS_ISSUE,
      Relationships.USER_CREATED_ISSUE,
      Relationships.USER_ASSIGNED_ISSUE,
    ],
    mappedRelationships: [
      MappedRelationships.USER_CREATED_ISSUE,
      MappedRelationships.USER_ASSIGNED_ISSUE,
    ],
    dependsOn: [
      Steps.FETCH_REPOS,
      Steps.FETCH_USERS,
      Steps.FETCH_COLLABORATORS,
    ],
    executionHandler: fetchIssues,
  },
];
