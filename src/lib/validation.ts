import { z } from "zod";
import { allBackgrounds, allExPositions, exerciseTemplateNames } from "../data/content";

function coerceObject(input: unknown) {
  if (!input || typeof input !== "object" || Array.isArray(input)) {
    return {};
  }

  return input;
}

function requiredTrimmedString(message: string) {
  return z
    .string({
      required_error: message,
      invalid_type_error: message,
    })
    .trim()
    .min(1, message);
}

function integerField(message: string) {
  return z
    .number({
      required_error: message,
      invalid_type_error: message,
    })
    .int(message);
}

function integerScoreField(fieldName: string) {
  const message = `${fieldName} must be an integer between 0 and 10`;
  return integerField(message).min(0, message).max(10, message);
}

function integerRouteParam(message: string) {
  return z
    .string({
      required_error: message,
      invalid_type_error: message,
    })
    .regex(/^-?\d+$/, message)
    .transform((value) => Number(value));
}

function optionalUserIdField(message: string) {
  return z.preprocess(
    (value) => (Array.isArray(value) ? value[0] : value),
    z
      .string({
        invalid_type_error: message,
      })
      .trim()
      .min(1, message)
      .optional(),
  );
}

export function getZodErrorMessage(
  error: z.ZodError,
  fallback = "Invalid request",
) {
  return error.issues[0]?.message ?? fallback;
}

export const genderSchema = z.enum(["male", "female"]);
export const userRoleSchema = z.enum(["clinician", "patient"]);

export const signInFormSchema = z.object({
  username: requiredTrimmedString("יש להזין שם משתמש"),
  password: requiredTrimmedString("יש להזין סיסמה"),
});

export const signUpFormSchema = z.object({
  username: requiredTrimmedString("יש להזין שם משתמש"),
  email: z
    .string({
      required_error: "יש להזין כתובת אימייל",
      invalid_type_error: "יש להזין כתובת אימייל",
    })
    .trim()
    .email("יש להזין כתובת אימייל תקינה")
    .transform((value) => value.toLowerCase()),
  password: requiredTrimmedString("יש להזין סיסמה"),
});

export const authUserSchema = z.object({
  id: requiredTrimmedString("Missing id"),
  username: requiredTrimmedString("Missing username"),
  email: z.string().email("Missing email"),
  role: userRoleSchema,
  clinicianUserId: z.string().min(1, "Missing clinicianUserId").nullable(),
  gender: genderSchema.nullable(),
  points: z.number().int().nonnegative(),
});

export const authSessionResponseSchema = z.object({
  user: authUserSchema.nullable(),
});

export const clinicianPatientSchema = z.object({
  id: requiredTrimmedString("Missing id"),
  username: requiredTrimmedString("Missing username"),
  email: z.string().email("Missing email"),
});

export const clinicianPatientsResponseSchema = z.object({
  patients: z.array(clinicianPatientSchema),
});

export const signInRequestSchema = signInFormSchema;
export const signUpRequestSchema = signUpFormSchema;

export const passwordResetRequestSchema = z.preprocess(
  coerceObject,
  z.object({
    identifier: requiredTrimmedString("יש להזין שם משתמש או אימייל"),
  })
);

export const updateProfileSchema = z.preprocess(
  coerceObject,
  z
    .object({
      userId: optionalUserIdField("userId must be a string"),
      gender: genderSchema.optional(),
      numberOfSessions: integerField(
        "numberOfSessions must be an integer greater than 0",
      )
        .min(1, "numberOfSessions must be an integer greater than 0")
        .optional(),
    })
    .superRefine((value, context) => {
      if (
        value.gender === undefined &&
        value.numberOfSessions === undefined
      ) {
        context.addIssue({
          code: z.ZodIssueCode.custom,
          message: "At least one updatable field is required",
        });
      }
    }),
);

export const programRouteParamsSchema = z.object({
  programId: integerRouteParam("programId must be an integer"),
});

export const workoutFinishRouteParamsSchema = z.object({
  programId: integerRouteParam("programId must be an integer"),
  repId: integerRouteParam("repId must be an integer"),
});

export const workoutLocationStateSchema = z.object({
  workoutEndTimestampMs: z.number().finite().optional(),
  workoutStartTimestampMs: z.number().finite().optional(),
});

export const profileQuerySchema = z.preprocess(
  coerceObject,
  z.object({
    userId: optionalUserIdField("userId must be a string"),
  }),
);

export const programsQuerySchema = z.preprocess(
  coerceObject,
  z.object({
    userId: optionalUserIdField("userId must be a string"),
  }),
);

export const todayRepsQuerySchema = z.preprocess(
  coerceObject,
  z.object({
    timeZone: z.preprocess(
      (value) => (Array.isArray(value) ? value[0] : value),
      requiredTrimmedString("timeZone is required"),
    ),
  }),
);

export const exerciseStatisticsQuerySchema = z.preprocess(
  coerceObject,
  z.object({
    timeZone: z.preprocess(
      (value) => (Array.isArray(value) ? value[0] : value),
      requiredTrimmedString("timeZone is required"),
    ),
    userId: optionalUserIdField("userId must be a string"),
  }),
);

