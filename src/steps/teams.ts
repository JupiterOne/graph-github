import {
  IntegrationStep,
  IntegrationStepExecutionContext,
  RelationshipClass,
  IntegrationMissingKeyError,
  createDirectRelationship,
} from '@jupiterone/integration-sdk-core';

import { createAPIClient } from '../client';
import { IntegrationConfig } from '../config';
import { DATA_ACCOUNT_ENTITY } from './account';
import {
  toTeamEntity,
  toOrganizationMemberEntityFromTeamMember,
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
  const repoEntities = await jobState.getData<RepoEntity[]>('REPO_ARRAY');
  if (!repoEntities) {
    throw new IntegrationMissingKeyError(
      `Expected to find repoEntities in jobState.`,
    );
  }
  const memberEntities = await jobState.getData<UserEntity[]>('MEMBER_ARRAY');
  if (!memberEntities) {
    throw new IntegrationMissingKeyError(
      `Expected to find memberEntities in jobState.`,
    );
  }

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

    for (const member of team.members || []) {
      let memberEntity = memberEntities.find((m) => m._key === member.id);
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
        createDirectRelationship({
          _class: RelationshipClass.HAS,
          from: teamEntity,
          to: memberEntity,
        }),
      );

      if (member.role === TeamMemberRole.Maintainer) {
        await jobState.addRelationship(
          createDirectRelationship({
            _class: RelationshipClass.MANAGES,
            from: memberEntity,
            to: teamEntity,
          }),
        );
      }
    }

    for (const repo of team.repos || []) {
      const repoEntity = repoEntities.find((r) => r._key === repo.id);
      if (!repoEntity) {
        throw new IntegrationMissingKeyError(
          `Expected repo (CodeRepo) with id to exist (key=${repo.id})`,
        );
      }
      await jobState.addRelationship(
        createDirectRelationship({
          _class: RelationshipClass.ALLOWS,
          from: teamEntity,
          to: repoEntity,
        }),
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
