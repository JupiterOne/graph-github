import { Recording } from '@jupiterone/integration-sdk-testing';
import { buildStepTestConfig } from '../../test/config';
import { setupGithubRecording } from '../../test/recording';
import { Steps } from '../constants';
import { executeStepWithDependencies } from '../../test/executeStepWithDependencies';
import { IntegrationConfig, sanitizeConfig } from '../config';

jest.setTimeout(20000);

let recording: Recording;
afterEach(async () => {
  if (recording) {
    await recording.stop();
  }
});

describe('fetch-tags', () => {
  test('success', async () => {
    recording = setupGithubRecording({
      name: 'fetch-tags',
      directory: __dirname,
    });

    const stepConfig = buildStepTestConfig(Steps.FETCH_TAGS);
    sanitizeConfig(stepConfig.instanceConfig as IntegrationConfig);
    const stepResults = await executeStepWithDependencies(stepConfig);
    expect(stepResults).toMatchStepMetadata(stepConfig);
  });
});
