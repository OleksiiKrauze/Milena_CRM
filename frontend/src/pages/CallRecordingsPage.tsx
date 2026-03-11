import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { Header } from '@/components/layout/Header';
import { Container, Card, CardContent, Loading } from '@/components/ui';
import { asteriskApi } from '@/api/asterisk';
import { casesApi } from '@/api/cases';
import type { CallRecording } from '@/types/api';
import { AudioPlayer } from '@/components/CaseRecordingsBlock';
import {
  PhoneCall,
  Download,
  Search,
  ChevronLeft,
  ChevronRight,
  Link2,
  Unlink,
  Plus,
  X,
  Phone,
  Clock,
} from 'lucide-react';

function formatDuration(seconds: number): string {
  if (!seconds) return '0:00';
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}:${s.toString().padStart(2, '0')}`;
}

function formatDate(dateStr: string): string {
  try {
    return new Date(dateStr).toLocaleString('uk-UA', {
      day: '2-digit', month: '2-digit', year: 'numeric',
      hour: '2-digit', minute: '2-digit',
    });
  } catch {
    return dateStr;
  }
}

function dispositionLabel(d: string): { text: string; cls: string } {
  switch (d?.toUpperCase()) {
    case 'ANSWERED':   return { text: 'Відповів',       cls: 'bg-green-100 text-green-700' };
    case 'NO ANSWER':  return { text: 'Без відповіді',  cls: 'bg-yellow-100 text-yellow-700' };
    case 'BUSY':       return { text: 'Зайнято',        cls: 'bg-red-100 text-red-700' };
    case 'FAILED':     return { text: 'Збій',           cls: 'bg-gray-100 text-gray-700' };
    default:           return { text: d || '—',         cls: 'bg-gray-100 text-gray-600' };
  }
}

/** Pick the "external" phone: longer than 5 digits. Falls back to src. */
function externalPhone(src: string, dst: string): string {
  if ((dst || '').replace(/\D/g, '').length > 5) return dst;
  if ((src || '').replace(/\D/g, '').length > 5) return src;
  return src || dst || '';
}

// ── Link-to-case modal ────────────────────────────────────────────────────────

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
  });

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
        <div className="flex items-center justify-between p-4 border-b">
          <h2 className="font-semibold text-gray-900">Прив'язати до заявки</h2>
          <button onClick={onClose} className="p-1 rounded hover:bg-gray-100">
            <X className="h-5 w-5 text-gray-500" />
          </button>
        </div>

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
                {alreadyLinked && <span className="text-xs text-green-600 font-medium shrink-0">Прив'язано</span>}
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

// ── Recording card ────────────────────────────────────────────────────────────

interface RecordingCardProps {
  rec: CallRecording;
  onDownload: (rec: CallRecording) => void;
  onLink: (rec: CallRecording) => void;
  onCreateCase: (rec: CallRecording) => void;
}

function RecordingCard({ rec, onDownload, onLink, onCreateCase }: RecordingCardProps) {
  const { data: linksData } = useQuery({
    queryKey: ['recording-links', rec.uniqueid],
    queryFn: () => asteriskApi.getLinksByUniqueid(rec.uniqueid),
    staleTime: 30_000,
  });

  const linkCount = linksData?.items.length ?? 0;
  const disp = dispositionLabel(rec.disposition);

  return (
    <Card>
      <CardContent className="p-4">
        {/* Top row: date + status */}
        <div className="flex items-center justify-between mb-2">
          <span className="text-sm font-medium text-gray-800">{formatDate(rec.calldate)}</span>
          <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${disp.cls}`}>{disp.text}</span>
        </div>

        {/* Phone numbers */}
        <div className="flex items-center gap-2 mb-2">
          <Phone className="h-4 w-4 text-gray-400 shrink-0" />
          <span className="font-mono text-sm text-blue-700">{rec.src || '—'}</span>
          <span className="text-gray-400">→</span>
          <span className="font-mono text-sm text-green-700">{rec.dst || '—'}</span>
        </div>

        {/* Duration */}
        <div className="flex items-center gap-2 mb-3">
          <Clock className="h-4 w-4 text-gray-400 shrink-0" />
          <span className="text-sm text-gray-600">
            Тривалість: {formatDuration(rec.duration)}
            {rec.billsec > 0 && <> · Розмова: {formatDuration(rec.billsec)}</>}
          </span>
        </div>

        {/* Actions */}
        <div className="flex items-center gap-2 flex-wrap">
          {/* Play/Pause */}
          {rec.recordingfile && (
            <AudioPlayer recordingfile={rec.recordingfile} />
          )}

          {/* Download */}
          <button
            onClick={() => onDownload(rec)}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-600 text-white text-xs rounded-lg hover:bg-blue-700 transition-colors"
          >
            <Download className="h-3.5 w-3.5" />
            Завантажити
          </button>

          {/* Link to case */}
          <button
            onClick={() => onLink(rec)}
            className={`flex items-center gap-1.5 px-3 py-1.5 text-xs rounded-lg transition-colors ${
              linkCount > 0
                ? 'bg-green-100 text-green-700 hover:bg-green-200'
                : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
            }`}
          >
            <Link2 className="h-3.5 w-3.5" />
            {linkCount > 0 ? `Заявок: ${linkCount}` : 'Заявка'}
          </button>

          {/* Create case */}
          <button
            onClick={() => onCreateCase(rec)}
            title="Створити заявку"
            className="flex items-center gap-1.5 px-3 py-1.5 bg-violet-100 text-violet-700 text-xs rounded-lg hover:bg-violet-200 transition-colors"
          >
            <Plus className="h-3.5 w-3.5" />
            Нова заявка
          </button>
        </div>
      </CardContent>
    </Card>
  );
}

// ── Main page ─────────────────────────────────────────────────────────────────

export function CallRecordingsPage() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [page, setPage] = useState(0);
  const [linkingRecording, setLinkingRecording] = useState<CallRecording | null>(null);
  const limit = 50;

  const handleSearchChange = (value: string) => {
    setSearch(value);
    clearTimeout((window as any)._recordingSearchTimer);
    (window as any)._recordingSearchTimer = setTimeout(() => {
      setDebouncedSearch(value);
      setPage(0);
    }, 400);
  };

  const { data, isLoading, error } = useQuery({
    queryKey: ['call-recordings', debouncedSearch, page],
    queryFn: () => asteriskApi.listRecordings({
      skip: page * limit,
      limit,
      sort_by: 'calldate',
      sort_dir: 'desc',
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
    navigate('/cases/new', { state: { applicant_phone: phone, pending_recording: recording } });
  };

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

        {data && (
          <p className="text-sm text-gray-500 mb-3">
            Знайдено записів: <span className="font-semibold text-gray-800">{data.total}</span>
          </p>
        )}

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

        {/* Cards list */}
        {data && data.items.length > 0 && (
          <>
            <div className="space-y-3">
              {data.items.map(rec => (
                <RecordingCard
                  key={rec.uniqueid}
                  rec={rec}
                  onDownload={handleDownload}
                  onLink={r => setLinkingRecording(r)}
                  onCreateCase={handleCreateCase}
                />
              ))}
            </div>

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
                  {page + 1} / {totalPages}
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
