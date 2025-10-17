import React from 'react';

interface Team {
  id: string;
  teamSlug: string;
  teamName: string;
  organization: string;
  permission: string;
}

interface TeamTableProps {
  teams: Team[];
}

const TeamTable: React.FC<TeamTableProps> = ({ teams }) => {
  return (
    <div className="overflow-hidden rounded-lg border border-gray-100 dark:border-gray-700">
      <div className="overflow-x-auto">
        <table className="min-w-full">
        <thead>
          <tr>
            <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">Team</th>
            <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">Organization</th>
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
            </tr>
          ))}
        </tbody>
        </table>
      </div>
    </div>
  );
};

export default TeamTable;