export const exerciseStatisticsDaySchema = z.object({
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  plannedReps: z.number().int().nonnegative(),
  completedReps: z.number().int().nonnegative(),
  completionPercentage: z.number().int().min(0).max(100),
});

export const exerciseStatisticsSeriesSchema = z.object({
  exerciseName: z.string(),
  startDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  endDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  days: z.array(exerciseStatisticsDaySchema),
});

export const exerciseStatisticsResponseSchema = z.object({
  exercises: z.array(exerciseStatisticsSeriesSchema),
});

export const updateProgramBodySchema = z.preprocess(
  coerceObject,
  z.object({
    programId: integerField("programId must be an integer"),
    metronomeBpmTemp: integerField("metronomeBpmTemp must be an integer"),
  }),
);

export const apiProgramSchema = z.object({
  id: z.number().int(),
  exerciseName: z.string(),
  numberOfSeconds: z.number().int(),
  numberOfRepetions: z.number().int(),
  metronomeBpm: z.number().int(),
  metronomeBpmTemp: z.number().int().nullable(),
  position: z.string(),
  background: z.string(),
  recomendedVAS: z.number().int(),
});

export const programsResponseSchema = z.array(apiProgramSchema);

export const treatmentPlanQuerySchema = z.preprocess(
  coerceObject,
  z.object({
    userId: z.preprocess(
      (value) => (Array.isArray(value) ? value[0] : value),
      requiredTrimmedString("userId is required"),
    ),
  }),
);

export const treatmentPlanExerciseInputSchema = z.object({
  exerciseName: z.enum(exerciseTemplateNames, {
    errorMap: () => ({ message: "exerciseName must be a valid exercise" }),
  }),
  numberOfSeconds: integerField("numberOfSeconds must be an integer")
    .min(1, "numberOfSeconds must be at least 1")
    .max(600, "numberOfSeconds must be at most 600"),
  numberOfRepetions: integerField("numberOfRepetions must be an integer")
    .min(1, "numberOfRepetions must be at least 1")
    .max(50, "numberOfRepetions must be at most 50"),
  metronomeBpm: integerField("metronomeBpm must be an integer")
    .min(30, "metronomeBpm must be at least 30")
    .max(240, "metronomeBpm must be at most 240"),
  position: z.enum(allExPositions, {
    errorMap: () => ({ message: "position must be a valid position" }),
  }),
  background: z.enum(allBackgrounds, {
    errorMap: () => ({ message: "background must be a valid background" }),
  }),
  recomendedVAS: integerField("recomendedVAS must be an integer")
    .min(0, "recomendedVAS must be between 0 and 10")
    .max(10, "recomendedVAS must be between 0 and 10"),
});

export const saveTreatmentPlanBodySchema = z.preprocess(
  coerceObject,
  z.object({
    userId: requiredTrimmedString("userId is required"),
    timeZone: requiredTrimmedString("timeZone is required"),
    numberOfSessions: integerField("numberOfSessions must be an integer")
      .min(1, "numberOfSessions must be at least 1")
      .max(10, "numberOfSessions must be at most 10"),
    exercises: z
      .array(treatmentPlanExerciseInputSchema, {
        required_error: "exercises is required",
        invalid_type_error: "exercises must be an array",
      })
      .min(1, "At least one exercise is required")
      .superRefine((exercises, context) => {
        const names = exercises.map((exercise) => exercise.exerciseName);
        if (new Set(names).size !== names.length) {
          context.addIssue({
            code: z.ZodIssueCode.custom,
            message: "exercises must not contain duplicates",
          });
        }
      }),
  }),
);

export const treatmentPlanExerciseSchema = treatmentPlanExerciseInputSchema.extend({
  id: z.number().int().optional(),
  programId: z.number().int().optional(),
});

export const treatmentPlanResponseSchema = z.object({
  plan: z
    .object({
      id: z.number().int(),
      numberOfSessions: z.number().int(),
      effectiveFrom: z.string(),
      createdAt: z.string(),
    })
    .nullable(),
  numberOfSessions: z.number().int(),
  exercises: z.array(treatmentPlanExerciseSchema),
});

export const saveTreatmentPlanResponseSchema = z.object({
  planId: z.number().int(),
  numberOfSessions: z.number().int(),
  exercises: z.array(apiProgramSchema),
});

const practiceTimeKeySchema = z
  .string()
  .regex(
    /^\d{4}-\d{2}-\d{2}-\d{2}-\d{2}$/,
    "practiceTimeKey must match YYYY-MM-DD-HH-mm",
  );

export const createRepBodySchema = z.preprocess(
  coerceObject,
  z.object({
    programId: integerField("programId is required"),
    timeZone: requiredTrimmedString("timeZone is required"),
    practiceTimeKey: practiceTimeKeySchema.optional(),
  }),
);

