import {
  setRawData,
  RelationshipClass,
  parseTimePropertyValue,
} from '@jupiterone/integration-sdk-core';

import {
  AccountEntity,
  AccountRepoRelationship,
  RepoEntity,
  OrganizationMemberRelationship,
  UserEntity,
  PullRequestEntity,
  RepoPullRequestRelationship,
  UserPullRequestRelationship,
  PRState,
  IdEntityMap,
  TeamEntity,
  TeamMemberRelationship,
  AccountType,
  TeamRepoRelationship,
  PullsListResponseItem,
  PullsListCommitsResponseItem,
} from '../types';
import { Approval } from '../approval/collectCommitsForPR';
import {
  aggregateProperties,
  flattenMatrix,
  displayNamesFromLogins,
} from '../util/propertyHelpers';
import {
  OrgMemberQueryResponse,
  OrgRepoQueryResponse,
  OrgTeamQueryResponse,
  OrgQueryResponse,
  OrgTeamMemberQueryResponse,
} from '../client/GraphQLClient';

import {
  GITHUB_ACCOUNT_ENTITY_TYPE,
  GITHUB_ACCOUNT_ENTITY_CLASS,
  GITHUB_ACCOUNT_MEMBER_RELATIONSHIP_TYPE,
  GITHUB_ACCOUNT_TEAM_RELATIONSHIP_TYPE,
  GITHUB_ACCOUNT_REPO_RELATIONSHIP_TYPE,
  GITHUB_MEMBER_ENTITY_TYPE,
  GITHUB_MEMBER_ENTITY_CLASS,
  GITHUB_MEMBER_ACCOUNT_RELATIONSHIP_TYPE,
  GITHUB_MEMBER_TEAM_RELATIONSHIP_TYPE,
  GITHUB_MEMBER_REVIEWED_PR_RELATIONSHIP_TYPE,
  GITHUB_MEMBER_APPROVED_PR_RELATIONSHIP_TYPE,
  GITHUB_MEMBER_OPENED_PR_RELATIONSHIP_TYPE,
  GITHUB_REPO_ENTITY_TYPE,
  GITHUB_REPO_ENTITY_CLASS,
  GITHUB_REPO_PR_RELATIONSHIP_TYPE,
  GITHUB_PR_ENTITY_TYPE,
  GITHUB_PR_ENTITY_CLASS,
  GITHUB_TEAM_ENTITY_TYPE,
  GITHUB_TEAM_ENTITY_CLASS,
  GITHUB_TEAM_MEMBER_RELATIONSHIP_TYPE,
  GITHUB_TEAM_REPO_RELATIONSHIP_TYPE,
} from '../constants';

export function toAccountEntity(data: OrgQueryResponse): AccountEntity {
  const accountEntity: AccountEntity = {
    _class: [GITHUB_ACCOUNT_ENTITY_CLASS],
    _type: GITHUB_ACCOUNT_ENTITY_TYPE,
    _key: data.id,
    accountType: AccountType.Org,
    accountId: data.login,
    login: data.login,
    name: data.name,
    displayName: data.name,
  };
  setRawData(accountEntity, { name: 'default', rawData: data });
  return accountEntity;
}

