import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Link, useNavigate } from 'react-router-dom';
import { useMutation } from '@tanstack/react-query';
import { authApi } from '@/api/auth';
import { Button, Input, Container } from '@/components/ui';

const registerSchema = z.object({
  last_name: z.string().min(2, 'Мінімум 2 символи'),
  first_name: z.string().min(2, 'Мінімум 2 символи'),
  middle_name: z.string().optional(),
  email: z.string().email('Некоректний email'),
  phone: z.string().regex(/^\+?380\d{9}$/, 'Формат: +380XXXXXXXXX'),
  city: z.string().min(2, 'Мінімум 2 символи'),
  password: z.string().min(6, 'Мінімум 6 символів'),
  confirmPassword: z.string(),
}).refine((data) => data.password === data.confirmPassword, {
  message: 'Паролі не збігаються',
  path: ['confirmPassword'],
});

type RegisterForm = z.infer<typeof registerSchema>;

export function RegisterPage() {
  const navigate = useNavigate();
  const [apiError, setApiError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<RegisterForm>({
    resolver: zodResolver(registerSchema),
  });

  const registerMutation = useMutation({
    mutationFn: (data: RegisterForm) => {
      const { confirmPassword, ...registerData } = data;
      return authApi.register(registerData);
    },
    onSuccess: () => {
      setSuccess(true);
      setTimeout(() => {
        navigate('/login');
      }, 3000);
    },
    onError: (error: any) => {
      setApiError(error.message || 'Помилка при реєстрації');
    },
  });

  const onSubmit = (data: RegisterForm) => {
    setApiError(null);
    registerMutation.mutate(data);
  };

  if (success) {
    return (
      <div className="min-h-screen flex flex-col bg-gradient-to-br from-green-50 to-green-100">
        <Container maxWidth="sm" className="flex-1 flex flex-col justify-center py-12">
          <div className="bg-white rounded-2xl shadow-xl p-6 text-center">
            <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <svg
                className="w-8 h-8 text-green-600"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M5 13l4 4L19 7"
                />
              </svg>
            </div>
            <h2 className="text-2xl font-semibold text-gray-900 mb-2">
              Реєстрація успішна!
            </h2>
            <p className="text-gray-600">
              Ваш обліковий запис створено зі статусом "На розгляді".
              <br />
              Адміністратор перевірить вашу заявку.
            </p>
            <p className="text-sm text-gray-500 mt-4">
              Перехід на сторінку входу...
            </p>
          </div>
        </Container>
      </div>
    );
  }

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

        {/* Register Form */}
        <div className="bg-white rounded-2xl shadow-xl p-6">
          <h2 className="text-2xl font-semibold text-gray-900 mb-6">
            Реєстрація
          </h2>

          <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
            <Input
              label="Прізвище"
              type="text"
              placeholder="Шевченко"
              error={errors.last_name?.message}
              {...register('last_name')}
              required
            />

            <Input
              label="Ім'я"
              type="text"
              placeholder="Тарас"
              error={errors.first_name?.message}
              {...register('first_name')}
              required
            />

            <Input
              label="По батькові (необов'язково)"
              type="text"
              placeholder="Григорович"
              error={errors.middle_name?.message}
              {...register('middle_name')}
            />

            <Input
              label="Email"
              type="email"
              placeholder="taras@example.com"
              error={errors.email?.message}
              {...register('email')}
              required
            />

            <Input
              label="Телефон"
              type="tel"
              placeholder="+380991234567"
              error={errors.phone?.message}
              {...register('phone')}
              required
            />

            <Input
              label="Місто"
              type="text"
              placeholder="Київ"
              error={errors.city?.message}
              {...register('city')}
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

            <Input
              label="Підтвердіть пароль"
              type="password"
              placeholder="••••••••"
              error={errors.confirmPassword?.message}
              {...register('confirmPassword')}
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
              loading={registerMutation.isPending}
              className="mt-6"
            >
              Зареєструватися
            </Button>
          </form>

          <div className="mt-6 text-center">
            <p className="text-sm text-gray-600">
              Вже є обліковий запис?{' '}
              <Link
                to="/login"
                className="text-primary-600 font-medium hover:text-primary-700"
              >
                Увійти
              </Link>
            </p>
          </div>
        </div>

        {/* Footer */}
        <div className="mt-8 text-center text-sm text-gray-500">
          <p>Ваш обліковий запис буде перевірено адміністратором</p>
        </div>
      </Container>
    </div>
  );
}
