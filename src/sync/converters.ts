import {
  createDirectRelationship,
  createIntegrationEntity,
  createMappedRelationship,
  Entity,
  MappedRelationship,
  parseTimePropertyValue,
  Relationship,
  RelationshipClass,
  RelationshipDirection,
  setRawData,
  truncateEntityPropertyValue,
} from '@jupiterone/integration-sdk-core';

import {
  GithubEntities,
  MappedRelationships,
  Relationships,
} from '../constants';

import {
  AccountEntity,
  AccountType,
  AppEntity,
  EnvironmentEntity,
  IdEntityMap,
  IssueEntity,
  PullRequestEntity,
  RepoAllowRelationship,
  RepoEntity,
  RepoData,
  SecretEntity,
  TeamEntity,
  UserEntity,
  VulnerabilityAlertEntity,
} from '../types';
import { decomposePermissions } from '../util/propertyHelpers';
import {
  BranchProtectionRuleAllowancesResponse,
  BranchProtectionRuleResponse,
  CollaboratorResponse,
  Commit,
  IssueLabel,
  IssueResponse,
  Label,
  OrgMemberQueryResponse,
  OrgQueryResponse,
  OrgRepoQueryResponse,
  OrgTeamMemberQueryResponse,
  OrgTeamQueryResponse,
  PullRequestResponse,
  RepositoryVulnerabilityAlertState,
  Review,
  VulnerabilityAlertResponse,
} from '../client/GraphQLClient';
import {
  OrgAppQueryResponse,
  CodeScanningAlertQueryResponse,
  RepoEnvironmentQueryResponse,
  SecretQueryResponse,
  SecretScanningAlertQueryResponse,
} from '../client/RESTClient/types';

import { compact, last, omit, uniq } from 'lodash';
import getCommitsToDestination from '../util/getCommitsToDestination';
import {
  buildCodeScanningFindingKey,
  buildVulnAlertId,
  buildVulnAlertRecommendation,
} from './converterUtils';
import { GithubPagesInfo } from '../client';

export function toAccountEntity(data: OrgQueryResponse): AccountEntity {
  const accountEntity: AccountEntity = {
    _class: GithubEntities.GITHUB_ACCOUNT._class,
    _type: GithubEntities.GITHUB_ACCOUNT._type,
    _key: data.id,
    accountType: AccountType.Org,
    accountId: data.login,
    login: data.login,
    name: data.name ? data.name : undefined,
    displayName: data.name || data.login,
    createdOn: parseTimePropertyValue(data.createdAt),
    updatedOn: parseTimePropertyValue(data.updatedAt),
    description: data.description,
    email: data.email,
    node: data.id,
    databaseId: data.databaseId,
    verified: data.isVerified,
    location: data.location,
    websiteUrl: data.websiteUrl,
    webLink: data.url,
  };
  setRawData(accountEntity, { name: 'default', rawData: data });
  return accountEntity;
}

export function getAppEntityKey(installId: string): string {
  return 'GitHubAppInstallation_' + installId;
}

export function toAppEntity(data: OrgAppQueryResponse): AppEntity {
  const appEntity: AppEntity = {
    _class: GithubEntities.GITHUB_APP._class,
    _type: GithubEntities.GITHUB_APP._type,
    _key: getAppEntityKey(data.id),
    name: data.app_slug,
    displayName: data.app_slug,
    webLink: data.html_url,
    installationId: data.id, //the installation id
    appId: data.app_id,
    appSlug: data.app_slug,
    targetId: data.target_id,
    targetType: data.target_type,
    createdOn: parseTimePropertyValue(data.created_at),
    updatedOn: parseTimePropertyValue(data.updated_at),
    events: data.events,
    repositorySelection: data.repository_selection,
    singleFileName: data.single_file_name || '',
    hasMultipleSingleFiles: data.has_multiple_single_files,
    singleFilePaths: data.single_file_paths,
    // suspendedBy: data.suspended_by || '',
    suspendedOn: parseTimePropertyValue(data.suspended_at),
    ...decomposePermissions(data.permissions),
  };
  setRawData(appEntity, { name: 'default', rawData: data });
  return appEntity;
}

const numericSeverity = {
  critical: 10,
  high: 8,
  medium: 6,
  low: 4,
  informational: 2,
  none: 0,
};

const severityToPriorityMap = {
  critical: 'CRITICAL',
  high: 'HIGH',
  error: 'MEDIUM',
  warning: 'LOW',
  note: 'INFO',
  unknown: 'UNKNOWN',
};

