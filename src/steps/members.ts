import {
  IntegrationStep,
  IntegrationStepExecutionContext,
  RelationshipClass,
  IntegrationMissingKeyError,
  createDirectRelationship,
  Entity,
} from '@jupiterone/integration-sdk-core';

import { getOrCreateApiClient } from '../client';
import { IntegrationConfig } from '../config';
import { DATA_ACCOUNT_ENTITY } from './account';
import { toOrganizationMemberEntity } from '../sync/converters';
import { AccountEntity, UserEntity, IdEntityMap } from '../types';
import {
  OrgExternalIdentifierQueryResponse,
  OrgMemberRole,
} from '../client/GraphQLClient';
import {
  GithubEntities,
  GITHUB_MEMBER_BY_LOGIN_MAP,
  Steps,
  Relationships,
} from '../constants';

export async function fetchMembers({
  instance,
  logger,
  jobState,
}: IntegrationStepExecutionContext<IntegrationConfig>) {
  const config = instance.config;
  const apiClient = getOrCreateApiClient(config, logger);

  const accountEntity = (await jobState.getData<AccountEntity>(
    DATA_ACCOUNT_ENTITY,
  )) as AccountEntity;
  if (!accountEntity) {
    throw new IntegrationMissingKeyError(
      `Expected to find Account entity in jobState.`,
    );
  }

  const externalIdentifiersMap = new Map<
    string,
    OrgExternalIdentifierQueryResponse
  >();

  await apiClient.iterateOrgExternalIdentifiers((identifier) => {
    if (identifier?.user?.login) {
      // Catch instances where this feature isn't enabled
      externalIdentifiersMap.set(identifier.user.login, identifier);
    }
  });

  //for use later in other steps
  const memberByLoginMap: IdEntityMap<Entity['_key']> = new Map();

  await apiClient.iterateOrgMembers(async (member) => {
    const memberEntity = (await jobState.addEntity(
      toOrganizationMemberEntity(member, externalIdentifiersMap),
    )) as UserEntity;

    if (member.login) {
      memberByLoginMap.set(member.login, memberEntity._key);
    }

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
    id: Steps.FETCH_USERS,
    name: 'Fetch Users',
    entities: [GithubEntities.GITHUB_MEMBER],
    relationships: [
      Relationships.ACCOUNT_HAS_USER,
      Relationships.USER_MANAGES_ACCOUNT,
    ],
    dependsOn: [Steps.FETCH_ACCOUNT],
    executionHandler: fetchMembers,
  },
];
