from __future__ import annotations

from abc import ABC, abstractmethod

from .models import Event, EventMapping, EventWithMappings


class EventRepository(ABC):
    @abstractmethod
    async def list_all(self, include_inactive: bool = False) -> list[Event]: ...

    @abstractmethod
    async def get_by_id(self, event_id: int) -> Event | None: ...

    @abstractmethod
    async def get_by_code(self, code: str) -> Event | None: ...

    @abstractmethod
    async def create(
        self,
        code: str,
        description: str,
        entry_type: str,
    ) -> Event: ...

    @abstractmethod
    async def update(
        self,
        event_id: int,
        description: str | None = None,
        entry_type: str | None = None,
        is_active: bool | None = None,
    ) -> Event | None: ...

    @abstractmethod
    async def delete(self, event_id: int) -> bool: ...


class EventMappingRepository(ABC):
    @abstractmethod
    async def list_for_event(self, event_id: int) -> list[EventMapping]: ...

    @abstractmethod
    async def get_with_mappings(self, event_id: int) -> EventWithMappings | None: ...

    @abstractmethod
    async def upsert(
        self,
        event_id: int,
        cost_center_id: int | None,
        credit_account: str | None,
        debit_account: str | None,
    ) -> EventMapping: ...

    @abstractmethod
    async def delete(self, mapping_id: int) -> bool: ...

    @abstractmethod
    async def resolve(
        self,
        event_code: str,
        cost_center_code: str | None,
        company_code: str | None = None,
    ) -> EventMapping | None:
        # Priority: (event_code, cc_code, company_code) → (event_code, cc_code) → (event_code, NULL cc)
        ...
