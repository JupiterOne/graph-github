import {
  IntegrationStep,
  IntegrationStepExecutionContext,
  RelationshipClass,
  createDirectRelationship,
} from '@jupiterone/integration-sdk-core';

import { createAPIClient } from '../client';
import { IntegrationConfig } from '../config';
import { toOrganizationMemberEntityFromTeamMember } from '../sync/converters';
import { TeamMemberRole } from '../client/GraphQLClient';
import {
  GITHUB_MEMBER_ENTITY_TYPE,
  GITHUB_TEAM_ENTITY_TYPE,
  GITHUB_TEAM_MEMBER_RELATIONSHIP_TYPE,
  GITHUB_MEMBER_TEAM_RELATIONSHIP_TYPE,
} from '../constants';

export async function fetchTeamMembers({
  instance,
  logger,
  jobState,
}: IntegrationStepExecutionContext<IntegrationConfig>) {
  const config = instance.config;
  const apiClient = createAPIClient(config, logger);

  await apiClient.iterateTeamMembers(async (user) => {
    if (!(await jobState.hasKey(user.id))) {
      //somehow this team has a user we didn't know about
      //shouldn't happen, except through weird timing, but we'll make an entry
      await jobState.addEntity(toOrganizationMemberEntityFromTeamMember(user));
    }

    await jobState.addRelationship(
      createDirectRelationship({
        _class: RelationshipClass.HAS,
        fromType: GITHUB_TEAM_ENTITY_TYPE,
        toType: GITHUB_MEMBER_ENTITY_TYPE,
        fromKey: user.teams, //a single team key
        toKey: user.id,
      }),
    );

    if (user.role === TeamMemberRole.Maintainer) {
      await jobState.addRelationship(
        createDirectRelationship({
          _class: RelationshipClass.MANAGES,
          fromType: GITHUB_MEMBER_ENTITY_TYPE,
          toType: GITHUB_TEAM_ENTITY_TYPE,
          fromKey: user.id,
          toKey: user.teams,
        }),
      );
    }
  });
}

export const teamMemberSteps: IntegrationStep<IntegrationConfig>[] = [
  {
    id: 'fetch-team-members',
    name: 'Fetch Team Members',
    entities: [],
    relationships: [
      {
        _type: GITHUB_TEAM_MEMBER_RELATIONSHIP_TYPE,
        _class: RelationshipClass.HAS,
        sourceType: GITHUB_TEAM_ENTITY_TYPE,
        targetType: GITHUB_MEMBER_ENTITY_TYPE,
      },
      {
        _type: GITHUB_MEMBER_TEAM_RELATIONSHIP_TYPE,
        _class: RelationshipClass.MANAGES,
        sourceType: GITHUB_MEMBER_ENTITY_TYPE,
        targetType: GITHUB_TEAM_ENTITY_TYPE,
      },
    ],
    dependsOn: ['fetch-repos', 'fetch-teams', 'fetch-users'],
    executionHandler: fetchTeamMembers,
  },
];
