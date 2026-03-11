import { useState, useEffect, useRef } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { asteriskApi } from '@/api/asterisk';
import type { CallRecording, RecordingLink } from '@/types/api';
import { PhoneCall, Play, Pause, Download, Unlink, Link2, Search, X, Loader2, FileText } from 'lucide-react';
import { Card, CardContent } from '@/components/ui';

// ── Audio Player ──────────────────────────────────────────────────────────────

export function AudioPlayer({ recordingfile }: { recordingfile: string }) {
  const [blobUrl, setBlobUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [playing, setPlaying] = useState(false);
  const audioRef = useRef<HTMLAudioElement>(null);

  useEffect(() => {
    return () => { if (blobUrl) URL.revokeObjectURL(blobUrl); };
  }, [blobUrl]);

  const handleToggle = async () => {
    if (!blobUrl) {
      setLoading(true);
      try {
        const blob = await asteriskApi.downloadRecording(recordingfile);
        const url = URL.createObjectURL(blob);
        setBlobUrl(url);
        // play will be triggered via useEffect after blobUrl is set
      } catch {
        alert('Помилка завантаження аудіо');
        setLoading(false);
      }
      return;
    }

    const audio = audioRef.current;
    if (!audio) return;
    if (playing) {
      audio.pause();
    } else {
      audio.play();
    }
  };

  // Auto-play once blob URL is first set
  useEffect(() => {
    if (blobUrl && audioRef.current) {
      audioRef.current.play().catch(() => {});
      setLoading(false);
    }
  }, [blobUrl]);

  return (
    <div className="flex items-center gap-1">
      <button
        type="button"
        onClick={handleToggle}
        disabled={loading}
        title={playing ? 'Пауза' : 'Прослухати'}
        className="p-1.5 rounded-lg bg-green-100 text-green-700 hover:bg-green-200 transition-colors disabled:opacity-40"
      >
        {loading
          ? <Loader2 className="h-3.5 w-3.5 animate-spin" />
          : playing
            ? <Pause className="h-3.5 w-3.5" />
            : <Play className="h-3.5 w-3.5" />}
      </button>
      {blobUrl && (
        <audio
          ref={audioRef}
          src={blobUrl}
          onPlay={() => setPlaying(true)}
          onPause={() => setPlaying(false)}
          onEnded={() => setPlaying(false)}
          className="hidden"
        />
      )}
    </div>
  );
}

// ── Pick-a-recording modal ─────────────────────────────────────────────────────

interface LinkRecordingModalProps {
  existingUniqueIds: Set<string>;
  onClose: () => void;
  onLink: (rec: CallRecording) => void;
  isLinking: boolean;
}

function LinkRecordingModal({ existingUniqueIds, onClose, onLink, isLinking }: LinkRecordingModalProps) {
  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');

  const { data, isLoading, error } = useQuery({
    queryKey: ['cdr-for-link', debouncedSearch],
    queryFn: () => asteriskApi.listRecordings({
      search: debouncedSearch || undefined,
      limit: 30,
      sort_by: 'calldate',
      sort_dir: 'desc',
    }),
    retry: 1,
  });

  const handleSearchChange = (v: string) => {
    setSearch(v);
    clearTimeout((window as any)._cdrLinkTimer);
    (window as any)._cdrLinkTimer = setTimeout(() => setDebouncedSearch(v), 350);
  };

  const fmtDate = (d: string) => {
    try {
      return new Date(d).toLocaleString('uk-UA', {
        day: '2-digit', month: '2-digit', year: 'numeric',
        hour: '2-digit', minute: '2-digit',
      });
    } catch { return d; }
  };

  const fmtDur = (s: number) => `${Math.floor(s / 60)}:${(s % 60).toString().padStart(2, '0')}`;

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-lg max-h-[80vh] flex flex-col">

        <div className="flex items-center justify-between p-4 border-b">
          <h2 className="font-semibold text-gray-900">Прив'язати запис розмови</h2>
          <button type="button" onClick={onClose} className="p-1 rounded hover:bg-gray-100">
            <X className="h-5 w-5 text-gray-500" />
          </button>
        </div>

        <div className="p-4 border-b">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
            <input
              autoFocus
              type="text"
              placeholder="Пошук за номером телефону..."
              value={search}
              onChange={e => handleSearchChange(e.target.value)}
              className="w-full pl-9 pr-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-2">
          {isLoading && (
            <div className="flex justify-center py-6">
              <Loader2 className="h-5 w-5 animate-spin text-gray-400" />
            </div>
          )}
          {error && (
            <p className="text-sm text-red-500 text-center py-4">
              Помилка підключення до IP АТС. Перевірте налаштування.
            </p>
          )}
          {data?.items.map(rec => {
            const alreadyLinked = existingUniqueIds.has(rec.uniqueid);
            return (
              <button
                key={rec.uniqueid}
                type="button"
                disabled={alreadyLinked || isLinking}
                onClick={() => onLink(rec)}
                className="w-full text-left px-3 py-2.5 rounded-lg hover:bg-blue-50 disabled:opacity-60 disabled:cursor-default flex items-center gap-3 mb-0.5 transition-colors"
              >
                <PhoneCall className="h-4 w-4 text-violet-500 shrink-0" />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-gray-900">{fmtDate(rec.calldate)}</p>
                  <p className="text-xs text-gray-500">
                    {rec.src || '—'} → {rec.dst || '—'} · {fmtDur(rec.duration)}
                  </p>
                </div>
                {alreadyLinked && (
                  <span className="text-xs text-green-600 font-medium shrink-0">Прив'язано</span>
                )}
              </button>
            );
          })}
          {!isLoading && !error && data?.items.length === 0 && (
            <p className="text-sm text-gray-500 text-center py-4">Записів не знайдено</p>
          )}
        </div>
      </div>
    </div>
  );
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function fmtCallDate(d: string | null) {
  if (!d) return '—';
  try {
    return new Date(d).toLocaleString('uk-UA', {
      day: '2-digit', month: '2-digit', year: 'numeric',
      hour: '2-digit', minute: '2-digit',
    });
  } catch { return d; }
}

function fmtDur(s: number | null) {
  if (!s) return '0:00';
  return `${Math.floor(s / 60)}:${(s % 60).toString().padStart(2, '0')}`;
}

// ── Main Block ────────────────────────────────────────────────────────────────

interface CaseRecordingsBlockProps {
  /** Existing case ID. Undefined means create mode (recordings are stored pending). */
  caseId?: number;
  /** Controlled pending recordings list (create mode) */
  pendingLinks?: CallRecording[];
  onPendingChange?: (links: CallRecording[]) => void;
  /** Called with transcribed text when "Перевести в текст" is clicked */
  onTranscript?: (text: string) => void;
}

export function CaseRecordingsBlock({ caseId, pendingLinks, onPendingChange, onTranscript }: CaseRecordingsBlockProps) {
  const queryClient = useQueryClient();
  const [showModal, setShowModal] = useState(false);
  const [transcribingId, setTranscribingId] = useState<string | null>(null);
  const isCreateMode = caseId === undefined;

  const { data: linkedData } = useQuery({
    queryKey: ['case-recordings', caseId],
    queryFn: () => asteriskApi.getRecordingsByCase(caseId!),
    enabled: !isCreateMode,
    retry: false,
  });

  const unlinkMutation = useMutation({
    mutationFn: (linkId: number) => asteriskApi.unlinkRecording(linkId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['case-recordings', caseId] });
    },
  });

  const linkMutation = useMutation({
    mutationFn: (rec: CallRecording) => asteriskApi.linkRecording(rec, caseId!),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['case-recordings', caseId] });
      queryClient.invalidateQueries({ queryKey: ['recording-links'] });
      setShowModal(false);
    },
  });

  const linkedItems: RecordingLink[] = linkedData?.items || [];
  const pendingItems: CallRecording[] = pendingLinks || [];

  const existingUniqueIds = new Set([
    ...linkedItems.map(l => l.uniqueid),
    ...pendingItems.map(r => r.uniqueid),
  ]);

  const handleLink = (rec: CallRecording) => {
    if (isCreateMode) {
      onPendingChange?.([...pendingItems, rec]);
      setShowModal(false);
    } else {
      linkMutation.mutate(rec);
    }
  };

  const handleTranscribe = async (recordingfile: string, uniqueid: string) => {
    setTranscribingId(uniqueid);
    try {
      const { transcript } = await asteriskApi.transcribeRecording(recordingfile);
      onTranscript?.(transcript);
      // Scroll to transcript field after a short delay to allow state update
      setTimeout(() => {
        document.getElementById('call-transcript-field')?.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }, 100);
    } catch (e: any) {
      alert(e?.response?.data?.detail || 'Помилка розпізнавання мови');
    } finally {
      setTranscribingId(null);
    }
  };

  const handleDownload = async (recordingfile: string, uniqueid: string) => {
    try {
      const blob = await asteriskApi.downloadRecording(recordingfile);
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `recording-${uniqueid}.${recordingfile.split('.').pop() || 'wav'}`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch {
      alert('Помилка завантаження файлу');
    }
  };

  const total = linkedItems.length + pendingItems.length;

  return (
    <>
      <Card>
        <CardContent className="p-4">
          <div className="flex items-center justify-between mb-3">
            <h3 className="font-semibold text-gray-900 flex items-center gap-2">
              <PhoneCall className="h-4 w-4 text-violet-600" />
              Записи розмов
              {total > 0 && (
                <span className="text-sm font-normal text-gray-500">({total})</span>
              )}
            </h3>
            <button
              type="button"
              onClick={() => setShowModal(true)}
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs bg-violet-100 text-violet-700 rounded-lg hover:bg-violet-200 transition-colors"
            >
              <Link2 className="h-3.5 w-3.5" />
              Прив'язати
            </button>
          </div>

          {total === 0 && (
            <p className="text-sm text-gray-400">Немає прив'язаних записів</p>
          )}

          <div className="space-y-2">
            {/* Existing DB-linked recordings */}
            {linkedItems.map(link => (
              <div key={link.id} className="p-3 bg-gray-50 rounded-lg border border-gray-200">
                <div className="flex items-start gap-2">
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-gray-800">{fmtCallDate(link.calldate)}</p>
                    <p className="text-xs text-gray-500 mt-0.5">
                      {link.src || '—'} → {link.dst || '—'} · {fmtDur(link.duration)}
                    </p>
                  </div>
                  <div className="flex items-center gap-1.5 shrink-0 flex-wrap justify-end">
                    {link.recordingfile && (
                      <>
                        <AudioPlayer recordingfile={link.recordingfile} />
                        <button
                          type="button"
                          onClick={() => handleDownload(link.recordingfile!, link.uniqueid)}
                          className="p-1.5 rounded-lg bg-blue-100 text-blue-700 hover:bg-blue-200 transition-colors"
                          title="Завантажити"
                        >
                          <Download className="h-3.5 w-3.5" />
                        </button>
                        {onTranscript && (
                          <button
                            type="button"
                            onClick={() => handleTranscribe(link.recordingfile!, link.uniqueid)}
                            disabled={transcribingId === link.uniqueid}
                            className="flex items-center gap-1 px-2 py-1.5 rounded-lg bg-amber-100 text-amber-700 hover:bg-amber-200 transition-colors text-xs disabled:opacity-40"
                            title="Перевести в текст"
                          >
                            {transcribingId === link.uniqueid
                              ? <Loader2 className="h-3.5 w-3.5 animate-spin" />
                              : <FileText className="h-3.5 w-3.5" />}
                            <span className="hidden sm:inline">Перевести в текст</span>
                          </button>
                        )}
                      </>
                    )}
                    <button
                      type="button"
                      onClick={() => unlinkMutation.mutate(link.id)}
                      disabled={unlinkMutation.isPending}
                      className="p-1.5 rounded-lg bg-red-100 text-red-600 hover:bg-red-200 transition-colors disabled:opacity-40"
                      title="Відв'язати"
                    >
                      <Unlink className="h-3.5 w-3.5" />
                    </button>
                  </div>
                </div>
                {/* Audio expands below when Play is clicked */}
              </div>
            ))}

            {/* Pending recordings (create mode only) */}
            {pendingItems.map(rec => (
              <div key={rec.uniqueid} className="p-3 bg-violet-50 rounded-lg border border-violet-200">
                <div className="flex items-start gap-2">
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-gray-800">
                      {(() => {
                        try { return new Date(rec.calldate).toLocaleString('uk-UA', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' }); }
                        catch { return rec.calldate; }
                      })()}
                    </p>
                    <p className="text-xs text-gray-500 mt-0.5">
                      {rec.src || '—'} → {rec.dst || '—'} · {fmtDur(rec.duration)}
                    </p>
                    <p className="text-xs text-violet-600 mt-0.5">Буде прив'язано після збереження</p>
                  </div>
                  <button
                    type="button"
                    onClick={() => onPendingChange?.(pendingItems.filter(r => r.uniqueid !== rec.uniqueid))}
                    className="p-1.5 rounded-lg bg-red-100 text-red-600 hover:bg-red-200 transition-colors shrink-0"
                    title="Видалити"
                  >
                    <X className="h-3.5 w-3.5" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {showModal && (
        <LinkRecordingModal
          existingUniqueIds={existingUniqueIds}
          onClose={() => setShowModal(false)}
          onLink={handleLink}
          isLinking={linkMutation.isPending}
        />
      )}
    </>
  );
}
