// @jest-environment node

jest.setTimeout(150000);

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

test('fetchCollaborators exec handler', async () => {
  recording = setupGithubRecording({
    directory: __dirname,
    name: 'collaborators',
  });

  const stepConfig = buildStepTestConfig(Steps.FETCH_COLLABORATORS);
  const stepResults = await executeStepWithDependencies(stepConfig);

  expect(stepResults).toMatchStepMetadata(stepConfig);
});
