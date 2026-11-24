import { logger } from "../config/logger.js";

/** Data-retention sweep. Collections register their deletion rule here (M8: enquiries, feedback, reports…). */
const rules: (() => Promise<number>)[] = [];
export function registerRetentionRule(rule: () => Promise<number>) {
  rules.push(rule);
}

export async function runRetentionSweep(): Promise<number> {
  let removed = 0;
  for (const rule of rules) removed += await rule();
  logger.info({ removed }, "Retention sweep done");
  return removed;
}
