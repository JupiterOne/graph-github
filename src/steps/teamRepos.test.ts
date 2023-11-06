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

test('fetchTeamRepos exec handler', async () => {
  recording = setupGithubRecording({
    directory: __dirname,
    name: 'teamRepos',
  });
  const stepConfig = buildStepTestConfig(Steps.FETCH_TEAM_REPOS);
  const stepResults = await executeStepWithDependencies(stepConfig);

  expect(stepResults).toMatchStepMetadata(stepConfig);
});
