import calendar
from datetime import date

from .enums import ItemFrequency


class DerivedFields:

    @staticmethod
    def _advance_month(d: date) -> date:
        if d.month == 12:
            return d.replace(year=d.year + 1, month=1)
        return d.replace(month=d.month + 1)

    @staticmethod
    def valid_months(
        frequency: ItemFrequency,
        start_month: date,
        custom_months: list[calendar.Month] | None,
    ) -> list[calendar.Month]:
        """Return sorted list of calendar.Month values when this item applies."""
        m = start_month.month
        if frequency == ItemFrequency.MONTHLY:
            return [calendar.Month(i) for i in range(1, 13)]
        if frequency == ItemFrequency.QUARTERLY:
            return sorted({calendar.Month(((m - 1 + offset) % 12) + 1) for offset in (0, 3, 6, 9)})
        if frequency == ItemFrequency.HALF_YEARLY:
            return sorted({calendar.Month(((m - 1 + offset) % 12) + 1) for offset in (0, 6)})
        if frequency == ItemFrequency.YEARLY:
            return [calendar.Month(m)]
        if frequency == ItemFrequency.CUSTOM:
            return sorted(custom_months or [])
        return []

    @classmethod
    def end_month(
        cls,
        start_month: date,
        frequency: ItemFrequency,
        custom_months: list[calendar.Month] | None,
        total_installments: int | None,
    ) -> date | None:
        """Return the last applicable year-month (day=1), or None for infinite."""
        if total_installments is None:
            return None
        vm = cls.valid_months(frequency, start_month, custom_months)
        count = 0
        current = start_month
        last: date | None = None
        while count < total_installments:
            if calendar.Month(current.month) in vm:
                count += 1
                last = current
            if count < total_installments:
                current = cls._advance_month(current)
        return last

    @classmethod
    def prepaid_installments(
        cls,
        start_month: date,
        frequency: ItemFrequency,
        custom_months: list[calendar.Month] | None,
        payoff_month: date | None,
    ) -> int:
        """Count installments between start_month (inclusive) and payoff_month (exclusive)."""
        if payoff_month is None:
            return 0
        vm = cls.valid_months(frequency, start_month, custom_months)
        count = 0
        current = start_month
        while current < payoff_month:
            if calendar.Month(current.month) in vm:
                count += 1
            current = cls._advance_month(current)
        return count
