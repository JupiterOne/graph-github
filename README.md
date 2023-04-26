# JupiterOne Integration

Learn about the data ingested, benefits of this integration, and how to use it
with JupiterOne in the [integration documentation](docs/jupiterone.md).

## Development

### Prerequisites

1. Install [Node.js](https://nodejs.org/) using the
   [installer](https://nodejs.org/en/download/) or a version manager such as
   [nvm](https://github.com/nvm-sh/nvm) or [fnm](https://github.com/Schniz/fnm).
2. Install [``](https://yarnpkg.com/getting-started/install) or
   [`npm`](https://github.com/npm/cli#installation) to install dependencies.
3. Install dependencies with `npm install`.
4. Register an account in the system this integration targets for ingestion and
   obtain API credentials.
5. `cp .env.example .env` and add necessary values for runtime configuration.

   When an integration executes, it needs API credentials and any other
   configuration parameters necessary for fetching data from the provider. The
   names of these parameters are defined in `src/instanceConfigFields.ts`. When
   executed in a development environment, values for these parameters are read
   from Node's `process.env`, loaded from `.env`. That file has been added to
   `.gitignore` to avoid committing credentials.

### Running the integration

1. `npm start` to collect data
2. `npm run graph` to show a visualization of the collected data
3. `npm run j1-integration -h` for additional commands

### Making Contributions

Start by taking a look at the source code. The integration is basically a set of
functions called steps, each of which ingests a collection of resources and
relationships. The goal is to limit each step to as few resource types as
possible so that should the ingestion of one type of data fail, it does not
necessarily prevent the ingestion of other, unrelated data. That should be
enough information to allow you to get started coding!

See the
[SDK development documentation](https://github.com/JupiterOne/sdk/blob/main/docs/integrations/development.md)
for a deep dive into the mechanics of how integrations work.

See [docs/development.md](docs/development.md) for any additional details about
developing this integration.

### Changelog

The history of this integration's development can be viewed at
[CHANGELOG.md](CHANGELOG.md).

## Versioning this project

This project is versioned using [auto](https://intuit.github.io/auto/).

Versioning and publishing to NPM are now handled via adding GitHub labels to
pull requests. The following labels should be used for this process:

- patch
- minor
- major
- release

For each pull request, the degree of change should be registered by applying the
appropriate label of patch, minor, or major. This allows the repository to keep
track of the highest degree of change since the last release. When ready to
publish to NPM, the PR should have both its appropriate patch, minor, or major
label applied as well as a release label. The release label will denote to the
system that we need to publish to NPM and will correctly version based on the
highest degree of change since the last release, package the project, and
publish it to NPM.

In order to successfully version and publish to NPM we need access to two
secrets: a valid NPM token for publishing and a GitHub token for querying the
repo and pushing version changes. For JupiterOne projects please put in a ticket
with security to have the repository correctly granted access. For external
projects, please provide secrets with access to your own NPM and GitHub
accounts. The secret names should be set to NPM_AUTH_TOKEN and
AUTO_GITHUB_PAT_TOKEN respectively (or the action can be updated to accomodate
different naming conventions).

We are not currently using the functionality for auto to update the CHANGELOG.
As such, please remember to update CHANGELOG.md with the appropriate version,
date, and changes.
