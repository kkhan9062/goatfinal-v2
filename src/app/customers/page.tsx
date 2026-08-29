import { requireUser } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { Nav } from '@/components/nav';
import { AddCustomerForm } from '@/components/customers/add-customer-form';
import { CustomerRow } from '@/components/customers/customer-row';

export default async function CustomersPage() {
  const user = await requireUser();
  const customers = await prisma.customer.findMany({ orderBy: { name: 'asc' } });

  return (
    <div className="min-h-screen bg-slate-950 text-white">
      <Nav username={user.username} />
      <div className="max-w-5xl mx-auto p-8">
        <h1 className="text-xl font-semibold mb-6">Retailers</h1>
        <AddCustomerForm />
        <div className="border border-slate-800 rounded-lg overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-slate-900 text-left text-slate-400">
              <tr>
                <th className="py-2 px-3 font-medium">Name</th>
                <th className="py-2 px-3 font-medium">Phone</th>
                <th className="py-2 px-3 font-medium">Address</th>
                <th className="py-2 px-3"></th>
              </tr>
            </thead>
            <tbody>
              {customers.length === 0 ? (
                <tr>
                  <td colSpan={4} className="py-6 text-center text-slate-500">
                    No retailers yet — add one above.
                  </td>
                </tr>
              ) : (
                customers.map((customer) => <CustomerRow key={customer.id} customer={customer} />)
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
