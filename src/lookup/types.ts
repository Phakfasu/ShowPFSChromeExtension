export type DialectCode = "siyen" | "namSiyen";

export interface DictEntry {
  dialect: DialectCode;
  seq: number;
  term: string;
  reading: string;
  readingSymbol: string;
  pfs: string;
  pfsInput: string;
  gloss: string;
  example: string;
}

export interface DictIndex {
  version: string;
  entries: DictEntry[];
  keys: Record<string, number[]>;
  keysFolded: Record<string, number[]>;
}
