from django.urls import path
from .views import LedgerListCreateView, LedgerDetailView, InviteCreateView

urlpatterns = [
    path("", LedgerListCreateView.as_view()),
    path("<uuid:pk>/", LedgerDetailView.as_view()),
    path("<uuid:ledger_pk>/invites/", InviteCreateView.as_view()),
]
