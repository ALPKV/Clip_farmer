/**
 * Exports the ball-tracking samples players chose to share, as CSV: label (1 ball, 0 not), source,
 * model version, then the 168 features in the order of ballFeatures() in lib/tracking/model.ts.
 *   DATABASE_URL=postgres://... node --experimental-strip-types scripts/ball-model/export-shared.mts > shared.csv
 * Only numbers are stored; see the Privacy Policy. Load with numpy.loadtxt(..., delimiter=",",
 * skiprows=1, usecols=[0, *range(3, 171)]) and add to the training set in train_instagram.py.
 */
import postgres from "postgres";

const url = process.env.DATABASE_URL;
if (!url) throw new Error("Set DATABASE_URL to the Neon connection string.");
const sql = postgres(url, { ssl: "require", max: 1 });
const rows = await sql<{ label: number; source: string; model_version: string; features: number[] }[]>`
  select label, source, model_version, features from training_samples order by id`;
process.stdout.write(["label", "source", "model", ...Array.from({ length: 168 }, (_, k) => `f${k}`)].join(",") + "\n");
for (const r of rows) process.stdout.write([r.label, r.source, r.model_version, ...r.features].join(",") + "\n");
console.error(`${rows.length} samples (${rows.filter((r) => r.label === 1).length} ball)`);
await sql.end();
