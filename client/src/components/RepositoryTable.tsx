import React from 'react';
import Loader from '@/components/Loader';
import Switch from '@/components/Switch';

interface Repository {
  id: string;
  name: string;
  full_name: string;
  description: string;
  enabled: boolean;
  owner_avatar_url: string;
  owner_name: string;
  organization: string;
}

interface RepositoryTableProps {
  repositories: Repository[];
  togglingRepos: Set<string>;
  toggleRepository: (repoId: string) => void;
}

const RepositoryTable: React.FC<RepositoryTableProps> = ({ 
  repositories, 
  togglingRepos, 
  toggleRepository 
}) => {
  return (
    <div className="overflow-hidden rounded-lg border border-gray-100 dark:border-gray-700">
      <div className="overflow-x-auto">
        <table className="min-w-full">
        <thead>
          <tr>
            <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">Repository</th>
            <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">Organization</th>
            <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">Status</th>
            <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">Actions</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
          {repositories.map((repo) => (
            <tr key={repo.id}>
              <td className="px-6 py-4 whitespace-nowrap">
                <div className="flex items-center">
                  {repo.owner_avatar_url && (
                    <img className="h-8 w-8 rounded-full mr-3" src={repo.owner_avatar_url} alt={repo.owner_name || ''} />
                  )}
                  <div>
                    <div className="text-sm font-medium text-gray-900 dark:text-gray-100">{repo.name}</div>
                  </div>
                </div>
              </td>
              <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400">
                {repo.organization || repo.owner_name || '-'}
              </td>
              <td className="px-6 py-4 whitespace-nowrap">
                <Switch
                  id={`toggle-${repo.id}`}
                  checked={repo.enabled}
                  onChange={() => toggleRepository(repo.id)}
                  disabled={togglingRepos.has(repo.id)}
                  loading={togglingRepos.has(repo.id)}
                  showStatusText={true}
                />
              </td>
              <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                {/* Actions can be added here if needed */}
              </td>
            </tr>
          ))}
        </tbody>
        </table>
      </div>
    </div>
  );
};

export default RepositoryTable;
