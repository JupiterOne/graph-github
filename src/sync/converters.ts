import {
  setRawData,
  parseTimePropertyValue,
  RelationshipClass,
} from '@jupiterone/integration-sdk-core';

import {
  GITHUB_REPO_TEAM_RELATIONSHIP_TYPE,
  GITHUB_REPO_USER_RELATIONSHIP_TYPE,
  GITHUB_ACCOUNT_ENTITY_TYPE,
  GITHUB_ACCOUNT_ENTITY_CLASS,
  GITHUB_MEMBER_ENTITY_TYPE,
  GITHUB_MEMBER_ENTITY_CLASS,
  GITHUB_REPO_ENTITY_TYPE,
  GITHUB_REPO_ENTITY_CLASS,
  GITHUB_PR_ENTITY_TYPE,
  GITHUB_PR_ENTITY_CLASS,
  GITHUB_TEAM_ENTITY_TYPE,
  GITHUB_TEAM_ENTITY_CLASS,
  GITHUB_COLLABORATOR_ENTITY_CLASS,
  GITHUB_COLLABORATOR_ENTITY_TYPE,
  GITHUB_APP_ENTITY_CLASS,
  GITHUB_APP_ENTITY_TYPE,
} from '../constants';

import {
  AccountEntity,
  AppEntity,
  RepoEntity,
  UserEntity,
  PullRequestEntity,
  PRState,
  IdEntityMap,
  TeamEntity,
  AccountType,
  PullsListResponseItem,
  PullsListCommitsResponseItem,
  RepoAllowRelationship,
} from '../types';
import { Approval } from '../approval/collectCommitsForPR';
import {
  aggregateProperties,
  flattenMatrix,
  displayNamesFromLogins,
  decomposePermissions,
  getAppEntityKey,
} from '../util/propertyHelpers';
import {
  OrgMemberQueryResponse,
  OrgRepoQueryResponse,
  OrgTeamQueryResponse,
  OrgQueryResponse,
  OrgTeamMemberQueryResponse,
  OrgCollaboratorQueryResponse,
  CollaboratorPermissions,
  OrgAppQueryResponse,
} from '../client/GraphQLClient';

import uniq from 'lodash.uniq';
import omit from 'lodash.omit';

export function toAccountEntity(data: OrgQueryResponse): AccountEntity {
  const accountEntity: AccountEntity = {
    _class: [GITHUB_ACCOUNT_ENTITY_CLASS],
    _type: GITHUB_ACCOUNT_ENTITY_TYPE,
    _key: data.id,
    accountType: AccountType.Org,
    accountId: data.login,
    login: data.login,
    name: data.name,
    displayName: data.name || data.login,
  };
  setRawData(accountEntity, { name: 'default', rawData: data });
  return accountEntity;
}

export function toAppEntity(data: OrgAppQueryResponse): AppEntity {
  const appEntity: AppEntity = {
    _class: [GITHUB_APP_ENTITY_CLASS],
    _type: GITHUB_APP_ENTITY_TYPE,
    _key: getAppEntityKey(data.id),
    name: data.app_slug,
    displayName: data.app_slug,
    webLink: data.html_url,
    installationId: data.id, //the installation id
    respositorySelection: data.respository_selection,
    appId: data.app_id,
    appSlug: data.app_slug,
    targetId: data.target_id,
    targetType: data.target_type,
    createdAt: data.created_at,
    updatedAt: data.updated_at,
    events: data.events,
    repositorySelection: data.respository_selection,
    singleFileName: data.single_file_name || '',
    hasMultipleSingleFiles: data.has_multiple_single_files,
    singleFilePaths: data.single_file_paths,
    suspendedBy: data.suspended_by || '',
    suspendedAt: data.suspended_at || '',
    ...decomposePermissions(data.permissions),
  };
  setRawData(appEntity, { name: 'default', rawData: data });
  return appEntity;
}

export function toTeamEntity(data: OrgTeamQueryResponse): TeamEntity {
  const teamEntity: TeamEntity = {
    _class: [GITHUB_TEAM_ENTITY_CLASS],
    _type: GITHUB_TEAM_ENTITY_TYPE,
    _key: data.id,
    webLink: data.url,
    name: data.slug,
    displayName: data.name,
    fullName: data.name,
  };
  setRawData(teamEntity, { name: 'default', rawData: data });
  return teamEntity;
}

