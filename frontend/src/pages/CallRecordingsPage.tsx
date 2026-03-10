import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Header } from '@/components/layout/Header';
import { Container, Card, CardContent, Loading } from '@/components/ui';
import { asteriskApi } from '@/api/asterisk';
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

export function CallRecordingsPage() {
  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [sortBy, setSortBy] = useState<SortField>('calldate');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc');
  const [page, setPage] = useState(0);
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
    } catch (e) {
      alert('Помилка завантаження файлу');
    }
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

        {/* Desktop table */}
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
                    <th className="px-3 py-2 text-center text-xs font-semibold text-gray-600 uppercase tracking-wide">
                      Завантажити
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {data.items.map((rec) => {
                    const disp = dispositionLabel(rec.disposition);
                    return (
                      <tr key={rec.uniqueid} className="hover:bg-gray-50 transition-colors">
                        <td className="px-3 py-3 text-gray-800 whitespace-nowrap">
                          {formatDate(rec.calldate)}
                        </td>
                        <td className="px-3 py-3 font-mono text-blue-700">{rec.src || '—'}</td>
                        <td className="px-3 py-3 font-mono text-green-700">{rec.dst || '—'}</td>
                        <td className="px-3 py-3 text-gray-600">{formatDuration(rec.duration)}</td>
                        <td className="px-3 py-3 text-gray-600">{formatDuration(rec.billsec)}</td>
                        <td className="px-3 py-3">
                          <span className={`inline-flex px-2 py-0.5 rounded-full text-xs font-medium ${disp.cls}`}>
                            {disp.text}
                          </span>
                        </td>
                        <td className="px-3 py-3 text-center">
                          <button
                            onClick={() => handleDownload(rec)}
                            className="inline-flex items-center gap-1 px-3 py-1.5 bg-blue-600 text-white text-xs rounded-lg hover:bg-blue-700 transition-colors"
                          >
                            <Download className="h-3 w-3" />
                            Завантажити
                          </button>
                        </td>
                      </tr>
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
    </div>
  );
}