export function createCodeScanningFindingEntity(
  data: CodeScanningAlertQueryResponse,
) {
  return createIntegrationEntity({
    entityData: {
      source: data,
      assign: {
        _class: GithubEntities.GITHUB_CODE_SCANNING_ALERT._class,
        _type: GithubEntities.GITHUB_CODE_SCANNING_ALERT._type,
        _key: buildCodeScanningFindingKey(data),
        number: data.number,
        name: data.rule?.name,
        displayName: data.rule?.name,
        summary: data.rule?.description,
        status: data.state?.toUpperCase(),
        state: data.state?.toUpperCase(),
        open: data.state === 'open',
        severity:
          data.rule?.security_severity_level?.toUpperCase() ?? 'UNKNOWN',
        numericSeverity:
          numericSeverity[
            data.rule.security_severity_level?.toLowerCase() ??
              numericSeverity.none
          ] ?? numericSeverity.none,
        priority:
          severityToPriorityMap[
            data.rule?.severity?.toLowerCase() ?? severityToPriorityMap.unknown
          ],
        alertSeverity: data.rule?.severity?.toUpperCase(),
        category: 'application',
        weblink: data.html_url,
        createdOn: parseTimePropertyValue(data.created_at),
        updatedOn: parseTimePropertyValue(data.updated_at),
        dismissedOn: parseTimePropertyValue(data.dismissed_at),
        // TODO: This should create a relationship
        // dismissedBy: data.dismissed_by
        fixedOn: parseTimePropertyValue(data.fixed_at),
        dismissedReason: data.dismissed_reason,
        dismissedComment: data.dismissed_comment,
        toolName: data.tool?.name,
        toolVersion: data.tool?.version,
        path: data.most_recent_instance?.location?.path,
        ruleTags: data.rule?.tags,
      },
    },
  });
}

export function getSecretScanningAlertKey(id: string) {
  return `github_secret_scanning_finding:${id}`;
}

export function createSecretScanningAlertEntity(
  data: SecretScanningAlertQueryResponse,
) {
  return createIntegrationEntity({
    entityData: {
      source: data,
      assign: {
        _class: GithubEntities.GITHUB_SECRET_SCANNING_ALERT._class,
        _type: GithubEntities.GITHUB_SECRET_SCANNING_ALERT._type,
        _key: getSecretScanningAlertKey(String(data.number)),
        displayName: data.secret_type_display_name,
        name: data.secret_type_display_name,
        severity: 'CRITICAL',
        numericSeverity: 10,
        category: 'application',
        number: data.number,
        url: data.html_url,
        state: data.state,
        open: data.state === 'open',
        resolution: data.resolution,
        secretType: data.secret_type,
        secretTypeDisplayName: data.secret_type_display_name,
        secret: data.secret,
        resolvedBy: data.resolved_by?.login,
        resolvedOn: parseTimePropertyValue(data.resolved_at),
        resolutionComment: data.resolution_comment,
        pushProtectionBypassed: data.push_protection_bypassed,
        pushProtectionBypassedBy: data.push_protection_bypassed_by?.login,
        pushProtectionBypassedOn: parseTimePropertyValue(
          data.push_protection_bypassed_at,
        ),
        createdOn: parseTimePropertyValue(data.created_at),
        updatedOn: parseTimePropertyValue(data.updated_at),
      },
    },
  });
}

export function getSecretEntityKey({
  name,
  secretOwnerType,
  secretOwnerName,
}): string {
  return (
    'GitHub_' + secretOwnerType + '_' + secretOwnerName + '_Secret_' + name
  );
}

export function toOrgSecretEntity(
  data: SecretQueryResponse,
  orgLogin: string,
  baseUrl: string,
): SecretEntity {
  const secretEntity: SecretEntity = {
    _class: GithubEntities.GITHUB_ORG_SECRET._class,
    _type: GithubEntities.GITHUB_ORG_SECRET._type,
    _key: getSecretEntityKey({
      name: data.name,
      secretOwnerType: 'Org',
      secretOwnerName: orgLogin,
    }),
    name: data.name,
    displayName: data.name,
    webLink: apiUrlToWebLink(
      baseUrl,
      `/organizations/${orgLogin}/settings/secrets/actions/${data.name}`,
    ),
    createdOn: parseTimePropertyValue(data.created_at),
    updatedOn: parseTimePropertyValue(data.updated_at),
    visibility: data.visibility,
    selectedRepositoriesLink: data.selected_repositories_url,
  };
  setRawData(secretEntity, { name: 'default', rawData: data });
  return secretEntity;
}

export function toRepoSecretEntity(
  data: SecretQueryResponse,
  orgLogin: string,
  baseUrl: string,
  repoName: string,
): SecretEntity {
  const secretEntity: SecretEntity = {
    _class: GithubEntities.GITHUB_REPO_SECRET._class,
    _type: GithubEntities.GITHUB_REPO_SECRET._type,
    _key: getSecretEntityKey({
      name: data.name,
      secretOwnerType: 'Repo',
      secretOwnerName: repoName,
    }),
    name: data.name,
    displayName: data.name,
    webLink: apiUrlToWebLink(
      baseUrl,
      `/${orgLogin}/${repoName}/settings/secrets/actions/${data.name}`,
    ),
    createdOn: parseTimePropertyValue(data.created_at),
    updatedOn: parseTimePropertyValue(data.updated_at),
    visibility: 'selected',
  };
  setRawData(secretEntity, { name: 'default', rawData: data });
  return secretEntity;
}

