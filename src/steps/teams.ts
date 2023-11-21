import {
  IntegrationStep,
  IntegrationStepExecutionContext,
  RelationshipClass,
  IntegrationMissingKeyError,
  createDirectRelationship,
} from '@jupiterone/integration-sdk-core';

import { getOrCreateApiClient } from '../client';
import { IntegrationConfig } from '../config';
import { DATA_ACCOUNT_ENTITY } from './account';
import { toTeamEntity } from '../sync/converters';
import { AccountEntity, TeamData, TeamEntity } from '../types';
import {
  GithubEntities,
  Steps,
  Relationships,
  REPOSITORIES_TOTAL_BY_TEAM,
  TEAM_DATA_MAP,
  MEMBERS_TOTAL_BY_TEAM,
} from '../constants';

export async function fetchTeams({
  instance,
  logger,
  jobState,
}: IntegrationStepExecutionContext<IntegrationConfig>) {
  const config = instance.config;
  const apiClient = getOrCreateApiClient(config, logger);

  const accountEntity =
    await jobState.getData<AccountEntity>(DATA_ACCOUNT_ENTITY);
  if (!accountEntity) {
    throw new IntegrationMissingKeyError(
      `Expected to find Account entity in jobState.`,
    );
  }

  const teamDataMap = new Map<string, TeamData>();
  const repositoriesTotalByTeam = new Map<string, number>();
  const membersTotalByTeam = new Map<string, number>();

  await apiClient.iterateTeams(async (team) => {
    const teamEntity = (await jobState.addEntity(
      toTeamEntity(team),
    )) as TeamEntity;

    await jobState.addRelationship(
      createDirectRelationship({
        _class: RelationshipClass.HAS,
        from: accountEntity,
        to: teamEntity,
      }),
    );

    teamDataMap.set(teamEntity._key, { name: team.slug });
    if (team.repositories.totalCount) {
      repositoriesTotalByTeam.set(
        teamEntity._key,
        team.repositories.totalCount,
      );
    }
    if (team.members.totalCount) {
      membersTotalByTeam.set(teamEntity._key, team.members.totalCount);
    }
  });

  await Promise.all([
    jobState.setData(TEAM_DATA_MAP, teamDataMap),
    jobState.setData(REPOSITORIES_TOTAL_BY_TEAM, repositoriesTotalByTeam),
    jobState.setData(MEMBERS_TOTAL_BY_TEAM, membersTotalByTeam),
  ]);
}

export const teamSteps: IntegrationStep<IntegrationConfig>[] = [
  {
    id: Steps.FETCH_TEAMS,
    name: 'Fetch Teams',
    entities: [GithubEntities.GITHUB_TEAM],
    relationships: [Relationships.ACCOUNT_HAS_TEAM],
    dependsOn: [Steps.FETCH_ACCOUNT],
    executionHandler: fetchTeams,
  },
];
