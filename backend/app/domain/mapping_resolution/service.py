from __future__ import annotations

from app.domain.event_registry.repository import EventMappingRepository
from app.domain.mapping_resolution.models import (
    AccountMapping,
    ResolvedEventItem,
    ResolvedPayrollBlock,
)
from app.domain.payroll_mirror.models import PayrollBlock


async def resolve_payroll_blocks(
    blocks: list[PayrollBlock],
    mapping_repo: EventMappingRepository,
) -> list[ResolvedPayrollBlock]:
    """
    Enrich each EventItem in each PayrollBlock with its accounting mapping.

    Resolution strategy per event:
      1. Exact match on (event_code, cost_center_code)
      2. Default match on (event_code, NULL cost_center)
      3. not_mapped = True, accounts = None
    """
    resolved_blocks: list[ResolvedPayrollBlock] = []

    for block in blocks:
        resolved_events: list[ResolvedEventItem] = []

        for event in block.events:
            mapping_row = await mapping_repo.resolve(
                event_code=event.event_code,
                cost_center_code=block.cost_center_code,
            )

            if mapping_row:
                account_mapping = AccountMapping(
                    credit_account=mapping_row.credit_account,
                    debit_account=mapping_row.debit_account,
                    is_mapped=True,
                )
            else:
                account_mapping = AccountMapping(
                    credit_account=None,
                    debit_account=None,
                    is_mapped=False,
                )

            resolved_events.append(
                ResolvedEventItem(
                    entry_type=event.entry_type,
                    event_code=event.event_code,
                    description=event.description,
                    amount=event.amount,
                    mapping=account_mapping,
                )
            )

        resolved_blocks.append(
            ResolvedPayrollBlock(
                company_code=block.company_code,
                company_name=block.company_name,
                company_cnpj=block.company_cnpj,
                company_cnpj_base=block.company_cnpj_base,
                competence=block.competence,
                cost_center_code=block.cost_center_code,
                cost_center_name=block.cost_center_name,
                is_totalizer=block.is_totalizer,
                events=resolved_events,
                summary=block.summary,
                gps=block.gps,
                source_start_row=block.source_start_row,
            )
        )

    return resolved_blocks
