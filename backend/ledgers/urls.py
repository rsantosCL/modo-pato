from django.urls import path
from .views import LedgerListCreateView, LedgerDetailView, LedgerMembersView, InviteCreateView

urlpatterns = [
    path("", LedgerListCreateView.as_view()),
    path("<uuid:pk>/", LedgerDetailView.as_view()),
    path("<uuid:ledger_pk>/members/", LedgerMembersView.as_view()),
    path("<uuid:ledger_pk>/invites/", InviteCreateView.as_view()),
]
