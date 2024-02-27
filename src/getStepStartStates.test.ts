import getStepStartStates from './getStepStartStates';
import * as config from './config';

jest.mock('./config');

describe('getStepStartStates', () => {
  test('enabled fetch-vulnerability-alerts w/out permissions', async () => {
    const validateAndReturnAuthenticationDataSpy = jest
      .spyOn(config, 'validateAndReturnAuthenticationData')
      .mockResolvedValueOnce({
        gheServerVersion: null,
        scopes: new Set([
          'administration',
          'issues',
          'actions',
          'organization_administration',
          'discussions',
        ]),
      });

    const context = {
      instance: {
        config: {
          selectedAuthType: 'githubCloud',
        },
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
        gheServerVersion: null,
        scopes: new Set([
          // tested permissions
          'administration',
          'discussions',
          // not applicable
          'issues',
          'actions',
          'organization_administration',
          'pages',
        ]),
      })
      .mockResolvedValueOnce({
        gheServerVersion: null,
        scopes: new Set([
          // tested permissions
          'administration',
          // not applicable
          'issues',
          'actions',
          'organization_administration',
          'organization_secrets',
        ]),
      })
      .mockResolvedValueOnce({
        gheServerVersion: null,
        scopes: new Set(['issues', 'actions', 'organization_administration']),
      });

    const states = await getStepStartStates({
      instance: {
        config: {
          selectedAuthType: 'githubCloud',
        },
      },
    } as any);

    expect(validateAndReturnAuthenticationDataSpy).toHaveBeenCalled();
    expect(states['fetch-branch-protection-rules'].disabled).toBeFalsy();

    const states2 = await getStepStartStates({
      instance: {
        config: {
          selectedAuthType: 'githubCloud',
        },
      },
    } as any);
    expect(states2['fetch-branch-protection-rules'].disabled).toBeFalsy();

    const states3 = await getStepStartStates({
      instance: {
        config: {
          selectedAuthType: 'githubCloud',
        },
      },
    } as any);
    expect(states3['fetch-branch-protection-rules'].disabled).toBeTruthy();
  });

  test('enable fetch-code-scanning-alerts', async () => {
    const validateAndReturnAuthenticationDataSpy = jest
      .spyOn(config, 'validateAndReturnAuthenticationData')
      .mockResolvedValueOnce({
        gheServerVersion: '5.0.0',
        scopes: new Set([
          'administration',
          'discussions',
          'issues',
          'actions',
          'organization_administration',
          'security_events',
        ]),
      })
      .mockResolvedValueOnce({
        gheServerVersion: '1.0.0',
        scopes: new Set([
          'administration',
          'discussions',
          'issues',
          'actions',
          'organization_administration',
          'security_events',
        ]),
      });

    const states = await getStepStartStates({
      instance: {
        config: {
          selectedAuthType: 'githubCloud',
        },
      },
    } as any);

    expect(validateAndReturnAuthenticationDataSpy).toHaveBeenCalled();
    expect(states['fetch-code-scanning-alerts'].disabled).toBeFalsy();

    const states2 = await getStepStartStates({
      instance: {
        config: {
          selectedAuthType: 'githubCloud',
        },
      },
    } as any);
    expect(states2['fetch-code-scanning-alerts'].disabled).toBeTruthy();
  });
});
