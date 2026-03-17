from __future__ import annotations

from abc import ABC, abstractmethod

from .models import Company


class CompanyRepository(ABC):
    @abstractmethod
    async def list_all(self) -> list[Company]: ...

    @abstractmethod
    async def get_by_id(self, company_id: int) -> Company | None: ...

    @abstractmethod
    async def get_by_code(self, code: str) -> Company | None: ...

    @abstractmethod
    async def create(
        self,
        code: str,
        name: str,
        cnpj: str | None = None,
        cnpj_base: str | None = None,
    ) -> Company: ...

    @abstractmethod
    async def update(
        self,
        company_id: int,
        name: str | None = None,
        cnpj: str | None = None,
        cnpj_base: str | None = None,
    ) -> Company | None: ...

    @abstractmethod
    async def delete(self, company_id: int) -> bool: ...
