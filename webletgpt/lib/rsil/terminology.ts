/**
 * RSIL Terminology Mapping
 * 
 * Maps technical RSIL terms to user-friendly equivalents for improved UX.
 * Used across v2 components to present friendly language to non-technical users.
 */

export const RSIL_TERMS = {
  compositeScore: 'Overall Quality',
  avgScore: 'Average Score',
  dimension: 'Category',
  dimensions: 'Categories',
  sampleSize: 'Conversations Analyzed',
  performanceFloor: 'Safety Threshold',
  canaryDeployment: 'Gradual Rollout',
  abTest: 'Comparison Test',
  weakDimensions: 'Areas for Improvement',
  lowScoredTraceIds: 'Low-Performing Conversations',
  requireApproval: 'Manual Approval',
  minTestDurationHours: 'Testing Period',
  abTestTrafficPct: 'Test Traffic Percentage',
  autoRollbackThreshold: 'Auto-Rollback Threshold',
  confidenceLevel: 'Confidence Level',
  minSampleSize: 'Minimum Sample Size',
  rsilEnabled: 'RSIL Status',
  decision: 'Recommendation',
  reason: 'Analysis',
  avgValue: 'Average Value',
  weight: 'Importance',
  versionNum: 'Version Number',
  versionId: 'Version ID',
  interactionCount: 'Total Conversations',
  totalVersions: 'Total Versions',
} as const

/**
 * Translate a technical term to user-friendly language.
 * Returns the friendly term if mapped, otherwise attempts to humanize the key.
 * 
 * @param key - Technical term key from RSIL types
 * @returns User-friendly string
 * 
 * @example
 * translateTerm('compositeScore') // 'Overall Quality'
 * translateTerm('unknownKey')     // 'Unknown Key' (humanized fallback)
 */
export function translateTerm(key: string): string {
  // Check if key exists in mappings
  if (key in RSIL_TERMS) {
    return RSIL_TERMS[key as keyof typeof RSIL_TERMS]
  }
  
  // Fallback: humanize the key by adding spaces before capital letters
  // and capitalizing first letter of each word
  return key
    .replace(/([A-Z])/g, ' $1')  // Insert space before capital letters
    .replace(/^./, (str) => str.toUpperCase())  // Capitalize first letter
    .trim()
}

/**
 * Type-safe keys for RSIL_TERMS mapping.
 */
export type RSILTermKey = keyof typeof RSIL_TERMS
