import {
  IntegrationStep,
  IntegrationStepExecutionContext,
  RelationshipClass,
  IntegrationMissingKeyError,
  createDirectRelationship,
  Entity,
} from '@jupiterone/integration-sdk-core';

import { ExecutionConfig, IntegrationConfig } from '../config';
import { DATA_ACCOUNT_ENTITY } from './account';
import { toOrganizationMemberEntity } from '../sync/converters';
import { AccountEntity, UserEntity, IdEntityMap } from '../types';
import {
  OrgExternalIdentifierQueryResponse,
  OrgMemberRole,
  getOrCreateGraphqlClient,
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
  executionConfig,
}: IntegrationStepExecutionContext<IntegrationConfig, ExecutionConfig>) {
  const { config } = instance;
  const graphqlClient = getOrCreateGraphqlClient(config, logger);
  const { logIdentityMetrics } = executionConfig;

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

  const identityMetrics = {
    totalMembers: 0,
    totalIdentities: 0,
    unclaimed: 0,
    samlMatches: 0,
  };
  await graphqlClient.iterateExternalIdentifiers((identifier) => {
    identityMetrics.totalIdentities++;
    if (!identifier?.user) {
      // This identity has not been claimed by an organization member.
      identityMetrics.unclaimed++;
      return;
    }
    externalIdentifiersMap.set(identifier.user.login, identifier);
  });

  //for use later in other steps
  const memberByLoginMap: IdEntityMap<Entity['_key']> = new Map();

  await graphqlClient.iterateMembers(async (member) => {
    identityMetrics.totalMembers++;
    const externalIdentity = externalIdentifiersMap.get(member.login);
    const samlEmail = externalIdentity?.samlIdentity?.nameId;
    if (samlEmail) {
      identityMetrics.samlMatches++;
    }
    const memberRawData = {
      ...member,
      externalIdentity,
    };
    const memberEntity = (await jobState.addEntity(
      toOrganizationMemberEntity(memberRawData, samlEmail),
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

  if (logIdentityMetrics) {
    logger.info({ identityMetrics }, 'Identity metrics.');
  }

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
