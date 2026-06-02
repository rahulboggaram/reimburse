import { normalizePhone } from "@/lib/phone";
import { createOtpChallenge, isOtpMockMode, otpSmsBody } from "@/lib/otp";
import { prisma } from "@/lib/db";
import { sendOtpSchema } from "@/lib/validators";

export async function POST(request: Request) {
  const body = sendOtpSchema.safeParse(await request.json());
  if (!body.success) {
    return Response.json({ error: "Enter a valid mobile number." }, { status: 400 });
  }

  const phone = normalizePhone(body.data.phone);
  if (!phone) {
    return Response.json({ error: "Enter a valid 10-digit mobile number." }, { status: 400 });
  }

  const user = await prisma.user.findUnique({ where: { phone } });
  if (!user || !user.active) {
    return Response.json(
      { error: "This number is not registered. Contact your admin." },
      { status: 403 },
    );
  }

  const { code } = await createOtpChallenge(phone);

  return Response.json({
    ok: true,
    phone,
    mock: isOtpMockMode(),
    mockCode: isOtpMockMode() ? code : undefined,
    smsPreview: otpSmsBody(code),
  });
}
