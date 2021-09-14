import {
  setRawData,
  parseTimePropertyValue,
  RelationshipClass,
  createIntegrationEntity,
  Relationship,
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
  GITHUB_SECRET_ENTITY_CLASS,
  GITHUB_ORG_SECRET_ENTITY_TYPE,
  GITHUB_REPO_SECRET_ENTITY_TYPE,
  GITHUB_REPO_ORG_SECRET_RELATIONSHIP_TYPE,
  GITHUB_REPO_SECRET_RELATIONSHIP_TYPE,
  GITHUB_REPO_REPO_SECRET_RELATIONSHIP_TYPE,
  //GITHUB_ENV_SECRET_ENTITY_TYPE,
} from '../constants';

import {
  AccountEntity,
  AppEntity,
  SecretEntity,
  RepoEntity,
  UserEntity,
  PullRequestEntity,
  IdEntityMap,
  TeamEntity,
  AccountType,
  RepoAllowRelationship,
  RepoKeyAndName,
} from '../types';
import {
  decomposePermissions,
  getAppEntityKey,
  getSecretEntityKey,
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
  OrgSecretQueryResponse,
} from '../client/GraphQLClient';

import { uniq, last, compact } from 'lodash';
import { Commit, PullRequest, Review } from '../client/GraphQLClient/types';
import getCommitsToDestination from '../util/getCommitsToDestination';

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
    // suspendedBy: data.suspended_by || '',
    suspendedAt: data.suspended_at || '',
    ...decomposePermissions(data.permissions),
  };
  setRawData(appEntity, { name: 'default', rawData: data });
  return appEntity;
}

export function toOrgSecretEntity(
  data: OrgSecretQueryResponse,
  orgLogin: string,
): SecretEntity {
  const secretEntity: SecretEntity = {
    _class: GITHUB_SECRET_ENTITY_CLASS,
    _type: GITHUB_ORG_SECRET_ENTITY_TYPE,
    _key: getSecretEntityKey({
      name: data.name,
      secretOwnerType: 'Org',
      secretOwnerName: orgLogin,
    }),
    name: data.name,
    displayName: data.name,
    webLink: `https://github.com/organizations/${orgLogin}/settings/secrets/actions/${data.name}`,
    createdAt: data.created_at,
    updatedAt: data.updated_at,
    visibility: data.visibility,
    selectedRepositoriesLink: data.selected_repositories_url,
  };
  setRawData(secretEntity, { name: 'default', rawData: data });
  return secretEntity;
}

export function toRepoSecretEntity(
  data: OrgSecretQueryResponse,
  orgLogin: string,
  repoName: string,
): SecretEntity {
  const secretEntity: SecretEntity = {
    _class: GITHUB_SECRET_ENTITY_CLASS,
    _type: GITHUB_REPO_SECRET_ENTITY_TYPE,
    _key: getSecretEntityKey({
      name: data.name,
      secretOwnerType: 'Repo',
      secretOwnerName: repoName,
    }),
    name: data.name,
    displayName: data.name,
    webLink: `https://github.com/${orgLogin}/${repoName}/settings/secrets/actions/${data.name}`,
    createdAt: data.created_at,
    updatedAt: data.updated_at,
    visibility: 'selected',
  };
  setRawData(secretEntity, { name: 'default', rawData: data });
  return secretEntity;
}

/* for use later
export function toEnvSecretEntity(
  data: OrgSecretQueryResponse,
  orgLogin: string,
  repoName: string,
  environment: EnvironmentEntity,
): SecretEntity {
  const secretEntity: SecretEntity = {
    _class: GITHUB_SECRET_ENTITY_CLASS,
    _type: GITHUB_ENV_SECRET_ENTITY_TYPE,
    _key: getSecretEntityKey({name: data.name, secretOwnerType:'Env', secretOwnerName: environment.name}),
    name: data.name,
    displayName: data.name,
    webLink: `https://github.com/${orgLogin}/${repoName}/settings/environments/${environment.id}/edit`,
    createdAt: data.created_at,
    updatedAt: data.updated_at,
    visibility: 'selected',
  };
  setRawData(secretEntity, { name: 'default', rawData: data });
  return secretEntity;
}
*/

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
    webLink: 'https://github.com/' + data.login,
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
    webLink: 'https://github.com/' + data.login,
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
    webLink: 'https://github.com/' + data.login,
  };
  setRawData(userEntity, { name: 'default', rawData: data });
  return userEntity;
}

