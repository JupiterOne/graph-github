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

test('fetchApps exec handler', async () => {
  recording = setupGithubRecording({
    directory: __dirname,
    name: 'apps',
  });
  const stepConfig = buildStepTestConfig(Steps.FETCH_APPS);
  const stepResults = await executeStepWithDependencies(stepConfig);

  expect(stepResults).toMatchStepMetadata(stepConfig);
  expect(stepResults).toMatchSnapshot();
});
