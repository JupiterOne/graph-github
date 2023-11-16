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
      disabled: !scopes.repoIssues,
      disabledReason: DisabledStepReason.PERMISSION,
    },
    [Steps.FETCH_APPS]: {
      disabled: !scopes.orgAdmin,
      disabledReason: DisabledStepReason.PERMISSION,
    },
    [Steps.FETCH_CODE_SCANNING_ALERTS]: {
      disabled:
        !scopes.codeScanningAlerts ||
        !utils.isSupported(
          EnterpriseFeatures.LIST_CODE_SCANNING_ALERT_FOR_ORG,
          gheServerVersion,
        ),
      disabledReason: !scopes.codeScanningAlerts
        ? DisabledStepReason.PERMISSION
        : DisabledStepReason.API_VERSION,
    },
    [Steps.FETCH_ENVIRONMENTS]: {
      disabled: !scopes.repoEnvironments,
      disabledReason: DisabledStepReason.PERMISSION,
    },
    [Steps.FETCH_ORG_SECRETS]: {
      disabled: !scopes.orgSecrets,
      disabledReason: DisabledStepReason.PERMISSION,
    },
    [Steps.FETCH_REPO_SECRETS]: {
      disabled: !scopes.repoSecrets,
      disabledReason: DisabledStepReason.PERMISSION,
    },
    [Steps.FETCH_ENV_SECRETS]: {
      disabled: !scopes.repoSecrets || !scopes.repoEnvironments,
      disabledReason: DisabledStepReason.PERMISSION,
    },
    [Steps.FETCH_VULNERABILITY_ALERTS]: {
      disabled: !scopes.dependabotAlerts,
      disabledReason: DisabledStepReason.PERMISSION,
    },
    [Steps.FETCH_BRANCH_PROTECTION_RULES]: {
      disabled: !scopes.repoAdmin && !scopes.repoDiscussions,
      disabledReason: DisabledStepReason.PERMISSION,
    },
    // [Steps.FETCH_SECRET_SCANNING_ALERTS]: {
    //   disabled:
    //     !scopes.secretScanningAlerts ||
    //     !utils.isSupported(
    //       EnterpriseFeatures.LIST_SECRET_SCANNING_ALERT_FOR_ORG,
    //       gheServerVersion,
    //     ),
    //   disabledReason: !scopes.secretScanningAlerts
    //     ? DisabledStepReason.PERMISSION
    //     : DisabledStepReason.API_VERSION,
    // },
  };
}
