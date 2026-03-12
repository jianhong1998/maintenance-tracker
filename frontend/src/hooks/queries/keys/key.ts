export const QueryType = Object.freeze({
  LIST: 'list',
  ONE: 'one',
} as const);
export type QueryType = (typeof QueryType)[keyof typeof QueryType];

export const QueryGroup = Object.freeze({
  HEALTH_CHECK: 'health-check',
} as const);
export type QueryGroup = (typeof QueryGroup)[keyof typeof QueryGroup];

export const getQueryKey = (params: {
  group: QueryGroup;
  type: QueryType;
  subTypes?: string[];
  key: string | Record<string, unknown>;
}): (string | object)[] => {
  const { group, key, type, subTypes } = params;

  return [group, type, ...(subTypes ?? []), key] as const;
};
