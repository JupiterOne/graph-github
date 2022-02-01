import { Recording } from '@jupiterone/integration-sdk-testing';
import { sanitizeConfig } from '../config';
import { memberSteps } from './members';
import { integrationConfig } from '../../test/config';
import { setupGithubRecording } from '../../test/recording';
import {
  GithubEntities,
  GITHUB_ACCOUNT_MEMBER_RELATIONSHIP_TYPE,
  GITHUB_MEMBER_ACCOUNT_RELATIONSHIP_TYPE,
} from '../constants';
import { invocationConfig } from '..';
import { executeStepWithDependencies } from '../../test/executeStepWithDependencies';

jest.setTimeout(20000);

let recording: Recording;
afterEach(async () => {
  await recording.stop();
});

test('fetchMembers exec handler', async () => {
  recording = setupGithubRecording({
    directory: __dirname,
    name: 'members',
  });
  sanitizeConfig(integrationConfig);
  integrationConfig.installationId = 17214088; //this is the id the recordings are under

  const { collectedEntities, collectedRelationships, encounteredTypes } =
    await executeStepWithDependencies({
      stepId: memberSteps[0].id,
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

  const members = collectedEntities.filter(
    (e) => e._type === GithubEntities.GITHUB_MEMBER._type,
  );
  expect(members.length).toBeGreaterThan(0);
  expect(members).toMatchGraphObjectSchema(GithubEntities.GITHUB_MEMBER);

  // relationships
  const accountHasUserRels = collectedRelationships.filter(
    (e) => e._type === GITHUB_ACCOUNT_MEMBER_RELATIONSHIP_TYPE,
  );
  expect(accountHasUserRels.length).toBeGreaterThan(0);

  const userManagesAccountRels = collectedRelationships.filter(
    (e) => e._type === GITHUB_MEMBER_ACCOUNT_RELATIONSHIP_TYPE,
  );
  expect(userManagesAccountRels.length).toBeGreaterThan(0);
});
