import {
  Entity,
  IntegrationMissingKeyError,
  IntegrationStep,
  IntegrationStepExecutionContext,
  JobState,
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
  IssueEntity,
  OutsideCollaboratorData,
  RepoData,
} from '../types';
import {
  GithubEntities,
  GITHUB_MEMBER_BY_LOGIN_MAP,
  GITHUB_OUTSIDE_COLLABORATOR_ARRAY,
  Steps,
  IngestionSources,
  Relationships,
  MappedRelationships,
  ISSUES_TOTAL_BY_REPO,
  GITHUB_REPO_TAGS_ARRAY,
} from '../constants';
import { withBatching } from '../client/GraphQLClient/batchUtils';
import { IssueResponse } from '../client/GraphQLClient';

export async function fetchIssues(
  context: IntegrationStepExecutionContext<IntegrationConfig>,
) {
  const {
    instance: { config },
    jobState,
    logger,
  } = context;
  const lastSuccessfulSyncTime =
    context.executionHistory.lastSuccessful?.startedOn ?? 0;
  const lastSuccessfulExecution = new Date(
    lastSuccessfulSyncTime,
  ).toISOString();
  const apiClient = getOrCreateApiClient(config, logger);

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

  const issuesTotalByRepo =
    await jobState.getData<Map<string, number>>(ISSUES_TOTAL_BY_REPO);
  if (!issuesTotalByRepo) {
    return;
  }

  const iteratee = buildIteratee({ jobState, usersByLoginMap });

  await withBatching({
    totalConnectionsById: issuesTotalByRepo,
    threshold: 25,
    batchCb: async (repoKeys) => {
      await apiClient.iterateBatchedIssues(
        repoKeys,
        lastSuccessfulExecution,
        iteratee,
      );
    },
    singleCb: async (repoKey) => {
      const repoData = repoTags.get(repoKey);
      if (!repoData) {
        return;
      }
      try {
        await apiClient.iterateIssues(
          repoData.name,
          lastSuccessfulExecution,
          iteratee,
        );
      } catch (err) {
        apiClient.logger.warn(
          err,
          `Had an error ingesting Issues for repo ${repoKey}. Skipping and continuing.`,
        );
      }
    },
    logger,
  });

  await jobState.deleteData(ISSUES_TOTAL_BY_REPO);
}

function buildIteratee({
  jobState,
  usersByLoginMap,
}: {
  jobState: JobState;
  usersByLoginMap?: IdEntityMap<Entity['_key']>;
}) {
  return async (issue: IssueResponse) => {
    const issueEntity = (await jobState.addEntity(
      toIssueEntity(issue),
    )) as IssueEntity;

    if (jobState.hasKey(issue.repoId)) {
      await jobState.addRelationship(
        createDirectRelationship({
          _class: RelationshipClass.HAS,
          fromKey: issue.repoId,
          fromType: GithubEntities.GITHUB_REPO._type,
          toKey: issueEntity._key,
          toType: GithubEntities.GITHUB_ISSUE._type,
        }),
      );
    }

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
        if (!assignee.login) {
          continue;
        }
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
  };
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
