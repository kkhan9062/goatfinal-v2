// Deliberately a LOCAL SCRIPT, not an HTTP endpoint. v1 had a
// create_user.php file sitting on the live server that anyone could hit to
// silently reset the admin account to a hardcoded password with zero
// authentication — this is the fix for that entire class of mistake: there
// is no URL that can create or reset an account. This must be run from a
// developer's machine (or a one-off CI/deploy step), never deployed.
//
// Usage: npx tsx scripts/create-admin.ts <username> <password> [email]
import 'dotenv/config';
import { prisma } from '../src/lib/prisma';
import { hashPassword } from '../src/lib/auth';

async function main() {
  const [username, password, email] = process.argv.slice(2);

  if (!username || !password) {
    console.error('Usage: npx tsx scripts/create-admin.ts <username> <password> [email]');
    process.exit(1);
  }
  if (password.length < 8) {
    console.error('Password must be at least 8 characters.');
    process.exit(1);
  }

  const passwordHash = await hashPassword(password);

  const user = await prisma.user.upsert({
    where: { username },
    create: { username, passwordHash, email, isActive: true },
    update: { passwordHash, email, isActive: true },
  });

  console.log(`✅ User "${user.username}" ready (id: ${user.id}).`);
}

main()
  .catch((e) => {
    console.error('Failed to create admin user:', e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
