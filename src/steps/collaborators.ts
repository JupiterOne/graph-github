import {
  IntegrationStep,
  IntegrationStepExecutionContext,
  RelationshipClass,
} from '@jupiterone/integration-sdk-core';

import { createAPIClient } from '../client';
import { IntegrationConfig } from '../config';
import { UserEntity } from '../types';
import {
  GITHUB_MEMBER_ENTITY_TYPE,
  GITHUB_COLLABORATOR_ENTITY_TYPE,
  GITHUB_COLLABORATOR_ENTITY_CLASS,
  GITHUB_REPO_ENTITY_TYPE,
  GITHUB_REPO_USER_RELATIONSHIP_TYPE,
  GITHUB_OUTSIDE_COLLABORATOR_ARRAY,
} from '../constants';

export async function fetchCollaborators({
  instance,
  logger,
  jobState,
}: IntegrationStepExecutionContext<IntegrationConfig>) {
  const config = instance.config;
  const apiClient = createAPIClient(config, logger);

  // const memberByLoginMap = await jobState.getData<IdEntityMap<UserEntity>>(
  //   GITHUB_MEMBER_BY_LOGIN_MAP,
  // );
  // if (!memberByLoginMap) {
  //   throw new IntegrationMissingKeyError(
  //     `Expected members.ts to have set ${GITHUB_MEMBER_BY_LOGIN_MAP} in jobState.`,
  //   );
  // }

  // const outsideCollaboratorsByLoginMap: IdEntityMap<UserEntity> = {};
  const outsideCollaboratorsArray: UserEntity[] = [];

  await apiClient.iterateCollaborators(async (collab) => {
    console.log({ collab }, 'Saw a collaborator in iterateCollabors! Yah!');
  });

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
    // dependsOn: ['fetch-repos', 'fetch-users'],
    executionHandler: fetchCollaborators,
  },
];
