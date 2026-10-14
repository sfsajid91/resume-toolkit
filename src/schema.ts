import { z } from "zod";

const schemaVersionSchema = z.literal(1);
const inputHashSchema = z.string().regex(/^sha256:[0-9a-f]{64}$/);
const jsonPointerSchema = z.string().regex(/^(?:\/(?:[^~/]|~[01])*)*$/u);
const nonBlankString = z.string().regex(/\S/, "Must contain a non-whitespace character.");
const idSchema = nonBlankString;
const claimTextSchema = nonBlankString.max(4_000);
const evidenceTextSchema = nonBlankString.max(4_000);

export const claimSchema = z.strictObject({
  id: idSchema,
  text: claimTextSchema,
  evidenceIds: z.array(idSchema),
});

const entrySchema = z.strictObject({
  id: idSchema,
  name: nonBlankString,
  title: nonBlankString.optional(),
  issuer: nonBlankString.optional(),
  start: nonBlankString.optional(),
  end: z.union([nonBlankString, z.null()]).optional(),
  url: nonBlankString.optional(),
  bullets: z.array(claimSchema).max(100),
});

const sectionSchema = z.strictObject({
  kind: z.enum(["experience", "projects", "education", "certifications"]),
  items: z.array(entrySchema).max(100),
});

const evidenceSchema = z.strictObject({
  id: idSchema,
  entryId: idSchema,
  text: evidenceTextSchema,
  source: z.strictObject({
    kind: z.enum(["user_statement", "document"]),
    locator: nonBlankString,
  }),
  confirmedByUser: z.boolean(),
});

const requirementSchema = z.strictObject({
  id: idSchema,
  text: nonBlankString,
  quote: nonBlankString,
  importance: z.enum(["required", "preferred", "unspecified"]),
});

const jobSchema = z.strictObject({
  id: idSchema,
  company: nonBlankString,
  title: nonBlankString,
  sourceUrl: nonBlankString.optional(),
  rawText: nonBlankString.max(100_000),
  requirements: z.array(requirementSchema).max(40),
});

const applicationShapeSchema = z.strictObject({
  schemaVersion: schemaVersionSchema,
  id: idSchema,
  revision: z.number().int().positive(),
  resume: z.strictObject({
    basics: z.strictObject({
      name: nonBlankString,
      email: nonBlankString.optional(),
      phone: nonBlankString.optional(),
      location: nonBlankString.optional(),
      links: z.array(z.strictObject({ label: nonBlankString, url: nonBlankString })),
    }),
    summary: z.array(claimSchema).max(100),
    sections: z.array(sectionSchema).max(4),
    skills: z.array(z.strictObject({
      id: idSchema,
      label: nonBlankString,
      evidenceIds: z.array(idSchema),
    })).max(100),
  }),
  evidence: z.array(evidenceSchema).max(1_000).optional(),
  job: jobSchema.optional(),
});

export const applicationSchema = applicationShapeSchema.superRefine((application, context) => {
  const entries = application.resume.sections.reduce((total, section) => total + section.items.length, 0);
  if (entries > 100) {
    context.addIssue({
      code: "custom",
      path: ["resume", "sections"],
      message: "Resume may contain at most 100 entries in total.",
    });
  }

  const claims = application.resume.summary.length + application.resume.sections.reduce(
    (total, section) => total + section.items.reduce((entryTotal, entry) => entryTotal + entry.bullets.length, 0),
    0,
  );
  if (claims > 100) {
    context.addIssue({
      code: "custom",
      path: ["resume"],
      message: "Resume may contain at most 100 summary and bullet claims in total.",
    });
  }
});

export const validationIssueSchema = z.strictObject({
  path: jsonPointerSchema,
  code: nonBlankString,
  severity: z.enum(["error", "warning"]),
  message: nonBlankString,
  relatedIds: z.array(idSchema).readonly(),
});

