import {
  setRawData,
  parseTimePropertyValue,
  RelationshipClass,
  createIntegrationEntity,
  MappedRelationship,
  RelationshipDirection,
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
  GITHUB_ENVIRONMENT_ENTITY_CLASS,
  GITHUB_ENVIRONMENT_ENTITY_TYPE,
  GITHUB_ENV_SECRET_ENTITY_TYPE,
  GITHUB_ISSUE_ENTITY_TYPE,
  GITHUB_ISSUE_ENTITY_CLASS,
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
  IssueEntity,
  AccountType,
  EnvironmentEntity,
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
  Commit,
  PullRequest,
  Review,
  Issue,
  Collaborator,
} from '../client/GraphQLClient';
import {
  OrgAppQueryResponse,
  SecretQueryResponse,
  RepoEnvironmentQueryResponse,
} from '../client/RESTClient/types';

import { uniq, last, compact, omit } from 'lodash';
import getCommitsToDestination from '../util/getCommitsToDestination';

export function toAccountEntity(data: OrgQueryResponse): AccountEntity {
  const accountEntity: AccountEntity = {
    _class: GITHUB_ACCOUNT_ENTITY_CLASS,
    _type: GITHUB_ACCOUNT_ENTITY_TYPE,
    _key: data.id,
    accountType: AccountType.Org,
    accountId: data.login,
    login: data.login,
    name: data.name ? data.name : undefined,
    displayName: data.name || data.login,
    createdOn: parseTimePropertyValue(data.createdAt),
    updatedOn: parseTimePropertyValue(data.updatedAt),
    description: data.description,
    email: data.email,
    node: data.id,
    databaseId: data.databaseId,
    verified: data.isVerified,
    location: data.location,
    websiteUrl: data.websiteUrl,
    webLink: data.url,
  };
  setRawData(accountEntity, { name: 'default', rawData: data });
  return accountEntity;
}

export function toAppEntity(data: OrgAppQueryResponse): AppEntity {
  const appEntity: AppEntity = {
    _class: GITHUB_APP_ENTITY_CLASS,
    _type: GITHUB_APP_ENTITY_TYPE,
    _key: getAppEntityKey(data.id),
    name: data.app_slug,
    displayName: data.app_slug,
    webLink: data.html_url,
    installationId: data.id, //the installation id
    appId: data.app_id,
    appSlug: data.app_slug,
    targetId: data.target_id,
    targetType: data.target_type,
    createdOn: parseTimePropertyValue(data.created_at),
    updatedOn: parseTimePropertyValue(data.updated_at),
    events: data.events,
    repositorySelection: data.repository_selection,
    singleFileName: data.single_file_name || '',
    hasMultipleSingleFiles: data.has_multiple_single_files,
    singleFilePaths: data.single_file_paths,
    // suspendedBy: data.suspended_by || '',
    suspendedOn: parseTimePropertyValue(data.suspended_at),
    ...decomposePermissions(data.permissions),
  };
  setRawData(appEntity, { name: 'default', rawData: data });
  return appEntity;
}

export function toOrgSecretEntity(
  data: SecretQueryResponse,
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
    createdOn: parseTimePropertyValue(data.created_at),
    updatedOn: parseTimePropertyValue(data.updated_at),
    visibility: data.visibility,
    selectedRepositoriesLink: data.selected_repositories_url,
  };
  setRawData(secretEntity, { name: 'default', rawData: data });
  return secretEntity;
}

export function toRepoSecretEntity(
  data: SecretQueryResponse,
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
    createdOn: parseTimePropertyValue(data.created_at),
    updatedOn: parseTimePropertyValue(data.updated_at),
    visibility: 'selected',
  };
  setRawData(secretEntity, { name: 'default', rawData: data });
  return secretEntity;
}

