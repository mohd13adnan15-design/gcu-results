# Grade Card Schema Documentation

Based on the official GCU grade card template, this schema is designed to store complete grade card information.

## Database Schema Overview

### Tables Created

#### 1. **grade_card** (Main Table)

Stores complete grade card information for each student.

**Fields:**
| Field | Type | Description |
|-------|------|-------------|
| id | UUID | Primary Key |
| grade_card_no | TEXT | Unique grade card number (e.g., GCUBBAR00118) |
| qr_code | TEXT | QR code data/URL |
| student_photo_url | TEXT | URL to student photo |
| university_name | TEXT | University name (default: Garden City University) |
| university_tagline | TEXT | University tagline (default: EMPHASIS ON LIFE) |
| school_name | ENUM | School/Department (COMMERCE, ENGINEERING, etc.) |
| student_id | UUID | Foreign key to students table |
| student_name | TEXT | Student's full name |
| student_roll_no | TEXT | Student's roll number (unique) |
| registration_no | TEXT | Student's registration number |
| programme_title | TEXT | Degree title (e.g., Bachelor of Technology) |
| programme_code | TEXT | Programme code (e.g., BTECH) |
| semester | INT | Semester number |
| exam_month_year | TEXT | Exam date (e.g., November - 2025) |
| courses | JSONB | Array of course objects organized by category |
| total_credits | NUMERIC | Total credits for the semester |
| total_credits_earned | NUMERIC | Total credits earned |
| total_credit_points | NUMERIC | Total grade points |
| semester_grade_point_average | NUMERIC | SGPA (0-10) |
| final_grade | ENUM | Final grade (O, A+, A, B+, B, etc.) |
| issue_date | DATE | Grade card issue date |
| seal_image_url | TEXT | URL to university seal image |
| controller_signature_url | TEXT | URL to controller's signature |
| created_at | TIMESTAMP | Record creation timestamp |
| updated_at | TIMESTAMP | Record update timestamp |
| created_by | UUID | User who created the record |
| updated_by | UUID | User who last updated the record |

#### 2. **grade_card_courses** (Normalized Courses Table)

Stores individual course details for better querying and reporting.

**Fields:**
| Field | Type | Description |
|-------|------|-------------|
| id | UUID | Primary Key |
| grade_card_id | UUID | Foreign key to grade_card |
| course_category | TEXT | Category (CORE, PRACTICAL, ABILITY, SKILL, ELECTIVE) |
| sl_no | INT | Serial number in grade card |
| course_code | TEXT | Course code |
| course_title | TEXT | Course title |
| credits | NUMERIC | Course credits |
| credits_earned | NUMERIC | Credits earned |
| grade_obtained | ENUM | Grade received |
| grade_points | NUMERIC | Grade points |
| created_at | TIMESTAMP | Record creation timestamp |

## Courses JSON Structure

The `courses` field in `grade_card` table stores courses in this format:

```json
{
  "core_courses": [
    {
      "sl_no": 1,
      "course_code": "24BTSE3512",
      "course_title": "EMBEDDED SYSTEMS",
      "credits": 4.0,
      "credits_earned": 4.0,
      "grade_obtained": "A",
      "grade_points": 8.0
    }
  ],
  "practical_courses": [
    {
      "sl_no": 2,
      "course_code": "24BTPE3514",
      "course_title": "ROBOT VISION LAB",
      "credits": 2.0,
      "credits_earned": 2.0,
      "grade_obtained": "O",
      "grade_points": 10.0
    }
  ],
  "ability_enhancement_courses": [
    {
      "sl_no": 3,
      "course_code": "24AAECC3316",
      "course_title": "BUSINESS COMMUNICATION",
      "credits": 3.0,
      "credits_earned": 3.0,
      "grade_obtained": "A+",
      "grade_points": 9.0
    }
  ],
  "skill_enhancement_courses": [
    {
      "sl_no": 4,
      "course_code": "24BTSE3518",
      "course_title": "MACHINE LEARNING ESSENTIALS",
      "credits": 2.0,
      "credits_earned": 2.0,
      "grade_obtained": "A",
      "grade_points": 8.0
    }
  ],
  "open_elective_courses": [
    {
      "sl_no": 5,
      "course_code": "24AOPEL3521",
      "course_title": "PRINCIPLES OF ECONOMICS",
      "credits": 1.0,
      "credits_earned": 1.0,
      "grade_obtained": "A",
      "grade_points": 8.0
    }
  ]
}
```

