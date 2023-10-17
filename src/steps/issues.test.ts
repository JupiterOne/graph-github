import { Recording } from '@jupiterone/integration-sdk-testing';
import { sanitizeConfig } from '../config';
import { issueSteps } from './issues';
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

test('fetchIssues exec handler', async () => {
  recording = setupGithubRecording({
    directory: __dirname,
    name: 'issues',
  });
  sanitizeConfig(integrationConfig);

  const { collectedEntities, collectedRelationships, encounteredTypes } =
    await executeStepWithDependencies({
      stepId: issueSteps[0].id,
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

  const issues = collectedEntities.filter(
    (e) => e._type === GithubEntities.GITHUB_ISSUE._type,
  );
  expect(issues.length).toBeGreaterThan(0);
  expect(issues).toMatchGraphObjectSchema(GithubEntities.GITHUB_ISSUE);

  // relationships
  const repoHasIssueRels = collectedRelationships.filter(
    (e) => e._type === Relationships.REPO_HAS_ISSUE._type,
  );
  expect(repoHasIssueRels.length).toBeGreaterThan(0);

  const memberCreatedIssueRels = collectedRelationships.filter(
    (e) => e._type === Relationships.USER_CREATED_ISSUE._type,
  );
  expect(memberCreatedIssueRels.length).toBeGreaterThan(0);

  const memberAssignedIssueRels = collectedRelationships.filter(
    (e) => e._type === Relationships.USER_ASSIGNED_ISSUE._type,
  );
  expect(memberAssignedIssueRels.length).toBeGreaterThan(0);
});
