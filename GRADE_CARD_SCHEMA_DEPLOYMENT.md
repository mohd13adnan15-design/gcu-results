# Grade Card Schema Deployment Guide

This guide explains how to deploy the new grade card schema to your Supabase database using MCP.

## Overview

The new schema includes:

- ✅ Main `grade_card` table with all fields from the template
- ✅ Normalized `grade_card_courses` table for individual courses
- ✅ Type enums for schools and grades
- ✅ Row Level Security (RLS) policies
- ✅ Helper functions for SGPA calculation
- ✅ Automatic timestamp management

## Prerequisites

✅ MCP configured (`.vscode/mcp.json`)
✅ Supabase project: `wmanjhavutkrjbuiwlus`
✅ Admin access to Supabase
✅ Students table already exists

## Deployment Methods

### Method 1: Using Supabase CLI (Recommended)

1. **Navigate to project directory:**

   ```bash
   cd /Users/vyeshwanth/Desktop/gcu-results-main
   ```

2. **Push the migration:**

   ```bash
   supabase db push
   ```

3. **Verify the schema was created:**
   ```bash
   supabase db inspect
   ```

### Method 2: Using Supabase Dashboard

1. **Go to SQL Editor in Supabase Dashboard**
   - URL: https://app.supabase.com/project/wmanjhavutkrjbuiwlus/sql/new

2. **Copy the entire SQL from:**

   ```
   supabase/migrations/20260509_create_grade_card_schema.sql
   ```

3. **Paste in the SQL editor and click "Run"**

4. **Wait for execution to complete**

5. **Check the Tables section to verify creation**

### Method 3: Using MCP (Through VS Code)

Since MCP is configured, you can:

1. **Open VS Code Command Palette** (Cmd + Shift + P)

2. **Search for Supabase MCP commands**

3. **Execute database operations through MCP**

## Schema Components

### 1. Enums

```sql
-- School enum with 4 options
CREATE TYPE school_enum AS ENUM (...)

-- Grade enum with 15 grade options
CREATE TYPE grade_enum AS ENUM (...)
```

### 2. Main Tables

```sql
-- grade_card: Main table with all grade card information
CREATE TABLE public.grade_card (...)

-- grade_card_courses: Normalized courses for each grade card
CREATE TABLE public.grade_card_courses (...)
```

### 3. Indexes (8 total)

- For quick lookups by student, roll number, registration, etc.
- For filtering by semester and school
- For performance optimization

### 4. RLS Policies

- Students can only view their own grade cards
- Only admins can create/update grade cards
- Fine-grained access control

### 5. Helper Functions

- `calculate_sgpa()`: SGPA calculation
- `get_final_grade()`: Grade determination
- `update_grade_card_timestamp()`: Auto-timestamp update

## Data Structure

### Grade Card Record

```json
{
  "id": "UUID",
  "grade_card_no": "GCUBBAR00118",
  "school_name": "SCHOOL OF COMMERCE AND MANAGEMENT",
  "student_id": "UUID",
  "student_name": "Mohammad Anwar Attar",
  "student_roll_no": "24BTRE148",
  "registration_no": "24BTRE148",
  "programme_title": "Bachelor of Technology",
  "programme_code": "BTECH",
  "semester": 5,
  "exam_month_year": "November - 2025",
  "courses": {
    "core_courses": [...],
    "practical_courses": [...],
    "ability_enhancement_courses": [...],
    "skill_enhancement_courses": [...],
    "open_elective_courses": [...]
  },
  "total_credits": 26.0,
  "total_credits_earned": 25.0,
  "total_credit_points": 218.5,
  "semester_grade_point_average": 8.4,
  "final_grade": "A+",
  "issue_date": "2025-11-15"
}
```

## Sample Data Insertion

### Insert a Complete Grade Card

```sql
INSERT INTO public.grade_card (
  grade_card_no,
  qr_code,
  school_name,
  student_id,
  student_name,
  student_roll_no,
  registration_no,
  programme_title,
  programme_code,
  semester,
  exam_month_year,
  courses,
  total_credits,
  total_credits_earned,
  total_credit_points,
  semester_grade_point_average,
  final_grade,
  issue_date
) VALUES (
  'GCUBBAR00118',
  'QR_DATA_HERE',
  'SCHOOL OF COMMERCE AND MANAGEMENT'::school_enum,
  'student_uuid_here',
  'Mohammad Anwar Attar',
  '24BTRE148',
  '24BTRE148',
  'Bachelor of Technology in Robotics and Automation',
  'BTECH',
  5,
  'November - 2025',
  '[{"sl_no": 1, "course_code": "BUS101", "course_title": "Business Fundamentals", "credits": 4.0, "credits_earned": 4.0, "grade_obtained": "A", "grade_points": 8.0}]'::JSONB,
  26.0,
  25.0,
  218.5,
  8.4,
  'A+'::grade_enum,
  CURRENT_DATE
);
```