## Enums

### school_enum

- SCHOOL OF COMMERCE AND MANAGEMENT
- SCHOOL OF ENGINEERING AND TECHNOLOGY
- SCHOOL OF LIBERAL ARTS AND SCIENCES
- SCHOOL OF BUSINESS AND ADMINISTRATION

### grade_enum

- O (Outstanding)
- A+ (Excellent)
- A (Good)
- A- (Good)
- B+ (Above Average)
- B (Average)
- B- (Average)
- C+ (Below Average)
- C (Below Average)
- C- (Below Average)
- D+ (Poor)
- D (Poor)
- RA (Result Awaited)
- SA (Semester Absent)
- AB (Absent)

## Indexes

The following indexes are created for performance optimization:

1. `grade_card_student_id_idx` - For filtering by student
2. `grade_card_student_roll_no_idx` - For quick lookup by roll number
3. `grade_card_registration_no_idx` - For lookup by registration number
4. `grade_card_semester_idx` - For filtering by semester
5. `grade_card_school_idx` - For filtering by school
6. `grade_card_issue_date_idx` - For filtering by issue date
7. `grade_card_courses_grade_card_id_idx` - For accessing courses
8. `grade_card_courses_category_idx` - For filtering courses by category

## Row Level Security (RLS) Policies

### grade_card Policies:

1. **Students can view their own grade cards**
   - SELECT: Only when `student_id = auth.uid()`

2. **Only admins can insert grade cards**
   - INSERT: Requires `admin` or `super_admin` role

3. **Only admins can update grade cards**
   - UPDATE: Requires `admin` or `super_admin` role

### grade_card_courses Policies:

1. **Students can view courses for their grade cards**
   - SELECT: Only courses for their own grade cards

2. **Only admins can insert courses**
   - INSERT: Requires `admin` or `super_admin` role

## Helper Functions

### `calculate_sgpa(total_grade_points, total_credits)`

Calculates Semester Grade Point Average.

```
SGPA = Total Grade Points / Total Credits
Returns: NUMERIC (0-10)
```

### `get_final_grade(sgpa)`

Determines final grade from SGPA.

```
SGPA >= 9.0   → O
SGPA >= 8.5   → A+
SGPA >= 8.0   → A
SGPA >= 7.5   → A-
... and so on
SGPA < 3.5    → RA
```

## Usage Examples

### Insert a Grade Card

```sql
INSERT INTO public.grade_card (
  grade_card_no,
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
  'SCHOOL OF COMMERCE AND MANAGEMENT'::school_enum,
  '550e8400-e29b-41d4-a716-446655440000',
  'Mohammad Anwar Attar',
  '24BTRE148',
  '24BTRE148',
  'Bachelor of Technology in Robotics and Automation',
  'BTECH',
  5,
  'November - 2025',
  '{"core_courses": [...], "practical_courses": [...]}',
  26.0,
  25.0,
  218.5,
  8.4,
  'A+'::grade_enum,
  CURRENT_DATE
);
```

### Query Grade Cards by Student

```sql
SELECT * FROM public.grade_card
WHERE student_id = '550e8400-e29b-41d4-a716-446655440000';
```

### Get All Courses for a Grade Card

```sql
SELECT * FROM public.grade_card_courses
WHERE grade_card_id = '550e8400-e29b-41d4-a716-446655440001'
ORDER BY sl_no;
```

### Calculate SGPA

```sql
SELECT
  id,
  student_name,
  public.calculate_sgpa(total_credit_points, total_credits) as calculated_sgpa,
  semester_grade_point_average
FROM public.grade_card;
```

## Migration Steps

1. **Run the migration file:**

   ```bash
   supabase db push
   ```

2. **Verify the schema:**

   ```bash
   supabase db inspect
   ```

3. **Update RLS policies** (if needed for your use case)

4. **Seed sample data** using the provided functions

## Notes

- The `student_roll_no` and `registration_no` fields are UNIQUE to ensure no duplicates
- The `courses` field uses JSONB for flexible storage of multiple course categories
- RLS policies ensure data isolation between students and admins
- Helper functions can be used in INSERT/UPDATE triggers for automatic calculations
- The schema supports multiple schools within the same university

## Integration with Grade Card Generation

The Python script `generate_student_gradecards.py` will:

1. Query this schema to fetch grade card data
2. Populate all fields automatically
3. Generate professional DOCX documents
4. Use the JSONB courses data to populate the grade table

For questions or issues, refer to the main documentation files.
