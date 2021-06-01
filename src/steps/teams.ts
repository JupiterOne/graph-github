import {
  IntegrationStep,
  IntegrationStepExecutionContext,
  RelationshipClass,
  IntegrationMissingKeyError,
} from '@jupiterone/integration-sdk-core';

import { createAPIClient } from '../client';
import { IntegrationConfig } from '../config';
import { DATA_ACCOUNT_ENTITY } from './account';
import {
  toTeamEntity,
  toOrganizationMemberEntityFromTeamMember,
  toOrganizationHasTeamRelationship,
  toTeamHasMemberRelationship,
  toMemberManagesTeamRelationship,
  toTeamAllowsRepoRelationship,
} from '../sync/converters';
import { AccountEntity, TeamEntity, UserEntity, RepoEntity } from '../types';
import sha from '../util/sha';
import { TeamMemberRole } from '../client/GraphQLClient';

export async function fetchTeams({
  instance,
  logger,
  jobState,
}: IntegrationStepExecutionContext<IntegrationConfig>) {
  const apiClient = createAPIClient(instance.config, logger);

  const accountEntity = (await jobState.getData(
    DATA_ACCOUNT_ENTITY,
  )) as AccountEntity;

  await apiClient.iterateTeams(async (team) => {
    const teamEntity = (await jobState.addEntity(
      toTeamEntity(team),
    )) as TeamEntity;

    await jobState.addRelationship(
      toOrganizationHasTeamRelationship(accountEntity, teamEntity),
    );

    for (const member of team.members || []) {
      let memberEntity = (await jobState.findEntity(member.id)) as UserEntity;

      if (!memberEntity) {
        memberEntity = (await jobState.addEntity(
          toOrganizationMemberEntityFromTeamMember(member),
        )) as UserEntity;
        logger.warn(
          { memberLoginSha: sha(member.login) },
          'Could not find user entity for member login',
        );
      }

      await jobState.addRelationship(
        toTeamHasMemberRelationship(teamEntity, memberEntity),
      );

      if (member.role === TeamMemberRole.Maintainer) {
        await jobState.addRelationship(
          toMemberManagesTeamRelationship(memberEntity, teamEntity),
        );
      }
    }

    for (const repo of team.repos || []) {
      let repoEntity = (await jobState.findEntity(repo.id)) as RepoEntity;
      if (!repoEntity) {
        throw new IntegrationMissingKeyError(
          `Expected repo (CodeRepo) with key to exist (key=${repo.id})`,
        );
      }
      await jobState.addRelationship(
        toTeamAllowsRepoRelationship(teamEntity, repoEntity, repo.permission),
      );
    }
  });
}

export const teamSteps: IntegrationStep<IntegrationConfig>[] = [
  {
    id: 'fetch-teams',
    name: 'Fetch Teams',
    entities: [
      {
        resourceName: 'GitHub Team',
        _type: 'github_team',
        _class: 'UserGroup',
      },
    ],
    relationships: [
      {
        _type: 'github_account_has_team',
        _class: RelationshipClass.HAS,
        sourceType: 'github_account',
        targetType: 'github_team',
      },
      {
        _type: 'github_team_has_user',
        _class: RelationshipClass.HAS,
        sourceType: 'github_team',
        targetType: 'github_user',
      },
      {
        _type: 'github_user_manages_team',
        _class: RelationshipClass.MANAGES,
        sourceType: 'github_user',
        targetType: 'github_team',
      },
      {
        _type: 'github_team_allows_repo',
        _class: RelationshipClass.ALLOWS,
        sourceType: 'github_team',
        targetType: 'github_repo',
      },
    ],
    dependsOn: ['fetch-repos', 'fetch-users'],
    executionHandler: fetchTeams,
  },
];
