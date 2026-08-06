import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";

const db = new PrismaClient();

async function main() {
  const email = process.env.ADMIN_EMAIL?.trim().toLowerCase();
  const password = process.env.ADMIN_PASSWORD;

  if (!email) throw new Error("Set ADMIN_EMAIL in .env.");
  if (!password || password.length < 12) throw new Error("Set ADMIN_PASSWORD to at least 12 characters in .env.");

  const user = await db.user.findUnique({ where: { email } });
  if (!user) throw new Error(`No TITAN user exists with email ${email}.`);

  await db.user.update({
    where: { id: user.id },
    data: {
      passwordHash: await bcrypt.hash(password, 12),
      active: true,
      mustChangePassword: false,
    },
  });

  await db.passwordResetToken.updateMany({
    where: { userId: user.id, usedAt: null },
    data: { usedAt: new Date() },
  });

  console.log(`Password reset successfully for ${email}.`);
}

main().finally(() => db.$disconnect());