export function toEnvironmentEntity(
  data: RepoEnvironmentQueryResponse,
  orgLogin: string,
  repoTag: RepoKeyAndName,
): EnvironmentEntity {
  let protRulesExist = false;
  if (data.protection_rules && data.protection_rules[0]) {
    protRulesExist = true;
  }
  const envEntity: EnvironmentEntity = {
    _class: GITHUB_ENVIRONMENT_ENTITY_CLASS,
    _type: GITHUB_ENVIRONMENT_ENTITY_TYPE,
    _key: data.node_id,
    name: data.name,
    displayName: data.name,
    webLink: `https://github.com/${orgLogin}/${repoTag.name}/settings/environments/${data.id}/edit`,
    id: String(data.id), //force to string to pass SDK validation
    nodeId: data.node_id,
    url: data.url,
    htmlUrl: data.html_url,
    createdOn: parseTimePropertyValue(data.created_at),
    updatedOn: parseTimePropertyValue(data.updated_at),
    protectionRulesExist: protRulesExist,
    //parent properties for use in creating envSecrets entities
    parentRepoName: repoTag.name,
    parentRepoKey: repoTag._key,
    parentRepoDatabaseId: repoTag.databaseId,
  };
  setRawData(envEntity, { name: 'default', rawData: data });
  return envEntity;
}

export function toEnvSecretEntity(
  data: SecretQueryResponse,
  orgLogin: string,
  env: EnvironmentEntity,
): SecretEntity {
  const secretEntity: SecretEntity = {
    _class: GITHUB_SECRET_ENTITY_CLASS,
    _type: GITHUB_ENV_SECRET_ENTITY_TYPE,
    _key: getSecretEntityKey({
      name: data.name,
      secretOwnerType: 'Env',
      secretOwnerName: env.name,
    }),
    name: data.name,
    displayName: data.name,
    webLink: `https://github.com/${orgLogin}/${env.parentRepoName}/settings/environments/${env.id}/edit`,
    createdOn: parseTimePropertyValue(data.created_at),
    updatedOn: parseTimePropertyValue(data.updated_at),
    visibility: 'selected',
  };
  setRawData(secretEntity, { name: 'default', rawData: data });
  return secretEntity;
}

export function toTeamEntity(data: OrgTeamQueryResponse): TeamEntity {
  const teamEntity: TeamEntity = {
    _class: GITHUB_TEAM_ENTITY_CLASS,
    _type: GITHUB_TEAM_ENTITY_TYPE,
    _key: data.id,
    webLink: data.url,
    name: data.slug,
    displayName: data.name,
    fullName: data.name,
    createdOn: parseTimePropertyValue(data.createdAt),
    updatedOn: parseTimePropertyValue(data.updatedAt),
    databaseId: data.databaseId || '',
    description: data.description || '',
    node: data.id,
    privacy: data.privacy || '',
  };
  setRawData(teamEntity, {
    name: 'default',
    rawData: omit(data, ['members', 'repos']),
  });
  return teamEntity;
}

export function toRepositoryEntity(data: OrgRepoQueryResponse): RepoEntity {
  const repoEntity: RepoEntity = {
    _class: GITHUB_REPO_ENTITY_CLASS,
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
    pushedOn: parseTimePropertyValue(data.pushedAt),
    databaseId: data.databaseId || '',
    autoMergeAllowed: data.autoMergeAllowed,
    deleteBranchOnMerge: data.deleteBranchOnMerge,
    description: data.description || '',
    homepageUrl: data.homepageUrl || '',
    node: data.id,
    disabled: data.isDisabled,
    empty: data.isEmpty,
    fork: data.isFork,
    forkingAllowed: data.forkingAllowed,
    forkCount: data.forkCount,
    inOrganization: data.isInOrganization,
    locked: data.isLocked,
    mirror: data.isMirror,
    securityPolicyEnabled: data.isSecurityPolicyEnabled,
    template: data.isTemplate,
    userConfigurationRepository: data.isUserConfigurationRepository,
    lockReason: data.lockReason || '',
    mergeCommitAllowed: data.mergeCommitAllowed,
    rebaseMergeAllowed: data.rebaseMergeAllowed,
  };
  setRawData(repoEntity, { name: 'default', rawData: data });
  return repoEntity;
}

