from django.urls import path
from .views import CatalogItemListCreateView, CatalogItemDetailView, CatalogItemRevisionListCreateView

urlpatterns = [
    path("", CatalogItemListCreateView.as_view()),
    path("<uuid:pk>/", CatalogItemDetailView.as_view()),
    path("<uuid:item_pk>/revisions/", CatalogItemRevisionListCreateView.as_view()),
]
