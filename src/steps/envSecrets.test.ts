import { Recording } from '@jupiterone/integration-sdk-testing';
import { sanitizeConfig } from '../config';
import { envSecretSteps } from './envSecrets';
import { integrationConfig } from '../../test/config';
import { setupGithubRecording } from '../../test/recording';
import { GithubEntities, Relationships } from '../constants';
import { invocationConfig } from '..';
import { executeStepWithDependencies } from '../../test/executeStepWithDependencies';

jest.setTimeout(30000);

let recording: Recording;
afterEach(async () => {
  await recording.stop();
});

test('fetchEnvSecrets exec handler', async () => {
  recording = setupGithubRecording({
    directory: __dirname,
    name: 'envSecrets',
  });
  sanitizeConfig(integrationConfig);

  const { collectedEntities, collectedRelationships, encounteredTypes } =
    await executeStepWithDependencies({
      stepId: envSecretSteps[0].id,
      invocationConfig: invocationConfig as any,
      instanceConfig: integrationConfig,
    });

  expect({
    numCollectedEntities: collectedEntities.length,
    numCollectedRelationships: collectedRelationships.length,
    collectedEntities: collectedEntities,
    collectedRelationships: collectedRelationships,
    encounteredTypes: encounteredTypes,
  }).toMatchSnapshot();

  const envSecrets = collectedEntities.filter(
    (e) => e._type === GithubEntities.GITHUB_ENV_SECRET._type,
  );
  expect(envSecrets.length).toBeGreaterThan(0);
  expect(envSecrets).toMatchGraphObjectSchema(GithubEntities.GITHUB_ENV_SECRET);

  // relationships
  const environmentHasEnvSecretRels = collectedRelationships.filter(
    (e) => e._type === Relationships.ENVIRONMENT_HAS_ENV_SECRET._type,
  );
  expect(environmentHasEnvSecretRels.length).toBeGreaterThan(0);

  const repoUsesEnvSecretRels = collectedRelationships.filter(
    (e) => e._type === Relationships.REPO_USES_ENV_SECRET._type,
  );
  expect(repoUsesEnvSecretRels.length).toBeGreaterThan(0);

  const envSecretOverridesOrgSecretRels = collectedRelationships.filter(
    (e) => e._type === Relationships.ENV_SECRET_OVERRIDES_ORG_SECRET._type,
  );
  expect(envSecretOverridesOrgSecretRels.length).toBeGreaterThan(0);

  const envSecretOverridesRepoSecretRels = collectedRelationships.filter(
    (e) => e._type === Relationships.ENV_SECRET_OVERRIDES_REPO_SECRET._type,
  );
  expect(envSecretOverridesRepoSecretRels.length).toBeGreaterThan(0);
});
