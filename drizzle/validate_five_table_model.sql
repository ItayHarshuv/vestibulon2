-- Run after 0018 and before 0019 in production.
SELECT
  (SELECT count(*) FROM vestibulon2_users WHERE role = 'patient') AS patients,
  (SELECT count(DISTINCT patient_user_id) FROM vestibulon2_treatment_plans) AS patients_with_plans,
  (SELECT count(*) FROM vestibulon2_treatment_plans) AS plan_versions,
  (SELECT count(*) FROM vestibulon2_treatment_plan_exercises) AS plan_exercises,
  (SELECT count(*) FROM vestibulon2_session_times) AS recurring_session_times,
  (SELECT count(*) FROM vestibulon2_performed_reps) AS performed_reps;

SELECT count(*) AS plans_without_exercises
FROM vestibulon2_treatment_plans plan
WHERE NOT EXISTS (
  SELECT 1
  FROM vestibulon2_treatment_plan_exercises exercise
  WHERE exercise.treatment_plan_id = plan.id
);

SELECT
  count(*) FILTER (WHERE treatment_plan_exercise_id IS NULL) AS missing_exercise,
  count(*) FILTER (WHERE scheduled_date IS NULL) AS missing_date,
  count(*) FILTER (WHERE session_index IS NULL OR rep_index IS NULL) AS legacy_unassigned_slots
FROM vestibulon2_performed_reps;

SELECT patient_user_id, scheduled_date, session_index, treatment_plan_exercise_id, rep_index, count(*)
FROM vestibulon2_performed_reps
WHERE scheduled_date IS NOT NULL
GROUP BY patient_user_id, scheduled_date, session_index, treatment_plan_exercise_id, rep_index
HAVING count(*) > 1;
