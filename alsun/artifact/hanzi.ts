import HanziWriter from "hanzi-writer/dist/index.esm.js";
import data from "./.gen/hanzi-data.json";

const DATA = data as Record<string, unknown>;
type Opts = Record<string, unknown>;
export default {
  create(el: HTMLElement, char: string, opts: Opts) {
    return HanziWriter.create(el, char, {
      ...opts,
      charDataLoader: (c: string, onLoad: (d: unknown) => void, onError: (e: unknown) => void) => (DATA[c] ? onLoad(DATA[c]) : onError(new Error("missing"))),
    } as never);
  },
};
