import {
  ResourceMetadata,
  ResourceMap,
  CursorHierarchy,
  GithubResource,
} from './types';

export function mapResponseCursorsForQuery(
  cursors: ResourceMap<CursorHierarchy>,
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
      }
    } else if (hierarchy.self) {
      cursors[key] = hierarchy.self;
    }

    return cursors;
  }

  let flatCursors: ResourceMap<string> = {};
  for (const [resource, cursorHierarchy] of Object.entries(cursors)) {
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

      if (value.pageInfo && value.pageInfo.hasNextPage) {
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
          });
        } else {
          cursors[nestedResource] = {
            self: value.pageInfo.endCursor,
            children: {},
          };
        }
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
