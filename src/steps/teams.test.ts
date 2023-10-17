import { Recording } from '@jupiterone/integration-sdk-testing';
import { sanitizeConfig } from '../config';
import { teamSteps } from './teams';
import { integrationConfig } from '../../test/config';
import { setupGithubRecording } from '../../test/recording';
import { GithubEntities, Relationships } from '../constants';
import { invocationConfig } from '..';
import { executeStepWithDependencies } from '../../test/executeStepWithDependencies';

jest.setTimeout(30000);

let recording: Recording;
afterEach(async () => {
  await recording.stop();
});

test('fetchTeams exec handler', async () => {
  recording = setupGithubRecording({
    directory: __dirname,
    name: 'teams',
  });
  sanitizeConfig(integrationConfig);

  const { collectedEntities, collectedRelationships, encounteredTypes } =
    await executeStepWithDependencies({
      stepId: teamSteps[0].id,
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

  const teams = collectedEntities.filter(
    (e) => e._type === GithubEntities.GITHUB_TEAM._type,
  );
  expect(teams.length).toBeGreaterThan(0);
  expect(teams).toMatchGraphObjectSchema(GithubEntities.GITHUB_TEAM);

  // relationships
  const accountHasTeamRels = collectedRelationships.filter(
    (e) => e._type === Relationships.ACCOUNT_HAS_TEAM._type,
  );
  expect(accountHasTeamRels.length).toBeGreaterThan(0);
});
