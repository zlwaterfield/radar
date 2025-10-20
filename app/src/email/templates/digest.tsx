import {
  Body,
  Container,
  Head,
  Heading,
  Hr,
  Html,
  Link,
  Preview,
  Section,
  Text,
} from '@react-email/components';
import * as React from 'react';

interface GitHubPullRequest {
  number: number;
  title: string;
  html_url: string;
  user: {
    login: string;
  };
  base: {
    repo: {
      full_name: string;
    };
  };
}

interface DigestEmailProps {
  configName?: string;
  scopeType?: string;
  teamName?: string;
  currentUserLogin?: string;
  waitingOnUser: GitHubPullRequest[];
  approvedReadyToMerge: GitHubPullRequest[];
  userOpenPRs: GitHubPullRequest[];
  userDraftPRs: GitHubPullRequest[];
  date: string;
}

export const DigestEmail = ({
  configName,
  scopeType,
  teamName,
  currentUserLogin,
  waitingOnUser = [],
  approvedReadyToMerge = [],
  userOpenPRs = [],
  userDraftPRs = [],
  date,
}: DigestEmailProps) => {
  const isTeamScope = scopeType === 'team';
  const scopeContext = isTeamScope && teamName ? teamName : 'your';
  const headerText = configName ? `${configName} - Radar digest` : 'Radar digest';

  // Group PRs by repository
  const groupPRsByRepo = (prs: GitHubPullRequest[]) => {
    const grouped = new Map<string, GitHubPullRequest[]>();
    prs.forEach((pr) => {
      const repoName = pr.base.repo.full_name;
      if (!grouped.has(repoName)) {
        grouped.set(repoName, []);
      }
      grouped.get(repoName)!.push(pr);
    });
    return grouped;
  };

  return (
    <Html>
      <Head />
      <Preview>{headerText}</Preview>
      <Body style={main}>
        <Container style={container}>
          <Heading style={h1}>{headerText}</Heading>

          {/* PRs waiting for review */}
          {waitingOnUser.length > 0 && (
            <Section style={section}>
              <Heading style={h2}>
                {isTeamScope
                  ? `PRs waiting for review (${waitingOnUser.length})`
                  : `PRs waiting for your review (${waitingOnUser.length})`}
              </Heading>
              {Array.from(groupPRsByRepo(waitingOnUser)).map(([repoName, prs]) => (
                <div key={repoName}>
                  <Text style={repoHeader}>{repoName}</Text>
                  {prs.slice(0, 5).map((pr) => (
                    <Text key={pr.number} style={prItem}>
                      <Link href={pr.html_url} style={prLink}>
                        {pr.title} (#{pr.number})
                      </Link>
                      {' by '}
                      <Link
                        href={`https://github.com/${pr.user.login}`}
                        style={userLink}
                      >
                        {pr.user.login}
                      </Link>
                    </Text>
                  ))}
                  {prs.length > 5 && (
                    <Text style={moreText}>...and {prs.length - 5} more in {repoName}</Text>
                  )}
                </div>
              ))}
            </Section>
          )}

          {/* PRs approved and ready to merge */}
          {approvedReadyToMerge.length > 0 && (
            <Section style={section}>
              <Heading style={h2}>
                {isTeamScope
                  ? `PRs approved and ready to merge (${approvedReadyToMerge.length})`
                  : `Your PRs approved and ready to merge (${approvedReadyToMerge.length})`}
              </Heading>
              {Array.from(groupPRsByRepo(approvedReadyToMerge)).map(([repoName, prs]) => (
                <div key={repoName}>
                  <Text style={repoHeader}>{repoName}</Text>
                  {prs.slice(0, 5).map((pr) => (
                    <Text key={pr.number} style={prItem}>
                      <Link href={pr.html_url} style={prLink}>
                        {pr.title} (#{pr.number})
                      </Link>
                    </Text>
                  ))}
                  {prs.length > 5 && (
                    <Text style={moreText}>...and {prs.length - 5} more in {repoName}</Text>
                  )}
                </div>
              ))}
            </Section>
          )}

          {/* Open PRs */}
          {userOpenPRs.length > 0 && (
            <Section style={section}>
              <Heading style={h2}>
                {isTeamScope
                  ? `Open PRs (${userOpenPRs.length})`
                  : `Your open PRs (${userOpenPRs.length})`}
              </Heading>
              {Array.from(groupPRsByRepo(userOpenPRs)).map(([repoName, prs]) => (
                <div key={repoName}>
                  <Text style={repoHeader}>{repoName}</Text>
                  {prs.slice(0, 5).map((pr) => (
                    <Text key={pr.number} style={prItem}>
                      <Link href={pr.html_url} style={prLink}>
                        {pr.title} (#{pr.number})
                      </Link>
                      {pr.user.login !== currentUserLogin && (
                        <>
                          {' by '}
                          <Link
                            href={`https://github.com/${pr.user.login}`}
                            style={userLink}
                          >
                            {pr.user.login}
                          </Link>
                        </>
                      )}
                    </Text>
                  ))}
                  {prs.length > 5 && (
                    <Text style={moreText}>...and {prs.length - 5} more in {repoName}</Text>
                  )}
                </div>
              ))}
            </Section>
          )}

          {/* Draft PRs */}
          {userDraftPRs.length > 0 && (
            <Section style={section}>
              <Heading style={h2}>
                {isTeamScope
                  ? `Draft PRs (${userDraftPRs.length})`
                  : `Your draft PRs (${userDraftPRs.length})`}
              </Heading>
              {Array.from(groupPRsByRepo(userDraftPRs)).map(([repoName, prs]) => (
                <div key={repoName}>
                  <Text style={repoHeader}>{repoName}</Text>
                  {prs.slice(0, 5).map((pr) => (
                    <Text key={pr.number} style={prItem}>
                      <Link href={pr.html_url} style={prLink}>
                        {pr.title} (#{pr.number})
                      </Link>
                      {pr.user.login !== currentUserLogin && (
                        <>
                          {' by '}
                          <Link
                            href={`https://github.com/${pr.user.login}`}
                            style={userLink}
                          >
                            {pr.user.login}
                          </Link>
                        </>
                      )}
                    </Text>
                  ))}
                  {prs.length > 5 && (
                    <Text style={moreText}>...and {prs.length - 5} more in {repoName}</Text>
                  )}
                </div>
              ))}
            </Section>
          )}

          <Hr style={hr} />
          <Text style={footer}>
            📅 {date} • Manage digest settings in your dashboard
          </Text>
        </Container>
      </Body>
    </Html>
  );
};

export default DigestEmail;

// Styles
const main = {
  backgroundColor: '#f6f9fc',
  fontFamily:
    '-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,"Helvetica Neue",Ubuntu,sans-serif',
};

const container = {
  backgroundColor: '#ffffff',
  margin: '0 auto',
  padding: '20px 0 48px',
  marginBottom: '64px',
  maxWidth: '650px',
};

const h1 = {
  color: '#1a202c',
  fontSize: '28px',
  fontWeight: '700',
  margin: '40px 0 30px 0',
  padding: '0 40px',
};

const h2 = {
  color: '#2d3748',
  fontSize: '20px',
  fontWeight: '600',
  margin: '24px 0 12px 0',
  padding: '0 40px',
};

const section = {
  marginBottom: '24px',
};

const repoHeader = {
  color: '#4a5568',
  fontSize: '16px',
  fontWeight: '600',
  margin: '12px 0 8px 0',
  padding: '0 40px',
};

const prItem = {
  color: '#2d3748',
  fontSize: '15px',
  lineHeight: '24px',
  margin: '4px 0',
  padding: '0 40px',
};

const prLink = {
  color: '#3182ce',
  textDecoration: 'none',
  fontWeight: '500',
};

const userLink = {
  color: '#718096',
  textDecoration: 'none',
};

const moreText = {
  color: '#718096',
  fontSize: '14px',
  fontStyle: 'italic',
  margin: '8px 0',
  padding: '0 40px',
};

const hr = {
  borderColor: '#e2e8f0',
  margin: '32px 40px',
};

const footer = {
  color: '#718096',
  fontSize: '14px',
  lineHeight: '20px',
  padding: '0 40px',
  marginTop: '12px',
};
