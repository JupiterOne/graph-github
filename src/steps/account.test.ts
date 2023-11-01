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

test('fetchAccountDetails exec handler', async () => {
  recording = setupGithubRecording({
    directory: __dirname,
    name: 'account',
  });

  const stepConfig = buildStepTestConfig(Steps.FETCH_ACCOUNT);
  const stepResults = await executeStepWithDependencies(stepConfig);

  expect(stepResults).toMatchStepMetadata(stepConfig);
  expect(stepResults).toMatchSnapshot();
});
