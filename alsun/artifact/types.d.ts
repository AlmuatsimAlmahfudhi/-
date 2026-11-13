declare module "*.sql" {
  const s: string;
  export default s;
}
declare module "sql.js/dist/sql-wasm-inline.js" {
  import initSqlJs from "sql.js";
  export default initSqlJs;
}
declare module "hanzi-writer/dist/index.esm.js" {
  import HanziWriter from "hanzi-writer";
  export default HanziWriter;
}