export function toEnvironmentEntity(
  data: RepoEnvironmentQueryResponse,
  orgLogin: string,
  baseUrl: string,
  repoData: RepoData,
): EnvironmentEntity {
  let protRulesExist = false;
  if (data.protection_rules && data.protection_rules[0]) {
    protRulesExist = true;
  }
  const envEntity: EnvironmentEntity = {
    _class: GithubEntities.GITHUB_ENVIRONMENT._class,
    _type: GithubEntities.GITHUB_ENVIRONMENT._type,
    _key: data.node_id,
    name: data.name,
    displayName: data.name,
    webLink: apiUrlToWebLink(
      baseUrl,
      `/${orgLogin}/${repoData.name}/settings/environments/${data.id}/edit`,
    ),
    id: String(data.id), //force to string to pass SDK validation
    nodeId: data.node_id,
    url: data.url,
    htmlUrl: data.html_url,
    createdOn: parseTimePropertyValue(data.created_at),
    updatedOn: parseTimePropertyValue(data.updated_at),
    protectionRulesExist: protRulesExist,
    //parent properties for use in creating envSecrets entities
    parentRepoName: repoData.name,
    parentRepoKey: repoData._key,
    parentRepoDatabaseId: repoData.databaseId,
  };
  setRawData(envEntity, { name: 'default', rawData: data });
  return envEntity;
}

export function toEnvSecretEntity(
  data: SecretQueryResponse,
  orgLogin: string,
  baseUrl: string,
  env: EnvironmentEntity,
): SecretEntity {
  const secretEntity: SecretEntity = {
    _class: GithubEntities.GITHUB_ENV_SECRET._class,
    _type: GithubEntities.GITHUB_ENV_SECRET._type,
    _key: getSecretEntityKey({
      name: data.name,
      secretOwnerType: 'Env',
      secretOwnerName: env.name + 'InRepo' + env.parentRepoName,
    }),
    name: data.name,
    displayName: data.name,
    webLink: apiUrlToWebLink(
      baseUrl,
      `/${orgLogin}/${env.parentRepoName}/settings/environments/${env.id}/edit`,
    ),
    createdOn: parseTimePropertyValue(data.created_at),
    updatedOn: parseTimePropertyValue(data.updated_at),
    visibility: 'selected',
  };
  setRawData(secretEntity, { name: 'default', rawData: data });
  return secretEntity;
}

export function getTeamEntityKey(id: string) {
  return id;
}

export function toTeamEntity(data: OrgTeamQueryResponse): TeamEntity {
  const teamEntity: TeamEntity = {
    _class: GithubEntities.GITHUB_TEAM._class,
    _type: GithubEntities.GITHUB_TEAM._type,
    _key: getTeamEntityKey(data.id),
    webLink: data.url,
    name: data.slug,
    displayName: data.name,
    fullName: data.name,
    createdOn: parseTimePropertyValue(data.createdAt),
    updatedOn: parseTimePropertyValue(data.updatedAt),
    databaseId: data.databaseId,
    description: data.description || '',
    node: data.id,
    privacy: data.privacy || '',
  };
  setRawData(teamEntity, {
    name: 'default',
    rawData: omit(data, ['members', 'repos']),
  });
  return teamEntity;
}

export function toBranchProtectionEntity(
  data: BranchProtectionRuleResponse,
  baseUrl: string,
  orgLogin: string,
  allowances?: BranchProtectionRuleAllowancesResponse,
) {
  return createIntegrationEntity({
    entityData: {
      source: {
        ...data,
        ...(allowances && omit(allowances, ['branchProtectionRuleId'])),
      },
      assign: {
        _class: GithubEntities.GITHUB_BRANCH_PROTECTION_RULE._class,
        _type: GithubEntities.GITHUB_BRANCH_PROTECTION_RULE._type,
        _key: `github_${data.id}`,
        webLink: apiUrlToWebLink(
          baseUrl,
          `/${orgLogin}/${data.repoName}/settings/branch_protection_rules/${data.databaseId}`,
        ),
        name: data.pattern,
        displayName: data.pattern,
        blockCreations: data.blocksCreations,
        allowDeletions: data.allowsDeletions,
        allowForcePushes: data.allowsForcePushes,
        requiredLinearHistory: data.requiresLinearHistory,
        enforceAdmins: data.isAdminEnforced,
        requiredSignatures: data.requiresCommitSignatures,
        requiredConversationResolution: data.requiresConversationResolution,
        requiredApprovingReviewCount: data.requiredApprovingReviewCount,
        requireCodeOwnerReviews: data.requiresCodeOwnerReviews,
        requiredStatusChecks: data.requiredStatusCheckContexts,
      },
    },
  });
}

export function getRepositoryEntityKey(id: string) {
  return id;
}

