-- Unified CIA/ESE obtained marks (course_type determines theory vs practical).

alter table public.student_marks
  add column if not exists cia_marks_obtained numeric,
  add column if not exists ese_marks_obtained numeric;

update public.student_marks
set
  cia_marks_obtained = coalesce(
    cia_marks_obtained,
    case
      when upper(coalesce(course_type, '')) like '%PRACTICAL%'
        then nullif(cia_marks_obtained_practical, 0)
      else nullif(cia_marks_obtained_theory, 0)
    end,
    greatest(coalesce(cia_marks_obtained_theory, 0), coalesce(cia_marks_obtained_practical, 0))
  ),
  ese_marks_obtained = coalesce(
    ese_marks_obtained,
    case
      when upper(coalesce(course_type, '')) like '%PRACTICAL%'
        then nullif(ese_marks_obtained_practical, 0)
      else nullif(ese_marks_obtained_theory, 0)
    end,
    greatest(coalesce(ese_marks_obtained_theory, 0), coalesce(ese_marks_obtained_practical, 0))
  )
where cia_marks_obtained is null or ese_marks_obtained is null;