export const getRepsQuerySchema = z.preprocess(
  coerceObject,
  z.object({
    userId: optionalUserIdField("userId must be a string"),
    ids: z.preprocess(
      (value) => {
        const rawValue =
          typeof value === "string"
            ? value
            : Array.isArray(value) && typeof value[0] === "string"
              ? value[0]
              : null;

        if (rawValue === null) {
          return [];
        }

        return rawValue
          .split(",")
          .map((part) => part.trim())
          .filter(Boolean)
          .map((part) => Number(part));
      },
      z.array(integerField("rep id must be an integer")).min(1, "ids is required"),
    ),
  }),
);

export const syncTodayRepsBodySchema = z.preprocess(
  coerceObject,
  z.object({
    timeZone: requiredTrimmedString("timeZone is required"),
  }),
);

const sessionTimeSchema = z.string().regex(/^([01]\d|2[0-3]):([0-5]\d)$/, {
  message: "sessionTimes must contain valid HH:MM values",
});

export const updateTodayRepsScheduleBodySchema = z.preprocess(
  coerceObject,
  z.object({
    timeZone: requiredTrimmedString("timeZone is required"),
    sessionTimes: z
      .array(sessionTimeSchema, {
        required_error: "sessionTimes is required",
        invalid_type_error: "sessionTimes must be an array",
      })
      .min(1, "sessionTimes must include at least one value")
      .superRefine((sessionTimes, context) => {
        if (new Set(sessionTimes).size !== sessionTimes.length) {
          context.addIssue({
            code: z.ZodIssueCode.custom,
            message: "sessionTimes must contain unique values",
          });
        }
      }),
  }),
);

const updateRepBodyBaseSchema = z
  .object({
    repId: integerField("repId is required"),
    numberOfSeconds: integerField(
      "numberOfSeconds must be a non-negative integer",
    )
      .min(0, "numberOfSeconds must be a non-negative integer")
      .optional(),
    bpmEndOfRep: integerField("bpmEndOfRep must be an integer").optional(),
    flagPaused: z
      .boolean({
        invalid_type_error: "flagPaused must be a boolean",
      })
      .optional(),
    dizziness: integerScoreField("dizziness").optional(),
    nausea: integerScoreField("nausea").optional(),
    generalDifficulty: integerScoreField("general_difficulty").optional(),
    general_difficulty: integerScoreField("general_difficulty").optional(),
  })
  .superRefine((value, context) => {
    if (
      value.numberOfSeconds === undefined &&
      value.bpmEndOfRep === undefined &&
      value.flagPaused === undefined &&
      value.dizziness === undefined &&
      value.nausea === undefined &&
      value.generalDifficulty === undefined &&
      value.general_difficulty === undefined
    ) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        message: "At least one updatable field is required",
      });
    }
  })
  .transform(({ general_difficulty, generalDifficulty, ...rest }) => ({
    ...rest,
    generalDifficulty: generalDifficulty ?? general_difficulty,
  }));

export const updateRepBodySchema = z.preprocess(
  coerceObject,
  updateRepBodyBaseSchema,
);

export const createRepResponseSchema = z.object({
  id: z.number().int(),
  startTime: z.string(),
});

export const updateRepResponseSchema = z.object({
  id: z.number().int(),
  endTime: z.date().or(z.string()).optional(),
  bpmEndOfRep: z.number().int().optional(),
  flagPaused: z.boolean().optional(),
  dizziness: z.number().int().min(0).max(10).optional(),
  nausea: z.number().int().min(0).max(10).optional(),
  generalDifficulty: z.number().int().min(0).max(10).optional(),
  pointsAwarded: z.number().int().nonnegative().optional(),
  totalPoints: z.number().int().nonnegative().nullable().optional(),
});

export const apiRepSummarySchema = z.object({
  id: z.number().int(),
  startTime: z.string(),
  endTime: z.string().nullable(),
});

export const todayRepRowSchema = z.object({
  id: z.number().int(),
  practiceTime: z.string(),
  exerciseName: z.string(),
  repId: z.number().int().nullable(),
});

export const todayRepsResponseSchema = z.array(todayRepRowSchema);
export const repsResponseSchema = z.array(apiRepSummarySchema);

export type ApiProgram = z.infer<typeof apiProgramSchema>;
export type AuthUser = z.infer<typeof authUserSchema>;
export type ClinicianPatient = z.infer<typeof clinicianPatientSchema>;
export type SignInForm = z.infer<typeof signInFormSchema>;
export type SignUpForm = z.infer<typeof signUpFormSchema>;
export type UpdateProgramBody = z.infer<typeof updateProgramBodySchema>;
export type CreateRepBody = z.infer<typeof createRepBodySchema>;
export type UpdateRepBody = z.infer<typeof updateRepBodySchema>;
export type UpdateRepResponse = z.infer<typeof updateRepResponseSchema>;
export type ApiRepSummary = z.infer<typeof apiRepSummarySchema>;
export type ExerciseStatisticsSeries = z.infer<typeof exerciseStatisticsSeriesSchema>;
export type ExerciseStatisticsResponse = z.infer<typeof exerciseStatisticsResponseSchema>;