export function toRepositoryEntity(data: OrgRepoQueryResponse): RepoEntity {
  const repoEntity: RepoEntity = {
    _class: GithubEntities.GITHUB_REPO._class,
    _type: GithubEntities.GITHUB_REPO._type,
    _key: getRepositoryEntityKey(data.id),
    webLink: data.url,
    name: data.name,
    displayName: data.name,
    fullName: data.nameWithOwner.toLowerCase(),
    owner: data.nameWithOwner.toLowerCase().split('/')[0],
    public: !data.isPrivate,
    archived: data.isArchived,
    createdOn: parseTimePropertyValue(data.createdAt),
    updatedOn: parseTimePropertyValue(data.updatedAt),
    pushedOn: parseTimePropertyValue(data.pushedAt),
    databaseId: data.databaseId || '',
    autoMergeAllowed: data.autoMergeAllowed,
    deleteBranchOnMerge: data.deleteBranchOnMerge,
    description: data.description || '',
    homepageUrl: data.homepageUrl || '',
    node: data.id,
    disabled: data.isDisabled,
    empty: data.isEmpty,
    fork: data.isFork,
    forkingAllowed: data.forkingAllowed,
    forkCount: data.forkCount,
    inOrganization: data.isInOrganization,
    locked: data.isLocked,
    mirror: data.isMirror,
    securityPolicyEnabled: data.isSecurityPolicyEnabled,
    template: data.isTemplate,
    userConfigurationRepository: data.isUserConfigurationRepository,
    lockReason: data.lockReason || '',
    mergeCommitAllowed: data.mergeCommitAllowed,
    rebaseMergeAllowed: data.rebaseMergeAllowed,
    visibility: data.visibility,
  };
  setRawData(repoEntity, { name: 'default', rawData: data });
  return repoEntity;
}

export function decorateRepoEntityWithPagesInfo(
  repoEntity: RepoEntity,
  pagesInfo: GithubPagesInfo,
): RepoEntity {
  repoEntity.hasPages = pagesInfo.hasPages;
  repoEntity.pagesUrl = pagesInfo.pagesUrl;
  return repoEntity;
}

export function toOrganizationMemberEntity(
  data: OrgMemberQueryResponse,
  externalIdentifiers?: { [x: string]: string | undefined } | undefined,
): UserEntity {
  const userEntity: UserEntity = {
    _class: GithubEntities.GITHUB_MEMBER._class,
    _type: GithubEntities.GITHUB_MEMBER._type,
    _key: data.id,
    login: data.login,
    username: data.login,
    displayName: data.name || data.login,
    name: data.name || data.login,
    mfaEnabled: data.hasTwoFactorEnabled || undefined,
    role: data.role,
    siteAdmin: data.isSiteAdmin,
    webLink: data.url || '',
    company: data.company || '',
    createdOn: parseTimePropertyValue(data.createdAt),
    updatedOn: parseTimePropertyValue(data.updatedAt),
    databaseId: data.databaseId,
    id: data.id,
    node: data.id,
    employee: data.isEmployee,
    location: data.location || '',
    websiteUrl: data.websiteUrl || '',
    active: true,
    organizationId: data.organization,
  };
  // First attempt to use the org level external identifiers for email if
  // available.  This will allow us to have a greater match percentage
  // when looking for existing users by work email.
  if (data.login && externalIdentifiers?.[data.login]) {
    userEntity.email = externalIdentifiers[data.login];
  } else if (data.email) {
    userEntity.email = data.email;
  } //don't set the property if it's not provided, because SDK input validation will fail

  setRawData(userEntity, { name: 'default', rawData: data });
  return userEntity;
}

export function toOrganizationMemberEntityFromTeamMember(
  data: OrgTeamMemberQueryResponse,
  baseUrl: string,
): UserEntity {
  const userEntity: UserEntity = {
    _class: GithubEntities.GITHUB_MEMBER._class,
    _type: GithubEntities.GITHUB_MEMBER._type,
    _key: data.id,
    login: data.login,
    username: data.login,
    displayName: data.name || data.login,
    name: data.login,
    mfaEnabled: undefined,
    role: data.role,
    webLink: apiUrlToWebLink(baseUrl, `/${data.login}`),
    node: data.id,
    id: data.id,
    active: true,
  };
  setRawData(userEntity, { name: 'default', rawData: data });
  return userEntity;
}

export function toOrganizationCollaboratorEntity(
  data: CollaboratorResponse,
  baseUrl: string,
): UserEntity {
  const userEntity: UserEntity = {
    _class: GithubEntities.GITHUB_COLLABORATOR._class,
    _type: GithubEntities.GITHUB_COLLABORATOR._type,
    _key: data.id,
    login: data.login,
    username: data.login,
    displayName: data.name || data.login,
    name: data.name || data.login,
    mfaEnabled: undefined,
    role: 'OUTSIDE',
    siteAdmin: false,
    webLink: apiUrlToWebLink(baseUrl, `/${data.login}`),
    node: data.id,
    id: data.id,
    active: true,
  };
  setRawData(userEntity, { name: 'default', rawData: data });
  return userEntity;
}

