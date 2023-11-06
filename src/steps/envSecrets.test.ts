import {
  Recording,
  executeStepWithDependencies,
} from '@jupiterone/integration-sdk-testing';
import { buildStepTestConfig } from '../../test/config';
import { setupGithubRecording } from '../../test/recording';
import { Steps } from '../constants';

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

  const stepConfig = buildStepTestConfig(Steps.FETCH_ENV_SECRETS);
  const stepResults = await executeStepWithDependencies(stepConfig);

  expect(stepResults).toMatchStepMetadata(stepConfig);
});