export function createRepoAllowsTeamRelationship(
  repo: RepoKeyAndName,
  team: TeamEntity,
  permission: string,
): RepoAllowRelationship {
  let admin = false;
  let maintain = false;
  let push = false;
  let triage = false;
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
    role: permission,
    adminPermission: admin,
    maintainPermission: maintain,
    pushPermission: push,
    triagePermission: triage,
    pullPermission: true, //always true if there is a relationship
  };
}

export function createRepoAllowsUserRelationship(
  repo: RepoKeyAndName,
  user: UserEntity,
  permissions?: CollaboratorPermissions,
): RepoAllowRelationship {
  let role = 'READ';
  if (permissions?.triage) {
    role = 'TRIAGE';
  }
  if (permissions?.push) {
    role = 'WRITE';
  }
  if (permissions?.maintain) {
    role = 'MAINTAIN';
  }
  if (permissions?.admin) {
    role = 'ADMIN';
  }
  return {
    _key: `${repo._key}|allows|${user._key}`,
    _class: RelationshipClass.ALLOWS,
    _type: GITHUB_REPO_USER_RELATIONSHIP_TYPE,
    _fromEntityKey: repo._key,
    _toEntityKey: user._key,
    displayName: RelationshipClass.ALLOWS,
    role: role,
    adminPermission: permissions?.admin || false,
    maintainPermission: permissions?.maintain || false,
    pushPermission: permissions?.push || false,
    triagePermission: permissions?.triage || false,
    pullPermission: true, //always true if there is a relationship
  };
}

//creating the following Secret relationships manually because .createDirectRelationship wants the whole entity
//and for reducing memory footprint, it's better to work with a smaller object

export function createRepoUsesOrgSecretRelationship(
  repo: RepoKeyAndName,
  secret: SecretEntity,
): Relationship {
  return {
    _key: `${repo._key}|uses|${secret._key}`,
    _class: RelationshipClass.USES,
    _type: GITHUB_REPO_ORG_SECRET_RELATIONSHIP_TYPE,
    _fromEntityKey: repo._key,
    _toEntityKey: secret._key,
    displayName: RelationshipClass.USES,
  };
}

export function createRepoHasRepoSecretRelationship(
  repo: RepoKeyAndName,
  secret: SecretEntity,
): Relationship {
  return {
    _key: `${repo._key}|has|${secret._key}`,
    _class: RelationshipClass.HAS,
    _type: GITHUB_REPO_SECRET_RELATIONSHIP_TYPE,
    _fromEntityKey: repo._key,
    _toEntityKey: secret._key,
    displayName: RelationshipClass.HAS,
  };
}

export function createRepoUsesRepoSecretRelationship(
  repo: RepoKeyAndName,
  secret: SecretEntity,
): Relationship {
  return {
    _key: `${repo._key}|uses|${secret._key}`,
    _class: RelationshipClass.USES,
    _type: GITHUB_REPO_REPO_SECRET_RELATIONSHIP_TYPE, //'github_repo_uses_repo_secret' gets reduced in SDK to 'github_repo_uses_secret'
    _fromEntityKey: repo._key,
    _toEntityKey: secret._key,
    displayName: RelationshipClass.USES,
  };
}

