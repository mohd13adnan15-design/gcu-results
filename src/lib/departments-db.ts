import { supabase } from "@/integrations/supabase/client";

export const DEFAULT_DEPARTMENTS = ["CSE", "ECE", "MECH", "CIVIL", "Food Technology", "Robotics", "SET"];

// In-memory fallback set to guarantee newly added departments show up in the UI even if DB insert fails
const localAdded = new Set<string>();

export async function fetchDepartments(): Promise<string[]> {
  let names: string[] = [];
  try {
    const { data: deptData, error: deptError } = await supabase
      .from("departments")
      .select("name")
      .order("name");

    if (!deptError && deptData) {
      names = deptData.map((d: any) => d.name);
    }
  } catch (err) {
    console.warn("departments table not found, falling back to student department list", err);
  }

  if (names.length === 0) {
    try {
      const { data: studentDepts, error: studentError } = await supabase
        .from("students")
        .select("department");

      if (!studentError && studentDepts) {
        names = studentDepts.map((s: any) => s.department).filter(Boolean);
      }
    } catch (err) {
      console.warn("Failed to fetch distinct student departments", err);
    }
  }

  const merged = Array.from(new Set([...DEFAULT_DEPARTMENTS, ...names, ...localAdded]));
  return merged.sort();
}

export async function insertDepartment(name: string): Promise<boolean> {
  const cleanName = name.trim();
  if (!cleanName) return false;

  localAdded.add(cleanName); // Always persist in local state for active session

  try {
    const { error } = await supabase
      .from("departments")
      .insert([{ name: cleanName }]);

    if (!error) return true;
  } catch (err) {
    console.warn("Failed to insert into departments table, using local runtime add", err);
  }
  return false;
}
