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
import { UserEntity, RepoEntity, IdEntityMap } from '../types';
import {
  GITHUB_MEMBER_ENTITY_TYPE,
  GITHUB_COLLABORATOR_ENTITY_TYPE,
  GITHUB_COLLABORATOR_ENTITY_CLASS,
  GITHUB_REPO_ENTITY_TYPE,
  GITHUB_REPO_USER_RELATIONSHIP_TYPE,
} from '../constants';

export async function fetchCollaborators({
  instance,
  logger,
  jobState,
}: IntegrationStepExecutionContext<IntegrationConfig>) {
  const config = instance.config;
  const apiClient = createAPIClient(config, logger);

  const repoEntities = await jobState.getData<RepoEntity[]>('REPO_ARRAY');
  if (!repoEntities) {
    throw new IntegrationMissingKeyError(
      `Expected to find repoEntities in jobState.`,
    );
  }
  const memberByLoginMap = await jobState.getData<IdEntityMap<UserEntity>>(
    'MEMBER_BY_LOGIN_MAP',
  );
  if (!memberByLoginMap) {
    throw new IntegrationMissingKeyError(
      `Expected to find memberByLoginMap in jobState.`,
    );
  }
  const memberArray = await jobState.getData<UserEntity[]>('MEMBER_ARRAY');
  if (!memberArray) {
    throw new IntegrationMissingKeyError(
      `Expected to find memberArray in jobState.`,
    );
  }

  const outsideCollaboratorsByLoginMap: IdEntityMap<UserEntity> = {};
  const outsideCollaboratorsArray: UserEntity[] = [];

  for (const repo of repoEntities) {
    await apiClient.iterateCollaborators(repo, async (collab) => {
      //a collaborator is either an organization member or an outside collaborator
      //we can tell the difference based on whether the login was discovered in members.ts
      if (memberByLoginMap[collab.login]) {
        //if the organization member has repo permission via both direct assignment and some team membership(s),
        //where the permissions for the repo are different between the direct assignment and team(s) assignments,
        //GitHub has already taken that into account and returned the best applicable permissions for this collaborator
        const repoUserRelationship = createRepoAllowsUserRelationship(
          repo,
          memberByLoginMap[collab.login],
          'organization member',
          collab.permissions,
        );
        await jobState.addRelationship(repoUserRelationship);
      } else {
        //this is an outside collaborator
        //if we have already created an entity for this outside collaborator, retrieve it
        //otherwise, create it
        let collabEntity;
        if (outsideCollaboratorsByLoginMap[collab.login]) {
          collabEntity = outsideCollaboratorsByLoginMap[collab.login];
        } else {
          collabEntity = (await jobState.addEntity(
            toOrganizationCollaboratorEntity(collab),
          )) as UserEntity;
          outsideCollaboratorsByLoginMap[collab.login] = collabEntity;
          outsideCollaboratorsArray.push(collabEntity);
        }
        const repoUserRelationship = createRepoAllowsUserRelationship(
          repo,
          collabEntity,
          'outside collaborator',
          collab.permissions,
        );
        await jobState.addRelationship(repoUserRelationship);
      }
    });
  } // end of repo iterator
  //save updated user maps and arrays for use in PRs later
  for (const outsideCollab of outsideCollaboratorsArray) {
    memberByLoginMap[outsideCollab.login] = outsideCollab;
    memberArray.push(outsideCollab);
  }
  await jobState.setData('USER_BY_LOGIN_MAP', memberByLoginMap);
  await jobState.setData('USER_ARRAY', memberArray);
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
