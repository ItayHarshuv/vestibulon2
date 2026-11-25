// Run with: node --import tsx --experimental-test-module-mocks --test server/patient-export-route.test.ts
import assert from "node:assert/strict";
import { mock, test } from "node:test";
import type { VercelRequest, VercelResponse } from "@vercel/node";
import { getTableName, type SQL } from "drizzle-orm";
import { PgDialect } from "drizzle-orm/pg-core";
import ExcelJS from "exceljs";

let role: string | null = null;
const queries: Array<{ table: string; params: unknown[] }> = [];
mock.module(new URL("./auth.ts", import.meta.url).href, {
  namedExports: {
    getAuthenticatedUser: async () =>
      role ? { id: "doctor-id", username: "doctor", role } : null,
    handleOptions: () => false,
    setApiHeaders: () => undefined,
  },
});
mock.module(new URL("./db/index.ts", import.meta.url).href, {
  namedExports: {
    db: {
      select: () => ({
        from: (table: Parameters<typeof getTableName>[0]) => ({
          where: (condition: SQL) => ({
            orderBy: async () => {
              const name = getTableName(table);
              queries.push({
                table: name,
                params: new PgDialect().sqlToQuery(condition).params,
              });
              return name === "vestibulon2_users"
                ? [
                    {
                      username: "assigned-patient",
                      workosUserId: "assigned-id",
                    },
                  ]
                : [];
            },
          }),
        }),
      }),
    },
  },
});
mock.module(new URL("./exercise-statistics-service.ts", import.meta.url).href, {
  namedExports: { getExerciseStatisticsForUser: async () => [] },
});
mock.module(new URL("./patient-follow-up-service.ts", import.meta.url).href, {
  namedExports: {
    getPatientFollowUp: async (patientUserId: string) => {
      assert.equal(patientUserId, "assigned-id");
      return { notifications: [], appUsageSeconds: 0, totalReviews: 0 };
    },
  },
});
const { default: handler } =
  await import("./routes/clinician/patient-export.js");

async function request(method: string, query: VercelRequest["query"] = {}) {
  let status = 200;
  let body: unknown;
  const headers = new Map<string, unknown>();
  const response = {
    setHeader: (name: string, value: unknown) => {
      headers.set(name, value);
    },
    status: (value: number) => {
      status = value;
      return response;
    },
    json: (value: unknown) => {
      body = value;
    },
    end: (value: unknown) => {
      body = value;
    },
  };
  await handler(
    { method, query, headers: {} } as VercelRequest,
    response as unknown as VercelResponse,
  );
  return { status, body, headers };
}

void test("rejects signed-out and patient requests before querying patient data", async () => {
  queries.length = 0;
  role = null;
  assert.equal((await request("GET")).status, 401);
  role = "patient";
  assert.equal((await request("GET")).status, 403);
  assert.equal(queries.length, 0);
  assert.equal((await request("POST")).status, 405);
});

void test("exports only assigned patients, ignores client patient IDs, and sends an uncached XLSX attachment", async () => {
  queries.length = 0;
  role = "clinician";
  const result = await request("GET", {
    userId: "other-doctor-patient",
    timeZone: "Asia/Jerusalem",
  });
  assert.equal(result.status, 200);
  assert.equal(result.headers.get("Cache-Control"), "no-store");
  assert.equal(
    result.headers.get("Content-Disposition"),
    'attachment; filename="PatientPracticeData.xlsx"',
  );
  assert.equal(
    result.headers.get("Content-Type"),
    "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  );
  assert.deepEqual(queries, [
    { table: "vestibulon2_users", params: ["patient", "doctor-id"] },
    { table: "vestibulon2_treatment_plans", params: ["assigned-id"] },
    { table: "vestibulon2_performed_reps", params: ["assigned-id"] },
  ]);
  assert.ok(Buffer.isBuffer(result.body));
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.load(Uint8Array.from(result.body).buffer);
  assert.equal(workbook.worksheets.length, 5);
  assert.equal(workbook.worksheets.at(-1)!.name, "assigned-patient");
});

void test("rejects invalid time zones without reading patient data", async () => {
  queries.length = 0;
  role = "clinician";
  assert.equal(
    (await request("GET", { timeZone: "invalid/zone" })).status,
    400,
  );
  assert.equal(queries.length, 0);
});
