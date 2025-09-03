import React from 'react';
import Loader from '@/components/Loader';

interface Team {
  id: string;
  teamSlug: string;
  teamName: string;
  organization: string;
  permission: string;
  enabled: boolean;
}

interface TeamTableProps {
  teams: Team[];
  togglingTeams: Set<string>;
  toggleTeam: (teamId: string) => void;
}

const TeamTable: React.FC<TeamTableProps> = ({ 
  teams, 
  togglingTeams, 
  toggleTeam 
}) => {
  return (
    <div className="overflow-hidden rounded-lg border border-gray-100 dark:border-gray-700">
      <div className="overflow-x-auto">
        <table className="min-w-full">
        <thead>
          <tr>
            <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">Team</th>
            <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">Organization</th>
            <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">Status</th>
            <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">Actions</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
          {teams.map((team) => (
            <tr key={team.id}>
              <td className="px-6 py-4 whitespace-nowrap">
                <div className="flex items-center">
                  <div className="h-8 w-8 rounded-full bg-gray-200 dark:bg-gray-600 flex items-center justify-center mr-3">
                    <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
                      {team.teamName.charAt(0).toUpperCase()}
                    </span>
                  </div>
                  <div>
                    <div className="text-sm font-medium text-gray-900 dark:text-gray-100">{team.teamName}</div>
                    <div className="text-sm text-gray-500 dark:text-gray-400">@{team.teamSlug}</div>
                  </div>
                </div>
              </td>
              <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400">
                {team.organization}
              </td>
              <td className="px-6 py-4 whitespace-nowrap">
                <div className="flex items-center space-x-3">
                  <div className="relative inline-block w-10 align-middle select-none">
                    <input
                      type="checkbox"
                      id={`toggle-${team.id}`}
                      className="hidden"
                      checked={team.enabled}
                      onChange={() => toggleTeam(team.id)}
                      disabled={togglingTeams.has(team.id)}
                    />
                    <label
                      htmlFor={`toggle-${team.id}`}
                      className={`block overflow-hidden h-6 rounded-full cursor-pointer transition-colors duration-200 ease-in-out ${
                        togglingTeams.has(team.id) ? 'opacity-50' : ''
                      } ${team.enabled ? 'bg-marian-blue-600 dark:bg-marian-blue-500' : 'bg-gray-300 dark:bg-gray-600'}`}
                    >
                      <span 
                        className={`block h-5 w-5 rounded-full bg-white shadow transform transition-transform duration-200 ease-in-out ${
                          team.enabled ? 'translate-x-5' : 'translate-x-0'
                        }`}
                        style={{ margin: '2px' }}
                      ></span>
                    </label>
                  </div>
                  <span className="text-sm font-medium flex items-center">
                    {togglingTeams.has(team.id) ? (
                      <div className="flex items-center">
                        <div className="relative h-4 w-4 mr-2">
                          <div className="h-4 w-4 rounded-full border-2 border-gray-200 dark:border-gray-600"></div>
                          <div className="absolute top-0 left-0 h-4 w-4 rounded-full border-2 border-marian-blue-600 border-t-transparent animate-spin"></div>
                        </div>
                        <span className="dark:text-white text-marian-blue-500">
                          {team.enabled ? 'Enabled' : 'Disabled'}
                        </span>
                      </div>
                    ) : (
                      <span className="dark:text-white text-marian-blue-500">
                        {team.enabled ? 'Enabled' : 'Disabled'}
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
    </div>
  );
};

export default TeamTable;