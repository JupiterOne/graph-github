import {
  Recording,
  executeStepWithDependencies,
} from '@jupiterone/integration-sdk-testing';
import { buildStepTestConfig } from '../../test/config';
import { setupGithubRecording } from '../../test/recording';
import { Steps } from '../constants';

jest.setTimeout(20000);

let recording: Recording;
afterEach(async () => {
  await recording.stop();
});

test('fetchEnvironments exec handler', async () => {
  recording = setupGithubRecording({
    directory: __dirname,
    name: 'environments',
  });

  const stepConfig = buildStepTestConfig(Steps.FETCH_ENVIRONMENTS);
  const stepResults = await executeStepWithDependencies(stepConfig);

  expect(stepResults).toMatchStepMetadata(stepConfig);
  expect(stepResults).toMatchSnapshot();
});
