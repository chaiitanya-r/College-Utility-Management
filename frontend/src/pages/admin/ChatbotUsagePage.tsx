import React, { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import DashboardLayout from '@/components/DashboardLayout';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Bot, Cpu, Users, Building2, Search, ArrowLeft, RefreshCw,
  MessageSquare, Zap, Trophy, Shield, Activity
} from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { OrganizationApi, getApiErrorMessage } from '@/lib/api';
import { buildDashboardUser } from '@/lib/dashboardUser';
import { LoadingState } from '@/components/PageState';
import { format } from 'date-fns';

interface SummaryData {
  totalTokens: number;
  promptTokens: number;
  candidateTokens: number;
  totalRequests: number;
}

interface TopOrg {
  organizationName: string;
  totalTokens: number;
  requestCount: number;
}

interface TopUser {
  userName: string;
  userEmail: string;
  userRole: string;
  organizationName: string;
  totalTokens: number;
  requestCount: number;
}

interface RecentLog {
  _id: string;
  organizationName: string;
  userName: string;
  userEmail: string;
  userRole: string;
  promptTokens: number;
  candidateTokens: number;
  totalTokens: number;
  promptSnippet: string;
  toolsUsed: string[];
  provider: string;
  createdAt: string;
}

const ChatbotUsagePage: React.FC = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const user = buildDashboardUser();

  const [isLoading, setIsLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [summary, setSummary] = useState<SummaryData>({
    totalTokens: 0,
    promptTokens: 0,
    candidateTokens: 0,
    totalRequests: 0,
  });
  const [topOrgs, setTopOrgs] = useState<TopOrg[]>([]);
  const [topUsers, setTopUsers] = useState<TopUser[]>([]);
  const [recentLogs, setRecentLogs] = useState<RecentLog[]>([]);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      setIsLoading(true);
      const res = await OrganizationApi.getChatbotUsageStats();
      const data = res.data || {};
      setSummary(data.summary || { totalTokens: 0, promptTokens: 0, candidateTokens: 0, totalRequests: 0 });
      setTopOrgs(data.topOrganizations || []);
      setTopUsers(data.topUsers || []);
      setRecentLogs(data.recentLogs || []);
    } catch (error: any) {
      toast({
        title: 'Error Loading Usage Data',
        description: getApiErrorMessage(error, 'Failed to fetch chatbot token analytics'),
        variant: 'destructive',
      });
    } finally {
      setIsLoading(false);
    }
  };

  const filteredLogs = useMemo(() => {
    const term = searchTerm.toLowerCase().trim();
    if (!term) return recentLogs;
    return recentLogs.filter((log) =>
      log.userName.toLowerCase().includes(term) ||
      log.userEmail.toLowerCase().includes(term) ||
      log.organizationName.toLowerCase().includes(term) ||
      log.promptSnippet.toLowerCase().includes(term) ||
      log.userRole.toLowerCase().includes(term)
    );
  }, [recentLogs, searchTerm]);

  const topUser = topUsers[0];
  const topOrg = topOrgs[0];

  if (isLoading) {
    return (
      <DashboardLayout user={user}>
        <LoadingState message="Fetching Chatbot API & Token Analytics…" rows={5} />
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout user={user}>
      <div className="space-y-6 sm:space-y-8 animate-fade-in pb-12">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white/70 backdrop-blur-md p-6 rounded-3xl border border-slate-200/60 shadow-sm">
          <div className="flex items-center gap-4">
            <Button
              variant="outline"
              size="icon"
              className="rounded-2xl shrink-0 border-slate-200 hover:bg-slate-100"
              onClick={() => navigate('/super-admin/dashboard')}
            >
              <ArrowLeft className="w-5 h-5 text-slate-700" />
            </Button>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-xs uppercase tracking-widest bg-[#123458]/10 text-[#123458] px-2.5 py-0.5 rounded-full font-black">
                  Platform Admin
                </span>
                <Badge variant="outline" className="text-xs font-bold border-amber-300 bg-amber-50 text-amber-800">
                  <Zap className="w-3 h-3 mr-1 fill-amber-500 text-amber-500" /> AI API Metrics
                </Badge>
              </div>
              <h1 className="text-2xl sm:text-3xl font-black text-slate-800 mt-1">Chatbot Token & API Usage</h1>
              <p className="text-xs sm:text-sm text-slate-400 font-semibold mt-0.5">
                Track Gemini & rule-based chatbot token consumption across organizations, faculty, and users.
              </p>
            </div>
          </div>

          <Button
            onClick={loadData}
            variant="outline"
            className="rounded-xl font-bold border-slate-200 hover:bg-slate-100 flex items-center gap-2"
          >
            <RefreshCw className="w-4 h-4 text-slate-600" /> Refresh Metrics
          </Button>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-6">
          <Card className="rounded-3xl border-slate-200/70 shadow-sm hover:shadow-md transition-all duration-300 bg-gradient-to-br from-white to-blue-50/30">
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">Total Tokens</span>
                <div className="p-3 bg-[#123458]/10 rounded-2xl">
                  <Cpu className="w-6 h-6 text-[#123458]" />
                </div>
              </div>
              <div className="mt-4">
                <h3 className="text-3xl font-black text-slate-900 tracking-tight">
                  {summary.totalTokens.toLocaleString()}
                </h3>
                <div className="flex items-center gap-2 mt-2 text-xs text-slate-500 font-semibold">
                  <span className="bg-slate-100 px-2 py-0.5 rounded-md font-bold text-slate-700">
                    Input: {summary.promptTokens.toLocaleString()}
                  </span>
                  <span className="bg-slate-100 px-2 py-0.5 rounded-md font-bold text-slate-700">
                    Output: {summary.candidateTokens.toLocaleString()}
                  </span>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="rounded-3xl border-slate-200/70 shadow-sm hover:shadow-md transition-all duration-300 bg-gradient-to-br from-white to-indigo-50/30">
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">Total Requests</span>
                <div className="p-3 bg-indigo-500/10 rounded-2xl">
                  <MessageSquare className="w-6 h-6 text-indigo-600" />
                </div>
              </div>
              <div className="mt-4">
                <h3 className="text-3xl font-black text-slate-900 tracking-tight">
                  {summary.totalRequests.toLocaleString()}
                </h3>
                <p className="text-xs text-slate-400 font-semibold mt-2">
                  Avg ~{summary.totalRequests > 0 ? Math.round(summary.totalTokens / summary.totalRequests) : 0} tokens / call
                </p>
              </div>
            </CardContent>
          </Card>

          <Card className="rounded-3xl border-slate-200/70 shadow-sm hover:shadow-md transition-all duration-300 bg-gradient-to-br from-white to-amber-50/30">
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">Highest User</span>
                <div className="p-3 bg-amber-500/10 rounded-2xl">
                  <Trophy className="w-6 h-6 text-amber-600" />
                </div>
              </div>
              <div className="mt-4">
                <h3 className="text-lg font-black text-slate-900 truncate">
                  {topUser ? topUser.userName : 'N/A'}
                </h3>
                <p className="text-xs text-amber-700 font-bold truncate mt-0.5">
                  {topUser ? `${topUser.totalTokens.toLocaleString()} tokens (${topUser.requestCount} calls)` : 'No usage yet'}
                </p>
                <p className="text-[10px] text-slate-400 font-semibold truncate mt-1">
                  {topUser?.userEmail || topUser?.organizationName || ''}
                </p>
              </div>
            </CardContent>
          </Card>

          <Card className="rounded-3xl border-slate-200/70 shadow-sm hover:shadow-md transition-all duration-300 bg-gradient-to-br from-white to-emerald-50/30">
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">Top Organization</span>
                <div className="p-3 bg-emerald-500/10 rounded-2xl">
                  <Building2 className="w-6 h-6 text-emerald-600" />
                </div>
              </div>
              <div className="mt-4">
                <h3 className="text-lg font-black text-slate-900 truncate">
                  {topOrg ? topOrg.organizationName : 'N/A'}
                </h3>
                <p className="text-xs text-emerald-700 font-bold truncate mt-0.5">
                  {topOrg ? `${topOrg.totalTokens.toLocaleString()} tokens (${topOrg.requestCount} calls)` : 'No usage yet'}
                </p>
                <p className="text-[10px] text-slate-400 font-semibold truncate mt-1">
                  {topOrg && summary.totalTokens > 0 ? `${Math.round((topOrg.totalTokens / summary.totalTokens) * 100)}% of total platform tokens` : ''}
                </p>
              </div>
            </CardContent>
          </Card>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <Card className="rounded-3xl border-slate-200/70 shadow-sm overflow-hidden">
            <CardHeader className="bg-slate-50/60 border-b border-slate-100 pb-4">
              <CardTitle className="text-lg font-black text-slate-800 flex items-center gap-2">
                <Users className="w-5 h-5 text-[#123458]" /> Top Consuming Users & Faculty
              </CardTitle>
              <CardDescription className="text-xs font-semibold text-slate-400">
                Ranked by cumulative tokens consumed across all chatbot interactions
              </CardDescription>
            </CardHeader>
            <CardContent className="p-0">
              {topUsers.length === 0 ? (
                <div className="p-8 text-center text-slate-400 text-xs font-semibold">
                  No user chatbot token logs recorded yet.
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow className="bg-slate-50/30">
                      <TableHead className="text-xs font-bold text-slate-500 w-12">#</TableHead>
                      <TableHead className="text-xs font-bold text-slate-500">User / Faculty</TableHead>
                      <TableHead className="text-xs font-bold text-slate-500">Organization</TableHead>
                      <TableHead className="text-xs font-bold text-slate-500 text-right">Requests</TableHead>
                      <TableHead className="text-xs font-bold text-slate-500 text-right">Total Tokens</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {topUsers.map((u, i) => (
                      <TableRow key={i} className="hover:bg-slate-50/80 transition-colors">
                        <TableCell className="font-black text-xs text-slate-400">
                          #{i + 1}
                        </TableCell>
                        <TableCell>
                          <div>
                            <p className="font-bold text-xs text-slate-800">{u.userName}</p>
                            <p className="text-[10px] text-slate-400 font-semibold">{u.userEmail || u.userRole}</p>
                          </div>
                        </TableCell>
                        <TableCell className="text-xs font-semibold text-slate-600 truncate max-w-[140px]">
                          {u.organizationName}
                        </TableCell>
                        <TableCell className="text-xs font-bold text-slate-700 text-right">
                          {u.requestCount}
                        </TableCell>
                        <TableCell className="text-right">
                          <span className="font-black text-xs text-[#123458] bg-[#123458]/5 px-2 py-1 rounded-md border border-[#123458]/10">
                            {u.totalTokens.toLocaleString()}
                          </span>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>

          <Card className="rounded-3xl border-slate-200/70 shadow-sm overflow-hidden">
            <CardHeader className="bg-slate-50/60 border-b border-slate-100 pb-4">
              <CardTitle className="text-lg font-black text-slate-800 flex items-center gap-2">
                <Building2 className="w-5 h-5 text-[#123458]" /> Organization Usage Breakdown
              </CardTitle>
              <CardDescription className="text-xs font-semibold text-slate-400">
                Organizations ranked by highest token consumption
              </CardDescription>
            </CardHeader>
            <CardContent className="p-0">
              {topOrgs.length === 0 ? (
                <div className="p-8 text-center text-slate-400 text-xs font-semibold">
                  No organization chatbot token logs recorded yet.
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow className="bg-slate-50/30">
                      <TableHead className="text-xs font-bold text-slate-500 w-12">#</TableHead>
                      <TableHead className="text-xs font-bold text-slate-500">Organization Name</TableHead>
                      <TableHead className="text-xs font-bold text-slate-500 text-right">API Calls</TableHead>
                      <TableHead className="text-xs font-bold text-slate-500 text-right">Total Tokens</TableHead>
                      <TableHead className="text-xs font-bold text-slate-500 text-right">Share</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {topOrgs.map((o, i) => {
                      const sharePct = summary.totalTokens > 0 ? Math.round((o.totalTokens / summary.totalTokens) * 100) : 0;
                      return (
                        <TableRow key={i} className="hover:bg-slate-50/80 transition-colors">
                          <TableCell className="font-black text-xs text-slate-400">
                            {i + 1}
                          </TableCell>
                          <TableCell className="font-bold text-xs text-slate-800">
                            {o.organizationName}
                          </TableCell>
                          <TableCell className="text-xs font-bold text-slate-700 text-right">
                            {o.requestCount}
                          </TableCell>
                          <TableCell className="text-right">
                            <span className="font-black text-xs text-indigo-700 bg-indigo-50 px-2 py-1 rounded-md border border-indigo-100">
                              {o.totalTokens.toLocaleString()}
                            </span>
                          </TableCell>
                          <TableCell className="text-right">
                            <span className="text-xs font-bold text-slate-500">
                              {sharePct}%
                            </span>
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </div>

        <Card className="rounded-3xl border-slate-200/70 shadow-sm overflow-hidden">
          <CardHeader className="bg-slate-50/60 border-b border-slate-100 pb-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <CardTitle className="text-lg font-black text-slate-800 flex items-center gap-2">
                <Activity className="w-5 h-5 text-[#123458]" /> Real-time Chatbot Request Logs
              </CardTitle>
              <CardDescription className="text-xs font-semibold text-slate-400 mt-0.5">
                Inspect live token calculations, prompt snippets, tools triggered, and user roles
              </CardDescription>
            </div>
            <div className="relative w-full sm:w-72">
              <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <Input
                placeholder="Search user, org, prompt..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-9 text-xs h-9 rounded-xl border-slate-200 bg-white"
              />
            </div>
          </CardHeader>

          <CardContent className="p-0">
            {filteredLogs.length === 0 ? (
              <div className="p-12 text-center text-slate-400 font-semibold text-xs">
                No matching chat request logs found.
              </div>
            ) : (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow className="bg-slate-50/30">
                      <TableHead className="text-xs font-bold text-slate-500">Date & Time</TableHead>
                      <TableHead className="text-xs font-bold text-slate-500">User / Faculty</TableHead>
                      <TableHead className="text-xs font-bold text-slate-500">Organization</TableHead>
                      <TableHead className="text-xs font-bold text-slate-500">Prompt Snippet</TableHead>
                      <TableHead className="text-xs font-bold text-slate-500">Engine / Tools</TableHead>
                      <TableHead className="text-xs font-bold text-slate-500 text-right">Tokens</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredLogs.map((logItem) => (
                      <TableRow key={logItem._id} className="hover:bg-slate-50/80 transition-colors">
                        <TableCell className="text-[11px] font-semibold text-slate-500 whitespace-nowrap">
                          {format(new Date(logItem.createdAt), 'dd MMM yyyy, HH:mm')}
                        </TableCell>
                        <TableCell>
                          <div>
                            <p className="font-bold text-xs text-slate-800">{logItem.userName}</p>
                            <p className="text-[10px] text-slate-400 font-semibold">{logItem.userEmail || logItem.userRole}</p>
                          </div>
                        </TableCell>
                        <TableCell className="text-xs font-semibold text-slate-600 truncate max-w-[130px]">
                          {logItem.organizationName}
                        </TableCell>
                        <TableCell className="text-xs text-slate-700 italic max-w-xs truncate">
                          "{logItem.promptSnippet || 'No text snippet'}"
                        </TableCell>
                        <TableCell>
                          <div className="flex flex-wrap gap-1 items-center">
                            <Badge variant="outline" className="text-[9px] font-bold uppercase tracking-wider border-slate-200">
                              {logItem.provider}
                            </Badge>
                            {logItem.toolsUsed && logItem.toolsUsed.map((tool, idx) => (
                              <Badge key={idx} className="text-[9px] font-semibold bg-[#123458]/10 text-[#123458] border-none">
                                {tool}
                              </Badge>
                            ))}
                          </div>
                        </TableCell>
                        <TableCell className="text-right">
                          <span className="font-black text-xs text-emerald-800 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200">
                            {logItem.totalTokens.toLocaleString()}
                          </span>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
};

export default ChatbotUsagePage;
