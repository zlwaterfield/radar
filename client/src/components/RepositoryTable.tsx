import React from 'react';

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
    <div className="overflow-x-auto w-full">
      <table className="min-w-full divide-y divide-gray-200">
        <thead className="bg-gray-50 dark:bg-gray-700">
          <tr>
            <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">Repository</th>
            <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">Organization</th>
            <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">Status</th>
            <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">Actions</th>
          </tr>
        </thead>
        <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
          {repositories.map((repo) => (
            <tr key={repo.id} className="hover:bg-gray-50 dark:hover:bg-gray-700">
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
                <div className="flex items-center space-x-3">
                  <div className="relative inline-block w-10 align-middle select-none">
                    <input
                      type="checkbox"
                      id={`toggle-${repo.id}`}
                      className="hidden"
                      checked={repo.enabled}
                      onChange={() => toggleRepository(repo.id)}
                      disabled={togglingRepos.has(repo.id)}
                    />
                    <label
                      htmlFor={`toggle-${repo.id}`}
                      className={`block overflow-hidden h-6 rounded-full cursor-pointer transition-colors duration-200 ease-in-out ${
                        togglingRepos.has(repo.id) ? 'opacity-50' : ''
                      } ${repo.enabled ? 'bg-blue-600 dark:bg-blue-500' : 'bg-gray-300 dark:bg-gray-700'}`}
                    >
                      <span 
                        className={`block h-5 w-5 rounded-full bg-white shadow transform transition-transform duration-200 ease-in-out ${
                          repo.enabled ? 'translate-x-5' : 'translate-x-0'
                        }`}
                        style={{ margin: '2px' }}
                      ></span>
                    </label>
                  </div>
                  <span className="text-sm font-medium flex items-center">
                    {togglingRepos.has(repo.id) ? (
                      <div className="flex items-center">
                        <div className="animate-spin h-4 w-4 border-2 border-blue-500 rounded-full border-t-transparent mr-2"></div>
                        <span className={repo.enabled ? "text-blue-600" : "text-gray-900 dark:text-gray-300"}>
                          {repo.enabled ? 'Enabled' : 'Disabled'}
                        </span>
                      </div>
                    ) : (
                      <span className={repo.enabled ? "text-blue-600" : "text-gray-900 dark:text-gray-300"}>
                        {repo.enabled ? 'Enabled' : 'Disabled'}
                      </span>
                    )}
                  </span>
                </div>
              </td>
              <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                {/* Actions can be added here if needed */}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
};

export default RepositoryTable;
