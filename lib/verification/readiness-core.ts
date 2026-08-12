export type VerificationReadiness = {
  enabled: boolean;
  encryptionConfigured: boolean;
  hmacConfigured: boolean;
  keysSeparated: boolean;
  emailDeliveryConfigured: boolean;
  evidenceStorageConfigured: boolean;
  cleanupConfigured: boolean;
  cleanupHealthy: boolean;
  reviewerConfigured: boolean;
  providerConfigured: boolean;
  controlledTestUsersConfigured: boolean;
  manualCardReady: boolean;
  manualEmailReady: boolean;
  providerReady: boolean;
  readyForControlledTesting: boolean;
};

export type VerificationReadinessFlags = Omit<
  VerificationReadiness,
  | "manualCardReady"
  | "manualEmailReady"
  | "providerReady"
  | "readyForControlledTesting"
>;

export function buildVerificationReadiness(
  flags: VerificationReadinessFlags,
): VerificationReadiness {
  const baseReady =
    flags.encryptionConfigured &&
    flags.hmacConfigured &&
    flags.keysSeparated &&
    flags.evidenceStorageConfigured &&
    flags.cleanupConfigured &&
    flags.cleanupHealthy &&
    flags.reviewerConfigured;
  const manualCardReady = baseReady;
  const manualEmailReady = baseReady && flags.emailDeliveryConfigured;
  const providerReady = baseReady && flags.providerConfigured;
  return {
    ...flags,
    manualCardReady,
    manualEmailReady,
    providerReady,
    readyForControlledTesting:
      manualCardReady && flags.controlledTestUsersConfigured,
  };
}
