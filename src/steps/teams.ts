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
  createRepoAllowsTeamRelationship,
} from '../sync/converters';
import { AccountEntity, TeamEntity, RepoKeyAndName } from '../types';
import { TeamMemberRole } from '../client/GraphQLClient';
import {
  GITHUB_ACCOUNT_ENTITY_TYPE,
  GITHUB_MEMBER_ENTITY_TYPE,
  GITHUB_REPO_ENTITY_TYPE,
  GITHUB_TEAM_ENTITY_TYPE,
  GITHUB_TEAM_ENTITY_CLASS,
  GITHUB_TEAM_MEMBER_RELATIONSHIP_TYPE,
  GITHUB_REPO_TEAM_RELATIONSHIP_TYPE,
  GITHUB_MEMBER_TEAM_RELATIONSHIP_TYPE,
  GITHUB_ACCOUNT_TEAM_RELATIONSHIP_TYPE,
  GITHUB_REPO_ARRAY,
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
  const repoTags = await jobState.getData<RepoKeyAndName[]>(GITHUB_REPO_ARRAY);
  if (!repoTags) {
    throw new IntegrationMissingKeyError(
      `Expected repos.ts to have set GITHUB_REPO_ARRAY in jobState.`,
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
      const memberKey = member.id;
      if (!(await jobState.hasKey(memberKey))) {
        await jobState.addEntity(
          toOrganizationMemberEntityFromTeamMember(member),
        );
      }

      await jobState.addRelationship(
        createDirectRelationship({
          _class: RelationshipClass.HAS,
          fromType: GITHUB_TEAM_ENTITY_TYPE,
          toType: GITHUB_MEMBER_ENTITY_TYPE,
          fromKey: teamEntity._key,
          toKey: memberKey,
        }),
      );

      if (member.role === TeamMemberRole.Maintainer) {
        await jobState.addRelationship(
          createDirectRelationship({
            _class: RelationshipClass.MANAGES,
            fromType: GITHUB_MEMBER_ENTITY_TYPE,
            toType: GITHUB_TEAM_ENTITY_TYPE,
            fromKey: memberKey,
            toKey: teamEntity._key,
          }),
        );
      }
    }

    for (const repo of team.repos || []) {
      const repoTag = repoTags.find((r) => r._key === repo.id);
      if (!repoTag) {
        throw new IntegrationMissingKeyError(
          `Expected repo (CodeRepo) with id to exist (key=${repo.id})`,
        );
      }
      const repoTeamRelationship = createRepoAllowsTeamRelationship(
        repoTag,
        teamEntity,
        repo.permission,
      );
      await jobState.addRelationship(repoTeamRelationship);
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
        sourceType: GITHUB_MEMBER_ENTITY_TYPE,
        targetType: GITHUB_TEAM_ENTITY_TYPE,
      },
      {
        _type: GITHUB_REPO_TEAM_RELATIONSHIP_TYPE,
        _class: RelationshipClass.ALLOWS,
        sourceType: GITHUB_REPO_ENTITY_TYPE,
        targetType: GITHUB_TEAM_ENTITY_TYPE,
      },
    ],
    dependsOn: ['fetch-repos', 'fetch-users'],
    executionHandler: fetchTeams,
  },
];