export function toPullRequestEntity(
  pullRequest: PullRequest,
  teamMembersByLoginMap: IdEntityMap<UserEntity>, //
  allKnownUsersByLoginMap: IdEntityMap<UserEntity>, // Includes known colaborators
): PullRequestEntity {
  const commits = pullRequest.commits;
  const reviews = pullRequest.reviews;

  const approvals = reviews
    ?.filter(isApprovalReview)
    .reduce(convertToApproval, [])
    .filter(
      (approval) =>
        hasTeamMemberApprovals(approval, teamMembersByLoginMap) &&
        noSelfApprovals(approval, commits ?? []),
    );

  const approvedCommits =
    commits && getCommitsToDestination(commits, last(approvals)?.commit);
  const approvedCommitHashes = approvedCommits?.map((c) => c.oid);
  const commitHashes = commits?.map((c) => c.oid);
  const commitsNotApproved = commitHashes?.filter(
    (c) => !approvedCommitHashes?.includes(c),
  );
  const commitsByUnknownAuthor = commits?.filter((commit) =>
    fromUnknownAuthor(commit, allKnownUsersByLoginMap),
  );

  return createIntegrationEntity({
    entityData: {
      source: pullRequest,
      assign: {
        _type: GITHUB_PR_ENTITY_TYPE,
        _class: [GITHUB_PR_ENTITY_CLASS],
        _key: `${pullRequest.baseRepository.owner.login}/${pullRequest.baseRepository.name}/pull-requests/${pullRequest.number}`,
        displayName: `${pullRequest.baseRepository.name}/${pullRequest.number}`,
        accountLogin: pullRequest.baseRepository.owner.login,
        repository: pullRequest.baseRepository.name,
        // The number is NOT the id of the Pull Request. Hopefully no one gets bit from that later
        id: pullRequest.number ? String(pullRequest.number) : '',
        number: pullRequest.number,
        // This is actually what the pull request id is...
        pullRequestId: pullRequest.id,
        name: pullRequest.title,
        title: pullRequest.title,
        description:
          pullRequest.body && pullRequest.body.length > 0
            ? `${pullRequest.body.substring(0, 80)}...`
            : undefined,
        webLink: pullRequest.url,

        state: pullRequest.state,
        open: pullRequest.state === 'OPEN',
        mergeCommitHash: pullRequest.mergeCommit?.oid,
        merged: pullRequest.merged,
        declined: pullRequest.state === 'CLOSED' && !pullRequest.merged,
        approved: pullRequest.reviewDecision === 'APPROVED',
        allCommitsApproved: commitsNotApproved
          ? commitsNotApproved.length === 0
          : undefined,

        commits: commitHashes,
        commitMessages: commits?.map((c) => c.message),
        commitsApproved: approvedCommitHashes,
        commitsNotApproved,
        commitsByUnknownAuthor: commitsByUnknownAuthor?.map((c) => c.oid),
        validated: commitsByUnknownAuthor
          ? commitsByUnknownAuthor.length === 0
          : undefined,

        source: pullRequest.headRefName,
        target: pullRequest.baseRefName,

        createdOn: parseTimePropertyValue(pullRequest.createdAt),
        updatedOn: parseTimePropertyValue(pullRequest.updatedAt),
        mergedOn: parseTimePropertyValue(pullRequest.mergedAt),

        authorLogin: pullRequest.author?.login ?? '',
        author: pullRequest.author?.name ?? pullRequest.author?.login ?? '',

        reviewerLogins:
          reviews &&
          compact(uniq(reviews.map((review) => review.author?.login))),
        reviewers:
          reviews &&
          compact(uniq(reviews.map((review) => review.author?.name))),
        approverLogins:
          reviews &&
          compact(
            uniq(reviews.filter(isApprovalReview).map((r) => r.author?.login)),
          ),
        approvers:
          reviews &&
          compact(
            uniq(reviews.filter(isApprovalReview).map((r) => r.author?.name)),
          ),
      },
    },
  }) as PullRequestEntity;
}

/**
 * PULL REQUEST HELPER FUNCTIONS
 */
export interface Approval {
  commit: string;
  approverUsernames: string[];
}

function isApprovalReview(review: Review) {
  return ['APPROVED', 'DISMISSED'].includes(review.state); // Not sure why dismissed is an approved state to be honest
}

function noSelfApprovals(approval: Approval, commits: Commit[]) {
  const associatedCommits = getCommitsToDestination(commits, approval.commit);
  const commitAuthors =
    associatedCommits?.reduce(
      (authors: string[], commit) => [
        ...authors,
        commit.author.user?.login ? commit.author.user?.login : '',
      ],
      [],
    ) ?? [];
  const validApprovers = approval.approverUsernames.filter(
    (approver) => !commitAuthors.includes(approver),
  );
  return validApprovers.length > 0;
}

function hasTeamMemberApprovals(
  approval: Approval,
  teamMembersByLoginMap: IdEntityMap<UserEntity>,
) {
  return approval.approverUsernames.some(
    (approver) => teamMembersByLoginMap[approver],
  );
}

function fromUnknownAuthor(
  commit: Commit,
  allKnownUsersByLoginMap: IdEntityMap<UserEntity>,
) {
  return (
    !commit.author?.user?.login ||
    !allKnownUsersByLoginMap[commit.author.user?.login]
  );
}

function convertToApproval(approvals: Approval[], approvalReview: Review) {
  if (!approvalReview.author?.login || !approvalReview.commit?.oid) {
    // If an approval has no user or no commit, don't count it as valid
    return approvals;
  }
  const existingApproval = approvals.find(
    (approval) => approval.commit === approvalReview.commit!.oid,
  );
  if (existingApproval) {
    existingApproval.approverUsernames.push(approvalReview.author.login);
    return approvals;
  } else {
    const approval: Approval = {
      commit: approvalReview.commit.oid,
      approverUsernames: [approvalReview.author.login],
    };
    return [...approvals, approval];
  }
}
