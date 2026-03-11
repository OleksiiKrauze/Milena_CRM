import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { Header } from '@/components/layout/Header';
import { Container, Card, CardContent, Loading } from '@/components/ui';
import { asteriskApi } from '@/api/asterisk';
import { casesApi } from '@/api/cases';
import type { CallRecording } from '@/types/api';
import {
  PhoneCall,
  Download,
  Search,
  ChevronLeft,
  ChevronRight,
  ArrowUp,
  ArrowDown,
  ChevronsUpDown,
  Link2,
  Unlink,
  Plus,
  X,
} from 'lucide-react';

type SortField = 'calldate' | 'src' | 'dst' | 'duration' | 'billsec';

function formatDuration(seconds: number): string {
  if (!seconds) return '0:00';
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}:${s.toString().padStart(2, '0')}`;
}

function formatDate(dateStr: string): string {
  try {
    const d = new Date(dateStr);
    return d.toLocaleString('uk-UA', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    });
  } catch {
    return dateStr;
  }
}

function dispositionLabel(d: string): { text: string; cls: string } {
  switch (d?.toUpperCase()) {
    case 'ANSWERED':
      return { text: 'Відповів', cls: 'bg-green-100 text-green-700' };
    case 'NO ANSWER':
      return { text: 'Без відповіді', cls: 'bg-yellow-100 text-yellow-700' };
    case 'BUSY':
      return { text: 'Зайнято', cls: 'bg-red-100 text-red-700' };
    case 'FAILED':
      return { text: 'Збій', cls: 'bg-gray-100 text-gray-700' };
    default:
      return { text: d || '—', cls: 'bg-gray-100 text-gray-600' };
  }
}

function SortIcon({ field, current, dir }: { field: SortField; current: SortField; dir: 'asc' | 'desc' }) {
  if (field !== current) return <ChevronsUpDown className="h-3 w-3 ml-1 text-gray-400 inline" />;
  return dir === 'asc'
    ? <ArrowUp className="h-3 w-3 ml-1 text-blue-600 inline" />
    : <ArrowDown className="h-3 w-3 ml-1 text-blue-600 inline" />;
}

/** Pick the "external" phone: the one longer than 5 digits. Falls back to src. */
function externalPhone(src: string, dst: string): string {
  if ((dst || '').replace(/\D/g, '').length > 5) return dst;
  if ((src || '').replace(/\D/g, '').length > 5) return src;
  return src || dst || '';
}

// ── Link-to-case modal ─────────────────────────────────────────────────────────

interface LinkModalProps {
  recording: CallRecording;
  onClose: () => void;
  onLinked: () => void;
}

function LinkCaseModal({ recording, onClose, onLinked }: LinkModalProps) {
  const queryClient = useQueryClient();
  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');

  const { data: casesData, isLoading } = useQuery({
    queryKey: ['cases-search-modal', debouncedSearch],
    queryFn: () => casesApi.list({ search_query: debouncedSearch || undefined, limit: 20 }),
    enabled: true,
  });

  // Already-linked cases for this recording
  const { data: linksData } = useQuery({
    queryKey: ['recording-links', recording.uniqueid],
    queryFn: () => asteriskApi.getLinksByUniqueid(recording.uniqueid),
  });

  const linkedCaseIds = new Set((linksData?.items || []).map(l => l.case_id));

  const linkMutation = useMutation({
    mutationFn: (caseId: number) => asteriskApi.linkRecording(recording, caseId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['recording-links', recording.uniqueid] });
      queryClient.invalidateQueries({ queryKey: ['case-recordings'] });
      onLinked();
    },
  });

  const unlinkMutation = useMutation({
    mutationFn: (linkId: number) => asteriskApi.unlinkRecording(linkId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['recording-links', recording.uniqueid] });
      queryClient.invalidateQueries({ queryKey: ['case-recordings'] });
    },
  });

  const handleSearchChange = (value: string) => {
    setSearch(value);
    clearTimeout((window as any)._caseModalTimer);
    (window as any)._caseModalTimer = setTimeout(() => setDebouncedSearch(value), 350);
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-lg max-h-[80vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b">
          <h2 className="font-semibold text-gray-900">Прив'язати до заявки</h2>
          <button onClick={onClose} className="p-1 rounded hover:bg-gray-100">
            <X className="h-5 w-5 text-gray-500" />
          </button>
        </div>

        {/* Current links */}
        {linksData && linksData.items.length > 0 && (
          <div className="px-4 pt-3 pb-2 border-b bg-gray-50">
            <p className="text-xs font-semibold text-gray-500 uppercase mb-2">Прив'язані заявки</p>
            <div className="space-y-1">
              {linksData.items.map(link => (
                <div key={link.id} className="flex items-center justify-between bg-white border border-gray-200 rounded-lg px-3 py-1.5 text-sm">
                  <span className="text-gray-800">Заявка #{link.case_id}</span>
                  <button
                    onClick={() => unlinkMutation.mutate(link.id)}
                    disabled={unlinkMutation.isPending}
                    className="flex items-center gap-1 text-red-600 hover:text-red-700 text-xs"
                  >
                    <Unlink className="h-3.5 w-3.5" /> Відв'язати
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Search */}
        <div className="p-4 border-b">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
            <input
              autoFocus
              type="text"
              placeholder="Пошук заявки за ПІБ або номером..."
              value={search}
              onChange={e => handleSearchChange(e.target.value)}
              className="w-full pl-9 pr-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
        </div>

        {/* Cases list */}
        <div className="flex-1 overflow-y-auto p-2">
          {isLoading && <Loading />}
          {casesData?.cases.map(c => {
            const alreadyLinked = linkedCaseIds.has(c.id);
            return (
              <button
                key={c.id}
                disabled={alreadyLinked || linkMutation.isPending}
                onClick={() => linkMutation.mutate(c.id)}
                className="w-full text-left px-3 py-2.5 rounded-lg hover:bg-blue-50 disabled:opacity-50 disabled:cursor-default flex items-center justify-between gap-2 mb-0.5 transition-colors"
              >
                <div>
                  <p className="text-sm font-medium text-gray-900">#{c.id} — {c.missing_full_name}</p>
                  <p className="text-xs text-gray-500">{c.applicant_full_name} · {c.decision_type}</p>
                </div>
                {alreadyLinked && (
                  <span className="text-xs text-green-600 font-medium shrink-0">Прив'язано</span>
                )}
              </button>
            );
          })}
          {casesData?.cases.length === 0 && (
            <p className="text-sm text-gray-500 text-center py-4">Заявок не знайдено</p>
          )}
        </div>
      </div>
    </div>
  );
}

// ── Main page ─────────────────────────────────────────────────────────────────

export function CallRecordingsPage() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [sortBy, setSortBy] = useState<SortField>('calldate');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc');
  const [page, setPage] = useState(0);
  const [linkingRecording, setLinkingRecording] = useState<CallRecording | null>(null);
  const limit = 50;

  // Debounce search
  const handleSearchChange = (value: string) => {
    setSearch(value);
    clearTimeout((window as any)._recordingSearchTimer);
    (window as any)._recordingSearchTimer = setTimeout(() => {
      setDebouncedSearch(value);
      setPage(0);
    }, 400);
  };

  const handleSort = (field: SortField) => {
    if (field === sortBy) {
      setSortDir(d => d === 'asc' ? 'desc' : 'asc');
    } else {
      setSortBy(field);
      setSortDir('desc');
    }
    setPage(0);
  };

  const { data, isLoading, error } = useQuery({
    queryKey: ['call-recordings', debouncedSearch, sortBy, sortDir, page],
    queryFn: () => asteriskApi.listRecordings({
      skip: page * limit,
      limit,
      sort_by: sortBy,
      sort_dir: sortDir,
      search: debouncedSearch || undefined,
    }),
    retry: 1,
  });

  const totalPages = data ? Math.ceil(data.total / limit) : 0;

  const handleDownload = async (recording: CallRecording) => {
    try {
      const blob = await asteriskApi.downloadRecording(recording.recordingfile);
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      const ext = recording.recordingfile.split('.').pop() || 'wav';
      a.download = `recording-${recording.uniqueid}.${ext}`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch {
      alert('Помилка завантаження файлу');
    }
  };

  const handleCreateCase = (recording: CallRecording) => {
    const phone = externalPhone(recording.src, recording.dst);
    navigate('/cases/new', { state: { applicant_phone: phone } });
  };

  const thClass = (_field: SortField) =>
    `px-3 py-2 text-left text-xs font-semibold text-gray-600 uppercase tracking-wide cursor-pointer select-none hover:text-gray-900 whitespace-nowrap`;

  return (
    <div className="min-h-screen pb-nav">
      <Header title="Записи розмов" showBack />

      <Container className="py-4">

        {/* Search */}
        <Card className="mb-4">
          <CardContent className="p-3">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
              <input
                type="text"
                placeholder="Пошук за номером телефону..."
                value={search}
                onChange={e => handleSearchChange(e.target.value)}
                className="w-full pl-9 pr-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
          </CardContent>
        </Card>

        {/* Stats line */}
        {data && (
          <p className="text-sm text-gray-500 mb-3">
            Знайдено записів: <span className="font-semibold text-gray-800">{data.total}</span>
          </p>
        )}

        {/* Error */}
        {error && (
          <Card className="mb-4 border-red-200 bg-red-50">
            <CardContent className="p-4">
              <p className="text-sm text-red-700 font-medium">Помилка підключення до IP АТС</p>
              <p className="text-xs text-red-600 mt-1">
                {(error as any)?.response?.data?.detail || (error as Error).message}
              </p>
              <p className="text-xs text-gray-500 mt-2">
                Перевірте налаштування у розділі <strong>Налаштування → IP АТС → Налаштування з'єднання</strong>
              </p>
            </CardContent>
          </Card>
        )}

        {isLoading && <Loading />}

        {/* Table */}
        {data && data.items.length > 0 && (
          <>
            <div className="overflow-auto rounded-lg border border-gray-200 shadow-sm" style={{ maxHeight: 'calc(100vh - 260px)' }}>
              <table className="w-full bg-white text-sm">
                <thead className="bg-gray-50 border-b border-gray-200 sticky top-0 z-10">
                  <tr>
                    <th className={thClass('calldate')} onClick={() => handleSort('calldate')}>
                      Дата та час <SortIcon field="calldate" current={sortBy} dir={sortDir} />
                    </th>
                    <th className={thClass('src')} onClick={() => handleSort('src')}>
                      Від <SortIcon field="src" current={sortBy} dir={sortDir} />
                    </th>
                    <th className={thClass('dst')} onClick={() => handleSort('dst')}>
                      Кому <SortIcon field="dst" current={sortBy} dir={sortDir} />
                    </th>
                    <th className={thClass('duration')} onClick={() => handleSort('duration')}>
                      Тривалість <SortIcon field="duration" current={sortBy} dir={sortDir} />
                    </th>
                    <th className={thClass('billsec')} onClick={() => handleSort('billsec')}>
                      Розмова <SortIcon field="billsec" current={sortBy} dir={sortDir} />
                    </th>
                    <th className="px-3 py-2 text-left text-xs font-semibold text-gray-600 uppercase tracking-wide">
                      Статус
                    </th>
                    <th className="px-3 py-2 text-center text-xs font-semibold text-gray-600 uppercase tracking-wide whitespace-nowrap">
                      Дії
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {data.items.map((rec) => {
                    const disp = dispositionLabel(rec.disposition);
                    return (
                      <RecordingRow
                        key={rec.uniqueid}
                        rec={rec}
                        disp={disp}
                        onDownload={handleDownload}
                        onLink={() => setLinkingRecording(rec)}
                        onCreateCase={() => handleCreateCase(rec)}
                      />
                    );
                  })}
                </tbody>
              </table>
            </div>

            {/* Pagination */}
            {totalPages > 1 && (
              <div className="flex items-center justify-between mt-4">
                <button
                  disabled={page === 0}
                  onClick={() => setPage(p => p - 1)}
                  className="flex items-center gap-1 px-3 py-2 text-sm border border-gray-300 rounded-lg disabled:opacity-40 hover:bg-gray-50"
                >
                  <ChevronLeft className="h-4 w-4" /> Назад
                </button>
                <span className="text-sm text-gray-600">
                  Сторінка {page + 1} з {totalPages}
                </span>
                <button
                  disabled={page >= totalPages - 1}
                  onClick={() => setPage(p => p + 1)}
                  className="flex items-center gap-1 px-3 py-2 text-sm border border-gray-300 rounded-lg disabled:opacity-40 hover:bg-gray-50"
                >
                  Далі <ChevronRight className="h-4 w-4" />
                </button>
              </div>
            )}
          </>
        )}

        {/* Empty state */}
        {data && data.items.length === 0 && !isLoading && (
          <Card>
            <CardContent className="p-8 text-center">
              <PhoneCall className="h-12 w-12 text-gray-300 mx-auto mb-3" />
              <p className="text-gray-500 font-medium">Записів не знайдено</p>
              {debouncedSearch && (
                <p className="text-sm text-gray-400 mt-1">Спробуйте змінити параметри пошуку</p>
              )}
            </CardContent>
          </Card>
        )}
      </Container>

      {/* Link modal */}
      {linkingRecording && (
        <LinkCaseModal
          recording={linkingRecording}
          onClose={() => setLinkingRecording(null)}
          onLinked={() => {
            queryClient.invalidateQueries({ queryKey: ['case-recordings'] });
          }}
        />
      )}
    </div>
  );
}

// ── Row sub-component (loads its own links count) ─────────────────────────────

interface RecordingRowProps {
  rec: CallRecording;
  disp: { text: string; cls: string };
  onDownload: (rec: CallRecording) => void;
  onLink: () => void;
  onCreateCase: () => void;
}

function RecordingRow({ rec, disp, onDownload, onLink, onCreateCase }: RecordingRowProps) {
  const { data: linksData } = useQuery({
    queryKey: ['recording-links', rec.uniqueid],
    queryFn: () => asteriskApi.getLinksByUniqueid(rec.uniqueid),
    staleTime: 30_000,
  });

  const linkCount = linksData?.items.length ?? 0;

  return (
    <tr className="hover:bg-gray-50 transition-colors">
      <td className="px-3 py-3 text-gray-800 whitespace-nowrap">{formatDate(rec.calldate)}</td>
      <td className="px-3 py-3 font-mono text-blue-700">{rec.src || '—'}</td>
      <td className="px-3 py-3 font-mono text-green-700">{rec.dst || '—'}</td>
      <td className="px-3 py-3 text-gray-600">{formatDuration(rec.duration)}</td>
      <td className="px-3 py-3 text-gray-600">{formatDuration(rec.billsec)}</td>
      <td className="px-3 py-3">
        <span className={`inline-flex px-2 py-0.5 rounded-full text-xs font-medium ${disp.cls}`}>
          {disp.text}
        </span>
      </td>
      <td className="px-3 py-3">
        <div className="flex items-center gap-1.5 justify-center">
          {/* Download */}
          <button
            onClick={() => onDownload(rec)}
            title="Завантажити"
            className="inline-flex items-center gap-1 px-2.5 py-1.5 bg-blue-600 text-white text-xs rounded-lg hover:bg-blue-700 transition-colors"
          >
            <Download className="h-3 w-3" />
          </button>
          {/* Link to case */}
          <button
            onClick={onLink}
            title="Прив'язати до заявки"
            className={`inline-flex items-center gap-1 px-2.5 py-1.5 text-xs rounded-lg transition-colors ${
              linkCount > 0
                ? 'bg-green-100 text-green-700 hover:bg-green-200'
                : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
            }`}
          >
            <Link2 className="h-3 w-3" />
            {linkCount > 0 && <span>{linkCount}</span>}
          </button>
          {/* Create case */}
          <button
            onClick={onCreateCase}
            title="Створити заявку"
            className="inline-flex items-center gap-1 px-2.5 py-1.5 bg-violet-100 text-violet-700 text-xs rounded-lg hover:bg-violet-200 transition-colors"
          >
            <Plus className="h-3 w-3" />
          </button>
        </div>
      </td>
    </tr>
  );
}
