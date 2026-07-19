import "server-only";

export function toDomain<T>(value: unknown): T {
  const object = value as Record<string, unknown>;
  const domain = { ...object };
  delete domain._id;
  delete domain.__v;
  return domain as T;
}