export function toIssueEntity(
  data: IssueResponse,
  issueLabels: IssueLabel[],
): IssueEntity {
  const issueName = data.repoName + '/' + String(data.number); //format matches name of PRs
  const labels = issueLabels.map((l) => l.name);
  const truncatedIssueBody = truncateEntityPropertyValue(data.body);

  const issueEntity: IssueEntity = {
    _class: GithubEntities.GITHUB_ISSUE._class,
    _type: GithubEntities.GITHUB_ISSUE._type,
    _key: data.id,
    webLink: data.url,
    url: data.url,
    name: issueName,
    displayName: issueName,
    description: truncatedIssueBody,
    number: data.number,
    databaseId: data.databaseId,
    title: data.title,
    state: data.state,
    locked: data.locked,
    closed: data.closed,
    createdOn: parseTimePropertyValue(data.createdAt),
    updatedOn: parseTimePropertyValue(data.updatedAt),
    closedOn: parseTimePropertyValue(data.closedAt),
    authorAssociation: data.authorAssociation,
    activeLockReason: data.activeLockReason,
    body: truncatedIssueBody,
    createdViaEmail: data.createdViaEmail,
    pinned: data.isPinned,
    lastEditedOn: parseTimePropertyValue(data.lastEditedAt),
    publishedOn: parseTimePropertyValue(data.publishedAt),
    resourcePath: data.resourcePath,
    labels: labels,
  };

  setRawData(issueEntity, {
    name: 'default',
    rawData: {
      ...data,
      // Explicitly remove these from raw data because these property values
      // can be large, and there is no reason to copy the values into the raw
      // data.
      body: undefined,
      bodyText: undefined,
    },
  });

  return issueEntity;
}

/**
 * Maps response data to entity
 * Note: Fields state, fixedOn, and number
 *       are not supported in GHE Server version <3.5.0.
 * @param data
 * @param baseUrl
 */
export function createVulnerabilityAlertEntity(
  data: VulnerabilityAlertResponse,
  baseUrl: string,
) {
  return createIntegrationEntity({
    entityData: {
      source: data,
      assign: {
        _type: GithubEntities.GITHUB_VULNERABILITY_ALERT._type,
        _class: GithubEntities.GITHUB_VULNERABILITY_ALERT._class,
        _key: buildVulnAlertId(data),
        id: data.id,
        name: data.securityAdvisory?.summary,
        displayName: data.securityAdvisory?.summary,
        description: data.securityAdvisory?.description,
        category: 'application',
        status: data.state,
        severity: data.securityVulnerability?.severity,
        dependencyScope: data.dependencyScope,
        numericSeverity: data.securityAdvisory?.cvss.score,
        priority: data.securityVulnerability?.severity,
        score: data.securityAdvisory?.cvss.score,
        impact: data.securityAdvisory?.summary,
        vector: data.securityAdvisory?.cvss.vectorString || '',
        recommendation: buildVulnAlertRecommendation(data),
        open: data.state
          ? data.state === RepositoryVulnerabilityAlertState.Open
          : !data.dismissedAt,
        references: data.securityAdvisory?.references?.map((ref) => ref.url),
        public: data.securityAdvisory?.identifiers?.some(
          (identifier) => identifier.type === 'CVE',
        ),
        weblink: apiUrlToWebLink(
          baseUrl,
          `/${data.repository.nameWithOwner}/security/dependabot/${
            data.number ?? ''
          }`,
        ),
        createdOn: parseTimePropertyValue(data.createdAt),
        dismissedOn: parseTimePropertyValue(data.dismissedAt),
        dismisserLogin: data.dismisser?.login,
        dismissReason: data.dismissReason,
        fixedOn: parseTimePropertyValue(data.fixedAt),
        number: data.number,
        databaseId: data.securityAdvisory?.databaseId,
        ghsaId: data.securityAdvisory?.ghsaId,
        origin: data.securityAdvisory?.origin,
        securityAdvisoryPublishedOn: parseTimePropertyValue(
          data.securityAdvisory?.publishedAt,
        ),
        securityAdvisoryUpdatedOn: parseTimePropertyValue(
          data.securityAdvisory?.updatedAt,
        ),
        securityAdvisoryWithdrawnOn: parseTimePropertyValue(
          data.securityAdvisory?.withdrawnAt,
        ),
        vulnerablePackageName: data.securityVulnerability?.package.name,
        vulnerablePackageEcosystem:
          data.securityVulnerability?.package.ecosystem,
        vulnerableVersionRange:
          data.securityVulnerability?.vulnerableVersionRange,
        vulnerableManifestFilename: data.vulnerableManifestFilename,
        vulnerableManifestPath: data.vulnerableManifestPath,
        vulnerableRequirements: data.vulnerableRequirements,
      },
    },
  });
}

export function createCveEntity(
  cve: { type: string; value: string },
  cvss?: { score: number; vectorString: string },
): Entity {
  const cveId = cve.value.toLowerCase();
  const cveIdDisplay = cveId.toUpperCase();

  return createIntegrationEntity({
    entityData: {
      source: cve,
      assign: {
        _type: GithubEntities.CVE._type,
        _class: GithubEntities.CVE._class,
        _key: cveId,
        id: cveId,
        name: cveIdDisplay,
        displayName: cveIdDisplay,
        cvssScore: cvss?.score,
        references: [`https://nvd.nist.gov/vuln/detail/${cveId}`],
        webLink: `https://nvd.nist.gov/vuln/detail/${cveId}`,
      },
    },
  });
}

type VulnerabilityAlertCweResponse = {
  cweId: string;
  name: string;
  description: string;
};

