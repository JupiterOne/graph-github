import {
  ResourceMetadata,
  ResourceMap,
  CursorHierarchy,
  GithubResource,
} from './types';

/**
 * Extract all cursors from a graphQL cursor hierarchy response.
 * This extracts outer cursors and inner cursors.
 */
export function mapResponseCursorsForQuery(
  pageCursors: ResourceMap<CursorHierarchy>,
): ResourceMap<string> {
  function cursorsFromHierarchy(
    hierarchy: CursorHierarchy,
    key: string,
  ): ResourceMap<string> {
    const cursors: ResourceMap<string> = {};

    // Then check if you have your own cursor.
    if (hierarchy.self) {
      cursors[key] = hierarchy.self;
    }
    // Finally, set the children
    if (Object.keys(hierarchy.children).length > 0) {
      for (const [resource, childrenHierarchies] of Object.entries(
        hierarchy.children,
      )) {
        // The childrenHierarchy will always only have a length of 1 because we
        // will continue pulling that child until it stops showing up, which will
        // happen when its paging ends (hasNextPage = false).
        const firstAndOnlyChild = childrenHierarchies[0];
        Object.assign(
          cursors,
          cursorsFromHierarchy(firstAndOnlyChild, resource),
        );
      }
    }

    return cursors;
  }

  const flatCursors: ResourceMap<string> = {};
  for (const [resource, cursorHierarchy] of Object.entries(pageCursors)) {
    Object.assign(flatCursors, cursorsFromHierarchy(cursorHierarchy, resource));
  }

  return flatCursors;
}

/**
 * Recursively check a graphQL cursor hierarchy response to see if
 * any resource has a nextPage.
 */
export function responseHasNextPage(pageCursors: ResourceMap<CursorHierarchy>) {
  function hasNextPageInHierarchy(hierarchy: CursorHierarchy) {
    if (hierarchy.hasNextPage) {
      return true;
    } else if (Object.keys(hierarchy.children).length > 0) {
      for (const childrenHierarchies of Object.values(hierarchy.children)) {
        for (const childHierarchy of childrenHierarchies) {
          if (hasNextPageInHierarchy(childHierarchy)) {
            return true;
          }
        }
      }
      return false;
    }
  }
  for (const cursorHierarchy of Object.values(pageCursors)) {
    if (hasNextPageInHierarchy(cursorHierarchy)) {
      return true;
    }
  }
  return false;
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

/**
 * Flattens the graphQL response to a single-layer map of resources
 * and returns any cursors that can be used to get more data.
 */
export function processGraphQlPageResult(
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

  if (data.team) {
    // mutate data to fit expectations
    // this is a hack that allows us to use a new query format, before we rewrite the cursor handlers
    if (data.team.repositories) {
      data.teams = {
        edges: [
          {
            node: {
              id: data.team.id,
              name: data.team.name,
              repositories: data.team.repositories,
            },
          },
        ],
        pageInfo: {
          endCursor: 'ZZZ==',
          hasNextPage: false,
        },
      };
    }
    if (data.team.members) {
      data.teams = {
        edges: [
          {
            node: {
              id: data.team.id,
              name: data.team.name,
              repositories: data.team.members,
            },
          },
        ],
        pageInfo: {
          endCursor: 'ZZZ==',
          hasNextPage: false,
        },
      };
    }
    delete data.team;
  }

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
