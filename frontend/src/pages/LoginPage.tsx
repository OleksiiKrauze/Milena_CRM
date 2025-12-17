import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Link, useNavigate } from 'react-router-dom';
import { useMutation } from '@tanstack/react-query';
import { authApi } from '@/api/auth';
import { useAuthStore } from '@/store/authStore';
import { Button, Input, Container } from '@/components/ui';

const loginSchema = z.object({
  email: z.string().email('Некоректний email'),
  password: z.string().min(6, 'Мінімум 6 символів'),
});

type LoginForm = z.infer<typeof loginSchema>;

export function LoginPage() {
  const navigate = useNavigate();
  const setAuth = useAuthStore((state) => state.setAuth);
  const [apiError, setApiError] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<LoginForm>({
    resolver: zodResolver(loginSchema),
  });

  const loginMutation = useMutation({
    mutationFn: authApi.login,
    onSuccess: async (data) => {
      // Save token first so axios interceptor can use it
      localStorage.setItem('auth_token', data.access_token);

      // Get user data after login
      try {
        const user = await authApi.me();
        setAuth(data.access_token, user);
        navigate('/', { replace: true });
      } catch (error) {
        localStorage.removeItem('auth_token');
        setApiError('Помилка при отриманні даних користувача');
      }
    },
    onError: (error: any) => {
      setApiError(error.message || 'Помилка при вході');
    },
  });

  const onSubmit = (data: LoginForm) => {
    setApiError(null);
    loginMutation.mutate(data);
  };

  return (
    <div className="min-h-screen flex flex-col bg-gradient-to-br from-primary-50 to-primary-100">
      <Container maxWidth="sm" className="flex-1 flex flex-col justify-center py-12">
        {/* Logo/Header */}
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold text-gray-900 mb-2">
            CRM Пошуку Людей
          </h1>
          <p className="text-gray-600">
            Система пошуку зниклих людей
          </p>
        </div>

        {/* Login Form */}
        <div className="bg-white rounded-2xl shadow-xl p-6">
          <h2 className="text-2xl font-semibold text-gray-900 mb-6">
            Вхід
          </h2>

          <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
            <Input
              label="Email"
              type="email"
              placeholder="taras@example.com"
              error={errors.email?.message}
              {...register('email')}
              required
            />

            <Input
              label="Пароль"
              type="password"
              placeholder="••••••••"
              error={errors.password?.message}
              {...register('password')}
              required
            />

            {apiError && (
              <div className="p-4 bg-red-50 border border-red-200 rounded-lg">
                <p className="text-sm text-red-800">{apiError}</p>
              </div>
            )}

            <Button
              type="submit"
              fullWidth
              loading={loginMutation.isPending}
              className="mt-6"
            >
              Увійти
            </Button>
          </form>

          <div className="mt-6 text-center">
            <p className="text-sm text-gray-600">
              Немає облікового запису?{' '}
              <Link
                to="/register"
                className="text-primary-600 font-medium hover:text-primary-700"
              >
                Зареєструватися
              </Link>
            </p>
          </div>
        </div>

        {/* Footer */}
        <div className="mt-8 text-center text-sm text-gray-500">
          <p>Система для організації пошуку зниклих людей</p>
        </div>
      </Container>
    </div>
  );
}
