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
      disabled: !scopes?.has('issues'),
      disabledReason: DisabledStepReason.PERMISSION,
    },
    [Steps.FETCH_APPS]: {
      disabled: !scopes?.has('organization_administration'),
      disabledReason: DisabledStepReason.PERMISSION,
    },
    [Steps.FETCH_CODE_SCANNING_ALERTS]: {
      disabled:
        !scopes?.has('security_events') ||
        !utils.isSupported(
          EnterpriseFeatures.LIST_CODE_SCANNING_ALERT_FOR_ORG,
          gheServerVersion,
        ),
      disabledReason: !scopes?.has('security_events')
        ? DisabledStepReason.PERMISSION
        : DisabledStepReason.API_VERSION,
    },
    [Steps.FETCH_ENVIRONMENTS]: {
      disabled: !scopes?.has('environments'),
      disabledReason: DisabledStepReason.PERMISSION,
    },
    [Steps.FETCH_ORG_SECRETS]: {
      disabled: !scopes?.has('organization_secrets'),
      disabledReason: DisabledStepReason.PERMISSION,
    },
    [Steps.FETCH_REPO_SECRETS]: {
      disabled: !scopes?.has('secrets'),
      disabledReason: DisabledStepReason.PERMISSION,
    },
    [Steps.FETCH_ENV_SECRETS]: {
      disabled: !scopes?.has('secrets') || !scopes?.has('environments'),
      disabledReason: DisabledStepReason.PERMISSION,
    },
    [Steps.FETCH_VULNERABILITY_ALERTS]: {
      disabled: !scopes?.has('vulnerability_alerts'),
      disabledReason: DisabledStepReason.PERMISSION,
    },
    [Steps.FETCH_BRANCH_PROTECTION_RULES]: {
      disabled: !scopes?.has('administration') && !scopes?.has('discussions'),
      disabledReason: DisabledStepReason.PERMISSION,
    },
    // TODO: enable when this is ready https://jupiterone.atlassian.net/browse/INT-9938
    // [Steps.FETCH_SECRET_SCANNING_ALERTS]: {
    //   disabled:
    //     !scopes?.has('secret_scanning_alerts') ||
    //     !utils.isSupported(
    //       EnterpriseFeatures.LIST_SECRET_SCANNING_ALERT_FOR_ORG,
    //       gheServerVersion,
    //     ),
    //   disabledReason: !scopes?.has('secret_scanning_alerts')
    //     ? DisabledStepReason.PERMISSION
    //     : DisabledStepReason.API_VERSION,
    // },
  };
}
