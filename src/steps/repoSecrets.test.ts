jest.setTimeout(40000);

import {
  Recording,
  executeStepWithDependencies,
} from '@jupiterone/integration-sdk-testing';
import { buildStepTestConfig } from '../../test/config';
import { setupGithubRecording } from '../../test/recording';
import { Steps } from '../constants';

let recording: Recording;
afterEach(async () => {
  await recording.stop();
});

test('fetchRepoSecrets exec handler', async () => {
  recording = setupGithubRecording({
    directory: __dirname,
    name: 'repoSecrets',
  });

  const stepConfig = buildStepTestConfig(Steps.FETCH_REPO_SECRETS);
  const stepResults = await executeStepWithDependencies(stepConfig);

  expect(stepResults).toMatchStepMetadata(stepConfig);
});
