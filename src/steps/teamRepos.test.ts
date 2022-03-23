import { Recording } from '@jupiterone/integration-sdk-testing';
import { sanitizeConfig } from '../config';
import { teamRepoSteps } from './teamRepos';
import { integrationConfig } from '../../test/config';
import { setupGithubRecording } from '../../test/recording';
import { GITHUB_REPO_TEAM_RELATIONSHIP_TYPE } from '../constants';
import { invocationConfig } from '..';
import { executeStepWithDependencies } from '../../test/executeStepWithDependencies';

jest.setTimeout(20000);

let recording: Recording;
afterEach(async () => {
  await recording.stop();
});

test('fetchTeamRepos exec handler', async () => {
  recording = setupGithubRecording({
    directory: __dirname,
    name: 'teamRepos',
  });
  sanitizeConfig(integrationConfig);

  const { collectedEntities, collectedRelationships, encounteredTypes } =
    await executeStepWithDependencies({
      stepId: teamRepoSteps[0].id,
      invocationConfig: invocationConfig as any,
      instanceConfig: integrationConfig,
    });

  expect({
    numCollectedEntities: collectedEntities.length,
    numCollectedRelationships: collectedRelationships.length,
    collectedEntities: collectedEntities,
    collectedRelationships: collectedRelationships,
    encounteredTypes: encounteredTypes,
  }).toMatchSnapshot();

  // this step only makes relationships
  const repoAllowsTeamRels = collectedRelationships.filter(
    (e) => e._type === GITHUB_REPO_TEAM_RELATIONSHIP_TYPE,
  );
  expect(repoAllowsTeamRels.length).toBeGreaterThan(0);
});
