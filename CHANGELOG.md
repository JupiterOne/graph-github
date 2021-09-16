# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to
[Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Fixed

- Prevent error for when the head repository could not be determined for a pull
  request.

### Changed

- To query 25 pull requests at a time insteaad of 50 to prevent Github errors.

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

  | Entity / Relationship     | Property                                                   | Notes               |
  | ------------------------- | ---------------------------------------------------------- | ------------------- |
  | `github_repo_allows_team` | `adminPermission: boolean`                                 |                     |
  | `github_repo_allows_team` | `maintainPermission: boolean`                              |                     |
  | `github_repo_allows_team` | `pushPermission: boolean`                                  |                     |
  | `github_repo_allows_team` | `triagePermission: boolean`                                |                     |
  | `github_repo_allows_team` | `pullPermission: boolean`                                  |                     |
  | `github_repo_allows_user` | `role: 'READ' | 'TRIAGE' | 'WRITE' | 'MAINTAIN' | 'ADMIN'` |                     |
  | `github_user`             | `webLink: string`                                          | GitHub user profile |

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
