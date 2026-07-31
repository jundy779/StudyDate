import "server-only";

export type RegistryResult =
  | "matched"
  | "not_found"
  | "mismatch"
  | "unavailable";

export type StudentRegistryClaim = {
  requestId: string;
};

export interface StudentRegistryVerifier {
  verify(claim: StudentRegistryClaim): Promise<RegistryResult>;
}

export class ManualStudentRegistryVerifier implements StudentRegistryVerifier {
  async verify(): Promise<RegistryResult> {
    return "unavailable";
  }
}
