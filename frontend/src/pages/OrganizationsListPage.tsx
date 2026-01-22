import { useState, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { organizationsApi } from '@/api/organizations';
import { Header } from '@/components/layout/Header';
import { Container, Card, CardContent, Loading, Button } from '@/components/ui';
import { useAuthStore } from '@/store/authStore';
import { hasPermission } from '@/utils/permissions';
import { ORGANIZATION_TYPES, getOrganizationTypeLabel } from '@/constants/organizationTypes';
import { ALL_REGIONS } from '@/constants/regions';
import { Building2, Plus, RefreshCw, ChevronLeft, ChevronRight } from 'lucide-react';

export function OrganizationsListPage() {
  const user = useAuthStore(state => state.user);

  // Filters state
  const [typeFilter, setTypeFilter] = useState<string>('');
  const [regionFilter, setRegionFilter] = useState<string>('');
  const [searchQuery, setSearchQuery] = useState<string>('');

  // Pagination state
  const [page, setPage] = useState(0);
  const limit = 50;

  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ['organizations', typeFilter, regionFilter, searchQuery, page],
    queryFn: () => {
      const params: any = { skip: page * limit, limit };
      if (typeFilter) params.type_filter = typeFilter;
      if (regionFilter) params.region_filter = regionFilter;
      if (searchQuery) params.search_query = searchQuery;
      return organizationsApi.list(params);
    },
  });

  // Reset to page 0 when filters change
  useEffect(() => {
    setPage(0);
  }, [typeFilter, regionFilter, searchQuery]);

  const totalPages = data ? Math.ceil(data.total / limit) : 0;
  const hasNextPage = page < totalPages - 1;
  const hasPrevPage = page > 0;

  const clearFilters = () => {
    setTypeFilter('');
    setRegionFilter('');
    setSearchQuery('');
  };

  const hasActiveFilters = typeFilter || regionFilter || searchQuery;

  const canCreate = hasPermission(user, 'organizations:create');

  return (
    <div className="min-h-screen pb-nav">
      <Header title="Організації" />

      <Container className="py-6">
        {/* Create Button */}
        {canCreate && (
          <div className="mb-4">
            <Link to="/organizations/new">
              <Button fullWidth>
                <Plus className="h-5 w-5 mr-2" />
                Створити організацію
              </Button>
            </Link>
          </div>
        )}

        {/* Filters Card */}
        <Card className="mb-4">
          <CardContent className="p-4 space-y-3">
            {/* Search Field */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Пошук
              </label>
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Назва організації або населений пункт..."
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
              />
            </div>

            {/* Type Filter */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Тип організації
              </label>
              <select
                value={typeFilter}
                onChange={(e) => setTypeFilter(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
              >
                <option value="">Всі типи</option>
                {ORGANIZATION_TYPES.map((type) => (
                  <option key={type.value} value={type.value}>
                    {type.label}
                  </option>
                ))}
              </select>
            </div>

            {/* Region Filter */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Область
              </label>
              <select
                value={regionFilter}
                onChange={(e) => setRegionFilter(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
              >
                <option value="">Всі області</option>
                {ALL_REGIONS.map((region) => (
                  <option key={region} value={region}>
                    {region}
                  </option>
                ))}
              </select>
            </div>

            {/* Clear Filters Button */}
            {hasActiveFilters && (
              <Button
                variant="outline"
                fullWidth
                onClick={clearFilters}
              >
                Скинути фільтри
              </Button>
            )}
          </CardContent>
        </Card>

        {/* Results Header */}
        <div className="mb-4 flex items-center justify-between">
          <div className="text-sm text-gray-600">
            {data && (
              <>
                Показано {page * limit + 1}-{Math.min((page + 1) * limit, data.total)} з {data.total}
              </>
            )}
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={() => refetch()}
            disabled={isLoading}
          >
            <RefreshCw className="h-4 w-4 mr-1" />
            Оновити
          </Button>
        </div>

        {isLoading && <Loading text="Завантаження організацій..." />}

        {error && (
          <div className="p-4 bg-red-50 border border-red-200 rounded-lg">
            <p className="text-sm text-red-800">Помилка завантаження організацій</p>
          </div>
        )}

        {data && (
          <div className="space-y-3">
            {data.organizations.length === 0 ? (
              <div className="text-center py-12">
                <Building2 className="h-12 w-12 text-gray-400 mx-auto mb-3" />
                <p className="text-gray-600">Організації не знайдено</p>
              </div>
            ) : (
              data.organizations.map((organization) => (
                <Link key={organization.id} to={`/organizations/${organization.id}`}>
                  <Card className="active:opacity-90 transition-opacity">
                    <CardContent className="p-4">
                      <div className="mb-2">
                        <h3 className="font-semibold text-gray-900 text-lg">
                          {organization.name}
                        </h3>
                      </div>
                      <div className="space-y-1 text-sm text-gray-600">
                        <div className="flex items-center gap-2">
                          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-primary-100 text-primary-800">
                            {getOrganizationTypeLabel(organization.type)}
                          </span>
                        </div>
                        {organization.region && (
                          <p>
                            <span className="font-medium">Область:</span>{' '}
                            {organization.region}
                          </p>
                        )}
                        {organization.city && (
                          <p>
                            <span className="font-medium">Населений пункт:</span>{' '}
                            {organization.city}
                          </p>
                        )}
                        {organization.address && (
                          <p className="truncate">
                            <span className="font-medium">Адреса:</span>{' '}
                            {organization.address}
                          </p>
                        )}
                      </div>
                    </CardContent>
                  </Card>
                </Link>
              ))
            )}
          </div>
        )}

        {/* Pagination */}
        {data && totalPages > 1 && (
          <div className="mt-6 flex items-center justify-between">
            <Button
              variant="outline"
              onClick={() => setPage(page - 1)}
              disabled={!hasPrevPage || isLoading}
            >
              <ChevronLeft className="h-4 w-4 mr-1" />
              Попередня
            </Button>

            <div className="text-sm text-gray-600">
              Сторінка {page + 1} з {totalPages}
            </div>

            <Button
              variant="outline"
              onClick={() => setPage(page + 1)}
              disabled={!hasNextPage || isLoading}
            >
              Наступна
              <ChevronRight className="h-4 w-4 ml-1" />
            </Button>
          </div>
        )}
      </Container>
    </div>
  );
}
