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
import { toOrganizationMemberEntity } from '../sync/converters';
import { AccountEntity, UserEntity, IdEntityMap } from '../types';
import { OrgMemberRole } from '../client/GraphQLClient';
import {
  GithubEntities,
  GITHUB_MEMBER_ACCOUNT_RELATIONSHIP_TYPE,
  GITHUB_ACCOUNT_MEMBER_RELATIONSHIP_TYPE,
  GITHUB_MEMBER_BY_LOGIN_MAP,
} from '../constants';

export async function fetchMembers({
  instance,
  logger,
  jobState,
}: IntegrationStepExecutionContext<IntegrationConfig>) {
  const config = instance.config;
  const apiClient = createAPIClient(config, logger);

  const accountEntity = (await jobState.getData<AccountEntity>(
    DATA_ACCOUNT_ENTITY,
  )) as AccountEntity;
  if (!accountEntity) {
    throw new IntegrationMissingKeyError(
      `Expected to find Account entity in jobState.`,
    );
  }

  //for use later in other steps
  const memberByLoginMap: IdEntityMap<UserEntity> = {};

  await apiClient.iterateMembers(async (member) => {
    const memberEntity = (await jobState.addEntity(
      toOrganizationMemberEntity(member),
    )) as UserEntity;

    memberByLoginMap[member.login] = memberEntity;

    await jobState.addRelationship(
      createDirectRelationship({
        _class: RelationshipClass.HAS,
        from: accountEntity,
        to: memberEntity,
      }),
    );

    if (memberEntity.role === OrgMemberRole.Admin) {
      await jobState.addRelationship(
        createDirectRelationship({
          _class: RelationshipClass.MANAGES,
          from: memberEntity,
          to: accountEntity,
        }),
      );
    }
  });

  await jobState.setData(GITHUB_MEMBER_BY_LOGIN_MAP, memberByLoginMap);
}

export const memberSteps: IntegrationStep<IntegrationConfig>[] = [
  {
    id: 'fetch-users',
    name: 'Fetch Users',
    entities: [
      {
        resourceName: 'Github User',
        _type: GithubEntities.GITHUB_MEMBER._type,
        _class: GithubEntities.GITHUB_MEMBER._class,
      },
    ],
    relationships: [
      {
        _type: GITHUB_ACCOUNT_MEMBER_RELATIONSHIP_TYPE,
        _class: RelationshipClass.HAS,
        sourceType: GithubEntities.GITHUB_ACCOUNT._type,
        targetType: GithubEntities.GITHUB_MEMBER._type,
      },
      {
        _type: GITHUB_MEMBER_ACCOUNT_RELATIONSHIP_TYPE,
        _class: RelationshipClass.MANAGES,
        sourceType: GithubEntities.GITHUB_MEMBER._type,
        targetType: GithubEntities.GITHUB_ACCOUNT._type,
      },
    ],
    dependsOn: ['fetch-account'],
    executionHandler: fetchMembers,
  },
];
