import {
  IntegrationStep,
  IntegrationStepExecutionContext,
  IntegrationMissingKeyError,
  Entity,
  JobState,
  IntegrationLogger,
} from '@jupiterone/integration-sdk-core';

import { getOrCreateApiClient } from '../client';
import { IntegrationConfig } from '../config';
import {
  createRepoAllowsUserRelationship,
  toOrganizationCollaboratorEntity,
} from '../sync/converters';
import {
  UserEntity,
  IdEntityMap,
  RepoData,
  OutsideCollaboratorData,
} from '../types';
import {
  GithubEntities,
  GITHUB_MEMBER_BY_LOGIN_MAP,
  GITHUB_OUTSIDE_COLLABORATOR_ARRAY,
  GITHUB_REPO_TAGS_ARRAY,
  Steps,
  Relationships,
  COLLABORATORS_TOTAL_BY_REPO,
} from '../constants';
import { withBatching } from '../client/GraphQLClient/batchUtils';
import { CollaboratorResponse } from '../client/GraphQLClient';

export async function fetchCollaborators({
  instance,
  logger,
  jobState,
}: IntegrationStepExecutionContext<IntegrationConfig>) {
  const config = instance.config;
  const apiClient = getOrCreateApiClient(config, logger);

  const memberByLoginMap = await jobState.getData<IdEntityMap<Entity['_key']>>(
    GITHUB_MEMBER_BY_LOGIN_MAP,
  );
  if (!memberByLoginMap) {
    throw new IntegrationMissingKeyError(
      `Expected members.ts to have set ${GITHUB_MEMBER_BY_LOGIN_MAP} in jobState.`,
    );
  }

  const outsideCollaboratorsByLoginMap: IdEntityMap<Entity['_key']> = new Map();
  const outsideCollaboratorsArray: OutsideCollaboratorData[] = [];

  const repoTags = await jobState.getData<Map<string, RepoData>>(
    GITHUB_REPO_TAGS_ARRAY,
  );
  if (!repoTags) {
    throw new IntegrationMissingKeyError(
      `Expected repos.ts to have set ${GITHUB_REPO_TAGS_ARRAY} in jobState.`,
    );
  }

  const collaboratorsTotalByRepo = await jobState.getData<Map<string, number>>(
    COLLABORATORS_TOTAL_BY_REPO,
  );
  if (!collaboratorsTotalByRepo) {
    return;
  }

  const iteratee = buildIteratee({
    jobState,
    config,
    logger,
    memberByLoginMap,
    outsideCollaboratorsByLoginMap,
    outsideCollaboratorsArray,
  });

  await withBatching({
    totalConnectionsById: collaboratorsTotalByRepo,
    threshold: 100,
    batchCb: async (repoKeys) => {
      await apiClient.iterateBatchedRepoCollaborators(repoKeys, iteratee);
    },
    singleCb: async (repoKey) => {
      const repoData = repoTags.get(repoKey);
      if (!repoData) {
        return;
      }
      await apiClient.iterateRepoCollaborators(repoData.name, iteratee);
    },
  });

  await Promise.all([
    //pullrequests.ts will want the outside collaborator info later
    jobState.setData(
      GITHUB_OUTSIDE_COLLABORATOR_ARRAY,
      outsideCollaboratorsArray,
    ),
    jobState.deleteData(COLLABORATORS_TOTAL_BY_REPO),
  ]);
}

function buildIteratee({
  jobState,
  config,
  logger,
  memberByLoginMap,
  outsideCollaboratorsByLoginMap,
  outsideCollaboratorsArray,
}: {
  jobState: JobState;
  config: IntegrationConfig;
  logger: IntegrationLogger;
  memberByLoginMap: IdEntityMap<Entity['_key']>;
  outsideCollaboratorsByLoginMap: IdEntityMap<Entity['_key']>;
  outsideCollaboratorsArray: OutsideCollaboratorData[];
}) {
  return async (collab: CollaboratorResponse) => {
    //a collaborator is either an organization member or an outside collaborator
    //we can tell the difference based on whether the login was discovered in members.ts
    let userEntityKey: string | undefined;
    if (memberByLoginMap.has(collab.login)) {
      //if the organization member has repo permission via both direct assignment and some team membership(s),
      //where the permissions for the repo are different between the direct assignment and team(s) assignments,
      //GitHub has already taken that into account and returned the best applicable permissions for this collaborator
      userEntityKey = memberByLoginMap.get(collab.login);
    } else {
      //retrieve or create outside collaborator entity
      const userEntity = toOrganizationCollaboratorEntity(
        collab,
        config.githubApiBaseUrl,
      ) as UserEntity;
      if (jobState.hasKey(userEntity._key)) {
        userEntityKey = outsideCollaboratorsByLoginMap.get(collab.login);
      } else {
        await jobState.addEntity(userEntity);
        userEntityKey = userEntity._key;
        outsideCollaboratorsByLoginMap.set(collab.login, userEntity._key);
        outsideCollaboratorsArray.push({
          key: userEntity._key,
          login: userEntity.login,
        });
      }
    }

    if (
      collab.repositoryId &&
      userEntityKey &&
      jobState.hasKey(collab.repositoryId)
    ) {
      const repoUserRelationship = createRepoAllowsUserRelationship(
        collab.repositoryId,
        userEntityKey,
        collab.permission,
      );
      await jobState.addRelationship(repoUserRelationship);
    } else {
      logger.warn(
        { collab: collab, repoId: collab.repositoryId },
        `Could not build relationship between collaborator and repo`,
      );
    }
  };
}

export const collaboratorSteps: IntegrationStep<IntegrationConfig>[] = [
  {
    id: Steps.FETCH_COLLABORATORS,
    name: 'Fetch Collaborators',
    entities: [GithubEntities.GITHUB_COLLABORATOR],
    relationships: [Relationships.REPO_ALLOWS_USER],
    dependsOn: [
      Steps.FETCH_REPOS,
      Steps.FETCH_USERS,
      // Added to execute steps serially.
      // https://docs.github.com/en/rest/guides/best-practices-for-using-the-rest-api?apiVersion=2022-11-28#dealing-with-secondary-rate-limits
      Steps.FETCH_TEAM_REPOS,
    ],
    executionHandler: fetchCollaborators,
  },
];
