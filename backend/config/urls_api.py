from django.http import JsonResponse
from django.urls import path, include


def health(request):
    return JsonResponse({'status': 'ok'})


urlpatterns = [
    path('v1/health/', health),
    path('v1/auth/', include('accounts.urls')),
]
