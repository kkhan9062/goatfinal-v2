import { requireUser } from '@/lib/auth';
import { Nav } from '@/components/nav';
import { ChangePasswordForm } from '@/components/account/change-password-form';

export default async function AccountPage() {
  const user = await requireUser();

  return (
    <div className="min-h-screen bg-slate-950 text-white">
      <Nav username={user.username} />
      <div className="max-w-md mx-auto p-8">
        <h1 className="text-xl font-semibold mb-1">Account</h1>
        <p className="text-sm text-slate-400 mb-6">Signed in as {user.username}</p>
        <div className="border border-slate-800 rounded-lg bg-slate-900 p-5">
          <h2 className="text-sm font-medium text-slate-300 mb-4">Change Password</h2>
          <ChangePasswordForm />
        </div>
      </div>
    </div>
  );
}
