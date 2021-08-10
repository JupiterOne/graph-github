import {
  IntegrationStep,
  IntegrationStepExecutionContext,
  RelationshipClass,
  IntegrationMissingKeyError,
} from '@jupiterone/integration-sdk-core';

import { createAPIClient } from '../client';
import { IntegrationConfig } from '../config';
import {
  createRepoAllowsUserRelationship,
  toOrganizationCollaboratorEntity,
} from '../sync/converters';
import {
  UserEntity,
  RepoEntity,
  RepoTeamRelationship,
  IdEntityMap,
} from '../types';
import {
  GITHUB_MEMBER_ENTITY_TYPE,
  GITHUB_COLLABORATOR_ENTITY_TYPE,
  GITHUB_COLLABORATOR_ENTITY_CLASS,
  GITHUB_REPO_ENTITY_TYPE,
  GITHUB_REPO_USER_RELATIONSHIP_TYPE,
} from '../constants';
import { CollaboratorPermissions } from '../client/GraphQLClient';

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

  const collaboratorsByLoginMap: IdEntityMap<UserEntity> = {};
  const collabArray: UserEntity[] = [];

  for (const repo of repoEntities) {
    //first, process the direct collaborators for this repo
    const directMemberLogins: string[] = []; //for use in team assigns later
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
        directMemberLogins.push(collab.login);
      } else {
        //this is an outside collaborator
        //did we make a collaborator entity already?
        let collabEntity;
        if (collaboratorsByLoginMap[collab.login]) {
          collabEntity = collaboratorsByLoginMap[collab.login];
        } else {
          collabEntity = (await jobState.addEntity(
            toOrganizationCollaboratorEntity(collab),
          )) as UserEntity;
          collaboratorsByLoginMap[collab.login] = collabEntity;
          collabArray.push(collabEntity);
        }
        const repoUserRelationship = createRepoAllowsUserRelationship(
          repo,
          collabEntity,
          'outside',
          collab.permissions,
        );
        await jobState.addRelationship(repoUserRelationship);
      }
    }); //end of direct collaborators iterateee

    //Having built relationships for the direct collaborators,
    //calculate any relationships needed for members that have access to the
    //repo because of team permissions
    //That is, for all teams ALLOWED by repo, for all members of
    //that team, note the permissions afforded by that team

    const repoTeamRelationships = await jobState.getData<
      RepoTeamRelationship[]
    >('REPO_TEAM_RELATIONSHIPS_ARRAY');
    if (!repoTeamRelationships) {
      throw new IntegrationMissingKeyError(
        `Expected to find repoTeamRelationships in jobState.`,
      );
    }

    const teamMemberLoginsMap = await jobState.getData<RepoTeamRelationship[]>(
      'TEAM_MEMBER_LOGINS_MAP',
    );
    if (!teamMemberLoginsMap) {
      throw new IntegrationMissingKeyError(
        `Expected to find teamMemberLoginsMap in jobState.`,
      );
    }

    //needed to calculate best permissions for a user on many teams
    const loginPermissionsMap: IdEntityMap<CollaboratorPermissions> = {};
    const loginsForThisRepo: string[] = [];

    const relsToTeams = repoTeamRelationships.filter(
      (rel) => rel._fromEntityKey === repo._key,
    );
    for (const teamRel of relsToTeams) {
      const teamPerm = teamRel.permission;
      const teamPermissions: CollaboratorPermissions = {
        //Minimum permissions for any repo-team relationship
        admin: false,
        maintain: false,
        push: false,
        triage: false,
        pull: true,
      };
      if (teamPerm === 'TRIAGE') {
        teamPermissions.triage = true;
      }
      if (teamPerm === 'WRITE') {
        teamPermissions.triage = true;
        teamPermissions.push = true;
      }
      if (teamPerm === 'MAINTAIN') {
        teamPermissions.triage = true;
        teamPermissions.push = true;
        teamPermissions.maintain = true;
      }
      if (teamPerm === 'ADMIN') {
        teamPermissions.triage = true;
        teamPermissions.push = true;
        teamPermissions.maintain = true;
        teamPermissions.admin = true;
      }
      const teamMemberLogins = teamMemberLoginsMap[teamRel._toEntityKey];
      for (const login of teamMemberLogins) {
        if (!directMemberLogins.includes(login)) {
          //the user wasn't a direct member
          if (memberByLoginMap[login]) {
            //the userEntity exists, so update user permissions to the best current or previous team permissions
            if (loginPermissionsMap[login]) {
              loginPermissionsMap[login].triage =
                loginPermissionsMap[login].triage || teamPermissions.triage;
              loginPermissionsMap[login].push =
                loginPermissionsMap[login].push || teamPermissions.push;
              loginPermissionsMap[login].maintain =
                loginPermissionsMap[login].maintain || teamPermissions.maintain;
              loginPermissionsMap[login].admin =
                loginPermissionsMap[login].admin || teamPermissions.admin;
            } else {
              loginPermissionsMap[login] = teamPermissions;
            }
            if (!loginsForThisRepo.includes(login)) {
              loginsForThisRepo.push(login);
            }
          }
        }
      }
    } // end of team relationships from repo iterator
    //so now we know the best team permissions applicable for each user for this repo
    for (const login of loginsForThisRepo) {
      const repoUserRelationship = createRepoAllowsUserRelationship(
        repo,
        memberByLoginMap[login],
        'team',
        loginPermissionsMap[login],
      );
      await jobState.addRelationship(repoUserRelationship);
    }
  } // end of repo iterator
  //save updated user maps and arrays for use in PRs later
  for (const outsideCollab of collabArray) {
    memberByLoginMap[outsideCollab.login] = outsideCollab;
    memberArray.push(outsideCollab);
  }
  await jobState.setData('USER_BY_LOGIN_MAP', memberByLoginMap);
  await jobState.setData('USER_ARRAY', memberArray);
}

export const collaboratorSteps: IntegrationStep<IntegrationConfig>[] = [
  {
    id: 'fetch-collaborators',
    name: 'Fetch Collaborators',
    entities: [
      {
        resourceName: 'GitHub Collaborator',
        _type: GITHUB_COLLABORATOR_ENTITY_TYPE,
        _class: GITHUB_COLLABORATOR_ENTITY_CLASS,
      },
    ],
    relationships: [
      {
        _type: GITHUB_REPO_USER_RELATIONSHIP_TYPE,
        _class: RelationshipClass.ALLOWS,
        sourceType: GITHUB_REPO_ENTITY_TYPE,
        targetType: GITHUB_MEMBER_ENTITY_TYPE,
      },
      {
        _type: GITHUB_REPO_USER_RELATIONSHIP_TYPE,
        _class: RelationshipClass.ALLOWS,
        sourceType: GITHUB_REPO_ENTITY_TYPE,
        targetType: GITHUB_COLLABORATOR_ENTITY_TYPE,
      },
    ],
    dependsOn: ['fetch-repos', 'fetch-users', 'fetch-teams'],
    executionHandler: fetchCollaborators,
  },
];
