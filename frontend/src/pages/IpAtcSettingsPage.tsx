import { Link } from 'react-router-dom';
import { Header } from '@/components/layout/Header';
import { Container, Card, CardContent } from '@/components/ui';
import { useAuthStore } from '@/store/authStore';
import { hasPermission } from '@/utils/permissions';
import { PhoneCall, Settings, ChevronRight } from 'lucide-react';

export function IpAtcSettingsPage() {
  const user = useAuthStore(state => state.user);
  const canRead = hasPermission(user, 'ip_atc:read');
  const canConfigure = hasPermission(user, 'settings:update');

  const menuItems = [
    {
      title: 'Записи розмов',
      description: 'Перегляд та завантаження записів дзвінків',
      icon: PhoneCall,
      path: '/settings/ip-atc/recordings',
      color: 'text-blue-600',
      bgColor: 'bg-blue-50',
      permission: canRead,
    },
    {
      title: "Налаштування з'єднання",
      description: 'Параметри підключення до Asterisk/FreePBX',
      icon: Settings,
      path: '/settings/ip-atc/config',
      color: 'text-gray-600',
      bgColor: 'bg-gray-50',
      permission: canConfigure,
    },
  ];

  return (
    <div className="min-h-screen pb-nav">
      <Header title="IP АТС" showBack />

      <Container className="py-6">
        <div className="space-y-3">
          {menuItems.filter(item => item.permission).map((item) => {
            const Icon = item.icon;
            return (
              <Link key={item.path} to={item.path}>
                <Card className="active:bg-gray-50 transition-colors">
                  <CardContent className="p-4">
                    <div className="flex items-center">
                      <div className={`p-3 rounded-lg ${item.bgColor} mr-4`}>
                        <Icon className={`h-6 w-6 ${item.color}`} />
                      </div>
                      <div className="flex-1">
                        <h3 className="font-semibold text-gray-900">{item.title}</h3>
                        <p className="text-sm text-gray-600">{item.description}</p>
                      </div>
                      <ChevronRight className="h-5 w-5 text-gray-400" />
                    </div>
                  </CardContent>
                </Card>
              </Link>
            );
          })}
        </div>
      </Container>
    </div>
  );
}