export function toOrganizationMemberEntity(
  data: OrgMemberQueryResponse,
): UserEntity {
  const userEntity: UserEntity = {
    _class: GITHUB_MEMBER_ENTITY_CLASS,
    _type: GITHUB_MEMBER_ENTITY_TYPE,
    _key: data.id,
    login: data.login,
    username: data.login,
    displayName: data.name || data.login,
    name: data.name,
    mfaEnabled: data.hasTwoFactorEnabled || undefined,
    role: data.role,
    siteAdmin: data.isSiteAdmin,
    webLink: data.url || '',
    company: data.company || '',
    createdOn: parseTimePropertyValue(data.createdAt),
    updatedOn: parseTimePropertyValue(data.updatedAt),
    databaseId: data.databaseId,
    id: data.id,
    node: data.id,
    employee: data.isEmployee,
    location: data.location || '',
    websiteUrl: data.websiteUrl || '',
  };
  if (data.email) {
    userEntity.email = data.email;
  } //don't set the property if it's not provided, because SDK input validation will fail
  setRawData(userEntity, { name: 'default', rawData: data });
  return userEntity;
}

export function toOrganizationMemberEntityFromTeamMember(
  data: OrgTeamMemberQueryResponse,
): UserEntity {
  const userEntity: UserEntity = {
    _class: GITHUB_MEMBER_ENTITY_CLASS,
    _type: GITHUB_MEMBER_ENTITY_TYPE,
    _key: data.id,
    login: data.login,
    username: data.login,
    displayName: data.name || data.login,
    name: data.login,
    mfaEnabled: undefined,
    role: data.role,
    webLink: 'https://github.com/' + data.login,
    node: data.id,
    id: data.id,
  };
  setRawData(userEntity, { name: 'default', rawData: data });
  return userEntity;
}

export function toOrganizationCollaboratorEntity(
  data: Collaborator,
): UserEntity {
  const userEntity: UserEntity = {
    _class: GITHUB_COLLABORATOR_ENTITY_CLASS,
    _type: GITHUB_COLLABORATOR_ENTITY_TYPE,
    _key: data.id,
    login: data.login,
    username: data.login,
    displayName: data.name || data.login,
    name: data.name || data.login,
    mfaEnabled: undefined,
    role: 'OUTSIDE',
    siteAdmin: false,
    webLink: 'https://github.com/' + data.login,
    node: data.id,
    id: data.id,
  };
  setRawData(userEntity, { name: 'default', rawData: data });
  return userEntity;
}

export function toIssueEntity(data: Issue, repoName: string): IssueEntity {
  const issueName = repoName + '/' + String(data.number); //format matches name of PRs
  const labels = data.labels?.map((l) => l.name);
  const issueEntity: IssueEntity = {
    _class: GITHUB_ISSUE_ENTITY_CLASS,
    _type: GITHUB_ISSUE_ENTITY_TYPE,
    _key: data.id,
    webLink: data.url,
    url: data.url,
    name: issueName,
    displayName: issueName,
    description: data.body,
    number: data.number,
    databaseId: data.databaseId,
    title: data.title,
    state: data.state,
    locked: data.locked,
    closed: data.closed,
    createdOn: parseTimePropertyValue(data.createdAt),
    updatedOn: parseTimePropertyValue(data.updatedAt),
    closedOn: parseTimePropertyValue(data.closedAt),
    authorAssociation: data.authorAssociation,
    activeLockReason: data.activeLockReason,
    body: data.body,
    createdViaEmail: data.createdViaEmail,
    pinned: data.isPinned,
    lastEditedOn: parseTimePropertyValue(data.lastEditedAt),
    publishedOn: parseTimePropertyValue(data.publishedAt),
    resourcePath: data.resourcePath,
    labels: labels,
  };
  setRawData(issueEntity, {
    name: 'default',
    rawData: data,
  });
  return issueEntity;
}

