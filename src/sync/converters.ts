import {
  setRawData,
  parseTimePropertyValue,
  RelationshipClass,
  createIntegrationEntity,
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
  IdEntityMap,
  TeamEntity,
  AccountType,
  RepoAllowRelationship,
  PRState,
  PullsListCommitsResponseItem,
  PullsListResponseItem,
} from '../types';
import { Approval } from '../approval/collectCommitsForPR';
import {
  aggregateProperties,
  decomposePermissions,
  displayNamesFromLogins,
  flattenMatrix,
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

import { omit, uniq, last, compact } from 'lodash';
import { Commit, PullRequest, Review } from '../client/GraphQLClient/types';

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

export function toPullRequestEntityOld(
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
  repo: RepoEntity,
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

// New Pull Request Stuff
export function toPullRequestEntity(
  pullRequest: PullRequest,
  teamMembersByLogin: IdEntityMap<UserEntity>,
): PullRequestEntity {
  const commits = pullRequest.commits ?? [];
  const reviews = pullRequest.reviews ?? [];

  const approvals = reviews
    .filter(isApprovalReview)
    .reduce(convertToApproval, [])
    .filter(
      (approval) =>
        didNotSelfApprove(approval, commits) &&
        hasTeamMemberApprovals(approval, teamMembersByLogin),
    );

  const approvedCommits =
    getCommitsToDestination(commits, last(approvals)?.commit) ?? [];
  const approvedCommitHashes = approvedCommits.map((c) => c.oid);
  const commitHashes = commits.map((c) => c.oid);
  const commitsNotApproved = commitHashes.filter(
    (c) => !approvedCommitHashes.includes(c),
  );
  const commitsByUnknownAuthor = commits.filter((commit) =>
    fromUnknownAuthor(commit, teamMembersByLogin),
  );

  return createIntegrationEntity({
    entityData: {
      source: pullRequest,
      assign: {
        _type: GITHUB_PR_ENTITY_TYPE,
        _class: [GITHUB_PR_ENTITY_CLASS],
        _key: `${pullRequest.baseRefName}/pull-requests/${pullRequest.number}`,
        displayName: `${pullRequest.baseRefName}/${pullRequest.number}`,
        accountLogin: pullRequest.baseRepository?.owner?.login
          ? pullRequest.baseRepository.owner.login
          : '',
        repository: pullRequest.baseRefName,
        // The number is NOT the id of the Pull Request. Hopefully no one gets bit from that later
        id: pullRequest.number ? String(pullRequest.number) : '',
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
        mergeCommitHash: (pullRequest.mergeCommit as any)?.oid, // TODO: fix this type
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

        source: pullRequest.baseRefName,
        target: pullRequest.headRefName,

        createdOn: parseTimePropertyValue(pullRequest.createdAt),
        updatedOn: parseTimePropertyValue(pullRequest.updatedAt),
        mergedOn: parseTimePropertyValue(pullRequest.mergedAt),

        authorLogin: pullRequest.author?.login ?? '',
        author: pullRequest.author?.name ?? pullRequest.author?.login ?? '',

        reviewerLogins: compact(
          uniq(reviews.map((review) => review.author?.login)),
        ),
        reviewers: compact(uniq(reviews.map((review) => review.author?.name))),
        approverLogins: compact(
          uniq(reviews?.filter(isApprovalReview)?.map((r) => r.author?.login)),
        ),
        approvers: compact(
          uniq(reviews?.filter(isApprovalReview)?.map((r) => r.author?.name)),
        ),
      },
    },
  }) as PullRequestEntity;
}

function isApprovalReview(review: Review) {
  return ['APPROVED', 'DISMISSED'].includes(review.state); // Not sure why dismissed is an approved state tbh
}

function didNotSelfApprove(approval: Approval, commits: Commit[]) {
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

function userOutsideOfTeam(
  login: string | undefined,
  teamMembersByLogin: IdEntityMap<UserEntity>,
) {
  return !login || !teamMembersByLogin[login];
}

function hasTeamMemberApprovals(
  approval: Approval,
  teamMembersByLogin: IdEntityMap<UserEntity>,
) {
  return approval.approverUsernames.some(
    (approver) => teamMembersByLogin[approver],
  );
}

function fromUnknownAuthor(
  commit: Commit,
  teamMembersByLogin: IdEntityMap<UserEntity>,
) {
  return (
    !commit.author ||
    userOutsideOfTeam(commit.author.user?.login, teamMembersByLogin)
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

function commitMatches(commit: string, match: string): boolean {
  // using the length of the proposed match allows for matching shas of
  // different length, so that abcdefghij12345678 matches abcdefghij
  return !!match?.length && commit.slice(0, match.length) === match;
}

export default function getCommitsToDestination(
  commits: Commit[],
  destination: string | undefined,
): Commit[] | undefined {
  if (!destination) {
    return undefined;
  }
  const destinationIndex = commits.findIndex((commit) =>
    commitMatches(commit.oid, destination),
  );
  if (destinationIndex < 0) {
    return [];
  }
  return commits.slice(0, destinationIndex + 1);
}
