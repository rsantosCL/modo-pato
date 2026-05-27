from django.urls import path
from .views import LedgerListCreateView, LedgerDetailView

urlpatterns = [
    path("", LedgerListCreateView.as_view()),
    path("<uuid:pk>/", LedgerDetailView.as_view()),
]