export function createCweEntity(cwe: VulnerabilityAlertCweResponse) {
  const cweNumber = cwe.cweId.replace(/^\D+/g, '');
  const cweId = cwe.cweId.toLowerCase();

  return createIntegrationEntity({
    entityData: {
      source: cwe,
      assign: {
        _type: GithubEntities.CWE._type,
        _class: GithubEntities.CWE._class,
        _key: cweId,
        id: cweId,
        name: cwe.name,
        displayName: cwe.cweId.toUpperCase(),
        description: cwe.description,
        references: [
          `https://cwe.mitre.org/data/definitions/${cweNumber}.html`,
        ],
        webLink: `https://cwe.mitre.org/data/definitions/${cweNumber}.html`,
      },
    },
  });
}

export function createFindingCveRelationship(
  findingEntity: VulnerabilityAlertEntity,
  cveEntity,
): Relationship {
  return createMappedRelationship({
    source: findingEntity,
    _class: RelationshipClass.IS,
    _type: MappedRelationships.FINDING_IS_CVE._type,
    target: {
      _key: cveEntity._key,
      _type: cveEntity._type,
      _class: cveEntity._class,
      id: cveEntity.id,
      displayName: cveEntity.displayName,
      name: cveEntity.name,
      cvssScore: cveEntity.cvssScore,
      webLink: cveEntity.webLink,
      references: cveEntity.references,
    },
    relationshipDirection: RelationshipDirection.FORWARD,
    skipTargetCreation: false,
  });
}

export function createFindingCweRelationship(
  findingEntity: VulnerabilityAlertEntity,
  cweEntity,
): Relationship {
  return createMappedRelationship({
    source: findingEntity,
    _class: RelationshipClass.EXPLOITS,
    _type: MappedRelationships.FINDING_EXPLOITS_CWE._type,
    target: {
      _key: cweEntity._key,
      _type: cweEntity._type,
      _class: cweEntity._class,
      id: cweEntity.id,
      displayName: cweEntity.displayName,
      name: cweEntity.name,
      webLink: cweEntity.webLink,
      description: cweEntity.description,
      references: cweEntity.references,
    },
    relationshipDirection: RelationshipDirection.FORWARD,
    skipTargetCreation: false,
  });
}

export function createRepoAllowsTeamRelationship(
  repoId: string,
  teamKey: string,
  permission: string,
): RepoAllowRelationship {
  let admin = false;
  let maintain = false;
  let push = false;
  let triage = false;
  if (permission === 'TRIAGE') {
    triage = true;
  }
  if (permission === 'WRITE') {
    triage = true;
    push = true;
  }
  if (permission === 'MAINTAIN') {
    triage = true;
    push = true;
    maintain = true;
  }
  if (permission === 'ADMIN') {
    triage = true;
    push = true;
    maintain = true;
    admin = true;
  }
  return {
    _key: `${repoId}|allows|${teamKey}`,
    _class: RelationshipClass.ALLOWS,
    _type: Relationships.REPO_ALLOWS_TEAM._type,
    _fromEntityKey: repoId,
    _toEntityKey: teamKey,
    displayName: RelationshipClass.ALLOWS,
    role: permission,
    adminPermission: admin,
    maintainPermission: maintain,
    pushPermission: push,
    triagePermission: triage,
    pullPermission: true, //always true if there is a relationship
  };
}

export function createRepoAllowsUserRelationship(
  repoId: string,
  userEntityKey: string,
  permission: string,
): RepoAllowRelationship {
  const adminPermission = permission === 'ADMIN';
  const maintainPermission = adminPermission || permission === 'MAINTAIN';
  const pushPermission = maintainPermission || permission === 'WRITE';
  const triagePermission = pushPermission || permission === 'TRIAGE';
  return {
    _key: `${repoId}|allows|${userEntityKey}`,
    _class: RelationshipClass.ALLOWS,
    _type: Relationships.REPO_ALLOWS_USER._type,
    _fromEntityKey: repoId,
    _toEntityKey: userEntityKey,
    displayName: RelationshipClass.ALLOWS,
    role: permission,
    adminPermission: adminPermission,
    maintainPermission: maintainPermission,
    pushPermission: pushPermission,
    triagePermission: triagePermission,
    pullPermission: true, //always true if there is a relationship
  };
}

//PRs and Issues in GitHub are both types of Issues
export function createUnknownUserIssueRelationship(
  unknownLogin: string,
  relationshipType: string,
  relationshipClass: string,
  issueKey: string,
): MappedRelationship {
  //used to create a mapped relationship to an unknown GitHub user who worked on a PR or an Issue in the past
  //they may no longer be a collaborator or org member, so make a mapped relationship - this will create a placeholder entity,
  //or map to a `github_user` that might be found some other way
  //it will also map to known users if for some reason a current member or collaborator is passed to this function
  return {
    _key: `${unknownLogin}|${relationshipClass.toLowerCase()}|${issueKey}`,
    _type: relationshipType,
    _class: relationshipClass,
    _mapping: {
      sourceEntityKey: issueKey,
      relationshipDirection: RelationshipDirection.REVERSE,
      targetFilterKeys: [['_type', 'login']],
      targetEntity: {
        _class: 'User',
        _type: GithubEntities.GITHUB_MEMBER._type,
        login: unknownLogin,
      },
      skipTargetCreation: false,
    },
    displayName: relationshipClass,
  };
}

