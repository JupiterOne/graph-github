import {
  IntegrationStep,
  IntegrationStepExecutionContext,
  RelationshipClass,
  IntegrationMissingKeyError,
} from '@jupiterone/integration-sdk-core';

import { createAPIClient } from '../client';
import { IntegrationConfig } from '../config';
import { createRepoAllowsUserRelationship } from '../sync/converters';
import {
  UserEntity,
  RepoEntity,
  RepoTeamRelationship,
  IdEntityMap,
} from '../types';
import {
  GITHUB_MEMBER_ENTITY_TYPE,
  GITHUB_MEMBER_ENTITY_CLASS,
  GITHUB_REPO_ENTITY_TYPE,
  GITHUB_REPO_USER_RELATIONSHIP_TYPE,
} from '../constants';

export async function fetchCollaborators({
  instance,
  logger,
  jobState,
}: IntegrationStepExecutionContext<IntegrationConfig>) {
  const config = instance.config;
  const apiClient = createAPIClient(config, logger);

  const repoEntities = await jobState.getData<RepoEntity[]>('REPO_ARRAY');
  if (!repoEntities) {
    throw new IntegrationMissingKeyError(
      `Expected to find repoEntities in jobState.`,
    );
  }
  const memberByLoginMap = await jobState.getData<IdEntityMap<UserEntity>>(
    'MEMBER_BY_LOGIN_MAP',
  );
  if (!memberByLoginMap) {
    throw new IntegrationMissingKeyError(
      `Expected to find memberByLoginMap in jobState.`,
    );
  }
  const memberArray = await jobState.getData<UserEntity[]>('MEMBER_ARRAY');
  if (!memberArray) {
    throw new IntegrationMissingKeyError(
      `Expected to find memberArray in jobState.`,
    );
  }
  const repoTeamRelationships = await jobState.getData<RepoTeamRelationship[]>(
    'REPO_TEAM_RELATIONSHIPS_ARRAY',
  );
  if (!repoTeamRelationships) {
    throw new IntegrationMissingKeyError(
      `Expected to find repoTeamRelationships in jobState.`,
    );
  }

  for (const repo of repoEntities) {
    //first, process the direct collaborators for this repo
    const membersAllowed: string[] = []; //for use in team assigns later
    await apiClient.iterateDirectCollaborators(repo, async (collab) => {
      //if the collab is in the user list, it's a team member that is directly
      //assigned to the repo (ie. not just as part of a team)
      //If the collab is assigned to the repo both directly and via a team,
      //then the permissions returned in collab will be the better of the directly
      //assigned permissions and the team permissions. So we can trust those.
      //
      //if collab is NOT in the user list, it's an outside collaborator
      //make a collaborator entity, and make the rel with the given perms
      if (memberByLoginMap[collab.login]) {
        //this is a team member directly assigned to the repo
        const repoUserRelationship = createRepoAllowsUserRelationship(
          repo,
          memberByLoginMap[collab.login],
          'direct',
          collab.permissions,
        );
        await jobState.addRelationship(repoUserRelationship);
        membersAllowed.push(memberByLoginMap[collab.login]._key);
      } else {
        //this is an outside collaborator
        const collabEntity = (await jobState.addEntity(
          createOutsideCollabUser(collab),
        )) as UserEntity;
        const repoUserRelationship = createRepoAllowsUserRelationship(
          repo,
          collabEntity,
          'outside',
          collab.permissions,
        );
        await jobState.addRelationship(repoUserRelationship);
      }
    });

    //now, having built relationships for the direct collaborators,
    //add any relationships needed for members that have access to the
    //repo because of team permissions
    //for all teams ALLOWED by repo, for all members of
    //that team, check to see if we already processed them, and if not,
    //add the rel using the permissions of the team
    const relsToTeams = repoTeamRelationships.filter(
      (rel) => rel._fromEntityKey === repo._key,
    );
    /*can I do this: (ie. multiple conditions on iteration)
    await jobState.iterateRelationships(
      { 
        _fromEntityKey: repo._key,
        _type: GITHUB_REPO_TEAM_RELATIONSHIP_TYPE,
       },
      async (repoTeamRel) => {
        //stuff
      }
    ); */

    for (const teamRel of relsToTeams) {
      const relsToMembers = teamMemberRelationships.filter(
        (rel) => rel._fromEntityKey === teamRel._toEntityKey,
      );
      for (const relToMember of relsToMembers) {
        if (!membersAllowed.includes(relToMember._toEntityKey)) {
          const permissions = {
            //Minimum permissions for any relationship here
            admin: false,
            push: false,
            pull: true,
          };
          const teamPerm = teamRel.permission;
          if (teamPerm === 'WRITE' || teamPerm === 'MAINTAIN') {
            permissions.push = true;
          }
          if (teamRel.permission === 'ADMIN') {
            permissions.push = true;
            permissions.admin = true;
          }
          const memberEntity = memberArray.find(
            (m) => m._key === relToMember._toEntityKey,
          );
          if (memberEntity) {
            const repoUserRelationship = createRepoAllowsUserRelationship(
              repo,
              memberEntity,
              'team',
              permissions,
            );
            await jobState.addRelationship(repoUserRelationship);
          }
          membersAllowed.push(relToMember._toEntityKey);
        }
      }
    }
  } // end of repo iterator
}

export const collaboratorSteps: IntegrationStep<IntegrationConfig>[] = [
  {
    id: 'fetch-collaborators',
    name: 'Fetch Collaborators',
    entities: [
      {
        resourceName: 'GitHub Collaborator',
        _type: GITHUB_MEMBER_ENTITY_TYPE,
        _class: GITHUB_MEMBER_ENTITY_CLASS,
      },
    ],
    relationships: [
      {
        _type: GITHUB_REPO_USER_RELATIONSHIP_TYPE,
        _class: RelationshipClass.ALLOWS,
        sourceType: GITHUB_REPO_ENTITY_TYPE,
        targetType: GITHUB_MEMBER_ENTITY_TYPE,
      },
    ],
    dependsOn: ['fetch-repos', 'fetch-users', 'fetch-teams'],
    executionHandler: fetchCollaborators,
  },
];