export function toRepositoryEntity(data: OrgRepoQueryResponse): RepoEntity {
  const repoEntity: RepoEntity = {
    _class: [GITHUB_REPO_ENTITY_CLASS],
    _type: GITHUB_REPO_ENTITY_TYPE,
    _key: data.id,
    webLink: data.url,
    name: data.name,
    displayName: data.name,
    fullName: data.nameWithOwner.toLowerCase(),
    owner: data.nameWithOwner.toLowerCase().split('/')[0],
    public: !data.isPrivate,
    archived: data.isArchived,
    createdOn: parseTimePropertyValue(data.createdAt),
    updatedOn: parseTimePropertyValue(data.updatedAt),
  };
  setRawData(repoEntity, { name: 'default', rawData: data });
  return repoEntity;
}

export function toOrganizationMemberEntity(
  data: OrgMemberQueryResponse,
): UserEntity {
  const userEntity: UserEntity = {
    _class: [GITHUB_MEMBER_ENTITY_CLASS],
    _type: GITHUB_MEMBER_ENTITY_TYPE,
    _key: data.id,
    login: data.login,
    username: data.login,
    displayName: data.name || data.login,
    name: data.name,
    mfaEnabled: data.hasTwoFactorEnabled || false,
    role: data.role,
    siteAdmin: data.isSiteAdmin,
  };
  setRawData(userEntity, { name: 'default', rawData: data });
  return userEntity;
}

export function toOrganizationMemberEntityFromTeamMember(
  data: OrgTeamMemberQueryResponse,
): UserEntity {
  const userEntity: UserEntity = {
    _class: [GITHUB_MEMBER_ENTITY_CLASS],
    _type: GITHUB_MEMBER_ENTITY_TYPE,
    _key: data.id,
    login: data.login,
    username: data.login,
    displayName: data.name || data.login,
    name: data.login,
    mfaEnabled: false,
    role: data.role,
  };
  setRawData(userEntity, { name: 'default', rawData: data });
  return userEntity;
}

export function toOrganizationCollaboratorEntity(
  data: OrgCollaboratorQueryResponse,
): UserEntity {
  const userEntity: UserEntity = {
    _class: [GITHUB_COLLABORATOR_ENTITY_CLASS],
    _type: GITHUB_COLLABORATOR_ENTITY_TYPE,
    _key: data.node_id,
    login: data.login,
    username: data.login,
    displayName: data.name || data.login,
    name: data.name || data.login,
    mfaEnabled: undefined,
    role: 'OUTSIDE',
    siteAdmin: false,
  };
  setRawData(userEntity, { name: 'default', rawData: data });
  return userEntity;
}

