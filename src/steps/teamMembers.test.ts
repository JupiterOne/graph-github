import { Recording } from '@jupiterone/integration-sdk-testing';
import { sanitizeConfig } from '../config';
import { teamMemberSteps } from './teamMembers';
import { integrationConfig } from '../../test/config';
import { setupGithubRecording } from '../../test/recording';
import { Relationships } from '../constants';
import { invocationConfig } from '..';
import { executeStepWithDependencies } from '../../test/executeStepWithDependencies';

jest.setTimeout(20000);

let recording: Recording;
afterEach(async () => {
  await recording.stop();
});

test('fetchTeamMembers exec handler', async () => {
  recording = setupGithubRecording({
    directory: __dirname,
    name: 'teamMembers',
  });
  sanitizeConfig(integrationConfig);

  const { collectedEntities, collectedRelationships, encounteredTypes } =
    await executeStepWithDependencies({
      stepId: teamMemberSteps[0].id,
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
  const teamHasMemberRels = collectedRelationships.filter(
    (e) => e._type === Relationships.TEAM_HAS_USER._type,
  );
  expect(teamHasMemberRels.length).toBeGreaterThan(0);

  const memberManagesTeamRels = collectedRelationships.filter(
    (e) => e._type === Relationships.USER_MANAGES_TEAM._type,
  );
  expect(memberManagesTeamRels.length).toBeGreaterThan(0);
});
