import { Recording } from '@jupiterone/integration-sdk-testing';
import { sanitizeConfig } from '../config';
import { orgSecretSteps } from './orgSecrets';
import { integrationConfig } from '../../test/config';
import { setupGithubRecording } from '../../test/recording';
import {
  GithubEntities,
  GITHUB_ACCOUNT_SECRET_RELATIONSHIP_TYPE,
  GITHUB_REPO_ORG_SECRET_RELATIONSHIP_TYPE,
} from '../constants';
import { invocationConfig } from '..';
import { executeStepWithDependencies } from '../../test/executeStepWithDependencies';

jest.setTimeout(20000);

let recording: Recording;
afterEach(async () => {
  await recording.stop();
});

test('fetchOrgSecrets exec handler', async () => {
  recording = setupGithubRecording({
    directory: __dirname,
    name: 'orgSecrets',
  });
  sanitizeConfig(integrationConfig);

  const { collectedEntities, collectedRelationships, encounteredTypes } =
    await executeStepWithDependencies({
      stepId: orgSecretSteps[0].id,
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

  const orgSecrets = collectedEntities.filter(
    (e) => e._type === GithubEntities.GITHUB_ORG_SECRET._type,
  );
  expect(orgSecrets.length).toBeGreaterThan(0);
  expect(orgSecrets).toMatchGraphObjectSchema(GithubEntities.GITHUB_ORG_SECRET);

  // relationships
  const accountHasOrgSecretRels = collectedRelationships.filter(
    (e) => e._type === GITHUB_ACCOUNT_SECRET_RELATIONSHIP_TYPE,
  );
  expect(accountHasOrgSecretRels.length).toBeGreaterThan(0);

  const repoUsesOrgSecretRels = collectedRelationships.filter(
    (e) => e._type === GITHUB_REPO_ORG_SECRET_RELATIONSHIP_TYPE,
  );
  expect(repoUsesOrgSecretRels.length).toBeGreaterThan(0);
});
