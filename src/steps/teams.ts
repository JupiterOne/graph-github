import {
  createDirectRelationship,
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
  toOrganizationHasTeamRelationship,
} from '../sync/converters';
import { AccountEntity, TeamEntity } from '../types';

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

    /* still have to figure out the best way to do this
    //might add a property to the type that lets me tack on the user list
    //but is the object too huge? Or do I just add it as an iteratee input?
    for (const user of group.users || []) {
      const userEntity = await jobState.findEntity(user.id);

      if (!userEntity) {
        throw new IntegrationMissingKeyError(
          `Expected user with key to exist (key=${user.id})`,
        );
      }

      await jobState.addRelationship(
        createDirectRelationship({
          _class: RelationshipClass.HAS,
          from: groupEntity,
          to: userEntity,
        }),
      );
    } */
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
    ],
    dependsOn: ['fetch-users'],
    executionHandler: fetchTeams,
  },
];