export function toTeamEntity(data: OrgTeamQueryResponse): TeamEntity {
  const teamEntity: TeamEntity = {
    _class: [GITHUB_TEAM_ENTITY_CLASS],
    _type: GITHUB_TEAM_ENTITY_TYPE,
    _key: data.id,
    webLink: data.url,
    name: data.slug, //this works, but why? Where is .slug set?
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
    displayName: data.name,
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
    displayName: data.login,
    name: data.login,
    mfaEnabled: false,
    role: data.role,
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
    ? flattenMatrix<string>(
        aggregateProperties<string[]>('approverUsernames', approvals),
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
    //the type is hacked here because typing of data properties is controlled by a library call
    //so I can't just say that data.number is a string
    //here would be another way to solve it:
    //id: JSON.stringify(data.number).replace(/\"/g, ''),
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
  setRawData(entity, { name: 'default', rawData: data });
  return entity;
}

export function toOrganizationHasMemberRelationship(
  installationEntity: AccountEntity,
  userEntity: UserEntity,
): OrganizationMemberRelationship {
  return {
    _key: `${installationEntity._key}|has|${userEntity._key}`,
    _type: GITHUB_ACCOUNT_MEMBER_RELATIONSHIP_TYPE,
    _class: RelationshipClass.HAS,
    _fromEntityKey: installationEntity._key,
    _toEntityKey: userEntity._key,
    displayName: RelationshipClass.HAS,
  };
}

export function toMemberManagesOrganizationRelationship(
  installationEntity: AccountEntity,
  userEntity: UserEntity,
): OrganizationMemberRelationship {
  return {
    _key: `${userEntity._key}|manages|${installationEntity._key}`,
    _type: GITHUB_MEMBER_ACCOUNT_RELATIONSHIP_TYPE,
    _class: RelationshipClass.MANAGES,
    _fromEntityKey: userEntity._key,
    _toEntityKey: installationEntity._key,
    displayName: RelationshipClass.MANAGES,
  };
}

export function toOrganizationHasTeamRelationship(
  installationEntity: AccountEntity,
  teamEntity: TeamEntity,
): OrganizationMemberRelationship {
  return {
    _key: `${installationEntity._key}|has|${teamEntity._key}`,
    _type: GITHUB_ACCOUNT_TEAM_RELATIONSHIP_TYPE,
    _class: RelationshipClass.HAS,
    _fromEntityKey: installationEntity._key,
    _toEntityKey: teamEntity._key,
    displayName: RelationshipClass.HAS,
  };
}

export function toTeamHasMemberRelationship(
  teamEntity: TeamEntity,
  teamMemberEntity: UserEntity,
): TeamMemberRelationship {
  return {
    _key: `${teamEntity._key}|has|${teamMemberEntity._key}`,
    _type: GITHUB_TEAM_MEMBER_RELATIONSHIP_TYPE,
    _class: RelationshipClass.HAS,
    _fromEntityKey: teamEntity._key,
    _toEntityKey: teamMemberEntity._key,
    displayName: RelationshipClass.HAS,
  };
}

export function toMemberManagesTeamRelationship(
  teamMemberEntity: UserEntity,
  teamEntity: TeamEntity,
): TeamMemberRelationship {
  return {
    _key: `${teamMemberEntity._key}|manages|${teamEntity._key}`,
    _type: GITHUB_MEMBER_TEAM_RELATIONSHIP_TYPE,
    _class: RelationshipClass.MANAGES,
    _fromEntityKey: teamMemberEntity._key,
    _toEntityKey: teamEntity._key,
    displayName: RelationshipClass.MANAGES,
  };
}

export function toTeamAllowsRepoRelationship(
  teamEntity: TeamEntity,
  repoEntity: RepoEntity,
  permission: string,
): TeamRepoRelationship {
  return {
    _key: `${teamEntity._key}|allows|${repoEntity._key}`,
    _type: GITHUB_TEAM_REPO_RELATIONSHIP_TYPE,
    _class: RelationshipClass.ALLOWS,
    _fromEntityKey: teamEntity._key,
    _toEntityKey: repoEntity._key,
    permission,
    displayName: RelationshipClass.ALLOWS,
  };
}

export function toAccountOwnsRepoRelationship(
  installationEntity: AccountEntity,
  repoEntity: RepoEntity,
): AccountRepoRelationship {
  return {
    _key: `${installationEntity._key}|owns|${repoEntity._key}`,
    _type: GITHUB_ACCOUNT_REPO_RELATIONSHIP_TYPE,
    _class: RelationshipClass.OWNS,
    _fromEntityKey: installationEntity._key,
    _toEntityKey: repoEntity._key,
    displayName: RelationshipClass.OWNS,
  };
}

export function toRepoHasPullRequestRelationship(
  repoEntity: RepoEntity,
  pullRequestEntity: PullRequestEntity,
): RepoPullRequestRelationship {
  return {
    _key: `${repoEntity._key}|has|${pullRequestEntity._key}`,
    _type: GITHUB_REPO_PR_RELATIONSHIP_TYPE,
    _class: RelationshipClass.HAS,
    _fromEntityKey: repoEntity._key,
    _toEntityKey: pullRequestEntity._key,
    displayName: RelationshipClass.HAS,
  };
}

export function toUserOpenedPullRequestRelationship(
  userEntity: UserEntity,
  pullRequestEntity: PullRequestEntity,
): UserPullRequestRelationship {
  return {
    _key: `${userEntity._key}|opened|${pullRequestEntity._key}`,
    _class: RelationshipClass.OPENED,
    _type: GITHUB_MEMBER_OPENED_PR_RELATIONSHIP_TYPE,
    _fromEntityKey: userEntity._key,
    _toEntityKey: pullRequestEntity._key,
    displayName: RelationshipClass.OPENED,
  };
}

export function toUserReviewedPullRequestRelationship(
  userEntity: UserEntity,
  pullRequestEntity: PullRequestEntity,
): UserPullRequestRelationship {
  return {
    _key: `${userEntity._key}|reviewed|${pullRequestEntity._key}`,
    _class: RelationshipClass.REVIEWED,
    _type: GITHUB_MEMBER_REVIEWED_PR_RELATIONSHIP_TYPE,
    _fromEntityKey: userEntity._key,
    _toEntityKey: pullRequestEntity._key,
    displayName: RelationshipClass.REVIEWED,
  };
}

export function toUserApprovedPullRequestRelationship(
  userEntity: UserEntity,
  pullRequestEntity: PullRequestEntity,
): UserPullRequestRelationship {
  return {
    _key: `${userEntity._key}|approved|${pullRequestEntity._key}`,
    _class: RelationshipClass.APPROVED,
    _type: GITHUB_MEMBER_APPROVED_PR_RELATIONSHIP_TYPE,
    _fromEntityKey: userEntity._key,
    _toEntityKey: pullRequestEntity._key,
    displayName: RelationshipClass.APPROVED,
  };
}
