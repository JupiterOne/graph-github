import { get } from 'lodash';
import { extractSelectedResources } from '../response';

const response = require('./collaborator-query-response.json');
const resourceMetadataMap = require('./metadata-map.json');
const selectedResources = ['collaborators'] as any;
const baseResource = 'organization' as any;

describe('it', () => {
  test('stuff', () => {
    const pathToData =
      resourceMetadataMap[baseResource].pathToDataInGraphQlResponse;
    const data = pathToData ? get(response, pathToData) : response;

    const { resources: pageResources, cursors: pageCursors } =
      extractSelectedResources(
        selectedResources,
        resourceMetadataMap,
        data,
        baseResource,
      );

    resources = this.extractPageResources(pageResources, resources);
    const resourceNums: Record<string, number> = {};
    for (const res of selectedResources) {
      if (Array.isArray(resources[res])) {
        resourceNums[res] = resources[res].length;
      }
    }

    this.logger.info(
      { rateLimit, queryCursors, pageCursors, resourceNums },
      `Rate limit response for iteration`,
    );

    queryCursors = mapResponseCursorsForQuery(pageCursors, queryCursors);

    hasMoreResources = Object.values(pageCursors).some((c) => c.hasNextPage);
  });
});
