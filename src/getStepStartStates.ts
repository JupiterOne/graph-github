import {
  DisabledStepReason,
  IntegrationExecutionContext,
  StepStartStates,
} from '@jupiterone/integration-sdk-core';

import {
  IntegrationConfig,
  validateAndReturnAuthenticationData,
} from './config';
import utils, { EnterpriseFeatures } from './client/GraphQLClient/utils';
import { Steps } from './constants';

export default async function getStepStartStates(
  context: IntegrationExecutionContext<IntegrationConfig>,
): Promise<StepStartStates> {
  const { scopes, gheServerVersion } =
    await validateAndReturnAuthenticationData(context);
  const { selectedAuthType } = context.instance.config;
  const isAppAuth = ['githubCloud', 'githubEnterpriseServer'].includes(
    selectedAuthType,
  );

  const disabledCodeScanningAlerts = isAppAuth
    ? !scopes?.has('security_events') ||
      !utils.isSupported(
        EnterpriseFeatures.LIST_CODE_SCANNING_ALERT_FOR_ORG,
        gheServerVersion,
      )
    : !scopes?.has('security_events') && !scopes?.has('repo');

  // TODO: enable when this is ready https://jupiterone.atlassian.net/browse/INT-9938
  // const disabledSecretScanningAlerts = isAppAuth
  //   ? !scopes?.has('secret_scanning_alerts') ||
  //     !utils.isSupported(
  //       EnterpriseFeatures.LIST_SECRET_SCANNING_ALERT_FOR_ORG,
  //       gheServerVersion,
  //     )
  //   : !scopes?.has('repo') && !scopes?.has('security_events');

  return {
    [Steps.FETCH_ACCOUNT]: { disabled: false },
    [Steps.FETCH_USERS]: { disabled: false },
    [Steps.FETCH_REPOS]: { disabled: false },
    [Steps.FETCH_TEAMS]: { disabled: false },
    [Steps.FETCH_TEAM_MEMBERS]: { disabled: false },
    [Steps.FETCH_TEAM_REPOS]: { disabled: false },
    [Steps.FETCH_COLLABORATORS]: { disabled: false },
    [Steps.FETCH_PRS]: { disabled: false },
    [Steps.FETCH_ISSUES]: {
      disabled: isAppAuth && !scopes?.has('issues'),
      disabledReason: DisabledStepReason.PERMISSION,
    },
    [Steps.FETCH_APPS]: {
      disabled: isAppAuth
        ? !scopes?.has('organization_administration')
        : !scopes?.has('read:org') && !scopes?.has('admin:org'),
      disabledReason: DisabledStepReason.PERMISSION,
    },
    [Steps.FETCH_CODE_SCANNING_ALERTS]: {
      disabled: disabledCodeScanningAlerts,
      disabledReason: (
        isAppAuth
          ? !scopes?.has('security_events')
          : !scopes?.has('security_events') && !scopes?.has('repo')
      )
        ? DisabledStepReason.PERMISSION
        : DisabledStepReason.API_VERSION,
    },
    [Steps.FETCH_ENVIRONMENTS]: {
      disabled: isAppAuth
        ? !scopes?.has('actions') && !scopes?.has('environments')
        : !scopes?.has('repo'),
      disabledReason: DisabledStepReason.PERMISSION,
    },
    [Steps.FETCH_ORG_SECRETS]: {
      disabled: isAppAuth
        ? !scopes?.has('organization_secrets')
        : !scopes?.has('admin:org'),
      disabledReason: DisabledStepReason.PERMISSION,
    },
    [Steps.FETCH_REPO_SECRETS]: {
      disabled: isAppAuth ? !scopes?.has('secrets') : !scopes?.has('repo'),
      disabledReason: DisabledStepReason.PERMISSION,
    },
    [Steps.FETCH_ENV_SECRETS]: {
      disabled: isAppAuth ? !scopes?.has('secrets') : !scopes?.has('repo'),
      disabledReason: DisabledStepReason.PERMISSION,
    },
    [Steps.FETCH_VULNERABILITY_ALERTS]: {
      disabled: isAppAuth && !scopes?.has('vulnerability_alerts'),
      disabledReason: DisabledStepReason.PERMISSION,
    },
    [Steps.FETCH_BRANCH_PROTECTION_RULES]: {
      disabled:
        isAppAuth &&
        !scopes?.has('administration') &&
        !scopes?.has('discussions'),
      disabledReason: DisabledStepReason.PERMISSION,
    },
    // TODO: enable when this is ready https://jupiterone.atlassian.net/browse/INT-9938
    // [Steps.FETCH_SECRET_SCANNING_ALERTS]: {
    //   disabled: disabledSecretScanningAlerts,
    //   disabledReason: (
    //     isAppAuth
    //       ? !scopes?.has('secret_scanning_alerts')
    //       : !scopes?.has('repo') && !scopes?.has('security_events')
    //   )
    //     ? DisabledStepReason.PERMISSION
    //     : DisabledStepReason.API_VERSION,
    // },
  };
}
