jest.setTimeout(20000);

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

test('fetchCodeScanningAlerts exec handler', async () => {
  recording = setupGithubRecording({
    directory: __dirname,
    name: 'codeScanningAlerts',
  });
  const stepConfig = buildStepTestConfig(Steps.FETCH_CODE_SCANNING_ALERTS);
  const stepResults = await executeStepWithDependencies(stepConfig);

  expect(stepResults).toMatchStepMetadata(stepConfig);
});
