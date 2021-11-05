# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to
[Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

## 1.8.3 - 2021-11-05

- Additional GraphQL failure debug logging

## 1.8.2 - 2021-11-05

- Improved error messaging when a non-rate limit error occurs

## 1.8.1 - 2021-11-05

### Fixed

- An error in the error handler for certain GraphQL API failures

## 1.8.0 - 2021-11-04

### Fixed

- When GitHub returns `null` for `hasTwoFactorEnabled` due to permissions
  limitations, `github_user` property `mfaEnabled` will now be set to
  `undefined` instead of `false`
- When a step takes more than an hour to complete, the GraphQL client can now
  request a new API token on the fly without losing track of where it was

## 1.7.3 - 2021-10-27

### Changed

- Better error handling, including support for when GitHub rate-limiting errors
  are provided with non-error (200) codes.

## 1.7.1 - 2021-10-21

### Added

- Property `id` to `github_member` entities

### Changed

- Always throw an `IntegrationError` when repository environment secrets can not
  be ingested.
- Separated out `fetch-env-secrets` step from the `fetch-environments` step

### Fixed

- Changed incorrectly spelled `github_app` property `respositorySelected` to
  `repositorySelected`

## 1.7.0 - 2021-10-18

### Added

- Properties `forkingAllowed` and `forkCount` to RepoEntity

## 1.6.3 - 2021-10-18

### Changed

- Only retry graphQL errors 5 times instead of 10.
- Only query for the limit of `github_pull_request`s and `github_issue`s instead
  of the limit +1.
- Request fewer repositiories in a single calls in the `fetch-teams` step.
- Request fewer repositories and collaborators in a single call in the
  `fetch-collaborators`.
- Format graphQL errors even better.
- Do not throw an `IntegrationError` when the integration does not have access
  to environment secrets.
- Add a JobLog item when environment secrets could not be ingested due to a
  `403` error.

## 1.6.2 - 2021-10-15

## Fixed

- Log graphQL errors properly.

## 1.6.1 - 2021-10-15

- Increase `github_pull_request` limit from 100 to 500.

## 1.6.0 - 2021-10-15

### Fixed

- Crash on fetch-environments for private repos in accounts that are not
  Enterprise level

### Added

- Added support for ingesting labels on PullRequests
- Added support for ingesting the following **new** entity:

| Resources    | Entity `_type` | Entity `_class` |
| ------------ | -------------- | --------------- |
| GitHub Issue | `github_issue` | `Issue`         |

- Added support for ingesting the following **new** relationships:

| Source Entity `_type` | Relationship `_class` | Target Entity `_type` |
| --------------------- | --------------------- | --------------------- |
| `github_repo`         | **HAS**               | `github_issue`        |
| `github_user`         | **CREATED**           | `github_issue`        |
| `github_user`         | **ASSIGNED**          | `github_issue`        |

### Changed

- Migrated fetch-collaborators to GraphQL instead of REST for improved
  performance
- Removed redundant property API calls in several GraphQL queries

## 1.5.1 - 2021-10-06

### Changed

- All new boolean properties added in v1.5.0 that included `is` to no longer
  include `is`. Ex: `isLocked` became `locked`.

## 1.5.0 - 2021-09-28

### Added

- Added support for ingesting the following **new** entities:

| Resources          | Entity `_type`       | Entity `_class` |
| ------------------ | -------------------- | --------------- |
| GitHub Environment | `github_environment` | `Configuration` |
| GitHub Env Secret  | `github_env_secret`  | `Secret`        |

- Added support for ingesting the following **new** relationships:

| Source Entity `_type` | Relationship `_class` | Target Entity `_type` |
| --------------------- | --------------------- | --------------------- |
| `github_repo`         | **HAS**               | `github_environment`  |
| `github_environment`  | **HAS**               | `github_env_secret`   |
| `github_env_secret`   | **OVERRIDES**         | `github_org_secret`   |
| `github_env_secret`   | **OVERRIDES**         | `github_repo_secret`  |
| `github_repo`         | **USES**              | `github_env_secret`   |

- Extra 9 properties to `github_account` (`createdOn`, `updatedOn`,
  `description`, `email`, `node`, `databaseId`, `verified`, `location`,
  `websiteUrl`, `webLink`)
- Extra 6 properites to `github_team` (`createdOn`, `updatedOn`, `databaseId`,
  `description`, `node`, `privacy`)
- Extra 8 properties to `github_user` (`company`, `createdOn`, `updatedOn`,
  `databaseId`, `node`, `employee`, `location`, `websiteUrl`, `email`)
- Extra 19 properties to `github_repo` (`autoMergeAllowed`, `databaseId`,
  `deleteBranchOnMerge`, `description`, `homepageUrl`, `node`, `disabled`,
  `empty`, `fork`, `inOrganization`, `locked`, `mirror`,
  `securityPolicyEnabled`, `template`, `userConfigurationRepository`,
  `lockReason`, `mergeCommitAllowed`, `pushedOn`, `rebaseMergeAllowed`)
- Extra 5 properties to `github_pullrequest` (`databaseId`, `node`,
  `commitsCount`, `approvalsCount`, `approvalLastAt`)
- Pull requests Opened, Reviewed, or Approved by a user who is not part of the
  current organization or collaborator list now have a mapped relationship to a
  GitHub user with the login recorded in the PR properties.

### Changed

- `createdOn` and `updatedOn` properties for `github_org_secret`,
  `github_repo_secret`, and `github_app` are now time-since-epoch integers
  instead of strings, matching other entities.
- Steps that do not have enough token scope permission are now disabled instead
  of throwing errors.

## 1.4.5 - 2021-09-16

### Fixed

- Prevent error for when the head repository could not be determined for a pull
  request.

### Changed

- To query 25 pull requests at a time instead of 50 to prevent Github errors.

### Added

- Retry plugin to Octokit, which automatically retries upto 3 times for server
  4xx/5xx responses except 400, 401, 403 and 404.

## 1.4.4 - 2021-09-14

### Fixed

- Issue where collaborators step could fail when one repo has special
  permissions settings that prevent access to collaborators.
- Do not throw on 404 errors when fetching pull requests.
- Omit `members` and `repos` properties from the raw data of `github_team`
  entities.

## 1.4.3 - 2021-09-14

### Fixed

- Properly log graphQL errors.

## 1.4.2 - 2021-09-14

### Added

- Error logging to "Fetch Pull Requests" step.

## 1.4.1 - 2021-09-14

### Fixed

- Issue where changing data during the integration run could cause duplicate key
  errors and failure of some steps.
- Issue where fallback to the REST API for certain accounts could cause Repo
  ALLOWS Team relationships to only appear for one team.

## 1.4.0 - 2021-09-14

### Changed

- `github_pull_request` ingestion to use octokit v4 graphQL instead of the v3
  rest api.
- Commit analysis to be done on every `github_pull_request` regardless of if the
  `analyzeCommitApproval` config variable is set or not.

### Removed

- `analyzeCommitApproval` config variable.

### Added

- Retrying "Secondary Rate Limit" errors on graphQL queries.
- Better logging of graphQL queries.
- Added support for ingesting the following **new** entities:

| Resources          | Entity `_type`       | Entity `_class` |
| ------------------ | -------------------- | --------------- |
| GitHub Org Secret  | `github_org_secret`  | `Secret`        |
| GitHub Repo Secret | `github_repo_secret` | `Secret`        |

- Added support for ingesting the following **new** relationships:

| Source Entity `_type` | Relationship `_class` | Target Entity `_type` |
| --------------------- | --------------------- | --------------------- |
| `github_account`      | **HAS**               | `github_org_secret`   |
| `github_repo`         | **HAS**               | `github_repo_secret`  |
| `github_repo_secret`  | **OVERRIDES**         | `github_org_secret`   |
| `github_repo`         | **USES**              | `github_org_secret`   |
| `github_repo`         | **USES**              | `github_repo_secret`  |

### Fixed

- Remove `suspendedBy` property from `github_app` entity. The `suspendedBy`
  property is type `object`, which is not a supported entity property value
  type.

## 1.3.0 - 2021-08-27

### Added

- Properties added to graph objects:

  | Entity / Relationship     | Property                      | Notes               |
  | ------------------------- | ----------------------------- | ------------------- | ------- | ---------- | -------- | --- |
  | `github_repo_allows_team` | `adminPermission: boolean`    |                     |
  | `github_repo_allows_team` | `maintainPermission: boolean` |                     |
  | `github_repo_allows_team` | `pushPermission: boolean`     |                     |
  | `github_repo_allows_team` | `triagePermission: boolean`   |                     |
  | `github_repo_allows_team` | `pullPermission: boolean`     |                     |
  | `github_repo_allows_user` | `role: 'READ'                 | 'TRIAGE'            | 'WRITE' | 'MAINTAIN' | 'ADMIN'` |     |
  | `github_user`             | `webLink: string`             | GitHub user profile |

- Properties changed on graph objects:

  | Entity / Relationship     | Old                   | New            | Notes           |
  | ------------------------- | --------------------- | -------------- | --------------- |
  | `github_repo_allows_team` | `permissions: string` | `role: string` | Match GitHub UI |

## 1.2.3 - 2021-08-23

### Changed

- Role property for outside collaborators is now 'OUTSIDE'

## 1.2.0 - 2021-08-19

### Added

- Added support for ingesting the following **new** entities:

  | Entity                            |
  | --------------------------------- |
  | `github_app`                      |
  | `github_user` (`role: 'OUTSIDE'`) |

- Added support for ingesting the following **new** relationships:

  | Source           | class         | Target        |
  | ---------------- | ------------- | ------------- |
  | `github_account` | **INSTALLED** | `github_app`  |
  | `github_repo`    | **ALLOWS**    | `github_user` |

### Changed

- Changed relationship `github_team_allows_repo` to `github_repo_allows_team`,
  and added `permissions` property ('READ' | 'TRIAGE' | 'WRITE' | 'MAINTAIN' |
  'ADMIN')

### Fixed

- Removed incorrect relationship listing in documentation.

## 1.1.0 - 2021-07-26

### Added

- New properties on `github_pull_request`
  - `mergedOn`
  - `mergeCommitHash`

## 1.0.1 - 2021-07-23

### Removed

- `head` and `base` properties from `github_pull_request` entities' rawData.

### Fixed

- TypeError in `getCommitsToDestination` when a commit does not exist.

## 1.0.0 - 2021-07-09

### Added

- new optional config variable `useRestForTeamRepos` that can is sometimes
  needed to get around a GitHub error when fetching team repos via GraphQL.

### Changed

- octokit packages to be dependencies instead of peer dependencies.
- Integration now uses the `@jupiterone/integration-sdk-core`
- [JupiterOne/integrations#5](https://github.com/JupiterOne/integrations/issues/5)
  Use `name || login` for `displayName` of `Account` and `User` entities.

### Fixes

- Duplicate key bug in `github_user` **APPROVED** `github_pullrequest`
  relationships.
