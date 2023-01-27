import getStepStartStates from './getStepStartStates';
import * as config from './config';

jest.mock('./config');

describe('getStepStartStates', () => {
  test('enabled fetch-vulnerability-alerts w/permissions', async () => {
    const validateInvocationSpy = jest
      .spyOn(config, 'validateInvocation')
      .mockResolvedValueOnce({
        repoAdmin: true,
        repoIssues: true,
        orgAdmin: true,
        repoEnvironments: true,
        orgSecrets: false,
        repoSecrets: false,
        dependabotAlerts: true,
        repoDiscussions: true,
        codeScanningAlerts: false,
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
        repoAdmin: true,
        repoIssues: true,
        orgAdmin: true,
        repoEnvironments: true,
        orgSecrets: false,
        repoSecrets: false,
        dependabotAlerts: true,
        repoDiscussions: true,
        codeScanningAlerts: false,
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
        repoAdmin: true,
        repoIssues: true,
        repoEnvironments: true,
        orgAdmin: true,
        orgSecrets: false,
        repoSecrets: false,
        dependabotAlerts: false,
        repoDiscussions: true,
        codeScanningAlerts: false,
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

  test('enable fetch-branch-protection-rules', async () => {
    const validateInvocationSpy = jest
      .spyOn(config, 'validateInvocation')
      .mockResolvedValueOnce({
        // tested permissions
        repoAdmin: true,
        repoDiscussions: true,
        // not applicable
        repoIssues: true,
        repoEnvironments: true,
        orgAdmin: true,
        orgSecrets: false,
        repoSecrets: false,
        dependabotAlerts: false,
        codeScanningAlerts: false,
      })
      .mockResolvedValueOnce({
        // tested permissions
        repoAdmin: true,
        repoDiscussions: false,
        // not applicable
        repoIssues: true,
        repoEnvironments: true,
        orgAdmin: true,
        orgSecrets: false,
        repoSecrets: false,
        dependabotAlerts: false,
        codeScanningAlerts: false,
      })
      .mockResolvedValueOnce({
        // tested permissions
        repoAdmin: false,
        repoDiscussions: false,
        // not applicable
        repoIssues: true,
        repoEnvironments: true,
        orgAdmin: true,
        orgSecrets: false,
        repoSecrets: false,
        dependabotAlerts: false,
        codeScanningAlerts: false,
      });

    const states = await getStepStartStates({
      instance: { config: {} },
    } as any);

    expect(validateInvocationSpy).toHaveBeenCalled();
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
});
