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
import {
  GITHUB_ACCOUNT_ENTITY_TYPE,
  GITHUB_MEMBER_ENTITY_TYPE,
  GITHUB_REPO_ENTITY_TYPE,
  GITHUB_TEAM_ENTITY_TYPE,
  GITHUB_TEAM_ENTITY_CLASS,
  GITHUB_TEAM_MEMBER_RELATIONSHIP_TYPE,
  GITHUB_TEAM_REPO_RELATIONSHIP_TYPE,
  GITHUB_MEMBER_TEAM_RELATIONSHIP_TYPE,
  GITHUB_ACCOUNT_TEAM_RELATIONSHIP_TYPE,
} from '../constants';

export async function fetchTeams({
  instance,
  logger,
  jobState,
}: IntegrationStepExecutionContext<IntegrationConfig>) {
  const config = instance.config;
  const apiClient = createAPIClient(config, logger);

  const accountEntity = await jobState.getData<AccountEntity>(
    DATA_ACCOUNT_ENTITY,
  );
  if (!accountEntity) {
    throw new IntegrationMissingKeyError(
      `Expected to find Account entity in jobState.`,
    );
  }

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
      const repoEntity = (await jobState.findEntity(repo.id)) as RepoEntity;
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
        _type: GITHUB_TEAM_ENTITY_TYPE,
        _class: GITHUB_TEAM_ENTITY_CLASS,
      },
    ],
    relationships: [
      {
        _type: GITHUB_ACCOUNT_TEAM_RELATIONSHIP_TYPE,
        _class: RelationshipClass.HAS,
        sourceType: GITHUB_ACCOUNT_ENTITY_TYPE,
        targetType: GITHUB_TEAM_ENTITY_TYPE,
      },
      {
        _type: GITHUB_TEAM_MEMBER_RELATIONSHIP_TYPE,
        _class: RelationshipClass.HAS,
        sourceType: GITHUB_TEAM_ENTITY_TYPE,
        targetType: GITHUB_MEMBER_ENTITY_TYPE,
      },
      {
        _type: GITHUB_MEMBER_TEAM_RELATIONSHIP_TYPE,
        _class: RelationshipClass.MANAGES,
        sourceType: GITHUB_TEAM_ENTITY_TYPE,
        targetType: GITHUB_TEAM_ENTITY_TYPE,
      },
      {
        _type: GITHUB_TEAM_REPO_RELATIONSHIP_TYPE,
        _class: RelationshipClass.ALLOWS,
        sourceType: GITHUB_TEAM_ENTITY_TYPE,
        targetType: GITHUB_REPO_ENTITY_TYPE,
      },
    ],
    dependsOn: ['fetch-repos', 'fetch-users'],
    executionHandler: fetchTeams,
  },
];
