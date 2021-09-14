import {
  IntegrationStep,
  IntegrationStepExecutionContext,
  RelationshipClass,
  IntegrationMissingKeyError,
} from '@jupiterone/integration-sdk-core';

import { createAPIClient } from '../client';
import { IntegrationConfig } from '../config';
import {
  createRepoAllowsUserRelationship,
  toOrganizationCollaboratorEntity,
} from '../sync/converters';
import { UserEntity, IdEntityMap, RepoKeyAndName } from '../types';
import {
  GITHUB_MEMBER_ENTITY_TYPE,
  GITHUB_COLLABORATOR_ENTITY_TYPE,
  GITHUB_COLLABORATOR_ENTITY_CLASS,
  GITHUB_REPO_ENTITY_TYPE,
  GITHUB_REPO_USER_RELATIONSHIP_TYPE,
  GITHUB_REPO_ARRAY,
  GITHUB_MEMBER_BY_LOGIN_MAP,
  GITHUB_OUTSIDE_COLLABORATOR_ARRAY,
} from '../constants';

export async function fetchCollaborators({
  instance,
  logger,
  jobState,
}: IntegrationStepExecutionContext<IntegrationConfig>) {
  const config = instance.config;
  const apiClient = createAPIClient(config, logger);

  const repoTags = await jobState.getData<RepoKeyAndName[]>(GITHUB_REPO_ARRAY);
  if (!repoTags) {
    throw new IntegrationMissingKeyError(
      `Expected repos.ts to have set ${GITHUB_REPO_ARRAY} in jobState.`,
    );
  }
  const memberByLoginMap = await jobState.getData<IdEntityMap<UserEntity>>(
    GITHUB_MEMBER_BY_LOGIN_MAP,
  );
  if (!memberByLoginMap) {
    throw new IntegrationMissingKeyError(
      `Expected members.ts to have set ${GITHUB_MEMBER_BY_LOGIN_MAP} in jobState.`,
    );
  }

  const outsideCollaboratorsByLoginMap: IdEntityMap<UserEntity> = {};
  const outsideCollaboratorsArray: UserEntity[] = [];

  for (const repo of repoTags) {
    await apiClient.iterateCollaborators(repo, async (collab) => {
      //a collaborator is either an organization member or an outside collaborator
      //we can tell the difference based on whether the login was discovered in members.ts
      let userEntity;
      if (memberByLoginMap[collab.login]) {
        //if the organization member has repo permission via both direct assignment and some team membership(s),
        //where the permissions for the repo are different between the direct assignment and team(s) assignments,
        //GitHub has already taken that into account and returned the best applicable permissions for this collaborator
        userEntity = memberByLoginMap[collab.login];
      } else {
        //retrieve or create outside collaborator entity
        if (await jobState.hasKey(collab.node_id)) {
          userEntity = outsideCollaboratorsByLoginMap[collab.login];
        } else {
          userEntity = (await jobState.addEntity(
            toOrganizationCollaboratorEntity(collab),
          )) as UserEntity;
          outsideCollaboratorsByLoginMap[collab.login] = userEntity;
          outsideCollaboratorsArray.push(userEntity);
        }
      }
      if (userEntity) {
        const repoUserRelationship = createRepoAllowsUserRelationship(
          repo,
          userEntity,
          collab.permissions,
        );
        await jobState.addRelationship(repoUserRelationship);
      } else {
        logger.warn(
          { collab: collab },
          `Could not find or create entity of collaborator ${collab.login}`,
        );
      }
    });
  } // end of repo iterator

  //pullrequests.ts will want the outside collaborator info later
  await jobState.setData(
    GITHUB_OUTSIDE_COLLABORATOR_ARRAY,
    outsideCollaboratorsArray,
  );
}

export const collaboratorSteps: IntegrationStep<IntegrationConfig>[] = [
  {
    id: 'fetch-collaborators',
    name: 'Fetch Collaborators',
    entities: [
      {
        resourceName: 'GitHub Outside Collaborator',
        _type: GITHUB_COLLABORATOR_ENTITY_TYPE,
        _class: GITHUB_COLLABORATOR_ENTITY_CLASS,
      },
    ],
    relationships: [
      {
        _type: GITHUB_REPO_USER_RELATIONSHIP_TYPE,
        _class: RelationshipClass.ALLOWS,
        sourceType: GITHUB_REPO_ENTITY_TYPE,
        targetType: GITHUB_MEMBER_ENTITY_TYPE,
      },
      {
        _type: GITHUB_REPO_USER_RELATIONSHIP_TYPE,
        _class: RelationshipClass.ALLOWS,
        sourceType: GITHUB_REPO_ENTITY_TYPE,
        targetType: GITHUB_COLLABORATOR_ENTITY_TYPE,
      },
    ],
    dependsOn: ['fetch-repos', 'fetch-users', 'fetch-teams'],
    executionHandler: fetchCollaborators,
  },
];