export const evidenceLinkageSchema = z.strictObject({
  status: z.enum(["not_assessed", "unavailable", "incomplete", "unconfirmed", "complete"]),
  missingEvidence: z.number().int().nonnegative(),
  emptyReferences: z.number().int().nonnegative(),
  unconfirmedEvidence: z.number().int().nonnegative(),
});

export const validationResultSchema = z.strictObject({
  status: z.enum(["valid", "invalid"]),
  evidenceLinkage: evidenceLinkageSchema,
  issues: z.array(validationIssueSchema).readonly(),
});

export const validationOutputSchema = validationResultSchema.extend({
  inputHash: inputHashSchema,
});

export const schemaKindSchema = z.enum(["application", "report"]);

const findingTargetSchema = z.strictObject({
  id: idSchema.nullable(),
  path: jsonPointerSchema,
});

const uncertaintySchema = z.number().min(0).max(1);
const distributionSchema = z.array(z.strictObject({
  label: nonBlankString,
  probability: z.number().min(0).max(1),
}));

const findingCommon = {
  target: findingTargetSchema,
  uncertainty: uncertaintySchema,
  distribution: distributionSchema.optional(),
  reviewAction: nonBlankString,
} as const;

const findingSchema = z.discriminatedUnion("criterion", [
  z.strictObject({
    criterion: z.literal("evidence_support"),
    ...findingCommon,
    answer: z.enum(["supported", "contradicted", "insufficient"]),
  }),
  z.strictObject({
    criterion: z.literal("requirement_coverage"),
    ...findingCommon,
    answer: z.number().min(0).max(1),
  }),
  z.strictObject({
    criterion: z.literal("relevance"),
    ...findingCommon,
    answer: z.number().int().min(0).max(2),
  }),
  z.strictObject({
    criterion: z.literal("clarity"),
    ...findingCommon,
    answer: z.number().int().min(0).max(2),
  }),
]);

const reportErrorSchema = z.strictObject({ code: nonBlankString, message: nonBlankString });

export const reportSchema = z.strictObject({
  schemaVersion: schemaVersionSchema,
  toolVersion: nonBlankString,
  rubricVersion: nonBlankString,
  generatedAt: z.iso.datetime(),
  application: z.strictObject({
    id: idSchema,
    revision: z.number().int().positive(),
    inputHash: inputHashSchema,
  }),
  validation: validationResultSchema.pick({ status: true, issues: true }),
  evaluation: z.strictObject({
    status: z.enum(["complete", "unavailable"]),
    requestedModel: nonBlankString.nullable(),
    observedModel: nonBlankString.nullable(),
    observedTokenUsage: z.strictObject({
      inputTokens: z.number().int().nonnegative(),
      outputTokens: z.number().int().nonnegative(),
      totalTokens: z.number().int().nonnegative(),
    }).nullable(),
    findings: z.array(findingSchema),
    error: reportErrorSchema.nullable(),
  }),
  assessmentScope: z.strictObject({
    evidenceSupport: z.literal("claims_and_skills"),
    requirementCoverage: z.literal("selected_resume_content"),
    sourceTruth: z.literal("unverified"),
    headerFacts: z.literal("not_evaluated"),
  }),
});

export type Application = z.infer<typeof applicationSchema>;
export type Claim = z.infer<typeof claimSchema>;
export type Report = z.infer<typeof reportSchema>;
export type ValidationIssue = z.infer<typeof validationIssueSchema>;
export type EvidenceLinkage = z.infer<typeof evidenceLinkageSchema>;
export type ValidationResult = z.infer<typeof validationResultSchema>;
export type ValidationOutput = z.infer<typeof validationOutputSchema>;
export type SchemaKind = z.infer<typeof schemaKindSchema>;

export function generateJsonSchema(kind: SchemaKind): unknown {
  const schema = kind === "application" ? applicationSchema : reportSchema;
  return z.toJSONSchema(schema, { unrepresentable: "any" });
}
