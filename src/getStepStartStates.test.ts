import getStepStartStates from './getStepStartStates';
import * as config from './config';

jest.mock('./config');

describe('getStepStartStates', () => {
  test('enabled fetch-vulnerability-alerts w/permissions', async () => {
    const validateInvocationSpy = jest
      .spyOn(config, 'validateInvocation')
      .mockResolvedValueOnce({
        repoIssues: true,
        orgAdmin: true,
        repoEnvironments: true,
        orgSecrets: false,
        repoSecrets: false,
        dependabotAlerts: true,
      });
    const context = {
      instance: {
        config: {
          enableDependabotAlerts: true,
        },
      },
    } as any;

    const states = await getStepStartStates(context);

    expect(validateInvocationSpy).toHaveBeenCalled();
    expect(states['fetch-vulnerability-alerts'].disabled).toBeFalsy();
    expect(states['fetch-repo-secrets'].disabled).toBeTruthy();
  });

  test('disabled fetch-vulnerability-alerts w/permissions', async () => {
    const validateInvocationSpy = jest
      .spyOn(config, 'validateInvocation')
      .mockResolvedValueOnce({
        repoIssues: true,
        orgAdmin: true,
        repoEnvironments: true,
        orgSecrets: false,
        repoSecrets: false,
        dependabotAlerts: true,
      });

    const context = {
      instance: {
        config: {
          enableDependabotAlerts: false,
        },
      },
    } as any;

    const states = await getStepStartStates(context);

    expect(validateInvocationSpy).toHaveBeenCalled();
    expect(states['fetch-vulnerability-alerts'].disabled).toBeTruthy();
    expect(states['fetch-repo-secrets'].disabled).toBeTruthy();
  });

  test('enabled fetch-vulnerability-alerts w/out permissions', async () => {
    const validateInvocationSpy = jest
      .spyOn(config, 'validateInvocation')
      .mockResolvedValueOnce({
        repoIssues: true,
        orgAdmin: true,
        repoEnvironments: true,
        orgSecrets: false,
        repoSecrets: false,
        dependabotAlerts: false,
      });

    const context = {
      instance: {
        config: {
          enableDependabotAlerts: true,
        },
      },
    } as any;

    const states = await getStepStartStates(context);

    expect(validateInvocationSpy).toHaveBeenCalled();
    expect(states['fetch-vulnerability-alerts'].disabled).toBeTruthy();
    expect(states['fetch-repo-secrets'].disabled).toBeTruthy();
  });
});
