from __future__ import annotations

from abc import ABC, abstractmethod

from .models import CostCenter


class CostCenterRepository(ABC):
    @abstractmethod
    async def list_all(self, company_id: int | None = None) -> list[CostCenter]: ...

    @abstractmethod
    async def get_by_id(self, cc_id: int) -> CostCenter | None: ...

    @abstractmethod
    async def get_by_code(
        self, code: str, company_id: int | None = None
    ) -> CostCenter | None: ...

    @abstractmethod
    async def create(
        self,
        code: str,
        name: str,
        company_id: int | None = None,
    ) -> CostCenter: ...

    @abstractmethod
    async def update(
        self,
        cc_id: int,
        name: str | None = None,
        company_id: int | None = None,
    ) -> CostCenter | None: ...

    @abstractmethod
    async def delete(self, cc_id: int) -> bool: ...
