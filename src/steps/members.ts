import {
  IntegrationStep,
  IntegrationStepExecutionContext,
  RelationshipClass,
} from '@jupiterone/integration-sdk-core';

import { createAPIClient } from '../client';
import { IntegrationConfig } from '../config';
import { DATA_ACCOUNT_ENTITY } from './account';
import {
  toOrganizationMemberEntity,
  toOrganizationHasMemberRelationship,
  toMemberManagesOrganizationRelationship,
} from '../sync/converters';
import { AccountEntity, UserEntity } from '../types';
import { OrgMemberRole } from '../client/GraphQLClient';

export async function fetchMembers({
  instance,
  logger,
  jobState,
}: IntegrationStepExecutionContext<IntegrationConfig>) {
  const apiClient = createAPIClient(instance.config, logger);

  const accountEntity = (await jobState.getData(
    DATA_ACCOUNT_ENTITY,
  )) as AccountEntity;

  await apiClient.iterateMembers(async (member) => {
    const memberEntity = (await jobState.addEntity(
      toOrganizationMemberEntity(member),
    )) as UserEntity;

    await jobState.addRelationship(
      toOrganizationHasMemberRelationship(accountEntity, memberEntity),
    );

    if (memberEntity.role === OrgMemberRole.Admin) {
      await jobState.addRelationship(
        toMemberManagesOrganizationRelationship(accountEntity, memberEntity),
      );
    }
  });
}

export const memberSteps: IntegrationStep<IntegrationConfig>[] = [
  {
    id: 'fetch-users',
    name: 'Fetch Users',
    entities: [
      {
        resourceName: 'Github User',
        _type: 'github_user',
        _class: 'User',
      },
    ],
    relationships: [
      {
        _type: 'github_account_has_user',
        _class: RelationshipClass.HAS,
        sourceType: 'github_account',
        targetType: 'github_user',
      },
      {
        _type: 'github_user_manages_account',
        _class: RelationshipClass.MANAGES,
        sourceType: 'github_user',
        targetType: 'github_account',
      },
    ],
    dependsOn: ['fetch-account'],
    executionHandler: fetchMembers,
  },
];
