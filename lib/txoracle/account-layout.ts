import idl from "@/lib/idl/txoracle-devnet.json";

export const ANCHOR_ACCOUNT_DISCRIMINATOR_SIZE = 8;

interface IdlField {
  name: string;
  type: unknown;
}

interface IdlTypeDef {
  name: string;
  type: {
    kind: string;
    fields?: IdlField[];
  };
}

const typeDefs = (idl as { types: IdlTypeDef[] }).types;

function typeSize(type: unknown): number {
  if (typeof type === "string") {
    switch (type) {
      case "u8":
      case "i8":
      case "bool":
        return 1;
      case "u16":
      case "i16":
        return 2;
      case "u32":
      case "i32":
        return 4;
      case "u64":
      case "i64":
        return 8;
      case "pubkey":
        return 32;
      default:
        throw new Error(`Unsupported primitive type: ${type}`);
    }
  }

  if (typeof type === "object" && type !== null) {
    const record = type as Record<string, unknown>;

    if ("array" in record && Array.isArray(record.array)) {
      const [element, length] = record.array as [unknown, number];
      return typeSize(element) * length;
    }

    if ("option" in record) {
      return 1 + typeSize(record.option);
    }

    if ("defined" in record) {
      const defined = record.defined as { name: string };
      const def = typeDefs.find((t) => t.name === defined.name);
      if (!def) {
        throw new Error(`Unknown defined type: ${defined.name}`);
      }
      if (def.type.kind === "enum") {
        return 1;
      }
      if (def.type.kind === "struct" && def.type.fields) {
        return def.type.fields.reduce((sum, field) => sum + typeSize(field.type), 0);
      }
      throw new Error(`Unsupported defined type kind: ${def.type.kind}`);
    }

    if ("vec" in record) {
      throw new Error("vec types are not supported in account layout offsets");
    }
  }

  throw new Error(`Unsupported type: ${JSON.stringify(type)}`);
}

export function fieldOffset(structName: string, fieldName: string): number {
  const def = typeDefs.find((t) => t.name === structName);
  if (!def?.type.fields) {
    throw new Error(`Struct not found: ${structName}`);
  }

  let offset = ANCHOR_ACCOUNT_DISCRIMINATOR_SIZE;
  for (const field of def.type.fields) {
    if (field.name === fieldName) {
      return offset;
    }
    offset += typeSize(field.type);
  }

  throw new Error(`Field ${fieldName} not found on ${structName}`);
}

export const ORDER_INTENT_MAKER_OFFSET = fieldOffset("OrderIntent", "maker");
export const MATCHED_TRADE_MAKER_OFFSET = fieldOffset("MatchedTrade", "maker");
export const MATCHED_TRADE_TAKER_OFFSET = fieldOffset("MatchedTrade", "taker");

if (process.env.NODE_ENV !== "production") {
  if (ORDER_INTENT_MAKER_OFFSET !== 8) {
    throw new Error(
      `ORDER_INTENT_MAKER_OFFSET expected 8, got ${ORDER_INTENT_MAKER_OFFSET}`,
    );
  }
  if (MATCHED_TRADE_MAKER_OFFSET !== 16) {
    throw new Error(
      `MATCHED_TRADE_MAKER_OFFSET expected 16, got ${MATCHED_TRADE_MAKER_OFFSET}`,
    );
  }
  if (MATCHED_TRADE_TAKER_OFFSET !== 48) {
    throw new Error(
      `MATCHED_TRADE_TAKER_OFFSET expected 48, got ${MATCHED_TRADE_TAKER_OFFSET}`,
    );
  }
}