### Insert Individual Courses

```sql
INSERT INTO public.grade_card_courses (
  grade_card_id,
  course_category,
  sl_no,
  course_code,
  course_title,
  credits,
  credits_earned,
  grade_obtained,
  grade_points
) VALUES (
  'grade_card_uuid_here',
  'CORE COURSE',
  1,
  'BUS101',
  'Business Fundamentals',
  4.0,
  4.0,
  'A'::grade_enum,
  8.0
);
```

## Verification Queries

### Check if Tables Exist

```sql
SELECT table_name
FROM information_schema.tables
WHERE table_schema = 'public'
AND table_name IN ('grade_card', 'grade_card_courses');
```

### View Table Structure

```sql
SELECT column_name, data_type, is_nullable
FROM information_schema.columns
WHERE table_name = 'grade_card';
```

### Check Indexes

```sql
SELECT indexname
FROM pg_indexes
WHERE tablename = 'grade_card';
```

### Check RLS Policies

```sql
SELECT policy_name, permissive, roles, qual, with_check
FROM pg_policies
WHERE table_name IN ('grade_card', 'grade_card_courses');
```

## Integration with Python Script

The `generate_student_gradecards.py` script will:

1. **Query the grade_card table:**

   ```python
   response = supabase.table("grade_card").select("*").execute()
   ```

2. **Fetch courses from JSONB:**

   ```python
   courses = grade_card['courses']  # JSONB array
   ```

3. **Populate DOCX document:**
   - Use student fields for header
   - Use courses array to fill grade table
   - Calculate SGPA using helper function
   - Use final_grade for grade display

## Troubleshooting

### Error: Type already exists

**Solution:** Drop the type first or check if schema was already applied

```sql
DROP TYPE IF EXISTS school_enum CASCADE;
DROP TYPE IF EXISTS grade_enum CASCADE;
```

### Error: Foreign key constraint

**Solution:** Ensure students table exists and has proper UUID ids

```sql
SELECT * FROM public.students LIMIT 1;
```

### Error: RLS policy blocking access

**Solution:** Ensure user has proper auth role

```sql
-- Check user roles
SELECT auth.jwt() -> 'user_metadata' -> 'role' as user_role;
```

### JSONB courses not storing correctly

**Solution:** Ensure proper JSON structure

```sql
-- Validate JSONB
SELECT jsonb_typeof(courses) FROM public.grade_card LIMIT 1;

-- Pretty print courses
SELECT jsonb_pretty(courses) FROM public.grade_card LIMIT 1;
```

## Next Steps

1. ✅ Deploy this schema to Supabase
2. ✅ Verify all tables and functions created
3. ✅ Update Python script to use new schema
4. ✅ Seed sample data
5. ✅ Test grade card generation
6. ✅ Deploy to production

## Rollback (If Needed)

To rollback this schema:

```sql
-- Drop tables (RLS policies drop automatically)
DROP TABLE IF EXISTS public.grade_card_courses CASCADE;
DROP TABLE IF EXISTS public.grade_card CASCADE;

-- Drop functions
DROP FUNCTION IF EXISTS public.update_grade_card_timestamp() CASCADE;
DROP FUNCTION IF EXISTS public.calculate_sgpa(NUMERIC, NUMERIC) CASCADE;
DROP FUNCTION IF EXISTS public.get_final_grade(NUMERIC) CASCADE;

-- Drop types
DROP TYPE IF EXISTS school_enum CASCADE;
DROP TYPE IF EXISTS grade_enum CASCADE;
```

## Support

For issues or questions:

1. Check the migration file: `supabase/migrations/20260509_create_grade_card_schema.sql`
2. Refer to schema documentation: `GRADE_CARD_SCHEMA_DOCUMENTATION.md`
3. Check Supabase dashboard for errors
4. Review MCP configuration in `.vscode/mcp.json`
