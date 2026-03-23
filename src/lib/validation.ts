import { z } from "zod";

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

export function getZodErrorMessage(
  error: z.ZodError,
  fallback = "Invalid request",
) {
  return error.issues[0]?.message ?? fallback;
}

export const genderSchema = z.enum(["male", "female"]);

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
  gender: genderSchema.nullable(),
});

export const authSessionResponseSchema = z.object({
  user: authUserSchema.nullable(),
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
  z.object({
    gender: genderSchema,
  })
);

export const programRouteParamsSchema = z.object({
  programId: integerRouteParam("programId must be an integer"),
});

export const workoutFinishRouteParamsSchema = z.object({
  programId: integerRouteParam("programId must be an integer"),
  repId: integerRouteParam("repId must be an integer"),
});

export const workoutLocationStateSchema = z.object({
  workoutStartTimestampMs: z.number().finite().optional(),
});

export const programsQuerySchema = z.preprocess(coerceObject, z.object({}));

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

export const createRepBodySchema = z.preprocess(
  coerceObject,
  z.object({
    programId: integerField("programId is required"),
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

export type ApiProgram = z.infer<typeof apiProgramSchema>;
export type AuthUser = z.infer<typeof authUserSchema>;
export type SignInForm = z.infer<typeof signInFormSchema>;
export type SignUpForm = z.infer<typeof signUpFormSchema>;
export type UpdateProgramBody = z.infer<typeof updateProgramBodySchema>;
export type CreateRepBody = z.infer<typeof createRepBodySchema>;
export type UpdateRepBody = z.infer<typeof updateRepBodySchema>;
