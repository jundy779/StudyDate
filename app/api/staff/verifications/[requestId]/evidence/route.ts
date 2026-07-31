import { getAuthenticatedUser } from "@/lib/auth/session";
import { getCurrentStaffAccess } from "@/lib/staff/authorization";
import { ManualStudentRegistryVerifier } from "@/lib/verification/registry";
import { StudentVerificationReviewService } from "@/lib/verification/review";
import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";

const uuid = z.string().uuid();
type Context = { params: Promise<{ requestId: string }> };

export async function GET(request: NextRequest, { params }: Context) {
  const user = await getAuthenticatedUser();
  const access = await getCurrentStaffAccess(user);
  const parsedId = uuid.safeParse((await params).requestId);
  const kind = request.nextUrl.searchParams.get("kind");
  if (!user || !access?.verificationReviewer || !parsedId.success || !["pddikti", "student_card"].includes(kind ?? "")) {
    return NextResponse.json({ message: "Evidence tidak tersedia." }, { status: 404 });
  }
  try {
    const service = new StudentVerificationReviewService(new ManualStudentRegistryVerifier());
    const url = kind === "pddikti"
      ? await service.createPddiktiEvidenceReviewUrl(parsedId.data, user.id)
      : await service.createEvidenceReviewUrl(parsedId.data, user.id);
    const response = NextResponse.redirect(url, 302);
    response.headers.set("cache-control", "no-store, private");
    return response;
  } catch {
    return NextResponse.json({ message: "Evidence tidak tersedia." }, { status: 404 });
  }
}
