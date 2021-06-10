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
  toOrganizationMemberEntity,
  toOrganizationHasMemberRelationship,
  toMemberManagesOrganizationRelationship,
} from '../sync/converters';
import { AccountEntity, UserEntity, IdEntityMap } from '../types';
import { OrgMemberRole } from '../client/GraphQLClient';
import {
  GITHUB_ACCOUNT_ENTITY_TYPE,
  GITHUB_MEMBER_ENTITY_TYPE,
  GITHUB_MEMBER_ENTITY_CLASS,
  GITHUB_MEMBER_ACCOUNT_RELATIONSHIP_TYPE,
  GITHUB_ACCOUNT_MEMBER_RELATIONSHIP_TYPE,
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

  //for use later in PRs
  const memberEntities: UserEntity[] = [];
  const memberByLoginMap: IdEntityMap<UserEntity> = {};

  await apiClient.iterateMembers(async (member) => {
    const memberEntity = (await jobState.addEntity(
      toOrganizationMemberEntity(member),
    )) as UserEntity;

    memberEntities.push(memberEntity);
    memberByLoginMap[member.login] = memberEntity;

    await jobState.addRelationship(
      toOrganizationHasMemberRelationship(accountEntity, memberEntity),
    );

    if (memberEntity.role === OrgMemberRole.Admin) {
      await jobState.addRelationship(
        toMemberManagesOrganizationRelationship(accountEntity, memberEntity),
      );
    }
  });

  await jobState.setData('MEMBER_ARRAY', memberEntities);
  await jobState.setData('MEMBER_BY_LOGIN_MAP', memberByLoginMap);
}

export const memberSteps: IntegrationStep<IntegrationConfig>[] = [
  {
    id: 'fetch-users',
    name: 'Fetch Users',
    entities: [
      {
        resourceName: 'Github User',
        _type: GITHUB_MEMBER_ENTITY_TYPE,
        _class: GITHUB_MEMBER_ENTITY_CLASS,
      },
    ],
    relationships: [
      {
        _type: GITHUB_ACCOUNT_MEMBER_RELATIONSHIP_TYPE,
        _class: RelationshipClass.HAS,
        sourceType: GITHUB_ACCOUNT_ENTITY_TYPE,
        targetType: GITHUB_MEMBER_ENTITY_TYPE,
      },
      {
        _type: GITHUB_MEMBER_ACCOUNT_RELATIONSHIP_TYPE,
        _class: RelationshipClass.MANAGES,
        sourceType: GITHUB_MEMBER_ENTITY_TYPE,
        targetType: GITHUB_ACCOUNT_ENTITY_TYPE,
      },
    ],
    dependsOn: ['fetch-account'],
    executionHandler: fetchMembers,
  },
];
