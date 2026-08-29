import { requireUser } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { Nav } from '@/components/nav';
import { AddSupplierForm } from '@/components/suppliers/add-supplier-form';
import { SupplierRow } from '@/components/suppliers/supplier-row';

export default async function SuppliersPage() {
  const user = await requireUser();
  const suppliers = await prisma.supplier.findMany({ orderBy: { name: 'asc' } });

  return (
    <div className="min-h-screen bg-slate-950 text-white">
      <Nav username={user.username} />
      <div className="max-w-5xl mx-auto p-8">
        <h1 className="text-xl font-semibold mb-6">Suppliers</h1>
        <AddSupplierForm />
        <div className="border border-slate-800 rounded-lg overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-slate-900 text-left text-slate-400">
              <tr>
                <th className="py-2 px-3 font-medium">Name</th>
                <th className="py-2 px-3 font-medium">Phone</th>
                <th className="py-2 px-3 font-medium">Address</th>
                <th className="py-2 px-3 font-medium">Pattern</th>
                <th className="py-2 px-3"></th>
              </tr>
            </thead>
            <tbody>
              {suppliers.length === 0 ? (
                <tr>
                  <td colSpan={5} className="py-6 text-center text-slate-500">
                    No suppliers yet — add one above.
                  </td>
                </tr>
              ) : (
                suppliers.map((supplier) => <SupplierRow key={supplier.id} supplier={supplier} />)
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
