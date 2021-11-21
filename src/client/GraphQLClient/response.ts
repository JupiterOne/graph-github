import { get } from 'lodash';
import {
  ResourceMetadata,
  ResourceMap,
  CursorHierarchy,
  GithubResource,
  Node,
} from './types';

// TODO: Why accumulate queryCursors? Can we not simply extract the cursors from
// the last response without keeping any history?
export function mapResponseCursorsForQuery(
  pageCursors: ResourceMap<CursorHierarchy>,
  queryCursors: ResourceMap<string>,
): ResourceMap<string> {
  function cursorsFromHierarchy(
    hierarchy: CursorHierarchy,
    key: string,
    queryCursors: ResourceMap<string>,
  ): ResourceMap<string> {
    let cursors: ResourceMap<string> = {};

    if (Object.keys(hierarchy.children).length > 0) {
      for (const [resource, childrenHierarchies] of Object.entries(
        hierarchy.children,
      )) {
        // Use the first child hierarchy until it stops showing up, which will
        // happen when its paging ends (hasNextPage = false).
        const first = childrenHierarchies[0];
        cursors = {
          ...cursors,
          ...cursorsFromHierarchy(first, resource, queryCursors),
        };
      }

      if (queryCursors[key]) {
        cursors[key] = queryCursors[key];
      } else {
        if (hierarchy.self) {
          cursors[key] = hierarchy.self;
        }
      }
    } else if (hierarchy.self) {
      cursors[key] = hierarchy.self;
    }

    return cursors;
  }

  let flatCursors: ResourceMap<string> = {};
  for (const [resource, cursorHierarchy] of Object.entries(pageCursors)) {
    flatCursors = {
      ...flatCursors,
      ...cursorsFromHierarchy(cursorHierarchy, resource, queryCursors),
    };
  }

  return flatCursors;
}

export function mapResponseResourcesForQuery(
  cursors: ResourceMap<CursorHierarchy>,
  resourceMetadataMap: ResourceMap<ResourceMetadata>,
  selectedResources: GithubResource[],
): string[] {
  const resources: string[] = [];
  for (const [resource, hierarchy] of Object.entries(cursors)) {
    resources.push(resource);
    resources.push(
      ...addResourcesFromHierarchy(
        resource,
        hierarchy,
        resourceMetadataMap,
        selectedResources,
      ),
    );
  }

  return resources;
}

export function extractSelectedResources(
  selectedResources: GithubResource[],
  resourceMetadataMap: ResourceMap<ResourceMetadata>,
  data: any,
  base: GithubResource,
): {
  resources: ResourceMap<any>;
  cursors: ResourceMap<CursorHierarchy>;
} {
  const { resources, cursors } = extractSelectedResourceFromData(
    data,
    resourceMetadataMap,
    {},
    {},
    selectedResources,
    base,
  );

  return {
    resources,
    cursors,
  };
}

function extractSelectedResourceFromData(
  data: { [key: string]: any },
  resourceMetadataMap: ResourceMap<ResourceMetadata>,
  resources: ResourceMap<any>,
  cursors: ResourceMap<CursorHierarchy>,
  selectedResources: GithubResource[],
  selectedResource: GithubResource,
  parentResource?: [GithubResource, string],
  edge?: any,
): {
  resources: ResourceMap<any>;
  cursors: ResourceMap<CursorHierarchy>;
} {
  const node: { [key: string]: any } = { ...edge };

  if (data) {
    for (const [key, value] of Object.entries(data)) {
      if (value && typeof value === 'object' && value.edges) {
        const nestedResource = Object.keys(resourceMetadataMap).find(
          (resourceKey) => {
            return (
              (resourceMetadataMap[resourceKey].alternateGraphProperty ??
                resourceKey) === key &&
              (!resourceMetadataMap[resourceKey].parent ||
                (!!parentResource &&
                  resourceMetadataMap[resourceKey].parent === selectedResource))
            );
          },
        ) as GithubResource | undefined;
        if (!nestedResource) {
          continue;
        }

        const selected = selectedResources.includes(nestedResource);
        const resourceMetadata = resourceMetadataMap[nestedResource];
        const childSelected =
          resourceMetadata.children &&
          resourceMetadata.children.reduce((cs: boolean, child) => {
            return cs || selectedResources.includes(child);
          }, false);

        if (!selected && !childSelected) {
          continue;
        }

        if (parentResource) {
          if (!cursors[selectedResource]) {
            cursors[selectedResource] = { self: null, children: {} };
          }

          const parentCursorHierarchy = cursors[selectedResource];

          if (!parentCursorHierarchy.children[nestedResource]) {
            parentCursorHierarchy.children[nestedResource] = [];
          }

          parentCursorHierarchy.children[nestedResource].push({
            self: value.pageInfo.endCursor,
            children: {},
            hasNextPage: value.pageInfo.hasNextPage,
          });
        } else {
          cursors[nestedResource] = {
            self: value.pageInfo.endCursor,
            children: {},
            hasNextPage: value.pageInfo.hasNextPage,
          };
        }

        for (const child of value.edges) {
          const response = extractSelectedResourceFromData(
            child.node,
            resourceMetadataMap,
            resources,
            cursors,
            selectedResources,
            nestedResource,
            [selectedResource, node.id],
            { ...child, node: undefined },
          );
          resources = response.resources;
          cursors = response.cursors;
        }

        continue;
      }

      node[key] = value;
    }
  }

  if (parentResource) {
    const [parent, parentId] = parentResource;
    node[parent] = parentId;
  }

  resources[selectedResource]
    ? resources[selectedResource].push(node)
    : (resources[selectedResource] = [node]);

  return {
    resources,
    cursors,
  };
}

