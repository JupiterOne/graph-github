jest.setTimeout(30000);

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

test('fetchTeams exec handler', async () => {
  recording = setupGithubRecording({
    directory: __dirname,
    name: 'teams',
  });

  const stepConfig = buildStepTestConfig(Steps.FETCH_TEAMS);
  const stepResults = await executeStepWithDependencies(stepConfig);

  expect(stepResults).toMatchStepMetadata(stepConfig);
  expect(stepResults).toMatchSnapshot();
});
