import { Link } from "react-router-dom";
import { useCallback, useEffect, useState, type FormEvent } from "react";
import { supabase } from "@/integrations/supabase/client";
import { AdminLayout } from "@/components/layout/AdminLayout";
import {
  DEFAULT_MARKS_CONFIGURATION,
  fetchMarksConfiguration,
  MARKS_CONFIGURATION_FIELDS,
  saveMarksConfiguration,
  validateMarksConfigurationInput,
  type MarksConfiguration,
  type MarksConfigurationInput,
} from "@/lib/marks-configuration";
import { toast } from "sonner";
import { ArrowLeft, Loader2, Save, Settings2 } from "lucide-react";

export function MarksConfigurationPage() {
  return (
    <AdminLayout
      requirePortal={["head_of_coe"]}
      title="Marks Configuration"
      subtitle="Garden City University · CIA / ESE limits for marks cards"
    >
      {() => <MarksConfigurationContent />}
    </AdminLayout>
  );
}

function MarksConfigurationContent() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [editing, setEditing] = useState(false);
  const [record, setRecord] = useState<MarksConfiguration | null>(null);
  const [form, setForm] = useState<MarksConfigurationInput>(DEFAULT_MARKS_CONFIGURATION);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const data = await fetchMarksConfiguration(supabase);
      setRecord(data);
      setForm({
        cia_max_marks_theory: data.cia_max_marks_theory,
        cia_max_marks_practical: data.cia_max_marks_practical,
        cia_min_marks_theory: data.cia_min_marks_theory,
        cia_min_marks_practical: data.cia_min_marks_practical,
        ese_max_marks_theory: data.ese_max_marks_theory,
        ese_max_marks_practical: data.ese_max_marks_practical,
        ese_min_marks_theory: data.ese_min_marks_theory,
        ese_min_marks_practical: data.ese_min_marks_practical,
        total_marks_theory: data.total_marks_theory,
        total_marks_practical: data.total_marks_practical,
      });
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not load marks configuration.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  function updateField(key: keyof MarksConfigurationInput, raw: string) {
    const value = raw === "" ? 0 : Number(raw);
    setForm((prev) => ({ ...prev, [key]: value }));
  }

  async function handleSave(e: FormEvent) {
    e.preventDefault();
    const validationError = validateMarksConfigurationInput(form);
    if (validationError) {
      toast.error(validationError);
      return;
    }

    setSaving(true);
    try {
      const saved = await saveMarksConfiguration(supabase, form, record?.id || undefined);
      setRecord(saved);
      setEditing(false);
      toast.success("Marks configuration saved. New PDFs will use these values.");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not save marks configuration.");
    } finally {
      setSaving(false);
    }
  }

  function handleCancel() {
    if (record) {
      setForm({
        cia_max_marks_theory: record.cia_max_marks_theory,
        cia_max_marks_practical: record.cia_max_marks_practical,
        cia_min_marks_theory: record.cia_min_marks_theory,
        cia_min_marks_practical: record.cia_min_marks_practical,
        ese_max_marks_theory: record.ese_max_marks_theory,
        ese_max_marks_practical: record.ese_max_marks_practical,
        ese_min_marks_theory: record.ese_min_marks_theory,
        ese_min_marks_practical: record.ese_min_marks_practical,
        total_marks_theory: record.total_marks_theory,
        total_marks_practical: record.total_marks_practical,
      });
    } else {
      setForm(DEFAULT_MARKS_CONFIGURATION);
    }
    setEditing(false);
  }

  return (
    <div className="space-y-6">
      <Link
        to="/coe"
        className="inline-flex items-center gap-2 text-sm font-medium text-primary hover:opacity-80"
      >
        <ArrowLeft className="h-4 w-4" />
        Back to COE
      </Link>

      <div className="card-elevated rounded-2xl p-6">
        <div className="mb-6 flex flex-wrap items-start justify-between gap-4">
          <div className="flex items-center gap-2 text-primary">
            <Settings2 className="h-5 w-5" />
            <div>
              <h2 className="text-lg font-bold">Marks Configuration</h2>
              <p className="text-xs text-muted-foreground leading-relaxed">
                CIA/ESE max and minimum marks apply to all marks cards and grade cards. Excel uploads
                no longer include these columns.
              </p>
            </div>
          </div>
          {!editing && !loading && (
            <button
              type="button"
              onClick={() => setEditing(true)}
              className="rounded-md border border-border bg-cream px-4 py-2 text-sm font-medium text-primary hover:bg-secondary"
            >
              Edit
            </button>
          )}
        </div>

        {loading ? (
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" />
            Loading configuration…
          </div>
        ) : (
          <form onSubmit={handleSave} className="space-y-6">
            <div className="grid gap-4 sm:grid-cols-2">
              {MARKS_CONFIGURATION_FIELDS.map(({ key, label }) => (
                <label key={key} className="block space-y-1.5">
                  <span className="text-sm font-medium text-primary">{label}</span>
                  <input
                    type="number"
                    min={0}
                    step={1}
                    value={form[key]}
                    disabled={!editing}
                    onChange={(e) => updateField(key, e.target.value)}
                    className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm disabled:cursor-not-allowed disabled:opacity-70"
                  />
                </label>
              ))}
            </div>

            {record?.updated_at && (
              <p className="text-xs text-muted-foreground">
                Last updated: {new Date(record.updated_at).toLocaleString()}
              </p>
            )}

            {editing && (
              <div className="flex flex-wrap gap-3">
                <button
                  type="submit"
                  disabled={saving}
                  className="inline-flex items-center gap-2 rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:opacity-90 disabled:opacity-60"
                >
                  {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                  Save
                </button>
                <button
                  type="button"
                  onClick={handleCancel}
                  disabled={saving}
                  className="rounded-md border border-border bg-cream px-4 py-2 text-sm font-medium text-primary hover:bg-secondary disabled:opacity-60"
                >
                  Cancel
                </button>
              </div>
            )}
          </form>
        )}
      </div>
    </div>
  );
}
