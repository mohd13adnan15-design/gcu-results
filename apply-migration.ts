import { createClient } from "@supabase/supabase-js";
import * as fs from "fs";

const supabaseUrl = process.env.VITE_SUPABASE_URL!;
const supabaseKey = process.env.VITE_SUPABASE_PUBLISHABLE_KEY!;

const supabase = createClient(supabaseUrl, supabaseKey);

async function runMigration() {
  try {
    const migrationSql = fs.readFileSync(
      "./supabase/migrations/20260502_create_main_grade_card.sql",
      "utf-8",
    );

    // Split by newlines and filter out comments and empty lines
    const statements = migrationSql
      .split(";")
      .map((s) => s.trim())
      .filter((s) => s && !s.startsWith("--"));

    console.log(`Running ${statements.length} SQL statements...`);

    for (const stmt of statements) {
      console.log(`\nExecuting:\n${stmt.substring(0, 100)}...`);
      const { error } = await supabase.rpc("exec", { sql: stmt });
      if (error) {
        console.error("Error:", error);
      } else {
        console.log("✓ Success");
      }
    }

    console.log("\n✓ Migration completed");
  } catch (error) {
    console.error("Migration failed:", error);
    process.exit(1);
  }
}

runMigration();
