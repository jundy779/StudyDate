export type VerificationReadiness = {
  enabled: boolean;
  encryptionConfigured: boolean;
  hmacConfigured: boolean;
  keysSeparated: boolean;
  emailDeliveryConfigured: boolean;
  evidenceStorageConfigured: boolean;
  cleanupConfigured: boolean;
  controlledTestUsersConfigured: boolean;
  readyForControlledTesting: boolean;
};

export type VerificationReadinessFlags = Omit<
  VerificationReadiness,
  "readyForControlledTesting"
>;

export function buildVerificationReadiness(
  flags: VerificationReadinessFlags,
): VerificationReadiness {
  return {
    ...flags,
    readyForControlledTesting:
      flags.encryptionConfigured &&
      flags.hmacConfigured &&
      flags.keysSeparated &&
      flags.emailDeliveryConfigured &&
      flags.evidenceStorageConfigured &&
      flags.cleanupConfigured &&
      flags.controlledTestUsersConfigured,
  };
}
