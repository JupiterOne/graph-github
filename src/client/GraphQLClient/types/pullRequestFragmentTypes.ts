import { PullRequestResource } from './client';

export type PullRequestUser = {
  login: string;
  name?: string;
  isSiteAdmin: string;
};

export type Commit = {
  id: string;
  message: string;
  authoredDate: string;
  changedFiles: number;
  commitUrl: string;
  author: {
    date?: string;
    user?: PullRequestUser;
  };
};

export type Label = {
  id: string;
  name: string;
};

export type Review = {
  id: string;
  author?: PullRequestUser;
  state:
    | 'PENDING'
    | 'COMMENTED'
    | 'APPROVED'
    | 'CHANGES_REQUESTED'
    | 'DISMISSED';
  submittedAt?: string;
  updatedAt: string;
  url: string;
};

export type PullRequest = {
  additions: number;
  author?: PullRequestUser;
  authorAssociation: string;
  baseRefName: string;
  baseRefOid: string;
  baseRepository?: {
    id: string;
    name: string;
  };
  body: string;
  changedFiles: number;
  checksUrl: string;
  closed: boolean;
  closedAt?: string;
  createdAt: string;
  deletions: number;
  editor: PullRequestUser;
  headRefName: string;
  headRefOid: string;
  headRepository?: {
    name: string;
    owner: PullRequestUser;
  };
  isDraft: boolean;
  lastEditedAt?: string;
  locked: string;
  mergeCommit?: Commit;
  mergeable: 'MERGEABLE' | 'CONFLICTING' | 'UNKNOWN';
  merged: boolean;
  mergedAt?: string;
  mergedBy?: PullRequestUser;
  number: number;
  permalink: string;
  publishedAt?: string;
  reviewDecision?: 'CHANGES_REQUESTED' | 'APPROVED' | 'REVIEW_REQUIRED';
  state: 'OPEN' | 'CLOSED' | 'MERGED';
  title: string;
  updatedAt: string;
  url: string;
  // Optional extra traversals
  commits?: Commit[];
  labels?: Label[];
  reviews?: Review[];
};

interface PullRequestResources {
  [PullRequestResource.PullRequests]: PullRequest[];
  [PullRequestResource.Commits]: Commit[];
  [PullRequestResource.Labels]: Label[];
  [PullRequestResource.Reviews]: Review[];
}

export type PullRequestQueryResponse = {
  rateLimitConsumed: number;
} & Partial<PullRequestResources>;
