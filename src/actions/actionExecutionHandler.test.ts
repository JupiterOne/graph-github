import actionExecutionHandler, {
  IntegrationActionExecutionContext,
} from './actionExecutionHandler';
import { IntegrationConfig, sanitizeConfig } from '../config';
import { integrationConfig } from '../../test/config';
import {
  createMockIntegrationLogger,
  Recording,
} from '@jupiterone/integration-sdk-testing';
import { setupGithubRecording } from '../../test/recording';

jest.setTimeout(30000);

let recording: Recording;
afterEach(async () => {
  await recording.stop();
});

describe('actionExecutionHandler', () => {
  test.skip('action.name=PARTIAL_INGEST', async () => {
    // Arrange
    recording = setupGithubRecording({
      directory: __dirname,
      name: 'partialIngest',
    });
    sanitizeConfig(integrationConfig);

    const executionContext = {
      event: {
        action: {
          name: 'PARTIAL_INGEST' as any,
          parameters: {
            entities: [
              {
                _key: 'j1-ingest/reimagined-barnacle/pull-requests/19',
                _type: 'github_pullrequest',
              },
              {
                _key: 'bob',
                _type: 'github_member',
              },
            ],
          },
        },
      },
      clients: {},
      instance: {
        config: integrationConfig,
      },
      logger: createMockIntegrationLogger(),
    } as unknown as IntegrationActionExecutionContext<IntegrationConfig>;

    // Act
    const result = await actionExecutionHandler(executionContext);

    // Assert
    expect(result).toMatchSnapshot();
  });
});
