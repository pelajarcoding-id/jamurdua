interface Transaction {
  id: string;
  date: string;
  description: string;
  amount: string;
  status: 'Completed' | 'Pending' | 'Failed';
}

const dummyTransactions: Transaction[] = [
  { id: 'NT001', date: '2023-10-27', description: 'Uang Jalan - Sopir A', amount: 'Rp 500.000', status: 'Completed' },
  { id: 'NT002', date: '2023-10-27', description: 'Timbangan Sawit - Pemasok B', amount: 'Rp 12.500.000', status: 'Completed' },
  { id: 'NT003', date: '2023-10-26', description: 'Nota Sawit - Pembeli C', amount: 'Rp 25.000.000', status: 'Pending' },
  { id: 'NT004', date: '2023-10-25', description: 'Uang Jalan - Sopir D', amount: 'Rp 750.000', status: 'Completed' },
  { id: 'NT005', date: '2023-10-24', description: 'Timbangan Sawit - Pemasok E', amount: 'Rp 8.200.000', status: 'Failed' },
];

const statusColorMap = {
  Completed: 'bg-green-100 text-green-800',
  Pending: 'bg-yellow-100 text-yellow-800',
  Failed: 'bg-red-100 text-red-800',
};

const RecentTransactions = () => {
  return (
    <div className="bg-white p-6 rounded-lg shadow-md mt-6">
      <h2 className="text-xl font-bold mb-4">Ringkasan Transaksi Terkini</h2>
      <div className="overflow-x-auto">
        <table className="min-w-full bg-white">
          <thead className="bg-gray-50">
            <tr>
              <th className="py-3 px-4 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">ID Nota</th>
              <th className="py-3 px-4 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Tanggal</th>
              <th className="py-3 px-4 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Deskripsi</th>
              <th className="py-3 px-4 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Jumlah</th>
              <th className="py-3 px-4 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Status</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200">
            {dummyTransactions.map((tx) => (
              <tr key={tx.id}>
                <td className="py-4 px-4 whitespace-nowrap text-sm font-medium text-gray-900">{tx.id}</td>
                <td className="py-4 px-4 whitespace-nowrap text-sm text-gray-500">{tx.date}</td>
                <td className="py-4 px-4 whitespace-nowrap text-sm text-gray-500">{tx.description}</td>
                <td className="py-4 px-4 whitespace-nowrap text-sm text-gray-500">{tx.amount}</td>
                <td className="py-4 px-4 whitespace-nowrap">
                  <span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${statusColorMap[tx.status]}`}>
                    {tx.status}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default RecentTransactions;
