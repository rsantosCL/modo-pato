from django.http import JsonResponse
from django.urls import path, include


def health(request):
    return JsonResponse({'status': 'ok'})


urlpatterns = [
    path('v1/health/', health),
    path('v1/auth/', include('accounts.urls')),
    path('v1/ledgers/', include('ledgers.urls')),
    path('v1/invites/', include('ledgers.invite_urls')),
    path('v1/ledgers/<uuid:ledger_pk>/catalog-items/', include('catalog.urls')),
    path('v1/catalog-items/', include('catalog.item_urls')),
]
