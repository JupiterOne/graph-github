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

// Skipped because we don't have scanning alerts on our test org
test.skip('fetchCodeScanningAlerts exec handler', async () => {
  recording = setupGithubRecording({
    directory: __dirname,
    name: 'codeScanningAlerts',
  });
  const stepConfig = buildStepTestConfig(Steps.FETCH_CODE_SCANNING_ALERTS);
  const stepResults = await executeStepWithDependencies(stepConfig);

  expect(stepResults).toMatchStepMetadata(stepConfig);
});
