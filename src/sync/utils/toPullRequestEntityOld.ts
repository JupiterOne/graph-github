import {
  parseTimePropertyValue,
  setRawData,
} from '@jupiterone/integration-sdk-core';
import { omit, uniq } from 'lodash';
import { GITHUB_PR_ENTITY_TYPE, GITHUB_PR_ENTITY_CLASS } from '../../constants';
import {
  PullsListResponseItem,
  PullsListCommitsResponseItem,
  IdEntityMap,
  UserEntity,
  PullRequestEntity,
} from '../../types';
import {
  flattenMatrix,
  aggregateProperties,
  displayNamesFromLogins,
} from '../../util/propertyHelpers';
import { Approval } from '../converters';

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
    open: data.state === 'open',
    mergeCommitHash: data.merge_commit_sha,
    merged: (data.merged_at as any) !== null,
    declined: data.state === 'closed' && (data.merged_at as any) === null,
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
