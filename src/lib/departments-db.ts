import { supabase } from "@/integrations/supabase/client";

export const DEFAULT_DEPARTMENTS = ["CSE", "ECE", "MECH", "CIVIL", "Food Technology", "Robotics", "SET"];

export async function fetchDepartments(): Promise<string[]> {
  try {
    const { data: deptData, error: deptError } = await supabase
      .from("departments")
      .select("name")
      .order("name");

    if (!deptError && deptData) {
      const names = deptData.map((d: any) => d.name);
      const merged = Array.from(new Set([...DEFAULT_DEPARTMENTS, ...names]));
      return merged.sort();
    }
  } catch (err) {
    console.warn("departments table not found, falling back to student department list", err);
  }

  try {
    const { data: studentDepts, error: studentError } = await supabase
      .from("students")
      .select("department");

    if (!studentError && studentDepts) {
      const names = studentDepts.map((s: any) => s.department).filter(Boolean);
      const merged = Array.from(new Set([...DEFAULT_DEPARTMENTS, ...names]));
      return merged.sort();
    }
  } catch (err) {
    console.warn("Failed to fetch distinct student departments", err);
  }

  return [...DEFAULT_DEPARTMENTS].sort();
}

export async function insertDepartment(name: string): Promise<boolean> {
  const cleanName = name.trim();
  if (!cleanName) return false;

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
