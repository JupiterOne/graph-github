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
import { AccountEntity, TeamEntity, UserEntity, RepoEntity } from '../types';
import {
  GITHUB_ACCOUNT_ENTITY_TYPE,
  GITHUB_MEMBER_ENTITY_TYPE,
  GITHUB_REPO_ENTITY_TYPE,
  GITHUB_TEAM_ENTITY_TYPE,
  GITHUB_TEAM_MEMBER_RELATIONSHIP_TYPE,
  GITHUB_MEMBER_TEAM_RELATIONSHIP_TYPE,
  GITHUB_REPO_ARRAY,
} from '../constants';

export async function fetchSecrets({
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
  const repoEntities = await jobState.getData<RepoEntity[]>(GITHUB_REPO_ARRAY);
  if (!repoEntities) {
    throw new IntegrationMissingKeyError(
      `Expected repos.ts to have set GITHUB_REPO_ARRAY in jobState.`,
    );
  }

  await apiClient.iterateSecrets(repoEntities, async (secret) => {
    /*const secretEntity = (await jobState.addEntity(
      toSecret(secret),
    )) as TeamEntity;

    await jobState.addRelationship(
      createDirectRelationship({
        _class: RelationshipClass.HAS,
        from: accountEntity,
        to: teamEntity,
      }),
    );
    */
  });
}

export const secretSteps: IntegrationStep<IntegrationConfig>[] = [
  {
    id: 'fetch-secrets',
    name: 'Fetch Secrets',
    entities: [
      {
        resourceName: 'GitHub Secret',
        _type: GITHUB_SECRET_ENTITY_TYPE,
        _class: GITHUB_SECRET_ENTITY_CLASS,
      },
    ],
    relationships: [
      {
        _type: GITHUB_ACCOUNT_SECRET_RELATIONSHIP_TYPE,
        _class: RelationshipClass.HAS,
        sourceType: GITHUB_ACCOUNT_ENTITY_TYPE,
        targetType: GITHUB_SECRET_ENTITY_TYPE,
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
        _type: GITHUB_REPO_SECRET_RELATIONSHIP_TYPE,
        _class: RelationshipClass.USES,
        sourceType: GITHUB_REPO_ENTITY_TYPE,
        targetType: GITHUB_SECRET_ENTITY_TYPE,
      },
    ],
    dependsOn: ['fetch-account', 'fetch-repos'],
    executionHandler: fetchSecrets,
  },
];
