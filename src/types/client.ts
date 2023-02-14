import { RestEndpointMethodTypes } from '@octokit/rest';

/*
 * A feature used repeatedly here is lookup types, which allows you to get T
 * from Array<T>.
 *
 * https://www.typescriptlang.org/docs/handbook/release-notes/typescript-2-1.html#keyof-and-lookup-types
 */
export type AppsGetInstallationResponse =
  RestEndpointMethodTypes['apps']['getInstallation']['response']['data'];