export type PullRequestKey = {
  login: string;
  repoName: string;
  pullRequestNumber: number;
};

export function buildPullRequestKey({
  login,
  repoName,
  pullRequestNumber,
}: PullRequestKey): string {
  return `${login}/${repoName}/pull-requests/${pullRequestNumber}`;
}

/**
 * Creates a relationship between two Pull Requests where commits build on each other.
 * This is commonly caused by sharing commits from a series of branches.
 * PR1 - Branch A -> main with commit {A}
 * PR2 - Branch B -> main with commits {A, B}
 * PR3 - Branch C -> main with commits {A, B, C}
 *
 * When Branch C is merged (via PR3), PR1 and PR2 are automatically set to "merged"
 * because their commits now exist in main. This must be a GitHub feature
 */
export function createAssociatedMergePullRequestRelationship(
  pullRequest: PullRequestResponse,
) {
  if (!pullRequest.mergeCommit?.associatedPullRequest?.number) {
    throw new Error('number is required on the associated pull request');
  }
  if (pullRequest.id === pullRequest.mergeCommit.associatedPullRequest.id) {
    throw new Error(
      'associated pull request must be different than source pull request.',
    );
  }

  return createDirectRelationship({
    _class: RelationshipClass.CONTAINS,
    toType: GithubEntities.GITHUB_PR._type,
    toKey: buildPullRequestKey({
      login: pullRequest.baseRepository.owner.login,
      repoName: pullRequest.baseRepository.name,
      pullRequestNumber: pullRequest.number,
    }),
    fromType: GithubEntities.GITHUB_PR._type,
    fromKey: buildPullRequestKey({
      login: pullRequest.baseRepository.owner.login,
      repoName: pullRequest.baseRepository.name,
      pullRequestNumber: pullRequest.mergeCommit?.associatedPullRequest?.number,
    }),
    properties: {
      sharedCommit: pullRequest.mergeCommit.commitUrl,
      sharedCommitOid: pullRequest.mergeCommit.oid,
    },
  });
}

interface PullRequestConverterParams {
  pullRequest: PullRequestResponse;
  commits: Commit[];
  labels: Label[];
  reviews: Review[];
  teamMembersByLoginMap: IdEntityMap<Entity['_key']>; //
  allKnownUsersByLoginMap: IdEntityMap<Entity['_key']>; // Includes known collaborators
}

