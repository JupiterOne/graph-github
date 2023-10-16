import {
  IntegrationStep,
  IntegrationStepExecutionContext,
  RelationshipClass,
  createDirectRelationship,
} from '@jupiterone/integration-sdk-core';

import { getOrCreateApiClient } from '../client';
import { IntegrationConfig } from '../config';
import { toOrganizationMemberEntityFromTeamMember } from '../sync/converters';
import { TeamMemberRole } from '../client/GraphQLClient';
import { GithubEntities, Steps, Relationships } from '../constants';
import { TeamEntity } from '../types';

export async function fetchTeamMembers({
  instance,
  logger,
  jobState,
}: IntegrationStepExecutionContext<IntegrationConfig>) {
  const config = instance.config;
  const apiClient = getOrCreateApiClient(config, logger);

  await jobState.iterateEntities(
    { _type: GithubEntities.GITHUB_TEAM._type },
    async (teamEntity: TeamEntity) => {
      await apiClient.iterateTeamMembers(teamEntity, async (user) => {
        if (!jobState.hasKey(user.id)) {
          //somehow this team has a user we didn't know about
          //shouldn't happen, except through weird timing, but we'll make an entry
          await jobState.addEntity(
            toOrganizationMemberEntityFromTeamMember(
              user,
              config.githubApiBaseUrl,
            ),
          );
        }

        const teamMemberRelationship = createDirectRelationship({
          _class: RelationshipClass.HAS,
          fromType: GithubEntities.GITHUB_TEAM._type,
          toType: GithubEntities.GITHUB_MEMBER._type,
          fromKey: user.teamId,
          toKey: user.id,
        });

        if (jobState.hasKey(teamMemberRelationship._key)) {
          logger.warn(
            {
              teamId: teamEntity.id,
              teamKey: teamEntity._key,
              teamName: teamEntity.name,
              teamRepoTeamKey: user.teamId,
              teamRepoId: user.id,
              relationshipKey: teamMemberRelationship._key,
            },
            'Member-team relationship was already ingested: Skipping.',
          );
        } else {
          await jobState.addRelationship(teamMemberRelationship);
        }

        if (user.role === TeamMemberRole.Maintainer) {
          const maintainerTeamRelationship = createDirectRelationship({
            _class: RelationshipClass.MANAGES,
            fromType: GithubEntities.GITHUB_MEMBER._type,
            toType: GithubEntities.GITHUB_TEAM._type,
            fromKey: user.id,
            toKey: user.teamId,
          });

          if (jobState.hasKey(maintainerTeamRelationship._key)) {
            logger.warn(
              {
                teamId: teamEntity.id,
                teamKey: teamEntity._key,
                teamName: teamEntity.name,
                teamRepoTeamKey: user.teamId,
                teamRepoId: user.id,
                relationshipKey: maintainerTeamRelationship._key,
              },
              'Maintainer-team relationship was already ingested: Skipping.',
            );
          } else {
            await jobState.addRelationship(maintainerTeamRelationship);
          }
        }
      });
    },
  );
}

export const teamMemberSteps: IntegrationStep<IntegrationConfig>[] = [
  {
    id: Steps.FETCH_TEAM_MEMBERS,
    name: 'Fetch Team Members',
    entities: [],
    relationships: [
      Relationships.TEAM_HAS_USER,
      Relationships.USER_MANAGES_TEAM,
    ],
    dependsOn: [Steps.FETCH_TEAMS, Steps.FETCH_USERS],
    executionHandler: fetchTeamMembers,
  },
];
