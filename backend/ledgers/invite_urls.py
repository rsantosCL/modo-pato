from django.urls import path
from .views import InviteAcceptView

urlpatterns = [
    path("<str:token>/accept/", InviteAcceptView.as_view()),
]
