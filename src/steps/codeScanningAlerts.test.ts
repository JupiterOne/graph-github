import { Recording } from '@jupiterone/integration-sdk-testing';
import { sanitizeConfig } from '../config';
import { codeScanningAlertsSteps } from './codeScanningAlerts';
import { integrationConfig } from '../../test/config';
import { setupGithubRecording } from '../../test/recording';
import {
  GithubEntities,
  GITHUB_REPO_FINDING_RELATIONSHIP_TYPE,
} from '../constants';
import { invocationConfig } from '..';
import { executeStepWithDependencies } from '../../test/executeStepWithDependencies';

jest.setTimeout(20000);

let recording: Recording;
afterEach(async () => {
  await recording.stop();
});

test('fetchCodeScanningAlerts exec handler', async () => {
  recording = setupGithubRecording({
    directory: __dirname,
    name: 'codeScanningAlerts',
  });
  sanitizeConfig(integrationConfig);

  const { collectedEntities, collectedRelationships, encounteredTypes } =
    await executeStepWithDependencies({
      stepId: codeScanningAlertsSteps[0].id,
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

  const codeScanningAlerts = collectedEntities.filter(
    (e) => e._type === GithubEntities.GITHUB_CODE_SCANNER_ALERTS._type,
  );
  expect(codeScanningAlerts.length).toBeGreaterThan(0);
  expect(codeScanningAlerts).toMatchGraphObjectSchema(
    GithubEntities.GITHUB_CODE_SCANNER_ALERTS,
  );

  // relationships
  const repoFindings = collectedRelationships.filter(
    (e) => e._type === GITHUB_REPO_FINDING_RELATIONSHIP_TYPE,
  );
  expect(repoFindings.length).toBeGreaterThan(0);
});
