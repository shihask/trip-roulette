// Runs supabase/tests/database/*.test.sql against the linked project without Docker.
// `supabase db query` returns only the last result, so each assertion is collected into a
// temp table and returned at the end. The transaction is never committed (closing the
// connection rolls it back). Usage: npm run test:db
import { execFileSync } from "node:child_process";
import { mkdtempSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

const dir = "supabase/tests/database";
const tmp = mkdtempSync(join(tmpdir(), "tr-dbtest-"));
let failed = 0;

for (const file of readdirSync(dir).filter((f) => f.endsWith(".test.sql"))) {
  let sql = readFileSync(join(dir, file), "utf8");
  sql = sql.replace(
    "select no_plan();",
    "select no_plan();\ncreate temp table tap (n serial, line text);\ngrant all on tap to public;\ngrant all on sequence tap_n_seq to public;",
  );
  sql = sql.replace(/^select (is|ok|throws_ok|lives_ok|is_empty|isnt|results_eq|set_eq)\(/gm, "insert into tap (line) select $1(");
  sql = sql.replace(
    /^select \* from finish\(\);\s*rollback;\s*$/m,
    "insert into tap (line) select * from finish();\nselect string_agg(line, E'\n' order by n) as tap from tap;\n",
  );
  const runner = join(tmp, file);
  writeFileSync(runner, sql);

  const out = execFileSync("npx", ["supabase", "db", "query", "--remote", "--yes", "-f", runner], {
    encoding: "utf8",
    shell: process.platform === "win32",
  });
  const tap = JSON.parse(out.slice(out.indexOf("{"))).rows?.[0]?.tap ?? out;
  console.log(`# ${file}\n${tap}`);
  if (/^not ok/m.test(tap) || /Looks like you failed/.test(tap)) failed++;
}

process.exit(failed ? 1 : 0);
