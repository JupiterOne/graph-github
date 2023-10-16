import { Recording } from '@jupiterone/integration-sdk-testing';
import { sanitizeConfig } from '../config';
import { repoSecretSteps } from './repoSecrets';
import { integrationConfig } from '../../test/config';
import { setupGithubRecording } from '../../test/recording';
import {
  GithubEntities,
  GITHUB_REPO_SECRET_ENTITIES_BY_REPO_NAME_MAP,
  Relationships,
} from '../constants';
import { invocationConfig } from '..';
import { executeStepWithDependencies } from '../../test/executeStepWithDependencies';

jest.setTimeout(30000);

let recording: Recording;
afterEach(async () => {
  await recording.stop();
});

test('fetchRepoSecrets exec handler', async () => {
  recording = setupGithubRecording({
    directory: __dirname,
    name: 'repoSecrets',
  });
  sanitizeConfig(integrationConfig);

  const {
    collectedEntities,
    collectedRelationships,
    encounteredTypes,
    jobState,
  } = await executeStepWithDependencies({
    stepId: repoSecretSteps[0].id,
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

  const repoSecrets = collectedEntities.filter(
    (e) => e._type === GithubEntities.GITHUB_REPO_SECRET._type,
  );
  expect(repoSecrets.length).toBeGreaterThan(0);
  expect(repoSecrets).toMatchGraphObjectSchema(
    GithubEntities.GITHUB_REPO_SECRET,
  );

  // relationships
  const repoHasRepoSecretRels = collectedRelationships.filter(
    (e) => e._type === Relationships.REPO_HAS_SECRET._type,
  );
  expect(repoHasRepoSecretRels.length).toBeGreaterThan(0);

  const repoUsesRepoSecretRels = collectedRelationships.filter(
    (e) => e._type === Relationships.REPO_USES_SECRET._type,
  );
  expect(repoUsesRepoSecretRels.length).toBeGreaterThan(0);

  const repoUsesOrgSecretRels = collectedRelationships.filter(
    (e) => e._type === Relationships.REPO_SECRET_OVERRIDES_ORG_SECRET._type,
  );
  expect(repoUsesOrgSecretRels.length).toBeGreaterThan(0);

  // ensure that we are setting the GITHUB_REPO_SECRET_ENTITIES_BY_REPO_NAME_MAP in the jobState as expected
  const repoSecretEntitiesByRepoNameMap = await jobState.getData(
    GITHUB_REPO_SECRET_ENTITIES_BY_REPO_NAME_MAP,
  );
  expect(repoSecretEntitiesByRepoNameMap).toBeTruthy();
});