export function createRepoAllowsTeamRelationship(
  repoId: string,
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
    _key: `${repoId}|allows|${team._key}`,
    _class: RelationshipClass.ALLOWS,
    _type: GITHUB_REPO_TEAM_RELATIONSHIP_TYPE,
    _fromEntityKey: repoId,
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
  repoId: string,
  user: UserEntity,
  permission: string,
): RepoAllowRelationship {
  const adminPermission = permission === 'ADMIN';
  const maintainPermission = adminPermission || permission === 'MAINTAIN';
  const pushPermission = maintainPermission || permission === 'WRITE';
  const triagePermission = pushPermission || permission === 'TRIAGE';
  return {
    _key: `${repoId}|allows|${user._key}`,
    _class: RelationshipClass.ALLOWS,
    _type: GITHUB_REPO_USER_RELATIONSHIP_TYPE,
    _fromEntityKey: repoId,
    _toEntityKey: user._key,
    displayName: RelationshipClass.ALLOWS,
    role: permission,
    adminPermission: adminPermission,
    maintainPermission: maintainPermission,
    pushPermission: pushPermission,
    triagePermission: triagePermission,
    pullPermission: true, //always true if there is a relationship
  };
}

//PRs and Issues in GitHub are both types of Issues
export function createUnknownUserIssueRelationship(
  unknownLogin: string,
  relationshipType: string,
  relationshipClass: string,
  issueKey: string,
): MappedRelationship {
  //used to create a mapped relationship to an unknown GitHub user who worked on a PR or an Issue in the past
  //they may no longer be a collaborator or org member, so make a mapped relationship - this will create a placeholder entity,
  //or map to a `github_user` that might be found some other way
  //it will also map to known users if for some reason a current member or collaborator is passed to this function
  return {
    _key: `${unknownLogin}|${relationshipClass.toLowerCase()}|${issueKey}`,
    _type: relationshipType,
    _class: relationshipClass,
    _mapping: {
      sourceEntityKey: issueKey,
      relationshipDirection: RelationshipDirection.REVERSE,
      targetFilterKeys: [['_type', 'login']],
      targetEntity: {
        _class: 'User',
        _type: GITHUB_MEMBER_ENTITY_TYPE,
        login: unknownLogin,
      },
      skipTargetCreation: false,
    },
    displayName: relationshipClass,
  };
}

export function toPullRequestEntity(
  pullRequest: PullRequest,
  teamMembersByLoginMap: IdEntityMap<UserEntity>, //
  allKnownUsersByLoginMap: IdEntityMap<UserEntity>, // Includes known colaborators
): PullRequestEntity {
  const commits = pullRequest.commits;
  const reviews = pullRequest.reviews;
  const labels = pullRequest.labels?.map((l) => l.name);

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
  const commitsCount = commits ? commits.length : 0;
  const approvalsCount = reviews ? reviews.filter(isApprovalReview).length : 0;

  let approvalLastAt: number | undefined = undefined;
  if (approvedCommits) {
    const commitTimes = approvedCommits?.map(
      (c) => parseTimePropertyValue(c.authoredDate) || 0,
    );
    let maxTime = 0;
    if (commitTimes) {
      maxTime = Math.max(...commitTimes);
    }
    if (maxTime > 0) {
      approvalLastAt = maxTime;
    }
  }

  return createIntegrationEntity({
    entityData: {
      source: pullRequest,
      assign: {
        _type: GITHUB_PR_ENTITY_TYPE,
        _class: GITHUB_PR_ENTITY_CLASS,
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
        databaseId: pullRequest.databaseId,
        webLink: pullRequest.url,
        labels: labels,

        state: pullRequest.state,
        open: pullRequest.state === 'OPEN',
        mergeCommitHash: pullRequest.mergeCommit?.oid,
        merged: pullRequest.merged,
        node: pullRequest.id,
        declined: pullRequest.state === 'CLOSED' && !pullRequest.merged,
        approved: pullRequest.reviewDecision === 'APPROVED',
        allCommitsApproved: commitsNotApproved
          ? commitsNotApproved.length === 0
          : undefined,

        commits: commitHashes,
        commitsCount: commitsCount,
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
        approvalsCount: approvalsCount,
        approvalLastAt: approvalLastAt,
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
