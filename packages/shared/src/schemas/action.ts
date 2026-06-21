import { z } from 'zod';

// ---------------------------------------------------------------------------
// Safe Action Types
// ---------------------------------------------------------------------------

export const ActionType = z.enum(['click', 'type', 'hotkey', 'open_url', 'wait', 'none']);
export type ActionType = z.infer<typeof ActionType>;

export const RiskLevel = z.enum(['low', 'medium', 'high']);
export type RiskLevel = z.infer<typeof RiskLevel>;

export const ActionStatus = z.enum(['proposed', 'approved', 'executed', 'cancelled', 'blocked', 'rejected', 'failed']);
export type ActionStatus = z.infer<typeof ActionStatus>;

// ---------------------------------------------------------------------------
// Proposed Action
// ---------------------------------------------------------------------------

export const ProposedAction = z.object({
  id: z.string(),
  type: ActionType,
  description: z.string(),
  coordinates: z
    .object({
      x: z.number(),
      y: z.number(),
    })
    .optional(),
  text: z.string().optional(),
  riskLevel: RiskLevel,
  requiresApproval: z.literal(true),
  status: ActionStatus,
  reason: z.string().optional(),
});
export type ProposedAction = z.infer<typeof ProposedAction>;

// ---------------------------------------------------------------------------
// Action Approval Request
// ---------------------------------------------------------------------------

export const ActionApprovalRequest = z.object({
  actionId: z.string(),
  userId: z.string().optional(),
  approved: z.boolean(),
});
export type ActionApprovalRequest = z.infer<typeof ActionApprovalRequest>;

// ---------------------------------------------------------------------------
// Action Result
// ---------------------------------------------------------------------------

export const ActionResult = z.object({
  actionId: z.string(),
  success: z.boolean(),
  message: z.string(),
  timestamp: z.string(),
});
export type ActionResult = z.infer<typeof ActionResult>;
