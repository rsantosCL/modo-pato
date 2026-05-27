from django.http import JsonResponse
from django.urls import path, include


def health(request):
    return JsonResponse({'status': 'ok'})


urlpatterns = [
    path('v1/health/', health),

    # auth
    path('v1/auth/', include('accounts.urls')),

    # ledger resource
    path('v1/ledgers/', include('ledgers.urls')),

    # nested under ledger
    path('v1/ledgers/<uuid:ledger_pk>/members/', include('ledgers.member_urls')),
    path('v1/ledgers/<uuid:ledger_pk>/invites/', include('ledgers.invite_create_urls')),
    path('v1/ledgers/<uuid:ledger_pk>/catalog-items/', include('catalog.urls')),

    # item-level (addressed by ID, no ledger context needed)
    path('v1/invites/', include('ledgers.invite_urls')),
    path('v1/catalog-items/', include('catalog.item_urls')),
]
