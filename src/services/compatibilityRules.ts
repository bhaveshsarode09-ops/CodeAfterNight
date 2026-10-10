/**
 * DEMO REDISTRIBUTION COMPATIBILITY RULES
 *
 * CRITICAL NON-CLINICAL DISCLAIMER:
 * This matrix represents an operational logistics simulation policy for emergency redistribution triage.
 * It is NOT clinical transfusion guidance, NOT a replacement for pre-transfusion serological testing,
 * crossmatching, antibody screening, or authorized physician release.
 *
 * RULES DIFFERENTIATION:
 * Red-cell compatibility rules (PRBC) NEVER apply to platelets or plasma!
 * - PRBC: O- is universal cellular donor (no A/B antigens).
 * - Plasma (FFP): AB is universal plasma donor (no anti-A or anti-B isohemagglutinins); O plasma contains anti-A and anti-B!
 * - Platelets: Transfusion guidelines emphasize matching ABO when possible due to plasma volume in unit;
 *   platelet surface antigens and anti-A/B antibodies obey distinct handling; never substitute red-cell logic.
 */

import { BloodGroup, ComponentType, CompatibilityMatrixRule } from '../types/blood';

export const COMPATIBILITY_POLICY_DISCLAIMER =
  'DEMO OPERATIONAL LOGISTICS POLICY ONLY: Never use for clinical crossmatching, compatibility testing, or transfusion authorization. Platelet and plasma rules strictly differ from red-cell rules.';

/**
 * PRBC (Packed Red Blood Cells) Demo Redistribution Compatibility
 * Based on erythrocyte surface ABO and Rh(D) antigens.
 */
export const PRBC_COMPATIBILITY_RULES: Record<BloodGroup, BloodGroup[]> = {
  'O-': ['O-'],
  'O+': ['O+', 'O-'],
  'A-': ['A-', 'O-'],
  'A+': ['A+', 'A-', 'O+', 'O-'],
  'B-': ['B-', 'O-'],
  'B+': ['B+', 'B-', 'O+', 'O-'],
  'AB-': ['AB-', 'A-', 'B-', 'O-'],
  'AB+': ['AB+', 'AB-', 'A+', 'A-', 'B+', 'B-', 'O+', 'O-'],
};

/**
 * FFP (Fresh Frozen Plasma) Demo Redistribution Compatibility
 * Plasma contains soluble antibodies, so ABO donor rules are reversed relative to red cells.
 * AB plasma has neither anti-A nor anti-B -> Universal donor for plasma.
 * O plasma has both anti-A and anti-B -> Only compatible with group O recipients.
 */
export const FFP_COMPATIBILITY_RULES: Record<BloodGroup, BloodGroup[]> = {
  'O-': ['O-', 'O+', 'A-', 'A+', 'B-', 'B+', 'AB-', 'AB+'], // O recipient can receive any plasma
  'O+': ['O+', 'O-', 'A+', 'A-', 'B+', 'B-', 'AB+', 'AB-'],
  'A-': ['A-', 'A+', 'AB-', 'AB+'],
  'A+': ['A+', 'A-', 'AB+', 'AB-'],
  'B-': ['B-', 'B+', 'AB-', 'AB+'],
  'B+': ['B+', 'B-', 'AB+', 'AB-'],
  'AB-': ['AB-', 'AB+'], // AB recipient must receive AB plasma to avoid infused antibodies
  'AB+': ['AB+', 'AB-'],
};

/**
 * PLATELETS Demo Redistribution Compatibility
 * In logistical redistribution triage, identical ABO is preferred (isogroup).
 * Minor ABO mismatches are evaluated against titer thresholds.
 * Red-cell compatibility logic MUST NOT be applied here.
 */
export const PLATELET_COMPATIBILITY_RULES: Record<BloodGroup, BloodGroup[]> = {
  'O-': ['O-', 'O+', 'A-', 'B-'], // Isogroup preferred; secondary cross-group only with low-titer plasma
  'O+': ['O+', 'O-', 'A+', 'B+'],
  'A-': ['A-', 'A+', 'O-', 'AB-'],
  'A+': ['A+', 'A-', 'O+', 'AB+'],
  'B-': ['B-', 'B+', 'O-', 'AB-'],
  'B+': ['B+', 'B-', 'O+', 'AB+'],
  'AB-': ['AB-', 'AB+', 'A-', 'B-'],
  'AB+': ['AB+', 'AB-', 'A+', 'B+', 'O+'],
};

/**
 * CRYOPRECIPITATE Demo Redistribution Compatibility
 * Contains minimal plasma volume; ABO isogroup preferred, but in emergency massive transfusion protocols
 * Cryo may be given across ABO barriers when inventory is critically depleted.
 */
export const CRYO_COMPATIBILITY_RULES: Record<BloodGroup, BloodGroup[]> = {
  'O-': ['O-', 'O+', 'A-', 'B-', 'AB-'],
  'O+': ['O+', 'O-', 'A+', 'B+', 'AB+'],
  'A-': ['A-', 'A+', 'O-', 'AB-'],
  'A+': ['A+', 'A-', 'O+', 'AB+'],
  'B-': ['B-', 'B+', 'O-', 'AB-'],
  'B+': ['B+', 'B-', 'O+', 'AB+'],
  'AB-': ['AB-', 'AB+', 'A-', 'B-'],
  'AB+': ['AB+', 'AB-', 'A+', 'B+', 'O+', 'O-'],
};

export function getCompatibleDonorGroups(
  component: ComponentType,
  recipientGroup: BloodGroup,
  policyMode: 'strict_isogroup' | 'standard_demo_matrix' | 'universal_emergency' = 'standard_demo_matrix'
): BloodGroup[] {
  if (policyMode === 'strict_isogroup') {
    return [recipientGroup];
  }

  if (policyMode === 'universal_emergency') {
    if (component === 'PRBC') return ['O-', recipientGroup];
    if (component === 'FFP') return ['AB+', 'AB-', recipientGroup];
    if (component === 'PLATELETS') return [recipientGroup, 'O-', 'AB+'];
    if (component === 'CRYO') return [recipientGroup, 'AB+', 'O+'];
  }

  // Standard demo redistribution matrix
  switch (component) {
    case 'PRBC':
      return PRBC_COMPATIBILITY_RULES[recipientGroup] || [recipientGroup];
    case 'FFP':
      return FFP_COMPATIBILITY_RULES[recipientGroup] || [recipientGroup];
    case 'PLATELETS':
      return PLATELET_COMPATIBILITY_RULES[recipientGroup] || [recipientGroup];
    case 'CRYO':
      return CRYO_COMPATIBILITY_RULES[recipientGroup] || [recipientGroup];
    default:
      return [recipientGroup];
  }
}

export function isDirectIsogroup(donorGroup: BloodGroup, recipientGroup: BloodGroup): boolean {
  return donorGroup === recipientGroup;
}
