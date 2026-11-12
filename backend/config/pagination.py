from rest_framework.pagination import PageNumberPagination


class OptionalPagination(PageNumberPagination):
    """Постраничный вывод по запросу: ?page=2&page_size=20.
    Без параметров page и page_size список возвращается целиком, как раньше (сайт на это рассчитывает).
    С параметрами ответ такой: {"count", "next", "previous", "results"}."""
    page_size = 20
    page_size_query_param = "page_size"
    max_page_size = 100

    def paginate_queryset(self, queryset, request, view=None):
        if "page" not in request.query_params and "page_size" not in request.query_params:
            return None
        return super().paginate_queryset(queryset, request, view)
