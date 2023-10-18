jest.setTimeout(13000);

import { Steps } from '../constants';
import {
  Recording,
  executeStepWithDependencies,
} from '@jupiterone/integration-sdk-testing';
import { setupGithubRecording } from '../../test/recording';
import { buildStepTestConfig } from '../../test/config';

let recording: Recording;

afterEach(async () => {
  if (recording) {
    await recording.stop();
  }
});

describe(Steps.FETCH_SECRET_SCANNING_ALERTS, () => {
  test('success', async () => {
    recording = setupGithubRecording({
      name: Steps.FETCH_SECRET_SCANNING_ALERTS,
      directory: __dirname,
    });

    const stepConfig = buildStepTestConfig(Steps.FETCH_SECRET_SCANNING_ALERTS);
    const stepResults = await executeStepWithDependencies(stepConfig);
    expect(stepResults).toMatchStepMetadata(stepConfig);
  });
});