function addResourcesFromHierarchy(
  key: string,
  hierarchy: CursorHierarchy,
  resourceMetadataMap: ResourceMap<ResourceMetadata>,
  selectedResources: GithubResource[],
): string[] {
  if (!(Object.keys(hierarchy.children).length > 0)) {
    const metadata = resourceMetadataMap[key];
    if (metadata.children && hierarchy.self) {
      return selectedResources.filter((sr) => metadata.children!.includes(sr));
    } else {
      return [];
    }
  }

  const resources: string[] = [];
  for (const [childResource, childHierarchies] of Object.entries(
    hierarchy.children,
  )) {
    resources.push(childResource);
    for (const childHierarchy of childHierarchies) {
      resources.push(
        ...addResourcesFromHierarchy(
          childResource,
          childHierarchy,
          resourceMetadataMap,
          selectedResources,
        ),
      );
    }
  }

  return resources;
}

export type ExtractDataFromGraphQLResponse<T extends Node> = {
  resourceMetadataMap: ResourceMap<ResourceMetadata>;
  baseResource: GithubResource;
  selectedResources: GithubResource[];
  response: any;
  queryCursors: ResourceMap<string>;
  accumulatedResources: ResourceMap<T[]>;
};

export function extractDataFromGraphQLResponse<T extends Node>({
  resourceMetadataMap,
  baseResource,
  selectedResources,
  response,
  queryCursors,
  accumulatedResources,
}: ExtractDataFromGraphQLResponse<T>) {
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

  const resources = extractPageResources({
    resourceMetadataMap,
    pageResources,
    accumulatedResources,
  });

  const responseCursors = mapResponseCursorsForQuery(pageCursors, queryCursors);

  return {
    resources,
    pageCursors,
    queryCursors: responseCursors,
  };
}

export type ExtractPageResourcesParams<T> = {
  resourceMetadataMap: ResourceMap<ResourceMetadata>;
  pageResources: ResourceMap<T[]>;
  accumulatedResources: ResourceMap<T[]>;
};

export function extractPageResources<T extends Node>({
  resourceMetadataMap,
  pageResources,
  accumulatedResources,
}: ExtractPageResourcesParams<T>): ResourceMap<T[]> {
  for (const [resource, data] of Object.entries(pageResources)) {
    if (!accumulatedResources[resource]) {
      accumulatedResources[resource] = data;
      continue;
    }
    for (const item of data) {
      if (
        !accumulatedResources[resource].find((r: T) => {
          const found = r.id === item.id; // This is enforced with the Node type
          const metadata = resourceMetadataMap[resource];
          if (metadata && metadata.parent) {
            return found && r[metadata.parent] === item[metadata.parent];
          } else {
            return found;
          }
        })
      ) {
        accumulatedResources[resource].push(item);
      }
    }
  }
  return accumulatedResources;
}

export function hasMoreResources(
  pageCursors: ResourceMap<CursorHierarchy>,
): boolean {
  return Object.values(pageCursors).some((c) => c.hasNextPage);
}
