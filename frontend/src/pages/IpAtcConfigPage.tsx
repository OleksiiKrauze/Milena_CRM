import { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Header } from '@/components/layout/Header';
import { Container, Card, CardContent, Loading, Button } from '@/components/ui';
import { asteriskApi } from '@/api/asterisk';
import type { AsteriskSettings } from '@/types/api';
import { CheckCircle, AlertCircle, Database, Server, Key } from 'lucide-react';

type FormData = {
  asterisk_cdr_host: string;
  asterisk_cdr_port: string;
  asterisk_cdr_db: string;
  asterisk_cdr_user: string;
  asterisk_cdr_password: string;
  asterisk_ssh_host: string;
  asterisk_ssh_port: string;
  asterisk_ssh_user: string;
  asterisk_ssh_password: string;
  asterisk_ssh_key: string;
  asterisk_recordings_path: string;
};

export function IpAtcConfigPage() {
  const queryClient = useQueryClient();
  const [saved, setSaved] = useState(false);
  const [form, setForm] = useState<FormData>({
    asterisk_cdr_host: '',
    asterisk_cdr_port: '3306',
    asterisk_cdr_db: 'asteriskcdrdb',
    asterisk_cdr_user: '',
    asterisk_cdr_password: '',
    asterisk_ssh_host: '',
    asterisk_ssh_port: '22',
    asterisk_ssh_user: 'bitnami',
    asterisk_ssh_password: '',
    asterisk_ssh_key: '',
    asterisk_recordings_path: '/var/spool/asterisk/monitor',
  });

  const { data, isLoading } = useQuery({
    queryKey: ['asterisk-settings'],
    queryFn: asteriskApi.getSettings,
  });

  useEffect(() => {
    if (data) {
      setForm({
        asterisk_cdr_host: data.asterisk_cdr_host || '',
        asterisk_cdr_port: String(data.asterisk_cdr_port || 3306),
        asterisk_cdr_db: data.asterisk_cdr_db || 'asteriskcdrdb',
        asterisk_cdr_user: data.asterisk_cdr_user || '',
        asterisk_cdr_password: data.asterisk_cdr_password || '',
        asterisk_ssh_host: data.asterisk_ssh_host || '',
        asterisk_ssh_port: String(data.asterisk_ssh_port || 22),
        asterisk_ssh_user: data.asterisk_ssh_user || 'bitnami',
        asterisk_ssh_password: data.asterisk_ssh_password || '',
        asterisk_ssh_key: data.asterisk_ssh_key || '',
        asterisk_recordings_path: data.asterisk_recordings_path || '/var/spool/asterisk/monitor',
      });
    }
  }, [data]);

  const mutation = useMutation({
    mutationFn: (d: Partial<AsteriskSettings>) => asteriskApi.updateSettings(d),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['asterisk-settings'] });
      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    mutation.mutate({
      asterisk_cdr_host: form.asterisk_cdr_host || null,
      asterisk_cdr_port: form.asterisk_cdr_port ? Number(form.asterisk_cdr_port) : 3306,
      asterisk_cdr_db: form.asterisk_cdr_db || 'asteriskcdrdb',
      asterisk_cdr_user: form.asterisk_cdr_user || null,
      asterisk_cdr_password: form.asterisk_cdr_password || null,
      asterisk_ssh_host: form.asterisk_ssh_host || null,
      asterisk_ssh_port: form.asterisk_ssh_port ? Number(form.asterisk_ssh_port) : 22,
      asterisk_ssh_user: form.asterisk_ssh_user || null,
      asterisk_ssh_password: form.asterisk_ssh_password || null,
      asterisk_ssh_key: form.asterisk_ssh_key || null,
      asterisk_recordings_path: form.asterisk_recordings_path || '/var/spool/asterisk/monitor',
    });
  };

  const f = (field: keyof FormData) => ({
    value: form[field],
    onChange: (e: React.ChangeEvent<HTMLInputElement>) =>
      setForm(prev => ({ ...prev, [field]: e.target.value })),
  });

  const inputClass = "w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500";
  const labelClass = "block text-sm font-medium text-gray-700 mb-1";

  if (isLoading) return (
    <div className="min-h-screen pb-nav">
      <Header title="Налаштування IP АТС" showBack />
      <Loading />
    </div>
  );

  return (
    <div className="min-h-screen pb-nav">
      <Header title="Налаштування IP АТС" showBack />

      <Container className="py-6">
        <form onSubmit={handleSubmit} className="space-y-4">

          {/* CDR Database */}
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center gap-2 mb-4">
                <div className="p-2 bg-blue-50 rounded-lg">
                  <Database className="h-5 w-5 text-blue-600" />
                </div>
                <div>
                  <h3 className="font-semibold text-gray-900">База даних CDR</h3>
                  <p className="text-xs text-gray-500">MySQL/MariaDB база даних Asterisk</p>
                </div>
              </div>

              <div className="space-y-3">
                <div className="grid grid-cols-3 gap-3">
                  <div className="col-span-2">
                    <label className={labelClass}>Хост</label>
                    <input type="text" placeholder="1.2.3.4" className={inputClass} {...f('asterisk_cdr_host')} />
                  </div>
                  <div>
                    <label className={labelClass}>Порт</label>
                    <input type="number" placeholder="3306" className={inputClass} {...f('asterisk_cdr_port')} />
                  </div>
                </div>

                <div>
                  <label className={labelClass}>Назва бази даних</label>
                  <input type="text" placeholder="asteriskcdrdb" className={inputClass} {...f('asterisk_cdr_db')} />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className={labelClass}>Користувач</label>
                    <input type="text" placeholder="asterisk" className={inputClass} {...f('asterisk_cdr_user')} />
                  </div>
                  <div>
                    <label className={labelClass}>Пароль</label>
                    <input type="password" placeholder="••••••••" className={inputClass} {...f('asterisk_cdr_password')} />
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* SSH for recordings download */}
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center gap-2 mb-4">
                <div className="p-2 bg-green-50 rounded-lg">
                  <Server className="h-5 w-5 text-green-600" />
                </div>
                <div>
                  <h3 className="font-semibold text-gray-900">SSH-доступ для завантаження</h3>
                  <p className="text-xs text-gray-500">Підключення для отримання файлів записів</p>
                </div>
              </div>

              <div className="space-y-3">
                <div className="grid grid-cols-3 gap-3">
                  <div className="col-span-2">
                    <label className={labelClass}>Хост (IP сервера АТС)</label>
                    <input type="text" placeholder="1.2.3.4" className={inputClass} {...f('asterisk_ssh_host')} />
                  </div>
                  <div>
                    <label className={labelClass}>Порт SSH</label>
                    <input type="number" placeholder="22" className={inputClass} {...f('asterisk_ssh_port')} />
                  </div>
                </div>

                <div>
                  <label className={labelClass}>Користувач SSH</label>
                  <input type="text" placeholder="bitnami" className={inputClass} {...f('asterisk_ssh_user')} />
                  <p className="text-xs text-gray-400 mt-1">
                    Для Amazon Lightsail FreePBX зазвичай <code className="bg-gray-100 px-1 rounded">bitnami</code>
                  </p>
                </div>

                <div>
                  <label className={labelClass}>Пароль SSH</label>
                  <input type="password" placeholder="Залиште порожнім якщо використовуєте ключ" className={inputClass} {...f('asterisk_ssh_password')} />
                </div>

                {/* SSH Key */}
                <div>
                  <div className="flex items-center gap-2 mb-1">
                    <Key className="h-4 w-4 text-amber-500" />
                    <label className={labelClass + " mb-0"}>Приватний SSH-ключ (.pem)</label>
                  </div>
                  <textarea
                    rows={6}
                    placeholder={"-----BEGIN RSA PRIVATE KEY-----\nMIIEowIBAAKCAQEA...\n-----END RSA PRIVATE KEY-----"}
                    value={form.asterisk_ssh_key}
                    onChange={e => setForm(prev => ({ ...prev, asterisk_ssh_key: e.target.value }))}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-xs font-mono focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
                    spellCheck={false}
                  />
                  <p className="text-xs text-gray-400 mt-1">
                    Вставте вміст .pem файлу з Lightsail Console → Account → SSH keys
                  </p>
                </div>

                <div>
                  <label className={labelClass}>Шлях до записів на сервері</label>
                  <input
                    type="text"
                    placeholder="/var/spool/asterisk/monitor"
                    className={inputClass}
                    {...f('asterisk_recordings_path')}
                  />
                  <p className="text-xs text-gray-400 mt-1">
                    Базовий каталог де Asterisk зберігає записи розмов
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Status messages */}
          {saved && (
            <div className="flex items-center gap-2 p-3 bg-green-50 border border-green-200 rounded-lg text-green-700">
              <CheckCircle className="h-4 w-4 flex-shrink-0" />
              <span className="text-sm">Налаштування збережено</span>
            </div>
          )}

          {mutation.isError && (
            <div className="flex items-center gap-2 p-3 bg-red-50 border border-red-200 rounded-lg text-red-700">
              <AlertCircle className="h-4 w-4 flex-shrink-0" />
              <span className="text-sm">
                {(mutation.error as any)?.response?.data?.detail || 'Помилка збереження'}
              </span>
            </div>
          )}

          <Button type="submit" fullWidth disabled={mutation.isPending}>
            {mutation.isPending ? 'Збереження...' : 'Зберегти налаштування'}
          </Button>
        </form>
      </Container>
    </div>
  );
}