export function toPullRequestEntity(
  data: PullsListResponseItem,
  commits?: PullsListCommitsResponseItem[],
  commitsApproved?: PullsListCommitsResponseItem[],
  commitsByUnknownAuthor?: PullsListCommitsResponseItem[],
  approvals?: Approval[],
  usersByLogin?: IdEntityMap<UserEntity>,
): PullRequestEntity {
  const commitHashes = commits ? commits.map((c) => c.sha) : undefined;
  const commitMessages = commits
    ? commits.map((c) => c.commit.message)
    : undefined;
  const commitsApprovedHashes = commitsApproved
    ? commitsApproved.map((c) => c.sha)
    : undefined;
  const commitsByUnknownAuthorHashes = commitsByUnknownAuthor
    ? commitsByUnknownAuthor.map((c) => c.sha)
    : undefined;
  const commitsNotApproved = commitHashes
    ? commitHashes.filter((c) => !commitsApprovedHashes!.includes(c))
    : undefined;

  const approved = commitsNotApproved
    ? commitsNotApproved.length === 0
    : undefined;
  const validated = commitsByUnknownAuthor
    ? commitsByUnknownAuthor.length === 0
    : undefined;

  const approverLogins = approvals
    ? uniq(
        flattenMatrix<string>(
          aggregateProperties<string[]>('approverUsernames', approvals),
        ),
      )
    : undefined;
  const userLogin: string = data.user ? data.user.login : '';
  const authorUser = (usersByLogin || {})[userLogin];
  let reviewerLogins: string[] = [];
  let reviewers: string[] = [];
  if (data.requested_reviewers) {
    reviewerLogins = aggregateProperties<string>(
      'login',
      data.requested_reviewers,
    );
    reviewers = data.requested_reviewers.reduce(
      (reviewers: string[], reviewerData) => {
        if (reviewerData) {
          if (usersByLogin && usersByLogin[reviewerData.login]) {
            reviewers.push(usersByLogin[reviewerData.login].displayName!);
          } else {
            reviewers.push(reviewerData.login);
          }
        }
        return reviewers;
      },
      [],
    );
  }
  const entity: PullRequestEntity = {
    _type: GITHUB_PR_ENTITY_TYPE,
    _class: [GITHUB_PR_ENTITY_CLASS],
    _key: `${data.base.repo.full_name}/pull-requests/${data.number}`,
    displayName: `${data.base.repo.name}/${data.number}`,
    accountLogin: data.base.repo.owner ? data.base.repo.owner.login : '',
    repository: data.base.repo.name,
    // the type is hacked here because typing of data properties is controlled by a library call
    // so I can't just say that data.number is a string
    // here would be another way to solve it:
    // id: JSON.stringify(data.number).replace(/\"/g, ''),
    id: <string>(<unknown>data.number),

    name: data.title,
    title: data.title,
    description:
      data.body && data.body.length > 0
        ? `${data.body.substring(0, 80)}...`
        : undefined,
    webLink: data.html_url,

    state: data.state,
    open: data.state === PRState.Open,
    mergeCommitHash: data.merge_commit_sha,
    merged: (data.merged_at as any) !== null,
    declined: data.state === PRState.Closed && (data.merged_at as any) === null,
    approved,
    validated,

    commits: commitHashes,
    commitMessages,
    commitsApproved: commitsApprovedHashes,
    commitsNotApproved,
    commitsByUnknownAuthor: commitsByUnknownAuthorHashes,

    source: data.head.ref,
    target: data.base.ref,

    createdOn: parseTimePropertyValue(data.created_at),
    updatedOn: parseTimePropertyValue(data.updated_at),
    mergedOn: parseTimePropertyValue(data.merged_at),

    authorLogin: userLogin,
    author: authorUser
      ? // We know displayName is set; see toOrganizationMemberEntity
        authorUser.displayName!
      : // Fallback to username. This will always be used when ingesting from a
        // user account, since we don't ingest team members in that case (there
        // is no team)
        userLogin,
    reviewerLogins: reviewerLogins,
    reviewers: reviewers,
    approverLogins,
    approvers:
      approverLogins && usersByLogin
        ? displayNamesFromLogins(approverLogins, usersByLogin)
        : approverLogins,
  };
  const rawDataPropertiesToRemove = ['head', 'base']; // a few particularly large pieces of data that are repeated on every PR
  setRawData(entity, {
    name: 'default',
    rawData: omit(data, rawDataPropertiesToRemove),
  });
  return entity;
}

export function createRepoAllowsTeamRelationship(
  repo: RepoEntity,
  team: TeamEntity,
  permission: string,
): RepoAllowRelationship {
  let admin = false;
  let maintain = false;
  let push = false;
  let triage = false;
  const pull = true;
  if (permission === 'TRIAGE') {
    triage = true;
  }
  if (permission === 'WRITE') {
    triage = true;
    push = true;
  }
  if (permission === 'MAINTAIN') {
    triage = true;
    push = true;
    maintain = true;
  }
  if (permission === 'ADMIN') {
    triage = true;
    push = true;
    maintain = true;
    admin = true;
  }
  return {
    _key: `${repo._key}|allows|${team._key}`,
    _class: RelationshipClass.ALLOWS,
    _type: GITHUB_REPO_TEAM_RELATIONSHIP_TYPE,
    _fromEntityKey: repo._key,
    _toEntityKey: team._key,
    displayName: RelationshipClass.ALLOWS,
    permissionType: permission,
    adminPermission: admin,
    maintainPermission: maintain,
    pushPermission: push,
    triagePermission: triage,
    pullPermission: pull,
  };
}

export function createRepoAllowsUserRelationship(
  repo: RepoEntity,
  user: UserEntity,
  permissions?: CollaboratorPermissions,
): RepoAllowRelationship {
  let permissionType = 'READ';
  if (permissions?.triage) {
    permissionType = 'TRIAGE';
  }
  if (permissions?.push) {
    permissionType = 'WRITE';
  }
  if (permissions?.maintain) {
    permissionType = 'MAINTAIN';
  }
  if (permissions?.admin) {
    permissionType = 'ADMIN';
  }
  return {
    _key: `${repo._key}|allows|${user._key}`,
    _class: RelationshipClass.ALLOWS,
    _type: GITHUB_REPO_USER_RELATIONSHIP_TYPE,
    _fromEntityKey: repo._key,
    _toEntityKey: user._key,
    displayName: RelationshipClass.ALLOWS,
    permissionType: permissionType,
    adminPermission: permissions?.admin || false,
    maintainPermission: permissions?.maintain || false,
    pushPermission: permissions?.push || false,
    triagePermission: permissions?.triage || false,
    pullPermission: permissions?.pull || false,
  };
}
