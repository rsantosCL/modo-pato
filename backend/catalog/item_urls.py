from django.urls import path
from .views import CatalogItemDetailView, CatalogItemRevisionListCreateView

urlpatterns = [
    path("<uuid:pk>/", CatalogItemDetailView.as_view()),
    path("<uuid:item_pk>/revisions/", CatalogItemRevisionListCreateView.as_view()),
]
