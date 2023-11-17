import getStepStartStates from './getStepStartStates';
import * as config from './config';

jest.mock('./config');

describe('getStepStartStates', () => {
  test('enabled fetch-vulnerability-alerts w/out permissions', async () => {
    const validateAndReturnAuthenticationDataSpy = jest
      .spyOn(config, 'validateAndReturnAuthenticationData')
      .mockResolvedValueOnce({
        scopes: {
          repoAdmin: true,
          repoIssues: true,
          repoEnvironments: true,
          orgAdmin: true,
          orgSecrets: false,
          repoSecrets: false,
          repoPages: false,
          dependabotAlerts: false,
          repoDiscussions: true,
          codeScanningAlerts: false,
        },
      });

    const context = {
      instance: {
        config: {},
      },
    } as any;

    const states = await getStepStartStates(context);

    expect(validateAndReturnAuthenticationDataSpy).toHaveBeenCalled();
    expect(states['fetch-vulnerability-alerts'].disabled).toBeTruthy();
    expect(states['fetch-repo-secrets'].disabled).toBeTruthy();
  });

  test('enable fetch-branch-protection-rules', async () => {
    const validateAndReturnAuthenticationDataSpy = jest
      .spyOn(config, 'validateAndReturnAuthenticationData')
      .mockResolvedValueOnce({
        scopes: {
          // tested permissions
          repoAdmin: true,
          repoDiscussions: true,
          // not applicable
          repoIssues: true,
          repoEnvironments: true,
          orgAdmin: true,
          repoPages: true,
          orgSecrets: false,
          repoSecrets: false,
          dependabotAlerts: false,
          codeScanningAlerts: false,
        },
      })
      .mockResolvedValueOnce({
        scopes: {
          // tested permissions
          repoAdmin: true,
          repoDiscussions: false,
          // not applicable
          repoIssues: true,
          repoEnvironments: true,
          orgAdmin: true,
          repoPages: false,
          orgSecrets: true,
          repoSecrets: false,
          dependabotAlerts: false,
          codeScanningAlerts: false,
        },
      })
      .mockResolvedValueOnce({
        scopes: {
          // tested permissions
          repoAdmin: false,
          repoDiscussions: false,
          // not applicable
          repoIssues: true,
          repoEnvironments: true,
          orgAdmin: true,
          repoPages: false,
          orgSecrets: false,
          repoSecrets: false,
          dependabotAlerts: false,
          codeScanningAlerts: false,
        },
      });

    const states = await getStepStartStates({
      instance: { config: {} },
    } as any);

    expect(validateAndReturnAuthenticationDataSpy).toHaveBeenCalled();
    expect(states['fetch-branch-protection-rules'].disabled).toBeFalsy();

    const states2 = await getStepStartStates({
      instance: { config: {} },
    } as any);
    expect(states2['fetch-branch-protection-rules'].disabled).toBeFalsy();

    const states3 = await getStepStartStates({
      instance: { config: {} },
    } as any);
    expect(states3['fetch-branch-protection-rules'].disabled).toBeTruthy();
  });

  test('enable fetch-code-scanning-alerts', async () => {
    const validateAndReturnAuthenticationDataSpy = jest
      .spyOn(config, 'validateAndReturnAuthenticationData')
      .mockResolvedValueOnce({
        scopes: {
          // tested permissions
          repoAdmin: true,
          repoDiscussions: true,
          // not applicable
          repoIssues: true,
          repoEnvironments: true,
          repoPages: false,
          orgAdmin: true,
          orgSecrets: false,
          repoSecrets: false,
          dependabotAlerts: false,
          codeScanningAlerts: true,
        },
        gheServerVersion: '5.0.0',
      })
      .mockResolvedValueOnce({
        scopes: {
          // tested permissions
          repoAdmin: true,
          repoDiscussions: true,
          // not applicable
          repoIssues: true,
          repoEnvironments: true,
          repoPages: false,
          orgAdmin: true,
          orgSecrets: false,
          repoSecrets: false,
          dependabotAlerts: false,
          codeScanningAlerts: true,
        },
        gheServerVersion: '1.0.0',
      });

    const states = await getStepStartStates({
      instance: { config: {} },
    } as any);

    expect(validateAndReturnAuthenticationDataSpy).toHaveBeenCalled();
    expect(states['fetch-code-scanning-alerts'].disabled).toBeFalsy();

    const states2 = await getStepStartStates({
      instance: { config: {} },
    } as any);
    expect(states2['fetch-code-scanning-alerts'].disabled).toBeTruthy();
  });
});
