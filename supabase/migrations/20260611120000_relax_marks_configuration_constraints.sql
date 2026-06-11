-- Allow ESE max marks to be zero (e.g. practical courses with CIA-only assessment).

alter table public.marks_configuration
  drop constraint if exists marks_configuration_ese_max_marks_theory_check,
  drop constraint if exists marks_configuration_ese_max_marks_practical_check;

alter table public.marks_configuration
  add constraint marks_configuration_ese_max_marks_theory_check
    check (ese_max_marks_theory >= 0),
  add constraint marks_configuration_ese_max_marks_practical_check
    check (ese_max_marks_practical >= 0);
