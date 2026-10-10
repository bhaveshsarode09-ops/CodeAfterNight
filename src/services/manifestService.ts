/**
 * VitaSync: Digital Transfer Manifest & Custody Generator
 *
 * CRITICAL NON-CLINICAL SAFETY DISCLAIMER:
 * Transfer manifests generated herein are strictly operational supply-chain custody records
 * for inter-facility temperature-controlled transport.
 * THIS MANIFEST IS NOT A CLINICAL CROSSMATCH RECORD, NOT A BLOOD RELEASE CERTIFICATE,
 * AND NOT A TRANSFUSION AUTHORIZATION.
 */

import { BloodUnit, NetworkNode, TransferManifest } from '../types/blood';

export const MANIFEST_LEGAL_DISCLAIMER =
  'NON-CLINICAL OPERATIONAL MANIFEST: Certified for cold-chain transport custody transfer only. Does NOT constitute serological crossmatching, compatibility testing, clinical release, or authorization for transfusion.';

export function generateTransferManifest(
  incidentId: string,
  sourceNode: NetworkNode,
  destNode: NetworkNode,
  units: BloodUnit[],
  transportMode: 'resqtech_priority' | 'standard_courier'
): TransferManifest {
  const timestamp = new Date().toISOString();
  const randSeq = Math.floor(1000 + Math.random() * 9000);
  const manifestNumber = `VS-MNF-2026-${randSeq}`;

  // Average departure temperature
  const avgTemp =
    units.length > 0
      ? Math.round(
          (units.reduce((acc, u) => acc + u.tempC, 0) / units.length) * 10
        ) / 10
      : 3.8;

  // Generate mock custody signature hash
  const verificationHash = `SHA256:VS-${incidentId.slice(-6)}-${sourceNode.id}-${destNode.id}-${units.length}-${Date.now().toString(16).toUpperCase()}`;

  return {
    id: `MAN-${Date.now().toString(36).toUpperCase()}`,
    manifestNumber,
    incidentId,
    generatedAt: timestamp,
    sourceNode: {
      id: sourceNode.id,
      name: sourceNode.name,
      officer: sourceNode.contactOfficer,
    },
    destinationNode: {
      id: destNode.id,
      name: destNode.name,
      officer: destNode.contactOfficer,
    },
    units: units.map((u) => ({
      id: u.id,
      din: u.din,
      bloodGroup: u.bloodGroup,
      component: u.component,
      volumeMl: u.volumeMl,
      expiryDate: u.expiryDate,
      originDepartureVerified: true,
      destinationArrivalVerified: false,
    })),
    transportMode:
      transportMode === 'resqtech_priority'
        ? 'ResQtech Priority Corridor (Simulated)'
        : 'Standard Medical Courier (Road Traffic Route)',
    coldChainDepartureTempC: avgTemp,
    digitalSignature: `SIG//${sourceNode.id.toUpperCase()}//${destNode.id.toUpperCase()}//VLOG`,
    verificationHash,
    legalDisclaimer: MANIFEST_LEGAL_DISCLAIMER,
  };
}
