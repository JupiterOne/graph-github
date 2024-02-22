import {
  IntegrationLogger,
  IntegrationMissingKeyError,
  IntegrationStep,
  IntegrationStepExecutionContext,
  JobState,
  RelationshipClass,
  createDirectRelationship,
} from '@jupiterone/integration-sdk-core';

import { IntegrationConfig } from '../config';
import { toOrganizationMemberEntityFromTeamMember } from '../sync/converters';
import {
  OrgTeamMemberQueryResponse,
  TeamMemberRole,
  getOrCreateGraphqlClient,
} from '../client/GraphQLClient';
import {
  GithubEntities,
  Steps,
  Relationships,
  MEMBERS_TOTAL_BY_TEAM,
  TEAM_DATA_MAP,
} from '../constants';
import { TeamData } from '../types';
import { withBatching } from '../client/GraphQLClient/batchUtils';

export async function fetchTeamMembers({
  instance,
  logger,
  jobState,
}: IntegrationStepExecutionContext<IntegrationConfig>) {
  const config = instance.config;
  const graphqlClient = getOrCreateGraphqlClient(config, logger);

  const teamDataMap =
    await jobState.getData<Map<string, TeamData>>(TEAM_DATA_MAP);
  if (!teamDataMap) {
    throw new IntegrationMissingKeyError(
      `Expected teams.ts to have set ${TEAM_DATA_MAP} in jobState.`,
    );
  }

  const membersTotalByRepo = await jobState.getData<Map<string, number>>(
    MEMBERS_TOTAL_BY_TEAM,
  );
  if (!membersTotalByRepo) {
    return;
  }

  const iteratee = buildIteratee({ jobState, logger, config });

  await withBatching({
    totalConnectionsById: membersTotalByRepo,
    threshold: 100,
    batchCb: async (teamKeys) => {
      await graphqlClient.iterateTeamMembers(teamKeys, iteratee);
    },
    singleCb: async (teamKey) => {
      const teamData = teamDataMap.get(teamKey);
      if (!teamData) {
        return;
      }
      await graphqlClient.iterateTeamMembers(teamData.name, iteratee);
    },
    logger,
  });

  await jobState.deleteData(MEMBERS_TOTAL_BY_TEAM);
}

const buildIteratee = ({
  jobState,
  logger,
  config,
}: {
  jobState: JobState;
  logger: IntegrationLogger;
  config: IntegrationConfig;
}) => {
  return async (user: OrgTeamMemberQueryResponse) => {
    if (!jobState.hasKey(user.id)) {
      //somehow this team has a user we didn't know about
      //shouldn't happen, except through weird timing, but we'll make an entry
      await jobState.addEntity(
        toOrganizationMemberEntityFromTeamMember(user, config.githubApiBaseUrl),
      );
    }

    const teamMemberRelationship = createDirectRelationship({
      _class: RelationshipClass.HAS,
      fromKey: user.teamId,
      fromType: GithubEntities.GITHUB_TEAM._type,
      toKey: user.id,
      toType: GithubEntities.GITHUB_MEMBER._type,
    });

    if (jobState.hasKey(teamMemberRelationship._key)) {
      logger.warn(
        {
          teamId: user.teamId,
          teamName: user.teamName,
          teamMemberId: user.id,
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
        fromKey: user.id,
        fromType: GithubEntities.GITHUB_MEMBER._type,
        toKey: user.teamId,
        toType: GithubEntities.GITHUB_TEAM._type,
      });

      if (jobState.hasKey(maintainerTeamRelationship._key)) {
        logger.warn(
          {
            teamId: user.teamId,
            teamName: user.teamName,
            teamMemberId: user.id,
            relationshipKey: maintainerTeamRelationship._key,
          },
          'Maintainer-team relationship was already ingested: Skipping.',
        );
      } else {
        await jobState.addRelationship(maintainerTeamRelationship);
      }
    }
  };
};

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
