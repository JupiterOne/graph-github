# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to
[Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

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
