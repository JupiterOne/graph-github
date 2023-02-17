import { integrationConfig } from './config';
import { APIClient } from '../src/client';
import { IntegrationLogger } from '@jupiterone/integration-sdk-core';
import { sanitizeConfig } from '../src/config';
const logger = {
  debug: (m) => console.debug(m),
  info: (m) => console.info(m),
  warn: (m) => console.warn(m),
};

// Must be set in .env with other values
// REPO_WITH_SECRETS=reimagined-barnacle
// REPO_WITH_VULNS=intentionally-vulnerable-golang-project
// REPO_ID_WITH_ENV_SECRET=reimagined-barnacle
// ENV_NAME=dev

(async () => {
  sanitizeConfig(integrationConfig);
  // console.log(process.env);
  const client = new APIClient(integrationConfig, logger as IntegrationLogger);
  await client.verifyAuthentication();

  // https://docs.github.com/en/enterprise-server@3.4/rest/actions/secrets#list-organization-secrets
  // curl \
  //   -H "Accept: application/vnd.github+json" \
  //   -H "Authorization: Bearer <YOUR-TOKEN>" \
  //   http(s)://HOSTNAME/api/v3/orgs/ORG/actions/secrets
  const orgSec = await client.graphQLClient.getOrganizationSecrets();
  console.log('Org Secrets', orgSec);

  // https://docs.github.com/en/enterprise-server@3.4/rest/actions/secrets#list-repository-secrets
  // curl \
  //   -H "Accept: application/vnd.github+json" \
  //   -H "Authorization: Bearer <YOUR-TOKEN>" \
  //   http(s)://HOSTNAME/api/v3/repos/OWNER/REPO/actions/secrets
  const repoSecrets = await client.graphQLClient.getRepoSecrets(
    process.env.REPO_WITH_SECRETS!,
  );
  console.log('Repo Secrets', repoSecrets);

  // https://docs.github.com/en/enterprise-server@3.4/rest/actions/secrets#list-environment-secrets
  // curl \
  //   -H "Accept: application/vnd.github+json" \
  //   -H "Authorization: Bearer <YOUR-TOKEN>" \
  //   http(s)://HOSTNAME/api/v3/repositories/REPOSITORY_ID/environments/ENVIRONMENT_NAME/secrets

  // const envSecrets = await client.graphQLClient.getEnvSecrets(
  //   process.env.REPO_ID_WITH_ENV_SECRET!,
  //   process.env.ENV_NAME!,
  //   ''
  // )
  // console.log('Env Secrets', envSecrets)

  await client.graphQLClient.iterateRepoVulnAlerts(
    process.env.REPO_WITH_VULNS!,
    (vuln) => console.log('Vuln', vuln),
    { states: [], severities: [] },
    '3.4.11',
  );
})();
