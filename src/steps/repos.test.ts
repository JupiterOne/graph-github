import { Recording } from '@jupiterone/integration-sdk-testing';
import { sanitizeConfig } from '../config';
import { repoSteps } from './repos';
import { integrationConfig } from '../../test/config';
import { setupGithubRecording } from '../../test/recording';
import {
  GithubEntities,
  GITHUB_ACCOUNT_REPO_RELATIONSHIP_TYPE,
  GITHUB_REPO_TAGS_ARRAY,
} from '../constants';
import { invocationConfig } from '..';
import { executeStepWithDependencies } from '../../test/executeStepWithDependencies';

jest.setTimeout(20000);

let recording: Recording;
afterEach(async () => {
  await recording.stop();
});

test('fetchRepos exec handler', async () => {
  recording = setupGithubRecording({
    directory: __dirname,
    name: 'repos',
  });
  sanitizeConfig(integrationConfig);

  const {
    collectedEntities,
    collectedRelationships,
    encounteredTypes,
    jobState,
  } = await executeStepWithDependencies({
    stepId: repoSteps[0].id,
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

  const repos = collectedEntities.filter(
    (e) => e._type === GithubEntities.GITHUB_REPO._type,
  );
  expect(repos.length).toBeGreaterThan(0);
  expect(repos).toMatchGraphObjectSchema(GithubEntities.GITHUB_REPO);

  // relationships
  const accountHasRepoRels = collectedRelationships.filter(
    (e) => e._type === GITHUB_ACCOUNT_REPO_RELATIONSHIP_TYPE,
  );
  expect(accountHasRepoRels.length).toBeGreaterThan(0);

  // ensure that we are setting the REPO_TAGS_ARRAY in the jobState as expected
  const repoTags = await jobState.getData(GITHUB_REPO_TAGS_ARRAY);
  expect(repoTags).toBeTruthy();
});