export function toPullRequestEntity({
  pullRequest,
  commits,
  labels: labelEntities,
  reviews,
  teamMembersByLoginMap,
  allKnownUsersByLoginMap,
}: PullRequestConverterParams): PullRequestEntity {
  const labels = labelEntities.map((l) => l.name);

  // Private repo PRs don't have access to commits.
  const hasCommits = Array.isArray(commits) && commits.length > 0;

  const approvals = reviews
    ?.filter(isApprovalReview)
    .reduce(convertToApproval, [])
    .filter(
      (approval) =>
        hasTeamMemberApprovals(approval, teamMembersByLoginMap) &&
        noSelfApprovals(approval, commits ?? []),
    );

  const approvedCommits =
    commits && getCommitsToDestination(commits, last(approvals)?.commit);
  const approvedCommitHashes = approvedCommits?.map((c) => c.oid);
  const commitHashes = commits?.map((c) => c.oid);
  const commitsNotApproved = commitHashes?.filter(
    (c) => !approvedCommitHashes?.includes(c),
  );
  const commitsByUnknownAuthor = commits?.filter((commit) =>
    fromUnknownAuthor(commit, allKnownUsersByLoginMap),
  );
  const commitsCount = commits ? commits.length : 0;
  const approvalsCount = reviews ? reviews.filter(isApprovalReview).length : 0;

  let approvalLastAt: number | undefined = undefined;
  if (approvedCommits) {
    const commitTimes = approvedCommits?.map(
      (c) => parseTimePropertyValue(c.authoredDate) || 0,
    );
    let maxTime = 0;
    if (commitTimes) {
      maxTime = Math.max(...commitTimes);
    }
    if (maxTime > 0) {
      approvalLastAt = maxTime;
    }
  }

  return createIntegrationEntity({
    entityData: {
      source: pullRequest,
      assign: {
        _type: GithubEntities.GITHUB_PR._type,
        _class: GithubEntities.GITHUB_PR._class,
        _key: buildPullRequestKey({
          login: pullRequest.baseRepository.owner.login,
          repoName: pullRequest.baseRepository.name,
          pullRequestNumber: pullRequest.number,
        }),
        displayName: `${pullRequest.baseRepository.name}/${pullRequest.number}`,
        accountLogin: pullRequest.baseRepository.owner.login,
        repository: pullRequest.baseRepository.name,
        // The number is NOT the id of the Pull Request. Hopefully no one gets bit from that later
        id: pullRequest.number ? String(pullRequest.number) : '',
        number: pullRequest.number,
        // This is actually what the pull request id is...
        pullRequestId: pullRequest.id,
        name: pullRequest.title,
        title: pullRequest.title,
        description:
          pullRequest.body && pullRequest.body.length > 0
            ? `${pullRequest.body.substring(0, 80)}...`
            : undefined,
        databaseId: pullRequest.databaseId,
        webLink: pullRequest.url,
        labels: labels,
        filesChangedCount: pullRequest.changedFiles,

        state: pullRequest.state,
        open: pullRequest.state === 'OPEN',
        mergeCommitHash: pullRequest.mergeCommit?.oid,
        merged: pullRequest.merged,
        mergedBy: pullRequest.mergedBy?.name ?? pullRequest.mergedBy?.login,
        mergedByLogin: pullRequest.mergedBy?.login,
        node: pullRequest.id,
        declined: pullRequest.state === 'CLOSED' && !pullRequest.merged,
        approved: pullRequest.reviewDecision === 'APPROVED',
        allCommitsApproved:
          hasCommits && commitsNotApproved
            ? commitsNotApproved.length === 0
            : undefined,

        commits: commitHashes,
        commitsCount: commitsCount,
        commitMessages: commits?.map((c) => c.message),
        commitsApproved: approvedCommitHashes,
        commitsNotApproved,
        commitsByUnknownAuthor: commitsByUnknownAuthor?.map((c) => c.oid),
        validated: commitsByUnknownAuthor
          ? commitsByUnknownAuthor.length === 0
          : undefined,

        source: pullRequest.headRefName,
        target: pullRequest.baseRefName,

        sourceRefOid: pullRequest.headRefOid,
        targetRefOid: pullRequest.baseRefOid,

        createdOn: parseTimePropertyValue(pullRequest.createdAt),
        updatedOn: parseTimePropertyValue(pullRequest.updatedAt),
        mergedOn: parseTimePropertyValue(pullRequest.mergedAt),

        authorLogin: pullRequest.author?.login ?? '',
        author: pullRequest.author?.name ?? pullRequest.author?.login ?? '',

        reviewerLogins:
          reviews &&
          compact(uniq(reviews.map((review) => review.author?.login))),
        reviewers:
          reviews &&
          compact(uniq(reviews.map((review) => review.author?.name))),
        approvalsCount: approvalsCount,
        approvalLastAt: approvalLastAt,
        approverLogins:
          reviews &&
          compact(
            uniq(reviews.filter(isApprovalReview).map((r) => r.author?.login)),
          ),
        approvers:
          reviews &&
          compact(
            uniq(reviews.filter(isApprovalReview).map((r) => r.author?.name)),
          ),
      },
    },
  }) as PullRequestEntity;
}

/**
 * PULL REQUEST HELPER FUNCTIONS
 */
export interface Approval {
  commit: string;
  approverUsernames: string[];
}

function isApprovalReview(review: Review) {
  return ['APPROVED', 'DISMISSED'].includes(review.state); // Not sure why dismissed is an approved state to be honest
}

function noSelfApprovals(approval: Approval, commits: Commit[]) {
  const associatedCommits = getCommitsToDestination(commits, approval.commit);
  const commitAuthors =
    associatedCommits?.reduce(
      (authors: string[], commit) => [
        ...authors,
        commit.author.user?.login ? commit.author.user?.login : '',
      ],
      [],
    ) ?? [];
  const validApprovers = approval.approverUsernames.filter(
    (approver) => !commitAuthors.includes(approver),
  );
  return validApprovers.length > 0;
}

function hasTeamMemberApprovals(
  approval: Approval,
  teamMembersByLoginMap: IdEntityMap<Entity['_key']>,
) {
  return approval.approverUsernames.some((approver) =>
    teamMembersByLoginMap.has(approver),
  );
}

function fromUnknownAuthor(
  commit: Commit,
  allKnownUsersByLoginMap: IdEntityMap<Entity['_key']>,
) {
  return (
    !commit.author?.user?.login ||
    !allKnownUsersByLoginMap.has(commit.author.user?.login)
  );
}

function convertToApproval(approvals: Approval[], approvalReview: Review) {
  if (!approvalReview.author?.login || !approvalReview.commit?.oid) {
    // If an approval has no user or no commit, don't count it as valid
    return approvals;
  }
  const existingApproval = approvals.find(
    (approval) => approval.commit === approvalReview.commit!.oid,
  );
  if (existingApproval) {
    existingApproval.approverUsernames.push(approvalReview.author.login);
    return approvals;
  } else {
    const approval: Approval = {
      commit: approvalReview.commit.oid,
      approverUsernames: [approvalReview.author.login],
    };
    return [...approvals, approval];
  }
}

/**
 * Converts the supplied api url to the appropriate web link.
 * Weblinks have different paths for cloud vs self-hosted (GHE server).
 * @param apiBaseUrl
 * @param path
 */
function apiUrlToWebLink(apiBaseUrl: string, path: string): string {
  if (apiBaseUrl.includes('api.github.com')) {
    return 'https://github.com' + path;
  } else {
    return apiBaseUrl + path;
  }
}
