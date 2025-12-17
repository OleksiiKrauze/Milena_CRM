import { Link } from 'react-router-dom';
import { Header } from '@/components/layout/Header';
import { Container, Card, CardContent } from '@/components/ui';
import { Users, Shield, MapPin, ChevronRight } from 'lucide-react';

export function SettingsPage() {
  const settingsOptions = [
    {
      title: 'Користувачі',
      description: 'Управління користувачами системи',
      icon: Users,
      path: '/users',
      color: 'text-blue-600',
      bgColor: 'bg-blue-50',
    },
    {
      title: 'Ролі',
      description: 'Налаштування ролей та ієрархії',
      icon: Shield,
      path: '/settings/roles',
      color: 'text-purple-600',
      bgColor: 'bg-purple-50',
    },
    {
      title: 'Напрямки',
      description: 'Управління напрямками роботи',
      icon: MapPin,
      path: '/settings/directions',
      color: 'text-green-600',
      bgColor: 'bg-green-50',
    },
  ];

  return (
    <div className="min-h-screen pb-nav">
      <Header title="Налаштування" />

      <Container className="py-6">
        <div className="space-y-3">
          {settingsOptions.map((option) => {
            const Icon = option.icon;
            return (
              <Link key={option.path} to={option.path}>
                <Card className="active:bg-gray-50 transition-colors">
                  <CardContent className="p-4">
                    <div className="flex items-center">
                      <div className={`p-3 rounded-lg ${option.bgColor} mr-4`}>
                        <Icon className={`h-6 w-6 ${option.color}`} />
                      </div>
                      <div className="flex-1">
                        <h3 className="font-semibold text-gray-900">{option.title}</h3>
                        <p className="text-sm text-gray-600">{option.description}</p>
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
